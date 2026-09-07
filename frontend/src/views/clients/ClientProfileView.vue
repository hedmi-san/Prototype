<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ClientDetail, StatementOfAccount, Sale, ClientPayment, ClientRefund } from '../../types';
import { clientService, type StatementQueryParams } from '../../services/client.service';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { useAuthStore } from '../../stores/auth.store';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import AppButton from '../../components/common/AppButton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppModal from '../../components/common/AppModal.vue';
import ClientFormModal from '../../components/clients/ClientFormModal.vue';
import ClientPaymentModal from '../../components/clients/ClientPaymentModal.vue';
import ClientRefundModal from '../../components/clients/ClientRefundModal.vue';
import RefundDocument from '../../components/clients/RefundDocument.vue';

const route = useRoute();
const router = useRouter();
const warehouseStore = useWarehouseStore();
const authStore = useAuthStore();

const clientId = computed(() => Number(route.params.id));
const client = ref<ClientDetail | null>(null);
const statement = ref<StatementOfAccount | null>(null);
const invoices = ref<Sale[]>([]);
const payments = ref<ClientPayment[]>([]);

const activeTab = ref<'statement' | 'invoices' | 'payments'>('statement');
const loading = ref(true);
const loadingTab = ref(false);

// Statement Filters
const filterWarehouseId = ref<number | undefined>(undefined);
const filterStartDate = ref<string>('');
const filterEndDate = ref<string>('');

// Modals
const showEditModal = ref(false);
const showPaymentModal = ref(false);
const showAdjustmentModal = ref(false);
const showRefundModal = ref(false);
const showRefundDocModal = ref(false);
const selectedRefund = ref<ClientRefund | null>(null);

// Adjustment Form
const adjustAmount = ref<number>(0);
const adjustDirection = ref<'DEBIT' | 'CREDIT'>('DEBIT');
const adjustDescription = ref('');
const adjustWarehouseId = ref<number>(authStore.activeWarehouseId || warehouseStore.warehouses[0]?.id || 1);
const adjustSubmitting = ref(false);
const adjustError = ref('');

const printTimestamp = computed(() => formatDateTime(new Date(), false));

onMounted(async () => {
  await Promise.all([
    warehouseStore.fetchWarehouses(),
    loadClientData(),
  ]);
});

watch(activeTab, async (newTab) => {
  if (newTab === 'invoices' && invoices.value.length === 0) {
    await loadInvoices();
  } else if (newTab === 'payments' && payments.value.length === 0) {
    await loadPayments();
  }
});

async function loadClientData() {
  loading.value = true;
  try {
    const [clientRes, statementRes] = await Promise.all([
      clientService.getClientById(clientId.value),
      fetchStatementData(),
    ]);
    client.value = clientRes;
    statement.value = statementRes;
  } catch (err) {
    console.error('Failed to load client data', err);
  } finally {
    loading.value = false;
  }
}

async function fetchStatementData() {
  const params: StatementQueryParams = {
    warehouseId: filterWarehouseId.value || undefined,
    startDate: filterStartDate.value || undefined,
    endDate: filterEndDate.value || undefined,
  };
  return await clientService.getClientStatement(clientId.value, params);
}

async function applyStatementFilters() {
  loadingTab.value = true;
  try {
    statement.value = await fetchStatementData();
  } catch (err) {
    console.error('Failed to filter statement', err);
  } finally {
    loadingTab.value = false;
  }
}

function resetStatementFilters() {
  filterWarehouseId.value = undefined;
  filterStartDate.value = '';
  filterEndDate.value = '';
  applyStatementFilters();
}

async function loadInvoices() {
  loadingTab.value = true;
  try {
    invoices.value = await clientService.getClientInvoices(clientId.value);
  } catch (err) {
    console.error('Failed to load invoices', err);
  } finally {
    loadingTab.value = false;
  }
}

