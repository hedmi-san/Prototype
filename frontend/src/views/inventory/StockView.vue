<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { useProductStore } from '../../stores/product.store';
import { inventoryService } from '../../services/operations.service';
import type { Stock, StockStatusCounts, Product } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';
import AppPagination from '../../components/common/AppPagination.vue';
import AppProductCombobox from '../../components/common/AppProductCombobox.vue';
import ProductDocumentModal from '../../components/products/ProductDocumentModal.vue';

const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();
const productStore = useProductStore();

const stockList = ref<Stock[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const statusFilter = ref<'all' | 'normal' | 'low' | 'out'>('all');

// Selection state
const selectedStockIds = ref<Set<number>>(new Set());

// Dropdown menus state
const showHeaderExportMenu = ref(false);
const showSelectionActionsMenu = ref(false);

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

// Document Preview Modal State
const showDocModal = ref(false);
const activeDocType = ref<'price_list' | 'catalog'>('price_list');
const docProducts = ref<Product[]>([]);
const docScopeText = ref('');
const preparingDoc = ref(false);

// Computed selection helpers
const selectedCount = computed(() => selectedStockIds.value.size);

const isAllCurrentPageSelected = computed(() => {
  if (!stockList.value.length) return false;
  return stockList.value.every((s) => selectedStockIds.value.has(s.id));
});

const isSomeCurrentPageSelected = computed(() => {
  if (!stockList.value.length) return false;
  const count = stockList.value.filter((s) => selectedStockIds.value.has(s.id)).length;
  return count > 0 && count < stockList.value.length;
});

onMounted(async () => {
  document.addEventListener('click', onDocumentClick);
  await fetchStock();
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  clearTimeout(searchTimeout);
});

function closeDropdowns() {
  showHeaderExportMenu.value = false;
  showSelectionActionsMenu.value = false;
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.dropdown-container')) {
    closeDropdowns();
  }
}

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

