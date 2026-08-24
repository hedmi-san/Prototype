<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { expenseService } from '../../services/admin-reports.service';
import type { Expense, ExpenseCategory } from '../../types';
import { formatCurrency, formatDate, formatExpenseCategory } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';

const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();

const expenses = ref<Expense[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const categoryFilter = ref('');

// Success alert
const successMessage = ref('');
let successTimeout: number | undefined;
function showSuccess(msg: string) {
  successMessage.value = msg;
  if (successTimeout) clearTimeout(successTimeout);
  successTimeout = window.setTimeout(() => {
    successMessage.value = '';
  }, 4000);
}

// Create / Edit Modal State
const showModal = ref(false);
const editingExpense = ref<Expense | null>(null);
const form = ref({
  warehouseId: 0,
  category: 'ELECTRICITY' as ExpenseCategory,
  amount: 0,
  description: '',
  expenseDate: new Date().toISOString().split('T')[0],
});
const saving = ref(false);
const errorMessage = ref('');

// Delete Confirmation Modal State
const showDeleteModal = ref(false);
const expenseToDelete = ref<Expense | null>(null);
const deleteLoading = ref(false);
const deleteErrorMessage = ref('');

onMounted(async () => {
  await fetchExpenses();
});

async function fetchExpenses() {
  loading.value = true;
  try {
    expenses.value = await expenseService.getExpenses(authStore.activeWarehouseId || undefined);
  } catch (err) {
    console.error('Failed to load expenses', err);
  } finally {
    loading.value = false;
  }
}

const filteredExpenses = computed(() => {
  return expenses.value.filter((e) => {
    const matchesCat = !categoryFilter.value || e.category === categoryFilter.value;
    if (!matchesCat) return false;

    if (!searchQuery.value.trim()) return true;
    const q = searchQuery.value.toLowerCase();
    return (
      e.description.toLowerCase().includes(q) ||
      e.warehouseName.toLowerCase().includes(q) ||
      (e.createdByName && e.createdByName.toLowerCase().includes(q))
    );
  });
});

const totalExpensesAmount = computed(() => {
  return filteredExpenses.value.reduce((sum, e) => sum + e.amount, 0);
});

function canModifyExpense(e: Expense): boolean {
  if (authStore.isAdmin || authStore.isSuperManager) return true;
  if (authStore.isManager || authStore.isAccountant) {
    return e.warehouseId === authStore.user?.warehouseId;
  }
  return false;
}

function openCreateModal() {
  editingExpense.value = null;
  form.value = {
    warehouseId: authStore.activeWarehouseId || warehouseStore.warehouses[0]?.id || 1,
    category: 'ELECTRICITY',
    amount: 0,
    description: '',
    expenseDate: new Date().toISOString().split('T')[0],
  };
  errorMessage.value = '';
  showModal.value = true;
}

function openEditModal(e: Expense) {
  editingExpense.value = e;
  form.value = {
    warehouseId: e.warehouseId,
    category: e.category as ExpenseCategory,
    amount: e.amount,
    description: e.description,
    expenseDate: e.expenseDate ? e.expenseDate.split('T')[0] : new Date().toISOString().split('T')[0],
  };
  errorMessage.value = '';
  showModal.value = true;
}

async function handleSave() {
  if (form.value.amount <= 0) {
    errorMessage.value = 'Le montant doit être strictement supérieur à 0';
    return;
  }
  if (!form.value.description.trim()) {
    errorMessage.value = 'La description est obligatoire';
    return;
  }

  saving.value = true;
  errorMessage.value = '';
  try {
    if (editingExpense.value) {
      await expenseService.updateExpense(editingExpense.value.id, form.value);
      showSuccess(`Dépense de ${formatCurrency(form.value.amount)} mise à jour avec succès.`);
    } else {
      await expenseService.createExpense(form.value);
      showSuccess(`Dépense de ${formatCurrency(form.value.amount)} enregistrée avec succès.`);
    }
    showModal.value = false;
    await fetchExpenses();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || "Échec de l'enregistrement de la dépense";
  } finally {
    saving.value = false;
  }
}

function openDeleteModal(e: Expense) {
  expenseToDelete.value = e;
  deleteErrorMessage.value = '';
  showDeleteModal.value = true;
}

async function handleDeleteConfirm() {
  if (!expenseToDelete.value) return;

  deleteLoading.value = true;
  deleteErrorMessage.value = '';
  try {
    await expenseService.deleteExpense(expenseToDelete.value.id);
    showSuccess(`Dépense de ${formatCurrency(expenseToDelete.value.amount)} (${formatExpenseCategory(expenseToDelete.value.category)}) supprimée avec succès.`);
    showDeleteModal.value = false;
    expenseToDelete.value = null;
    await fetchExpenses();
  } catch (err: any) {
    deleteErrorMessage.value = err.response?.data?.message || 'Échec de la suppression de la dépense';
  } finally {
    deleteLoading.value = false;
  }
}
</script>

<template>
  <div class="expenses-view">
    <!-- Success Banner -->
    <div v-if="successMessage" class="success-banner">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <span>{{ successMessage }}</span>
    </div>

    <div class="page-header">
      <div>
        <h1 class="page-title">Dépenses d'Exploitation</h1>
        <p class="text-muted">Factures de services, carburant, loyers et charges de maintenance des entrepôts</p>
      </div>
      <div class="header-actions">
        <AppButton variant="primary" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Enregistrer une Dépense
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
          placeholder="Rechercher par description, entrepôt..."
          class="search-input"
        />
      </div>

      <div class="type-filter">
        <select v-model="categoryFilter" class="filter-select">
          <option value="">Toutes les catégories</option>
          <option value="ELECTRICITY">Électricité</option>
          <option value="WATER">Eau</option>
          <option value="RENT">Loyer</option>
          <option value="FUEL">Carburant</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="OTHER">Autre charge</option>
        </select>
      </div>

      <div class="total-badge font-mono">
        Total : <strong>{{ formatCurrency(totalExpensesAmount) }}</strong>
      </div>
    </div>

    <!-- Expenses Table -->
    <AppTable :loading="loading" :empty="!filteredExpenses.length" empty-text="Aucune dépense enregistrée" :columns-count="7">
      <template #header>
        <th>Date</th>
        <th>Entrepôt</th>
        <th>Catégorie</th>
        <th>Description</th>
        <th>Montant</th>
        <th>Enregistré par</th>
        <th>Actions</th>
      </template>
      <template #body>
        <tr v-for="e in filteredExpenses" :key="e.id">
          <td class="font-mono text-caption">{{ formatDate(e.expenseDate) }}</td>
          <td><strong>{{ e.warehouseName }}</strong></td>
          <td>
            <AppBadge variant="neutral" size="sm">{{ formatExpenseCategory(e.category) }}</AppBadge>
          </td>
          <td>{{ e.description }}</td>
          <td class="font-mono font-bold">{{ formatCurrency(e.amount) }}</td>
          <td class="text-caption">{{ e.createdByName || 'Système' }}</td>
          <td>
            <div v-if="canModifyExpense(e)" class="row-actions">
              <button class="icon-action-btn" title="Modifier cette dépense" @click="openEditModal(e)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Modifier
              </button>
              <button class="icon-action-btn btn-danger-action" title="Supprimer cette dépense" @click="openDeleteModal(e)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                Supprimer
              </button>
            </div>
            <span v-else class="text-muted text-caption">Lecture seule</span>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Create / Edit Modal -->
    <AppModal
      v-model="showModal"
      :title="editingExpense ? 'Modifier la Dépense d\'Exploitation' : 'Enregistrer une Dépense d\'Exploitation'"
      max-width="480px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleSave">
        <div class="app-input-group">
          <label class="input-label">Entrepôt</label>
          <select
            v-model.number="form.warehouseId"
            class="app-select"
            :disabled="!authStore.isAdmin && !authStore.isSuperManager"
            required
          >
            <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
              {{ w.name }} ({{ w.code }})
            </option>
          </select>
        </div>

        <div class="app-input-group">
          <label class="input-label">Catégorie</label>
          <select v-model="form.category" class="app-select" required>
            <option value="ELECTRICITY">Électricité</option>
            <option value="WATER">Eau</option>
            <option value="RENT">Loyer</option>
            <option value="FUEL">Carburant</option>
            <option value="MAINTENANCE">Entretien & Maintenance</option>
            <option value="OTHER">Autre charge</option>
          </select>
        </div>

        <AppInput
          v-model="form.amount"
          type="number"
          label="Montant de la Dépense (DA)"
          placeholder="0.00"
          required
        />

        <AppInput
          v-model="form.description"
          label="Description / Réf Facture"
          placeholder="ex. Facture électricité Sonelgaz T3 2026"
          required
        />

        <AppInput
          v-model="form.expenseDate"
          type="date"
          label="Date de la Dépense"
          required
        />
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSave">
          {{ editingExpense ? 'Enregistrer les Modifications' : 'Enregistrer la Dépense' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- Delete Confirmation Modal -->
    <AppModal
      v-model="showDeleteModal"
      title="Supprimer la Dépense"
      max-width="480px"
    >
      <div v-if="deleteErrorMessage" class="modal-error mb-3">
        {{ deleteErrorMessage }}
      </div>

      <div v-if="expenseToDelete" class="delete-dialog-content">
        <p class="delete-warning-text">
          Êtes-vous sûr de vouloir supprimer cette dépense de
          <strong>{{ formatCurrency(expenseToDelete.amount) }}</strong> ?
        </p>

        <div class="delete-info-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <div><strong>Catégorie :</strong> {{ formatExpenseCategory(expenseToDelete.category) }}</div>
            <div><strong>Entrepôt :</strong> {{ expenseToDelete.warehouseName }}</div>
            <div><strong>Date :</strong> {{ formatDate(expenseToDelete.expenseDate) }}</div>
            <div v-if="expenseToDelete.description"><strong>Description :</strong> {{ expenseToDelete.description }}</div>
            <div class="text-danger mt-1">Cette opération mettra à jour les rapports financiers et sera consignée dans le journal d'audit.</div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="delete-footer-actions">
          <AppButton variant="secondary" :disabled="deleteLoading" @click="showDeleteModal = false">
            Annuler
          </AppButton>
          <AppButton
            variant="danger"
            :loading="deleteLoading"
            @click="handleDeleteConfirm"
          >
            Confirmer la Suppression
          </AppButton>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.expenses-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.success-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: var(--color-success-bg, rgba(16, 185, 129, 0.1));
  color: var(--color-success, #10b981);
  border: 1px solid var(--color-success-border, rgba(16, 185, 129, 0.2));
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  animation: fadeIn 0.2s ease-in-out;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 440px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

.search-input, .filter-select {
  height: 38px;
  padding: 8px 12px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
}

.search-input {
  width: 100%;
  padding-left: 36px;
}

.total-badge {
  margin-left: auto;
  font-size: 13px;
  background-color: var(--color-surface);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.font-bold {
  font-weight: 600;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-action-btn:hover {
  background-color: var(--color-bg-hover);
  border-color: var(--color-border-hover);
}

.btn-danger-action {
  color: var(--color-danger);
}

.btn-danger-action:hover {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger-border);
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

.app-select:disabled {
  background-color: var(--color-surface-hover);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.modal-error {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.delete-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.delete-warning-text {
  font-size: 14px;
  color: var(--color-text-primary);
  line-height: 1.5;
  margin: 0;
}

.delete-info-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-radius: var(--radius-sm);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.delete-info-box svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--color-danger);
}

.delete-footer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
}

.mt-1 { margin-top: 4px; }
.mb-3 { margin-bottom: 12px; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
