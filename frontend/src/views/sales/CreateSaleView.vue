<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { useProductStore } from '../../stores/product.store';
import { useClientStore } from '../../stores/client.store';
import { saleService, inventoryService } from '../../services/operations.service';
import { employeeService } from '../../services/admin-reports.service';
import type { Product, Stock, Employee, Client } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import AppButton from '../../components/common/AppButton.vue';
import AppInput from '../../components/common/AppInput.vue';
import AppProductCombobox from '../../components/common/AppProductCombobox.vue';

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
  productId: number;
  quantity: number;
  unitPrice: number;
}

const lineItems = ref<LineItem[]>([
  { productId: 0, quantity: 1, unitPrice: 0 },
]);

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

watch(selectedClientId, (newId) => {
  if (newId) {
    const cl = clientStore.clients.find((c) => c.id === newId);
    if (cl) {
      customerName.value = cl.name;
      customerPhone.value = cl.phone || '';
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
  lineItems.value.push({
    productId: 0,
    quantity: 1,
    unitPrice: 0,
  });
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

const calculatedPaidAmount = computed(() => {
  if (paymentCondition.value === 'FULL_CASH') {
    return totalAmount.value;
  }
  if (paymentCondition.value === 'CREDIT') {
    return 0;
  }
  return Math.min(totalAmount.value, Number(downpaymentAmount.value) || 0);
});

const calculatedRemainingDebt = computed(() => {
  return Math.max(0, totalAmount.value - calculatedPaidAmount.value);
});

async function handleSubmitSale() {
  errorMessage.value = '';

  // Validate items selection, prices, and stock
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
      errorMessage.value = `Stock insuffisant pour ${prod?.name || 'le produit'}. Disponible : ${avail}, Demandé : ${item.quantity}`;
      return;
    }
  }

  if (paymentCondition.value === 'PARTIAL_DOWNPAYMENT') {
    const dp = Number(downpaymentAmount.value);
    if (isNaN(dp) || dp < 0 || dp > totalAmount.value) {
      errorMessage.value = `Le montant de l'acompte doit être compris entre 0 et ${formatCurrency(totalAmount.value)}.`;
      return;
    }
  }

  submitting.value = true;
  try {
    await saleService.createSale({
      warehouseId: selectedWarehouseId.value,
      employeeId: selectedEmployeeId.value || undefined,
      clientId: selectedClientId.value || undefined,
      customerName: customerName.value.trim() || undefined,
      customerPhone: customerPhone.value.trim() || undefined,
      saleDate: saleDate.value ? saleDate.value.replace('T', ' ') : undefined,
      paymentCondition: paymentCondition.value,
      downpaymentAmount: paymentCondition.value === 'PARTIAL_DOWNPAYMENT' ? Number(downpaymentAmount.value) : undefined,
      paymentMethod: paymentMethod.value,
      items: lineItems.value.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
    });

    router.push('/sales');
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || "Échec de l'enregistrement de la vente";
  } finally {
    submitting.value = false;
  }
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
              <tr v-for="(item, idx) in lineItems" :key="idx">
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
                  <button
                    type="button"
                    class="remove-btn"
                    :disabled="lineItems.length <= 1"
                    title="Supprimer cette ligne"
                    @click="removeLineItem(idx)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </td>
              </tr>
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
            <select v-model.number="selectedClientId" class="app-select">
              <option v-for="cl in clientStore.clients" :key="cl.id" :value="cl.id">
                {{ cl.name }} ({{ cl.code }})
              </option>
            </select>

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

            <div class="condition-radios">
              <label class="condition-radio">
                <input v-model="paymentCondition" type="radio" value="FULL_CASH" />
                <div class="radio-content">
                  <strong>Comptant (Payé à 100%)</strong>
                  <span>Règlement immédiat</span>
                </div>
              </label>

              <label class="condition-radio">
                <input v-model="paymentCondition" type="radio" value="CREDIT" />
                <div class="radio-content">
                  <strong>À Crédit (Non payé)</strong>
                  <span>Ajoute la dette au compte client</span>
                </div>
              </label>

              <label class="condition-radio">
                <input v-model="paymentCondition" type="radio" value="PARTIAL_DOWNPAYMENT" />
                <div class="radio-content">
                  <strong>Acompte (Versement partiel)</strong>
                  <span>Paiement partiel à la caisse</span>
                </div>
              </label>
            </div>

            <!-- Downpayment amount input -->
            <div v-if="paymentCondition === 'PARTIAL_DOWNPAYMENT'" class="downpayment-input-group">
              <label class="input-label">Montant de l'Acompte (DZD) *</label>
              <input
                v-model.number="downpaymentAmount"
                type="number"
                min="1"
                :max="totalAmount"
                step="any"
                placeholder="0.00"
                class="app-input"
                required
              />
            </div>

            <!-- Payment Method (if paid > 0) -->
            <div v-if="paymentCondition !== 'CREDIT'" class="payment-method-group">
              <label class="input-label">Mode d'Encaissement</label>
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

          <div v-if="paymentCondition !== 'FULL_CASH'" class="debt-breakdown">
            <div class="summary-row">
              <span>Montant Payé Immédiat :</span>
              <strong class="text-success">{{ formatCurrency(calculatedPaidAmount) }}</strong>
            </div>
            <div class="summary-row">
              <span>Créance Restante (Dette) :</span>
              <strong class="text-danger font-bold">{{ formatCurrency(calculatedRemainingDebt) }}</strong>
            </div>
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
  width: 36px;
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
</style>
