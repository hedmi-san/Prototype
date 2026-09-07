<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Client, ClientDetail, ClientRefund } from '../../types';
import { clientService } from '../../services/client.service';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { useAuthStore } from '../../stores/auth.store';
import { formatCurrency } from '../../utils/formatters';
import AppModal from '../common/AppModal.vue';
import AppButton from '../common/AppButton.vue';

interface Props {
  modelValue: boolean;
  client?: Client | ClientDetail | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'saved', refund: ClientRefund): void;
}>();

const warehouseStore = useWarehouseStore();
const authStore = useAuthStore();

const amount = ref<number>(0);
const selectedWarehouseId = ref<number>(authStore.activeWarehouseId || warehouseStore.warehouses[0]?.id || 1);
const notes = ref('');
const submitting = ref(false);
const errorMessage = ref('');

const currentBalance = computed(() => Number(props.client?.currentBalance || 0));

// Client has an advance if balance < 0
const hasAdvance = computed(() => currentBalance.value < 0);
const availableAdvance = computed(() => (hasAdvance.value ? Math.abs(currentBalance.value) : 0));

const remainingAdvance = computed(() => {
  const diff = availableAdvance.value - (amount.value || 0);
  return Math.max(0, diff);
});

const isAmountExceeded = computed(() => {
  return (amount.value || 0) > availableAdvance.value + 0.001;
});

const isValid = computed(() => {
  return (
    hasAdvance.value &&
    (amount.value || 0) > 0 &&
    !isAmountExceeded.value &&
    !props.client?.isDefault &&
    !submitting.value
  );
});

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      errorMessage.value = '';
      submitting.value = false;
      notes.value = '';
      selectedWarehouseId.value = authStore.activeWarehouseId || warehouseStore.warehouses[0]?.id || 1;
      // Initialize amount with available advance
      amount.value = availableAdvance.value > 0 ? availableAdvance.value : 0;
    }
  }
);

function handleSetFullAdvance() {
  amount.value = availableAdvance.value;
  errorMessage.value = '';
}

