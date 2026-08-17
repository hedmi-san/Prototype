<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { adminService } from '../../services/admin-reports.service';
import { useWarehouseStore } from '../../stores/warehouse.store';
import type { User, RoleType } from '../../types';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';

const warehouseStore = useWarehouseStore();
const users = ref<User[]>([]);
const loading = ref(true);

const showModal = ref(false);
const form = ref({
  username: '',
  password: '',
  fullName: '',
  roleName: 'MANAGER' as RoleType,
  warehouseId: null as number | null,
});

const saving = ref(false);
const errorMessage = ref('');

onMounted(async () => {
  await fetchUsers();
  if (warehouseStore.warehouses.length === 0) {
    await warehouseStore.fetchWarehouses();
  }
});

async function fetchUsers() {
  loading.value = true;
  try {
    users.value = await adminService.getUsers();
  } catch (err) {
    console.error('Failed to load users', err);
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  form.value = {
    username: '',
    password: '',
    fullName: '',
    roleName: 'MANAGER',
    warehouseId: warehouseStore.warehouses[0]?.id || null,
  };
  errorMessage.value = '';
  showModal.value = true;
}

async function handleSave() {
  saving.value = true;
  errorMessage.value = '';
  try {
    await adminService.createUser({
      username: form.value.username,
      password: form.value.password,
      fullName: form.value.fullName,
      roleName: form.value.roleName,
      warehouseId: form.value.roleName === 'ADMIN' ? null : form.value.warehouseId,
    });
    showModal.value = false;
    await fetchUsers();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Failed to create user';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="users-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">User Accounts & Roles</h1>
        <p class="text-muted">Manage system operators, assign warehouse scopes, and configure roles</p>
      </div>
      <div class="header-actions">
        <AppButton variant="primary" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New User Account
        </AppButton>
      </div>
    </div>

    <!-- Table -->
    <AppTable :loading="loading" :empty="!users.length" empty-text="No users found" :columns-count="5">
      <template #header>
        <th>Username</th>
        <th>Full Name</th>
        <th>Role</th>
        <th>Assigned Warehouse</th>
        <th>Status</th>
      </template>
      <template #body>
        <tr v-for="u in users" :key="u.id">
          <td class="font-mono font-bold">{{ u.username }}</td>
          <td>{{ u.fullName }}</td>
          <td>
            <AppBadge :variant="u.role === 'ADMIN' ? 'neutral' : 'info'" size="sm">
              {{ u.role }}
            </AppBadge>
          </td>
          <td>{{ u.warehouseName || 'Global (All Warehouses)' }}</td>
          <td>
            <AppBadge :variant="u.active ? 'success' : 'danger'" size="sm">
              {{ u.active ? 'ACTIVE' : 'INACTIVE' }}
            </AppBadge>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Create User Modal -->
    <AppModal
      v-model="showModal"
      title="Create Distributor User Account"
      max-width="480px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleSave">
        <AppInput
          v-model="form.username"
          label="Username"
          placeholder="e.g. manager_setif"
          required
        />

        <AppInput
          v-model="form.password"
          type="password"
          label="Initial Password"
          placeholder="••••••••"
          required
        />

        <AppInput
          v-model="form.fullName"
          label="Full Name"
          placeholder="e.g. Karim Benaissa"
          required
        />

        <div class="app-input-group">
          <label class="input-label">Role</label>
          <select v-model="form.roleName" class="app-select" required>
            <option value="ADMIN">ADMIN (Global system administrator)</option>
            <option value="SUPER_MANAGER">SUPER_MANAGER (Cross-warehouse read & manager)</option>
            <option value="MANAGER">MANAGER (Warehouse local manager)</option>
            <option value="ACCOUNTANT">ACCOUNTANT (Local warehouse accountant & invoices)</option>
          </select>
        </div>

        <div v-if="form.roleName !== 'ADMIN'" class="app-input-group">
          <label class="input-label">Assigned Warehouse</label>
          <select v-model.number="form.warehouseId" class="app-select" required>
            <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
              {{ w.name }} ({{ w.code }})
            </option>
          </select>
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showModal = false">Cancel</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSave">
          Create Account
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.users-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
