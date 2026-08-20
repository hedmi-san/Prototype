<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { saleService } from '../../services/operations.service';
import { productService } from '../../services/catalog.service';
import type { Sale, Product } from '../../types';
import type { ComputedPeriodRange } from '../../utils/periodNavigator';
import { formatCurrency, formatDateTime, formatNumber, formatSaleStatus } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';
import AppPeriodNavigator from '../../components/common/AppPeriodNavigator.vue';
import AppPagination from '../../components/common/AppPagination.vue';
import ConfirmDialog from '../../components/common/ConfirmDialog.vue';

const authStore = useAuthStore();
const sales = ref<Sale[]>([]);
const products = ref<Product[]>([]);
const loading = ref(true);
const searchQuery = ref('');

// Period & Pagination state
const activeRange = ref<ComputedPeriodRange | null>(null);
const page = ref(1);
const limit = ref(25);
const total = ref(0);
const totalPages = ref(1);

// Invoice Preview Modal
const showInvoiceModal = ref(false);
const selectedSale = ref<Sale | null>(null);

// Edit Sale Modal
const showEditModal = ref(false);
const editingSale = ref<Sale | null>(null);
const editForm = ref({
  customerName: '',
  customerPhone: '',
  saleDate: '',
  items: [] as { productId: number; quantity: number }[],
});
const saving = ref(false);
const editError = ref('');

// Cancel Sale Confirm
const showCancelDialog = ref(false);
const cancellingSale = ref<Sale | null>(null);
const cancelling = ref(false);

onMounted(async () => {
  await Promise.all([fetchProducts()]);
});

// Watch warehouse changes to refresh sales
watch(() => authStore.activeWarehouseId, async () => {
  page.value = 1;
  await fetchSales();
});

let searchTimeout: any = null;
function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    page.value = 1;
    await fetchSales();
  }, 300);
}

async function onPeriodChange(range: ComputedPeriodRange) {
  activeRange.value = range;
  page.value = 1;
  await fetchSales();
}

function onPageChange(payload: { page: number; limit: number }) {
  page.value = payload.page;
  limit.value = payload.limit;
  fetchSales();
}

async function fetchSales() {
  loading.value = true;
  try {
    const res = await saleService.getSales({
      warehouseId: authStore.activeWarehouseId || undefined,
      startDate: activeRange.value?.startDate,
      endDate: activeRange.value?.endDate,
      search: searchQuery.value.trim() || undefined,
      page: page.value,
      limit: limit.value,
    });
    sales.value = res.items;
    total.value = res.pagination.total;
    totalPages.value = res.pagination.totalPages;
    page.value = res.pagination.page;
  } catch (err) {
    console.error('Failed to load sales', err);
  } finally {
    loading.value = false;
  }
}

async function fetchProducts() {
  try {
    products.value = await productService.getProducts();
  } catch (err) {
    console.error('Failed to load products', err);
  }
}

function formatToDatetimeLocal(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function viewInvoice(sale: Sale) {
  selectedSale.value = sale;
  showInvoiceModal.value = true;
}

function openEditModal(sale: Sale) {
  editingSale.value = sale;
  editForm.value = {
    customerName: sale.customerName || '',
    customerPhone: sale.customerPhone || '',
    saleDate: formatToDatetimeLocal(sale.saleDate || sale.createdAt),
    items: sale.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    })),
  };
  editError.value = '';
  showEditModal.value = true;
}

function addEditItem() {
  if (products.value.length > 0) {
    editForm.value.items.push({
      productId: products.value[0].id,
      quantity: 1,
    });
  }
}

function removeEditItem(index: number) {
  if (editForm.value.items.length > 1) {
    editForm.value.items.splice(index, 1);
  }
}

async function handleSaveEdit() {
  if (!editingSale.value) return;
  saving.value = true;
  editError.value = '';
  try {
    await saleService.updateSale(editingSale.value.id, {
      customerName: editForm.value.customerName.trim() || undefined,
      customerPhone: editForm.value.customerPhone.trim() || undefined,
      saleDate: editForm.value.saleDate ? editForm.value.saleDate.replace('T', ' ') : undefined,
      items: editForm.value.items,
    });
    showEditModal.value = false;
    await fetchSales();
  } catch (err: any) {
    editError.value = err.response?.data?.message || 'Échec de la mise à jour de la vente';
  } finally {
    saving.value = false;
  }
}

function promptCancelSale(sale: Sale) {
  cancellingSale.value = sale;
  showCancelDialog.value = true;
}

