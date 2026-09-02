<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { Client, Sale } from '../../types';
import { clientService } from '../../services/client.service';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { useAuthStore } from '../../stores/auth.store';
import { formatCurrency, formatDate } from '../../utils/formatters';
import AppModal from '../common/AppModal.vue';
import AppButton from '../common/AppButton.vue';
import AppInput from '../common/AppInput.vue';
import AppClientCombobox from '../common/AppClientCombobox.vue';

interface Props {
  modelValue: boolean;
  client?: Client | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'saved', payment: any): void;
}>();

const warehouseStore = useWarehouseStore();
const authStore = useAuthStore();

const clientsList = ref<Client[]>([]);
const selectedClientId = ref<number | null>(null);
const selectedWarehouseId = ref<number>(authStore.activeWarehouseId || warehouseStore.warehouses[0]?.id || 1);
const amount = ref<number>(0);
const paymentMethod = ref<string>('CASH');
const referenceNumber = ref('');
const notes = ref('');
const paymentDate = ref(new Date().toISOString().split('T')[0]);

const unpaidInvoices = ref<Sale[]>([]);
const allocations = ref<Record<number, number>>({});
const loadingInvoices = ref(false);
const submitting = ref(false);
const errorMessage = ref('');

const selectedClient = computed(() => {
  if (props.client) return props.client;
  return clientsList.value.find((c) => c.id === selectedClientId.value) || null;
});

const totalAllocated = computed(() => {
  return Object.values(allocations.value).reduce((sum, val) => sum + (Number(val) || 0), 0);
});

const unallocatedRemainder = computed(() => {
  return Math.max(0, (amount.value || 0) - totalAllocated.value);
});

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      errorMessage.value = '';
      submitting.value = false;
      amount.value = 0;
      referenceNumber.value = '';
      notes.value = '';
      paymentDate.value = new Date().toISOString().split('T')[0];
      allocations.value = {};

      if (props.client) {
        selectedClientId.value = props.client.id;
        await fetchUnpaidInvoices(props.client.id);
      } else {
        await loadClients();
      }
    }
  }
);

watch(selectedClientId, async (newId) => {
  if (newId) {
    await fetchUnpaidInvoices(newId);
  } else {
    unpaidInvoices.value = [];
    allocations.value = {};
  }
});

async function loadClients() {
  try {
    const res = await clientService.getClients({ limit: 500, activeOnly: true });
    clientsList.value = res.items;
    if (!selectedClientId.value && res.items.length > 0) {
      // Pick first non-default if available
      const nonDef = res.items.find((c) => !c.isDefault) || res.items[0];
      selectedClientId.value = nonDef.id;
    }
  } catch (err) {
    console.error('Failed to load clients', err);
  }
}

async function fetchUnpaidInvoices(clientId: number) {
  loadingInvoices.value = true;
  allocations.value = {};
  try {
    const res = await clientService.getClientInvoices(clientId);
    unpaidInvoices.value = res.filter((s) => s.paymentStatus !== 'PAID' && s.status !== 'CANCELLED');
  } catch (err) {
    console.error('Failed to load invoices', err);
  } finally {
    loadingInvoices.value = false;
  }
}

function autoAllocateFifo() {
  allocations.value = {};
  let remaining = Number(amount.value) || 0;
  if (remaining <= 0) return;

  // Invoices sorted oldest first
  const sorted = [...unpaidInvoices.value].sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime());
  for (const inv of sorted) {
    const remToPay = inv.remainingAmount !== undefined ? inv.remainingAmount : (inv.totalAmount - (inv.paidAmount || 0));
    if (remToPay <= 0) continue;

    const alloc = Math.min(remaining, remToPay);
    allocations.value[inv.id] = alloc;
    remaining -= alloc;
    if (remaining <= 0) break;
  }
}

function clearAllocations() {
  allocations.value = {};
}

