<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { useProductStore } from '../../stores/product.store';
import { useClientStore } from '../../stores/client.store';
import { saleService, inventoryService } from '../../services/operations.service';
import { employeeService } from '../../services/admin-reports.service';
import type { Product, Stock, Employee, Client, FulfillmentAllocationInput, Sale, SaleFulfillmentLine } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import AppButton from '../../components/common/AppButton.vue';
import AppInput from '../../components/common/AppInput.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppProductCombobox from '../../components/common/AppProductCombobox.vue';
import AppClientCombobox from '../../components/common/AppClientCombobox.vue';
import InterWarehouseSplitModal from '../../components/sales/InterWarehouseSplitModal.vue';
import PickupSlipDocument from '../../components/sales/PickupSlipDocument.vue';

const router = useRouter();
const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();
const productStore = useProductStore();
const clientStore = useClientStore();

const warehouseStock = ref<Stock[]>([]);
const employees = ref<Employee[]>([]);
const selectedEmployeeId = ref<number | null>(null);
const loading = ref(true);
const submitting = ref(false);
const errorMessage = ref('');

const selectedWarehouseId = ref<number>(
  authStore.activeWarehouseId || warehouseStore.warehouses[0]?.id || 1
);

// Client Selection
const selectedClientId = ref<number | null>(null);
const customerName = ref('');
const customerPhone = ref('');

// Payment Conditions
const paymentCondition = ref<'FULL_CASH' | 'CREDIT' | 'PARTIAL_DOWNPAYMENT'>('FULL_CASH');
const downpaymentAmount = ref<number>(0);
const paymentMethod = ref<string>('CASH');
const useAdvanceCredit = ref<boolean>(true);

const getLocalDefaultDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const saleDate = ref(getLocalDefaultDateTime());

interface LineItem {
  _uid: string;
  productId: number;
  quantity: number;
  unitPrice: number;
  allocations?: FulfillmentAllocationInput[];
}

let uidCounter = 0;
function createLineItem(initial?: Partial<LineItem>): LineItem {
  return {
    _uid: `sale_line_${++uidCounter}_${Date.now()}`,
    productId: 0,
    quantity: 1,
    unitPrice: 0,
    ...initial,
  };
}

const lineItems = ref<LineItem[]>([
  createLineItem(),
]);

const isSplitModalOpen = ref(false);
const activeSplitItem = ref<LineItem | null>(null);

const originWarehouseName = computed(() => {
  const wh = warehouseStore.warehouses.find((w) => w.id === selectedWarehouseId.value);
  return wh ? wh.name : 'Dépôt Local';
});

function openSplitModal(item: LineItem) {
  if (!item.productId) {
    errorMessage.value = 'Veuillez d\'abord sélectionner un produit';
    return;
  }
  if (!isShortfall(item) && !hasAllocations(item)) {
    return;
  }
  activeSplitItem.value = item;
  isSplitModalOpen.value = true;
}

function onSplitSaved(allocations: FulfillmentAllocationInput[]) {
  if (activeSplitItem.value) {
    activeSplitItem.value.allocations = allocations;
  }
}

function isShortfall(item: LineItem): boolean {
  if (!item.productId) return false;
  return item.quantity > getAvailableStock(item.productId);
}

function getShortfallCount(item: LineItem): number {
  const avail = getAvailableStock(item.productId);
  return Math.max(0, item.quantity - avail);
}

function hasAllocations(item: LineItem): boolean {
  return Array.isArray(item.allocations) && item.allocations.length > 0;
}

// Pickup vouchers modal state after sale creation
const isVouchersModalOpen = ref(false);
const createdSaleData = ref<Sale | null>(null);
const selectedVoucherIndex = ref(0);

const remoteVoucherLines = computed(() => {
  if (!createdSaleData.value || !createdSaleData.value.fulfillmentLines) return [];
  return createdSaleData.value.fulfillmentLines.filter(
    (fl) => fl.fulfillmentWarehouseId !== createdSaleData.value?.warehouseId
  );
});

const selectedClient = computed(() => {
  if (!selectedClientId.value) return null;
  return clientStore.clients.find((c) => c.id === selectedClientId.value) || null;
});

onMounted(async () => {
  await Promise.all([
    productStore.fetchProducts(),
    clientStore.fetchClients({ limit: 500, activeOnly: true }),
    fetchStockForWarehouse(),
    fetchEmployeesForWarehouse(),
  ]);

  // Set default client if available
  if (clientStore.clients.length > 0) {
    const defaultCl = clientStore.clients.find((c) => c.isDefault) || clientStore.clients[0];
    selectedClientId.value = defaultCl.id;
    customerName.value = defaultCl.name;
    customerPhone.value = defaultCl.phone || '';
  }

  if (lineItems.value[0].productId === 0 && productStore.products.length > 0) {
    const firstProd = productStore.products[0];
    lineItems.value[0].productId = firstProd.id;
    lineItems.value[0].unitPrice = firstProd.salePrice;
  }
});

