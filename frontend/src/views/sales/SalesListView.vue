<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { saleService } from '../../services/operations.service';
import { productService } from '../../services/catalog.service';
import { employeeService } from '../../services/admin-reports.service';
<<<<<<< Updated upstream
import type { Sale, Product, Employee } from '../../types';
=======
import type { Sale, Product, Employee, SaleFulfillmentLine, Facture, SaleWithoutFacture, FactureSituation, ClientRefund, CounterCreditNote } from '../../types';
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
import PickupSlipDocument from '../../components/sales/PickupSlipDocument.vue';
import FactureDocument from '../../components/sales/FactureDocument.vue';
import RefundDocument from '../../components/clients/RefundDocument.vue';
import CreditNoteReceipt from '../../components/clients/CreditNoteReceipt.vue';
>>>>>>> Stashed changes

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

// Cancel Sale State & Modals
const showCancelDialog = ref(false);
const cancellingSale = ref<Sale | null>(null);
const cancelling = ref(false);
const exporting = ref(false);
const cancelNotes = ref('');
const cancelError = ref('');
const walkinRefundChoice = ref<'immediate' | 'deferred'>('immediate');
const walkinRecipientName = ref('');
const walkinRecipientPhone = ref('');
const walkinRecipientIdCard = ref('');

const showRefundDocModal = ref(false);
const activeRefundDoc = ref<ClientRefund | null>(null);

const showCreditNoteDocModal = ref(false);
const activeCreditNoteDoc = ref<CounterCreditNote | null>(null);

const isWalkinCancellingSale = computed(() => {
  if (!cancellingSale.value) return false;
  return Boolean(
    cancellingSale.value.clientIsDefault ||
    cancellingSale.value.clientCode === 'CLT-COMPTOIR' ||
    (!cancellingSale.value.clientId && cancellingSale.value.customerName?.toLowerCase().includes('passager'))
  );
});

const cancellingPaidAmount = computed(() => Number(cancellingSale.value?.paidAmount || 0));

const canConfirmCancel = computed(() => {
  if (cancelling.value) return false;
  if (isWalkinCancellingSale.value && cancellingPaidAmount.value > 0) {
    if (walkinRefundChoice.value === 'immediate') {
      return walkinRecipientName.value.trim().length > 0 && walkinRecipientPhone.value.trim().length > 0;
    }
    return true;
  }
  return true;
});

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
    products.value = await productService.getAllProducts();
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

