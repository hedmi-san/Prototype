<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { warehouseService } from '../../services/catalog.service';
import type { Warehouse } from '../../types';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';

const warehouses = ref<Warehouse[]>([]);
const loading = ref(true);

const showModal = ref(false);
const editingWarehouse = ref<Warehouse | null>(null);
const form = ref({
  name: '',
  code: '',
  address: '',
  phone: '',
});

const saving = ref(false);
const errorMessage = ref('');

onMounted(async () => {
  await fetchWarehouses();
});

async function fetchWarehouses() {
  loading.value = true;
  try {
    warehouses.value = await warehouseService.getWarehouses();
  } catch (err) {
    console.error('Failed to load warehouses', err);
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingWarehouse.value = null;
  form.value = {
    name: '',
    code: '',
    address: '',
    phone: '',
  };
  errorMessage.value = '';
  showModal.value = true;
}

function openEditModal(w: Warehouse) {
  editingWarehouse.value = w;
  form.value = {
    name: w.name,
    code: w.code,
    address: w.address,
    phone: w.phone,
  };
  errorMessage.value = '';
  showModal.value = true;
}

async function handleSave() {
  saving.value = true;
  errorMessage.value = '';
  try {
    if (editingWarehouse.value) {
      await warehouseService.updateWarehouse(editingWarehouse.value.id, form.value);
    } else {
      await warehouseService.createWarehouse(form.value);
    }
    showModal.value = false;
    await fetchWarehouses();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Failed to save warehouse';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="warehouses-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Warehouse Hubs</h1>
        <p class="text-muted">Manage distribution facilities, storage hubs, and location codes</p>
      </div>
      <div class="header-actions">
        <AppButton variant="primary" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Warehouse Hub
        </AppButton>
      </div>
    </div>

    <!-- Table -->
    <AppTable :loading="loading" :empty="!warehouses.length" empty-text="No warehouses found" :columns-count="6">
      <template #header>
        <th>Hub Code</th>
        <th>Warehouse Name</th>
        <th>Physical Address</th>
        <th>Phone</th>
        <th>Status</th>
        <th>Actions</th>
      </template>
      <template #body>
        <tr v-for="w in warehouses" :key="w.id">
          <td class="font-mono font-bold">{{ w.code }}</td>
          <td><strong>{{ w.name }}</strong></td>
          <td>{{ w.address || '—' }}</td>
          <td class="font-mono">{{ w.phone || '—' }}</td>
          <td>
            <AppBadge :variant="w.active ? 'success' : 'danger'" size="sm">
              {{ w.active ? 'OPERATIONAL' : 'INACTIVE' }}
            </AppBadge>
          </td>
          <td>
            <button class="icon-action-btn" title="Edit Hub" @click="openEditModal(w)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Modal -->
    <AppModal
      v-model="showModal"
      :title="editingWarehouse ? 'Edit Warehouse Hub' : 'Register New Warehouse Hub'"
      max-width="480px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleSave">
        <AppInput
          v-model="form.name"
          label="Warehouse Hub Name"
          placeholder="e.g. Sétif Central Distribution Hub"
          required
        />

        <AppInput
          v-model="form.code"
          label="Unique Hub Code"
          placeholder="e.g. WH-SETIF"
          :disabled="!!editingWarehouse"
          required
        />

        <AppInput
          v-model="form.address"
          label="Physical Address / Zone Industrielle"
          placeholder="Zone Industrielle Sétif, Lot 45"
        />

        <AppInput
          v-model="form.phone"
          label="Contact Phone"
          placeholder="+213 36 00 11 22"
        />
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showModal = false">Cancel</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSave">
          {{ editingWarehouse ? 'Save Changes' : 'Create Warehouse' }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.warehouses-view {
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