function onClientSelect(cl: Client | null) {
  if (cl) {
    customerName.value = cl.name;
    customerPhone.value = cl.phone || '';
  } else {
    customerName.value = '';
    customerPhone.value = '';
  }
}

watch(selectedClientId, (newId) => {
  if (newId) {
    const cl = clientStore.clients.find((c) => c.id === newId);
    if (cl) {
      customerName.value = cl.name;
      customerPhone.value = cl.phone || '';
      useAdvanceCredit.value = true;
      if (cl.isDefault && paymentCondition.value !== 'FULL_CASH') {
        paymentCondition.value = 'FULL_CASH';
      }
    }
  }
});

async function fetchStockForWarehouse() {
  loading.value = true;
  try {
    const res = await inventoryService.getStock({
      warehouseId: selectedWarehouseId.value,
      limit: 1000,
    });
    warehouseStock.value = res.items;
  } catch (err) {
    console.error('Failed to load stock for warehouse', err);
  } finally {
    loading.value = false;
  }
}

async function fetchEmployeesForWarehouse() {
  try {
    employees.value = await employeeService.getEmployees({
      warehouseId: selectedWarehouseId.value,
      status: 'ACTIVE',
    });
  } catch (err) {
    console.error('Failed to load employees for warehouse', err);
  }
}

function onWarehouseChange() {
  fetchStockForWarehouse();
  fetchEmployeesForWarehouse();
}

function onProductSelect(item: LineItem) {
  const prod = getProductById(item.productId);
  if (prod) {
    item.unitPrice = prod.salePrice;
  }
}

function addLineItem() {
  lineItems.value.push(createLineItem());
}

function removeLineItem(index: number) {
  if (lineItems.value.length > 1) {
    lineItems.value.splice(index, 1);
  }
}

function getProductById(id: number): Product | undefined {
  return productStore.getProductById(id);
}

function getAvailableStock(productId: number): number {
  if (!productId) return 0;
  const stock = warehouseStock.value.find((s) => s.productId === productId);
  return stock ? stock.availableQuantity : 0;
}

const totalAmount = computed(() => {
  return lineItems.value.reduce((sum, item) => {
    const price = item.unitPrice !== undefined && item.unitPrice !== null ? Number(item.unitPrice) : (getProductById(item.productId)?.salePrice || 0);
    return sum + price * (item.quantity || 0);
  }, 0);
});

const clientAvailableAdvance = computed(() => {
  if (!selectedClient.value || selectedClient.value.isDefault) return 0;
  const bal = Number(selectedClient.value.currentBalance || 0);
  return bal < 0 ? Math.abs(bal) : 0;
});

const isAdvanceCreditAvailable = computed(() => {
  return clientAvailableAdvance.value > 0;
});

const effectiveAdvanceDeduction = computed(() => {
  if (!isAdvanceCreditAvailable.value || !useAdvanceCredit.value) {
    return 0;
  }
  return Math.min(totalAmount.value, clientAvailableAdvance.value);
});

const netRemainingAfterAdvance = computed(() => {
  return Math.max(0, totalAmount.value - effectiveAdvanceDeduction.value);
});

const isFullyCoveredByAdvance = computed(() => {
  return effectiveAdvanceDeduction.value > 0 && netRemainingAfterAdvance.value === 0;
});

const calculatedCashPaidAmount = computed(() => {
  if (isFullyCoveredByAdvance.value) {
    return 0;
  }
  if (paymentCondition.value === 'FULL_CASH') {
    return netRemainingAfterAdvance.value;
  }
  if (paymentCondition.value === 'CREDIT') {
    return 0;
  }
  return Math.min(netRemainingAfterAdvance.value, Number(downpaymentAmount.value) || 0);
});

const calculatedPaidAmount = computed(() => {
  return effectiveAdvanceDeduction.value + calculatedCashPaidAmount.value;
});

const calculatedRemainingDebt = computed(() => {
  return Math.max(0, totalAmount.value - calculatedPaidAmount.value);
});

