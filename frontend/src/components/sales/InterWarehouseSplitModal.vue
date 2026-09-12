<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import AppModal from '../common/AppModal.vue';
import AppButton from '../common/AppButton.vue';
import AppBadge from '../common/AppBadge.vue';
import { inventoryService } from '../../services/operations.service';
import type { CrossWarehouseStockAvailability, FulfillmentAllocationInput } from '../../types';
import { formatNumber } from '../../utils/formatters';

interface Props {
  modelValue: boolean;
  productId: number;
  productName: string;
  productReference: string;
  requestedQuantity: number;
  originWarehouseId: number;
  originWarehouseName: string;
  initialAllocations?: FulfillmentAllocationInput[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'save', allocations: FulfillmentAllocationInput[]): void;
}>();

const loading = ref(false);
const availability = ref<CrossWarehouseStockAvailability[]>([]);
const errorMsg = ref('');

interface AllocationRow {
  warehouseId: number;
  quantity: number;
  paymentStatus: 'PAID' | 'COLLECT_ON_PICKUP';
  ttlHours: number;
}

const allocationRows = ref<AllocationRow[]>([]);

const originStock = computed(() => {
  return availability.value.find((a) => a.warehouseId === props.originWarehouseId)?.availableQuantity || 0;
});

const remoteWarehouses = computed(() => {
  return availability.value.filter((a) => a.warehouseId !== props.originWarehouseId);
});

async function loadAvailability() {
  if (!props.productId) return;
  loading.value = true;
  errorMsg.value = '';
  try {
    const list = await inventoryService.getCrossWarehouseAvailability(props.productId);
    availability.value = list;

    if (props.initialAllocations && props.initialAllocations.length > 0) {
      allocationRows.value = props.initialAllocations.map((a) => ({
        warehouseId: a.fulfillmentWarehouseId,
        quantity: a.quantity,
        paymentStatus: a.paymentStatus,
        ttlHours: a.ttlHours || 120,
      }));
    } else {
      // Default initial split: max available from origin, remainder from remote with highest stock
      autoDistribute();
    }
  } catch (err: any) {
    errorMsg.value = err.message || 'Erreur lors du chargement des disponibilités inter-dépôts';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      loadAvailability();
    }
  }
);

function autoDistribute() {
  const needed = props.requestedQuantity;
  const localAvail = originStock.value;
  const localQty = Math.min(needed, localAvail);
  const remainder = needed - localQty;

  const rows: AllocationRow[] = [];

  if (localQty > 0) {
    rows.push({
      warehouseId: props.originWarehouseId,
      quantity: localQty,
      paymentStatus: 'PAID',
      ttlHours: 120,
    });
  }

  if (remainder > 0) {
    // Find remote warehouses with available stock sorted descending
    const sortedRemote = [...remoteWarehouses.value]
      .filter((w) => w.availableQuantity > 0)
      .sort((a, b) => b.availableQuantity - a.availableQuantity);

    let remNeeded = remainder;
    for (const wh of sortedRemote) {
      if (remNeeded <= 0) break;
      const take = Math.min(remNeeded, wh.availableQuantity);
      rows.push({
        warehouseId: wh.warehouseId,
        quantity: take,
        paymentStatus: 'PAID', // default prepaid at origin
        ttlHours: 120,
      });
      remNeeded -= take;
    }

    if (remNeeded > 0 && sortedRemote.length > 0) {
      // Allocate the remaining to the top warehouse even if over available, or leave for user
      const first = rows.find((r) => r.warehouseId === sortedRemote[0].warehouseId);
      if (first) {
        first.quantity += remNeeded;
      } else {
        rows.push({
          warehouseId: sortedRemote[0].warehouseId,
          quantity: remNeeded,
          paymentStatus: 'PAID',
          ttlHours: 120,
        });
      }
    }
  }

  allocationRows.value = rows;
}

function addRemoteAllocation() {
  const availableRemotes = remoteWarehouses.value.filter(
    (rw) => !allocationRows.value.some((r) => r.warehouseId === rw.warehouseId)
  );
  const targetWh = availableRemotes[0] || remoteWarehouses.value[0];
  if (!targetWh) return;

  const remaining = Math.max(0, props.requestedQuantity - totalAllocated.value);
  allocationRows.value.push({
    warehouseId: targetWh.warehouseId,
    quantity: remaining > 0 ? remaining : 1,
    paymentStatus: 'PAID',
    ttlHours: 120,
  });
}

function removeAllocation(index: number) {
  allocationRows.value.splice(index, 1);
}

function getWarehouseName(id: number): string {
  const wh = availability.value.find((w) => w.warehouseId === id);
  return wh ? wh.warehouseName : `Dépôt #${id}`;
}

function getWarehouseStock(id: number): number {
  const wh = availability.value.find((w) => w.warehouseId === id);
  return wh ? wh.availableQuantity : 0;
}

const totalAllocated = computed(() => {
  return allocationRows.value.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
});

