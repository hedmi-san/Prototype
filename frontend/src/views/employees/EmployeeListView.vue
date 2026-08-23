<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { employeeService } from '../../services/admin-reports.service';
import type { Employee } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';

const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();

const employees = ref<Employee[]>([]);
const loading = ref(true);
const searchQuery = ref('');

const showModal = ref(false);
const editingEmployee = ref<Employee | null>(null);
const form = ref({
  warehouseId: 0,
  firstName: '',
  lastName: '',
  position: '',
  phone: '',
  hireDate: new Date().toISOString().split('T')[0],
  monthlySalary: 0,
});

const saving = ref(false);
const errorMessage = ref('');

onMounted(async () => {
  await fetchEmployees();
});

async function fetchEmployees() {
  loading.value = true;
  try {
    employees.value = await employeeService.getEmployees(authStore.activeWarehouseId || undefined);
  } catch (err) {
    console.error('Failed to load employees', err);
  } finally {
    loading.value = false;
  }
}

const filteredEmployees = computed(() => {
  if (!searchQuery.value.trim()) return employees.value;
  const q = searchQuery.value.toLowerCase();
  return employees.value.filter(
    (e) =>
      e.fullName.toLowerCase().includes(q) ||
      e.position.toLowerCase().includes(q) ||
      e.warehouseName.toLowerCase().includes(q)
  );
});

function openCreateModal() {
  editingEmployee.value = null;
  form.value = {
    warehouseId: authStore.activeWarehouseId || warehouseStore.activeWarehouses[0]?.id || 1,
    firstName: '',
    lastName: '',
    position: 'Magasinier / Cariste',
    phone: '',
    hireDate: new Date().toISOString().split('T')[0],
    monthlySalary: 55000,
  };
  errorMessage.value = '';
  showModal.value = true;
}

function openEditModal(emp: Employee) {
  editingEmployee.value = emp;
  form.value = {
    warehouseId: emp.warehouseId,
    firstName: emp.firstName,
    lastName: emp.lastName,
    position: emp.position,
    phone: emp.phone || '',
    hireDate: emp.hireDate,
    monthlySalary: emp.monthlySalary,
  };
  errorMessage.value = '';
  showModal.value = true;
}

async function handleSave() {
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
</script>

<template>
  <div class="employees-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Personnel & Employés</h1>
        <p class="text-muted">Registre du personnel des entrepôts, affectations et rémunérations de base</p>
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
          placeholder="Rechercher par nom, poste, entrepôt..."
          class="search-input"
        />
      </div>
      <div class="count-badge text-muted font-mono">
        {{ filteredEmployees.length }} {{ filteredEmployees.length > 1 ? 'employés actifs' : 'employé actif' }}
      </div>
    </div>

    <!-- Table -->
    <AppTable :loading="loading" :empty="!filteredEmployees.length" empty-text="Aucun employé trouvé" :columns-count="7">
      <template #header>
        <th>Nom de l'Employé</th>
        <th>Entrepôt</th>
        <th>Poste</th>
        <th>Téléphone</th>
        <th>Date d'Embauche</th>
        <th>Salaire de Base</th>
        <th>Actions</th>
      </template>
      <template #body>
        <tr v-for="emp in filteredEmployees" :key="emp.id">
          <td>
            <strong>{{ emp.fullName }}</strong>
          </td>
          <td>{{ emp.warehouseName }}</td>
          <td>
            <AppBadge variant="neutral" size="sm">{{ emp.position }}</AppBadge>
          </td>
          <td class="font-mono">{{ emp.phone || '—' }}</td>
          <td class="font-mono text-caption">{{ formatDate(emp.hireDate) }}</td>
          <td class="font-mono font-bold">{{ formatCurrency(emp.monthlySalary) }}</td>
          <td>
            <button class="icon-action-btn" title="Modifier le profil" @click="openEditModal(emp)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Modifier
            </button>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Create/Edit Modal -->
    <AppModal
      v-model="showModal"
      :title="editingEmployee ? 'Modifier le Profil de l\'Employé' : 'Inscrire un Nouvel Employé'"
      max-width="500px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleSave">
        <div class="app-input-group">
          <label class="input-label">Entrepôt d'Affectation</label>
          <select v-model.number="form.warehouseId" class="app-select" required>
            <option v-for="w in warehouseStore.allWarehousesFormatted" :key="w.id" :value="w.id">
              {{ w.label }} ({{ w.code }})
            </option>
          </select>
        </div>

        <div class="form-row">
          <AppInput
            v-model="form.firstName"
            label="Prénom"
            placeholder="Mohamed"
            required
          />
          <AppInput
            v-model="form.lastName"
            label="Nom"
            placeholder="Larbi"
            required
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
            v-model="form.monthlySalary"
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

.font-bold {
  font-weight: 600;
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