async function handleSubmitSale() {
  errorMessage.value = '';

  const allAllocations: FulfillmentAllocationInput[] = [];

  // Validate items selection, prices, and stock/allocations
  for (const item of lineItems.value) {
    if (!item.productId) {
      errorMessage.value = 'Veuillez sélectionner un produit pour chaque ligne de vente.';
      return;
    }
    if (item.unitPrice === undefined || item.unitPrice === null || Number(item.unitPrice) < 0 || isNaN(Number(item.unitPrice))) {
      errorMessage.value = 'Veuillez saisir un prix unitaire valide (≥ 0 DA) pour chaque ligne.';
      return;
    }
    const avail = getAvailableStock(item.productId);
    const prod = getProductById(item.productId);

    if (item.quantity > avail) {
      if (!item.allocations || item.allocations.length === 0) {
        errorMessage.value = `Stock local insuffisant pour ${prod?.name || 'le produit'}. Disponible : ${avail}, Demandé : ${item.quantity}. Veuillez cliquer sur "Répartir / Transfert Inter-Dépôts".`;
        return;
      }
      const sumAlloc = item.allocations.reduce((s, a) => s + (Number(a.quantity) || 0), 0);
      if (sumAlloc !== item.quantity) {
        errorMessage.value = `La répartition inter-dépôts pour ${prod?.name} (${sumAlloc} u.) ne correspond pas à la quantité demandée (${item.quantity} u.).`;
        return;
      }
    }

    if (item.allocations && item.allocations.length > 0) {
      for (const a of item.allocations) {
        allAllocations.push({
          ...a,
          unitPrice: Number(item.unitPrice),
        });
      }
    }
  }

  if (paymentCondition.value === 'PARTIAL_DOWNPAYMENT' && !isFullyCoveredByAdvance.value) {
    const dp = Number(downpaymentAmount.value);
    const maxAllowed = netRemainingAfterAdvance.value;
    if (isNaN(dp) || dp < 0 || dp > maxAllowed) {
      errorMessage.value = `Le montant de l'acompte doit être compris entre 0 et ${formatCurrency(maxAllowed)}.`;
      return;
    }
  }

  submitting.value = true;
  try {
    const created = await saleService.createSale({
      warehouseId: selectedWarehouseId.value,
      employeeId: selectedEmployeeId.value || undefined,
      clientId: selectedClientId.value || undefined,
      customerName: customerName.value.trim() || undefined,
      customerPhone: customerPhone.value.trim() || undefined,
      saleDate: saleDate.value ? saleDate.value.replace('T', ' ') : undefined,
      paymentCondition: isFullyCoveredByAdvance.value ? 'FULL_CASH' : paymentCondition.value,
      downpaymentAmount: paymentCondition.value === 'PARTIAL_DOWNPAYMENT' ? Number(downpaymentAmount.value) : undefined,
      paymentMethod: paymentMethod.value,
      useAdvanceCredit: isAdvanceCreditAvailable.value ? useAdvanceCredit.value : undefined,
      items: lineItems.value.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
      fulfillmentAllocations: allAllocations.length > 0 ? allAllocations : undefined,
    });

    const remoteLines = created.fulfillmentLines?.filter(
      (fl) => fl.fulfillmentWarehouseId !== selectedWarehouseId.value
    ) || [];

    if (remoteLines.length > 0) {
      createdSaleData.value = created;
      selectedVoucherIndex.value = 0;
      isVouchersModalOpen.value = true;
    } else {
      router.push('/sales');
    }
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || "Échec de l'enregistrement de la vente";
  } finally {
    submitting.value = false;
  }
}

function closeVouchersAndNavigate() {
  isVouchersModalOpen.value = false;
  router.push('/sales');
}
</script>