<<<<<<< Updated upstream
function promptCancelSale(sale: Sale) {
  cancellingSale.value = sale;
=======
async function promptCancelSale(sale: Sale) {
  cancelError.value = '';
  cancelNotes.value = '';
  walkinRefundChoice.value = 'immediate';
  walkinRecipientName.value = sale.customerName && sale.customerName !== 'Client Passager' ? sale.customerName : '';
  walkinRecipientPhone.value = sale.customerPhone && sale.customerPhone !== 'N/A' ? sale.customerPhone : '';
  walkinRecipientIdCard.value = '';
  try {
    const full = await saleService.getSaleById(sale.id);
    cancellingSale.value = full;
    if (full.customerName && full.customerName !== 'Client Passager') {
      walkinRecipientName.value = full.customerName;
    }
    if (full.customerPhone && full.customerPhone !== 'N/A') {
      walkinRecipientPhone.value = full.customerPhone;
    }
  } catch {
    cancellingSale.value = sale;
  }
>>>>>>> Stashed changes
  showCancelDialog.value = true;
}

async function handleConfirmCancel() {
  if (!cancellingSale.value) return;
  cancelling.value = true;
  cancelError.value = '';
  try {
    const payload: any = {
      notes: cancelNotes.value.trim() || undefined,
    };
    if (isWalkinCancellingSale.value && cancellingPaidAmount.value > 0) {
      if (walkinRefundChoice.value === 'immediate') {
        payload.isWalkinImmediateRefund = true;
        payload.recipientName = walkinRecipientName.value.trim();
        payload.recipientPhone = walkinRecipientPhone.value.trim();
        payload.recipientIdCard = walkinRecipientIdCard.value.trim() || undefined;
      } else {
        payload.isWalkinImmediateRefund = false;
      }
    }

    const result = await saleService.cancelSale(cancellingSale.value.id, payload);
    showCancelDialog.value = false;
    await fetchSales();

    if (result?.refund) {
      activeRefundDoc.value = result.refund;
      showRefundDocModal.value = true;
    } else if (result?.creditNote) {
      activeCreditNoteDoc.value = result.creditNote;
      showCreditNoteDocModal.value = true;
    }
  } catch (err: any) {
    console.error('Failed to cancel sale', err);
    cancelError.value = err.response?.data?.message || err.message || 'Échec de l\'annulation de la vente';
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

<<<<<<< Updated upstream
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
=======
    <!-- Pickup Fulfillment Modal -->
    <AppModal
      v-model="showFulfillModal"
      :title="`Validation du Retrait : ${selectedFulfillLine?.pickupVoucherCode || selectedFulfillLine?.voucherCode || ''}`"
      max-width="520px"
    >
      <div v-if="fulfillError" class="modal-error mb-3">
        {{ fulfillError }}
      </div>

      <div v-if="selectedFulfillLine" class="fulfill-modal-body">
        <div class="fulfill-info-box">
          <div class="info-row">
            <span class="info-label">Client :</span>
            <span class="info-val font-bold">{{ selectedFulfillLine.customerName || 'Client Comptoir' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Facture Vente :</span>
            <span class="info-val font-mono">{{ selectedFulfillLine.invoiceNumber || `#${selectedFulfillLine.saleId}` }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Dépôt Vendeur :</span>
            <span class="info-val">{{ selectedFulfillLine.originWarehouseName || 'Dépôt d\'origine' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Article & Quantité :</span>
            <span class="info-val font-bold">{{ selectedFulfillLine.productName }} &times; {{ selectedFulfillLine.quantity }}</span>
          </div>
        </div>

        <div v-if="selectedFulfillLine.paymentStatus === 'COLLECT_ON_PICKUP'" class="collect-payment-alert">
          <div class="alert-title">⚠️ Règlement à encaisser impérativement</div>
          <p class="alert-desc">
            Cette marchandise n'a pas été payée à l'origine. Vous devez encaisser le montant dû auprès du client avant de valider la sortie de stock.
          </p>
          <div class="app-input-group mt-2">
            <label class="input-label">Mode d'encaissement</label>
            <select v-model="fulfillPaymentMethod" class="app-select">
              <option value="CASH">Espèces (Caisse)</option>
              <option value="CHECK">Chèque</option>
              <option value="BANK_TRANSFER">Virement Bancaire</option>
            </select>
          </div>
        </div>

        <div v-else class="prepaid-alert">
          ✓ Cette marchandise a déjà été réglée lors de la vente à l'entrepôt d'origine. Aucun encaissement n'est requis.
        </div>

        <label class="confirm-checkbox">
          <input type="checkbox" v-model="fulfillConfirmed" />
          <span>Je confirme que le client a présenté le bon valide et que la marchandise a été remise physiquement.</span>
        </label>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="showFulfillModal = false">Annuler</AppButton>
        <AppButton
          variant="primary"
          :loading="fulfilling"
          :disabled="!fulfillConfirmed"
          @click="handleConfirmFulfill"
        >
          Confirmer la Remise du Matériel
        </AppButton>
      </template>
    </AppModal>

    <!-- Pickup Slip Document Modal -->
    <AppModal
      v-model="showSlipModal"
      :title="`Bon de Retrait : ${selectedSlipLine?.pickupVoucherCode || selectedSlipLine?.voucherCode || ''}`"
      max-width="840px"
      @close="handleCloseSlipModal"
    >
      <div v-if="selectedSlipLine" class="slip-preview-container">
        <PickupSlipDocument :line="selectedSlipLine" />
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="handleCloseSlipModal">Fermer</AppButton>
        <AppButton variant="primary" onclick="window.print()">Imprimer le Bon</AppButton>
      </template>
    </AppModal>

    <!-- Reassign Warehouse Modal -->
    <AppModal
      v-model="showReassignModal"
      :title="`Réaffecter l'Entrepôt de Retrait : ${selectedReassignLine?.pickupVoucherCode || selectedReassignLine?.voucherCode || ''}`"
      max-width="500px"
    >
      <div v-if="reassignError" class="modal-error mb-3">
        {{ reassignError }}
      </div>

      <div v-if="selectedReassignLine" class="modal-form">
        <p class="text-muted text-caption mb-2">
          Transférez cette ligne de retrait vers un autre entrepôt si le client préfère retirer ailleurs ou si l'entrepôt actuel a un problème de stock.
        </p>

        <div class="app-input-group">
          <label class="input-label">Nouvel Entrepôt de Retrait</label>
          <select v-model.number="reassignWarehouseId" class="app-select" required>
            <option
              v-for="wh in warehouseStore.warehouses"
              :key="wh.id"
              :value="wh.id"
            >
              {{ wh.name }}
            </option>
          </select>
        </div>

        <div class="form-row">
          <div class="app-input-group">
            <label class="input-label">Quantité</label>
            <input
              v-model.number="reassignQuantity"
              type="number"
              min="1"
              class="app-input"
              required
            />
          </div>

          <div class="app-input-group">
            <label class="input-label">Statut Règlement</label>
            <select v-model="reassignPaymentStatus" class="app-select">
              <option value="PAID">Déjà Réglé (PAID)</option>
              <option value="COLLECT_ON_PICKUP">À Encaisser au Retrait</option>
            </select>
          </div>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="showReassignModal = false">Annuler</AppButton>
        <AppButton
          variant="primary"
          :loading="reassigning"
          @click="handleSaveReassign"
        >
          Enregistrer la Réaffectation
        </AppButton>
      </template>
    </AppModal>

    <!-- Cancel Line Dialog -->
    <ConfirmDialog
      v-model="showCancelLineDialog"
      title="Annuler la Ligne de Retrait"
      :message="`Êtes-vous sûr de vouloir annuler le bon de retrait ${cancellingLine?.pickupVoucherCode || cancellingLine?.voucherCode} ? La réservation de stock sur le dépôt de destination sera immédiatement libérée.`"
      confirm-text="Annuler le Bon & Libérer le Stock"
      cancel-text="Conserver"
      variant="danger"
      :loading="cancellingLineLoading"
      @confirm="handleConfirmCancelLine"
    />

    <!-- Cancel Sale Modal (Comprehensive: Walk-in refund choice & standard cancellation) -->
    <AppModal
      v-model="showCancelDialog"
      title="Annuler & Invalider la Facture de Vente"
      max-width="620px"
    >
      <div v-if="cancellingSale" class="cancel-sale-modal-content">
        <!-- Error alert -->
        <div v-if="cancelError" class="modal-error mb-3">
          {{ cancelError }}
        </div>

        <!-- Warning info banner -->
        <div class="cancel-warning-banner">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div class="warning-text">
            <strong>{{ cancellingSale.invoiceNumber }}</strong>
            <p>{{ cancelDialogMessage }}</p>
          </div>
        </div>

        <!-- Sale Financial Snapshot -->
        <div class="cancel-summary-box">
          <div class="summary-line">
            <span>Client :</span>
            <strong>{{ cancellingSale.customerName || cancellingSale.clientName || 'Client Passager' }}</strong>
          </div>
          <div class="summary-line">
            <span>Montant Total Vente :</span>
            <span class="font-mono">{{ formatCurrency(cancellingSale.totalAmount) }}</span>
          </div>
          <div class="summary-line highlight">
            <span>Montant Déjà Encaissé :</span>
            <span class="font-mono font-bold text-success">{{ formatCurrency(cancellingPaidAmount) }}</span>
          </div>
        </div>

        <!-- Walk-in Client Refund Choice Section -->
        <div v-if="isWalkinCancellingSale && cancellingPaidAmount > 0" class="walkin-refund-section">
          <div class="refund-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>Règlement du Remboursement Comptoir (Client Passager)</span>
          </div>
          <p class="section-desc">
            Le client passager a réglé {{ formatCurrency(cancellingPaidAmount) }} en espèces. Choisissez comment traiter cette restitution de fonds :
          </p>

          <div class="refund-choice-cards">
            <!-- Option 1: Immediate Cash Refund -->
            <label class="choice-card" :class="{ selected: walkinRefundChoice === 'immediate' }">
              <div class="choice-radio">
                <input type="radio" v-model="walkinRefundChoice" value="immediate" />
              </div>
              <div class="choice-body">
                <div class="choice-head">
                  <span class="choice-title">Remboursement Immédiat en Espèces</span>
                  <span class="choice-badge cash">Caisse Immédiate</span>
                </div>
                <p class="choice-text">
                  L'argent est immédiatement décaissé de la caisse et remis en main propre au client. Génère un <strong>Bon de Décharge</strong> avec double signature.
                </p>
              </div>
            </label>

            <!-- Option 2: Deferred Credit Note -->
            <label class="choice-card" :class="{ selected: walkinRefundChoice === 'deferred' }">
              <div class="choice-radio">
                <input type="radio" v-model="walkinRefundChoice" value="deferred" />
              </div>
              <div class="choice-body">
                <div class="choice-head">
                  <span class="choice-title">Création d'un Avoir Différé (90 jours)</span>
                  <span class="choice-badge note">Titre d'Avoir</span>
                </div>
                <p class="choice-text">
                  Le client n'est pas remboursé immédiatement. Un <strong>Reçu d'Avoir Comptoir</strong> officiel lui est imprimé, valable 90 jours pour décaissement ultérieur au guichet.
                </p>
              </div>
            </label>
          </div>

          <!-- Immediate Refund Mandatory Beneficiary Form -->
          <div v-if="walkinRefundChoice === 'immediate'" class="beneficiary-form-box">
            <div class="form-box-title">
              <span>Identification du Bénéficiaire (Obligatoire pour Bon de Décharge)</span>
            </div>
            <div class="form-row">
              <div class="app-input-group">
                <label class="input-label">Nom et Prénom du Bénéficiaire *</label>
                <input
                  v-model="walkinRecipientName"
                  type="text"
                  class="app-input"
                  placeholder="Ex: Mohamed Benali"
                  required
                />
              </div>
              <div class="app-input-group">
                <label class="input-label">N° Téléphone *</label>
                <input
                  v-model="walkinRecipientPhone"
                  type="tel"
                  class="app-input"
                  placeholder="Ex: 0550 12 34 56"
                  required
                />
              </div>
            </div>
            <div class="app-input-group mt-2">
              <label class="input-label">N° Pièce d'Identité / CNI (Optionnel)</label>
              <input
                v-model="walkinRecipientIdCard"
                type="text"
                class="app-input"
                placeholder="Ex: CNI N° 10928374..."
              />
            </div>
          </div>
        </div>

        <!-- Optional cancellation notes -->
        <div class="app-input-group mt-3">
          <label class="input-label">Motif de l'annulation (Optionnel)</label>
          <textarea
            v-model="cancelNotes"
            rows="2"
            class="app-input"
            placeholder="Ex: Annulation à la demande du client, erreur de référence..."
          ></textarea>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" :disabled="cancelling" @click="showCancelDialog = false">
          Conserver la Vente
        </AppButton>
        <AppButton
          variant="danger"
          :loading="cancelling"
          :disabled="!canConfirmCancel"
          @click="handleConfirmCancel"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span v-if="isWalkinCancellingSale && cancellingPaidAmount > 0 && walkinRefundChoice === 'immediate'">
            Annuler & Décaisser Espèces
          </span>
          <span v-else-if="isWalkinCancellingSale && cancellingPaidAmount > 0">
            Annuler & Émettre l'Avoir
          </span>
          <span v-else>
            Confirmer l'Annulation de la Vente
          </span>
        </AppButton>
      </template>
    </AppModal>

    <!-- Immediate Refund Document (Bon de Décharge) -->
    <RefundDocument
      v-model="showRefundDocModal"
      :refund="activeRefundDoc"
    />

    <!-- Deferred Credit Note Receipt (Reçu d'Avoir Comptoir) -->
    <CreditNoteReceipt
      v-model="showCreditNoteDocModal"
      :credit-note="activeCreditNoteDoc"
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======

.mt-2 {
  margin-top: 8px;
}

/* Tabs Header */
.tabs-header {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 2px;
}

.main-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.main-tab-btn:hover {
  color: var(--color-text-primary);
  background-color: var(--color-bg-subtle);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.main-tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

.tab-badge {
  background-color: var(--color-primary);
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 9999px;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Pending Pickups Table Badges & Tags */
.voucher-tag {
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-primary);
}

.origin-warehouse-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500; 
}

.qty-pill {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  background: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
  color: var(--color-primary);
  font-weight: 700;
  font-size: 11px;
  border-radius: 4px;
}

.badge-payment.collect {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.ttl-chip {
  display: inline-block;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
}

.ttl-chip.ok {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.ttl-chip.warning {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.ttl-chip.danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.btn-fulfill-action {
  background-color: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.25);
}

.btn-fulfill-action:hover {
  background-color: #10b981;
  color: #ffffff;
}

/* Invoice Modal Breakdown */
.invoice-modal-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fulfillment-breakdown-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px;
}

.breakdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-subtle, var(--color-border));
}

.breakdown-header h4 {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary);
}

.breakdown-count {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.fulfillment-lines-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fulfillment-line-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  gap: 12px;
}

.line-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.line-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.voucher-badge {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.item-name {
  font-weight: 600;
  font-size: 13px;
}

.status-chip {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.status-chip.fulfilled {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-chip.pending_pickup {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.status-chip.cancelled {
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
}

.line-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.dot {
  color: var(--color-text-muted);
}

.ttl-text.ok {
  color: #10b981;
}

.ttl-text.warning {
  color: #f59e0b;
}

.ttl-text.danger {
  color: #ef4444;
}

.line-actions {
  display: flex;
  gap: 6px;
}

/* Fulfill Modal Elements */
.fulfill-modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.fulfill-info-box {
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.info-label {
  color: var(--color-text-secondary);
}

.collect-payment-alert {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-sm);
  padding: 12px;
}

.collect-payment-alert .alert-title {
  font-weight: 600;
  color: #d97706;
  margin-bottom: 4px;
  font-size: 13px;
}

.collect-payment-alert .alert-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
  margin: 0;
}

.prepaid-alert {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: 12px;
  color: #10b981;
  font-weight: 500;
}

.confirm-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-primary);
  cursor: pointer;
  margin-top: 4px;
}

.confirm-checkbox input {
  margin-top: 2px;
}

.slip-preview-container {
  display: flex;
  justify-content: center;
  padding: 10px 0;
}

.selected-sale-info-box {
  background: var(--color-bg-subtle, #f8fafc);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-note {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: rgba(59, 130, 246, 0.08);
  border-left: 3px solid #3b82f6;
  padding: 6px 10px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  margin-top: 4px;
}

.section-subtitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.app-textarea {
  width: 100%;
  padding: 8px 12px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: inherit;
  color: var(--color-text-primary);
  outline: none;
  resize: vertical;
  transition: all var(--transition-fast);
}

.app-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.btn-create-facture {
  color: var(--color-primary, #3b82f6);
  border-color: rgba(59, 130, 246, 0.35);
  background-color: rgba(59, 130, 246, 0.05);
}

.btn-create-facture:hover {
  background-color: rgba(59, 130, 246, 0.12);
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary-dark, #2563eb);
}

.btn-facture-badge {
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.35);
  background-color: rgba(16, 185, 129, 0.06);
}

.btn-facture-badge:hover {
  background-color: rgba(16, 185, 129, 0.14);
  border-color: #10b981;
}

/* Smart Sale Selection Card */
.selected-sale-card {
  background: var(--color-bg-subtle, #f8fafc);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 6px);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.selected-sale-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.selected-sale-bl-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bl-tag {
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border);
  padding: 2px 8px;
  border-radius: var(--radius-sm, 4px);
  font-size: 13px;
  color: var(--color-text-primary);
}

.btn-change-sale {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 4px);
  padding: 3px 8px;
  font-size: 11px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-change-sale:hover {
  background: var(--color-surface-hover);
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.selected-sale-card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.client-code-pill {
  font-size: 11px;
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 4px;
  color: var(--color-text-muted);
}

.sale-amount-pill {
  color: var(--color-primary);
  font-size: 13px;
}

/* Sale Async Combobox */
.sale-combobox-wrapper {
  position: relative;
  width: 100%;
}

.combobox-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.combobox-search-icon {
  position: absolute;
  left: 10px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.combobox-search-input {
  width: 100%;
  height: 38px;
  padding: 8px 68px 8px 34px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  font-size: 13px;
  color: var(--color-text-primary);
  outline: none;
  transition: all var(--transition-fast);
}

.combobox-search-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.combobox-input-actions {
  position: absolute;
  right: 6px;
  display: flex;
  align-items: center;
  gap: 2px;
}

.combobox-action-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm, 4px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  line-height: 1;
  transition: all var(--transition-fast);
}

.combobox-action-btn:hover {
  background-color: var(--color-surface-hover, #f1f5f9);
  color: var(--color-text-primary);
}

.chevron-icon {
  transition: transform 0.2s ease;
}

.chevron-icon.is-open {
  transform: rotate(180deg);
}

.btn-close-dropdown {
  background: transparent;
  border: none;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 1px 6px;
  border-radius: 3px;
  transition: all var(--transition-fast);
}

.btn-close-dropdown:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--color-text-primary);
}

.combobox-loading-spinner {
  width: 14px;
  height: 14px;
  margin-right: 4px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.sale-combobox-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 6px);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  z-index: 9999;
  max-height: 280px;
  overflow-y: auto;
}

.combobox-section-title {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
  background: var(--color-bg-subtle, #f8fafc);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
}

.sale-suggestions-list {
  display: flex;
  flex-direction: column;
}

.sale-suggestion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.04));
  transition: background-color var(--transition-fast);
}

.sale-suggestion-item:last-child {
  border-bottom: none;
}

.sale-suggestion-item:hover {
  background-color: var(--color-surface-hover, #f1f5f9);
}

.suggestion-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.suggestion-bl {
  font-size: 13px;
  color: var(--color-text-primary);
}

.suggestion-client {
  font-size: 12px;
}

.client-mini-code {
  font-size: 10px;
  color: var(--color-text-muted);
}

.suggestion-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.suggestion-amount {
  font-size: 13px;
  color: var(--color-primary);
}

.combobox-empty-message {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-muted);
}

/* Cancel Sale Modal Styles */
.cancel-sale-modal-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cancel-warning-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #991b1b;
}

.cancel-warning-banner svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: #dc2626;
}

.warning-text strong {
  display: block;
  font-size: 0.95rem;
  margin-bottom: 4px;
}

.warning-text p {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: #7f1d1d;
}

.cancel-summary-box {
  background-color: var(--color-bg-subtle, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: var(--color-text-muted, #64748b);
}

.summary-line.highlight {
  border-top: 1px dashed var(--color-border, #cbd5e1);
  padding-top: 8px;
  margin-top: 4px;
  font-size: 0.95rem;
}

.walkin-refund-section {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.refund-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 700;
  color: #166534;
}

.section-desc {
  margin: 0;
  font-size: 0.8rem;
  color: #15803d;
}

.refund-choice-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.choice-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.choice-card:hover {
  border-color: #94a3b8;
}

.choice-card.selected {
  border-color: #16a34a;
  background-color: #f0fdf4;
}

.choice-radio {
  margin-top: 2px;
}

.choice-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.choice-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.choice-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #0f172a;
}

.choice-badge {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
}

.choice-badge.cash {
  background: #dcfce7;
  color: #15803d;
}

.choice-badge.note {
  background: #fef3c7;
  color: #b45309;
}

.choice-text {
  margin: 0;
  font-size: 0.8rem;
  color: #475569;
  line-height: 1.35;
}

.beneficiary-form-box {
  background: white;
  border: 1px solid #cbd5e1;
  border-left: 3px solid #16a34a;
  border-radius: 6px;
  padding: 12px 14px;
  margin-top: 4px;
}

.form-box-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 10px;
}
>>>>>>> Stashed changes
</style>
