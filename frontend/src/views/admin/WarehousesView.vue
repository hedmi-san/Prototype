<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { warehouseService } from '../../services/catalog.service';
import { useWarehouseStore } from '../../stores/warehouse.store';
import type { Warehouse } from '../../types';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';
import ConfirmDialog from '../../components/common/ConfirmDialog.vue';
import StockRelocationModal from '../../components/transfers/StockRelocationModal.vue';

const warehouseStore = useWarehouseStore();
const warehouses = ref<Warehouse[]>([]);
const loading = ref(true);

const showModal = ref(false);
const editingWarehouse = ref<Warehouse | null>(null);
const form = ref({
  name: '',
  code: '',
  address: '',
  phone: '',
  active: true,
});

const saving = ref(false);
const errorMessage = ref('');
const tableActionError = ref('');

// Status confirmation state
const showStatusConfirm = ref(false);
const targetWarehouseForStatus = ref<Warehouse | null>(null);
const statusToggling = ref(false);

// Relocation modal state
const showRelocationModal = ref(false);
const relocationSourceId = ref<number | null>(null);

onMounted(async () => {
  await fetchWarehouses();
});

async function fetchWarehouses() {
  loading.value = true;
  tableActionError.value = '';
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
    active: true,
  };
  errorMessage.value = '';
  showModal.value = true;
}

function openEditModal(w: Warehouse) {
  editingWarehouse.value = w;
  form.value = {
    name: w.name,
    code: w.code,
    address: w.address || (w as any).location || '',
    phone: w.phone || (w as any).contactNumber || (w as any).contact_number || '',
    active: Boolean(w.active),
  };
  errorMessage.value = '';
  showModal.value = true;
}

function openRelocationModal(sourceId?: number) {
  relocationSourceId.value = sourceId || null;
  showRelocationModal.value = true;
}

function handleStatusToggleClick(w: Warehouse) {
  targetWarehouseForStatus.value = w;
  tableActionError.value = '';
  showStatusConfirm.value = true;
}