<template>
  <div class="pos-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Point de Vente & Facturation</h1>
        <p class="text-muted">Émission de nouvelles factures clients avec déduction atomique des stocks et gestion des créances</p>
      </div>
      <div class="header-actions">
        <router-link to="/sales">
          <AppButton variant="secondary">&larr; Retour aux Ventes</AppButton>
        </router-link>
      </div>
    </div>

    <div v-if="authStore.isReadOnly" class="error-alert">
      ⚠️ Votre entrepôt est actuellement inactif. L'émission de nouvelles factures est suspendue (Mode Consultation Seule).
    </div>
    <div v-else-if="errorMessage" class="error-alert">
      {{ errorMessage }}
    </div>

    <form class="pos-layout" @submit.prevent="handleSubmitSale">
      <!-- Left Column: Items Builder -->
      <div class="pos-main card">
        <div class="card-header">
          <h3>Lignes de Produits</h3>
          <button type="button" class="add-row-btn" @click="addLineItem">
            + Ajouter une Ligne de Produit
          </button>
        </div>

        <div class="items-table-wrapper">
          <table class="items-table">
            <thead>
              <tr>
                <th class="col-product">Produit</th>
                <th class="col-avail">Disponible</th>
                <th class="col-price">Prix Unitaire</th>
                <th class="col-qty">Quantité</th>
                <th class="col-subtotal">Sous-total</th>
                <th class="col-action"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(item, idx) in lineItems" :key="item._uid">
                <tr
                  class="item-main-row"
                  :class="{
                    'has-shortfall': isShortfall(item) && !hasAllocations(item),
                    'has-allocations': hasAllocations(item)
                  }"
                >
                  <td class="col-product">
                    <AppProductCombobox
                      v-model="item.productId"
                      :warehouse-stock="warehouseStock"
                      placeholder="Taper nom ou réf (ex: DCD796)..."
                      required
                      @update:model-value="() => onProductSelect(item)"
                    />
                  </td>
                  <td class="col-avail font-mono">
                    <span :class="getAvailableStock(item.productId) < item.quantity ? 'text-danger font-bold' : 'text-success'">
                      {{ formatNumber(getAvailableStock(item.productId)) }} u.
                    </span>
                  </td>
                  <td class="col-price">
                    <input
                      v-model.number="item.unitPrice"
                      type="number"
                      min="0"
                      step="any"
                      class="app-input price-input font-mono"
                      placeholder="0.00"
                      required
                    />
                  </td>
                  <td class="col-qty">
                    <input
                      v-model.number="item.quantity"
                      type="number"
                      min="1"
                      class="app-input qty-input"
                      required
                    />
                  </td>
                  <td class="col-subtotal font-mono font-bold">
                    {{ formatCurrency((item.unitPrice || 0) * (item.quantity || 0)) }}
                  </td>
                  <td class="col-action">
                    <div class="row-actions">
                      <button
                        v-if="item.productId"
                        type="button"
                        class="action-icon-btn transfer-icon-btn"
                        :class="{
                          'is-active': hasAllocations(item),
                          'is-shortfall': isShortfall(item) && !hasAllocations(item),
                          'is-disabled': !isShortfall(item) && !hasAllocations(item)
                        }"
                        :disabled="!isShortfall(item) && !hasAllocations(item)"
                        :title="
                          hasAllocations(item)
                            ? 'Répartition inter-dépôts configurée'
                            : isShortfall(item)
                              ? `Déficit local (-${getShortfallCount(item)} u.) - Transférer depuis un autre dépôt`
                              : 'Stock local suffisant (aucun transfert requis)'
                        "
                        @click="openSplitModal(item)"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                          <polyline points="17 1 21 5 17 9" />
                          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                          <polyline points="7 23 3 19 7 15" />
                          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="action-icon-btn remove-btn"
                        :disabled="lineItems.length <= 1"
                        title="Supprimer cette ligne"
                        @click="removeLineItem(idx)"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- Shortfall / Inter-Warehouse Transfer Sub-row -->
                <tr
                  v-if="item.productId && (isShortfall(item) || hasAllocations(item))"
                  class="item-shortfall-subrow"
                  :class="{
                    'is-warning': isShortfall(item) && !hasAllocations(item),
                    'is-success': hasAllocations(item)
                  }"
                >
                  <td colspan="5" class="col-subrow-status">
                    <div class="shortfall-status-wrap">
                      <span
                        v-if="isShortfall(item) && !hasAllocations(item)"
                        class="shortfall-chip clickable"
                        title="Déficit local - Cliquer pour répartir ou transférer"
                        @click="openSplitModal(item)"
                      >
                        Déficit local (-{{ getShortfallCount(item) }} u.)
                      </span>
                      <span
                        v-else-if="hasAllocations(item)"
                        class="allocated-chip clickable"
                        title="Cliquer pour modifier la répartition"
                        @click="openSplitModal(item)"
                      >
                        ✓ Réparti sur {{ item.allocations?.length }} dépôt{{ (item.allocations?.length || 0) > 1 ? 's' : '' }}
                      </span>
                      <span v-if="isShortfall(item)" class="shortfall-hint">
                        Dispo : {{ formatNumber(getAvailableStock(item.productId)) }} u. &bull; Demandé : {{ item.quantity }} u.
                      </span>
                    </div>
                  </td>
                  <td class="col-subrow-spacer"></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right Column: Summary & Payment -->
      <div class="pos-sidebar card">
        <h3>Détails & Règlement</h3>

        <div class="sidebar-form">
          <!-- Warehouse -->
          <div class="app-input-group">
            <label class="input-label">Entrepôt d'expédition</label>
            <select
              v-model.number="selectedWarehouseId"
              class="app-select"
              :disabled="!authStore.canSwitchWarehouse || authStore.isReadOnly"
              @change="onWarehouseChange"
            >
              <option v-for="w in warehouseStore.activeWarehouses" :key="w.id" :value="w.id">
                {{ w.name }} ({{ w.code }})
              </option>
            </select>
          </div>

          <!-- Employee -->
          <div class="app-input-group">
            <label class="input-label">Agent Commercial / Vendeur</label>
            <select
              v-model.number="selectedEmployeeId"
              class="app-select"
            >
              <option :value="null">-- Non spécifié --</option>
              <option v-for="emp in employees" :key="emp.id" :value="emp.id">
                {{ emp.fullName }} ({{ emp.position }})
              </option>
            </select>
          </div>

          <!-- Date -->
          <div class="app-input-group">
            <label class="input-label">Date de la Vente</label>
            <input
              v-model="saleDate"
              type="datetime-local"
              step="1"
              class="app-input"
              required
            />
          </div>

          <!-- Client Selection -->
          <div class="app-input-group">
            <label class="input-label">Compte Client *</label>
            <AppClientCombobox
              v-model="selectedClientId"
              placeholder="Taper nom, code ou téléphone..."
              @select="onClientSelect"
            />

            <!-- Client Real-time Balance Badge -->
            <div v-if="selectedClient" class="client-balance-box">
              <span class="balance-title">Solde Actuel :</span>
              <strong :class="['balance-amount', selectedClient.currentBalance > 0 ? 'debt' : (selectedClient.currentBalance < 0 ? 'credit' : 'settled')]">
                {{ formatCurrency(selectedClient.currentBalance) }}
              </strong>
              <span v-if="selectedClient.currentBalance < 0" class="advance-notice">
                💡 Avance disponible de {{ formatCurrency(Math.abs(selectedClient.currentBalance)) }}
              </span>
            </div>
          </div>

          <!-- Customer details text -->
          <AppInput
            v-model="customerName"
            label="Nom sur Facture"
            placeholder="Nom du Client"
          />

          <AppInput
            v-model="customerPhone"
            label="Téléphone"
            placeholder="+213 550 00 00 00"
          />

          <!-- Payment Condition Section -->
          <div class="payment-condition-box">
            <label class="input-label font-bold">Conditions de Règlement *</label>

            <!-- Walk-in Cash Only Notice -->
            <div v-if="selectedClient?.isDefault" class="walkin-cash-notice">
              <span>💡 Le <strong>Client Passager</strong> règle obligatoirement au <strong>comptant (100%)</strong>. Les options de crédit/acompte sont réservées aux comptes clients réguliers.</span>
            </div>

            <!-- Advance Credit Banner & Toggle -->
            <div v-else-if="isAdvanceCreditAvailable" class="advance-credit-banner">
              <div class="advance-credit-header">
                <div class="advance-credit-info">
                  <span class="advance-badge">💡 Avoir disponible</span>
                  <strong class="text-success font-mono">{{ formatCurrency(clientAvailableAdvance) }}</strong>
                </div>
                <label class="advance-toggle-label">
                  <input v-model="useAdvanceCredit" type="checkbox" class="advance-checkbox" />
                  <span class="font-bold">Imputer l'avoir disponible sur cette facture</span>
                </label>
              </div>

              <div v-if="useAdvanceCredit" class="advance-deduction-summary">
                <div class="advance-math-row">
                  <span>Total de la facture :</span>
                  <span class="font-mono">{{ formatCurrency(totalAmount) }}</span>
                </div>
                <div class="advance-math-row text-success">
                  <span>Avoir client déduit :</span>
                  <span class="font-mono font-bold">- {{ formatCurrency(effectiveAdvanceDeduction) }}</span>
                </div>
                <div class="advance-math-row highlight-net">
                  <span class="font-bold">Net restant à régler :</span>
                  <span class="font-mono font-bold">{{ formatCurrency(netRemainingAfterAdvance) }}</span>
                </div>
                <div v-if="isFullyCoveredByAdvance" class="advance-covered-pill">
                  ✔ Facture entièrement couverte par l'avoir client. Règlement comptant automatique (Payée à 100%).
                </div>
              </div>

              <div v-else class="advance-optout-warning">
                ⚠️ <strong>Avoir non appliqué :</strong> Le montant total sera traité sans toucher à l'avoir du client. Cette décision sera consignée dans le journal d'audit.
              </div>
            </div>

            <!-- Condition Radios (if not 100% covered by advance credit) -->
            <div v-if="!isFullyCoveredByAdvance" class="condition-radios">
              <label class="condition-radio">
                <input v-model="paymentCondition" type="radio" value="FULL_CASH" />
                <div class="radio-content">
                  <strong>{{ effectiveAdvanceDeduction > 0 ? 'Comptant sur le reste' : 'Comptant (Payé à 100%)' }}</strong>
                  <span>{{ effectiveAdvanceDeduction > 0 ? `Règlement immédiat de ${formatCurrency(netRemainingAfterAdvance)}` : 'Règlement immédiat' }}</span>
                </div>
              </label>

              <label :class="['condition-radio', { 'is-disabled': selectedClient?.isDefault }]">
                <input
                  v-model="paymentCondition"
                  type="radio"
                  value="CREDIT"
                  :disabled="selectedClient?.isDefault"
                />
                <div class="radio-content">
                  <strong>{{ effectiveAdvanceDeduction > 0 ? 'Reste à crédit (Dette)' : 'À Crédit (Non payé)' }}</strong>
                  <span>{{ effectiveAdvanceDeduction > 0 ? `Ajoute ${formatCurrency(netRemainingAfterAdvance)} à la dette client` : 'Ajoute la dette au compte client' }}</span>
                </div>
              </label>

              <label :class="['condition-radio', { 'is-disabled': selectedClient?.isDefault }]">
                <input
                  v-model="paymentCondition"
                  type="radio"
                  value="PARTIAL_DOWNPAYMENT"
                  :disabled="selectedClient?.isDefault"
                />
                <div class="radio-content">
                  <strong>{{ effectiveAdvanceDeduction > 0 ? 'Acompte sur le reste' : 'Acompte (Versement partiel)' }}</strong>
                  <span>Paiement partiel à la caisse</span>
                </div>
              </label>
            </div>

            <!-- Downpayment amount input -->
            <div v-if="paymentCondition === 'PARTIAL_DOWNPAYMENT' && !isFullyCoveredByAdvance" class="downpayment-input-group">
              <label class="input-label">Montant de l'Acompte (DZD) * (Max: {{ formatCurrency(netRemainingAfterAdvance) }})</label>
              <input
                v-model.number="downpaymentAmount"
                type="number"
                min="1"
                :max="netRemainingAfterAdvance"
                step="any"
                placeholder="0.00"
                class="app-input"
                required
              />
            </div>

            <!-- Payment Method (if cash paid > 0) -->
            <div v-if="calculatedCashPaidAmount > 0" class="payment-method-group">
              <label class="input-label">Mode d'Encaissement (pour le versement physique)</label>
              <select v-model="paymentMethod" class="app-select">
                <option value="CASH">Espèces</option>
                <option value="CHECK">Chèque Bancaire</option>
                <option value="BANK_TRANSFER">Virement Bancaire</option>
                <option value="CARD">Carte Bancaire (CIB/Edahabia)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="summary-divider" />

        <div class="summary-totals">
          <div class="summary-row">
            <span>Nombre d'articles :</span>
            <strong>{{ lineItems.length }} {{ lineItems.length > 1 ? 'lignes' : 'ligne' }}</strong>
          </div>
          <div class="summary-row total-highlight">
            <span>Total Facture :</span>
            <span class="font-mono text-h2 font-bold">{{ formatCurrency(totalAmount) }}</span>
          </div>

          <div v-if="effectiveAdvanceDeduction > 0" class="summary-row text-success">
            <span>Imputation Avoir Client :</span>
            <strong class="font-mono font-bold">- {{ formatCurrency(effectiveAdvanceDeduction) }}</strong>
          </div>

          <div v-if="calculatedCashPaidAmount > 0" class="summary-row">
            <span>Versement Immédiat ({{ paymentMethod }}) :</span>
            <strong class="font-mono text-success">{{ formatCurrency(calculatedCashPaidAmount) }}</strong>
          </div>

          <div class="summary-row">
            <span>Total Règlement Vente :</span>
            <strong class="font-mono text-success font-bold">{{ formatCurrency(calculatedPaidAmount) }}</strong>
          </div>

          <div v-if="calculatedRemainingDebt > 0" class="summary-row">
            <span>Créance Restante (Dette) :</span>
            <strong class="text-danger font-bold font-mono">{{ formatCurrency(calculatedRemainingDebt) }}</strong>
          </div>
          <div v-else class="summary-row">
            <span>Reste Dû :</span>
            <strong class="text-success font-bold font-mono">0,00 DZD (Soldée)</strong>
          </div>
        </div>

        <AppButton
          type="submit"
          variant="primary"
          size="lg"
          :disabled="authStore.isReadOnly"
          :loading="submitting"
        >
          Confirmer la Facture ({{ formatCurrency(totalAmount) }})
        </AppButton>
      </div>
    </form>

    <!-- Inter-Warehouse Split Fulfillment Modal -->
    <InterWarehouseSplitModal
      v-if="activeSplitItem && activeSplitItem.productId"
      v-model="isSplitModalOpen"
      :product-id="activeSplitItem.productId"
      :product-name="getProductById(activeSplitItem.productId)?.name || ''"
      :product-reference="getProductById(activeSplitItem.productId)?.reference || ''"
      :requested-quantity="activeSplitItem.quantity"
      :origin-warehouse-id="selectedWarehouseId"
      :origin-warehouse-name="originWarehouseName"
      :initial-allocations="activeSplitItem.allocations"
      @save="onSplitSaved"
    />

    <!-- Pickup Slips (Bon de Retrait) Modal after successful sale -->
    <AppModal
      v-model="isVouchersModalOpen"
      title="Bons de Retrait Inter-Dépôts Générés"
      max-width="840px"
      @close="closeVouchersAndNavigate"
    >
      <div class="vouchers-modal-body">
        <div class="vouchers-alert-success">
          🎉 <strong>Vente validée avec succès !</strong> Des articles doivent être retirés dans d'autres dépôts. Veuillez imprimer le(s) Bon(s) de Retrait à remettre au client.
        </div>

        <div v-if="remoteVoucherLines.length > 1" class="voucher-tabs">
          <button
            v-for="(line, idx) in remoteVoucherLines"
            :key="line.id"
            type="button"
            class="voucher-tab-btn"
            :class="{ active: selectedVoucherIndex === idx }"
            @click="selectedVoucherIndex = idx"
          >
            Bon #{{ idx + 1 }} : {{ line.fulfillmentWarehouseName }} ({{ line.quantity }} u.)
          </button>
        </div>

        <div v-if="remoteVoucherLines[selectedVoucherIndex]" class="voucher-preview-area">
          <PickupSlipDocument
            :line="remoteVoucherLines[selectedVoucherIndex]"
            :sale="createdSaleData || {}"
          />
        </div>
      </div>

      <template #footer>
        <div class="voucher-modal-footer">
          <AppButton variant="secondary" @click="closeVouchersAndNavigate">
            Terminer & Aller aux Ventes &rarr;
          </AppButton>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.pos-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.error-alert {
  background-color: var(--color-danger-bg, rgba(239, 68, 68, 0.1));
  color: var(--color-danger, #ef4444);
  border: 1px solid var(--color-danger-border, rgba(239, 68, 68, 0.3));
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.pos-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}

.pos-main {
  position: relative;
  overflow: visible;
  min-width: 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.add-row-btn {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-primary);
  font-weight: 600;
  font-size: 13px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.add-row-btn:hover {
  background-color: var(--color-primary-subtle, rgba(59, 130, 246, 0.1));
}

.items-table-wrapper {
  overflow: visible;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.items-table th {
  text-align: left;
  padding: 8px 6px;
  color: var(--color-text-secondary);
  font-weight: 600;
  font-size: 12px;
  border-bottom: 1px solid var(--color-border);
}

.items-table td {
  padding: 6px 4px;
  border-bottom: 1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.04));
  vertical-align: middle;
}

.col-product {
  width: 44%;
  min-width: 180px;
}

.col-avail {
  width: 70px;
  min-width: 65px;
  text-align: center;
  white-space: nowrap;
}

.col-price {
  width: 105px;
  min-width: 90px;
}

.col-qty {
  width: 65px;
  min-width: 55px;
}

.col-subtotal {
  width: 110px;
  min-width: 95px;
  text-align: right;
  white-space: nowrap;
}

.col-action {
  width: 72px;
  min-width: 72px;
  text-align: center;
}

.price-input {
  width: 100%;
  height: 38px;
  text-align: right;
  padding: 6px 8px;
}

.qty-input {
  width: 100%;
  height: 38px;
  text-align: center;
  padding: 6px 4px;
}

.remove-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.06);
  color: var(--color-danger, #ef4444);
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 0;
}

