<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { Client, ClientKPIs } from '../../types';
import { clientService, type ClientQueryParams } from '../../services/client.service';
import { formatCurrency } from '../../utils/formatters';
import AppButton from '../../components/common/AppButton.vue';
import AppPagination from '../../components/common/AppPagination.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import ClientFormModal from '../../components/clients/ClientFormModal.vue';
import ClientPaymentModal from '../../components/clients/ClientPaymentModal.vue';

const router = useRouter();

const clients = ref<Client[]>([]);
const kpis = ref<ClientKPIs>({
  totalClients: 0,
  totalDebtors: 0,
  totalDebt: 0,
  totalAdvance: 0,
});
const loading = ref(true);

const search = ref('');
const balanceFilter = ref<'all' | 'debtors' | 'advance' | 'settled'>('all');
const page = ref(1);
const limit = ref(25);
const total = ref(0);
const totalPages = ref(1);

// Modals
const showCreateModal = ref(false);
const showEditModal = ref(false);
const showPaymentModal = ref(false);
const selectedClient = ref<Client | null>(null);

let debounceTimer: any = null;

onMounted(() => {
  fetchClients();
});

watch([balanceFilter, page], () => {
  fetchClients();
});

watch(search, () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    page.value = 1;
    fetchClients();
  }, 300);
});

async function fetchClients() {
  loading.value = true;
  try {
    const params: ClientQueryParams = {
      page: page.value,
      limit: limit.value,
      search: search.value.trim() || undefined,
      balanceFilter: balanceFilter.value,
    };
    const res = await clientService.getClients(params);
    clients.value = res.items;
    total.value = res.pagination.total;
    totalPages.value = res.pagination.totalPages;
    if (res.kpis) {
      kpis.value = res.kpis;
    }
  } catch (err) {
    console.error('Failed to load clients', err);
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  selectedClient.value = null;
  showCreateModal.value = true;
}

function openEditModal(client: Client) {
  selectedClient.value = client;
  showEditModal.value = true;
}

function openPaymentModal(client?: Client) {
  selectedClient.value = client || null;
  showPaymentModal.value = true;
}

function goToClientProfile(clientId: number) {
  router.push(`/clients/${clientId}`);
}

function onClientSaved() {
  fetchClients();
}

function onPaymentSaved() {
  fetchClients();
}
</script>

<template>
  <div class="clients-view">
    <!-- Header -->
    <div class="view-header">
      <div>
        <h1 class="view-title">Gestion des Clients & Comptes</h1>
        <p class="view-subtitle">Suivi du grand livre financier, des créances, versements et soldes clients</p>
      </div>
      <div class="header-actions">
        <AppButton variant="secondary" @click="openPaymentModal()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Nouveau Versement
        </AppButton>
        <AppButton variant="primary" @click="openCreateModal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nouveau Client
        </AppButton>
      </div>
    </div>

    <!-- KPI Summary Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon-wrap primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Total Clients Actifs</span>
          <strong class="kpi-value">{{ kpis.totalClients }}</strong>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap danger">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
            <polyline points="17 18 23 18 23 12" />
          </svg>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Créances Clients (Dettes Dues)</span>
          <strong class="kpi-value text-danger">{{ formatCurrency(kpis.totalDebt) }}</strong>
          <span class="kpi-subtext">{{ kpis.totalDebtors }} clients débiteurs</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap success">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        </div>
        <div class="kpi-content">
          <span class="kpi-label">Avances en Compte (Crédits)</span>
          <strong class="kpi-value text-success">{{ formatCurrency(kpis.totalAdvance) }}</strong>
          <span class="kpi-subtext">Crédits disponibles</span>
        </div>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="search-input-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Rechercher par code, nom d'entreprise ou téléphone..."
          class="search-input"
        />
      </div>

      <div class="filter-pills">
        <button
          :class="['filter-pill', { active: balanceFilter === 'all' }]"
          @click="balanceFilter = 'all'"
        >
          Tous les clients
        </button>
        <button
          :class="['filter-pill', { active: balanceFilter === 'debtors' }]"
          @click="balanceFilter = 'debtors'"
        >
          Débiteurs (Créances)
        </button>
        <button
          :class="['filter-pill', { active: balanceFilter === 'advance' }]"
          @click="balanceFilter = 'advance'"
        >
          Avances (Créditeurs)
        </button>
        <button
          :class="['filter-pill', { active: balanceFilter === 'settled' }]"
          @click="balanceFilter = 'settled'"
        >
          Soldés (0 DZD)
        </button>
      </div>
    </div>

    <!-- Clients Table Card -->
    <div class="table-card">
      <div v-if="loading" class="table-loading">
        <div class="spinner"></div>
        <span>Chargement des clients...</span>
      </div>

      <div v-else-if="clients.length === 0" class="table-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <p>Aucun client trouvé pour ces critères de recherche.</p>
        <AppButton variant="secondary" size="sm" @click="openCreateModal">Créer un Client</AppButton>
      </div>

      <div v-else class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Client / Raison Sociale</th>
              <th>Téléphone</th>
              <th>Adresse</th>
              <th class="text-right">Solde Actuel</th>
              <th>Statut</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in clients"
              :key="c.id"
              class="clickable-row"
              @click="goToClientProfile(c.id)"
            >
              <td>
                <span class="code-badge">{{ c.code }}</span>
              </td>
              <td>
                <div class="client-cell">
                  <strong class="client-name">{{ c.name }}</strong>
                  <span v-if="c.isDefault" class="default-tag">Comptoir / Passager</span>
                </div>
              </td>
              <td>{{ c.phone || '-' }}</td>
              <td class="address-cell">{{ c.address || '-' }}</td>
              <td class="text-right">
                <span
                  :class="[
                    'balance-badge',
                    c.currentBalance > 0 ? 'debt' : (c.currentBalance < 0 ? 'credit' : 'settled')
                  ]"
                >
                  {{ formatCurrency(c.currentBalance) }}
                  <span v-if="c.currentBalance > 0" class="badge-hint">Dû</span>
                  <span v-else-if="c.currentBalance < 0" class="badge-hint">Avance</span>
                </span>
              </td>
              <td>
                <AppBadge :variant="c.active ? 'success' : 'neutral'">
                  {{ c.active ? 'Actif' : 'Inactif' }}
                </AppBadge>
              </td>
              <td class="text-right actions-cell" @click.stop>
                <button
                  class="action-btn"
                  title="Fiche Client & Grand Livre"
                  @click="goToClientProfile(c.id)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </button>
                <button
                  v-if="!c.isDefault"
                  class="action-btn payment"
                  title="Encaisser un Versement"
                  @click="openPaymentModal(c)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </button>
                <button
                  v-if="!c.isDefault"
                  class="action-btn"
                  title="Modifier informations"
                  @click="openEditModal(c)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="table-pagination">
        <AppPagination
          v-model:page="page"
          v-model:limit="limit"
          :total="total"
          :total-pages="totalPages"
          :loading="loading"
          @change="fetchClients"
        />
      </div>
    </div>

    <!-- Modals -->
    <ClientFormModal
      v-model="showCreateModal"
      @saved="onClientSaved"
    />
    <ClientFormModal
      v-model="showEditModal"
      :client="selectedClient"
      @saved="onClientSaved"
    />
    <ClientPaymentModal
      v-model="showPaymentModal"
      :client="selectedClient"
      @saved="onPaymentSaved"
    />
  </div>
