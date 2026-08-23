<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { adminService } from '../../services/admin-reports.service';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { useAuthStore } from '../../stores/auth.store';
import type { User, RoleType } from '../../types';
import { formatRole } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';

const warehouseStore = useWarehouseStore();
const authStore = useAuthStore();

const users = ref<User[]>([]);
const loading = ref(true);
const successMessage = ref('');

// Create Modal State
const showCreateModal = ref(false);
const createForm = ref({
  username: '',
  password: '',
  fullName: '',
  roleName: 'MANAGER' as RoleType,
  warehouseId: null as number | null,
});
const createSaving = ref(false);
const createErrorMessage = ref('');

// Edit Modal State
const showEditModal = ref(false);
const editForm = ref({
  id: 0,
  username: '',
  fullName: '',
  roleName: 'MANAGER' as RoleType,
  warehouseId: null as number | null,
  active: true,
  password: '',
});
const editSaving = ref(false);
const editErrorMessage = ref('');

// Delete Modal State
const showDeleteModal = ref(false);
const userToDelete = ref<User | null>(null);
const deleteLoading = ref(false);
const deleteErrorMessage = ref('');

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

function showSuccess(msg: string) {
  successMessage.value = msg;
  setTimeout(() => {
    successMessage.value = '';
  }, 4000);
}

// CREATE HANDLERS
function openCreateModal() {
  createForm.value = {
    username: '',
    password: '',
    fullName: '',
    roleName: 'MANAGER',
    warehouseId: warehouseStore.activeWarehouses[0]?.id || null,
  };
  createErrorMessage.value = '';
  showCreateModal.value = true;
}

async function handleCreateSave() {
  createSaving.value = true;
  createErrorMessage.value = '';
  try {
    await adminService.createUser({
      username: createForm.value.username,
      password: createForm.value.password,
      fullName: createForm.value.fullName,
      roleName: createForm.value.roleName,
      warehouseId: createForm.value.roleName === 'ADMIN' ? null : createForm.value.warehouseId,
    });
    showCreateModal.value = false;
    showSuccess(`Compte utilisateur "${createForm.value.username}" créé avec succès.`);
    await fetchUsers();
  } catch (err: any) {
    createErrorMessage.value = err.response?.data?.message || 'Échec de la création du compte utilisateur';
  } finally {
    createSaving.value = false;
  }
}

// EDIT HANDLERS
function openEditModal(u: User) {
  editForm.value = {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    roleName: (u.role || (u as any).roleName || 'MANAGER') as RoleType,
    warehouseId: u.warehouseId,
    active: u.active,
    password: '',
  };
  editErrorMessage.value = '';
  showEditModal.value = true;
}

const isEditingSelf = computed(() => {
  return authStore.user?.id === editForm.value.id;
});

async function handleEditSave() {
  editSaving.value = true;
  editErrorMessage.value = '';
  try {
    await adminService.updateUser(editForm.value.id, {
      fullName: editForm.value.fullName,
      roleName: editForm.value.roleName,
      warehouseId: editForm.value.roleName === 'ADMIN' ? null : editForm.value.warehouseId,
      active: editForm.value.active,
      password: editForm.value.password ? editForm.value.password : undefined,
    });
    showEditModal.value = false;
    showSuccess(`Compte utilisateur "${editForm.value.username}" mis à jour avec succès.`);
    await fetchUsers();
  } catch (err: any) {
    editErrorMessage.value = err.response?.data?.message || 'Échec de la mise à jour du compte utilisateur';
  } finally {
    editSaving.value = false;
  }
}

// DELETE HANDLERS
function openDeleteModal(u: User) {
  userToDelete.value = u;
  deleteErrorMessage.value = '';
  showDeleteModal.value = true;
}

async function handleDeleteConfirm() {
  if (!userToDelete.value) return;
  deleteLoading.value = true;
  deleteErrorMessage.value = '';
  try {
    await adminService.deleteUser(userToDelete.value.id);
    showDeleteModal.value = false;
    showSuccess(`Compte utilisateur "${userToDelete.value.username}" supprimé avec succès.`);
    userToDelete.value = null;
    await fetchUsers();
  } catch (err: any) {
    deleteErrorMessage.value = err.response?.data?.message || 'Échec de la suppression du compte utilisateur';
  } finally {
    deleteLoading.value = false;
  }
}

async function handleQuickDeactivate() {
  if (!userToDelete.value) return;
  deleteLoading.value = true;
  deleteErrorMessage.value = '';
  try {
    await adminService.updateUser(userToDelete.value.id, {
      active: false,
    });
    showDeleteModal.value = false;
    showSuccess(`Compte utilisateur "${userToDelete.value.username}" a été désactivé.`);
    userToDelete.value = null;
    await fetchUsers();
  } catch (err: any) {
    deleteErrorMessage.value = err.response?.data?.message || 'Échec de la désactivation du compte';
  } finally {
    deleteLoading.value = false;
  }
}
</script>

