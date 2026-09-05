<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { useProductStore } from '../../stores/product.store';
import { transferService, inventoryService } from '../../services/operations.service';
import type { Transfer, Product, Warehouse, Stock } from '../../types';
import type { ComputedPeriodRange } from '../../utils/periodNavigator';
import { formatDateTime, formatNumber, formatTransferStatus } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import AppInput from '../../components/common/AppInput.vue';
import AppProductCombobox from '../../components/common/AppProductCombobox.vue';
import AppPeriodNavigator from '../../components/common/AppPeriodNavigator.vue';
import AppPagination from '../../components/common/AppPagination.vue';
import ConfirmDialog from '../../components/common/ConfirmDialog.vue';
import StockRelocationModal from '../../components/transfers/StockRelocationModal.vue';

const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();
const productStore = useProductStore();

const transfers = ref<Transfer[]>([]);
const sourceWarehouseStock = ref<Stock[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const statusFilter = ref('');

// Period & Pagination state
const activeRange = ref<ComputedPeriodRange | null>(null);
const page = ref(1);
const limit = ref(25);
const total = ref(0);
const totalPages = ref(1);

// Request Transfer Modal
interface CreateTransferLineItem {
  _uid: string;
  productId: number;
  requestedQuantity: number;
}

let createUidCounter = 0;
function createTransferLineItem(initial?: Partial<CreateTransferLineItem>): CreateTransferLineItem {
  return {
    _uid: `transfer_line_${++createUidCounter}_${Date.now()}`,
    productId: 0,
    requestedQuantity: 5,
    ...initial,
  };
}

const showCreateModal = ref(false);
const createForm = ref({
  sourceWarehouseId: 0,
  destinationWarehouseId: 0,
  notes: '',
  items: [createTransferLineItem({ productId: 0, requestedQuantity: 5 })] as CreateTransferLineItem[],
});

// Approve Transfer Modal
const showApproveModal = ref(false);
const approvingTransfer = ref<Transfer | null>(null);
const approveForm = ref<{ productId: number; approvedQuantity: number }[]>([]);

// Transfer Details Modal
const showDetailsModal = ref(false);
const selectedTransfer = ref<Transfer | null>(null);

// Cancel Confirm Dialog
const showCancelDialog = ref(false);
const cancellingTransfer = ref<Transfer | null>(null);

const saving = ref(false);
const errorMessage = ref('');

onMounted(async () => {
  await Promise.all([productStore.fetchProducts()]);
  if (!activeRange.value) {
    await fetchTransfers();
  }
});

// Watch warehouse and status filter changes
watch(() => authStore.activeWarehouseId, async () => {
  page.value = 1;
  await fetchTransfers();
});

watch(statusFilter, async () => {
  page.value = 1;
  await fetchTransfers();
});

let searchTimeout: any = null;
function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    page.value = 1;
    await fetchTransfers();
  }, 300);
}

async function onPeriodChange(range: ComputedPeriodRange) {
  activeRange.value = range;
  page.value = 1;
  await fetchTransfers();
}

function onPageChange(payload: { page: number; limit: number }) {
  page.value = payload.page;
  limit.value = payload.limit;
  fetchTransfers();
}

async function fetchTransfers() {
  loading.value = true;
  try {
    const res = await transferService.getTransfers({
      warehouseId: authStore.activeWarehouseId || undefined,
      startDate: activeRange.value?.startDate,
      endDate: activeRange.value?.endDate,
      status: statusFilter.value || undefined,
      search: searchQuery.value.trim() || undefined,
      page: page.value,
      limit: limit.value,
    });
    transfers.value = res.items;
    total.value = res.pagination.total;
    totalPages.value = res.pagination.totalPages;
    page.value = res.pagination.page;
  } catch (err) {
    console.error('Failed to load transfers', err);
  } finally {
    loading.value = false;
  }
}

async function fetchSourceWarehouseStock(warehouseId?: number) {
  const targetId = warehouseId || createForm.value.sourceWarehouseId;
  if (!targetId) {
    sourceWarehouseStock.value = [];
    return;
  }
  try {
    const res = await inventoryService.getStock({
      warehouseId: targetId,
      limit: 1000,
    });
    sourceWarehouseStock.value = res.items;
  } catch (err) {
    console.error('Failed to load stock for source warehouse', err);
    sourceWarehouseStock.value = [];
  }
}