async function handleConfirmCancel() {
  if (!cancellingSale.value) return;
  cancelling.value = true;
  try {
    await saleService.cancelSale(cancellingSale.value.id);
    showCancelDialog.value = false;
    await fetchSales();
  } catch (err) {
    console.error('Failed to cancel sale', err);
  } finally {
    cancelling.value = false;
  }
}
</script>

<template>
  <div class="sales-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Ventes & Factures</h1>
        <p class="text-muted">Facturation clients, historique des ventes et réajustements de stock</p>
      </div>
      <div class="header-actions">
        <router-link to="/sales/new">
          <AppButton variant="primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nouvelle Vente (Caisse)
          </AppButton>
        </router-link>
      </div>
    </div>

    <!-- Reusable Period Navigator -->
    <AppPeriodNavigator
      initial-granularity="month"
      @change="onPeriodChange"
    />

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher par n° facture, nom client, téléphone, entrepôt..."
          class="search-input"
          @input="onSearchInput"
        />
      </div>
      <div class="count-badge text-muted font-mono">
        {{ total }} {{ total > 1 ? 'factures trouvées' : 'facture trouvée' }}
      </div>
    </div>

    <!-- Table -->
    <AppTable :loading="loading" :empty="!sales.length" empty-text="Aucune vente enregistrée pour cette période" :columns-count="7">
      <template #header>
        <th>N° Facture</th>
        <th>Entrepôt</th>
        <th>Client</th>
        <th>Montant Total</th>
        <th>Date de Vente</th>
        <th>Statut</th>
        <th>Actions</th>
      </template>
      <template #body>
        <tr v-for="sale in sales" :key="sale.id">
          <td class="font-mono font-bold">{{ sale.invoiceNumber }}</td>
          <td>{{ sale.warehouseName }}</td>
          <td>
            <strong>{{ sale.customerName || 'Client Comptoir' }}</strong>
            <span v-if="sale.customerPhone" class="text-caption text-muted" style="display: block;">
              {{ sale.customerPhone }}
            </span>
          </td>
          <td class="font-mono font-bold">{{ formatCurrency(sale.totalAmount) }}</td>
          <td class="font-mono text-caption">{{ formatDateTime(sale.saleDate || sale.createdAt) }}</td>
          <td>
            <AppBadge :variant="sale.status === 'COMPLETED' ? 'success' : 'danger'" size="sm">
              {{ formatSaleStatus(sale.status) }}
            </AppBadge>
          </td>
          <td>
            <div class="action-buttons">
              <button class="icon-action-btn" title="Afficher / Imprimer la facture" @click="viewInvoice(sale)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                Facture
              </button>

              <template v-if="sale.status === 'COMPLETED'">
                <button class="icon-action-btn" title="Modifier les lignes de vente" @click="openEditModal(sale)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Modifier
                </button>

                <button class="icon-action-btn btn-danger-action" title="Annuler / Invalider la vente" @click="promptCancelSale(sale)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  Annuler
                </button>
              </template>
            </div>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Pagination -->
    <AppPagination
      v-model:page="page"
      v-model:limit="limit"
      :total="total"
      :total-pages="totalPages"
      :loading="loading"
      @change="onPageChange"
    />

    <!-- Invoice Viewer Modal -->
    <AppModal
      v-model="showInvoiceModal"
      :title="`Facture Fiscale : ${selectedSale?.invoiceNumber || ''}`"
      max-width="680px"
    >
      <div v-if="selectedSale" class="invoice-container">
        <!-- Invoice Header -->
        <div class="inv-header">
          <div class="inv-brand">
            <h2>DISTRI-TOOLS DZ</h2>
            <p class="text-caption">Distribution d'Outillage Industriel & Équipements SARL</p>
            <p class="text-caption">Hubs d'Alger / Oran / Constantine</p>
          </div>
          <div class="inv-meta">
            <h3 class="font-mono">{{ selectedSale.invoiceNumber }}</h3>
            <p class="text-caption">Date : {{ formatDateTime(selectedSale.saleDate || selectedSale.createdAt) }}</p>
            <p class="text-caption">Entrepôt : {{ selectedSale.warehouseName }} ({{ selectedSale.warehouseCode }})</p>
            <AppBadge :variant="selectedSale.status === 'COMPLETED' ? 'success' : 'danger'" size="sm">
              {{ formatSaleStatus(selectedSale.status) }}
            </AppBadge>
          </div>
        </div>

        <div class="inv-divider" />

        <!-- Customer Details -->
        <div class="inv-customer">
          <div>
            <span class="text-caption text-muted">Facturé à :</span>
            <h4>{{ selectedSale.customerName || 'Client Comptoir (Passage)' }}</h4>
            <p v-if="selectedSale.customerPhone" class="text-caption text-muted">
              Tél : {{ selectedSale.customerPhone }}
            </p>
          </div>
          <div>
            <span class="text-caption text-muted">Émise par :</span>
            <h4>{{ selectedSale.createdByName || 'Système' }}</h4>
          </div>
        </div>

        <!-- Items Table -->
        <table class="inv-table">
          <thead>
            <tr>
              <th>Réf</th>
              <th>Désignation</th>
              <th>Prix Unitaire</th>
              <th>Qté</th>
              <th>Total (DA)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in selectedSale.items" :key="item.id">
              <td class="font-mono">{{ item.productReference }}</td>
              <td>{{ item.productName }} ({{ item.productBrand }})</td>
              <td class="font-mono">{{ formatCurrency(item.unitPrice) }}</td>
              <td class="font-mono">{{ formatNumber(item.quantity) }}</td>
              <td class="font-mono font-bold">{{ formatCurrency(item.subtotal) }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Totals -->
        <div class="inv-totals">
          <div class="total-row">
            <span>Montant Total à Payer :</span>
            <strong class="font-mono font-bold text-h2">{{ formatCurrency(selectedSale.totalAmount) }}</strong>
          </div>
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="showInvoiceModal = false">Fermer</AppButton>
        <AppButton variant="primary" onclick="window.print()">Imprimer la Facture</AppButton>
      </template>
    </AppModal>

    <!-- Edit Sale Modal -->
    <AppModal
      v-model="showEditModal"
      :title="`Modifier la Vente : ${editingSale?.invoiceNumber || ''}`"
      max-width="640px"
    >
      <div v-if="editError" class="modal-error mb-3">
        {{ editError }}
      </div>

      <div class="modal-form">
        <div class="form-row">
          <div class="app-input-group">
            <label class="input-label">Date de Vente</label>
            <input
              v-model="editForm.saleDate"
              type="datetime-local"
              step="1"
              class="app-input"
              required
            />
          </div>
          <AppInput
            v-model="editForm.customerName"
            label="Nom du Client"
            placeholder="Client SARL"
          />
        </div>
        <div class="form-row">
          <AppInput
            v-model="editForm.customerPhone"
            label="Téléphone du Client"
            placeholder="+213 550 00 00 00"
          />
        </div>

        <div class="items-editor">
          <div class="editor-header">
            <h4>Lignes de Facture</h4>
            <button type="button" class="icon-action-btn" @click="addEditItem">
              + Ajouter un Article
            </button>
          </div>

          <div v-for="(item, idx) in editForm.items" :key="idx" class="item-row">
            <select v-model="item.productId" class="app-select item-product-select" required>
              <option v-for="p in products" :key="p.id" :value="p.id">
                [{{ p.reference }}] {{ p.name }} — {{ formatCurrency(p.salePrice) }}
              </option>
            </select>
            <input
              v-model.number="item.quantity"
              type="number"
              min="1"
              class="app-input item-qty-input"
              required
            />
            <button
              type="button"
              class="icon-action-btn btn-danger-action"
              :disabled="editForm.items.length <= 1"
              @click="removeEditItem(idx)"
            >
              &times;
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="showEditModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveEdit">
          Enregistrer & Réconcilier le Stock
        </AppButton>
      </template>
    </AppModal>

    <!-- Cancel Dialog -->
    <ConfirmDialog
      v-model="showCancelDialog"
      title="Annuler & Invalider la Facture de Vente"
      :message="`Êtes-vous sûr de vouloir annuler la facture ${cancellingSale?.invoiceNumber} ? Cette action est irréversible et réintégrera automatiquement toutes les quantités d'articles dans le stock physique.`"
      confirm-text="Annuler la Vente & Réintégrer le Stock"
      cancel-text="Conserver la Vente"
      variant="danger"
      :loading="cancelling"
      @confirm="handleConfirmCancel"
    />
  </div>
</template>

<style scoped>
.sales-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  max-width: 480px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

.search-input {
  width: 100%;
  height: 38px;
  padding: 8px 12px 8px 36px;
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

.action-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
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

.btn-danger-action:hover {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border-color: var(--color-danger-border);
}

/* Invoice Modal */
.invoice-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.inv-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.inv-divider {
  height: 1px;
  background-color: var(--color-border);
}

.inv-customer {
  display: flex;
  justify-content: space-between;
}

.inv-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

.inv-table th {
  background-color: var(--color-surface);
  padding: 8px 12px;
  font-size: 11px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.inv-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: 13px;
}

.inv-totals {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.total-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* Edit modal */
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.items-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-product-select {
  flex: 1;
}

.item-qty-input {
  width: 80px;
}

.app-select {
  height: 38px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  font-size: 13px;
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
