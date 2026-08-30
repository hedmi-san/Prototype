<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { useProductStore } from '../../stores/product.store';
import { inventoryService } from '../../services/operations.service';
import type { Stock, StockStatusCounts } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';
import AppPagination from '../../components/common/AppPagination.vue';
import AppProductCombobox from '../../components/common/AppProductCombobox.vue';

const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();
const productStore = useProductStore();

const stockList = ref<Stock[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const statusFilter = ref<'all' | 'normal' | 'low' | 'out'>('all');

// Pagination state
const page = ref(1);
const limit = ref(25);
const total = ref(0);
const totalPages = ref(1);

// Live aggregate counters for status tabs
const counts = ref<StockStatusCounts>({
  total: 0,
  normal: 0,
  low: 0,
  out: 0,
});

// Adjustment Modal State
const showAdjustModal = ref(false);
const adjustForm = ref({
  warehouseId: 0,
  productId: 0,
  quantity: 0,
  reason: '',
});
const adjustStockTarget = ref<Stock | null>(null);

// Initial Stock Receipt Modal State
const showReceiptModal = ref(false);
const receiptForm = ref<{
  warehouseId: number;
  productId: number | null;
  quantity: number;
  reference: string;
  notes: string;
}>({
  warehouseId: 0,
  productId: null,
  quantity: 10,
  reference: '',
  notes: '',
});

const saving = ref(false);
const errorMessage = ref('');
const exporting = ref(false);

onMounted(async () => {
  await fetchStock();
});

// Watch warehouse changes to refresh
watch(() => authStore.activeWarehouseId, async () => {
  page.value = 1;
  await fetchStock();
});

// Watch status filter tab changes
watch(statusFilter, async () => {
  page.value = 1;
  await fetchStock();
});

let searchTimeout: any = null;
function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    page.value = 1;
    await fetchStock();
  }, 300);
}

function onPageChange(payload: { page: number; limit: number }) {
  page.value = payload.page;
  limit.value = payload.limit;
  fetchStock();
}

async function fetchStock() {
  loading.value = true;
  try {
    const res = await inventoryService.getStock({
      warehouseId: authStore.activeWarehouseId || undefined,
      status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
      search: searchQuery.value.trim() || undefined,
      page: page.value,
      limit: limit.value,
    });

    stockList.value = res.items;
    total.value = res.pagination.total;
    totalPages.value = res.pagination.totalPages;
    page.value = res.pagination.page;

    if (res.counts) {
      counts.value = res.counts;
    }
  } catch (err) {
    console.error('Failed to load stock', err);
  } finally {
    loading.value = false;
  }
}

async function handleExportCsv() {
  exporting.value = true;
  try {
    await inventoryService.exportStockCsv({
      warehouseId: authStore.activeWarehouseId || undefined,
      status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
      search: searchQuery.value.trim() || undefined,
    });
  } catch (err) {
    console.error('Failed to export stock CSV', err);
  } finally {
    exporting.value = false;
  }
}

function openAdjustModal(stock: Stock) {
  adjustStockTarget.value = stock;
  adjustForm.value = {
    warehouseId: stock.warehouseId,
    productId: stock.productId,
    quantity: 0,
    reason: '',
  };
  errorMessage.value = '';
  showAdjustModal.value = true;
}

async function openReceiptModal() {
  receiptForm.value = {
    warehouseId: authStore.activeWarehouseId || warehouseStore.warehouses[0]?.id || 1,
    productId: null,
    quantity: 10,
    reference: `REC-${Date.now().toString().slice(-6)}`,
    notes: '',
  };
  errorMessage.value = '';
  showReceiptModal.value = true;

  // Smart loading: Defer products catalog fetching until receipt modal is actually opened
  if (!productStore.products.length) {
    productStore.fetchProducts().catch((err) => console.error('Failed to preload products in modal', err));
  }
}

async function handleSaveAdjustment() {
  if (!adjustForm.value.reason.trim()) {
    errorMessage.value = 'Un motif obligatoire est requis pour les ajustements manuels de stock';
    return;
  }
  if (adjustForm.value.quantity === 0) {
    errorMessage.value = "La quantité d'ajustement ne peut pas être égale à 0";
    return;
  }

  saving.value = true;
  errorMessage.value = '';
  try {
    await inventoryService.adjustStock(adjustForm.value);
    showAdjustModal.value = false;
    await fetchStock();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || "Échec de l'ajustement du stock";
  } finally {
    saving.value = false;
  }
}

