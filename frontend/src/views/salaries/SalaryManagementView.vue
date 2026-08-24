<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { salaryService, employeeService } from '../../services/admin-reports.service';
import type { SalaryRecord, Employee } from '../../types';
import type { ComputedPeriodRange } from '../../utils/periodNavigator';
import { formatCurrency, formatDate } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';
import AppPeriodNavigator from '../../components/common/AppPeriodNavigator.vue';
import AppPagination from '../../components/common/AppPagination.vue';
import ConfirmDialog from '../../components/common/ConfirmDialog.vue';

const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();

const salaries = ref<SalaryRecord[]>([]);
const employees = ref<Employee[]>([]);
const loading = ref(true);
const searchQuery = ref('');

// Period & Pagination state
const activeRange = ref<ComputedPeriodRange | null>(null);
const page = ref(1);
const limit = ref(25);
const total = ref(0);
const totalPages = ref(1);
const totalDisbursed = ref(0);

// Role authorization
const canManage = computed(() =>
  ['ADMIN', 'SUPER_MANAGER', 'MANAGER'].includes(authStore.user?.role || '')
);

// Create Disburse Modal
const showCreateModal = ref(false);
const createForm = ref({
  employeeId: 0,
  period: new Date().toISOString().slice(0, 7), // YYYY-MM
  baseSalary: 0,
  bonus1: 0,
  bonus2: 0,
  paymentDate: new Date().toISOString().split('T')[0],
});
const createSaving = ref(false);
const createError = ref('');

// Edit Modal
const showEditModal = ref(false);
const editingSalary = ref<SalaryRecord | null>(null);
const editForm = ref({
  period: '',
  baseSalary: 0,
  bonus1: 0,
  bonus2: 0,
  paymentDate: '',
});
const editSaving = ref(false);
const editError = ref('');

// Delete Confirm
const showDeleteDialog = ref(false);
const deletingSalary = ref<SalaryRecord | null>(null);
const deleting = ref(false);

onMounted(async () => {
  await fetchEmployees();
});

watch(
  () => authStore.activeWarehouseId,
  async (newWhId) => {
    page.value = 1;
    await Promise.all([fetchSalaries(), fetchEmployees(newWhId || undefined)]);
  }
);

let searchTimeout: any = null;
function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    page.value = 1;
    await fetchSalaries();
  }, 300);
}

async function onPeriodChange(range: ComputedPeriodRange) {
  activeRange.value = range;
  page.value = 1;
  await fetchSalaries();
}

function onPageChange(payload: { page: number; limit: number }) {
  page.value = payload.page;
  limit.value = payload.limit;
  fetchSalaries();
}

async function fetchSalaries() {
  loading.value = true;
  try {
    const res = await salaryService.getSalaries({
      warehouseId: authStore.activeWarehouseId || undefined,
      startDate: activeRange.value?.startDate,
      endDate: activeRange.value?.endDate,
      search: searchQuery.value.trim() || undefined,
      page: page.value,
      limit: limit.value,
    });
    salaries.value = res.items;
    total.value = res.pagination.total;
    totalPages.value = res.pagination.totalPages;
    totalDisbursed.value =
      res.summary?.totalDisbursed ??
      res.items.reduce((sum, s) => sum + s.totalAmount, 0);
  } catch (err) {
    console.error('Failed to load salaries', err);
  } finally {
    loading.value = false;
  }
}

async function fetchEmployees(whId?: number) {
  try {
    employees.value = await employeeService.getEmployees(
      whId !== undefined ? whId : authStore.activeWarehouseId || undefined
    );
  } catch (err) {
    console.error('Failed to load employees', err);
  }
}

function onEmployeeSelectChange() {
  const emp = employees.value.find((e) => e.id === createForm.value.employeeId);
  if (emp) {
    createForm.value.baseSalary = emp.baseSalary;
  }
}

function openCreateModal() {
  const defaultEmp = employees.value[0];
  const currentPeriod =
    activeRange.value?.startDate?.slice(0, 7) ||
    new Date().toISOString().slice(0, 7);
  createForm.value = {
    employeeId: defaultEmp ? defaultEmp.id : 0,
    period: currentPeriod,
    baseSalary: defaultEmp ? defaultEmp.baseSalary : 0,
    bonus1: 0,
    bonus2: 0,
    paymentDate: new Date().toISOString().split('T')[0],
  };
  createError.value = '';
  showCreateModal.value = true;
}