const isAllocationValid = computed(() => {
  if (allocationRows.value.length === 0) return false;
  if (totalAllocated.value !== props.requestedQuantity) return false;

  for (const r of allocationRows.value) {
    if (!r.warehouseId || r.quantity <= 0) return false;
    const avail = getWarehouseStock(r.warehouseId);
    if (r.quantity > avail) return false;
  }
  return true;
});

function handleSave() {
  if (!isAllocationValid.value) return;

  const allocations: FulfillmentAllocationInput[] = allocationRows.value.map((r) => ({
    productId: props.productId,
    originWarehouseId: props.originWarehouseId,
    fulfillmentWarehouseId: r.warehouseId,
    paymentWarehouseId: r.paymentStatus === 'COLLECT_ON_PICKUP' ? r.warehouseId : props.originWarehouseId,
    quantity: Number(r.quantity),
    paymentStatus: r.paymentStatus,
    ttlHours: Number(r.ttlHours) || 120,
  }));

  emit('save', allocations);
  emit('update:modelValue', false);
}

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    title="Transfert & Répartition Inter-Dépôts"
    max-width="740px"
    @update:model-value="close"
  >
    <div class="split-modal-content">
      <!-- Product Summary Banner -->
      <div class="product-banner">
        <div class="banner-header">
          <div>
            <span class="product-tag">{{ productReference }}</span>
            <h4 class="product-title">{{ productName }}</h4>
          </div>
          <div class="demand-pill">
            <span class="pill-label">Quantité Demandée</span>
            <span class="pill-value font-mono">{{ formatNumber(requestedQuantity) }}</span>
          </div>
        </div>
        <div class="banner-meta">
          <div class="meta-item">
            <span class="text-muted">Dépôt d'Origine (Vente) :</span>
            <strong>{{ originWarehouseName }}</strong>
          </div>
          <div class="meta-item">
            <span class="text-muted">Stock local disponible :</span>
            <span :class="originStock > 0 ? 'text-success font-semibold' : 'text-danger font-semibold'">
              {{ originStock }} unité(s)
            </span>
          </div>
          <div class="meta-item" v-if="requestedQuantity > originStock">
            <span class="text-muted">Déficit local :</span>
            <span class="badge-shortfall font-semibold">
              -{{ requestedQuantity - originStock }} unité(s)
            </span>
          </div>
        </div>
      </div>

      <!-- Real-time Cross-Warehouse Availability -->
      <div class="section-title-row">
        <h5>Disponibilités en Temps Réel dans le Réseau</h5>
        <button type="button" class="btn-refresh" @click="loadAvailability" :disabled="loading">
          <span :class="{ 'spinning': loading }"></span> Actualiser
        </button>
      </div>

      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>Interrogation des stocks des dépôts...</span>
      </div>

      <div v-else class="availability-grid">
        <div
          v-for="wh in availability"
          :key="wh.warehouseId"
          class="wh-stock-card"
          :class="{
            'is-origin': wh.warehouseId === originWarehouseId,
            'has-stock': wh.availableQuantity > 0,
            'no-stock': wh.availableQuantity === 0,
          }"
        >
          <div class="wh-header">
            <span class="wh-name">{{ wh.warehouseName }}</span>
            <span v-if="wh.warehouseId === originWarehouseId" class="origin-badge">Origine</span>
          </div>
          <div class="wh-qty font-mono">
            <span class="qty-num">{{ wh.availableQuantity }}</span>
            <span class="qty-label">disponibles</span>
          </div>
          <div class="wh-breakdown text-muted font-mono">
            <span>Physique: {{ wh.physicalQuantity }}</span>
            <span v-if="wh.reservedQuantity > 0" class="text-warning">Réservé: {{ wh.reservedQuantity }}</span>
          </div>
        </div>
      </div>

      <!-- Allocation Split Table -->
      <div class="section-title-row mt-4">
        <h5>Répartition de l'Ordre de Vente</h5>
        <div class="actions-right">
          <button type="button" class="btn-auto" @click="autoDistribute">
          Répartition Automatique
          </button>
          <button type="button" class="btn-add-split" @click="addRemoteAllocation">
          Ajouter un Dépôt
          </button>
        </div>
      </div>

      <div class="table-container">
        <table class="alloc-table">
          <thead>
            <tr>
              <th>Dépôt de Retrait</th>
              <th style="width: 100px;">Quantité</th>
              <th>Mode d'Encaissement</th>
              <th style="width: 110px;">Validité (TTL)</th>
              <th style="width: 40px;"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in allocationRows" :key="idx">
              <td>
                <select v-model="row.warehouseId" class="select-wh">
                  <option :value="originWarehouseId">
                    {{ originWarehouseName }} (Origine - Dispo: {{ originStock }})
                  </option>
                  <option
                    v-for="rw in remoteWarehouses"
                    :key="rw.warehouseId"
                    :value="rw.warehouseId"
                  >
                    {{ rw.warehouseName }} (Dispo: {{ rw.availableQuantity }})
                  </option>
                </select>
                <div v-if="row.quantity > getWarehouseStock(row.warehouseId)" class="row-error">
                  Dépasse le stock dispo ({{ getWarehouseStock(row.warehouseId) }})
                </div>
              </td>
              <td>
                <input
                  type="number"
                  v-model.number="row.quantity"
                  min="1"
                  :max="getWarehouseStock(row.warehouseId)"
                  class="input-qty font-mono"
                />
              </td>
              <td>
                <select v-model="row.paymentStatus" class="select-payment">
                  <option value="PAID">
                  Payé ici (Prépayé à l'origine)
                  </option>
                  <option value="COLLECT_ON_PICKUP" :disabled="row.warehouseId === originWarehouseId">
                  À payer au retrait (Dépôt destinataire)
                  </option>
                </select>
              </td>
              <td>
                <select v-model.number="row.ttlHours" class="select-ttl font-mono" :disabled="row.warehouseId === originWarehouseId">
                  <option :value="24">24 heures</option>
                  <option :value="48">48 heures</option>
                  <option :value="72">72 heures</option>
                  <option :value="120">120 h (5 j)</option>
                </select>
              </td>
              <td class="text-center">
                <button
                  type="button"
                  class="btn-remove-row"
                  @click="removeAllocation(idx)"
                  :disabled="allocationRows.length <= 1"
                  title="Supprimer ce dépôt"
                >
                  &times;
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Allocation Status / Summary Ribbon -->
      <div
        class="summary-ribbon"
        :class="{
          'ribbon-success': isAllocationValid,
          'ribbon-warning': totalAllocated < requestedQuantity,
          'ribbon-danger': totalAllocated > requestedQuantity,
        }"
      >
        <div class="ribbon-metric">
          <span class="metric-label">Total Alloué :</span>
          <span class="metric-val font-mono">{{ formatNumber(totalAllocated) }} / {{ formatNumber(requestedQuantity) }}</span>
        </div>
        <div class="ribbon-status">
          <span v-if="isAllocationValid" class="text-success font-semibold">
            ✓ Répartition complète et vérifiée. Les réservations seront établies avec verrou atomique.
          </span>
          <span v-else-if="totalAllocated < requestedQuantity" class="text-warning font-semibold">
            ⚠️ Il reste {{ requestedQuantity - totalAllocated }} unité(s) à affecter.
          </span>
          <span v-else class="text-danger font-semibold">
            ❌ La quantité totale allouée dépasse la demande de {{ totalAllocated - requestedQuantity }} unité(s).
          </span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer-actions">
        <AppButton variant="secondary" @click="close">Annuler</AppButton>
        <AppButton
          variant="primary"
          :disabled="!isAllocationValid"
          @click="handleSave"
        >
          Confirmer la Répartition Inter-Dépôts
        </AppButton>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.split-modal-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.product-banner {
  background: var(--surface-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  padding: 1rem;
}

.banner-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.product-tag {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 4px;
  margin-bottom: 0.25rem;
}

.product-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}