.remove-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.16);
  border-color: #ef4444;
}

.remove-btn:disabled {
  opacity: 0.2;
  cursor: not-allowed;
  border-color: transparent;
  background: transparent;
}

.pos-sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pos-sidebar h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.sidebar-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.app-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.app-input,
.app-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 13px;
  background: var(--color-bg);
  color: var(--color-text-primary);
  outline: none;
}

.client-balance-box {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-subtle, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.05));
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  margin-top: 4px;
  font-size: 12px;
}

.balance-title {
  color: var(--color-text-secondary);
  font-size: 11px;
}

.balance-amount {
  font-size: 14px;
  margin: 2px 0;
}

.balance-amount.debt {
  color: #ef4444;
}

.balance-amount.credit {
  color: #10b981;
}

.balance-amount.settled {
  color: #64748b;
}

.advance-notice {
  font-size: 11px;
  color: #10b981;
  font-weight: 500;
}

.payment-condition-box {
  background: var(--color-bg-subtle, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.walkin-cash-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: var(--radius-sm, 6px);
  font-size: 11px;
  color: #1e40af;
  line-height: 1.35;
}

.condition-radios {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.condition-radio {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
  padding: 4px;
  border-radius: 4px;
  transition: all var(--transition-fast);
}

.condition-radio.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background-color: transparent;
}

.condition-radio input {
  margin-top: 3px;
}

.radio-content {
  display: flex;
  flex-direction: column;
}

.radio-content strong {
  color: var(--color-text-primary);
}

.radio-content span {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.downpayment-input-group,
.payment-method-group {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

.summary-totals {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.total-highlight {
  padding: 8px 0;
  border-top: 1px dashed var(--color-border);
  border-bottom: 1px dashed var(--color-border);
}

.debt-breakdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  padding: 6px 8px;
  background: var(--color-bg-subtle);
  border-radius: var(--radius-sm);
}

.font-mono {
  font-family: monospace;
}

.font-bold {
  font-weight: 700;
}

.text-danger {
  color: #ef4444;
}

.text-success {
  color: #10b981;
}

.text-h2 {
  font-size: 18px;
}

.advance-credit-banner {
  background: var(--color-bg-subtle, #f8fafc);
  border: 1px solid #10b981;
  border-radius: var(--radius-md, 8px);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.advance-credit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.advance-credit-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.advance-badge {
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.advance-toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  user-select: none;
}

.advance-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #10b981;
}

.advance-deduction-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--color-bg-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
}

.advance-math-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.highlight-net {
  border-top: 1px dashed var(--color-border, #e2e8f0);
  padding-top: 4px;
  margin-top: 2px;
  color: var(--color-text-primary);
}

.advance-covered-pill {
  background: rgba(16, 185, 129, 0.12);
  color: #065f46;
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  margin-top: 4px;
}

.advance-optout-warning {
  background: rgba(245, 158, 11, 0.12);
  color: #92400e;
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.4;
}

/* Inter-Warehouse Shortfall & Split Indicators */
.item-main-row.has-shortfall td {
  border-bottom: none;
  background: rgba(254, 242, 242, 0.35);
}

.item-main-row.has-allocations td {
  border-bottom: none;
  background: rgba(240, 253, 244, 0.35);
}

.item-shortfall-subrow td {
  padding-top: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.item-shortfall-subrow.is-warning td {
  background: rgba(254, 242, 242, 0.35);
}

.item-shortfall-subrow.is-success td {
  background: rgba(240, 253, 244, 0.35);
}

.col-subrow-status {
  padding-left: 8px;
  vertical-align: middle;
}

.shortfall-status-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.shortfall-chip {
  background: #fee2e2;
  color: #dc2626;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid #fca5a5;
  letter-spacing: 0.2px;
}

.allocated-chip {
  background: #dcfce7;
  color: #15803d;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid #86efac;
}

.shortfall-hint {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}

.col-subrow-action {
  padding: 2px 4px 6px 4px;
  vertical-align: middle;
}

.col-subrow-spacer {
  width: 72px;
  min-width: 72px;
}

.btn-split-modal-trigger {
  width: 100%;
  height: 34px;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1.5px solid #93c5fd;
  font-size: 12px;
  font-weight: 600;
  padding: 0 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.08);
}

.btn-split-modal-trigger:hover {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
  transform: translateY(-1px);
}

.btn-split-modal-trigger:active {
  transform: translateY(0);
}

.btn-split-modal-trigger.is-allocated {
  background: #f0fdf4;
  color: #15803d;
  border-color: #86efac;
  box-shadow: 0 1px 2px rgba(22, 163, 74, 0.08);
}

.btn-split-modal-trigger.is-allocated:hover {
  background: #16a34a;
  color: #ffffff;
  border-color: #16a34a;
  box-shadow: 0 2px 6px rgba(22, 163, 74, 0.25);
}

.trigger-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.action-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  background: transparent;
  padding: 0;
}

.transfer-icon-btn {
  color: #64748b;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
}

.transfer-icon-btn:hover:not(:disabled) {
  background: #eff6ff;
  color: #2563eb;
  border-color: #93c5fd;
}

.transfer-icon-btn:disabled {
  opacity: 0.28;
  cursor: not-allowed;
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #94a3b8;
  pointer-events: auto;
}

.transfer-icon-btn:disabled:hover {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #94a3b8;
  transform: none;
  box-shadow: none;
}

.transfer-icon-btn.is-shortfall {
  color: #dc2626;
  background: #fee2e2;
  border-color: #fca5a5;
  cursor: pointer;
}

.transfer-icon-btn.is-shortfall:hover:not(:disabled) {
  background: #fecaca;
  border-color: #f87171;
  color: #b91c1c;
}

.transfer-icon-btn.is-active {
  color: #15803d;
  background: #dcfce7;
  border-color: #86efac;
  cursor: pointer;
}

.transfer-icon-btn.is-active:hover:not(:disabled) {
  background: #bbf7d0;
  border-color: #4ade80;
  color: #166534;
}

.shortfall-chip.clickable,
.allocated-chip.clickable {
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}

.shortfall-chip.clickable:hover {
  background: #fecaca;
  border-color: #f87171;
  color: #b91c1c;
}

.allocated-chip.clickable:hover {
  background: #bbf7d0;
  border-color: #4ade80;
}

/* Pickup Slips Modal */
.vouchers-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.vouchers-alert-success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
}

.voucher-tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
  overflow-x: auto;
}

.voucher-tab-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.voucher-tab-btn.active {
  background: #1e3a8a;
  color: white;
  border-color: #1e3a8a;
}

.voucher-preview-area {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  max-height: 520px;
  overflow-y: auto;
}

.voucher-modal-footer {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style>