async function loadPayments() {
  loadingTab.value = true;
  try {
    payments.value = await clientService.getClientPayments(clientId.value);
  } catch (err) {
    console.error('Failed to load payments', err);
  } finally {
    loadingTab.value = false;
  }
}

async function exportCsv() {
  if (!client.value) return;
  const params: StatementQueryParams = {
    warehouseId: filterWarehouseId.value || undefined,
    startDate: filterStartDate.value || undefined,
    endDate: filterEndDate.value || undefined,
  };
  await clientService.exportStatementCsv(client.value.id, params, client.value.code);
}

function triggerPrint() {
  window.print();
}

function onClientSaved(updated: any) {
  client.value = { ...client.value, ...updated };
}

async function onPaymentSaved() {
  await loadClientData();
  if (activeTab.value === 'invoices') await loadInvoices();
  if (activeTab.value === 'payments') await loadPayments();
}

function handleOpenRefundModal() {
  showRefundModal.value = true;
}

function handleRefundSaved(refund: ClientRefund) {
  selectedRefund.value = refund;
  showRefundDocModal.value = true;
  loadClientData();
}

async function handleViewRefundDocument(refundId: number) {
  try {
    const refund = await clientService.getClientRefundById(clientId.value, refundId);
    selectedRefund.value = refund;
    showRefundDocModal.value = true;
  } catch (err) {
    console.error('Failed to load refund document', err);
  }
}

async function submitAdjustment() {
  adjustError.value = '';
  if (!adjustAmount.value || adjustAmount.value <= 0) {
    adjustError.value = "Le montant de l'ajustement doit être supérieur à 0 DZD.";
    return;
  }
  if (!adjustDescription.value.trim()) {
    adjustError.value = 'Un motif explicite est requis pour tout ajustement.';
    return;
  }

  adjustSubmitting.value = true;
  try {
    await clientService.adjustClientBalance(clientId.value, {
      amount: Number(adjustAmount.value),
      direction: adjustDirection.value,
      description: adjustDescription.value.trim(),
      warehouseId: adjustWarehouseId.value,
    });
    showAdjustmentModal.value = false;
    adjustAmount.value = 0;
    adjustDescription.value = '';
    await loadClientData();
  } catch (err: any) {
    adjustError.value = err.response?.data?.message || err.message || "Erreur lors de l'ajustement";
  } finally {
    adjustSubmitting.value = false;
  }
}
</script>

