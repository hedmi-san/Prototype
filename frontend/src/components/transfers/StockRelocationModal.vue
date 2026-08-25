<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { inventoryService, transferService } from '../../services/operations.service';
import type { Stock } from '../../types';
import AppModal from '../common/AppModal.vue';
import AppButton from '../common/AppButton.vue';
import AppBadge from '../common/AppBadge.vue';
import AppInput from '../common/AppInput.vue';

const props = defineProps<{
  modelValue: boolean;
  initialSourceWarehouseId?: number | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'relocated', payload: { sourceWarehouseId: number; sourceIsEmpty: boolean }): void;
  (e: 'request-deactivate', warehouseId: number): void;
}>();

const warehouseStore = useWarehouseStore();

const sourceWarehouseId = ref<number | null>(null);
const selectedDestIds = ref<number[]>([]);
const sourceStock = ref<Stock[]>([]);
const loadingStock = ref(false);
const submitting = ref(false);
const errorMessage = ref('');
const notes = ref('Relocalisation et redistribution de stock inter-dépôts');
const immediateExecution = ref(true);
const searchQuery = ref('');

// Success summary state
const executionResult = ref<{
  transfers: any[];
  sourceIsEmpty: boolean;
  sourceWarehouseId: number;
} | null>(null);

// Active warehouses available for destinations
const activeDestinations = computed(() => {
  return warehouseStore.warehouses.filter(
    (w) => w.active && w.id !== sourceWarehouseId.value
  );
});

// Watch modal opening and initialize
watch(
  () => props.modelValue,
  async (newVal) => {
    if (newVal) {
      executionResult.value = null;
      errorMessage.value = '';
      searchQuery.value = '';
      if (props.initialSourceWarehouseId) {
        sourceWarehouseId.value = props.initialSourceWarehouseId;
      } else if (warehouseStore.warehouses.length > 0) {
        sourceWarehouseId.value = warehouseStore.warehouses[0].id;
      }
      // Pick first active destination by default
      const defaultDest = warehouseStore.warehouses.find(
        (w) => w.active && w.id !== sourceWarehouseId.value
      );
      selectedDestIds.value = defaultDest ? [defaultDest.id] : [];
      await loadSourceStock();
    }
  }
);

watch(sourceWarehouseId, async () => {
  // Remove source from selected destinations if present
  selectedDestIds.value = selectedDestIds.value.filter(
    (id) => id !== sourceWarehouseId.value
  );
  if (selectedDestIds.value.length === 0) {
    const firstOther = warehouseStore.warehouses.find(
      (w) => w.active && w.id !== sourceWarehouseId.value
    );
    if (firstOther) selectedDestIds.value = [firstOther.id];
  }
  await loadSourceStock();
});

// Matrix of allocations: allocations[productId][destWarehouseId] = quantity
const allocations = ref<Record<number, Record<number, number>>>({});

async function loadSourceStock() {
  if (!sourceWarehouseId.value) {
    sourceStock.value = [];
    return;
  }
  loadingStock.value = true;
  errorMessage.value = '';
  try {
    const res = await inventoryService.getStock({
      warehouseId: sourceWarehouseId.value,
      limit: 1000,
    });
    const items = res.items;
    // Only keep items with available stock > 0
    sourceStock.value = items.filter((item) => (item.availableQuantity || item.physicalQuantity) > 0);

    // Initialize allocations object
    const newAlloc: Record<number, Record<number, number>> = {};
    for (const item of sourceStock.value) {
      newAlloc[item.productId] = {};
      for (const destId of selectedDestIds.value) {
        newAlloc[item.productId][destId] = 0;
      }
    }
    allocations.value = newAlloc;
  } catch (err: any) {
    errorMessage.value = "Impossible de charger l'inventaire du dépôt source";
  } finally {
    loadingStock.value = false;
  }
}

// Filtered stock by search query
const filteredStock = computed(() => {
  if (!searchQuery.value.trim()) return sourceStock.value;
  const q = searchQuery.value.toLowerCase().trim();
  return sourceStock.value.filter(
    (s) =>
      s.productName.toLowerCase().includes(q) ||
      s.productReference.toLowerCase().includes(q) ||
      (s.productBrand && s.productBrand.toLowerCase().includes(q))
  );
});

