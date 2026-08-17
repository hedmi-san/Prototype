<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { inventoryService } from '../../services/operations.service';
import { productService } from '../../services/catalog.service';
import type { Stock, Product } from '../../types';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';

const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();

const stockList = ref<Stock[]>([]);
const products = ref<Product[]>([]);
const loading = ref(true);
const searchQuery = ref('');

// Adjustment Modal
const showAdjustModal = ref(false);
const adjustForm = ref({
  warehouseId: 0,
  productId: 0,
  quantity: 0,
  reason: '',
});
const adjustStockTarget = ref<Stock | null>(null);

// Initial Stock Receipt Modal
const showReceiptModal = ref(false);
const receiptForm = ref({
  warehouseId: 0,
  productId: 0,
  quantity: 1,
  reference: '',
  notes: '',
});

const saving = ref(false);
const errorMessage = ref('');

onMounted(async () => {
  await Promise.all([fetchStock(), fetchProducts()]);
});

async function fetchStock() {
  loading.value = true;
  try {
    stockList.value = await inventoryService.getStock(authStore.activeWarehouseId || undefined);
  } catch (err) {
    console.error('Failed to load stock', err);
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

const filteredStock = computed(() => {
  if (!searchQuery.value.trim()) return stockList.value;
  const q = searchQuery.value.toLowerCase();
  return stockList.value.filter(
    (s) =>
      s.productName.toLowerCase().includes(q) ||
      s.productReference.toLowerCase().includes(q) ||
      s.warehouseName.toLowerCase().includes(q)
  );
});

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

function openReceiptModal() {
  receiptForm.value = {
    warehouseId: authStore.activeWarehouseId || warehouseStore.warehouses[0]?.id || 1,
    productId: products.value[0]?.id || 1,
    quantity: 10,
    reference: `REC-${Date.now().toString().slice(-6)}`,
    notes: '',
  };
  errorMessage.value = '';
  showReceiptModal.value = true;
}

async function handleSaveAdjustment() {
  if (!adjustForm.value.reason.trim()) {
    errorMessage.value = 'A mandatory reason is required for manual stock adjustments';
    return;
  }
  if (adjustForm.value.quantity === 0) {
    errorMessage.value = 'Adjustment quantity cannot be 0';
    return;
  }

  saving.value = true;
  errorMessage.value = '';
  try {
    await inventoryService.adjustStock(adjustForm.value);
    showAdjustModal.value = false;
    await fetchStock();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Failed to adjust stock';
  } finally {
    saving.value = false;
  }
}

async function handleSaveReceipt() {
  if (!receiptForm.value.reference.trim()) {
    errorMessage.value = 'Batch / Shipment reference is required';
    return;
  }

  saving.value = true;
  errorMessage.value = '';
  try {
    await inventoryService.receiveInitialStock(receiptForm.value);
    showReceiptModal.value = false;
    await fetchStock();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Failed to receive stock';
  } finally {
    saving.value = false;
  }
}

function formatCurrency(val?: number) {
  if (val === undefined || val === null) return '0.00 DZD';
  return new Intl.NumberFormat('fr-DZ', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val) + ' DZD';
}
</script>

<template>
  <div class="inventory-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Warehouse Inventory</h1>
        <p class="text-muted">Real-time physical, reserved, and available stock levels</p>
      </div>
      <div class="header-actions">
        <AppButton variant="secondary" @click="openReceiptModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Receive Stock Inflow
        </AppButton>
      </div>
    </div>

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
          placeholder="Search inventory by reference, product, warehouse..."
          class="search-input"
        />
      </div>
      <div class="count-badge text-muted font-mono">
        {{ filteredStock.length }} stock entries
      </div>
    </div>

    <!-- Stock Table -->
    <AppTable :loading="loading" :empty="!filteredStock.length" empty-text="No stock records found" :columns-count="8">
      <template #header>
        <th>Warehouse</th>
        <th>Reference</th>
        <th>Product</th>
        <th>Physical Qty</th>
        <th>Reserved Qty</th>
        <th>Available Qty</th>
        <th>Valuation</th>
        <th>Actions</th>
      </template>
      <template #body>
        <tr v-for="stock in filteredStock" :key="stock.id">
          <td>
            <strong>{{ stock.warehouseName }}</strong>
            <span class="text-caption" style="display: block;">{{ stock.warehouseCode }}</span>
          </td>
          <td class="font-mono font-bold">{{ stock.productReference }}</td>
          <td>
            <strong>{{ stock.productName }}</strong>
            <span class="text-caption text-muted" style="display: block;">Brand: {{ stock.productBrand }}</span>
          </td>
          <td class="font-mono font-bold">{{ stock.physicalQuantity }}</td>
          <td class="font-mono text-muted">
            <span v-if="stock.reservedQuantity > 0" class="reserved-pill">
              {{ stock.reservedQuantity }} reserved
            </span>
            <span v-else>0</span>
          </td>
          <td>
            <div class="available-cell">
              <span class="font-mono font-bold">{{ stock.availableQuantity }}</span>
              <AppBadge
                v-if="stock.availableQuantity === 0"
                variant="danger"
                size="sm"
              >
                OUT OF STOCK
              </AppBadge>
              <AppBadge
                v-else-if="stock.availableQuantity <= 10"
                variant="warning"
                size="sm"
              >
                LOW
              </AppBadge>
            </div>
          </td>
          <td class="font-mono">{{ formatCurrency(stock.totalValuation) }}</td>
          <td>
            <button
              class="icon-action-btn"
              title="Manual Stock Adjustment"
              @click="openAdjustModal(stock)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Adjust
            </button>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Stock Adjustment Modal -->
    <AppModal
      v-model="showAdjustModal"
      :title="`Manual Adjustment: ${adjustStockTarget?.productName || ''}`"
      max-width="480px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <div class="adjust-info-box mb-3">
        <div class="info-item">
          <span class="info-label">Warehouse:</span>
          <strong>{{ adjustStockTarget?.warehouseName }}</strong>
        </div>
        <div class="info-item">
          <span class="info-label">Physical Stock:</span>
          <strong class="font-mono">{{ adjustStockTarget?.physicalQuantity }}</strong>
        </div>
        <div class="info-item">
          <span class="info-label">Reserved for Transfers:</span>
          <strong class="font-mono">{{ adjustStockTarget?.reservedQuantity }}</strong>
        </div>
        <div class="info-item">
          <span class="info-label">Currently Available:</span>
          <strong class="font-mono text-success">{{ adjustStockTarget?.availableQuantity }}</strong>
        </div>
      </div>

      <form class="modal-form" @submit.prevent="handleSaveAdjustment">
        <AppInput
          v-model="adjustForm.quantity"
          type="number"
          label="Adjustment Delta Quantity (+ or -)"
          hint="Positive number to add stock, negative to deduct stock"
          required
        />

        <div class="app-input-group">
          <label class="input-label">
            Mandatory Adjustment Reason
            <span class="required-star">*</span>
          </label>
          <textarea
            v-model="adjustForm.reason"
            rows="3"
            class="app-textarea"
            placeholder="Document mandatory audit justification (e.g. Annual physical inventory recount, damaged unit replacement)..."
            required
          />
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showAdjustModal = false">Cancel</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveAdjustment">
          Apply Adjustment
        </AppButton>
      </template>
    </AppModal>

    <!-- Initial Receipt Modal -->
    <AppModal
      v-model="showReceiptModal"
      title="Record Manufacturer Stock Inflow"
      max-width="500px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleSaveReceipt">
        <div class="app-input-group">
          <label class="input-label">Destination Warehouse</label>
          <select v-model="receiptForm.warehouseId" class="app-select" required>
            <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
              {{ w.name }} ({{ w.code }})
            </option>
          </select>
        </div>

        <div class="app-input-group">
          <label class="input-label">Product</label>
          <select v-model="receiptForm.productId" class="app-select" required>
            <option v-for="p in products" :key="p.id" :value="p.id">
              [{{ p.reference }}] {{ p.name }}
            </option>
          </select>
        </div>

        <AppInput
          v-model="receiptForm.quantity"
          type="number"
          label="Inflow Quantity"
          placeholder="e.g. 50"
          required
        />

        <AppInput
          v-model="receiptForm.reference"
          label="Shipment / Batch Reference"
          placeholder="e.g. SHIP-ALG-2026-08"
          required
        />

        <AppInput
          v-model="receiptForm.notes"
          label="Notes / Supplier Info"
          placeholder="e.g. Direct factory delivery Container #4"
        />
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showReceiptModal = false">Cancel</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveReceipt">
          Confirm Inflow Receipt
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
