<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { salaryService, employeeService } from '../../services/admin-reports.service';
import type { SalaryRecord, Employee } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';

const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();

const salaries = ref<SalaryRecord[]>([]);
const employees = ref<Employee[]>([]);
const loading = ref(true);
const searchQuery = ref('');

const showModal = ref(false);
const form = ref({
  employeeId: 0,
  period: new Date().toISOString().slice(0, 7), // YYYY-MM
  baseSalary: 0,
  bonus1: 0,
  bonus2: 0,
  paymentDate: new Date().toISOString().split('T')[0],
});

const saving = ref(false);
const errorMessage = ref('');

onMounted(async () => {
  await Promise.all([fetchSalaries(), fetchEmployees()]);
});

async function fetchSalaries() {
  loading.value = true;
  try {
    salaries.value = await salaryService.getSalaries(authStore.activeWarehouseId || undefined);
  } catch (err) {
    console.error('Failed to load salaries', err);
  } finally {
    loading.value = false;
  }
}

async function fetchEmployees() {
  try {
    employees.value = await employeeService.getEmployees(authStore.activeWarehouseId || undefined);
  } catch (err) {
    console.error('Failed to load employees', err);
  }
}

const filteredSalaries = computed(() => {
  if (!searchQuery.value.trim()) return salaries.value;
  const q = searchQuery.value.toLowerCase();
  return salaries.value.filter(
    (s) =>
      s.employeeName.toLowerCase().includes(q) ||
      s.warehouseName.toLowerCase().includes(q) ||
      s.period.includes(q)
  );
});

const totalDisbursed = computed(() => {
  return filteredSalaries.value.reduce((sum, s) => sum + s.totalAmount, 0);
});

function onEmployeeSelectChange() {
  const emp = employees.value.find((e) => e.id === form.value.employeeId);
  if (emp) {
    form.value.baseSalary = emp.monthlySalary;
  }
}

function openDisburseModal() {
  const defaultEmp = employees.value[0];
  form.value = {
    employeeId: defaultEmp ? defaultEmp.id : 0,
    period: new Date().toISOString().slice(0, 7),
    baseSalary: defaultEmp ? defaultEmp.monthlySalary : 0,
    bonus1: 0,
    bonus2: 0,
    paymentDate: new Date().toISOString().split('T')[0],
  };
  errorMessage.value = '';
  showModal.value = true;
}

const computedTotal = computed(() => {
  return (form.value.baseSalary || 0) + (form.value.bonus1 || 0) + (form.value.bonus2 || 0);
});

async function handleSaveSalary() {
  saving.value = true;
  errorMessage.value = '';
  try {
    await salaryService.recordSalary(form.value);
    showModal.value = false;
    await fetchSalaries();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Échec de l\'enregistrement du versement de salaire';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="salaries-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Gestion des Salaires</h1>
        <p class="text-muted">Traitement de la paie mensuelle, primes de performance et audit des rémunérations</p>
      </div>
      <div class="header-actions">
        <AppButton variant="primary" @click="openDisburseModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          Verser un Salaire
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
          placeholder="Rechercher par nom d'employé, entrepôt, période..."
          class="search-input"
        />
      </div>

      <div class="total-badge font-mono">
        Masse salariale totale : <strong>{{ formatCurrency(totalDisbursed) }}</strong>
      </div>
    </div>

    <!-- Salaries Table -->
    <AppTable :loading="loading" :empty="!filteredSalaries.length" empty-text="Aucun historique de salaire trouvé" :columns-count="8">
      <template #header>
        <th>Période</th>
        <th>Employé</th>
        <th>Entrepôt</th>
        <th>Salaire de Base</th>
        <th>Prime 1</th>
        <th>Prime 2</th>
        <th>Total Versé</th>
        <th>Date de Paiement</th>
      </template>
      <template #body>
        <tr v-for="s in filteredSalaries" :key="s.id">
          <td class="font-mono font-bold">{{ s.period }}</td>
          <td>
            <strong>{{ s.employeeName }}</strong>
            <span class="text-caption" style="display: block;">{{ s.employeePosition }}</span>
          </td>
          <td>{{ s.warehouseName }}</td>
          <td class="font-mono">{{ formatCurrency(s.baseSalary) }}</td>
          <td class="font-mono text-muted">{{ formatCurrency(s.bonus1) }}</td>
          <td class="font-mono text-muted">{{ formatCurrency(s.bonus2) }}</td>
          <td class="font-mono font-bold text-success">{{ formatCurrency(s.totalAmount) }}</td>
          <td class="font-mono text-caption">{{ formatDate(s.paymentDate) }}</td>
        </tr>
      </template>
    </AppTable>

    <!-- Disburse Salary Modal -->
    <AppModal
      v-model="showModal"
      title="Verser le Salaire Mensuel de l'Employé"
      max-width="500px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleSaveSalary">
        <div class="app-input-group">
          <label class="input-label">Sélectionner l'Employé</label>
          <select
            v-model.number="form.employeeId"
            class="app-select"
            required
            @change="onEmployeeSelectChange"
          >
            <option v-for="emp in employees" :key="emp.id" :value="emp.id">
              {{ emp.fullName }} ({{ emp.position }} - {{ emp.warehouseName }})
            </option>
          </select>
        </div>

        <div class="form-row">
          <AppInput
            v-model="form.period"
            label="Période de Paie (AAAA-MM)"
            placeholder="2026-08"
            required
          />
          <AppInput
            v-model="form.paymentDate"
            type="date"
            label="Date de Paiement"
            required
          />
        </div>

        <AppInput
          v-model="form.baseSalary"
          type="number"
          label="Salaire de Base (DA)"
          placeholder="0.00"
          required
        />

        <div class="form-row">
          <AppInput
            v-model="form.bonus1"
            type="number"
            label="Prime de Performance (DA)"
            placeholder="0.00"
          />
          <AppInput
            v-model="form.bonus2"
            type="number"
            label="Heures Supp. / Autre Prime (DA)"
            placeholder="0.00"
          />
        </div>

        <div class="salary-total-preview">
          <span>Montant Net Versé :</span>
          <strong class="font-mono font-bold text-h2">{{ formatCurrency(computedTotal) }}</strong>
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveSalary">
          Confirmer le Paiement
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.salaries-view {
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

.search-input {
  width: 100%;
  height: 38px;
  padding: 8px 12px 8px 36px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
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

.salary-total-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--color-surface);
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
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