function toggleDestination(destId: number) {
  if (selectedDestIds.value.includes(destId)) {
    if (selectedDestIds.value.length === 1) return; // Keep at least one
    selectedDestIds.value = selectedDestIds.value.filter((id) => id !== destId);
  } else {
    selectedDestIds.value.push(destId);
    // Initialize allocations for new destination
    for (const item of sourceStock.value) {
      if (!allocations.value[item.productId]) {
        allocations.value[item.productId] = {};
      }
      allocations.value[item.productId][destId] = 0;
    }
  }
}

function getItemAllocated(productId: number): number {
  const row = allocations.value[productId];
  if (!row) return 0;
  return Object.values(row).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
}

function getItemRemaining(item: Stock): number {
  const maxAvailable = item.availableQuantity !== undefined ? item.availableQuantity : item.physicalQuantity;
  return maxAvailable - getItemAllocated(item.productId);
}

function setQuantity(productId: number, destId: number, val: string | number) {
  const num = Math.max(0, Number(val) || 0);
  if (!allocations.value[productId]) {
    allocations.value[productId] = {};
  }
  allocations.value[productId][destId] = num;
}

// Smart Helpers
function fillAllTo(destId: number) {
  for (const item of sourceStock.value) {
    const maxAvailable = item.availableQuantity !== undefined ? item.availableQuantity : item.physicalQuantity;
    if (!allocations.value[item.productId]) {
      allocations.value[item.productId] = {};
    }
    for (const dId of selectedDestIds.value) {
      allocations.value[item.productId][dId] = dId === destId ? maxAvailable : 0;
    }
  }
}

function splitEqually() {
  if (selectedDestIds.value.length === 0) return;
  const count = selectedDestIds.value.length;
  for (const item of sourceStock.value) {
    const maxAvailable = item.availableQuantity !== undefined ? item.availableQuantity : item.physicalQuantity;
    const baseShare = Math.floor(maxAvailable / count);
    const remainder = maxAvailable % count;

    if (!allocations.value[item.productId]) {
      allocations.value[item.productId] = {};
    }

    selectedDestIds.value.forEach((dId, idx) => {
      // Give remainder to first destination
      allocations.value[item.productId][dId] = baseShare + (idx === 0 ? remainder : 0);
    });
  }
}

function sweepRemaindersTo(destId: number) {
  for (const item of sourceStock.value) {
    const rem = getItemRemaining(item);
    if (rem > 0) {
      if (!allocations.value[item.productId]) {
        allocations.value[item.productId] = {};
      }
      allocations.value[item.productId][destId] = (allocations.value[item.productId][destId] || 0) + rem;
    }
  }
}

function resetAllocations() {
  for (const item of sourceStock.value) {
    if (!allocations.value[item.productId]) {
      allocations.value[item.productId] = {};
    }
    for (const dId of selectedDestIds.value) {
      allocations.value[item.productId][dId] = 0;
    }
  }
}

// Totals and Validation
const totalAllocatedUnits = computed(() => {
  let total = 0;
  for (const item of sourceStock.value) {
    total += getItemAllocated(item.productId);
  }
  return total;
});

const totalSourceStockUnits = computed(() => {
  return sourceStock.value.reduce((sum, i) => sum + (i.availableQuantity || i.physicalQuantity), 0);
});

const destinationTotals = computed(() => {
  const totals: Record<number, { units: number; itemsCount: number }> = {};
  for (const destId of selectedDestIds.value) {
    let units = 0;
    let itemsCount = 0;
    for (const item of sourceStock.value) {
      const qty = allocations.value[item.productId]?.[destId] || 0;
      if (qty > 0) {
        units += qty;
        itemsCount++;
      }
    }
    totals[destId] = { units, itemsCount };
  }
  return totals;
});

const hasOverAllocation = computed(() => {
  return sourceStock.value.some((item) => getItemRemaining(item) < 0);
});

const canSubmit = computed(() => {
  return (
    !loadingStock.value &&
    !submitting.value &&
    sourceWarehouseId.value !== null &&
    selectedDestIds.value.length > 0 &&
    totalAllocatedUnits.value > 0 &&
    !hasOverAllocation.value
  );
});