async function handleSubmit() {
  if (!props.client?.id) {
    errorMessage.value = 'Client introuvable';
    return;
  }
  if (!isValid.value) {
    if (isAmountExceeded.value) {
      errorMessage.value = `Le montant ne peut pas dépasser l'avance disponible (${formatCurrency(availableAdvance.value)}).`;
    } else if ((amount.value || 0) <= 0) {
      errorMessage.value = 'Veuillez saisir un montant supérieur à 0 DZD.';
    }
    return;
  }

  submitting.value = true;
  errorMessage.value = '';

  try {
    const refund = await clientService.refundClientAdvance(props.client.id, {
      amount: Number(amount.value),
      warehouseId: Number(selectedWarehouseId.value),
      notes: notes.value.trim(),
    });

    emit('saved', refund);
    emit('update:modelValue', false);
  } catch (err: any) {
    console.error('Failed to process client advance refund', err);
    errorMessage.value = err.response?.data?.message || err.message || 'Erreur lors du décaissement du remboursement';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    title="Remboursement d'Avance (Décaissement Espèces)"
    max-width="580px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="refund-modal-body">
      <!-- Error notification -->
      <div v-if="errorMessage" class="error-alert">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Ineligible warning if no advance -->
      <div v-if="!hasAdvance" class="warning-banner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <strong>Aucune avance disponible</strong>
          <p>Ce client ne possède aucun solde créditeur d'avance en compte (solde actuel : {{ formatCurrency(currentBalance) }}).</p>
        </div>
      </div>

      <!-- Client Snapshot Banner -->
      <div v-else class="client-advance-banner">
        <div class="client-banner-header">
          <div class="client-info">
            <span class="client-code">{{ props.client?.code }}</span>
            <strong class="client-name">{{ props.client?.name }}</strong>
          </div>
          <div class="advance-pill">
            <span class="advance-pill-label">Avance Disponible</span>
            <span class="advance-pill-val font-mono">{{ formatCurrency(availableAdvance) }}</span>
          </div>
        </div>
      </div>

      <!-- Refund Form -->
      <form v-if="hasAdvance" @submit.prevent="handleSubmit" class="refund-form">
        <!-- Amount Input Group -->
        <div class="form-group">
          <div class="label-with-action">
            <label class="form-label" for="refund-amount">
              Montant du Remboursement (Espèces) *
            </label>
            <button
              type="button"
              class="quick-action-btn"
              @click="handleSetFullAdvance"
              title="Préremplir la totalité de l'avance disponible"
            >
              Tout rembourser ({{ formatCurrency(availableAdvance) }})
            </button>
          </div>

          <div class="amount-input-wrap" :class="{ 'is-invalid': isAmountExceeded }">
            <input
              id="refund-amount"
              v-model.number="amount"
              type="number"
              min="1"
              :max="availableAdvance"
              step="any"
              placeholder="0.00"
              class="form-input amount-input"
              autofocus
              required
            />
            <span class="currency-tag">DZD</span>
          </div>
          <p v-if="isAmountExceeded" class="input-error-msg">
            Le montant dépasse le plafond d'avance disponible de {{ formatCurrency(availableAdvance) }}.
          </p>
        </div>

        <!-- Warehouse & Method Grid -->
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Caisse / Dépôt de Décaissement *</label>
            <select v-model="selectedWarehouseId" class="form-select" required>
              <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
                {{ w.name }} ({{ w.code }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Mode de Décaissement</label>
            <div class="payment-method-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="12" cy="12" r="2" />
                <path d="M6 12h.01M18 12h.01" />
              </svg>
              <span>Espèces Uniquement (Caisse)</span>
            </div>
          </div>
        </div>

        <!-- Notes / Motivation -->
        <div class="form-group">
          <label class="form-label">Motif / Remarques (Optionnel)</label>
          <textarea
            v-model="notes"
            rows="2"
            class="form-input form-textarea"
            placeholder="Ex: Restitution d'avance suite retour de marchandises..."
          ></textarea>
        </div>

        <!-- Summary & Balance Projection Card -->
        <div class="projection-card">
          <div class="projection-row">
            <span class="projection-label">Avance disponible avant :</span>
            <span class="projection-val font-mono text-success">{{ formatCurrency(availableAdvance) }}</span>
          </div>
          <div class="projection-row minus">
            <span class="projection-label">Montant à rembourser :</span>
            <span class="projection-val font-mono text-danger">- {{ formatCurrency(amount || 0) }}</span>
          </div>
          <div class="projection-divider" />
          <div class="projection-row total">
            <span class="projection-label"><strong>Avance restante après décaissement :</strong></span>
            <span class="projection-val font-mono font-bold" :class="remainingAdvance > 0 ? 'text-success' : 'text-muted'">
              {{ formatCurrency(remainingAdvance) }}
            </span>
          </div>
        </div>

        <!-- Modal Actions -->
        <div class="modal-actions">
          <AppButton
            type="button"
            variant="ghost"
            @click="emit('update:modelValue', false)"
            :disabled="submitting"
          >
            Annuler
          </AppButton>
          <AppButton
            type="submit"
            variant="primary"
            :loading="submitting"
            :disabled="!isValid"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Valider et Décaisser Espèces
          </AppButton>
        </div>
      </form>

      <div v-else class="modal-actions">
        <AppButton variant="secondary" @click="emit('update:modelValue', false)">
          Fermer
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.refund-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.error-alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-danger-subtle, rgba(239, 68, 68, 0.1));
  color: var(--color-danger, #ef4444);
  border: 1px solid var(--color-danger-border, rgba(239, 68, 68, 0.25));
  border-radius: 8px;
  font-size: 0.875rem;
}

.warning-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 8px;
  font-size: 0.875rem;
}

.warning-banner p {
  margin: 0.25rem 0 0 0;
  color: var(--color-text-muted, #64748b);
}

.client-advance-banner {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.04) 100%);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.client-banner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.client-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.client-code {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--color-text-muted, #64748b);
  text-transform: uppercase;
}

.client-name {
  font-size: 1.05rem;
  color: var(--color-text-main, #0f172a);
}

.advance-pill {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
}

.advance-pill-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  color: #059669;
}

.advance-pill-val {
  font-size: 1.15rem;
  font-weight: 700;
  color: #047857;
}

.refund-form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.label-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.35rem;
}

.quick-action-btn {
  background: none;
  border: none;
  color: var(--color-primary, #2563eb);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  transition: background 0.15s;
}

.quick-action-btn:hover {
  background: var(--color-primary-subtle, rgba(37, 99, 235, 0.08));
  text-decoration: underline;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted, #475569);
}

.amount-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.amount-input {
  padding-right: 3.5rem;
  font-size: 1.25rem;
  font-weight: 700;
  font-family: monospace;
  color: var(--color-text-main, #0f172a);
}

.amount-input-wrap.is-invalid .amount-input {
  border-color: var(--color-danger, #ef4444);
  background: rgba(239, 68, 68, 0.04);
}

.input-error-msg {
  font-size: 0.78rem;
  color: var(--color-danger, #ef4444);
  margin-top: 0.25rem;
}

.currency-tag {
  position: absolute;
  right: 1rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-muted, #94a3b8);
  pointer-events: none;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 0.625rem 0.85rem;
  border: 1px solid var(--color-border, #cbd5e1);
  border-radius: 6px;
  font-size: 0.9rem;
  color: var(--color-text-main, #0f172a);
  background: var(--color-bg-card, #ffffff);
  box-sizing: border-box;
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.payment-method-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.85rem;
  background: var(--color-bg-subtle, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-main, #334155);
}

.projection-card {
  background: var(--color-bg-subtle, #f8fafc);
  border: 1px dashed var(--color-border, #cbd5e1);
  border-radius: 8px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.projection-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}

.projection-divider {
  height: 1px;
  background: var(--color-border, #e2e8f0);
  margin: 0.3rem 0;
}

.projection-row.total {
  font-size: 0.95rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border, #e2e8f0);
}

.text-success {
  color: #059669;
}

.text-danger {
  color: #dc2626;
}

.text-muted {
  color: #64748b;
}

.font-mono {
  font-family: monospace;
}

.font-bold {
  font-weight: 700;
}
</style>