<template>
  <div class="users-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Comptes Utilisateurs & Rôles</h1>
        <p class="text-muted">Gestion des opérateurs, affectation des entrepôts et configuration des droits d'accès</p>
      </div>
      <div class="header-actions">
        <AppButton variant="primary" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouveau Compte Utilisateur
        </AppButton>
      </div>
    </div>

    <!-- Feedback Banner -->
    <div v-if="successMessage" class="feedback-banner success-banner">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <span>{{ successMessage }}</span>
    </div>

    <!-- Table -->
    <AppTable :loading="loading" :empty="!users.length" empty-text="Aucun utilisateur trouvé" :columns-count="6">
      <template #header>
        <th>Nom d'Utilisateur</th>
        <th>Nom Complet</th>
        <th>Rôle</th>
        <th>Entrepôt Assigné</th>
        <th>Statut</th>
        <th style="text-align: right;">Actions</th>
      </template>
      <template #body>
        <tr v-for="u in users" :key="u.id">
          <td class="font-mono font-bold">
            <div class="user-identity">
              <span>{{ u.username }}</span>
              <span v-if="authStore.user?.id === u.id" class="self-badge">(Vous)</span>
            </div>
          </td>
          <td>{{ u.fullName }}</td>
          <td>
            <AppBadge :variant="u.role === 'ADMIN' ? 'neutral' : 'info'" size="sm">
              {{ formatRole(u.role) }}
            </AppBadge>
          </td>
          <td>{{ u.warehouseName || 'Global (Tous les entrepôts)' }}</td>
          <td>
            <AppBadge :variant="u.active ? 'success' : 'danger'" size="sm">
              {{ u.active ? 'ACTIF' : 'INACTIF' }}
            </AppBadge>
          </td>
          <td style="text-align: right;">
            <div class="row-actions">
              <AppButton
                variant="outline"
                size="sm"
                title="Modifier le compte"
                @click="openEditModal(u)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Modifier
              </AppButton>
              <AppButton
                variant="danger"
                size="sm"
                title="Supprimer le compte"
                :disabled="authStore.user?.id === u.id"
                @click="openDeleteModal(u)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Supprimer
              </AppButton>
            </div>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Create User Modal -->
    <AppModal
      v-model="showCreateModal"
      title="Créer un Compte Utilisateur"
      max-width="480px"
    >
      <div v-if="createErrorMessage" class="modal-error mb-3">
        {{ createErrorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleCreateSave">
        <AppInput
          v-model="createForm.username"
          label="Nom d'Utilisateur"
          placeholder="ex. responsable_setif"
          required
        />

        <AppInput
          v-model="createForm.password"
          type="password"
          label="Mot de Passe Initial"
          placeholder="••••••••"
          required
        />

        <AppInput
          v-model="createForm.fullName"
          label="Nom Complet"
          placeholder="ex. Karim Benaissa"
          required
        />

        <div class="app-input-group">
          <label class="input-label">Rôle</label>
          <select v-model="createForm.roleName" class="app-select" required>
            <option value="ADMIN">ADMIN (Administrateur système global)</option>
            <option value="SUPER_MANAGER">SUPER_MANAGER (Superviseur multi-entrepôts)</option>
            <option value="MANAGER">MANAGER (Responsable local d'entrepôt)</option>
            <option value="ACCOUNTANT">ACCOUNTANT (Comptable local & facturation)</option>
          </select>
        </div>

        <div v-if="createForm.roleName !== 'ADMIN'" class="app-input-group">
          <label class="input-label">Entrepôt Assigné</label>
          <select v-model.number="createForm.warehouseId" class="app-select" required>
            <option v-for="w in warehouseStore.activeWarehouses" :key="w.id" :value="w.id">
              {{ w.name }} ({{ w.code }})
            </option>
          </select>
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showCreateModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="createSaving" @click="handleCreateSave">
          Créer le Compte
        </AppButton>
      </template>
    </AppModal>

    <!-- Edit User Modal -->
    <AppModal
      v-model="showEditModal"
      :title="`Modifier l'Utilisateur : ${editForm.username}`"
      max-width="500px"
    >
      <div v-if="editErrorMessage" class="modal-error mb-3">
        {{ editErrorMessage }}
      </div>

      <form class="modal-form" @submit.prevent="handleEditSave">
        <AppInput
          v-model="editForm.username"
          label="Nom d'Utilisateur"
          disabled
        />

        <AppInput
          v-model="editForm.fullName"
          label="Nom Complet"
          placeholder="ex. Karim Benaissa"
          required
        />

        <div class="app-input-group">
          <label class="input-label">Rôle</label>
          <select
            v-model="editForm.roleName"
            class="app-select"
            :disabled="isEditingSelf"
            required
          >
            <option value="ADMIN">ADMIN (Administrateur système global)</option>
            <option value="SUPER_MANAGER">SUPER_MANAGER (Superviseur multi-entrepôts)</option>
            <option value="MANAGER">MANAGER (Responsable local d'entrepôt)</option>
            <option value="ACCOUNTANT">ACCOUNTANT (Comptable local & facturation)</option>
          </select>
          <span v-if="isEditingSelf" class="field-hint">Vous ne pouvez pas modifier votre propre rôle administrateur.</span>
        </div>

        <div v-if="editForm.roleName !== 'ADMIN'" class="app-input-group">
          <label class="input-label">Entrepôt Assigné</label>
          <select v-model.number="editForm.warehouseId" class="app-select" required>
            <option v-for="w in warehouseStore.allWarehousesFormatted" :key="w.id" :value="w.id">
              {{ w.label }} ({{ w.code }})
            </option>
          </select>
        </div>

        <div class="app-input-group">
          <label class="input-label">Statut du Compte</label>
          <select
            v-model="editForm.active"
            class="app-select"
            :disabled="isEditingSelf"
          >
            <option :value="true">ACTIF (Accès autorisé)</option>
            <option :value="false">INACTIF (Accès verrouillé / désactivé)</option>
          </select>
          <span v-if="isEditingSelf" class="field-hint">Vous ne pouvez pas désactiver votre propre compte administrateur.</span>
        </div>

        <div class="app-input-group">
          <AppInput
            v-model="editForm.password"
            type="password"
            label="Nouveau Mot de Passe (Optionnel)"
            placeholder="Laisser vide pour ne pas modifier"
          />
          <span class="field-hint">Renseignez uniquement si vous souhaitez réinitialiser le mot de passe (min. 4 caractères).</span>
        </div>
      </form>

      <template #footer>
        <AppButton variant="secondary" @click="showEditModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="editSaving" @click="handleEditSave">
          Enregistrer les Modifications
        </AppButton>
      </template>
    </AppModal>

    <!-- Delete Confirmation Modal -->
    <AppModal
      v-model="showDeleteModal"
      title="Supprimer un Compte Utilisateur"
      max-width="560px"
    >
      <div v-if="deleteErrorMessage" class="modal-error mb-3">
        <div class="error-title">Impossible de supprimer définitivement :</div>
        <div>{{ deleteErrorMessage }}</div>
      </div>

      <div v-if="userToDelete" class="delete-dialog-content">
        <p class="delete-warning-text">
          Êtes-vous sûr de vouloir supprimer le compte <strong>{{ userToDelete.username }}</strong> ({{ userToDelete.fullName }}) ?
        </p>
        <div class="delete-info-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong>Règle de sécurité :</strong> Si cet utilisateur a enregistré des opérations historiques (ventes, demandes de transfert), la suppression définitive est bloquée pour préserver la traçabilité. Vous devez alors désactiver le compte.
          </div>
        </div>
      </div>

      <template #footer>
        <div class="delete-footer-actions">
          <AppButton variant="secondary" :disabled="deleteLoading" @click="showDeleteModal = false">
            Annuler
          </AppButton>
          <div class="delete-action-buttons">
            <AppButton
              v-if="userToDelete?.active"
              variant="outline"
              :loading="deleteLoading"
              @click="handleQuickDeactivate"
            >
              Désactiver le compte
            </AppButton>
            <AppButton
              variant="danger"
              :loading="deleteLoading"
              @click="handleDeleteConfirm"
            >
              Supprimer définitivement
            </AppButton>
          </div>
        </div>
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

.user-identity {
  display: flex;
  align-items: center;
  gap: 6px;
}

.self-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-primary);
  background-color: var(--color-primary-light, rgba(59, 130, 246, 0.1));
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.feedback-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
}

.success-banner {
  background-color: var(--color-success-bg, #ecfdf5);
  color: var(--color-success, #059669);
  border: 1px solid var(--color-success-border, #a7f3d0);
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

.field-hint {
  font-size: 11px;
  color: var(--color-text-muted, #6b7280);
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
}

.app-select:disabled {
  background-color: var(--color-surface, #f9fafb);
  cursor: not-allowed;
  opacity: 0.7;
}

.modal-error {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  line-height: 1.4;
}

.error-title {
  font-weight: 600;
  margin-bottom: 4px;
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
  color: var(--color-primary);
}

.delete-footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
  flex-wrap: wrap;
}

.delete-action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.mb-3 { margin-bottom: 12px; }
</style>
