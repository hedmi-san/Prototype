<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { transferService } from '../../services/operations.service';
import { productService } from '../../services/catalog.service';
import type { Transfer, Product, Warehouse } from '../../types';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';
import ConfirmDialog from '../../components/common/ConfirmDialog.vue';

const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();

const transfers = ref<Transfer[]>([]);
const products = ref<Product[]>([]);
const loading = ref(true);

// Request Transfer Modal
const showCreateModal = ref(false);
const createForm = ref({
  sourceWarehouseId: 0,
  destinationWarehouseId: 0,
  notes: '',
  items: [{ productId: 0, requestedQuantity: 5 }],
});

// Approve Transfer Modal
const showApproveModal = ref(false);
const approvingTransfer = ref<Transfer | null>(null);
const approveForm = ref<{ productId: number; approvedQuantity: number }[]>([]);

// Transfer Details Modal
const showDetailsModal = ref(false);
const selectedTransfer = ref<Transfer | null>(null);

// Cancel Confirm Dialog
const showCancelDialog = ref(false);
const cancellingTransfer = ref<Transfer | null>(null);

const saving = ref(false);
const errorMessage = ref('');

onMounted(async () => {
  await Promise.all([fetchTransfers(), fetchProducts()]);
});

async function fetchTransfers() {
  loading.value = true;
  try {
    transfers.value = await transferService.getTransfers(authStore.activeWarehouseId || undefined);
  } catch (err) {
    console.error('Failed to load transfers', err);
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

function openCreateModal() {
  const warehouses = warehouseStore.warehouses;
  const destId = authStore.activeWarehouseId || warehouses[0]?.id || 1;
  const sourceId = warehouses.find((w) => w.id !== destId)?.id || 2;

  createForm.value = {
    sourceWarehouseId: sourceId,
    destinationWarehouseId: destId,
    notes: '',
    items: [{ productId: products.value[0]?.id || 1, requestedQuantity: 5 }],
  };
  errorMessage.value = '';
  showCreateModal.value = true;
}

function addCreateItem() {
  if (products.value.length > 0) {
    createForm.value.items.push({
      productId: products.value[0].id,
      requestedQuantity: 5,
    });
  }
}

function removeCreateItem(index: number) {
  if (createForm.value.items.length > 1) {
    createForm.value.items.splice(index, 1);
  }
}

async function handleSaveCreate() {
  if (createForm.value.sourceWarehouseId === createForm.value.destinationWarehouseId) {
    errorMessage.value = 'Source and destination warehouses must be different';
    return;
  }

  saving.value = true;
  errorMessage.value = '';
  try {
    await transferService.createTransfer(createForm.value);
    showCreateModal.value = false;
    await fetchTransfers();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Failed to create transfer request';
  } finally {
    saving.value = false;
  }
}

function openApproveModal(t: Transfer) {
  approvingTransfer.value = t;
  approveForm.value = t.items.map((i) => ({
    productId: i.productId,
    approvedQuantity: i.requestedQuantity, // Default full approval
  }));
  errorMessage.value = '';
  showApproveModal.value = true;
}

async function handleSaveApprove() {
  if (!approvingTransfer.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    await transferService.approveTransfer(approvingTransfer.value.id, {
      items: approveForm.value,
    });
    showApproveModal.value = false;
    await fetchTransfers();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Failed to approve transfer';
  } finally {
    saving.value = false;
  }
}

async function handleConfirmReception(t: Transfer) {
  loading.value = true;
  try {
    await transferService.confirmTransfer(t.id);
    await fetchTransfers();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Failed to confirm transfer');
  } finally {
    loading.value = false;
  }
}

async function handleDecline(t: Transfer) {
  loading.value = true;
  try {
    await transferService.declineTransfer(t.id);
    await fetchTransfers();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Failed to decline transfer');
  } finally {
    loading.value = false;
  }
}

function promptCancel(t: Transfer) {
  cancellingTransfer.value = t;
  showCancelDialog.value = true;
}

async function handleConfirmCancel() {
  if (!cancellingTransfer.value) return;
  saving.value = true;
  try {
    await transferService.cancelTransfer(cancellingTransfer.value.id);
    showCancelDialog.value = false;
    await fetchTransfers();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Failed to cancel transfer');
  } finally {
    saving.value = false;
  }
}

function viewDetails(t: Transfer) {
  selectedTransfer.value = t;
  showDetailsModal.value = true;
}

function getStatusBadgeVariant(status: string): 'neutral' | 'success' | 'danger' | 'warning' | 'info' {
  switch (status) {
    case 'REQUESTED': return 'warning';
    case 'APPROVED': return 'info';
    case 'CONFIRMED': return 'success';
    case 'DECLINED': return 'danger';
    case 'CANCELLED': return 'neutral';
    default: return 'neutral';
  }
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-DZ', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div class="transfers-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Inter-Warehouse Transfers</h1>
        <p class="text-muted">Stock transfer requests, source reservations, and reception confirmations</p>
      </div>
      <div class="header-actions">
        <AppButton variant="primary" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Request Stock Transfer
        </AppButton>
      </div>
    </div>

    <!-- Transfers Table -->
    <AppTable :loading="loading" :empty="!transfers.length" empty-text="No transfers recorded" :columns-count="7">
      <template #header>
        <th>Transfer ID</th>
        <th>Source Warehouse</th>
        <th>Destination</th>
        <th>Status</th>
        <th>Requested Date</th>
        <th>Confirmed Date</th>
        <th>Actions</th>
      </template>
      <template #body>
        <tr v-for="t in transfers" :key="t.id">
          <td class="font-mono font-bold">#TRF-{{ t.id }}</td>
          <td>
            <strong>{{ t.sourceWarehouseName }}</strong>
            <span class="text-caption" style="display: block;">{{ t.sourceWarehouseCode }}</span>
          </td>
          <td>
            <strong>{{ t.destinationWarehouseName }}</strong>
            <span class="text-caption" style="display: block;">{{ t.destinationWarehouseCode }}</span>
          </td>
          <td>
            <AppBadge :variant="getStatusBadgeVariant(t.status)" size="sm">
              {{ t.status }}
            </AppBadge>
          </td>
          <td class="font-mono text-caption">{{ formatDate(t.createdAt) }}</td>
          <td class="font-mono text-caption">{{ formatDate(t.confirmedAt) }}</td>
          <td>
            <div class="action-buttons">
              <button class="icon-action-btn" title="View Details" @click="viewDetails(t)">
                Details
              </button>

              <!-- Source Warehouse Action: Approve or Decline -->
              <template v-if="t.status === 'REQUESTED'">
                <button class="icon-action-btn btn-primary-action" @click="openApproveModal(t)">
                  Approve
                </button>
                <button class="icon-action-btn btn-danger-action" @click="handleDecline(t)">
                  Decline
                </button>
              </template>

              <!-- Destination Warehouse Action: Confirm Reception -->
              <template v-if="t.status === 'APPROVED'">
                <button class="icon-action-btn btn-success-action" @click="handleConfirmReception(t)">
                  Confirm Reception
                </button>
              </template>

              <!-- Cancelable before confirmed -->
              <template v-if="t.status === 'REQUESTED' || t.status === 'APPROVED'">
                <button class="icon-action-btn btn-danger-action" @click="promptCancel(t)">
                  Cancel
                </button>
              </template>
            </div>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Create Transfer Modal -->
    <AppModal
      v-model="showCreateModal"
      title="Create Inter-Warehouse Transfer Request"
      max-width="600px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <div class="modal-form">
        <div class="form-row">
          <div class="app-input-group">
            <label class="input-label">Source Warehouse (From)</label>
            <select v-model.number="createForm.sourceWarehouseId" class="app-select" required>
              <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
                {{ w.name }} ({{ w.code }})
              </option>
            </select>
          </div>

          <div class="app-input-group">
            <label class="input-label">Destination Warehouse (To)</label>
            <select v-model.number="createForm.destinationWarehouseId" class="app-select" required>
              <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
                {{ w.name }} ({{ w.code }})
              </option>
            </select>
          </div>
        </div>

        <AppInput
          v-model="createForm.notes"
          label="Transfer Request Notes"
          placeholder="e.g. Urgent restock for heavy project client"
        />

        <div class="items-editor">
          <div class="editor-header">
            <h4>Requested Products</h4>
            <button type="button" class="icon-action-btn" @click="addCreateItem">
              + Add Product
            </button>
          </div>

          <div v-for="(item, idx) in createForm.items" :key="idx" class="item-row">
            <select v-model.number="item.productId" class="app-select item-product-select" required>
              <option v-for="p in products" :key="p.id" :value="p.id">
                [{{ p.reference }}] {{ p.name }}
              </option>
            </select>
            <input
              v-model.number="item.requestedQuantity"
              type="number"
              min="1"
              class="app-input item-qty-input"
              placeholder="Qty"
              required
            />
            <button
              type="button"
              class="icon-action-btn btn-danger-action"
              :disabled="createForm.items.length <= 1"
              @click="removeCreateItem(idx)"
            >
              &times;
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="showCreateModal = false">Cancel</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveCreate">
          Submit Transfer Request
        </AppButton>
      </template>
    </AppModal>

    <!-- Approve Transfer Modal -->
    <AppModal
      v-model="showApproveModal"
      :title="`Approve & Reserve Stock for Transfer #${approvingTransfer?.id || ''}`"
      max-width="540px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <p class="text-caption text-muted mb-3">
        Approving this transfer will lock and reserve the specified units at <strong>{{ approvingTransfer?.sourceWarehouseName }}</strong>. Stock is not physically removed until reception is confirmed.
      </p>

      <div class="approve-items-list">
        <div v-for="item in approvingTransfer?.items" :key="item.id" class="approve-item-row">
          <div class="item-meta">
            <strong>{{ item.productName }}</strong>
            <span class="text-caption font-mono">{{ item.productReference }} (Requested: {{ item.requestedQuantity }} units)</span>
          </div>
          <div class="item-input">
            <label class="input-label">Approved Qty</label>
            <input
              v-model.number="approveForm.find(f => f.productId === item.productId)!.approvedQuantity"
              type="number"
              min="0"
              :max="item.requestedQuantity"
              class="app-input item-qty-input"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="showApproveModal = false">Cancel</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveApprove">
          Confirm Approval & Reserve Stock
        </AppButton>
      </template>
    </AppModal>

    <!-- Transfer Details Modal -->
    <AppModal
      v-model="showDetailsModal"
      :title="`Transfer Request Details #${selectedTransfer?.id || ''}`"
      max-width="580px"
    >
      <div v-if="selectedTransfer" class="details-box">
        <div class="details-grid">
          <div>
            <span class="text-caption text-muted">From Source:</span>
            <h4>{{ selectedTransfer.sourceWarehouseName }}</h4>
          </div>
          <div>
            <span class="text-caption text-muted">To Destination:</span>
            <h4>{{ selectedTransfer.destinationWarehouseName }}</h4>
          </div>
          <div>
            <span class="text-caption text-muted">Status:</span>
            <AppBadge :variant="getStatusBadgeVariant(selectedTransfer.status)" size="sm">
              {{ selectedTransfer.status }}
            </AppBadge>
          </div>
          <div>
            <span class="text-caption text-muted">Created By:</span>
            <h4>{{ selectedTransfer.createdByName }}</h4>
          </div>
        </div>

        <p v-if="selectedTransfer.notes" class="notes-box">
          <strong>Notes:</strong> {{ selectedTransfer.notes }}
        </p>

        <h4 class="mt-3 mb-2">Item Manifest</h4>
        <table class="inv-table">
          <thead>
            <tr>
              <th>Ref</th>
              <th>Product</th>
              <th>Requested</th>
              <th>Approved</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in selectedTransfer.items" :key="item.id">
              <td class="font-mono">{{ item.productReference }}</td>
              <td>{{ item.productName }}</td>
              <td class="font-mono font-bold">{{ item.requestedQuantity }}</td>
              <td class="font-mono text-success">{{ item.approvedQuantity }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="showDetailsModal = false">Close</AppButton>
      </template>
    </AppModal>

    <!-- Cancel Dialog -->
    <ConfirmDialog
      v-model="showCancelDialog"
      title="Cancel Transfer Request"
      :message="`Are you sure you want to cancel Transfer #${cancellingTransfer?.id}? If this transfer was approved, all reserved stock at the source warehouse will be immediately unlocked.`"
      confirm-text="Cancel Transfer"
      variant="danger"
      :loading="saving"
      @confirm="handleConfirmCancel"
    />
  </div>
</template>

<style scoped>
.transfers-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.btn-primary-action {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.btn-primary-action:hover {
  background-color: var(--color-primary-hover);
}

.btn-success-action {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border-color: var(--color-success-border);
}

.btn-danger-action:hover {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
}

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
  width: 90px;
}

.app-select {
  width: 100%;
  height: 38px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  font-size: 13px;
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

.approve-items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.approve-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--color-surface);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.item-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.notes-box {
  background-color: var(--color-surface);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: 13px;
}

.inv-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
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

.modal-error {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.mb-3 { margin-bottom: 12px; }
.mt-3 { margin-top: 12px; }
.mb-2 { margin-bottom: 8px; }
</style>