</template>

<style scoped>
.clients-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}

.view-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.view-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 4px 0 0 0;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
}

.kpi-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.kpi-icon-wrap.primary {
  background: var(--color-primary-subtle, rgba(59, 130, 246, 0.1));
  color: var(--color-primary);
}

.kpi-icon-wrap.danger {
  background: var(--color-danger-subtle, rgba(239, 68, 68, 0.1));
  color: var(--color-danger, #ef4444);
}

.kpi-icon-wrap.success {
  background: var(--color-success-subtle, rgba(16, 185, 129, 0.1));
  color: var(--color-success, #10b981);
}

.kpi-content {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.kpi-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.kpi-subtext {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.text-danger {
  color: #ef4444 !important;
}

.text-success {
  color: #10b981 !important;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.search-input-wrap {
  position: relative;
  flex: 1;
  min-width: 280px;
  max-width: 460px;
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
  padding: 9px 12px 9px 36px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  border-color: var(--color-primary);
}

.filter-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-pill {
  padding: 6px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full, 9999px);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-pill:hover {
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
}

.filter-pill.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.table-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-subtle, rgba(0, 0, 0, 0.02));
  border-bottom: 1px solid var(--color-border);
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.04));
  color: var(--color-text-primary);
}

.clickable-row {
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.clickable-row:hover {
  background-color: var(--color-bg-subtle, rgba(0, 0, 0, 0.02));
}

.code-badge {
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  background: var(--color-bg-subtle);
  padding: 3px 6px;
  border-radius: var(--radius-xs);
  color: var(--color-text-primary);
}

.client-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.client-name {
  font-weight: 600;
}

.default-tag {
  font-size: 10px;
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.address-cell {
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text-secondary);
}

.balance-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 13px;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
}

.balance-badge.debt {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.balance-badge.credit {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.balance-badge.settled {
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
}

.badge-hint {
  font-size: 10px;
  opacity: 0.8;
  font-weight: 500;
}

.actions-cell {
  white-space: nowrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  margin-left: 6px;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--color-bg-subtle);
  color: var(--color-text-primary);
  border-color: var(--color-primary);
}

.action-btn.payment:hover {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border-color: #10b981;
}

.text-right {
  text-align: right;
}

.table-loading,
.table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  gap: 12px;
  color: var(--color-text-secondary);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.table-pagination {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
}
</style>
