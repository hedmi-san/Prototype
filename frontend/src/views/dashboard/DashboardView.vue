<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { reportService } from '../../services/admin-reports.service';
import type { DashboardMetrics } from '../../types';
import type { ComputedPeriodRange } from '../../utils/periodNavigator';
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatSaleStatus,
  formatMovementType,
} from '../../utils/formatters';
import AppSkeleton from '../../components/common/AppSkeleton.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppTable from '../../components/common/AppTable.vue';
import AppPeriodNavigator from '../../components/common/AppPeriodNavigator.vue';

const authStore = useAuthStore();
const metrics = ref<DashboardMetrics | null>(null);
const loading = ref(true);

const activeRange = ref<ComputedPeriodRange | null>(null);

onMounted(async () => {
  if (!activeRange.value) {
    await fetchMetrics();
  }
});

// Watch warehouse changes to refresh automatically
watch(() => authStore.activeWarehouseId, async () => {
  await fetchMetrics();
});

async function onPeriodChange(range: ComputedPeriodRange) {
  activeRange.value = range;
  await fetchMetrics();
}

async function fetchMetrics() {
  loading.value = true;
  try {
    metrics.value = await reportService.getDashboardMetrics(
      authStore.activeWarehouseId || undefined,
      undefined,
      activeRange.value?.startDate,
      activeRange.value?.endDate
    );
  } catch (err) {
    console.error('Failed to load dashboard metrics', err);
  } finally {
    loading.value = false;
  }
}

// Compute max sales trend amount for relative bar heights
const maxTrendAmount = computed(() => {
  if (!metrics.value?.salesTrend?.length) return 1;
  const max = Math.max(...metrics.value.salesTrend.map(t => t.totalAmount));
  return max > 0 ? max : 1;
});
</script>