const showRelocationModal = ref(false);

async function openCreateModal() {
  const activeWhs = warehouseStore.activeWarehouses;
  const userWhId = Number(authStore.user?.warehouseId || authStore.activeWarehouseId) || 0;
  const isGlobalUser = authStore.isAdmin || (authStore.isSuperManager && !authStore.user?.warehouseId);

  // For a warehouse manager, destination warehouse is their assigned warehouse
  const destId = userWhId && !isGlobalUser ? userWhId : (activeWhs.length > 0 ? activeWhs[0].id : 0);
  const otherWh = activeWhs.find((w) => w.id !== destId);
  const sourceId = otherWh ? otherWh.id : (activeWhs.length > 0 ? activeWhs[0].id : 0);

  createForm.value = {
    sourceWarehouseId: sourceId,
    destinationWarehouseId: destId,
    notes: '',
    items: [
      createTransferLineItem({
        productId: productStore.products[0]?.id || 0,
        requestedQuantity: 5,
      }),
    ],
  };
  errorMessage.value = '';
  showCreateModal.value = true;
  await fetchSourceWarehouseStock(sourceId);
}

function addCreateItem() {
  if (productStore.products.length > 0) {
    createForm.value.items.push(
      createTransferLineItem({
        productId: productStore.products[0].id,
        requestedQuantity: 5,
      })
    );
  }
}

function removeCreateItem(index: number) {
  if (createForm.value.items.length > 1) {
    createForm.value.items.splice(index, 1);
  }
}

async function handleSaveCreate() {
  if (createForm.value.sourceWarehouseId === createForm.value.destinationWarehouseId) {
    errorMessage.value = 'Les entrepôts source et destination doivent être différents';
    return;
  }

  saving.value = true;
  errorMessage.value = '';
  try {
    await transferService.createTransfer({
      sourceWarehouseId: createForm.value.sourceWarehouseId,
      destinationWarehouseId: createForm.value.destinationWarehouseId,
      notes: createForm.value.notes,
      items: createForm.value.items.map((i) => ({
        productId: i.productId,
        requestedQuantity: i.requestedQuantity,
      })),
    });
    showCreateModal.value = false;
    await fetchTransfers();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || 'Échec de la création de la demande de transfert';
  } finally {
    saving.value = false;
  }
}

function openApproveModal(t: Transfer) {
  approvingTransfer.value = t;
  approveForm.value = t.items.map((i) => ({
    productId: i.productId,
    approvedQuantity: i.requestedQuantity,
  }));
  errorMessage.value = '';
  showApproveModal.value = true;
}

function getApproveQuantity(productId: number): number {
  const item = approveForm.value.find((f) => Number(f.productId) === Number(productId));
  return item !== undefined ? item.approvedQuantity : 0;
}

function setApproveQuantity(productId: number, val: number) {
  const item = approveForm.value.find((f) => Number(f.productId) === Number(productId));
  if (item) {
    item.approvedQuantity = Math.max(0, isNaN(val) ? 0 : Number(val));
  }
}

async function handleSaveApprove() {
  if (!approvingTransfer.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    await transferService.approveTransfer(approvingTransfer.value.id, {
      items: approveForm.value,
    });
    showApproveModal.value = false;
    await fetchTransfers();
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || "Échec de l'approbation du transfert";
  } finally {
    saving.value = false;
  }
}

async function handleConfirm(t: Transfer) {
  if (!confirm(`Confirmer la réception physique de ce transfert #${t.id} à votre entrepôt (${t.destinationWarehouseName}) ?\n\nLe stock sera automatiquement déduit de l'entrepôt source et ajouté à votre dépôt.`)) {
    return;
  }
  saving.value = true;
  try {
    await transferService.confirmTransfer(t.id);
    await fetchTransfers();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Échec de la confirmation du transfert');
  } finally {
    saving.value = false;
  }
}

async function handleDecline(t: Transfer) {
  if (!confirm(`Refuser cette demande de transfert #${t.id} de la part de ${t.destinationWarehouseName} ?`)) {
    return;
  }
  saving.value = true;
  try {
    await transferService.declineTransfer(t.id);
    await fetchTransfers();
  } catch (err: any) {
    alert(err.response?.data?.message || 'Échec du refus du transfert');
  } finally {
    saving.value = false;
  }
}

