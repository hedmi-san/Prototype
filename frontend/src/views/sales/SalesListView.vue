<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { saleService, factureService } from '../../services/operations.service';
import { productService } from '../../services/catalog.service';
import { employeeService } from '../../services/admin-reports.service';
import type { Sale, Product, Employee, SaleFulfillmentLine, Facture, SaleWithoutFacture, FactureSituation } from '../../types';
import type { ComputedPeriodRange } from '../../utils/periodNavigator';
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatSaleStatus } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';
import AppPeriodNavigator from '../../components/common/AppPeriodNavigator.vue';
import AppPagination from '../../components/common/AppPagination.vue';
import ConfirmDialog from '../../components/common/ConfirmDialog.vue';
import InvoiceDocument from '../../components/sales/InvoiceDocument.vue';
import PickupSlipDocument from '../../components/sales/PickupSlipDocument.vue';
import FactureDocument from '../../components/sales/FactureDocument.vue';

const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();
const sales = ref<Sale[]>([]);
const products = ref<Product[]>([]);
const employees = ref<Employee[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const paymentStatusFilter = ref<'all' | 'PAID' | 'PARTIALLY_PAID' | 'UNPAID'>('all');

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

interface EditSaleLineItem {
  _uid: string;
  productId: number;
  quantity: number;
  unitPrice: number;
}

let editUidCounter = 0;
function createEditLineItem(initial?: Partial<EditSaleLineItem>): EditSaleLineItem {
  return {
    _uid: `edit_line_${++editUidCounter}_${Date.now()}`,
    productId: 0,
    quantity: 1,
    unitPrice: 0,
    ...initial,
  };
}

const editForm = ref({
  employeeId: null as number | null,
  customerName: '',
  customerPhone: '',
  saleDate: '',
  items: [] as EditSaleLineItem[],
});
const saving = ref(false);
const editError = ref('');

// Cancel Sale Confirm
const showCancelDialog = ref(false);
const cancellingSale = ref<Sale | null>(null);
const cancelling = ref(false);
const exporting = ref(false);

// Tabs state
const activeMainTab = ref<'sales' | 'pickups' | 'factures'>('sales');

// Pending pickups queue state
const pendingPickups = ref<SaleFulfillmentLine[]>([]);
const pendingPickupsLoading = ref(false);
const pendingPickupsCount = ref(0);
const pickupsPage = ref(1);
const pickupsLimit = ref(25);
const pickupsTotal = ref(0);
const pickupsTotalPages = ref(1);
const pickupsSearch = ref('');

// Modals for pickups
const showFulfillModal = ref(false);
const selectedFulfillLine = ref<SaleFulfillmentLine | null>(null);
const fulfillPaymentMethod = ref('CASH');
const fulfillConfirmed = ref(false);
const fulfilling = ref(false);
const fulfillError = ref('');

const showSlipModal = ref(false);
const selectedSlipLine = ref<SaleFulfillmentLine | null>(null);
const returnToInvoiceOnSlipClose = ref(false);

const showReassignModal = ref(false);
const selectedReassignLine = ref<SaleFulfillmentLine | null>(null);
const reassignWarehouseId = ref<number>(0);
const reassignQuantity = ref<number>(1);
const reassignPaymentStatus = ref<'PAID' | 'COLLECT_ON_PICKUP'>('PAID');
const reassigning = ref(false);
const reassignError = ref('');

const showCancelLineDialog = ref(false);
const cancellingLine = ref<SaleFulfillmentLine | null>(null);
const cancellingLineLoading = ref(false);

// Factures tab state
const factures = ref<Facture[]>([]);
const facturesLoading = ref(false);
const facturesPage = ref(1);
const facturesLimit = ref(25);
const facturesTotal = ref(0);
const facturesTotalPages = ref(1);
const facturesSearch = ref('');
const facturesSituationFilter = ref<'all' | 'ACTIVE' | 'DETAINED' | 'DESTROYED'>('all');
const facturesDateRange = ref<{ startDate?: string; endDate?: string }>({});

// Create Facture Modal
const showCreateFactureModal = ref(false);
const salesWithoutFacture = ref<SaleWithoutFacture[]>([]);
const salesWithoutFactureLoading = ref(false);
const selectedSaleForFacture = ref<SaleWithoutFacture | null>(null);
const saleSearchQuery = ref('');
const saleDropdownOpen = ref(false);
let saleSearchDebounceTimer: any = null;
const createFactureForm = ref({
  clientName: '',
  clientAddress: '',
  clientRc: '',
  clientNif: '',
  clientArt: '',
  clientActivite: '',
  clientNis: '',
  reglement: 'Espèce',
  moyenTransport: '',
  camionNumero: '',
  chauffeur: '',
});
const creatingFacture = ref(false);
const createFactureError = ref('');

// Facture Preview Modal
const showFacturePreviewModal = ref(false);
const selectedFacture = ref<Facture | null>(null);

// Facture Situation Modal
const showSituationModal = ref(false);
const situationFacture = ref<Facture | null>(null);
const situationForm = ref({ situation: 'ACTIVE' as FactureSituation, situationNotes: '' });
const updatingSituation = ref(false);

const cancelDialogMessage = computed(() => {
  if (!cancellingSale.value) return '';
  if (cancellingSale.value.hasInterWarehouseFulfillment || (cancellingSale.value.fulfillmentLines && cancellingSale.value.fulfillmentLines.length > 0)) {
    const lines = cancellingSale.value.fulfillmentLines || [];
    const fulfilled = lines.filter((l) => l.fulfillmentStatus === 'FULFILLED');
    const pending = lines.filter((l) => l.fulfillmentStatus === 'PENDING_PICKUP');

    if (fulfilled.length > 0 && pending.length === 0) {
      return 'Tous les articles de cette vente ont déjà été délivrés et retirés physiquement par le client. L\'annulation n\'est pas autorisée. Veuillez utiliser la gestion des retours clients.';
    } else if (fulfilled.length > 0 && pending.length > 0) {
      return `Attention : cette vente comporte ${fulfilled.length} article(s) déjà retiré(s) et ${pending.length} article(s) encore en attente de retrait. L'annulation va libérer les réservations des articles en attente et faire passer la vente en statut PARTIELLEMENT ANNULÉE (PARTIALLY_CANCELLED). Les articles retirés restent définitifs.`;
    } else {
      return `Cette vente comporte des articles en attente de retrait. L'annulation va libérer toutes les réservations de stock et annuler intégralement la vente.`;
    }
  }
  return `Êtes-vous sûr de vouloir annuler la vente ${cancellingSale.value.invoiceNumber} ? Le stock physique sera réintégré et les écritures financières compensées.`;
});

onMounted(async () => {
  await Promise.all([
    fetchProducts(),
    fetchEmployees(),
    fetchPickupsCount(),
    warehouseStore.fetchWarehouses(),
  ]);
});

// Watch warehouse changes to refresh sales
watch(() => authStore.activeWarehouseId, async (newWhId) => {
  page.value = 1;
  await Promise.all([
    fetchSales(),
    fetchEmployees(newWhId || undefined),
    fetchPickupsCount(),
  ]);
  if (activeMainTab.value === 'pickups') {
    fetchPendingPickups();
  }
});

watch(paymentStatusFilter, () => {
  page.value = 1;
  fetchSales();
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
      paymentStatus: paymentStatusFilter.value !== 'all' ? paymentStatusFilter.value : undefined,
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
      paymentStatus: paymentStatusFilter.value !== 'all' ? paymentStatusFilter.value : undefined,
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

async function viewInvoice(sale: Sale) {
  try {
    const full = await saleService.getSaleById(sale.id);
    selectedSale.value = full;
  } catch {
    selectedSale.value = sale;
  }
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
    items: sale.items.map((i) =>
      createEditLineItem({
        _uid: `existing_sale_item_${i.id || ++editUidCounter}`,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })
    ),
  };
  editError.value = '';
  showEditModal.value = true;
}

function onEditProductSelect(item: EditSaleLineItem) {
  const prod = products.value.find((p) => p.id === item.productId);
  if (prod) {
    item.unitPrice = prod.salePrice;
  }
}

function addEditItem() {
  if (products.value.length > 0) {
    const defaultProd = products.value[0];
    editForm.value.items.push(
      createEditLineItem({
        productId: defaultProd.id,
        quantity: 1,
        unitPrice: defaultProd.salePrice,
      })
    );
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

async function promptCancelSale(sale: Sale) {
  try {
    const full = await saleService.getSaleById(sale.id);
    cancellingSale.value = full;
  } catch {
    cancellingSale.value = sale;
  }
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

async function fetchPendingPickups() {
  pendingPickupsLoading.value = true;
  try {
    const res = await saleService.getPendingPickups({
      warehouseId: authStore.activeWarehouseId || undefined,
      page: pickupsPage.value,
      limit: pickupsLimit.value,
      search: pickupsSearch.value.trim() || undefined,
    });
    pendingPickups.value = res.items;
    pickupsTotal.value = res.pagination.total;
    pickupsTotalPages.value = res.pagination.totalPages;
  } catch (err) {
    console.error('Failed to load pending pickups', err);
  } finally {
    pendingPickupsLoading.value = false;
  }
}

async function fetchPickupsCount() {
  try {
    pendingPickupsCount.value = await saleService.getPendingPickupsCount(
      authStore.activeWarehouseId || undefined
    );
  } catch (err) {
    console.error('Failed to load pending pickups count', err);
  }
}

function switchMainTab(tab: 'sales' | 'pickups' | 'factures') {
  activeMainTab.value = tab;
  if (tab === 'pickups') {
    pickupsPage.value = 1;
    fetchPendingPickups();
  } else if (tab === 'factures') {
    facturesPage.value = 1;
    fetchFactures();
  } else {
    fetchSales();
  }
}

// ─── Facture Methods ─────────────────────────
async function fetchFactures() {
  facturesLoading.value = true;
  try {
    const res = await factureService.getFactures({
      page: facturesPage.value,
      limit: facturesLimit.value,
      search: facturesSearch.value.trim() || undefined,
      situation: facturesSituationFilter.value !== 'all' ? facturesSituationFilter.value : undefined,
      startDate: facturesDateRange.value.startDate,
      endDate: facturesDateRange.value.endDate,
    });
    factures.value = res.items;
    facturesTotal.value = res.pagination.total;
    facturesTotalPages.value = res.pagination.totalPages;
  } catch (err) {
    console.error('Failed to load factures', err);
  } finally {
    facturesLoading.value = false;
  }
}

let facturesSearchTimeout: any = null;
function onFacturesSearchInput() {
  clearTimeout(facturesSearchTimeout);
  facturesSearchTimeout = setTimeout(async () => {
    facturesPage.value = 1;
    await fetchFactures();
  }, 300);
}

function onFacturesPageChange(payload: { page: number; limit: number }) {
  facturesPage.value = payload.page;
  facturesLimit.value = payload.limit;
  fetchFactures();
}

function onFacturesPeriodChange(range: { startDate?: string; endDate?: string }) {
  facturesDateRange.value = range;
  facturesPage.value = 1;
  fetchFactures();
}

async function searchSalesForFacture(term: string = '') {
  salesWithoutFactureLoading.value = true;
  try {
    salesWithoutFacture.value = await factureService.getSalesWithoutFacture({
      search: term.trim() || undefined,
      limit: 15,
    });
  } catch (err) {
    console.error('Failed to load sales without facture', err);
  } finally {
    salesWithoutFactureLoading.value = false;
  }
}

function onSaleSearchInput() {
  saleDropdownOpen.value = true;
  clearTimeout(saleSearchDebounceTimer);
  saleSearchDebounceTimer = setTimeout(() => {
    searchSalesForFacture(saleSearchQuery.value);
  }, 300);
}

function clearSelectedSaleForFacture() {
  selectedSaleForFacture.value = null;
  saleSearchQuery.value = '';
  saleDropdownOpen.value = true;
  searchSalesForFacture('');
}

async function openCreateFactureModal() {
  showCreateFactureModal.value = true;
  createFactureError.value = '';
  selectedSaleForFacture.value = null;
  saleSearchQuery.value = '';
  saleDropdownOpen.value = false;
  createFactureForm.value = {
    clientName: '', clientAddress: '', clientRc: '', clientNif: '',
    clientArt: '', clientActivite: '', clientNis: '', reglement: 'Espèce',
    moyenTransport: '', camionNumero: '', chauffeur: '',
  };
  await searchSalesForFacture('');
}

function openCreateFactureForSale(sale: Sale) {
  showCreateFactureModal.value = true;
  createFactureError.value = '';
  saleSearchQuery.value = '';
  saleDropdownOpen.value = false;
  selectedSaleForFacture.value = {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber || `#${sale.id}`,
    customerName: sale.customerName || sale.clientName || 'Client',
    clientId: sale.clientId || null,
    clientName: sale.clientName || null,
    clientCode: sale.clientCode || null,
    clientAddress: sale.clientAddress || null,
    clientRc: sale.clientRc || null,
    clientNif: sale.clientNif || null,
    clientArt: sale.clientArt || null,
    clientActivite: sale.clientActivite || null,
    clientNis: sale.clientNis || null,
    totalAmount: sale.totalAmount,
    saleDate: sale.saleDate || sale.createdAt || '',
  };
  createFactureForm.value = {
    clientName: sale.clientName || sale.customerName || '',
    clientAddress: sale.clientAddress || '',
    clientRc: sale.clientRc || '',
    clientNif: sale.clientNif || '',
    clientArt: sale.clientArt || '',
    clientActivite: sale.clientActivite || '',
    clientNis: sale.clientNis || '',
    reglement: 'Espèce',
    moyenTransport: '',
    camionNumero: '',
    chauffeur: '',
  };
}

function onSaleForFactureSelected(sale: SaleWithoutFacture) {
  selectedSaleForFacture.value = sale;
  saleSearchQuery.value = '';
  saleDropdownOpen.value = false;
  createFactureForm.value.clientName = sale.clientName || sale.customerName || '';
  createFactureForm.value.clientAddress = sale.clientAddress || '';
  createFactureForm.value.clientRc = sale.clientRc || '';
  createFactureForm.value.clientNif = sale.clientNif || '';
  createFactureForm.value.clientArt = sale.clientArt || '';
  createFactureForm.value.clientActivite = sale.clientActivite || '';
  createFactureForm.value.clientNis = sale.clientNis || '';
}

async function handleCreateFacture() {
  if (!selectedSaleForFacture.value) {
    createFactureError.value = 'Veuillez sélectionner une vente.';
    return;
  }
  creatingFacture.value = true;
  createFactureError.value = '';
  try {
    await factureService.createFacture({
      saleId: selectedSaleForFacture.value.id,
      ...createFactureForm.value,
    });
    showCreateFactureModal.value = false;
    await Promise.all([
      fetchFactures(),
      fetchSales(),
    ]);
  } catch (err: any) {
    createFactureError.value = err.response?.data?.message || err.message || 'Erreur lors de la création';
  } finally {
    creatingFacture.value = false;
  }
}

async function viewFacture(facture: Facture) {
  try {
    const full = await factureService.getFactureById(facture.id);
    selectedFacture.value = full;
    showFacturePreviewModal.value = true;
  } catch (err) {
    console.error('Failed to load facture', err);
  }
}

async function viewFactureById(factureId: number) {
  try {
    const full = await factureService.getFactureById(factureId);
    selectedFacture.value = full;
    showFacturePreviewModal.value = true;
  } catch (err) {
    console.error('Failed to load facture preview', err);
  }
}

function openSituationModal(facture: Facture) {
  situationFacture.value = facture;
  situationForm.value = {
    situation: facture.situation,
    situationNotes: facture.situationNotes || '',
  };
  showSituationModal.value = true;
}

async function handleUpdateSituation() {
  if (!situationFacture.value) return;
  updatingSituation.value = true;
  try {
    await factureService.updateSituation(situationFacture.value.id, situationForm.value);
    showSituationModal.value = false;
    fetchFactures();
  } catch (err: any) {
    console.error('Failed to update situation', err);
  } finally {
    updatingSituation.value = false;
  }
}

function formatFactureSituation(sit: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'Active',
    DETAINED: 'Saisie (Gendarmerie)',
    DESTROYED: 'Détruite',
  };
  return map[sit] || sit;
}

function situationBadgeVariant(sit: string): 'success' | 'warning' | 'danger' {
  if (sit === 'ACTIVE') return 'success';
  if (sit === 'DETAINED') return 'warning';
  return 'danger';
}

let pickupsSearchTimeout: any = null;
function onPickupsSearchInput() {
  clearTimeout(pickupsSearchTimeout);
  pickupsSearchTimeout = setTimeout(async () => {
    pickupsPage.value = 1;
    await fetchPendingPickups();
  }, 300);
}

function onPickupsPageChange(payload: { page: number; limit: number }) {
  pickupsPage.value = payload.page;
  pickupsLimit.value = payload.limit;
  fetchPendingPickups();
}

function formatTtlRemaining(expiresAt?: string): { text: string; status: 'ok' | 'warning' | 'danger' } {
  if (!expiresAt) return { text: '120h standard', status: 'ok' };
  const exp = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = exp - now;

  if (diffMs <= 0) {
    return { text: 'Expiré (TTL dépassé)', status: 'danger' };
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remHours = diffHours % 24;

  if (diffDays >= 2) {
    return { text: `${diffDays}j ${remHours}h restant`, status: 'ok' };
  } else if (diffHours >= 12) {
    return { text: `${diffHours}h restantes`, status: 'warning' };
  } else {
    return { text: `${diffHours}h restantes (urgent)`, status: 'danger' };
  }
}

function openFulfillModal(line: SaleFulfillmentLine) {
  selectedFulfillLine.value = line;
  fulfillPaymentMethod.value = 'CASH';
  fulfillConfirmed.value = false;
  fulfillError.value = '';
  showFulfillModal.value = true;
}

async function handleConfirmFulfill() {
  if (!selectedFulfillLine.value) return;
  fulfilling.value = true;
  fulfillError.value = '';
  try {
    await saleService.fulfillPickupLine(selectedFulfillLine.value.id, {
      paymentMethod: selectedFulfillLine.value.paymentStatus === 'COLLECT_ON_PICKUP' ? fulfillPaymentMethod.value : undefined,
    });
    showFulfillModal.value = false;
    await Promise.all([fetchPendingPickups(), fetchPickupsCount()]);
  } catch (err: any) {
    fulfillError.value = err.response?.data?.message || 'Échec de la validation du retrait';
  } finally {
    fulfilling.value = false;
  }
}

function openSlipModal(line: SaleFulfillmentLine) {
  selectedSlipLine.value = line;
  if (showInvoiceModal.value) {
    showInvoiceModal.value = false;
    returnToInvoiceOnSlipClose.value = true;
  }
  showSlipModal.value = true;
}

function handleCloseSlipModal() {
  showSlipModal.value = false;
  if (returnToInvoiceOnSlipClose.value) {
    returnToInvoiceOnSlipClose.value = false;
    showInvoiceModal.value = true;
  }
}

function openReassignModal(line: SaleFulfillmentLine) {
  selectedReassignLine.value = line;
  reassignWarehouseId.value = line.fulfillmentWarehouseId;
  reassignQuantity.value = line.quantity;
  reassignPaymentStatus.value = line.paymentStatus;
  reassignError.value = '';
  showReassignModal.value = true;
}

async function handleSaveReassign() {
  if (!selectedReassignLine.value) return;
  reassigning.value = true;
  reassignError.value = '';
  try {
    await saleService.updatePickupLine(selectedReassignLine.value.id, {
      fulfillmentWarehouseId: reassignWarehouseId.value,
      quantity: reassignQuantity.value,
      paymentStatus: reassignPaymentStatus.value,
    });
    showReassignModal.value = false;
    await Promise.all([fetchPendingPickups(), fetchPickupsCount()]);
  } catch (err: any) {
    reassignError.value = err.response?.data?.message || 'Échec de la réaffectation';
  } finally {
    reassigning.value = false;
  }
}

function promptCancelLine(line: SaleFulfillmentLine) {
  cancellingLine.value = line;
  showCancelLineDialog.value = true;
}

async function handleConfirmCancelLine() {
  if (!cancellingLine.value) return;
  cancellingLineLoading.value = true;
  try {
    await saleService.cancelPickupLine(cancellingLine.value.id);
    showCancelLineDialog.value = false;
    await Promise.all([fetchPendingPickups(), fetchPickupsCount()]);
  } catch (err) {
    console.error('Failed to cancel pickup line', err);
  } finally {
    cancellingLineLoading.value = false;
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

    <!-- Main Navigation Tabs -->
    <div class="tabs-header">
      <button
        :class="['main-tab-btn', { active: activeMainTab === 'sales' }]"
        @click="switchMainTab('sales')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        Toutes les Ventes
      </button>
      <button
        :class="['main-tab-btn', { active: activeMainTab === 'pickups' }]"
        @click="switchMainTab('pickups')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        Retraits en Attente (Inter-Dépôts)
        <span v-if="pendingPickupsCount > 0" class="tab-badge">{{ pendingPickupsCount }}</span>
      </button>
      <button
        :class="['main-tab-btn', { active: activeMainTab === 'factures' }]"
        @click="switchMainTab('factures')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        Gestion des Factures
      </button>
    </div>

    <!-- TAB 1: ALL SALES -->
    <div v-if="activeMainTab === 'sales'" class="tab-pane">
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

        <div class="payment-filter-pills">
          <button
            :class="['status-pill', { active: paymentStatusFilter === 'all' }]"
            @click="paymentStatusFilter = 'all'"
          >
            Tous les règlements
          </button>
          <button
            :class="['status-pill', { active: paymentStatusFilter === 'PAID' }]"
            @click="paymentStatusFilter = 'PAID'"
          >
            Payées
          </button>
          <button
            :class="['status-pill', { active: paymentStatusFilter === 'PARTIALLY_PAID' }]"
            @click="paymentStatusFilter = 'PARTIALLY_PAID'"
          >
            Partielles
          </button>
          <button
            :class="['status-pill', { active: paymentStatusFilter === 'UNPAID' }]"
            @click="paymentStatusFilter = 'UNPAID'"
          >
            Non payées
          </button>
        </div>

        <div class="count-badge text-muted font-mono">
          {{ total }} {{ total > 1 ? 'factures' : 'facture' }}
        </div>
      </div>

      <!-- Table -->
      <AppTable :loading="loading" :empty="!sales.length" empty-text="Aucune vente enregistrée pour cette période" :columns-count="8">
        <template #header>
          <th>N° Bon</th>
          <th>Entrepôt</th>
          <th>Client</th>
          <th>Agent de suivi</th>
          <th>Montant Total</th>
          <th>Règlement</th>
          <th>Date de Vente</th>
          <th>Actions</th>
        </template>
        <template #body>
          <tr v-for="sale in sales" :key="sale.id">
            <td class="font-mono font-bold">{{ sale.invoiceNumber }}</td>
            <td>{{ sale.warehouseName }}</td>
            <td>
              <router-link
                v-if="sale.clientId && sale.clientId > 1"
                :to="`/clients/${sale.clientId}`"
                class="client-link"
              >
                <strong>{{ sale.clientName || sale.customerName }}</strong>
                <span v-if="sale.clientCode" class="client-code-tag">{{ sale.clientCode }}</span>
              </router-link>
              <div v-else>
                <strong>{{ sale.customerName || 'Client Comptoir' }}</strong>
              </div>
              <span v-if="sale.customerPhone" class="text-caption text-muted" style="display: block;">
                {{ sale.customerPhone }}
              </span>
            </td>
            <td>
              <span v-if="sale.employeeName" class="agent-pill">{{ sale.employeeName }}</span>
              <span v-else class="text-caption text-muted">Non spécifié</span>
            </td>
            <td class="font-mono font-bold">{{ formatCurrency(sale.totalAmount) }}</td>
            <td>
              <span
                v-if="sale.status === 'CANCELLED'"
                class="badge-payment cancelled"
              >
                Annulée
              </span>
              <span
                v-else-if="sale.status === 'PARTIALLY_CANCELLED'"
                class="badge-payment partial"
                title="Partiellement annulée : certaines lignes ont été retirées, les lignes en attente ont été annulées"
              >
                Part. Annulée
              </span>
              <span
                v-else-if="sale.paymentStatus === 'PAID'"
                class="badge-payment paid"
                :title="`Facture payée${sale.advanceDeducted ? ` (dont ${formatCurrency(sale.advanceDeducted)} par avoir client)` : ''}`"
              >
                Payée
              </span>
              <span
                v-else-if="sale.paymentStatus === 'PARTIALLY_PAID'"
                class="badge-payment partial"
                :title="`Payé: ${formatCurrency(sale.paidAmount || 0)}${sale.advanceDeducted ? ` (dont ${formatCurrency(sale.advanceDeducted)} par avoir client)` : ''} / Reste: ${formatCurrency(sale.remainingAmount || 0)}`"
              >
                Partielle ({{ formatCurrency(sale.paidAmount || 0) }})
              </span>
              <span
                v-else
                class="badge-payment unpaid"
              >
                Non payée
              </span>
            </td>
            <td class="font-mono text-caption">{{ formatDateTime(sale.saleDate || sale.createdAt) }}</td>
            <td>
              <div class="action-buttons">
                <button class="icon-action-btn" title="Afficher / Imprimer le bon de livraison" @click="viewInvoice(sale)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Bon 
                </button>

                <!-- Facture Action: already invoiced vs unbilled -->
                <button
                  v-if="sale.factureId"
                  class="icon-action-btn btn-facture-badge"
                  :title="`Facture Fiscale N° ${sale.factureNumber || sale.factureId}. Cliquer pour afficher`"
                  @click="viewFactureById(sale.factureId)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  Facture {{ sale.factureNumber ? 'N° ' + sale.factureNumber : '' }}
                </button>
                <button
                  v-else-if="sale.status !== 'CANCELLED' && !authStore.isReadOnly"
                  class="icon-action-btn btn-create-facture"
                  title="Émettre une facture fiscale pour cette vente"
                  @click="openCreateFactureForSale(sale)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                  Facturer
                </button>

                <template v-if="(sale.status === 'COMPLETED' || sale.status === 'PENDING_PICKUP') && !authStore.isReadOnly">
                  <button class="icon-action-btn" title="Modifier les lignes de vente" @click="openEditModal(sale)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Modifier
                  </button>

                  <button class="icon-action-btn btn-danger-action" title="Annuler la vente" @click="promptCancelSale(sale)">
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
    </div>

    <!-- TAB 2: PENDING PICKUPS QUEUE (INTER-WAREHOUSE) -->
    <div v-else-if="activeMainTab === 'pickups'" class="tab-pane">
      <!-- Pickups Filter Bar -->
      <div class="filter-bar">
        <div class="search-box">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="pickupsSearch"
            type="text"
            placeholder="Rechercher par code bon, n° facture, client, article..."
            class="search-input"
            @input="onPickupsSearchInput"
          />
        </div>
        <div class="count-badge text-muted font-mono">
          {{ pickupsTotal }} {{ pickupsTotal > 1 ? 'retraits en attente' : 'retrait en attente' }}
        </div>
      </div>

      <!-- Pickups Table -->
      <AppTable :loading="pendingPickupsLoading" :empty="!pendingPickups.length" empty-text="Aucun retrait en attente pour cet entrepôt" :columns-count="8">
        <template #header>
          <th>N° Bon de Retrait</th>
          <th>Bon Parente</th>
          <th>Client</th>
          <th>Dépôt Vendeur</th>
          <th>Article & Quantité</th>
          <th>Règlement</th>
          <th>Délai Retrait</th>
          <th>Actions</th>
        </template>
        <template #body>
          <tr v-for="line in pendingPickups" :key="line.id">
            <td>
              <span class="voucher-tag font-mono font-bold">{{ line.pickupVoucherCode || line.voucherCode }}</span>
            </td>
            <td class="font-mono font-bold">
              {{ line.invoiceNumber || `#${line.saleId}` }}
            </td>
            <td>
              <strong>{{ line.customerName || 'Client Comptoir' }}</strong>
              <span v-if="line.customerPhone" class="text-caption text-muted" style="display: block;">
                {{ line.customerPhone }}
              </span>
            </td>
            <td>
              <span class="origin-warehouse-pill">{{ line.originWarehouseName || 'Dépôt Vendeur' }}</span>
            </td>
            <td>
              <div><strong>{{ line.productName || 'Article' }}</strong></div>
              <span class="text-caption font-mono text-muted">Réf: {{ line.productReference || '-' }}</span>
              <span class="qty-pill">x {{ line.quantity }}</span>
            </td>
            <td>
              <span
                v-if="line.paymentStatus === 'PAID'"
                class="badge-payment paid"
                title="Article déjà réglé à l'entrepôt d'origine"
              >
                ✓ Déjà réglé
              </span>
              <span
                v-else-if="line.paymentStatus === 'COLLECT_ON_PICKUP'"
                class="badge-payment collect"
                title="À encaisser obligatoirement avant remise du matériel"
              >
                À encaisser au retrait
              </span>
            </td>
            <td>
              <span
                :class="['ttl-chip', formatTtlRemaining(line.reservationExpiresAt || line.expiresAt).status]"
              >
                {{ formatTtlRemaining(line.reservationExpiresAt || line.expiresAt).text }}
              </span>
            </td>
            <td>
              <div class="action-buttons">
                <button
                  v-if="!authStore.isReadOnly"
                  class="icon-action-btn btn-fulfill-action"
                  title="Délivrer et enregistrer le retrait client"
                  @click="openFulfillModal(line)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Délivrer
                </button>
                <button
                  class="icon-action-btn"
                  title="Imprimer le bon de retrait"
                  @click="openSlipModal(line)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Bon
                </button>
                <template v-if="!authStore.isReadOnly">
                  <button
                    class="icon-action-btn"
                    title="Réaffecter à un autre entrepôt"
                    @click="openReassignModal(line)"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M16 3h5v5" />
                      <path d="M4 20L21 3" />
                      <path d="M21 16v5h-5" />
                      <path d="M15 15l6 6" />
                      <path d="M4 4l5 5" />
                    </svg>
                    Réaffecter
                  </button>
                  <button
                    class="icon-action-btn btn-danger-action"
                    title="Annuler cette ligne de retrait"
                    @click="promptCancelLine(line)"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Annuler
                  </button>
                </template>
              </div>
            </td>
          </tr>
        </template>
      </AppTable>

      <!-- Pickups Pagination -->
      <AppPagination
        v-model:page="pickupsPage"
        v-model:limit="pickupsLimit"
        :total="pickupsTotal"
        :total-pages="pickupsTotalPages"
        :loading="pendingPickupsLoading"
        @change="onPickupsPageChange"
      />
    </div>

    <!-- TAB 3: FACTURES (INVOICE MANAGEMENT) -->
    <div v-else-if="activeMainTab === 'factures'" class="tab-pane">
      <!-- Factures Filter Bar -->
      <div class="filter-bar">
        <div class="search-box">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            v-model="facturesSearch"
            type="text"
            placeholder="Rechercher par n° facture, client, n° bon..."
            class="search-input"
            @input="onFacturesSearchInput"
          />
        </div>

        <div class="payment-filter-pills">
          <button
            :class="['status-pill', { active: facturesSituationFilter === 'all' }]"
            @click="() => { facturesSituationFilter = 'all'; facturesPage = 1; fetchFactures(); }"
          >
            Toutes
          </button>
          <button
            :class="['status-pill', { active: facturesSituationFilter === 'ACTIVE' }]"
            @click="() => { facturesSituationFilter = 'ACTIVE'; facturesPage = 1; fetchFactures(); }"
          >
            Actives
          </button>
          <button
            :class="['status-pill', { active: facturesSituationFilter === 'DETAINED' }]"
            @click="() => { facturesSituationFilter = 'DETAINED'; facturesPage = 1; fetchFactures(); }"
          >
            Saisies (Gendarmerie)
          </button>
          <button
            :class="['status-pill', { active: facturesSituationFilter === 'DESTROYED' }]"
            @click="() => { facturesSituationFilter = 'DESTROYED'; facturesPage = 1; fetchFactures(); }"
          >
            Détruites
          </button>
        </div>

        <div class="header-actions">
          <AppButton v-if="!authStore.isReadOnly" variant="primary" @click="openCreateFactureModal">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Émettre une Facture
          </AppButton>
          <div class="count-badge text-muted font-mono">
            {{ facturesTotal }} {{ facturesTotal > 1 ? 'factures' : 'facture' }}
          </div>
        </div>
      </div>

      <!-- Factures Table -->
      <AppTable :loading="facturesLoading" :empty="!factures.length" empty-text="Aucune facture émise pour le moment" :columns-count="10">
        <template #header>
          <th>N° Facture</th>
          <th>Date</th>
          <th>Bon Vente Associé</th>
          <th>Client</th>
          <th>Total HT</th>
          <th>Total TVA (19%)</th>
          <th>Timbre (1%)</th>
          <th>Total TTC</th>
          <th>Situation</th>
          <th>Actions</th>
        </template>
        <template #body>
          <tr v-for="facture in factures" :key="facture.id">
            <td>
              <span class="font-mono font-bold">{{ facture.factureNumber }}</span>
            </td>
            <td class="font-mono text-caption">{{ formatDate(facture.factureDate) }}</td>
            <td>
              <span class="font-mono text-caption">{{ facture.invoiceNumber || `#${facture.saleId}` }}</span>
            </td>
            <td>
              <strong>{{ facture.clientName }}</strong>
              <div v-if="facture.clientNif || facture.clientRc" class="text-caption text-muted font-mono">
                {{ facture.clientNif ? `NIF: ${facture.clientNif}` : '' }} {{ facture.clientRc ? `RC: ${facture.clientRc}` : '' }}
              </div>
            </td>
            <td class="font-mono">{{ formatCurrency(facture.totalHt) }}</td>
            <td class="font-mono text-muted">{{ formatCurrency(facture.totalTva) }}</td>
            <td class="font-mono text-muted">{{ formatCurrency(facture.timbre) }}</td>
            <td class="font-mono font-bold text-primary">{{ formatCurrency(facture.totalTtc) }}</td>
            <td>
              <AppBadge :variant="situationBadgeVariant(facture.situation)">
                {{ formatFactureSituation(facture.situation) }}
              </AppBadge>
            </td>
            <td>
              <div class="action-buttons">
                <button class="icon-action-btn" title="Afficher / Imprimer la facture fiscale" @click="viewFacture(facture)">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Facture
                </button>
                <button
                  v-if="!authStore.isReadOnly"
                  class="icon-action-btn"
                  title="Changer la situation fiscale (Active, Saisie, Détruite)"
                  @click="openSituationModal(facture)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Situation
                </button>
              </div>
            </td>
          </tr>
        </template>
      </AppTable>

      <!-- Factures Pagination -->
      <AppPagination
        v-model:page="facturesPage"
        v-model:limit="facturesLimit"
        :total="facturesTotal"
        :total-pages="facturesTotalPages"
        :loading="facturesLoading"
        @change="onFacturesPageChange"
      />
    </div>

    <!-- Invoice Viewer Modal -->
    <AppModal
      v-model="showInvoiceModal"
      :title="`Facture / Bon de Caisse : ${selectedSale?.invoiceNumber || ''}`"
      max-width="880px"
    >
      <div v-if="selectedSale" class="invoice-modal-content">
        <div class="invoice-preview-wrapper">
          <InvoiceDocument :sale="selectedSale" />
        </div>

        <!-- Inter-warehouse fulfillment lines breakdown -->
        <div v-if="selectedSale.fulfillmentLines && selectedSale.fulfillmentLines.length > 0" class="fulfillment-breakdown-card no-print">
          <div class="breakdown-header">
            <h4>Bons de Retrait Inter-Dépôts Associés</h4>
            <span class="breakdown-count">{{ selectedSale.fulfillmentLines.length }} ligne(s) déportée(s)</span>
          </div>

          <div class="fulfillment-lines-list">
            <div v-for="line in selectedSale.fulfillmentLines" :key="line.id" class="fulfillment-line-item">
              <div class="line-summary">
                <div class="line-title">
                  <span class="font-mono font-bold voucher-badge">{{ line.pickupVoucherCode || line.voucherCode }}</span>
                  <span class="item-name">{{ line.productName || 'Article' }} &times; {{ line.quantity }}</span>
                  <span :class="['status-chip', line.fulfillmentStatus.toLowerCase()]">
                    {{ line.fulfillmentStatus === 'FULFILLED' ? 'Retiré le ' + formatDateTime(line.fulfilledAt) : line.fulfillmentStatus === 'PENDING_PICKUP' ? 'En attente de retrait' : 'Annulé' }}
                  </span>
                </div>
                <div class="line-sub">
                  <span>Dépôt de retrait : <strong>{{ line.fulfillmentWarehouseName }}</strong></span>
                  <span class="dot">•</span>
                  <span>Règlement : <strong>{{ line.paymentStatus === 'PAID' ? 'Déjà payé à l\'origine' : 'À régler au retrait' }}</strong></span>
                  <span v-if="line.fulfillmentStatus === 'PENDING_PICKUP' && (line.reservationExpiresAt || line.expiresAt)" class="dot">•</span>
                  <span v-if="line.fulfillmentStatus === 'PENDING_PICKUP' && (line.reservationExpiresAt || line.expiresAt)" :class="['ttl-text', formatTtlRemaining(line.reservationExpiresAt || line.expiresAt).status]">
                    {{ formatTtlRemaining(line.reservationExpiresAt || line.expiresAt).text }}
                  </span>
                </div>
              </div>

              <div class="line-actions">
                <AppButton variant="secondary" size="sm" @click="openSlipModal(line)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Imprimer le Bon
                </AppButton>
              </div>
            </div>
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

          <div v-for="(item, idx) in editForm.items" :key="item._uid" class="item-row">
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

    <!-- Cancel Sale Dialog -->
    <ConfirmDialog
      v-model="showCancelDialog"
      title="Annuler & Invalider la Facture de Vente"
      :message="cancelDialogMessage"
      confirm-text="Annuler la Vente & Réconcilier le Stock"
      cancel-text="Conserver la Vente"
      variant="danger"
      :loading="cancelling"
      @confirm="handleConfirmCancel"
    />

    <!-- Facture Viewer Modal -->
    <AppModal
      v-model="showFacturePreviewModal"
      :title="`Facture Fiscale : ${selectedFacture?.factureNumber || ''}`"
      max-width="920px"
    >
      <div v-if="selectedFacture" class="invoice-modal-content">
        <div class="invoice-preview-wrapper print-surface">
          <FactureDocument :facture="selectedFacture" />
        </div>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="showFacturePreviewModal = false">Fermer</AppButton>
        <AppButton variant="primary" onclick="window.print()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Imprimer la Facture
        </AppButton>
      </template>
    </AppModal>

    <!-- Create Facture Modal -->
    <AppModal
      v-model="showCreateFactureModal"
      title="Émettre une Nouvelle Facture Fiscale"
      max-width="780px"
    >
      <div v-if="createFactureError" class="modal-error mb-3">
        {{ createFactureError }}
      </div>

      <div class="modal-form">
        <!-- Step 1: Select Sale via Smart Combobox -->
        <div class="app-input-group">
          <label class="input-label">Sélectionner la Vente (Bon de Livraison)</label>

          <!-- State A: A sale is currently selected -->
          <div v-if="selectedSaleForFacture" class="selected-sale-card">
            <div class="selected-sale-card-header">
              <div class="selected-sale-bl-title">
                <span class="bl-tag font-mono font-bold">{{ selectedSaleForFacture.invoiceNumber }}</span>
                <span class="sale-date text-caption text-muted font-mono">({{ formatDate(selectedSaleForFacture.saleDate) }})</span>
              </div>
              <button
                type="button"
                class="btn-change-sale"
                title="Changer de vente ou en chercher une autre"
                @click="clearSelectedSaleForFacture"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Changer de vente
              </button>
            </div>
            <div class="selected-sale-card-body">
              <div class="sale-customer-name">
                <strong>{{ selectedSaleForFacture.customerName || selectedSaleForFacture.clientName || 'Client Comptoir' }}</strong>
                <span v-if="selectedSaleForFacture.clientCode" class="client-code-pill font-mono">{{ selectedSaleForFacture.clientCode }}</span>
              </div>
              <div class="sale-amount-pill font-mono font-bold">
                {{ formatCurrency(selectedSaleForFacture.totalAmount) }}
              </div>
            </div>
          </div>

          <!-- State B: Searching / Selecting Sale -->
          <div v-else class="sale-combobox-wrapper">
            <div class="combobox-input-wrapper">
              <svg class="combobox-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                v-model="saleSearchQuery"
                type="text"
                class="combobox-search-input"
                placeholder="Rechercher par N° Bon (ex: INV-...), client ou code..."
                @focus="saleDropdownOpen = true"
                @input="onSaleSearchInput"
              />
              <span v-if="salesWithoutFactureLoading" class="combobox-loading-spinner" />
            </div>

            <!-- Floating suggestion list -->
            <div v-if="saleDropdownOpen" class="sale-combobox-dropdown">
              <div v-if="salesWithoutFactureLoading && !salesWithoutFacture.length" class="combobox-empty-message">
                Recherche des ventes en cours...
              </div>
              <div v-else-if="!salesWithoutFacture.length" class="combobox-empty-message">
                {{ saleSearchQuery.trim() ? `Aucune vente trouvée pour "${saleSearchQuery}"` : 'Aucune vente sans facture disponible.' }}
              </div>
              <div v-else class="sale-suggestions-list">
                <div class="combobox-section-title">
                  {{ saleSearchQuery.trim() ? 'Résultats correspondants' : 'Ventes récentes éligibles' }}
                  <span class="text-caption text-muted font-mono">({{ salesWithoutFacture.length }})</span>
                </div>
                <div
                  v-for="s in salesWithoutFacture"
                  :key="s.id"
                  class="sale-suggestion-item"
                  @click="onSaleForFactureSelected(s)"
                >
                  <div class="suggestion-left">
                    <div class="suggestion-bl font-mono font-bold">{{ s.invoiceNumber || '#' + s.id }}</div>
                    <div class="suggestion-client text-muted">
                      {{ s.customerName || s.clientName || 'Client' }}
                      <span v-if="s.clientCode" class="client-mini-code font-mono">[{{ s.clientCode }}]</span>
                    </div>
                  </div>
                  <div class="suggestion-right">
                    <div class="suggestion-amount font-mono font-bold">{{ formatCurrency(s.totalAmount) }}</div>
                    <div class="suggestion-date text-caption text-muted font-mono">{{ formatDate(s.saleDate) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="selectedSaleForFacture" class="selected-sale-info-box">
          <div class="info-row">
            <span class="info-label">Bon de Livraison associé :</span>
            <span class="info-val font-mono font-bold">{{ selectedSaleForFacture.invoiceNumber }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Montant Réel Vente :</span>
            <span class="info-val font-mono">{{ formatCurrency(selectedSaleForFacture.totalAmount) }}</span>
          </div>
          <div class="info-note">
            💡 <em>La facture fiscale utilisera automatiquement le prix facture (30% du prix d'achat) de chaque produit pour générer des totaux HT et TVA conformes et réduits.</em>
          </div>
        </div>

        <!-- Step 2: Client Info -->
        <h4 class="section-subtitle mt-2">Coordonnées du Client (Sur la Facture)</h4>
        <div class="form-row">
          <AppInput
            v-model="createFactureForm.clientName"
            label="Nom / Raison Sociale Client"
            placeholder="Nom du client"
            required
          />
          <AppInput
            v-model="createFactureForm.clientAddress"
            label="Adresse Client"
            placeholder="Ville, Wilaya..."
          />
        </div>

        <div class="form-row">
          <AppInput
            v-model="createFactureForm.clientRc"
            label="N° Registre de Commerce (RC)"
            placeholder="Ex: 19 B 123456"
          />
          <AppInput
            v-model="createFactureForm.clientNif"
            label="NIF / Identifiant Fiscal"
            placeholder="NIF / IF"
          />
        </div>

        <div class="form-row">
          <AppInput
            v-model="createFactureForm.clientArt"
            label="N° Article d'Imposition (ART)"
            placeholder="Ex: 19204502299"
          />
          <AppInput
            v-model="createFactureForm.clientNis"
            label="NIS (Statistique)"
            placeholder="Ex: 0001160123456"
          />
        </div>

        <div class="form-row">
          <AppInput
            v-model="createFactureForm.clientActivite"
            label="Activité Client"
            placeholder="Ex: Commerce de détail"
          />
        </div>

        <!-- Step 3: Transport & Reglement -->
        <h4 class="section-subtitle mt-2">Transport & Règlement</h4>
        <div class="form-row">
          <div class="app-input-group">
            <label class="input-label">Mode de Règlement</label>
            <select v-model="createFactureForm.reglement" class="app-select">
              <option value="Espèce">Espèce</option>
              <option value="Chèque">Chèque</option>
              <option value="Virement">Virement</option>
              <option value="Traite">Traite</option>
            </select>
          </div>
          <AppInput
            v-model="createFactureForm.moyenTransport"
            label="Moyen de Transport"
            placeholder="Ex: CAMION HYUNDAI"
          />
        </div>

        <div class="form-row">
          <AppInput
            v-model="createFactureForm.camionNumero"
            label="N° Camion / Matricule"
            placeholder="Ex: 12345 119 19"
          />
          <AppInput
            v-model="createFactureForm.chauffeur"
            label="Nom du Chauffeur"
            placeholder="Nom & Prénom"
          />
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="showCreateFactureModal = false">Annuler</AppButton>
        <AppButton
          variant="primary"
          :loading="creatingFacture"
          :disabled="!selectedSaleForFacture"
          @click="handleCreateFacture"
        >
          Émettre la Facture Fiscale
        </AppButton>
      </template>
    </AppModal>

    <!-- Facture Situation Modal -->
    <AppModal
      v-model="showSituationModal"
      :title="`Situation Fiscale : ${situationFacture?.factureNumber || ''}`"
      max-width="500px"
    >
      <div v-if="situationFacture" class="modal-form">
        <div class="fulfill-info-box mb-2">
          <div class="info-row">
            <span class="info-label">N° Facture :</span>
            <span class="info-val font-mono font-bold">{{ situationFacture.factureNumber }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Client :</span>
            <span class="info-val font-bold">{{ situationFacture.clientName }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Total TTC :</span>
            <span class="info-val font-mono">{{ formatCurrency(situationFacture.totalTtc) }}</span>
          </div>
        </div>

        <div class="app-input-group">
          <label class="input-label">Situation Actuelle</label>
          <select v-model="situationForm.situation" class="app-select">
            <option value="ACTIVE">Active (En circulation normale)</option>
            <option value="DETAINED">Saisie par la Gendarmerie</option>
            <option value="DESTROYED">Détruite par le client</option>
          </select>
        </div>

        <div class="app-input-group">
          <label class="input-label">Notes & Justificatifs</label>
          <textarea
            v-model="situationForm.situationNotes"
            class="app-textarea"
            rows="3"
            placeholder="Préciser les circonstances (ex: N° PV de saisie, date et lieu du contrôle...)"
          ></textarea>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="showSituationModal = false">Annuler</AppButton>
        <AppButton
          variant="primary"
          :loading="updatingSituation"
          @click="handleUpdateSituation"
        >
          Enregistrer la Situation
        </AppButton>
      </template>
    </AppModal>
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

.payment-filter-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.status-pill {
  padding: 5px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full, 9999px);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.status-pill:hover {
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
}

.status-pill.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.client-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: var(--color-primary);
  transition: color var(--transition-fast);
}

.client-link:hover {
  text-decoration: underline;
}

.client-code-tag {
  font-size: 10px;
  font-family: monospace;
  background: var(--color-bg-subtle);
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--color-text-secondary);
}

.badge-payment {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
}

.badge-payment.paid {
  color: #10b981;
}

.badge-payment.partial {
  color: #f59e0b;
}

.badge-payment.unpaid {
  color: #ef4444;
}

.badge-payment.cancelled {
  color: var(--color-text-secondary);
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
  padding: 8px 36px 8px 34px;
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

.combobox-loading-spinner {
  position: absolute;
  right: 12px;
  width: 14px;
  height: 14px;
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
</style>