<template>
  <div class="dashboard-view">
    <!-- Header with Warehouse Context & Main Actions -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Tableau de Bord Général</h1>
        <p class="text-muted">
          {{ authStore.activeWarehouseId ? 'Performance & Suivi des Stocks de l\'Entrepôt' : 'Opérations Consolidées Multi-Entrepôts' }}
        </p>
      </div>
      <div class="header-actions">
        <button class="refresh-btn" @click="fetchMetrics" title="Rafraîchir les métriques">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Actualiser
        </button>
      </div>
    </div>

    <!-- Reusable ERP Period Navigator Component -->
    <AppPeriodNavigator
      initial-granularity="month"
      @change="onPeriodChange"
    />

    <!-- Primary Metric Cards Grid -->
    <div class="metrics-grid">
      <!-- 1. Period Sales (Dynamic according to selected range) -->
      <div class="metric-card highlight-card">
        <div class="card-top">
          <span class="metric-label">VENTES DE LA PÉRIODE</span>
          <div v-if="metrics && metrics.salesGrowthPercentage !== undefined" :class="['growth-badge', metrics.salesGrowthPercentage >= 0 ? 'positive' : 'negative']">
            <span>{{ metrics.salesGrowthPercentage >= 0 ? '+' : '' }}{{ metrics.salesGrowthPercentage }}%</span>
          </div>
        </div>
        <div v-if="loading">
          <AppSkeleton height="32px" width="160px" />
        </div>
        <div v-else class="metric-value font-mono">
          {{ formatCurrency(metrics?.periodSales ?? metrics?.totalSalesThisMonth) }}
        </div>
        <div class="card-bottom">
          <span class="metric-sub text-muted">
            {{ metrics?.periodOrders || 0 }} commande(s) &bull; Panier moy. {{ formatCurrency(metrics?.periodAverageBasket) }}
          </span>
        </div>
      </div>

      <!-- 2. Estimated Net Profit in Period -->
      <div class="metric-card">
        <div class="card-top">
          <span class="metric-label">BÉNÉFICE NET ESTIMÉ</span>
          <span class="metric-sub text-caption">{{ activeRange?.label || metrics?.periodLabel }}</span>
        </div>
        <div v-if="loading">
          <AppSkeleton height="32px" width="140px" />
        </div>
        <div v-else :class="['metric-value', 'font-mono', (metrics?.periodNetProfit ?? metrics?.netProfitThisMonth ?? 0) >= 0 ? 'text-success' : 'text-danger']">
          {{ formatCurrency(metrics?.periodNetProfit ?? metrics?.netProfitThisMonth) }}
        </div>
        <span class="metric-sub text-muted">CA &minus; Achats &minus; Dépenses &minus; Salaires</span>
      </div>

      <!-- 3. Physical Stock Valuation -->
      <div class="metric-card">
        <div class="card-top">
          <span class="metric-label">VALORISATION DU STOCK</span>
          <span class="text-caption text-muted">{{ formatNumber(metrics?.totalStockItems) }} unités</span>
        </div>
        <div v-if="loading">
          <AppSkeleton height="32px" width="160px" />
        </div>
        <div v-else class="metric-value font-mono">
          {{ formatCurrency(metrics?.totalStockValue ?? metrics?.totalStockValuation) }}
        </div>
        <span class="metric-sub text-muted">Actif physique valorisé au prix d'achat</span>
      </div>

      <!-- 4. Stock Health & Alerts -->
      <div class="metric-card">
        <span class="metric-label">SANTÉ DU STOCK</span>
        <div v-if="loading">
          <AppSkeleton height="32px" width="120px" />
        </div>
        <div v-else class="metric-stats">
          <div class="stat-pill">
            <span class="stat-num text-danger">{{ metrics?.outOfStockCount || 0 }}</span>
            <span class="stat-text">Rupture de stock</span>
          </div>
          <div class="stat-pill">
            <span class="stat-num text-warning">{{ metrics?.lowStockCount || 0 }}</span>
            <span class="stat-text">Stock faible (&le;10)</span>
          </div>
        </div>
        <span class="metric-sub text-muted">Alertes actives de réapprovisionnement</span>
      </div>

      <!-- 5. Pending Transfers -->
      <div class="metric-card">
        <span class="metric-label">TRANSFERTS EN ATTENTE</span>
        <div v-if="loading">
          <AppSkeleton height="32px" width="80px" />
        </div>
        <div v-else class="metric-value font-mono">
          {{ metrics?.pendingTransfersCount || 0 }}
        </div>
        <span class="metric-sub text-muted">En attente de validation logistique</span>
      </div>
    </div>

    <!-- Sales Evolution Trend Widget (Time Series Breakdown) -->
    <div v-if="metrics?.salesTrend && metrics.salesTrend.length > 0" class="section-card">
      <div class="section-header">
        <div>
          <h3>Évolution Chronologique des Ventes</h3>
          <span class="text-caption">
            Historique d'activité sur {{ activeRange?.label || metrics.periodLabel }} &bull; {{ metrics.salesTrend.length }} point(s) d'enregistrement
          </span>
        </div>
        <div class="trend-summary-pill font-mono">
          Total : <strong>{{ formatCurrency(metrics.periodSales) }}</strong>
        </div>
      </div>

      <!-- Sparkline / Trend Bar Visualizer -->
      <div class="trend-chart-container">
        <div class="trend-bars-wrapper">
          <div
            v-for="(t, idx) in metrics.salesTrend"
            :key="idx"
            class="trend-bar-column"
            :title="`${t.date}: ${formatCurrency(t.totalAmount)} (${t.ordersCount} cmd)`"
          >
            <div class="bar-fill-track">
              <div
                class="bar-fill-value"
                :style="{ height: `${Math.max((t.totalAmount / maxTrendAmount) * 100, 6)}%` }"
              ></div>
            </div>
            <span class="bar-date-label">{{ t.date.slice(-5) }}</span>
            <span class="bar-amount-tooltip">{{ formatCurrency(t.totalAmount) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Multi-Warehouse Comparison Table (Admin Consolidated View) -->
    <div v-if="metrics?.warehouseComparisons && metrics.warehouseComparisons.length > 0" class="section-card">
      <div class="section-header">
        <div>
          <h3>Vue d'Ensemble Multi-Entrepôts</h3>
          <span class="text-caption">Comparaison opérationnelle des sites sur {{ activeRange?.label || metrics?.periodLabel || 'la période' }}</span>
        </div>
      </div>

      <AppTable :loading="loading" :columns-count="6">
        <template #header>
          <th>Entrepôt</th>
          <th>Valorisation du Stock</th>
          <th>Articles Distincts</th>
          <th>Ventes sur la Période</th>
          <th>Charges / Dépenses</th>
          <th>Masse Salariale</th>
        </template>
        <template #body>
          <tr v-for="w in metrics.warehouseComparisons" :key="w.warehouseId">
            <td>
              <strong>{{ w.warehouseName }}</strong>
              <span class="text-caption" style="margin-left: 6px;">({{ w.warehouseCode }})</span>
            </td>
            <td class="font-mono">{{ formatCurrency(w.stockValue) }}</td>
            <td>{{ formatNumber(w.totalProductsCount) }} articles</td>
            <td class="font-mono font-bold">{{ formatCurrency(w.periodSales ?? w.monthlySales) }}</td>
            <td class="font-mono text-muted">{{ formatCurrency(w.monthlyExpenses) }}</td>
            <td class="font-mono text-muted">{{ formatCurrency(w.monthlySalaries) }}</td>
          </tr>
        </template>
      </AppTable>
    </div>

    <!-- Dual Tables: Recent Sales & Recent Movements -->
    <div class="dual-grid">
      <!-- Recent Sales -->
      <div class="section-card">
        <div class="section-header">
          <h3>Factures Récentes de Vente</h3>
          <router-link to="/sales" class="section-link">Consulter Tout &rarr;</router-link>
        </div>

        <AppTable :loading="loading" :empty="!metrics?.recentSales?.length" empty-text="Aucune vente enregistrée" :columns-count="4">
          <template #header>
            <th>Facture</th>
            <th>Entrepôt</th>
            <th>Total</th>
            <th>Statut</th>
          </template>
          <template #body>
            <tr v-for="sale in metrics?.recentSales" :key="sale.id">
              <td>
                <span class="font-mono font-bold">{{ sale.invoiceNumber }}</span>
                <div class="text-caption">{{ formatDateTime(sale.saleDate || sale.createdAt) }}</div>
              </td>
              <td>{{ sale.warehouseName }}</td>
              <td class="font-mono">{{ formatCurrency(sale.totalAmount) }}</td>
              <td>
                <AppBadge :variant="sale.status === 'COMPLETED' ? 'success' : 'danger'" size="sm">
                  {{ formatSaleStatus(sale.status) }}
                </AppBadge>
              </td>
            </tr>
          </template>
        </AppTable>
      </div>

      <!-- Recent Stock Movements -->
      <div class="section-card">
        <div class="section-header">
          <h3>Mouvements Récents de Stock</h3>
          <router-link to="/movements" class="section-link">Consulter le Registre &rarr;</router-link>
        </div>

        <AppTable :loading="loading" :empty="!metrics?.recentMovements?.length" empty-text="Aucun mouvement récent" :columns-count="4">
          <template #header>
            <th>Produit</th>
            <th>Type</th>
            <th>Qté</th>
            <th>Date</th>
          </template>
          <template #body>
            <tr v-for="m in metrics?.recentMovements" :key="m.id">
              <td>
                <strong>{{ m.productName }}</strong>
                <div class="text-caption font-mono">{{ m.productReference }}</div>
              </td>
              <td>
                <AppBadge :variant="(m.quantityChange ?? m.quantity ?? 0) > 0 ? 'info' : 'neutral'" size="sm">
                  {{ formatMovementType(m.movementType ?? m.type) }}
                </AppBadge>
              </td>
              <td :class="['font-mono', (m.quantityChange ?? m.quantity ?? 0) > 0 ? 'text-success' : 'text-danger']">
                {{ (m.quantityChange ?? m.quantity ?? 0) > 0 ? '+' : '' }}{{ formatNumber(m.quantityChange ?? m.quantity) }}
              </td>
              <td class="text-caption">{{ formatDateTime(m.createdAt) }}</td>
            </tr>
          </template>
        </AppTable>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  margin-bottom: 4px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.refresh-btn:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-dark);
}