async function handleSubmit() {
  if (!canSubmit.value || !sourceWarehouseId.value) return;
  submitting.value = true;
  errorMessage.value = '';

  try {
    const distributions = selectedDestIds.value
      .map((destId) => {
        const items = sourceStock.value
          .map((item) => ({
            productId: item.productId,
            quantity: Number(allocations.value[item.productId]?.[destId] || 0),
          }))
          .filter((i) => i.quantity > 0);

        return {
          destinationWarehouseId: destId,
          items,
        };
      })
      .filter((d) => d.items.length > 0);

    if (distributions.length === 0) {
      throw new Error('Aucun article avec une quantité allouée à transférer');
    }

    const payload = {
      sourceWarehouseId: sourceWarehouseId.value,
      distributions,
      immediateExecution: immediateExecution.value,
      notes: notes.value.trim(),
    };

    const res = await transferService.bulkRelocateStock(payload);

    executionResult.value = {
      transfers: res.transfers,
      sourceIsEmpty: res.sourceIsEmpty,
      sourceWarehouseId: sourceWarehouseId.value,
    };

    emit('relocated', {
      sourceWarehouseId: sourceWarehouseId.value,
      sourceIsEmpty: res.sourceIsEmpty,
    });
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || err.message || 'Échec de la relocalisation du stock';
  } finally {
    submitting.value = false;
  }
}

function handleClose() {
  emit('update:modelValue', false);
}