.demand-pill {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
}

.pill-label {
  font-size: 0.7rem;
  color: #1e40af;
  text-transform: uppercase;
}

.pill-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e3a8a;
}

.banner-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  font-size: 0.85rem;
  border-top: 1px dashed var(--border-color, #e2e8f0);
  padding-top: 0.5rem;
}

.badge-shortfall {
  color: #dc2626;
  background: #fee2e2;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title-row h5 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.btn-refresh, .btn-auto, .btn-add-split {
  font-size: 0.8rem;
  font-weight: 500;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  border: 1px solid var(--border-color, #cbd5e1);
  background: white;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-auto {
  background: #f0fdf4;
  color: #166534;
  border-color: #bbf7d0;
}

.btn-add-split {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.actions-right {
  display: flex;
  gap: 0.5rem;
}

.spinning {
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  color: var(--text-muted, #64748b);
}

.availability-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
}

.wh-stock-card {
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  padding: 0.6rem;
  background: white;
  transition: all 0.15s ease;
}

.wh-stock-card.is-origin {
  border-color: #93c5fd;
  background: #f8faff;
}

.wh-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  font-weight: 600;
}

.origin-badge {
  font-size: 0.65rem;
  background: #dbeafe;
  color: #1e40af;
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
}

.wh-qty {
  margin: 0.25rem 0;
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.qty-num {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
}

.qty-label {
  font-size: 0.75rem;
  color: var(--text-muted, #64748b);
}

.wh-breakdown {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
}

.table-container {
  overflow-x: auto;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
}

.alloc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.alloc-table th {
  background: #f1f5f9;
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

.alloc-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.select-wh, .select-payment, .select-ttl, .input-qty {
  width: 100%;
  padding: 0.35rem 0.5rem;
  font-size: 0.85rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
}

.row-error {
  font-size: 0.7rem;
  color: #dc2626;
  margin-top: 0.2rem;
}

.btn-remove-row {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: #94a3b8;
  cursor: pointer;
}

.btn-remove-row:hover:not(:disabled) {
  color: #ef4444;
}

.summary-ribbon {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.ribbon-success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.ribbon-warning {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.ribbon-danger {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.metric-label {
  color: #475569;
}

.metric-val {
  font-size: 1.05rem;
  font-weight: 700;
  margin-left: 0.35rem;
}

.modal-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  width: 100%;
}
</style>