async function handleSaveReceipt() {
  if (!receiptForm.value.productId) {
    errorMessage.value = "Veuillez sélectionner un produit";
    return;
  }
  if (!receiptForm.value.reference.trim()) {
    errorMessage.value = "La référence du lot / expédition est obligatoire";
    return;
  }
  if (receiptForm.value.quantity <= 0) {
    errorMessage.value = "La quantité entrante doit être supérieure à zéro";
    return;
  }

  saving.value = true;
  errorMessage.value = '';
  try {
    await inventoryService.receiveInitialStock({
      warehouseId: receiptForm.value.warehouseId,
      productId: receiptForm.value.productId,
      quantity: receiptForm.value.quantity,
      reference: receiptForm.value.reference,
      notes: receiptForm.value.notes,
    });
    showReceiptModal.value = false;
    await fetchStock();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Échec de la réception du stock';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="inventory-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Gestion des Stocks & Inventaire</h1>
        <p class="text-muted">Niveaux de stocks physiques, réservés et disponibles en temps réel</p>
      </div>
      <div class="header-actions">
        <AppButton variant="secondary" :loading="exporting" @click="handleExportCsv">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exporter CSV
        </AppButton>
        <AppButton variant="primary" @click="openReceiptModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Réception de Stock
        </AppButton>
      </div>
    </div>

    <!-- Status Tabs Filter Bar -->
    <div class="status-tabs-container">
      <button
        class="status-tab-pill"
        :class="{ active: statusFilter === 'all' }"
        @click="statusFilter = 'all'"
      >
        <span>Tous les articles</span>
        <span class="tab-badge">{{ formatNumber(counts.total) }}</span>
      </button>

      <button
        class="status-tab-pill"
        :class="{ active: statusFilter === 'normal' }"
        @click="statusFilter = 'normal'"
      >
        <span>En stock</span>
        <span class="tab-badge badge-normal">{{ formatNumber(counts.normal) }}</span>
      </button>

      <button
        class="status-tab-pill"
        :class="{ active: statusFilter === 'low' }"
        @click="statusFilter = 'low'"
      >
        <span>Stock faible</span>
        <span class="tab-badge badge-warning">{{ formatNumber(counts.low) }}</span>
      </button>

      <button
        class="status-tab-pill"
        :class="{ active: statusFilter === 'out' }"
        @click="statusFilter = 'out'"
      >
        <span>En rupture</span>
        <span class="tab-badge badge-danger">{{ formatNumber(counts.out) }}</span>
      </button>
    </div>

    <!-- Search & Filter Controls -->
    <div class="filter-bar">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher par référence, désignation, marque, entrepôt..."
          class="search-input"
          @input="onSearchInput"
        />
        <button
          v-if="searchQuery"
          class="clear-search-btn"
          title="Effacer la recherche"
          @click="searchQuery = ''; onSearchInput()"
        >
          ✕
        </button>
      </div>

      <div class="count-badge text-muted font-mono">
        {{ total }} {{ total > 1 ? 'articles trouvés' : 'article trouvé' }}
      </div>
    </div>

    <!-- Stock Table -->
    <AppTable :loading="loading" :empty="!stockList.length" empty-text="Aucun enregistrement de stock trouvé" :columns-count="9">
      <template #header>
        <th>Entrepôt</th>
        <th>Référence</th>
        <th>Produit</th>
        <th>Stock Physique</th>
        <th>Nombre de Cartons</th>
        <th>Réservé</th>
        <th>Disponible</th>
        <th>Valorisation</th>
        <th>Actions</th>
      </template>
      <template #body>
        <tr v-for="stock in stockList" :key="stock.id">
          <td>
            <strong>{{ stock.warehouseName }}</strong>
            <span class="text-caption" style="display: block;">{{ stock.warehouseCode }}</span>
          </td>
          <td class="font-mono font-bold">{{ stock.productReference }}</td>
          <td>
            <strong>{{ stock.productName }}</strong>
          </td>
          <td>
            <div class="font-mono font-bold">{{ formatNumber(stock.physicalQuantity) }}</div>
          </td>
          <td class="font-mono">
            <template v-if="stock.productBoxSize && stock.productBoxSize > 0">
              <span class="font-bold">{{ formatNumber(Math.floor(stock.physicalQuantity / stock.productBoxSize)) }}</span>
              <span class="text-caption text-muted" style="margin-left: 4px;">
                {{ Math.floor(stock.physicalQuantity / stock.productBoxSize) > 1 ? 'Cartons' : 'Carton' }}
              </span>
            </template>
            <span v-else class="text-muted">—</span>
          </td>
          <td class="font-mono text-muted">
            <span v-if="stock.reservedQuantity > 0" class="reserved-pill">
              {{ formatNumber(stock.reservedQuantity) }} réservé(s)
            </span>
            <span v-else>0</span>
          </td>
          <td>
            <div class="available-cell">
              <span class="font-mono font-bold">{{ formatNumber(stock.availableQuantity) }}</span>
              <AppBadge
                v-if="stock.availableQuantity === 0"
                variant="danger"
                size="sm"
              >
                RUPTURE
              </AppBadge>
              <AppBadge
                v-else-if="stock.availableQuantity <= (stock.minStockAlert ?? 5)"
                variant="warning"
                size="sm"
              >
                FAIBLE
              </AppBadge>
            </div>
          </td>
          <td class="font-mono">{{ formatCurrency(stock.totalValuation) }}</td>
          <td>
            <button
              class="icon-action-btn"
              title="Ajustement manuel de stock"
              @click="openAdjustModal(stock)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Ajuster
            </button>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Standard Reusable Pagination Component -->
    <AppPagination
      :page="page"
      :limit="limit"
      :total="total"
      :total-pages="totalPages"
      :loading="loading"
      @update:page="page = $event"
      @update:limit="limit = $event"
      @change="onPageChange"
    />

    <!-- Stock Adjustment Modal -->
    <AppModal
      v-model="showAdjustModal"
      :title="`Ajustement Manuel : ${adjustStockTarget?.productName || ''}`"
      max-width="480px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <div class="adjust-info-box mb-3">
        <div class="info-item">
          <span class="info-label">Entrepôt :</span>
          <strong>{{ adjustStockTarget?.warehouseName }}</strong>
        </div>
        <div class="info-item">
          <span class="info-label">Stock Physique :</span>
          <strong class="font-mono">{{ formatNumber(adjustStockTarget?.physicalQuantity) }}</strong>
        </div>
        <div class="info-item">
          <span class="info-label">Réservé pour Transferts :</span>
          <strong class="font-mono">{{ formatNumber(adjustStockTarget?.reservedQuantity) }}</strong>
        </div>
        <div class="info-item">
          <span class="info-label">Actuellement Disponible :</span>
          <strong class="font-mono text-success">{{ formatNumber(adjustStockTarget?.availableQuantity) }}</strong>
        </div>
      </div>

      <form class="modal-form" @submit.prevent="handleSaveAdjustment">
        <AppInput
          v-model="adjustForm.quantity"
          type="number"
          label="Quantité Delta d'Ajustement (+ ou -)"
          hint="Nombre positif pour ajouter du stock, négatif pour en déduire"
          required
        />

        <div class="app-input-group">
          <label class="input-label">
            Motif Obligatoire d'Ajustement
            <span class="required-star">*</span>
          </label>
          <textarea
            v-model="adjustForm.reason"
            rows="3"
            class="app-textarea"
            placeholder="Justification d'audit obligatoire (ex. Inventaire physique annuel, remplacement d'unité défectueuse)..."
            required
          />
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showAdjustModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveAdjustment">
          Appliquer l'Ajustement
        </AppButton>
      </template>
    </AppModal>

    <!-- Initial Receipt Modal -->
    <AppModal
      v-model="showReceiptModal"
      title="Enregistrer une Entrée de Stock Fabricant"
      max-width="500px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleSaveReceipt">
        <div class="app-input-group">
          <label class="input-label">Entrepôt de Destination</label>
          <select v-model="receiptForm.warehouseId" class="app-select" required>
            <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
              {{ w.name }} ({{ w.code }})
            </option>
          </select>
        </div>

        <div class="app-input-group">
          <label class="input-label">Produit</label>
          <AppProductCombobox
            v-model="receiptForm.productId"
            placeholder="Rechercher un produit (nom ou référence)..."
            required
          />
        </div>

        <AppInput
          v-model="receiptForm.quantity"
          type="number"
          label="Quantité Entrante"
          placeholder="ex. 50"
          required
        />

        <AppInput
          v-model="receiptForm.reference"
          label="Référence Expédition / Lot"
          placeholder="ex. SHIP-ALG-2026-08"
          required
        />

        <AppInput
          v-model="receiptForm.notes"
          label="Notes / Infos Fournisseur"
          placeholder="ex. Livraison directe usine Conteneur #4"
        />
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showReceiptModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveReceipt">
          Confirmer la Réception
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.inventory-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Status Tabs Bar */
.status-tabs-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  width: fit-content;
}

.status-tab-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
}