async function submitPayment() {
  errorMessage.value = '';
  if (!selectedClientId.value) {
    errorMessage.value = 'Veuillez sélectionner un client.';
    return;
  }
  if (!amount.value || amount.value <= 0) {
    errorMessage.value = 'Le montant du versement doit être supérieur à 0 DZD.';
    return;
  }
  if (totalAllocated.value > amount.value + 0.01) {
    errorMessage.value = `Le montant alloué (${formatCurrency(totalAllocated.value)}) dépasse le versement (${formatCurrency(amount.value)}).`;
    return;
  }

  // Format allocation list
  const allocList = Object.entries(allocations.value)
    .filter(([_, val]) => Number(val) > 0)
    .map(([saleId, val]) => ({
      saleId: Number(saleId),
      amount: Number(val),
    }));

  submitting.value = true;
  try {
    const payload = {
      clientId: selectedClientId.value,
      warehouseId: selectedWarehouseId.value,
      amount: Number(amount.value),
      paymentMethod: paymentMethod.value,
      referenceNumber: referenceNumber.value.trim() || undefined,
      paymentDate: paymentDate.value,
      notes: notes.value.trim() || undefined,
      allocations: allocList.length > 0 ? allocList : undefined,
    };

    const res = await clientService.createPayment(payload);
    emit('saved', res);
    emit('update:modelValue', false);
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || err.message || "Erreur lors de l'enregistrement du versement";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    title="Encaisser un Versement Client"
    max-width="680px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="payment-form">
      <div v-if="errorMessage" class="error-banner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Client Selection -->
      <div class="form-section">
        <label class="form-label">Client *</label>
        <div v-if="props.client" class="client-fixed-card">
          <div class="client-fixed-info">
            <span class="client-code">{{ props.client.code }}</span>
            <strong class="client-name">{{ props.client.name }}</strong>
            <span v-if="props.client.phone" class="client-phone">{{ props.client.phone }}</span>
          </div>
          <div class="client-fixed-balance">
            <span class="balance-label">Solde actuel:</span>
            <strong :class="['balance-val', props.client.currentBalance > 0 ? 'debt' : (props.client.currentBalance < 0 ? 'credit' : 'settled')]">
              {{ formatCurrency(props.client.currentBalance) }}
            </strong>
          </div>
        </div>
        <AppClientCombobox
          v-else
          v-model="selectedClientId"
          :exclude-default="true"
          placeholder="Rechercher un client (nom, code, téléphone)..."
        />
      </div>

      <!-- Payment Main Details -->
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Montant du Versement (DZD) *</label>
          <div class="amount-input-wrap">
            <input
              v-model.number="amount"
              type="number"
              min="1"
              step="any"
              placeholder="0.00"
              class="form-input amount-input"
            />
            <span class="currency-tag">DZD</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Dépôt d'encaissement *</label>
          <select v-model="selectedWarehouseId" class="form-select">
            <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
              {{ w.name }} ({{ w.code }})
            </option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Mode de Règlement *</label>
          <select v-model="paymentMethod" class="form-select">
            <option value="CASH">Espèces</option>
            <option value="CHECK">Chèque Bancaire</option>
            <option value="BANK_TRANSFER">Virement Bancaire</option>
            <option value="CARD">Carte Bancaire (CIB/Edahabia)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Date du Règlement</label>
          <input v-model="paymentDate" type="date" class="form-input" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">N° de Chèque / Réf. Virement (Optionnel)</label>
        <input
          v-model="referenceNumber"
          type="text"
          placeholder="Ex: CHQ-998822 ou VIR-BSTA-1029"
          class="form-input"
        />
      </div>

      <!-- Invoice Allocations Table -->
      <div v-if="selectedClientId" class="allocations-section">
        <div class="allocations-header">
          <div>
            <h4 class="allocations-title">Allocation aux Factures Impayées</h4>
            <p class="allocations-subtitle">
              Lier ce versement à des factures spécifiques ou laisser comme avance libre en compte.
            </p>
          </div>
          <div v-if="unpaidInvoices.length > 0" class="allocations-actions">
            <AppButton size="sm" variant="ghost" @click="autoAllocateFifo">Auto (FIFO)</AppButton>
            <AppButton size="sm" variant="ghost" @click="clearAllocations">Effacer</AppButton>
          </div>
        </div>

        <div v-if="loadingInvoices" class="alloc-loading">
          Chargement des factures en attente...
        </div>

        <div v-else-if="unpaidInvoices.length === 0" class="alloc-empty">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>Aucune facture impayée pour ce client. Ce versement sera crédité comme avance sur compte.</span>
        </div>

        <div v-else class="alloc-table-wrap">
          <table class="alloc-table">
            <thead>
              <tr>
                <th>Facture</th>
                <th>Date</th>
                <th class="text-right">Montant</th>
                <th class="text-right">Reste Dû</th>
                <th class="text-right" style="width: 140px;">Montant Alloué</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inv in unpaidInvoices" :key="inv.id">
                <td>
                  <strong>{{ inv.invoiceNumber }}</strong>
                </td>
                <td>{{ formatDate(inv.saleDate) }}</td>
                <td class="text-right">{{ formatCurrency(inv.totalAmount) }}</td>
                <td class="text-right font-semibold text-danger">
                  {{ formatCurrency(inv.remainingAmount ?? (inv.totalAmount - (inv.paidAmount || 0))) }}
                </td>
                <td class="text-right">
                  <input
                    v-model.number="allocations[inv.id]"
                    type="number"
                    min="0"
                    :max="inv.remainingAmount ?? (inv.totalAmount - (inv.paidAmount || 0))"
                    step="any"
                    placeholder="0"
                    class="alloc-input"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <div class="alloc-summary">
            <div class="summary-item">
              <span>Total Alloué :</span>
              <strong>{{ formatCurrency(totalAllocated) }}</strong>
            </div>
            <div class="summary-item">
              <span>Avance Libre Non Allouée :</span>
              <strong :class="unallocatedRemainder > 0 ? 'text-success' : ''">
                {{ formatCurrency(unallocatedRemainder) }}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div class="form-group" style="margin-top: 16px;">
        <label class="form-label">Notes / Remarques</label>
        <textarea
          v-model="notes"
          rows="2"
          placeholder="Ex: Reçu par le responsable commercial au comptoir..."
          class="form-textarea"
        ></textarea>
      </div>
    </div>

    <template #footer>
      <AppButton variant="secondary" :disabled="submitting" @click="emit('update:modelValue', false)">
        Annuler
      </AppButton>
      <AppButton variant="primary" :loading="submitting" @click="submitPayment">
        Confirmer le Versement ({{ formatCurrency(amount || 0) }})
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.payment-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-danger-subtle, rgba(239, 68, 68, 0.1));
  color: var(--color-danger, #ef4444);
  border: 1px solid var(--color-danger-border, rgba(239, 68, 68, 0.3));
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 13px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.client-fixed-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 12px 16px;
}

.client-fixed-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.client-code {
  font-size: 12px;
  background: var(--color-primary-subtle, rgba(59, 130, 246, 0.1));
  color: var(--color-primary);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-weight: 600;
}

.client-name {
  font-size: 14px;
  color: var(--color-text-primary);
}

.client-phone {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.client-fixed-balance {
  text-align: right;
}

.balance-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  display: block;
}

.balance-val {
  font-size: 14px;
}

.balance-val.debt {
  color: #ef4444;
}

.balance-val.credit {
  color: #10b981;
}

.balance-val.settled {
  color: #64748b;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--color-primary);
}

.amount-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.amount-input {
  font-size: 16px;
  font-weight: 600;
  padding-right: 50px;
}

.currency-tag {
  position: absolute;
  right: 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.allocations-section {
  background: var(--color-bg-subtle, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-top: 6px;
}

.allocations-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.allocations-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.allocations-subtitle {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 2px 0 0 0;
}

.allocations-actions {
  display: flex;
  gap: 6px;
}

.alloc-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 12px;
}

.alloc-loading {
  font-size: 12px;
  color: var(--color-text-secondary);
  padding: 8px 0;
}

.alloc-table-wrap {
  overflow-x: auto;
}

.alloc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.alloc-table th {
  text-align: left;
  padding: 8px;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
}

.alloc-table td {
  padding: 8px;
  border-bottom: 1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.05));
  color: var(--color-text-primary);
}

.alloc-input {
  width: 120px;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  text-align: right;
  background: var(--color-bg);
  color: var(--color-text-primary);
}

.alloc-summary {
  display: flex;
  justify-content: flex-end;
  gap: 20px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-border);
  font-size: 12px;
}

.summary-item {
  display: flex;
  gap: 6px;
}

.text-right {
  text-align: right;
}

.text-danger {
  color: #ef4444;
}

.text-success {
  color: #10b981;
}

.font-semibold {
  font-weight: 600;
}
</style>