function promptCancel(t: Transfer) {
  cancellingTransfer.value = t;
  showCancelDialog.value = true;
}

async function handleConfirmCancel() {
  if (!cancellingTransfer.value) return;
  saving.value = true;
  try {
    await transferService.cancelTransfer(cancellingTransfer.value.id);
    showCancelDialog.value = false;
    await fetchTransfers();
  } catch (err: any) {
    alert(err.response?.data?.message || "Échec de l'annulation du transfert");
  } finally {
    saving.value = false;
  }
}

function viewDetails(t: Transfer) {
  selectedTransfer.value = t;
  showDetailsModal.value = true;
}

function canApprove(t: Transfer): boolean {
  if (t.status !== 'REQUESTED') return false;
  if (authStore.isAdmin) return true;
  if (authStore.isSuperManager && !authStore.user?.warehouseId) return true;
  const userWhId = Number(authStore.user?.warehouseId || authStore.activeWarehouseId);
  return (authStore.isManager || authStore.isSuperManager) && userWhId === Number(t.sourceWarehouseId);
}

function canDecline(t: Transfer): boolean {
  if (t.status !== 'REQUESTED') return false;
  if (authStore.isAdmin) return true;
  if (authStore.isSuperManager && !authStore.user?.warehouseId) return true;
  const userWhId = Number(authStore.user?.warehouseId || authStore.activeWarehouseId);
  return (authStore.isManager || authStore.isSuperManager) && userWhId === Number(t.sourceWarehouseId);
}

function canConfirm(t: Transfer): boolean {
  if (t.status !== 'APPROVED') return false;
  if (authStore.isAdmin) return true;
  if (authStore.isSuperManager && !authStore.user?.warehouseId) return true;
  const userWhId = Number(authStore.user?.warehouseId || authStore.activeWarehouseId);
  return (authStore.isManager || authStore.isSuperManager) && userWhId === Number(t.destinationWarehouseId);
}

function canCancel(t: Transfer): boolean {
  if (t.status !== 'REQUESTED' && t.status !== 'APPROVED') return false;
  if (authStore.isAdmin) return true;
  if (authStore.isSuperManager && !authStore.user?.warehouseId) return true;
  const isRequester = Number(authStore.user?.id) === Number(t.requestedByUserId);
  const userWhId = Number(authStore.user?.warehouseId || authStore.activeWarehouseId);
  const isDestManager = (authStore.isManager || authStore.isSuperManager) && userWhId === Number(t.destinationWarehouseId);
  const isSourceManager = (authStore.isManager || authStore.isSuperManager) && userWhId === Number(t.sourceWarehouseId);
  return isRequester || isDestManager || isSourceManager;
}

const canCreateTransfer = computed(() => {
  return (authStore.isAdmin || authStore.isManager || authStore.isSuperManager) && !authStore.isReadOnly;
});

function getStatusBadgeVariant(status: string): 'neutral' | 'success' | 'danger' | 'warning' | 'info' {
  switch (status) {
    case 'REQUESTED': return 'warning';
    case 'APPROVED': return 'info';
    case 'CONFIRMED': return 'success';
    case 'DECLINED': return 'danger';
    case 'CANCELLED': return 'neutral';
    default: return 'neutral';
  }
}
</script>

