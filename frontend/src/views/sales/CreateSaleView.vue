<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { productService } from '../../services/catalog.service';
import { saleService, inventoryService } from '../../services/operations.service';
import type { Product, Stock } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import AppButton from '../../components/common/AppButton.vue';
import AppInput from '../../components/common/AppInput.vue';

const router = useRouter();
const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();

const products = ref<Product[]>([]);
const warehouseStock = ref<Stock[]>([]);
const loading = ref(true);
const submitting = ref(false);
const errorMessage = ref('');

const selectedWarehouseId = ref<number>(
  authStore.activeWarehouseId || warehouseStore.warehouses[0]?.id || 1
);
const customerName = ref('');
const customerPhone = ref('');

interface LineItem {
  productId: number;
  quantity: number;
}

const lineItems = ref<LineItem[]>([
  { productId: 0, quantity: 1 },
]);

onMounted(async () => {
  await Promise.all([fetchProducts(), fetchStockForWarehouse()]);
  if (products.value.length > 0) {
    lineItems.value[0].productId = products.value[0].id;
  }
});

async function fetchProducts() {
  try {
    products.value = await productService.getProducts();
  } catch (err) {
    console.error('Failed to load products', err);
  }
}

async function fetchStockForWarehouse() {
  loading.value = true;
  try {
    warehouseStock.value = await inventoryService.getStock(selectedWarehouseId.value);
  } catch (err) {
    console.error('Failed to load stock for warehouse', err);
  } finally {
    loading.value = false;
  }
}

function onWarehouseChange() {
  fetchStockForWarehouse();
}

function addLineItem() {
  if (products.value.length > 0) {
    lineItems.value.push({
      productId: products.value[0].id,
      quantity: 1,
    });
  }
}

function removeLineItem(index: number) {
  if (lineItems.value.length > 1) {
    lineItems.value.splice(index, 1);
  }
}

function getProductById(id: number): Product | undefined {
  return products.value.find((p) => p.id === id);
}

function getAvailableStock(productId: number): number {
  const stock = warehouseStock.value.find((s) => s.productId === productId);
  return stock ? stock.availableQuantity : 0;
}

const totalAmount = computed(() => {
  return lineItems.value.reduce((sum, item) => {
    const prod = getProductById(item.productId);
    const price = prod ? prod.salePrice : 0;
    return sum + price * (item.quantity || 0);
  }, 0);
});

async function handleSubmitSale() {
  errorMessage.value = '';

  // Validate items and stock
  for (const item of lineItems.value) {
    const avail = getAvailableStock(item.productId);
    const prod = getProductById(item.productId);
    if (item.quantity > avail) {
      errorMessage.value = `Stock insuffisant pour ${prod?.name || 'le produit'}. Disponible : ${avail}, Demandé : ${item.quantity}`;
      return;
    }
  }

  submitting.value = true;
  try {
    await saleService.createSale({
      warehouseId: selectedWarehouseId.value,
      customerName: customerName.value.trim() || undefined,
      customerPhone: customerPhone.value.trim() || undefined,
      items: lineItems.value.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
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
        <h1 class="page-title">Point de Vente & Facturation (Caisse)</h1>
        <p class="text-muted">Émission de nouvelles factures clients avec déduction atomique des stocks</p>
      </div>
      <div class="header-actions">
        <router-link to="/sales">
          <AppButton variant="secondary">&larr; Retour aux Ventes</AppButton>
        </router-link>
      </div>
    </div>

    <div v-if="errorMessage" class="error-alert">
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
                <th>Produit</th>
                <th>Disponible</th>
                <th>Prix Unitaire</th>
                <th style="width: 100px;">Quantité</th>
                <th>Sous-total</th>
                <th style="width: 40px;"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in lineItems" :key="idx">
                <td>
                  <select v-model.number="item.productId" class="app-select" required>
                    <option v-for="p in products" :key="p.id" :value="p.id">
                      [{{ p.reference }}] {{ p.name }} ({{ p.brand }})
                    </option>
                  </select>
                </td>
                <td class="font-mono">
                  <span :class="getAvailableStock(item.productId) < item.quantity ? 'text-danger font-bold' : 'text-success'">
                    {{ formatNumber(getAvailableStock(item.productId)) }} unités
                  </span>
                </td>
                <td class="font-mono">
                  {{ formatCurrency(getProductById(item.productId)?.salePrice) }}
                </td>
                <td>
                  <input
                    v-model.number="item.quantity"
                    type="number"
                    min="1"
                    class="app-input qty-input"
                    required
                  />
                </td>
                <td class="font-mono font-bold">
                  {{ formatCurrency((getProductById(item.productId)?.salePrice || 0) * (item.quantity || 0)) }}
                </td>
                <td>
                  <button
                    type="button"
                    class="remove-btn"
                    :disabled="lineItems.length <= 1"
                    @click="removeLineItem(idx)"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right Column: Summary & Confirmation -->
      <div class="pos-sidebar card">
        <h3>Détails de la Facture</h3>

        <div class="sidebar-form">
          <div class="app-input-group">
            <label class="input-label">Entrepôt</label>
            <select
              v-model.number="selectedWarehouseId"
              class="app-select"
              :disabled="!authStore.canSwitchWarehouse"
              @change="onWarehouseChange"
            >
              <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
                {{ w.name }} ({{ w.code }})
              </option>
            </select>
          </div>

          <AppInput
            v-model="customerName"
            label="Nom du Client"
            placeholder="Client SARL / Nom du particulier"
          />

          <AppInput
            v-model="customerPhone"
            label="Téléphone du Client"
            placeholder="+213 550 00 00 00"
          />
        </div>

        <div class="summary-divider" />

        <div class="summary-totals">
          <div class="summary-row">
            <span>Nombre d'articles :</span>
            <strong>{{ lineItems.length }} {{ lineItems.length > 1 ? 'lignes' : 'ligne' }}</strong>
          </div>
          <div class="summary-row total-highlight">
            <span>Total à Payer :</span>
            <span class="font-mono text-h2 font-bold">{{ formatCurrency(totalAmount) }}</span>
          </div>
        </div>

        <AppButton
          type="submit"
          variant="primary"
          size="lg"
          :loading="submitting"
        >
          Confirmer & Émettre la Facture
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
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.pos-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
  align-items: start;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.add-row-btn {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.add-row-btn:hover {
  background-color: var(--color-surface-hover);
}

.items-table-wrapper {
  overflow-x: auto;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.items-table th {
  padding: 10px 12px;
  background-color: var(--color-surface);
  text-align: left;
  font-size: 11px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--color-border);
}

.items-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-subtle);
  vertical-align: middle;
}

.app-select {
  width: 100%;
  height: 38px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  font-size: 13px;
  outline: none;
}

.app-select:focus {
  border-color: var(--color-primary);
}

.qty-input {
  width: 90px;
}

.remove-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px 8px;
}

.remove-btn:hover:not(:disabled) {
  color: var(--color-danger);
}

.font-bold {
  font-weight: 600;
}

.text-danger {
  color: var(--color-danger);
}

.text-success {
  color: var(--color-success);
}

/* Sidebar */
.pos-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sidebar-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-divider {
  height: 1px;
  background-color: var(--color-border);
}

.summary-totals {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.total-highlight {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-border);
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
}

@media (max-width: 960px) {
  .pos-layout {
    grid-template-columns: 1fr;
  }
}
</style>
