<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { employeeService } from '../../services/admin-reports.service';
import type { Employee, EmployeeStatus } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';

const router = useRouter();
const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();

const employees = ref<Employee[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const statusFilter = ref<string>('ALL');

const showModal = ref(false);
const editingEmployee = ref<Employee | null>(null);
const form = ref({
  warehouseId: 0,
  fullName: '',
  nationalId: '',
  position: '',
  phone: '',
  hireDate: new Date().toISOString().split('T')[0],
  baseSalary: 55000,
  status: 'ACTIVE' as EmployeeStatus,
});

const saving = ref(false);
const errorMessage = ref('');

const statusOptions: { value: EmployeeStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Actif (En poste)' },
  { value: 'ON_LEAVE', label: 'En congé / Absent' },
  { value: 'SUSPENDED', label: 'Suspendu' },
  { value: 'TERMINATED', label: 'Inactif / Démissionnaire / Licencié' },
];

onMounted(async () => {
  await fetchEmployees();
});

async function fetchEmployees() {
  loading.value = true;
  try {
    employees.value = await employeeService.getEmployees({
      warehouseId: authStore.activeWarehouseId || undefined,
    });
  } catch (err) {
    console.error('Failed to load employees', err);
  } finally {
    loading.value = false;
  }
}

const statusCounts = computed(() => {
  const counts = {
    ALL: employees.value.length,
    ACTIVE: 0,
    ON_LEAVE: 0,
    SUSPENDED: 0,
    TERMINATED: 0,
  };
  for (const emp of employees.value) {
    const st = emp.status || (emp.active ? 'ACTIVE' : 'TERMINATED');
    if (counts[st] !== undefined) {
      counts[st]++;
    }
  }
  return counts;
});

const filteredEmployees = computed(() => {
  let list = employees.value;

  if (statusFilter.value !== 'ALL') {
    list = list.filter((e) => (e.status || (e.active ? 'ACTIVE' : 'TERMINATED')) === statusFilter.value);
  }

  if (!searchQuery.value.trim()) return list;
  const q = searchQuery.value.toLowerCase();
  return list.filter(
    (e) =>
      e.fullName.toLowerCase().includes(q) ||
      e.position.toLowerCase().includes(q) ||
      (e.nationalId && e.nationalId.toLowerCase().includes(q)) ||
      e.warehouseName.toLowerCase().includes(q)
  );
});

function openCreateModal() {
  editingEmployee.value = null;
  form.value = {
    warehouseId: authStore.activeWarehouseId || warehouseStore.activeWarehouses[0]?.id || 1,
    fullName: '',
    nationalId: '',
    position: 'Magasinier / Cariste',
    phone: '',
    hireDate: new Date().toISOString().split('T')[0],
    baseSalary: 55000,
    status: 'ACTIVE',
  };
  errorMessage.value = '';
  showModal.value = true;
}

function openEditModal(emp: Employee) {
  editingEmployee.value = emp;
  form.value = {
    warehouseId: emp.warehouseId,
    fullName: emp.fullName,
    nationalId: emp.nationalId || '',
    position: emp.position,
    phone: emp.phone || '',
    hireDate: emp.hireDate ? emp.hireDate.substring(0, 10) : new Date().toISOString().split('T')[0],
    baseSalary: emp.baseSalary !== undefined ? emp.baseSalary : 0,
    status: emp.status || (emp.active ? 'ACTIVE' : 'TERMINATED'),
  };
  errorMessage.value = '';
  showModal.value = true;
}

function navigateToProfile(employeeId: number) {
  router.push(`/employees/${employeeId}`);
}

async function handleSave() {
  if (!form.value.fullName.trim()) {
    errorMessage.value = 'Le nom complet est obligatoire';
    return;
  }
  if (!form.value.position.trim()) {
    errorMessage.value = 'Le poste / fonction est obligatoire';
    return;
  }

  saving.value = true;
  errorMessage.value = '';
  try {
    if (editingEmployee.value) {
      await employeeService.updateEmployee(editingEmployee.value.id, form.value);
    } else {
      await employeeService.createEmployee(form.value);
    }
    showModal.value = false;
    await fetchEmployees();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || "Échec de l'enregistrement du profil de l'employé";
  } finally {
    saving.value = false;
  }
}

function getStatusBadge(status?: EmployeeStatus | string) {
  switch (status) {
    case 'ACTIVE':
      return { variant: 'success' as const, label: 'Actif' };
    case 'ON_LEAVE':
      return { variant: 'warning' as const, label: 'En congé' };
    case 'SUSPENDED':
      return { variant: 'neutral' as const, label: 'Suspendu' };
    case 'TERMINATED':
      return { variant: 'danger' as const, label: 'Inactif' };
    default:
      return { variant: 'neutral' as const, label: status || 'Actif' };
  }
}
</script>

<template>
  <div class="employees-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Personnel & Employés</h1>
        <p class="text-muted">Registre RH des entrepôts, gestion des profils, activités et rémunérations de base</p>
      </div>
      <div class="header-actions">
        <AppButton variant="primary" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Inscrire un Employé
        </AppButton>
      </div>
    </div>

    <!-- Status Tabs -->
    <div class="status-tabs">
      <button
        class="status-tab-btn"
        :class="{ active: statusFilter === 'ALL' }"
        @click="statusFilter = 'ALL'"
      >
        Tous les employés <span class="tab-count">{{ statusCounts.ALL }}</span>
      </button>
      <button
        class="status-tab-btn"
        :class="{ active: statusFilter === 'ACTIVE' }"
        @click="statusFilter = 'ACTIVE'"
      >
        <span class="status-dot dot-active"></span>
        Actifs <span class="tab-count">{{ statusCounts.ACTIVE }}</span>
      </button>
      <button
        class="status-tab-btn"
        :class="{ active: statusFilter === 'ON_LEAVE' }"
        @click="statusFilter = 'ON_LEAVE'"
      >
        <span class="status-dot dot-leave"></span>
        En congé <span class="tab-count">{{ statusCounts.ON_LEAVE }}</span>
      </button>
      <button
        class="status-tab-btn"
        :class="{ active: statusFilter === 'SUSPENDED' }"
        @click="statusFilter = 'SUSPENDED'"
      >
        <span class="status-dot dot-suspended"></span>
        Suspendus <span class="tab-count">{{ statusCounts.SUSPENDED }}</span>
      </button>
      <button
        class="status-tab-btn"
        :class="{ active: statusFilter === 'TERMINATED' }"
        @click="statusFilter = 'TERMINATED'"
      >
        <span class="status-dot dot-terminated"></span>
        Inactifs / Démissionnaires <span class="tab-count">{{ statusCounts.TERMINATED }}</span>
      </button>
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
          placeholder="Rechercher par nom, poste, CNI, entrepôt..."
          class="search-input"
        />
      </div>
      <div class="count-badge text-muted font-mono">
        {{ filteredEmployees.length }} {{ filteredEmployees.length > 1 ? 'employés affichés' : 'employé affiché' }}
      </div>
    </div>

    <!-- Table -->
    <AppTable :loading="loading" :empty="!filteredEmployees.length" empty-text="Aucun employé trouvé" :columns-count="8">
      <template #header>
        <th>Nom de l'Employé</th>
        <th>Entrepôt</th>
        <th>Poste</th>
        <th>Statut</th>
        <th>Téléphone</th>
        <th>Date d'Embauche</th>
        <th>Salaire de Base</th>
        <th style="text-align: right;">Actions</th>
      </template>
      <template #body>
        <tr v-for="emp in filteredEmployees" :key="emp.id" class="employee-row" @click="navigateToProfile(emp.id)">
          <td>
            <div class="employee-cell">
              
              <div>
                <strong class="emp-name-link">{{ emp.fullName }}</strong>
                <span v-if="emp.nationalId" class="text-caption text-muted font-mono" style="display: block;">
                  CNI: {{ emp.nationalId }}
                </span>
              </div>
            </div>
          </td>
          <td>
            <span class="warehouse-badge">{{ emp.warehouseName }}</span>
          </td>
          <td>
            <AppBadge variant="neutral" size="sm">{{ emp.position }}</AppBadge>
          </td>
          <td>
            <AppBadge :variant="getStatusBadge(emp.status).variant" size="sm">
              {{ getStatusBadge(emp.status).label }}
            </AppBadge>
          </td>
          <td class="font-mono">{{ emp.phone || '—' }}</td>
          <td class="font-mono text-caption">{{ formatDate(emp.hireDate) }}</td>
          <td class="font-mono font-bold">{{ formatCurrency(emp.baseSalary) }}</td>
          <td style="text-align: right;" @click.stop>
            <div class="row-actions">
              <button class="icon-action-btn primary-action" title="Voir le profil complet" @click="navigateToProfile(emp.id)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Profil
              </button>
              <button class="icon-action-btn" title="Modifier le profil" @click="openEditModal(emp)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Modifier
              </button>
            </div>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Create/Edit Modal -->
    <AppModal
      v-model="showModal"
      :title="editingEmployee ? 'Modifier le Profil de l\'Employé' : 'Inscrire un Nouvel Employé'"
      max-width="540px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleSave">
        <div class="form-row">
          <div class="app-input-group">
            <label class="input-label">Entrepôt d'Affectation</label>
            <select v-model.number="form.warehouseId" class="app-select" required>
              <option v-for="w in warehouseStore.allWarehousesFormatted" :key="w.id" :value="w.id">
                {{ w.label }} ({{ w.code }})
              </option>
            </select>
          </div>

          <div class="app-input-group">
            <label class="input-label">Statut RH</label>
            <select v-model="form.status" class="app-select" required>
              <option v-for="st in statusOptions" :key="st.value" :value="st.value">
                {{ st.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <AppInput
            v-model="form.fullName"
            label="Nom & Prénom Complet"
            placeholder="Mohamed Larbi"
            required
          />
          <AppInput
            v-model="form.nationalId"
            label="N° CNI / Identifiant National"
            placeholder="1985160100..."
          />
        </div>

        <div class="form-row">
          <AppInput
            v-model="form.position"
            label="Poste / Fonction"
            placeholder="Cariste / Magasinier"
            required
          />
          <AppInput
            v-model="form.phone"
            label="Téléphone de Contact"
            placeholder="+213 550 11 22 33"
          />
        </div>

        <div class="form-row">
          <AppInput
            v-model="form.hireDate"
            type="date"
            label="Date d'Embauche"
            required
          />
          <AppInput
            v-model.number="form.baseSalary"
            type="number"
            label="Salaire Mensuel de Base (DA)"
            placeholder="55000"
            required
          />
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSave">
          {{ editingEmployee ? 'Enregistrer les modifications' : 'Inscrire le salarié' }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.employees-view {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
  overflow-x: auto;
}

.status-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.status-tab-btn:hover {
  background-color: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.status-tab-btn.active {
  background-color: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-primary);
  font-weight: 600;
}

.tab-count {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  font-family: var(--font-mono);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-active { background-color: var(--color-success); }
.dot-leave { background-color: var(--color-warning); }
.dot-suspended { background-color: #94a3b8; }
.dot-terminated { background-color: var(--color-danger); }

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
}

.search-input:focus {
  border-color: var(--color-primary);
}

.employee-row {
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.employee-row:hover {
  background-color: var(--color-surface-hover);
}

.employee-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-circle {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary) 0%, #1e40af 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.emp-name-link {
  color: var(--color-text-primary);
  transition: color var(--transition-fast);
}

.employee-row:hover .emp-name-link {
  color: var(--color-primary);
}

.warehouse-badge {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.font-bold {
  font-weight: 600;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}

.icon-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
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
}

.icon-action-btn.primary-action {
  background-color: var(--color-primary-bg, #eff6ff);
  color: var(--color-primary);
  border-color: var(--color-primary-border, #bfdbfe);
}

.icon-action-btn.primary-action:hover {
  background-color: var(--color-primary);
  color: #ffffff;
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