const computedCreateTotal = computed(() => {
  return (
    (Number(createForm.value.baseSalary) || 0) +
    (Number(createForm.value.bonus1) || 0) +
    (Number(createForm.value.bonus2) || 0)
  );
});

async function handleSaveSalary() {
  createSaving.value = true;
  createError.value = '';
  try {
    await salaryService.recordSalary(createForm.value);
    showCreateModal.value = false;
    await fetchSalaries();
  } catch (err: any) {
    createError.value =
      err.response?.data?.message ||
      'Échec de l\'enregistrement du versement de salaire';
  } finally {
    createSaving.value = false;
  }
}

function openEditModal(record: SalaryRecord) {
  editingSalary.value = record;
  editForm.value = {
    period: record.period,
    baseSalary: record.baseSalary,
    bonus1: record.bonus1,
    bonus2: record.bonus2,
    paymentDate: record.paymentDate
      ? String(record.paymentDate).slice(0, 10)
      : new Date().toISOString().split('T')[0],
  };
  editError.value = '';
  showEditModal.value = true;
}

const computedEditTotal = computed(() => {
  return (
    (Number(editForm.value.baseSalary) || 0) +
    (Number(editForm.value.bonus1) || 0) +
    (Number(editForm.value.bonus2) || 0)
  );
});

async function handleSaveEdit() {
  if (!editingSalary.value) return;
  editSaving.value = true;
  editError.value = '';
  try {
    await salaryService.updateSalary(editingSalary.value.id, editForm.value);
    showEditModal.value = false;
    await fetchSalaries();
  } catch (err: any) {
    editError.value =
      err.response?.data?.message ||
      'Échec de la modification du versement de salaire';
  } finally {
    editSaving.value = false;
  }
}

function confirmDelete(record: SalaryRecord) {
  deletingSalary.value = record;
  showDeleteDialog.value = true;
}