<template>
  <div class="transfers-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Transferts Inter-Entrepôts</h1>
        <p class="text-muted">Demandes de transfert, réservation de stock source et confirmation de réception</p>
      </div>
      <div class="header-actions">
        <AppButton
          v-if="authStore.isAdmin || authStore.isSuperManager"
          variant="secondary"
          @click="showRelocationModal = true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="17 1 21 5 17 9"></polyline>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
            <polyline points="7 23 3 19 7 15"></polyline>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
          </svg>
          Relocalisation Multi-Dépôts
        </AppButton>
        <AppButton v-if="canCreateTransfer" variant="primary" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Demander un Transfert de Stock
        </AppButton>
      </div>
    </div>

    <!-- Reusable Period Navigator -->
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
          placeholder="Rechercher par n° transfert, entrepôt, demandeur, notes..."
          class="search-input"
          @input="onSearchInput"
        />
      </div>

      <div class="status-filter">
        <select v-model="statusFilter" class="filter-select">
          <option value="">Tous les statuts</option>
          <option value="REQUESTED">En attente (Demandé)</option>
          <option value="APPROVED">Approuvé (Réservé)</option>
          <option value="CONFIRMED">Confirmé (Réceptionné)</option>
          <option value="DECLINED">Refusé</option>
          <option value="CANCELLED">Annulé</option>
        </select>
      </div>

      <div class="count-badge text-muted font-mono">
        {{ total }} {{ total > 1 ? 'transferts trouvés' : 'transfert trouvé' }}
      </div>
    </div>

    <!-- Transfers Table -->
    <AppTable :loading="loading" :empty="!transfers.length" empty-text="Aucun transfert enregistré pour cette période" :columns-count="7">
      <template #header>
        <th>N° Transfert</th>
        <th>Entrepôt Source</th>
        <th>Destination</th>
        <th>Statut</th>
        <th>Date de Demande</th>
        <th>Date de Confirmation</th>
        <th>Actions</th>
      </template>
      <template #body>
        <tr v-for="t in transfers" :key="t.id">
          <td class="font-mono font-bold">#TRF-{{ t.id }}</td>
          <td>
            <strong>{{ t.sourceWarehouseName }}</strong>
            <span class="text-caption" style="display: block;">{{ t.sourceWarehouseCode }}</span>
          </td>
          <td>
            <strong>{{ t.destinationWarehouseName }}</strong>
            <span class="text-caption" style="display: block;">{{ t.destinationWarehouseCode }}</span>
          </td>
          <td>
            <AppBadge :variant="getStatusBadgeVariant(t.status)" size="sm">
              {{ formatTransferStatus(t.status) }}
            </AppBadge>
          </td>
          <td class="font-mono text-caption">{{ formatDateTime(t.createdAt) }}</td>
          <td class="font-mono text-caption">{{ t.confirmedAt ? formatDateTime(t.confirmedAt) : '—' }}</td>
          <td>
            <div class="action-buttons">
              <button class="icon-action-btn" title="Voir les détails" @click="viewDetails(t)">
                Détails
              </button>

              <!-- Status REQUESTED: Source warehouse approves or declines; Destination warehouse / requester can cancel -->
              <template v-if="t.status === 'REQUESTED'">
                <template v-if="canApprove(t)">
                  <button class="icon-action-btn btn-primary-action" title="Valider les quantités et réserver le stock à votre entrepôt" @click="openApproveModal(t)">
                    Approuver
                  </button>
                  <button class="icon-action-btn btn-danger-action" title="Refuser cette demande de transfert" @click="handleDecline(t)">
                    Refuser
                  </button>
                </template>
                <template v-if="canCancel(t) && !canApprove(t)">
                  <button class="icon-action-btn btn-danger-action" title="Annuler ma demande de transfert" @click="promptCancel(t)">
                    Annuler
                  </button>
                </template>
              </template>

              <!-- Status APPROVED: Destination warehouse confirms receipt; or cancel to release reserved stock -->
              <template v-if="t.status === 'APPROVED'">
                <template v-if="canConfirm(t)">
                  <button class="icon-action-btn btn-success-action" title="Confirmer la réception physique des articles" @click="handleConfirm(t)">
                    Confirmer Réception
                  </button>
                </template>
                <template v-if="canCancel(t)">
                  <button class="icon-action-btn btn-danger-action" title="Annuler le transfert et libérer le stock réservé" @click="promptCancel(t)">
                    Annuler
                  </button>
                </template>
              </template>
            </div>
          </td>
        </tr>
      </template>
    </AppTable>

    <!-- Pagination -->
    <AppPagination
      v-model:page="page"
      v-model:limit="limit"
      :total="total"
      :total-pages="totalPages"
      :loading="loading"
      @change="onPageChange"
    />

    <!-- Create Transfer Modal -->
    <AppModal
      v-model="showCreateModal"
      title="Créer une Demande de Transfert Inter-Entrepôts"
      max-width="600px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <div class="modal-form">
        <div class="form-row">
          <div class="app-input-group">
            <label class="input-label">Entrepôt Source (Expéditeur)</label>
            <select
              v-model.number="createForm.sourceWarehouseId"
              class="app-select"
              required
              @change="fetchSourceWarehouseStock(createForm.sourceWarehouseId)"
            >
              <option
                v-for="w in warehouseStore.activeWarehouses"
                :key="w.id"
                :value="w.id"
                :disabled="w.id === createForm.destinationWarehouseId"
              >
                {{ w.name }} ({{ w.code }})
              </option>
            </select>
            <span class="text-caption text-muted">L'entrepôt qui fournit et expédie les produits.</span>
          </div>

          <div class="app-input-group">
            <label class="input-label">Entrepôt Destination (Destinataire)</label>
            <select
              v-model.number="createForm.destinationWarehouseId"
              class="app-select"
              required
              :disabled="!authStore.isAdmin && !(authStore.isSuperManager && !authStore.user?.warehouseId)"
            >
              <option v-for="w in warehouseStore.activeWarehouses" :key="w.id" :value="w.id">
                {{ w.name }} ({{ w.code }})
              </option>
            </select>
            <span class="text-caption text-muted">L'entrepôt demandeur recevant les produits.</span>
          </div>
        </div>

        <AppInput
          v-model="createForm.notes"
          label="Notes sur la Demande de Transfert"
          placeholder="ex. Réapprovisionnement urgent pour chantier client"
        />

        <div class="items-editor">
          <div class="editor-header">
            <h4>Produits Demandés</h4>
            <button type="button" class="icon-action-btn" @click="addCreateItem">
              + Ajouter un Produit
            </button>
          </div>

          <div v-for="(item, idx) in createForm.items" :key="item._uid" class="item-row">
            <div style="flex: 1;">
              <AppProductCombobox
                v-model="item.productId"
                :warehouse-stock="sourceWarehouseStock"
                placeholder="Taper nom ou réf (ex: DCD796)..."
                required
              />
            </div>
            <input
              v-model.number="item.requestedQuantity"
              type="number"
              min="1"
              class="app-input item-qty-input"
              placeholder="Qté"
              required
            />
            <button
              type="button"
              class="icon-action-btn btn-danger-action"
              :disabled="createForm.items.length <= 1"
              @click="removeCreateItem(idx)"
            >
              &times;
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="showCreateModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveCreate">
          Soumettre la Demande de Transfert
        </AppButton>
      </template>
    </AppModal>

    <!-- Approve Transfer Modal -->
    <AppModal
      v-model="showApproveModal"
      :title="`Approuver & Réserver le Stock pour le Transfert #${approvingTransfer?.id || ''}`"
      max-width="540px"
    >
      <div v-if="errorMessage" class="modal-error mb-3">
        {{ errorMessage }}
      </div>

      <p class="text-caption text-muted mb-3">
        L'approbation de ce transfert verrouillera et réservera les unités spécifiées à l'entrepôt <strong>{{ approvingTransfer?.sourceWarehouseName }}</strong>. Le stock n'est déduit physiquement qu'à la confirmation de réception.
      </p>

      <div class="approve-items-list">
        <div v-for="item in approvingTransfer?.items" :key="item.id" class="approve-item-row">
          <div class="item-meta">
            <strong>{{ item.productName }}</strong>
            <span class="text-caption font-mono">{{ item.productReference }} (Demandé : {{ formatNumber(item.requestedQuantity) }} unités)</span>
          </div>
          <div class="item-input">
            <label class="input-label">Qté Approuvée</label>
            <input
              :value="getApproveQuantity(item.productId)"
              type="number"
              min="0"
              :max="item.requestedQuantity"
              class="app-input item-qty-input"
              @input="setApproveQuantity(item.productId, Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" @click="showApproveModal = false">Annuler</AppButton>
        <AppButton variant="primary" :loading="saving" @click="handleSaveApprove">
          Confirmer l'Approbation & Réserver le Stock
        </AppButton>
      </template>
    </AppModal>

    <!-- Transfer Details Modal -->
    <AppModal
      v-model="showDetailsModal"
      :title="`Détails de la Demande de Transfert #${selectedTransfer?.id || ''}`"
      max-width="580px"
    >
      <div v-if="selectedTransfer" class="details-box">
        <div class="details-grid">
          <div>
            <span class="text-caption text-muted">Entrepôt Source (Départ) :</span>
            <h4>{{ selectedTransfer.sourceWarehouseName }}</h4>
          </div>
          <div>
            <span class="text-caption text-muted">Entrepôt Destination (Arrivée) :</span>
            <h4>{{ selectedTransfer.destinationWarehouseName }}</h4>
          </div>
          <div>
            <span class="text-caption text-muted">Statut :</span>
            <AppBadge :variant="getStatusBadgeVariant(selectedTransfer.status)" size="sm">
              {{ formatTransferStatus(selectedTransfer.status) }}
            </AppBadge>
          </div>
          <div>
            <span class="text-caption text-muted">Initié par :</span>
            <h4>{{ selectedTransfer.createdByName || 'Système' }}</h4>
          </div>
          <div v-if="selectedTransfer.approvedAt">
            <span class="text-caption text-muted">Date d'Approbation :</span>
            <h4>{{ formatDateTime(selectedTransfer.approvedAt) }}</h4>
          </div>
          <div v-if="selectedTransfer.confirmedAt">
            <span class="text-caption text-muted">Date de Confirmation :</span>
            <h4>{{ formatDateTime(selectedTransfer.confirmedAt) }}</h4>
          </div>
        </div>

        <p v-if="selectedTransfer.notes" class="notes-box">
          <strong>Notes :</strong> {{ selectedTransfer.notes }}
        </p>

        <h4 class="mt-3 mb-2">Manifeste des Articles</h4>
        <table class="inv-table">
          <thead>
            <tr>
              <th>Réf</th>
              <th>Produit</th>
              <th>Demandé</th>
              <th>Approuvé</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in selectedTransfer.items" :key="item.id">
              <td class="font-mono">{{ item.productReference }}</td>
              <td>{{ item.productName }}</td>
              <td class="font-mono font-bold">{{ formatNumber(item.requestedQuantity) }}</td>
              <td class="font-mono text-success">{{ formatNumber(item.approvedQuantity) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <template #footer>
        <AppButton variant="secondary" @click="showDetailsModal = false">Fermer</AppButton>
      </template>
    </AppModal>

    <!-- Cancel Dialog -->
    <ConfirmDialog
      v-model="showCancelDialog"
      title="Annuler la Demande de Transfert"
      :message="`Êtes-vous sûr de vouloir annuler le transfert #${cancellingTransfer?.id} ? Si ce transfert a été approuvé, tout le stock réservé à l'entrepôt source sera immédiatement déverrouillé.`"
      confirm-text="Annuler le Transfert"
      cancel-text="Conserver le Transfert"
      variant="danger"
      :loading="saving"
      @confirm="handleConfirmCancel"
    />

    <!-- Multi-Warehouse Stock Relocation Modal -->
    <StockRelocationModal
      v-model="showRelocationModal"
      @relocated="fetchTransfers"
    />
  </div>
</template>

<style scoped>
.transfers-view {
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
  flex-wrap: wrap;
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

.search-input, .filter-select {
  height: 38px;
  padding: 8px 12px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
  transition: all var(--transition-fast);
}

.search-input {
  width: 100%;
  padding-left: 36px;
}

.search-input:focus, .filter-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.font-bold {
  font-weight: 600;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
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
  border-color: var(--color-border-dark);
}

.btn-primary-action {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.btn-primary-action:hover {
  background-color: var(--color-primary-hover);
}

.btn-success-action {
  background-color: var(--color-success-bg, rgba(16, 185, 129, 0.1));
  color: var(--color-success, #10b981);
  border-color: var(--color-success-border, rgba(16, 185, 129, 0.3));
}

.btn-success-action:hover {
  background-color: var(--color-success, #10b981);
  color: #ffffff;
  border-color: var(--color-success, #10b981);
}

.btn-danger-action {
  background-color: var(--color-danger-bg, rgba(239, 68, 68, 0.1));
  color: var(--color-danger, #ef4444);
  border-color: var(--color-danger-border, rgba(239, 68, 68, 0.3));
}

.btn-danger-action:hover {
  background-color: var(--color-danger, #ef4444);
  color: #ffffff;
  border-color: var(--color-danger, #ef4444);
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

.items-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-product-select {
  flex: 1;
}

.item-qty-input {
  width: 90px;
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

.approve-items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.approve-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--color-surface);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.item-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.notes-box {
  background-color: var(--color-surface);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: 13px;
}

.inv-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}

.inv-table th {
  background-color: var(--color-surface);
  padding: 8px 12px;
  font-size: 11px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.inv-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-subtle);
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
.mt-3 { margin-top: 12px; }
.mb-2 { margin-bottom: 8px; }
</style>