async function confirmStatusToggle() {
  if (!targetWarehouseForStatus.value) return;
  statusToggling.value = true;
  tableActionError.value = '';
  const w = targetWarehouseForStatus.value;
  const newActive = !w.active;

  try {
    await warehouseService.updateWarehouse(w.id, {
      name: w.name,
      code: w.code,
      location: w.address || (w as any).location || '',
      phone: w.phone || (w as any).contactNumber || '',
      active: newActive,
    });
    showStatusConfirm.value = false;
    await Promise.all([fetchWarehouses(), warehouseStore.fetchWarehouses()]);
  } catch (err: any) {
    tableActionError.value =
      err.response?.data?.message ||
      `Échec de la ${newActive ? 'réactivation' : 'désactivation'} de l'entrepôt`;
    showStatusConfirm.value = false;
  } finally {
    statusToggling.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  errorMessage.value = '';
  try {
    const payload = {
      name: form.value.name.trim(),
      code: form.value.code.trim(),
      address: form.value.address.trim(),
      location: form.value.address.trim(),
      phone: form.value.phone.trim(),
      contactNumber: form.value.phone.trim(),
      active: form.value.active,
    };
    if (editingWarehouse.value) {
      await warehouseService.updateWarehouse(editingWarehouse.value.id, payload);
    } else {
      await warehouseService.createWarehouse(payload);
    }
    showModal.value = false;
    await Promise.all([
      fetchWarehouses(),
      warehouseStore.fetchWarehouses(),
    ]);
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || "Échec de l'enregistrement de l'entrepôt";
  } finally {
    saving.value = false;
  }
}

function handleRelocationCompleted() {
  fetchWarehouses();
  warehouseStore.fetchWarehouses();
}

function handleDirectDeactivate(warehouseId: number) {
  const w = warehouses.value.find((item) => item.id === warehouseId);
  if (w && w.active) {
    targetWarehouseForStatus.value = w;
    showStatusConfirm.value = true;
  }
}
</script>

<template>
  <div class="warehouses-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Sites & Entrepôts</h1>
        <p class="text-muted">Gestion des installations de distribution, plateformes de stockage, statuts et redistribution</p>
      </div>
      <div class="header-actions">
        <AppButton variant="secondary" @click="openRelocationModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="17 1 21 5 17 9"></polyline>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
            <polyline points="7 23 3 19 7 15"></polyline>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
          </svg>
          Redistribution de Stock
        </AppButton>
        <AppButton variant="primary" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouvel Entrepôt
        </AppButton>
      </div>
    </div>

    <!-- Error Banner for Table Actions -->
    <div v-if="tableActionError" class="global-error-banner">
      <div class="banner-icon">⚠️</div>
      <div class="banner-text">{{ tableActionError }}</div>
      <button class="banner-close" @click="tableActionError = ''">✕</button>
    </div>

    <!-- Table -->
    <AppTable :loading="loading" :empty="!warehouses.length" empty-text="Aucun entrepôt trouvé" :columns-count="6">
      <template #header>
        <th>Code Entrepôt</th>
        <th>Nom de l'Entrepôt</th>
        <th>Adresse Physique</th>
        <th>Téléphone</th>
        <th>Statut</th>
        <th style="text-align: right;">Actions</th>
      </template>
      <template #body>
        <tr v-for="w in warehouses" :key="w.id" :class="{ 'inactive-row': !w.active }">
          <td class="font-mono font-bold">{{ w.code }}</td>
          <td>
            <strong>{{ w.name }}</strong>
            <span v-if="!w.active" class="inactive-tag ml-2">Fermé / Inactif</span>
          </td>
          <td>{{ w.address || '—' }}</td>
          <td class="font-mono">{{ w.phone || '—' }}</td>
          <td>
            <AppBadge :variant="w.active ? 'success' : 'danger'" size="sm">
              {{ w.active ? 'OPÉRATIONNEL' : 'INACTIF' }}
            </AppBadge>
          </td>
          <td>
            <div class="row-actions">
              <!-- Relocate stock button -->
              <button
                class="icon-action-btn"
                title="Redistribuer / Transférer le stock de ce dépôt"
                @click="openRelocationModal(w.id)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
                Stock
              </button>

              <!-- Edit button -->
              <button class="icon-action-btn" title="Modifier le site" @click="openEditModal(w)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Modifier
              </button>

              <!-- Activate / Deactivate Toggle -->
              <button
                class="icon-action-btn"
                :class="w.active ? 'text-danger' : 'text-success'"
                :title="w.active ? 'Désactiver cet entrepôt' : 'Réactiver cet entrepôt'"
                @click="handleStatusToggleClick(w)"
              >
                <svg v-if="w.active" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                {{ w.active ? 'Désactiver' : 'Réactiver' }}
              </button>
            </div>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Create / Edit Warehouse Modal -->
    <AppModal
      v-model="showModal"
      :title="editingWarehouse ? 'Modifier l\'Entrepôt' : 'Enregistrer un Nouvel Entrepôt'"
      max-width="480px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleSave">
        <AppInput
          v-model="form.name"
          label="Nom de l'Entrepôt"
          placeholder="ex. Plateforme Centrale de Distribution Sétif"
          required
        />

        <AppInput
          v-model="form.code"
          label="Code Unique de l'Entrepôt"
          placeholder="ex. WH-SETIF"
          :disabled="!!editingWarehouse"
          required
        />

        <AppInput
          v-model="form.address"
          label="Adresse Physique / Zone Industrielle"
          placeholder="Zone Industrielle Sétif, Lot 45"
        />

        <AppInput
          v-model="form.phone"
          label="Téléphone de Contact"
          placeholder="+213 36 00 11 22"
        />

        <div v-if="editingWarehouse" class="status-toggle-box">
          <label class="form-label">Statut Opérationnel :</label>
          <label class="checkbox-label">
            <input v-model="form.active" type="checkbox" />
            <span>Entrepôt Opérationnel (Actif)</span>
          </label>
          <p class="text-muted text-xs">
            Si désactivé, les utilisateurs assignés passeront en mode consultation seule et aucune nouvelle vente ne pourra être émise.
          </p>
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSave">
          {{ editingWarehouse ? 'Enregistrer les modifications' : 'Créer l\'Entrepôt' }}
        </AppButton>
      </template>
    </AppModal>

    <!-- Confirm Status Toggle Dialog -->
    <ConfirmDialog
      v-model="showStatusConfirm"
      :title="targetWarehouseForStatus?.active ? 'Confirmer la Désactivation de l\'Entrepôt' : 'Confirmer la Réactivation de l\'Entrepôt'"
      :message="targetWarehouseForStatus?.active
        ? `Êtes-vous sûr de vouloir désactiver l'entrepôt '${targetWarehouseForStatus?.name}' (${targetWarehouseForStatus?.code}) ? Les gérants et comptables assignés passeront en mode consultation seule. Toutes les opérations de vente et mouvements seront suspendus.`
        : `Voulez-vous réactiver l'entrepôt '${targetWarehouseForStatus?.name}' ? Le site redeviendra immédiatement opérationnel pour les ventes et transferts.`"
      :confirm-text="targetWarehouseForStatus?.active ? 'Désactiver le site' : 'Réactiver le site'"
      :variant="targetWarehouseForStatus?.active ? 'danger' : 'primary'"
      :loading="statusToggling"
      @confirm="confirmStatusToggle"
    />

    <!-- Multi-Warehouse Stock Relocation Modal -->
    <StockRelocationModal
      v-model="showRelocationModal"
      :initial-source-warehouse-id="relocationSourceId"
      @relocated="handleRelocationCompleted"
      @request-deactivate="handleDirectDeactivate"
    />
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.font-bold {
  font-weight: 600;
}

.inactive-row {
  opacity: 0.75;
  background-color: var(--color-surface-hover);
}

.inactive-tag {
  font-size: 11px;
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-weight: 600;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.icon-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 9px;
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
  border-color: var(--color-text-secondary);
}

.global-error-banner {
  background-color: var(--color-danger-bg, #fef2f2);
  color: var(--color-danger, #dc2626);
  border: 1px solid var(--color-danger-border, #fecaca);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  font-weight: 500;
}

.banner-icon {
  font-size: 20px;
}

.banner-text {
  flex: 1;
}

.banner-close {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: var(--color-danger);
}

.status-toggle-box {
  background-color: var(--color-surface-hover);
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.text-xs { font-size: 11px; }

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

.text-danger { color: var(--color-danger, #dc2626); }
.text-success { color: var(--color-success, #059669); }
.ml-2 { margin-left: 8px; }
.mb-3 { margin-bottom: 12px; }
</style>