<template>
  <div class="client-profile-view">
    <!-- Printable Header (Print Only) -->
    <header class="print-header">
      <div class="print-header-top">
        <div class="print-brand-left">
          <div class="print-company-name">&bull; EURL BOUSFOR HOSNA</div>
          <div class="print-doc-title">Extrait de Compte Client (Situation Financière)</div>
          <div class="print-doc-subtitle">Grand Livre des Ventes, Règlements et Dettes</div>
        </div>
        <div class="print-meta-box">
          <div><span class="meta-label">Date d'édition :</span> <strong>{{ printTimestamp }}</strong></div>
          <div v-if="statement?.filter.startDate || statement?.filter.endDate">
            <span class="meta-label">Période :</span>
            <strong>{{ statement.filter.startDate ? formatDate(statement.filter.startDate) : 'Début' }} au {{ statement.filter.endDate ? formatDate(statement.filter.endDate) : 'Ce jour' }}</strong>
          </div>
        </div>
      </div>
      <div class="print-client-summary">
        <div><strong>Client :</strong> {{ client?.name }} ({{ client?.code }})</div>
        <div v-if="client?.phone"><strong>Tél :</strong> {{ client.phone }}</div>
        <div v-if="client?.address"><strong>Adresse :</strong> {{ client.address }}</div>
        <div>
          <strong>Solde Actuel :</strong>
          <span :class="['print-balance', (client?.currentBalance || 0) > 0 ? 'debt' : 'credit']">
            {{ formatCurrency(client?.currentBalance || 0) }}
          </span>
        </div>
      </div>
      <div class="print-header-divider" />
    </header>

    <!-- Top Navigation & Actions -->
    <div class="profile-nav no-print">
      <button class="back-link" @click="router.push('/clients')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        <span>Retour aux Clients</span>
      </button>

      <div class="profile-actions">
        <AppButton
          v-if="!client?.isDefault && (authStore.isAdmin || authStore.isSuperManager)"
          variant="ghost"
          size="sm"
          @click="showAdjustmentModal = true"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Ajustement Solde
        </AppButton>
        <AppButton
          v-if="!client?.isDefault"
          variant="secondary"
          size="sm"
          :disabled="(client?.currentBalance || 0) >= 0"
          :title="(client?.currentBalance || 0) >= 0 ? 'Le client ne dispose pas d\'avance disponible en compte' : 'Rembourser l\'avance en espèces'"
          @click="handleOpenRefundModal"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Rembourser Avance
        </AppButton>
        <AppButton v-if="!client?.isDefault" variant="secondary" size="sm" @click="showEditModal = true">
          Modifier Infos
        </AppButton>
        <AppButton v-if="!client?.isDefault" variant="primary" size="sm" @click="showPaymentModal = true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Encaisser un Versement
        </AppButton>
      </div>
    </div>

    <!-- Client Main Header Card -->
    <div v-if="client" class="client-header-card no-print">
      <div class="client-hero">
        <div class="client-badge-code">{{ client.code }}</div>
        <div class="client-hero-info">
          <h2 class="client-hero-title">{{ client.name }}</h2>
          <div class="client-hero-meta">
            <span v-if="client.phone" class="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
              {{ client.phone }}
            </span>
            <span v-if="client.email" class="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              {{ client.email }}
            </span>
            <span v-if="client.address" class="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
              {{ client.address }}
            </span>
          </div>
        </div>
      </div>

      <!-- Financial Metrics Ribbon -->
      <div class="metrics-ribbon">
        <div class="metric-card balance">
          <span class="metric-label">Solde Actuel Global</span>
          <strong :class="['metric-val', client.currentBalance > 0 ? 'debt' : (client.currentBalance < 0 ? 'credit' : 'settled')]">
            {{ formatCurrency(client.currentBalance) }}
          </strong>
          <span class="metric-hint">
            {{ client.currentBalance > 0 ? 'Créance due par le client' : (client.currentBalance < 0 ? 'Avance client en compte' : 'Compte entièrement soldé') }}
          </span>
        </div>

        <div class="metric-card">
          <span class="metric-label">Total Ventes / Facturé</span>
          <strong class="metric-val">{{ formatCurrency(client.stats?.totalInvoiced || 0) }}</strong>
          <span class="metric-hint">{{ client.stats?.salesCount || 0 }} Factures enregistrées</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">Total Règlements Versés</span>
          <strong class="metric-val text-success">{{ formatCurrency(client.stats?.totalPaid || 0) }}</strong>
          <span class="metric-hint">Encaissés à ce jour</span>
        </div>

        <div class="metric-card">
          <span class="metric-label">Factures Non Soldées</span>
          <strong :class="['metric-val', (client.stats?.openInvoicesCount || 0) > 0 ? 'text-danger' : '']">
            {{ client.stats?.openInvoicesCount || 0 }}
          </strong>
          <span class="metric-hint">En attente de paiement</span>
        </div>
      </div>
    </div>

    <!-- Tabs Navigation -->
    <div class="tabs-nav no-print">
      <button
        :class="['tab-btn', { active: activeTab === 'statement' }]"
        @click="activeTab = 'statement'"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        Extrait de Compte (Grand Livre)
      </button>

      <button
        :class="['tab-btn', { active: activeTab === 'invoices' }]"
        @click="activeTab = 'invoices'"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        Historique des Factures
      </button>

      <button
        :class="['tab-btn', { active: activeTab === 'payments' }]"
        @click="activeTab = 'payments'"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
        Historique des Versements
      </button>
    </div>

    <!-- TAB 1: EXTRAIT DE COMPTE -->
    <div v-show="activeTab === 'statement'" class="tab-pane">
      <!-- Filter Bar -->
      <div class="statement-filter-bar no-print">
        <div class="filter-group">
          <label>Dépôt / Entrepôt</label>
          <select v-model="filterWarehouseId" class="filter-select" @change="applyStatementFilters">
            <option :value="undefined">Tous les Dépôts (Global)</option>
            <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
              {{ w.name }} ({{ w.code }})
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label>Date Début</label>
          <input v-model="filterStartDate" type="date" class="filter-input" @change="applyStatementFilters" />
        </div>

        <div class="filter-group">
          <label>Date Fin</label>
          <input v-model="filterEndDate" type="date" class="filter-input" @change="applyStatementFilters" />
        </div>

        <div class="filter-actions">
          <AppButton size="sm" variant="ghost" @click="resetStatementFilters">Réinitialiser</AppButton>
          <AppButton size="sm" variant="secondary" @click="exportCsv">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </AppButton>
          <AppButton size="sm" variant="primary" @click="triggerPrint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Imprimer l'Extrait
          </AppButton>
        </div>
      </div>

      <!-- Statement Table Card -->
      <div class="tab-table-card">
        <div v-if="loadingTab" class="pane-loading">
          <div class="spinner"></div>
          <span>Calcul du grand livre...</span>
        </div>

        <div v-else-if="!statement || statement.transactions.length === 0" class="pane-empty">
          <p>Aucune transaction financière enregistrée pour ce client sur la période.</p>
        </div>

        <div v-else class="table-container">
          <table class="ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Dépôt</th>
                <th>Type</th>
                <th>Réf. / Pièce</th>
                <th>Libellé / Description</th>
                <th class="text-right">Débit (+)</th>
                <th class="text-right">Crédit (-)</th>
                <th class="text-right">Solde Progressif</th>
              </tr>
            </thead>
            <tbody>
              <!-- Opening Balance Row if filterStartDate was set -->
              <tr v-if="filterStartDate" class="opening-row">
                <td colspan="5">
                  <strong>Solde Antérieur au {{ formatDate(filterStartDate) }}</strong>
                </td>
                <td class="text-right">-</td>
                <td class="text-right">-</td>
                <td class="text-right font-bold">
                  {{ formatCurrency(statement.periodOpeningBalance) }}
                </td>
              </tr>

              <tr v-for="t in statement.transactions" :key="t.id">
                <td>{{ formatDate(t.transactionDate) }}</td>
                <td>{{ t.warehouseName || t.warehouseCode || 'Dépôt' }}</td>
                <td>
                  <span :class="['tx-badge', t.type.toLowerCase()]">
                    {{ t.type === 'INVOICE' ? 'Vente' : t.type === 'PAYMENT' ? 'Versement' : t.type === 'CREDIT_NOTE' ? 'Avoir' : t.type === 'OPENING_BALANCE' ? 'Solde Init' : t.type === 'REFUND' ? 'Remboursement' : 'Ajustement' }}
                  </span>
                </td>
                <td>
                  <div class="ref-cell">
                    <span class="ref-tag">{{ t.referenceType }} #{{ t.referenceId || '-' }}</span>
                    <button
                      v-if="t.type === 'REFUND' && t.referenceId"
                      type="button"
                      class="btn-print-voucher-inline"
                      title="Imprimer le bon de décharge"
                      @click="handleViewRefundDocument(t.referenceId)"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                      Bon
                    </button>
                  </div>
                </td>
                <td>{{ t.description }}</td>
                <td class="text-right font-mono">
                  {{ t.debit > 0 ? formatCurrency(t.debit) : '-' }}
                </td>
                <td class="text-right font-mono text-success">
                  {{ t.credit > 0 ? formatCurrency(t.credit) : '-' }}
                </td>
                <td class="text-right font-mono font-bold" :class="t.runningBalance > 0 ? 'text-danger' : (t.runningBalance < 0 ? 'text-success' : '')">
                  {{ formatCurrency(t.runningBalance) }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="summary-footer-row">
                <td colspan="5" class="text-right font-bold">Totaux Mouvements Période :</td>
                <td class="text-right font-bold font-mono">{{ formatCurrency(statement.totalDebit) }}</td>
                <td class="text-right font-bold font-mono text-success">{{ formatCurrency(statement.totalCredit) }}</td>
                <td class="text-right font-bold font-mono" :class="statement.closingBalance > 0 ? 'text-danger' : (statement.closingBalance < 0 ? 'text-success' : '')">
                  {{ formatCurrency(statement.closingBalance) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 2: INVOICES -->
    <div v-show="activeTab === 'invoices'" class="tab-pane">
      <div class="tab-table-card">
        <div v-if="loadingTab" class="pane-loading">
          <div class="spinner"></div>
          <span>Chargement des factures...</span>
        </div>
        <div v-else-if="invoices.length === 0" class="pane-empty">
          <p>Aucune facture enregistrée pour ce client.</p>
        </div>
        <div v-else class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>N° Facture</th>
                <th>Date</th>
                <th>Dépôt</th>
                <th class="text-right">Montant Total</th>
                <th class="text-right">Montant Payé</th>
                <th class="text-right">Reste Dû</th>
                <th>Statut Paiement</th>
                <th>Statut Vente</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inv in invoices" :key="inv.id">
                <td><strong>{{ inv.invoiceNumber }}</strong></td>
                <td>{{ formatDate(inv.saleDate) }}</td>
                <td>{{ inv.warehouseName }}</td>
                <td class="text-right font-mono">{{ formatCurrency(inv.totalAmount) }}</td>
                <td class="text-right font-mono text-success">{{ formatCurrency(inv.paidAmount || 0) }}</td>
                <td class="text-right font-mono font-bold" :class="(inv.remainingAmount || 0) > 0 ? 'text-danger' : ''">
                  {{ formatCurrency(inv.remainingAmount || 0) }}
                </td>
                <td>
                  <AppBadge :variant="inv.paymentStatus === 'PAID' ? 'success' : (inv.paymentStatus === 'PARTIALLY_PAID' ? 'warning' : 'danger')">
                    {{ inv.paymentStatus === 'PAID' ? 'Payée' : (inv.paymentStatus === 'PARTIALLY_PAID' ? 'Partielle' : 'Non payée') }}
                  </AppBadge>
                </td>
                <td>
                  <AppBadge :variant="inv.status === 'COMPLETED' ? 'neutral' : 'danger'">
                    {{ inv.status === 'COMPLETED' ? 'Complétée' : 'Annulée' }}
                  </AppBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 3: PAYMENTS -->
    <div v-show="activeTab === 'payments'" class="tab-pane">
      <div class="tab-table-card">
        <div v-if="loadingTab" class="pane-loading">
          <div class="spinner"></div>
          <span>Chargement des versements...</span>
        </div>
        <div v-else-if="payments.length === 0" class="pane-empty">
          <p>Aucun versement enregistré pour ce client.</p>
        </div>
        <div v-else class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>N° Versement</th>
                <th>Date</th>
                <th>Dépôt</th>
                <th>Mode</th>
                <th>Réf. Pièce</th>
                <th class="text-right">Montant</th>
                <th>Factures Liées</th>
                <th>Enregistré Par</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in payments" :key="p.id">
                <td><strong class="text-success">{{ p.paymentNumber }}</strong></td>
                <td>{{ formatDate(p.paymentDate) }}</td>
                <td>{{ p.warehouseName }}</td>
                <td>
                  <span class="payment-method-tag">
                    {{ p.paymentMethod === 'CHECK' ? 'Chèque' : p.paymentMethod === 'BANK_TRANSFER' ? 'Virement' : p.paymentMethod === 'CARD' ? 'Carte' : 'Espèces' }}
                  </span>
                </td>
                <td>{{ p.referenceNumber || '-' }}</td>
                <td class="text-right font-mono font-bold text-success">{{ formatCurrency(p.amount) }}</td>
                <td>
                  <div v-if="p.allocations && p.allocations.length > 0" class="alloc-tags">
                    <span v-for="a in p.allocations" :key="a.id" class="alloc-tag">
                      {{ a.invoiceNumber }} ({{ formatCurrency(a.allocatedAmount) }})
                    </span>
                  </div>
                  <span v-else class="text-muted text-xs">Avance générale en compte</span>
                </td>
                <td>{{ p.createdByName || 'Admin' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <ClientFormModal
      v-model="showEditModal"
      :client="client"
      @saved="onClientSaved"
    />

    <!-- Payment Modal -->
    <ClientPaymentModal
      v-model="showPaymentModal"
      :client="client"
      @saved="onPaymentSaved"
    />

    <!-- Manual Adjustment Modal -->
    <AppModal
      v-model="showAdjustmentModal"
      title="Ajustement Manuel du Solde Client"
      max-width="500px"
    >
      <div class="adjust-form">
        <div v-if="adjustError" class="error-banner">
          {{ adjustError }}
        </div>

        <div class="form-group">
          <label class="form-label">Sens de l'ajustement *</label>
          <select v-model="adjustDirection" class="form-select">
            <option value="DEBIT">DÉBIT (+) - Augmente ce que le client doit (Ajoute une dette)</option>
            <option value="CREDIT">CRÉDIT (-) - Diminue ce que le client doit (Ajoute un crédit/avance)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Montant de l'ajustement (DZD) *</label>
          <input
            v-model.number="adjustAmount"
            type="number"
            min="1"
            step="any"
            placeholder="0.00"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Dépôt d'affectation</label>
          <select v-model="adjustWarehouseId" class="form-select">
            <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
              {{ w.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Motif / Justification Détaillée (Obligatoire) *</label>
          <textarea
            v-model="adjustDescription"
            rows="3"
            placeholder="Ex: Régularisation suite à écart d'inventaire sur facture #..."
            class="form-textarea"
          ></textarea>
        </div>
      </div>

      <template #footer>
        <AppButton variant="secondary" :disabled="adjustSubmitting" @click="showAdjustmentModal = false">
          Annuler
        </AppButton>
        <AppButton variant="danger" :loading="adjustSubmitting" @click="submitAdjustment">
          Confirmer l'Ajustement
        </AppButton>
      </template>
    </AppModal>

    <!-- Advance Refund Modal -->
    <ClientRefundModal
      v-model="showRefundModal"
      :client="client"
      @saved="handleRefundSaved"
    />

    <!-- Refund Discharge Voucher Document Modal -->
    <RefundDocument
      v-model="showRefundDocModal"
      :refund="selectedRefund"
    />
  </div>
</template>

<style scoped>
.client-profile-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.profile-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.back-link:hover {
  background: var(--color-surface);
}

.profile-actions {
  display: flex;
  gap: 10px;
}

.client-header-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.client-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.client-badge-code {
  font-family: monospace;
  font-size: 14px;
  font-weight: 700;
  background: var(--color-primary-subtle, rgba(59, 130, 246, 0.1));
  color: var(--color-primary);
  padding: 6px 12px;
  border-radius: var(--radius-md);
}

.client-hero-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.client-hero-meta {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.metrics-ribbon {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.metric-card {
  background: var(--color-bg-subtle, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.05));
  border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
}

.metric-card.balance {
  background: var(--color-surface);
  border-color: var(--color-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.metric-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.metric-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 2px 0;
}

.metric-val.debt {
  color: #ef4444;
}

.metric-val.credit {
  color: #10b981;
}

.metric-val.settled {
  color: #64748b;
}

.metric-hint {
  font-size: 10px;
  color: var(--color-text-secondary);
}

.tabs-nav {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 1px;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  color: var(--color-text-primary);
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.statement-filter-bar {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px 18px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-group label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.filter-select,
.filter-input {
  padding: 6px 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: 12px;
  outline: none;
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.tab-table-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.table-container {
  overflow-x: auto;
}

.ledger-table,
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.ledger-table th,
.data-table th {
  text-align: left;
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-subtle, rgba(0, 0, 0, 0.02));
  border-bottom: 1px solid var(--color-border);
}

.ledger-table td,
.data-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.04));
  color: var(--color-text-primary);
}

.opening-row {
  background: var(--color-bg-subtle, rgba(0, 0, 0, 0.02));
  font-style: italic;
}

.summary-footer-row {
  background: var(--color-bg-subtle, rgba(0, 0, 0, 0.04));
  border-top: 2px solid var(--color-border);
}

.summary-footer-row td {
  padding: 12px 14px;
}

.tx-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.tx-badge.invoice {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.tx-badge.payment {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.tx-badge.credit_note {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.tx-badge.adjustment {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.tx-badge.refund {
  background: rgba(225, 29, 72, 0.1);
  color: #e11d48;
}

.ref-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-print-voucher-inline {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 4px;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-print-voucher-inline:hover {
  background: #2563eb;
  color: #ffffff;
}

.ref-tag {
  font-family: monospace;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.payment-method-tag {
  font-size: 11px;
  background: var(--color-bg-subtle);
  padding: 2px 6px;
  border-radius: 4px;
}

.alloc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.alloc-tag {
  font-size: 10px;
  background: var(--color-bg-subtle);
  padding: 2px 5px;
  border-radius: 3px;
}

.font-mono {
  font-family: monospace;
}

.font-bold {
  font-weight: 700;
}

.text-right {
  text-align: right;
}

.text-danger {
  color: #ef4444;
}

.text-success {
  color: #10b981;
}

.text-muted {
  color: var(--color-text-secondary);
}

.text-xs {
  font-size: 10px;
}

.pane-loading,
.pane-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 10px;
  color: var(--color-text-secondary);
}

.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.adjust-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-banner {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 13px;
  background: var(--color-bg);
  color: var(--color-text-primary);
  outline: none;
}

/* Print Only Styles */
.print-header {
  display: none;
}

@media print {
  .no-print {
    display: none !important;
  }

  .print-header {
    display: block !important;
    margin-bottom: 20px;
  }

  .print-header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .print-company-name {
    font-size: 14pt;
    font-weight: bold;
  }

  .print-doc-title {
    font-size: 12pt;
    font-weight: bold;
    margin-top: 4px;
  }

  .print-doc-subtitle {
    font-size: 9pt;
    color: #555;
  }

  .print-meta-box {
    font-size: 9pt;
    text-align: right;
  }

  .print-client-summary {
    margin-top: 10px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    font-size: 9pt;
    background: #f9f9f9;
    padding: 8px 12px;
    border: 1px solid #ddd;
  }

  .print-balance.debt {
    color: #d00;
    font-weight: bold;
  }

  .print-balance.credit {
    color: #080;
    font-weight: bold;
  }

  .print-header-divider {
    height: 2px;
    background: #333;
    margin-top: 10px;
  }

  .tab-table-card {
    border: none !important;
    box-shadow: none !important;
  }

  .ledger-table {
    font-size: 8pt !important;
  }

  .ledger-table th,
  .ledger-table td {
    padding: 6px 8px !important;
    border: 1px solid #ddd !important;
  }
}
</style>
