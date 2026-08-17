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

const showModal = ref(false);
const form = ref({
  warehouseId: 0,
  category: 'ELECTRICITY' as ExpenseCategory,
  amount: 0,
  description: '',
  expenseDate: new Date().toISOString().split('T')[0],
});

const saving = ref(false);
const errorMessage = ref('');

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

function openCreateModal() {
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
    await expenseService.createExpense(form.value);
    showModal.value = false;
    await fetchExpenses();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || "Échec de l'enregistrement de la dépense";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="expenses-view">
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
          <option value="MAINTENANCE">Entretien & Maintenance</option>
          <option value="OTHER">Autre charge</option>
        </select>
      </div>

      <div class="total-badge font-mono">
        Total : <strong>{{ formatCurrency(totalExpensesAmount) }}</strong>
      </div>
    </div>

    <!-- Expenses Table -->
    <AppTable :loading="loading" :empty="!filteredExpenses.length" empty-text="Aucune dépense enregistrée" :columns-count="6">
      <template #header>
        <th>Date</th>
        <th>Entrepôt</th>
        <th>Catégorie</th>
        <th>Description</th>
        <th>Montant</th>
        <th>Enregistré par</th>
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
        </tr>
      </template>
    </AppTable>

    <!-- Create Modal -->
    <AppModal
      v-model="showModal"
      title="Enregistrer une Dépense d'Exploitation"
      max-width="480px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleSave">
        <div class="app-input-group">
          <label class="input-label">Entrepôt</label>
          <select v-model.number="form.warehouseId" class="app-select" required>
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
          Enregistrer la Dépense
        </AppButton>
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

.modal-error {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.mb-3 { margin-bottom: 12px; }
</style>