async function handleDelete() {
  if (!deletingSalary.value) return;
  deleting.value = true;
  try {
    await salaryService.deleteSalary(deletingSalary.value.id);
    showDeleteDialog.value = false;
    deletingSalary.value = null;
    await fetchSalaries();
  } catch (err: any) {
    console.error('Failed to delete salary record', err);
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="salaries-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Gestion des Salaires</h1>
        <p class="text-muted">Traitement de la paie mensuelle, primes de performance et audit des rémunérations</p>
      </div>
      <div class="header-actions">
        <AppButton variant="primary" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          Verser un Salaire
        </AppButton>
      </div>
    </div>

    <!-- Period Navigator -->
    <AppPeriodNavigator
      initial-granularity="month"
      @change="onPeriodChange"
    />

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
          @input="onSearchInput"
        />
      </div>

      <div class="total-badge font-mono">
        Masse salariale : <strong>{{ formatCurrency(totalDisbursed) }}</strong>
      </div>
    </div>

    <!-- Salaries Table -->
    <AppTable
      :loading="loading"
      :empty="!salaries.length"
      empty-text="Aucun historique de salaire trouvé pour cette période"
      :columns-count="canManage ? 9 : 8"
    >
      <template #header>
        <th>Période</th>
        <th>Employé</th>
        <th>Entrepôt</th>
        <th>Salaire de Base</th>
        <th>Prime 1</th>
        <th>Prime 2</th>
        <th>Total Versé</th>
        <th>Date de Paiement</th>
        <th v-if="canManage" style="text-align: right;">Actions</th>
      </template>
      <template #body>
        <tr v-for="s in salaries" :key="s.id">
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
          <td v-if="canManage" style="text-align: right;">
            <div class="actions-cell">
              <button
                class="action-btn action-edit"
                title="Modifier le versement"
                type="button"
                @click="openEditModal(s)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                class="action-btn action-delete"
                title="Supprimer le versement"
                type="button"
                @click="confirmDelete(s)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Pagination -->
    <AppPagination
      :page="page"
      :limit="limit"
      :total="total"
      :total-pages="totalPages"
      @change="onPageChange"
    />

    <!-- Disburse Salary Modal (Creation) -->
    <AppModal
      v-model="showCreateModal"
      title="Verser le Salaire Mensuel de l'Employé"
      max-width="500px"
    >
      <div v-if="createError" class="modal-error mb-3">
        {{ createError }}
      </div>

      <form class="modal-form" @submit.prevent="handleSaveSalary">
        <div class="app-input-group">
          <label class="input-label">Sélectionner l'Employé *</label>
          <select
            v-model.number="createForm.employeeId"
            class="app-select"
            required
            @change="onEmployeeSelectChange"
          >
            <option v-for="emp in employees" :key="emp.id" :value="emp.id">
              {{ emp.fullName }} ({{ emp.position }} - {{ emp.warehouseName }}) {{ emp.status && emp.status !== 'ACTIVE' ? `[${emp.status === 'ON_LEAVE' ? 'En congé' : emp.status === 'SUSPENDED' ? 'Suspendu' : 'Inactif'}]` : '' }}
            </option>
          </select>
        </div>

        <div class="form-row">
          <AppInput
            v-model="createForm.period"
            type="month"
            label="Période de Paie"
            required
          />
          <AppInput
            v-model="createForm.paymentDate"
            type="date"
            label="Date de Paiement"
            required
          />
        </div>

        <AppInput
          v-model="createForm.baseSalary"
          type="number"
          label="Salaire de Base (DA)"
          placeholder="0.00"
          required
        />

        <div class="form-row">
          <AppInput
            v-model="createForm.bonus1"
            type="number"
            label="Prime de Performance (DA)"
            placeholder="0.00"
          />
          <AppInput
            v-model="createForm.bonus2"
            type="number"
            label="Heures Supp. / Autre Prime (DA)"
            placeholder="0.00"
          />
        </div>

        <div class="salary-total-preview">
          <span>Montant Net Versé :</span>
          <strong class="font-mono font-bold text-h2">{{ formatCurrency(computedCreateTotal) }}</strong>
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showCreateModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="createSaving" @click="handleSaveSalary">
          Confirmer le Paiement
        </AppButton>
      </template>
    </AppModal>

    <!-- Edit Salary Modal -->
    <AppModal
      v-model="showEditModal"
      title="Modifier le Versement de Salaire"
      max-width="500px"
    >
      <div v-if="editError" class="modal-error mb-3">
        {{ editError }}
      </div>

      <div v-if="editingSalary" class="employee-info-card mb-3">
        <div class="info-row">
          <span class="info-label">Employé :</span>
          <strong>{{ editingSalary.employeeName }}</strong>
        </div>
        <div class="info-row">
          <span class="info-label">Entrepôt :</span>
          <span>{{ editingSalary.warehouseName }}</span>
        </div>
      </div>

      <form class="modal-form" @submit.prevent="handleSaveEdit">
        <div class="form-row">
          <AppInput
            v-model="editForm.period"
            type="month"
            label="Période de Paie"
            required
          />
          <AppInput
            v-model="editForm.paymentDate"
            type="date"
            label="Date de Paiement"
            required
          />
        </div>

        <AppInput
          v-model="editForm.baseSalary"
          type="number"
          label="Salaire de Base (DA)"
          placeholder="0.00"
          required
        />

        <div class="form-row">
          <AppInput
            v-model="editForm.bonus1"
            type="number"
            label="Prime de Performance (DA)"
            placeholder="0.00"
          />
          <AppInput
            v-model="editForm.bonus2"
            type="number"
            label="Heures Supp. / Autre Prime (DA)"
            placeholder="0.00"
          />
        </div>

        <div class="salary-total-preview">
          <span>Nouveau Montant Net :</span>
          <strong class="font-mono font-bold text-h2">{{ formatCurrency(computedEditTotal) }}</strong>
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showEditModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="editSaving" @click="handleSaveEdit">
          Enregistrer les Modifications
        </AppButton>
      </template>
    </AppModal>

    <!-- Delete Confirmation Dialog -->
    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Supprimer le versement de salaire"
      :message="`Êtes-vous sûr de vouloir supprimer définitivement le versement de salaire de ${deletingSalary?.employeeName} pour la période ${deletingSalary?.period} (${formatCurrency(deletingSalary?.totalAmount || 0)}) ?`"
      confirm-text="Supprimer"
      cancel-text="Annuler"
      variant="danger"
      :loading="deleting"
      @confirm="handleDelete"
    />
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
  transition: all var(--transition-fast);
}

.search-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
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

.actions-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--color-border);
  background-color: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background-color: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.action-edit:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.action-delete:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
  background-color: var(--color-danger-bg);
}

.employee-info-card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}

.info-row {
  display: flex;
  gap: 8px;
}

.info-label {
  color: var(--color-text-secondary);
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
  letter-spacing: 0.04em;
}

.app-select {
  width: 100%;
  height: 38px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  font-size: 13px;
  color: var(--color-text-primary);
  outline: none;
}

.app-select:focus {
  border-color: var(--color-primary);
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

.mb-3 {
  margin-bottom: 12px;
}
</style>