function handleDeactivateRequest() {
  if (executionResult.value) {
    const whId = executionResult.value.sourceWarehouseId;
    emit('update:modelValue', false);
    emit('request-deactivate', whId);
  }
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    title="🔄 Matrice de Redistribution & Liquidation de Stock"
    max-width="1100px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- SUCCESS SUMMARY SCREEN -->
    <div v-if="executionResult" class="success-screen">
      <div class="success-header">
        <div class="success-icon">✓</div>
        <h3>Relocalisation de Stock Effectuée avec Succès !</h3>
        <p class="text-muted">
          {{ executionResult.transfers.length }} ordre(s) de transfert inter-dépôts ont été générés et exécutés.
        </p>
      </div>

      <div class="transfers-summary-cards">
        <div v-for="t in executionResult.transfers" :key="t.id" class="transfer-card">
          <div class="transfer-badge">
            <AppBadge variant="success" size="sm">{{ t.status }}</AppBadge>
          </div>
          <div class="transfer-ref">{{ t.transferNumber }}</div>
          <div class="transfer-dest">
            Destination : <strong>{{ warehouseStore.warehouses.find(w => w.id === t.destinationWarehouseId)?.name || `Dépôt ID ${t.destinationWarehouseId}` }}</strong>
          </div>
          <div class="transfer-meta">{{ t.itemsCount }} article(s) transférés</div>
        </div>
      </div>

      <!-- Zero-stock deactivation callout -->
      <div v-if="executionResult.sourceIsEmpty" class="zero-stock-callout">
        <div class="callout-icon">✨</div>
        <div class="callout-content">
          <h4>Tout le stock de ce dépôt a été vidé (Stock = 0)</h4>
          <p>
            Ce site ne contient plus aucun article en stock. Si cette opération faisait partie d'une fermeture définitive, vous pouvez le désactiver en un clic.
          </p>
        </div>
        <AppButton variant="danger" size="md" @click="handleDeactivateRequest">
          Désactiver définitivement ce dépôt
        </AppButton>
      </div>

      <div class="modal-actions mt-4">
        <AppButton variant="primary" @click="handleClose">Fermer</AppButton>
      </div>
    </div>

    <!-- ALLOCATION MATRIX WIZARD -->
    <div v-else class="relocation-matrix">
      <div v-if="errorMessage" class="error-banner mb-3">
        {{ errorMessage }}
      </div>

      <!-- Step 1: Source & Destinations Selection -->
      <div class="config-bar">
        <div class="config-source">
          <label class="form-label">Dépôt Source (À vider / relocaliser) :</label>
          <select v-model="sourceWarehouseId" class="app-select">
            <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
              {{ w.name }} ({{ w.code }}) {{ !w.active ? '— [INACTIF]' : '' }}
            </option>
          </select>
        </div>

        <div class="config-destinations">
          <label class="form-label">Dépôts Destinataires :</label>
          <div class="dest-checkboxes">
            <label
              v-for="dw in activeDestinations"
              :key="dw.id"
              class="dest-chip"
              :class="{ active: selectedDestIds.includes(dw.id) }"
            >
              <input
                type="checkbox"
                :checked="selectedDestIds.includes(dw.id)"
                @change="toggleDestination(dw.id)"
              />
              <span>{{ dw.name }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Step 2: Smart Helpers Bar & Search -->
      <div class="helpers-bar">
        <div class="helpers-actions">
          <span class="helpers-label">Raccourcis :</span>
          <button type="button" class="helper-btn" @click="splitEqually">
            ⚖️ Répartir Équitablement
          </button>
          <button
            v-if="selectedDestIds.length > 0"
            type="button"
            class="helper-btn"
            @click="fillAllTo(selectedDestIds[0])"
          >
            ➡️ Tout vers {{ warehouseStore.warehouses.find(w => w.id === selectedDestIds[0])?.name }}
          </button>
          <button
            v-if="selectedDestIds.length > 0"
            type="button"
            class="helper-btn"
            @click="sweepRemaindersTo(selectedDestIds[0])"
          >
            🧹 Vider les Restes sur {{ warehouseStore.warehouses.find(w => w.id === selectedDestIds[0])?.name }}
          </button>
          <button type="button" class="helper-btn text-danger" @click="resetAllocations">
            ✕ Réinitialiser
          </button>
        </div>

        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Rechercher par référence, nom..."
            class="app-search-input"
          />
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loadingStock" class="loading-state">
        <div class="spinner"></div>
        <p>Chargement des stocks disponibles du dépôt source...</p>
      </div>

      <!-- Empty Source State -->
      <div v-else-if="sourceStock.length === 0" class="empty-stock-state">
        <p>ℹ️ Ce dépôt ne dispose d'aucun article avec du stock disponible à relocaliser.</p>
      </div>

      <!-- Matrix Table -->
      <div v-else class="matrix-table-container">
        <table class="matrix-table">
          <thead>
            <tr>
              <th style="min-width: 220px;">Produit / Référence</th>
              <th style="width: 100px; text-align: center;">Stock Dispo</th>
              <th
                v-for="dId in selectedDestIds"
                :key="dId"
                style="min-width: 130px; text-align: center;"
              >
                {{ warehouseStore.warehouses.find(w => w.id === dId)?.name }}
              </th>
              <th style="width: 100px; text-align: center;">Reste</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredStock" :key="item.productId">
              <td>
                <div class="product-info">
                  <span class="product-ref font-mono">{{ item.productReference }}</span>
                  <span class="product-name">{{ item.productName }}</span>
                  <span v-if="item.productBrand" class="product-brand">{{ item.productBrand }}</span>
                </div>
              </td>
              <td class="text-center font-bold font-mono">
                {{ item.availableQuantity !== undefined ? item.availableQuantity : item.physicalQuantity }}
              </td>
              <td v-for="dId in selectedDestIds" :key="dId" class="text-center">
                <input
                  type="number"
                  min="0"
                  :max="item.availableQuantity !== undefined ? item.availableQuantity : item.physicalQuantity"
                  class="matrix-input font-mono"
                  :value="allocations[item.productId]?.[dId] || 0"
                  @focus="($event.target as HTMLInputElement).select()"
                  @input="setQuantity(item.productId, dId, ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td class="text-center">
                <span
                  class="rem-badge"
                  :class="{
                    'rem-zero': getItemRemaining(item) === 0,
                    'rem-left': getItemRemaining(item) > 0,
                    'rem-over': getItemRemaining(item) < 0,
                  }"
                >
                  <template v-if="getItemRemaining(item) === 0">0 ✓</template>
                  <template v-else-if="getItemRemaining(item) > 0">+{{ getItemRemaining(item) }}</template>
                  <template v-else>{{ getItemRemaining(item) }} ⚠️</template>
                </span>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="totals-row">
              <td><strong>Totaux Généraux</strong></td>
              <td class="text-center font-bold font-mono">{{ totalSourceStockUnits }} pcs</td>
              <td v-for="dId in selectedDestIds" :key="dId" class="text-center font-bold font-mono">
                {{ destinationTotals[dId]?.units || 0 }} pcs
                <div class="sub-count font-normal text-muted">({{ destinationTotals[dId]?.itemsCount || 0 }} art.)</div>
              </td>
              <td class="text-center font-bold font-mono">
                {{ totalSourceStockUnits - totalAllocatedUnits }} pcs
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Execution Options & Notes -->
      <div class="execution-options mt-3">
        <div class="options-radio">
          <label class="radio-label">
            <input v-model="immediateExecution" type="radio" :value="true" />
            <span><strong>Exécution Immédiate</strong> (Transfère le stock et confirme directement en base)</span>
          </label>
          <label class="radio-label">
            <input v-model="immediateExecution" type="radio" :value="false" />
            <span><strong>Demandes de Transfert</strong> (Génère des ordres en attente d'approbation)</span>
          </label>
        </div>

        <AppInput
          v-model="notes"
          label="Motif / Observations pour les bons de transfert"
          placeholder="ex. Fermeture définitive du dépôt et liquidation de stock"
        />
      </div>

      <!-- Actions -->
      <div class="modal-footer-actions mt-4">
        <div class="summary-text">
          Total alloué : <strong>{{ totalAllocatedUnits }} / {{ totalSourceStockUnits }} unités</strong>
          <span v-if="hasOverAllocation" class="text-danger font-bold ml-2">⚠️ Dépassement de stock détecté</span>
        </div>
        <div class="btn-group">
          <AppButton variant="secondary" @click="handleClose">Annuler</AppButton>
          <AppButton
            variant="primary"
            :disabled="!canSubmit"
            :loading="submitting"
            @click="handleSubmit"
          >
            🚀 Exécuter la Redistribution ({{ selectedDestIds.length }} bons)
          </AppButton>
        </div>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.relocation-matrix {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-bar {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 16px;
  background-color: var(--color-surface-hover);
  padding: 14px 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.app-select {
  width: 100%;
  padding: 8px 12px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: 13px;
}

.dest-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dest-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition: all var(--transition-fast);
}

.dest-chip.active {
  background-color: var(--color-primary-bg, #eff6ff);
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

.helpers-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.helpers-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.helpers-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.helper-btn {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.helper-btn:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-text-secondary);
}

.app-search-input {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 12px;
  width: 240px;
}

.matrix-table-container {
  max-height: 380px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.matrix-table th {
  position: sticky;
  top: 0;
  background-color: var(--color-surface-hover);
  padding: 10px 12px;
  font-weight: 600;
  border-bottom: 2px solid var(--color-border);
  z-index: 2;
}

.matrix-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.product-info {
  display: flex;
  flex-direction: column;
}

.product-ref {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary);
}

.product-name {
  font-weight: 500;
}

.product-brand {
  font-size: 11px;
  color: var(--color-text-muted);
}

.matrix-input {
  width: 80px;
  padding: 6px 8px;
  text-align: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  font-weight: 600;
}

.matrix-input:focus {
  border-color: var(--color-primary);
  outline: none;
}

.rem-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 700;
  font-family: monospace;
}

.rem-zero {
  background-color: var(--color-success-bg, #ecfdf5);
  color: var(--color-success, #059669);
  border: 1px solid var(--color-success-border, #a7f3d0);
}

.rem-left {
  background-color: var(--color-info-bg, #eff6ff);
  color: var(--color-info, #2563eb);
  border: 1px solid var(--color-info-border, #bfdbfe);
}

.rem-over {
  background-color: var(--color-danger-bg, #fef2f2);
  color: var(--color-danger, #dc2626);
  border: 1px solid var(--color-danger-border, #fecaca);
}

.totals-row td {
  background-color: var(--color-surface-hover);
  border-top: 2px solid var(--color-border);
}

.sub-count {
  font-size: 10px;
}

.execution-options {
  background-color: var(--color-surface-hover);
  padding: 14px 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.options-radio {
  display: flex;
  gap: 20px;
}

.radio-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.modal-footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.btn-group {
  display: flex;
  gap: 10px;
}

.success-screen {
  display: flex;
  flex-direction: column;
  gap: 20px;
  text-align: center;
  padding: 20px 10px;
}

.success-icon {
  width: 56px;
  height: 56px;
  background-color: var(--color-success-bg, #ecfdf5);
  color: var(--color-success, #059669);
  border: 2px solid var(--color-success, #059669);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: bold;
  margin: 0 auto 12px;
}

.transfers-summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  text-align: left;
}

.transfer-card {
  padding: 14px;
  background-color: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.transfer-ref {
  font-family: monospace;
  font-weight: 700;
  color: var(--color-primary);
  font-size: 14px;
}

.zero-stock-callout {
  background-color: var(--color-warning-bg, #fffbeb);
  border: 1px solid var(--color-warning-border, #fde68a);
  padding: 16px 20px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  text-align: left;
}

.callout-icon {
  font-size: 28px;
}

.callout-content h4 {
  margin: 0 0 4px;
  color: var(--color-text-primary);
}

.callout-content p {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.loading-state,
.empty-stock-state {
  padding: 40px 20px;
  text-align: center;
  color: var(--color-text-muted);
}

.error-banner {
  background-color: var(--color-danger-bg, #fef2f2);
  color: var(--color-danger, #dc2626);
  border: 1px solid var(--color-danger-border, #fecaca);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.text-danger { color: var(--color-danger, #dc2626); }
.font-mono { font-family: monospace; }
.font-bold { font-weight: 600; }
.font-normal { font-weight: 400; }
.text-center { text-align: center; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.mb-3 { margin-bottom: 12px; }
.ml-2 { margin-left: 8px; }
</style>