.status-tab-pill:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg);
}

.status-tab-pill.active {
  color: var(--color-text-primary);
  background-color: var(--color-bg);
  border-color: var(--color-border-dark);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 7px;
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 600;
  border-radius: 10px;
  background-color: var(--color-surface-hover);
  color: var(--color-text-secondary);
}

.status-tab-pill.active .tab-badge {
  background-color: var(--color-border-dark);
  color: var(--color-bg);
}

.badge-normal {
  color: var(--color-success);
}
.status-tab-pill.active .badge-normal {
  background-color: var(--color-success);
  color: #ffffff;
}

.badge-warning {
  color: var(--color-warning);
}
.status-tab-pill.active .badge-warning {
  background-color: var(--color-warning);
  color: #ffffff;
}

.badge-danger {
  color: var(--color-danger);
}
.status-tab-pill.active .badge-danger {
  background-color: var(--color-danger);
  color: #ffffff;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 520px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

.clear-search-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 12px;
  padding: 4px;
}

.clear-search-btn:hover {
  color: var(--color-text-primary);
}

.search-input {
  width: 100%;
  height: 38px;
  padding: 8px 32px 8px 36px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
  transition: all var(--transition-fast);
}

.search-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.font-bold {
  font-weight: 600;
}

.reserved-pill {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 11px;
}

.available-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 500;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.icon-action-btn:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-dark);
}

.adjust-info-box {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  background-color: var(--color-surface);
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.app-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.required-star {
  color: var(--color-danger);
}

.app-textarea, .app-select {
  width: 100%;
  padding: 8px 12px;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-text-primary);
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  outline: none;
}

.app-textarea:focus, .app-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.modal-error {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.mb-3 {
  margin-bottom: 12px;
}
</style>