// Selection handlers
function toggleSelectStock(id: number) {
  const next = new Set(selectedStockIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedStockIds.value = next;
}

function toggleSelectAllCurrentPage() {
  const next = new Set(selectedStockIds.value);
  if (isAllCurrentPageSelected.value) {
    stockList.value.forEach((s) => next.delete(s.id));
  } else {
    stockList.value.forEach((s) => next.add(s.id));
  }
  selectedStockIds.value = next;
}

function clearSelection() {
  selectedStockIds.value = new Set();
  closeDropdowns();
}

function mapStockToProduct(s: Stock): Product {
  return {
    id: s.productId,
    reference: s.productReference || '',
    name: s.productName || '',
    brand: s.productBrand || '—',
    purchasePrice: s.productPurchasePrice || 0,
    salePrice: s.productSalePrice || 0,
    unit: s.productUnit || 'PIECE',
    boxSize: s.productBoxSize || 0,
    minStockAlert: s.minStockAlert,
    active: true,
    createdAt: s.updatedAt || new Date().toISOString(),
    updatedAt: s.updatedAt || new Date().toISOString(),
  };
}

// Retrieve dataset for exports & document generation for an explicit scope.
async function getTargetProductsForAction(
  scope: 'all' | 'selection',
): Promise<{ items: Product[]; scopeText: string }> {
  if (scope === 'selection' && selectedStockIds.value.size > 0) {
    const selectedIds = Array.from(selectedStockIds.value);
    const res = await inventoryService.getStock({
      warehouseId: authStore.activeWarehouseId || undefined,
      ids: selectedIds,
      limit: selectedIds.length,
    });
    const items = res.items.map(mapStockToProduct);
    return {
      items,
      scopeText: `Sélection : ${items.length} ${items.length > 1 ? 'articles' : 'article'}`,
    };
  }

  // All filtered stock items
  const allRes = await inventoryService.getStock({
    warehouseId: authStore.activeWarehouseId || undefined,
    status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
    search: searchQuery.value.trim() || undefined,
    limit: 1000,
  });
  const items = allRes.items.map(mapStockToProduct);
  return {
    items,
    scopeText: `Tout le stock filtré (${items.length} ${items.length > 1 ? 'articles' : 'article'})`,
  };
}

async function handleOpenDocument(type: 'price_list' | 'catalog', scope: 'all' | 'selection') {
  preparingDoc.value = true;
  try {
    activeDocType.value = type;
    const { items, scopeText } = await getTargetProductsForAction(scope);
    docProducts.value = items;
    docScopeText.value = scopeText;
    showDocModal.value = true;
  } catch (err) {
    console.error('Failed to prepare document products from stock', err);
  } finally {
    preparingDoc.value = false;
  }
}

async function handleExportCsv(scope: 'all' | 'selection') {
  exporting.value = true;
  try {
    if (scope === 'selection' && selectedStockIds.value.size > 0) {
      await inventoryService.exportStockCsv({
        warehouseId: authStore.activeWarehouseId || undefined,
        ids: Array.from(selectedStockIds.value),
      });
    } else {
      await inventoryService.exportStockCsv({
        warehouseId: authStore.activeWarehouseId || undefined,
        status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
        search: searchQuery.value.trim() || undefined,
      });
    }
  } catch (err) {
    console.error('Failed to export stock CSV', err);
  } finally {
    exporting.value = false;
  }
}

function handleHeaderExport(type: 'csv' | 'price_list' | 'catalog') {
  closeDropdowns();
  if (type === 'csv') {
    handleExportCsv('all');
  } else {
    handleOpenDocument(type, 'all');
  }
}

function handleSelectionAction(type: 'csv' | 'price_list' | 'catalog') {
  closeDropdowns();
  if (type === 'csv') {
    handleExportCsv('selection');
  } else {
    handleOpenDocument(type, 'selection');
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
    <!-- Calm, Uncluttered Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Gestion des Stocks & Inventaire</h1>
        <p class="text-muted">Niveaux de stocks physiques, réservés et disponibles en temps réel</p>
      </div>
      <div class="header-actions">
        <!-- Overflow Export Menu for whole stock list (only when no active selection) -->
        <div v-if="selectedCount === 0" class="dropdown-container">
          <button
            type="button"
            class="header-export-btn"
            :disabled="exporting || preparingDoc"
            title="Options d'exportation de l'inventaire filtré"
            @click.stop="showHeaderExportMenu = !showHeaderExportMenu"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Exporter</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <div v-if="showHeaderExportMenu" class="dropdown-menu dropdown-right">
            <button class="dropdown-item" @click="handleHeaderExport('csv')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Exporter CSV (Tout filtré)</span>
            </button>
            <button class="dropdown-item" @click="handleHeaderExport('price_list')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Générer Devis PDF (Tout filtré)</span>
            </button>
            <button class="dropdown-item" @click="handleHeaderExport('catalog')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span>Générer Catalogue PDF (Tout filtré)</span>
            </button>
          </div>
        </div>

        <!-- Primary Action -->
        <AppButton variant="primary" @click="openReceiptModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Réception de Stock
        </AppButton>
      </div>
    </div>

    <!-- Calm Contextual Selection Toolbar -->
    <div v-if="selectedCount > 0" class="selection-action-bar">
      <div class="selection-info">
        <span class="selection-check-icon">✓</span>
        <span class="selection-text">
          {{ selectedCount }} {{ selectedCount > 1 ? 'articles sélectionnés' : 'article sélectionné' }}
        </span>
      </div>

      <div class="selection-controls">
        <div class="dropdown-container">
          <button
            type="button"
            class="selection-actions-btn"
            :disabled="exporting || preparingDoc"
            @click.stop="showSelectionActionsMenu = !showSelectionActionsMenu"
          >
            <span>Actions</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <div v-if="showSelectionActionsMenu" class="dropdown-menu dropdown-right">
            <button class="dropdown-item" @click="handleSelectionAction('csv')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Exporter en CSV ({{ selectedCount }})</span>
            </button>
            <button class="dropdown-item" @click="handleSelectionAction('price_list')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Devis / Prix de Vente ({{ selectedCount }})</span>
            </button>
            <button class="dropdown-item" @click="handleSelectionAction('catalog')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span>Catalogue Références ({{ selectedCount }})</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          class="selection-close-btn"
          title="Désélectionner tout"
          @click="clearSelection"
        >
          ✕
        </button>
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
    <AppTable :loading="loading" :empty="!stockList.length" empty-text="Aucun enregistrement de stock trouvé" :columns-count="10">
      <template #header>
        <th class="col-checkbox">
          <input
            type="checkbox"
            class="custom-checkbox"
            :checked="isAllCurrentPageSelected"
            :indeterminate.prop="isSomeCurrentPageSelected"
            title="Tout sélectionner / désélectionner sur cette page"
            @change="toggleSelectAllCurrentPage"
          />
        </th>
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
        <tr
          v-for="stock in stockList"
          :key="stock.id"
          :class="{ 'row-selected': selectedStockIds.has(stock.id) }"
        >
          <td class="col-checkbox">
            <input
              type="checkbox"
              class="custom-checkbox"
              :checked="selectedStockIds.has(stock.id)"
              @change="toggleSelectStock(stock.id)"
            />
          </td>
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
                v-else-if="stock.availableQuantity <= (stock.minStockAlert ?? 1)"
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

    <!-- Document Print / PDF Preview Modal -->
    <ProductDocumentModal
      v-model="showDocModal"
      v-model:document-type="activeDocType"
      :products="docProducts"
      :scope-text="docScopeText"
    />

    <!-- Stock Adjustment Modal -->
    <AppModal
      v-model="showAdjustModal"
      title="Ajustement Manuel de Stock"
      max-width="500px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <div class="modal-form">
        <div class="adjust-info-box">
          <div class="info-item">
            <span class="info-label">Entrepôt :</span>
            <strong>{{ adjustStockTarget?.warehouseName }}</strong>
          </div>
          <div class="info-item">
            <span class="info-label">Produit :</span>
            <strong>{{ adjustStockTarget?.productName }}</strong>
          </div>
          <div class="info-item">
            <span class="info-label">Stock Physique Actuel :</span>
            <strong class="font-mono">{{ adjustStockTarget?.physicalQuantity }}</strong>
          </div>
          <div class="info-item">
            <span class="info-label">Stock Disponible :</span>
            <strong class="font-mono">{{ adjustStockTarget?.availableQuantity }}</strong>
          </div>
        </div>

        <AppInput
          v-model="adjustForm.quantity"
          type="number"
          label="Quantité d'ajustement (+ pour entrée, - pour sortie)"
          placeholder="ex. -5 ou +10"
          required
        />

        <div class="app-input-group">
          <label class="input-label">Motif de l'ajustement <span class="required-star">*</span></label>
          <textarea
            v-model="adjustForm.reason"
            rows="3"
            class="app-textarea"
            placeholder="Justification obligatoire (ex. Inventaire tournant, Casse constatée, Correction écart...)"
            required
          />
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="showAdjustModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveAdjustment">
          Valider l'ajustement
        </AppButton>
      </template>
    </AppModal>

    <!-- Initial Stock Receipt Modal -->
    <AppModal
      v-model="showReceiptModal"
      title="Réception de Stock Initial"
      max-width="550px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <div class="modal-form">
        <div class="app-input-group">
          <label class="input-label">Entrepôt Destinataire <span class="required-star">*</span></label>
          <select v-model="receiptForm.warehouseId" class="app-select" required>
            <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">
              {{ wh.name }} ({{ wh.code }})
            </option>
          </select>
        </div>

        <AppProductCombobox
          v-model="receiptForm.productId"
          label="Sélectionner le Produit"
          placeholder="Rechercher par référence, désignation, marque..."
          required
        />

        <AppInput
          v-model="receiptForm.quantity"
          type="number"
          label="Quantité Réceptionnée"
          placeholder="ex. 100"
          required
        />

        <AppInput
          v-model="receiptForm.reference"
          label="Référence du Lot / Bon de Réception"
          placeholder="ex. REC-2026-001"
          required
        />

        <div class="app-input-group">
          <label class="input-label">Notes & Observations (Optionnel)</label>
          <textarea
            v-model="receiptForm.notes"
            rows="2"
            class="app-textarea"
            placeholder="Informations complémentaires sur le fournisseur ou le transporteur..."
          />
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="showReceiptModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveReceipt">
          Enregistrer la Réception
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
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Header Export Button */
.header-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  transition: all var(--transition-fast, 0.15s ease);
}

.header-export-btn:hover:not(:disabled) {
  background-color: var(--color-surface-hover, #f3f4f6);
  border-color: var(--color-border-dark, #9ca3af);
}

.header-export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Dropdown Container & Menu */
.dropdown-container {
  position: relative;
  display: inline-block;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  min-width: 220px;
  background-color: #ffffff;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12), 0 4px 6px rgba(0, 0, 0, 0.04);
  padding: 6px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 2px;
  animation: dropdownFade 0.15s ease-out;
}

.dropdown-right {
  right: 0;
}

@keyframes dropdownFade {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  font-size: 12.5px;
  font-weight: 500;
  color: #1f2937;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.12s ease;
}

.dropdown-item:hover {
  background-color: #f3f4f6;
  color: var(--color-primary, #2563eb);
}

.dropdown-item svg {
  color: #6b7280;
  flex-shrink: 0;
}

.dropdown-item:hover svg {
  color: var(--color-primary, #2563eb);
}

/* Calm Contextual Selection Toolbar */
.selection-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 14px;
  background-color: #1e293b;
  color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
  animation: slideDown 0.18s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selection-check-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background-color: #3b82f6;
  color: #ffffff;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
}

.selection-text {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.selection-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selection-actions-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background-color: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  cursor: pointer;
  transition: all 0.15s ease;
}

.selection-actions-btn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.35);
}

.selection-actions-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.selection-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.selection-close-btn:hover {
  color: #f87171;
  background-color: rgba(239, 68, 68, 0.15);
}

/* Checkboxes */
.col-checkbox {
  width: 38px;
  text-align: center;
  padding-left: 14px !important;
  padding-right: 6px !important;
}

.custom-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary, #2563eb);
  vertical-align: middle;
}

:deep(tbody tr.row-selected) {
  background-color: #f0f7ff !important;
}

:deep(tbody tr.row-selected:hover) {
  background-color: #e0effe !important;
}

/* Status Tabs */
.status-tabs-container {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.status-tab-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.status-tab-pill:hover {
  background-color: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.status-tab-pill.active {
  background-color: var(--color-primary);
  color: #ffffff;
  border-color: var(--color-primary);
}

.tab-badge {
  display: inline-block;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9999px;
  background-color: var(--color-border);
  color: var(--color-text-primary);
}

.status-tab-pill.active .tab-badge {
  background-color: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.badge-normal {
  background-color: var(--color-success-bg);
  color: var(--color-success);
}

.badge-warning {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
}

.badge-danger {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
}

/* Filter Bar */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 240px;
  max-width: 420px;
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
