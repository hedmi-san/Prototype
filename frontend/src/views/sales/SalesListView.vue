<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { saleService } from '../../services/operations.service';
import { productService } from '../../services/catalog.service';
import { employeeService } from '../../services/admin-reports.service';
import type { Sale, Product, Employee } from '../../types';
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
import InvoiceDocument from '../../components/sales/InvoiceDocument.vue';

const authStore = useAuthStore();
const sales = ref<Sale[]>([]);
const products = ref<Product[]>([]);
const employees = ref<Employee[]>([]);
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
  employeeId: null as number | null,
  customerName: '',
  customerPhone: '',
  saleDate: '',
  items: [] as { productId: number; quantity: number; unitPrice: number }[],
});
const saving = ref(false);
const editError = ref('');

// Cancel Sale Confirm
const showCancelDialog = ref(false);
const cancellingSale = ref<Sale | null>(null);
const cancelling = ref(false);
const exporting = ref(false);

onMounted(async () => {
  await Promise.all([fetchProducts(), fetchEmployees()]);
});

// Watch warehouse changes to refresh sales
watch(() => authStore.activeWarehouseId, async (newWhId) => {
  page.value = 1;
  await Promise.all([fetchSales(), fetchEmployees(newWhId || undefined)]);
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

async function handleExportCsv() {
  exporting.value = true;
  try {
    await saleService.exportSalesCsv({
      warehouseId: authStore.activeWarehouseId || undefined,
      startDate: activeRange.value?.startDate,
      endDate: activeRange.value?.endDate,
      search: searchQuery.value.trim() || undefined,
    });
  } catch (err) {
    console.error('Failed to export sales CSV', err);
  } finally {
    exporting.value = false;
  }
}

async function fetchProducts() {
  try {
    products.value = await productService.getProducts();
  } catch (err) {
    console.error('Failed to load products', err);
  }
}

async function fetchEmployees(warehouseId?: number, preserveEmployeeId?: number | null) {
  try {
    const activeEmps = await employeeService.getEmployees({
      warehouseId: warehouseId || authStore.activeWarehouseId || undefined,
      status: 'ACTIVE',
    });

    if (preserveEmployeeId && !activeEmps.some((e) => e.id === preserveEmployeeId)) {
      try {
        const currentEmp = await employeeService.getEmployee(preserveEmployeeId);
        if (currentEmp) {
          employees.value = [currentEmp, ...activeEmps];
          return;
        }
      } catch {
        // ignore if not found
      }
    }
    employees.value = activeEmps;
  } catch (err) {
    console.error('Failed to load employees', err);
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

async function openEditModal(sale: Sale) {
  editingSale.value = sale;
  await fetchEmployees(sale.warehouseId, sale.employeeId);
  editForm.value = {
    employeeId: sale.employeeId || null,
    customerName: sale.customerName || '',
    customerPhone: sale.customerPhone || '',
    saleDate: formatToDatetimeLocal(sale.saleDate || sale.createdAt),
    items: sale.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  };
  editError.value = '';
  showEditModal.value = true;
}

function onEditProductSelect(item: { productId: number; quantity: number; unitPrice: number }) {
  const prod = products.value.find((p) => p.id === item.productId);
  if (prod) {
    item.unitPrice = prod.salePrice;
  }
}

function addEditItem() {
  if (products.value.length > 0) {
    const defaultProd = products.value[0];
    editForm.value.items.push({
      productId: defaultProd.id,
      quantity: 1,
      unitPrice: defaultProd.salePrice,
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

  for (const item of editForm.value.items) {
    if (item.unitPrice === undefined || item.unitPrice === null || Number(item.unitPrice) < 0 || isNaN(Number(item.unitPrice))) {
      editError.value = 'Veuillez saisir un prix unitaire valide (≥ 0 DA) pour chaque ligne.';
      return;
    }
  }

  saving.value = true;
  editError.value = '';
  try {
    await saleService.updateSale(editingSale.value.id, {
      employeeId: editForm.value.employeeId,
      customerName: editForm.value.customerName.trim() || undefined,
      customerPhone: editForm.value.customerPhone.trim() || undefined,
      saleDate: editForm.value.saleDate ? editForm.value.saleDate.replace('T', ' ') : undefined,
      items: editForm.value.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
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
        <AppButton variant="secondary" :loading="exporting" @click="handleExportCsv">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exporter CSV
        </AppButton>
        <router-link v-if="!authStore.isReadOnly" to="/sales/new">
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
          placeholder="Rechercher par n° facture, nom client, agent de suivi, entrepôt..."
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
        <th>Agent de suivi</th>
        <th>Montant Total</th>
        <th>Date de Vente</th>
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
          <td>
            <span v-if="sale.employeeName" class="agent-pill">{{ sale.employeeName }}</span>
            <span v-else class="text-caption text-muted">Non spécifié</span>
          </td>
          <td class="font-mono font-bold">{{ formatCurrency(sale.totalAmount) }}</td>
          <td class="font-mono text-caption">{{ formatDateTime(sale.saleDate || sale.createdAt) }}</td>
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

              <template v-if="sale.status === 'COMPLETED' && !authStore.isReadOnly">
                <button class="icon-action-btn" title="Modifier les lignes de vente" @click="openEditModal(sale)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
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
      :title="`Facture / Bon de Caisse : ${selectedSale?.invoiceNumber || ''}`"
      max-width="880px"
    >
      <div v-if="selectedSale" class="invoice-preview-wrapper">
        <InvoiceDocument :sale="selectedSale" />
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="showInvoiceModal = false">Fermer</AppButton>
        <AppButton variant="primary" onclick="window.print()">Imprimer le Bon / Facture (A4)</AppButton>
      </template>
    </AppModal>

    <!-- Edit Sale Modal -->
    <AppModal
      v-model="showEditModal"
      :title="`Modifier la Vente : ${editingSale?.invoiceNumber || ''}`"
      max-width="680px"
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
          <div class="app-input-group">
            <label class="input-label">Agent de suivi (Conseiller)</label>
            <select v-model.number="editForm.employeeId" class="app-select">
              <option :value="null">-- Aucun / Non spécifié --</option>
              <option v-for="emp in employees" :key="emp.id" :value="emp.id">
                {{ emp.fullName }} ({{ emp.position }}) {{ emp.status && emp.status !== 'ACTIVE' ? `[${emp.status === 'ON_LEAVE' ? 'En congé' : emp.status === 'SUSPENDED' ? 'Suspendu' : 'Inactif'}]` : '' }}
              </option>
            </select>
          </div>
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
            <select
              v-model="item.productId"
              class="app-select item-product-select"
              required
              @change="() => onEditProductSelect(item)"
            >
              <option v-for="p in products" :key="p.id" :value="p.id">
                [{{ p.reference }}] {{ p.name }}
              </option>
            </select>
            <div class="edit-price-wrapper">
              <input
                v-model.number="item.unitPrice"
                type="number"
                min="0"
                step="any"
                class="app-input item-price-input font-mono"
                placeholder="Prix"
                title="Prix Unitaire (DA)"
                required
              />
              <span class="unit-tag">DA</span>
            </div>
            <input
              v-model.number="item.quantity"
              type="number"
              min="1"
              class="app-input item-qty-input"
              title="Quantité"
              required
            />
            <button
              type="button"
              class="icon-action-btn btn-danger-action"
              :disabled="editForm.items.length <= 1"
              title="Supprimer la ligne"
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
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
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

.user-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background-color: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.agent-pill {
  display: inline-block;
  padding: 2px 8px;
  font-size: 12px;
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

/* Invoice Modal Preview */
.invoice-preview-wrapper {
  background: #1e293b;
  padding: 20px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  max-height: 75vh;
  display: flex;
  justify-content: center;
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

.edit-price-wrapper {
  position: relative;
  width: 130px;
  display: flex;
  align-items: center;
}

.item-price-input {
  width: 100%;
  height: 38px;
  padding: 8px 28px 8px 8px;
  text-align: right;
}

.unit-tag {
  position: absolute;
  right: 8px;
  font-size: 11px;
  color: var(--color-text-muted);
  pointer-events: none;
  font-weight: 500;
}

.item-qty-input {
  width: 70px;
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