/* Metric Cards */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 16px;
}

.metric-card {
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}

.highlight-card {
  border-left: 4px solid var(--color-primary);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.growth-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 10px;
  font-family: monospace;
}

.growth-badge.positive {
  background-color: rgba(16, 185, 129, 0.15);
  color: #059669;
}

.growth-badge.negative {
  background-color: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}

.metric-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
}

.text-success {
  color: var(--color-success) !important;
}

.text-danger {
  color: var(--color-danger) !important;
}

.text-warning {
  color: var(--color-warning) !important;
}

.metric-sub {
  font-size: 11px;
}

.metric-stats {
  display: flex;
  gap: 12px;
}

.stat-pill {
  display: flex;
  flex-direction: column;
}

.stat-num {
  font-size: 18px;
  font-weight: 700;
}

.stat-text {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.section-card {
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-link {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: none;
}

.section-link:hover {
  text-decoration: underline;
}

/* Trend Chart */
.trend-summary-pill {
  font-size: 13px;
  background-color: var(--color-surface);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.trend-chart-container {
  padding: 16px 8px 8px 8px;
  background-color: var(--color-surface);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}

.trend-bars-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  height: 120px;
  min-width: 100%;
  padding-bottom: 24px;
}

.trend-bar-column {
  flex: 1;
  min-width: 32px;
  max-width: 64px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  position: relative;
  cursor: pointer;
}

.bar-fill-track {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar-fill-value {
  width: 70%;
  background: linear-gradient(180deg, var(--color-primary) 0%, rgba(37, 99, 235, 0.4) 100%);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease, background 0.2s ease;
}

.trend-bar-column:hover .bar-fill-value {
  background: linear-gradient(180deg, var(--color-primary-hover, #1d4ed8) 0%, var(--color-primary) 100%);
}

.bar-date-label {
  position: absolute;
  bottom: -20px;
  font-size: 10px;
  color: var(--color-text-secondary);
  font-family: monospace;
  white-space: nowrap;
}

.bar-amount-tooltip {
  display: none;
  position: absolute;
  top: -24px;
  background-color: #1e293b;
  color: #ffffff;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  font-family: monospace;
}

.trend-bar-column:hover .bar-amount-tooltip {
  display: block;
}

.dual-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 900px) {
  .dual-grid {
    grid-template-columns: 1fr;
  }
}
</style>
