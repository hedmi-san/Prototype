<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { reportService } from '../../services/admin-reports.service';
import type { DashboardMetrics } from '../../types';
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

const authStore = useAuthStore();
const metrics = ref<DashboardMetrics | null>(null);
const loading = ref(true);

onMounted(async () => {
  await fetchMetrics();
});

async function fetchMetrics() {
  loading.value = true;
  try {
    metrics.value = await reportService.getDashboardMetrics(authStore.activeWarehouseId || undefined);
  } catch (err) {
    console.error('Failed to load dashboard metrics', err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="dashboard-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Tableau de Bord Général</h1>
        <p class="text-muted">
          {{ authStore.activeWarehouseId ? 'Performance & Suivi des Stocks de l\'Entrepôt' : 'Opérations Consolidées Multi-Entrepôts' }}
        </p>
      </div>
      <div class="header-actions">
        <button class="refresh-btn" @click="fetchMetrics">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Actualiser les données
        </button>
      </div>
    </div>

    <!-- Metric Cards Grid -->
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-label">VALORISATION TOTALE DU STOCK</span>
        <div v-if="loading">
          <AppSkeleton height="32px" width="160px" />
        </div>
        <div v-else class="metric-value font-mono">
          {{ formatCurrency(metrics?.totalStockValue) }}
        </div>
        <span class="metric-sub text-muted">Évalué au prix d'achat actuel</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">VENTES DU JOUR</span>
        <div v-if="loading">
          <AppSkeleton height="32px" width="140px" />
        </div>
        <div v-else class="metric-value font-mono">
          {{ formatCurrency(metrics?.salesToday) }}
        </div>
        <span class="metric-sub text-muted">Réalisées aujourd'hui</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">VENTES DU MOIS</span>
        <div v-if="loading">
          <AppSkeleton height="32px" width="160px" />
        </div>
        <div v-else class="metric-value font-mono">
          {{ formatCurrency(metrics?.salesThisMonth) }}
        </div>
        <span class="metric-sub text-muted">Chiffre d'affaires brut mensuel</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">BÉNÉFICE NET ESTIMÉ (MOIS)</span>
        <div v-if="loading">
          <AppSkeleton height="32px" width="140px" />
        </div>
        <div v-else :class="['metric-value', 'font-mono', (metrics?.netProfitThisMonth || 0) >= 0 ? 'text-success' : 'text-danger']">
          {{ formatCurrency(metrics?.netProfitThisMonth) }}
        </div>
        <span class="metric-sub text-muted">CA - Coût d'achat - Dépenses - Salaires</span>
      </div>

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
        <span class="metric-sub text-muted">Alertes de réapprovisionnement</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">TRANSFERTS EN ATTENTE</span>
        <div v-if="loading">
          <AppSkeleton height="32px" width="80px" />
        </div>
        <div v-else class="metric-value font-mono">
          {{ metrics?.pendingTransfersCount || 0 }}
        </div>
        <span class="metric-sub text-muted">En attente d'approbation source</span>
      </div>
    </div>

    <!-- Multi-Warehouse Comparison Table (Admin Consolidated View) -->
    <div v-if="metrics?.warehouseComparisons && metrics.warehouseComparisons.length > 0" class="section-card">
      <div class="section-header">
        <h3>Vue d'Ensemble Multi-Entrepôts</h3>
        <span class="text-caption">Métriques opérationnelles comparatives entre sites</span>
      </div>

      <AppTable :loading="loading" :columns-count="6">
        <template #header>
          <th>Entrepôt</th>
          <th>Valorisation du Stock</th>
          <th>Articles au Catalogue</th>
          <th>Ventes du Mois</th>
          <th>Dépenses du Mois</th>
          <th>Salaires du Mois</th>
        </template>
        <template #body>
          <tr v-for="w in metrics.warehouseComparisons" :key="w.warehouseId">
            <td>
              <strong>{{ w.warehouseName }}</strong>
              <span class="text-caption" style="margin-left: 6px;">({{ w.warehouseCode }})</span>
            </td>
            <td class="font-mono">{{ formatCurrency(w.stockValue) }}</td>
            <td>{{ formatNumber(w.totalProductsCount) }} articles</td>
            <td class="font-mono">{{ formatCurrency(w.monthlySales) }}</td>
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
          <router-link to="/sales" class="section-link">Voir Tout &rarr;</router-link>
        </div>

        <AppTable :loading="loading" :empty="!metrics?.recentSales?.length" empty-text="Aucune vente récente" :columns-count="4">
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
                <div class="text-caption">{{ formatDateTime(sale.saleDate) }}</div>
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
                <AppBadge :variant="m.quantity > 0 ? 'info' : 'neutral'" size="sm">
                  {{ formatMovementType(m.type) }}
                </AppBadge>
              </td>
              <td :class="['font-mono', m.quantity > 0 ? 'text-success' : 'text-danger']">
                {{ m.quantity > 0 ? '+' : '' }}{{ formatNumber(m.quantity) }}
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
  gap: 24px;
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
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.refresh-btn:hover {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-dark);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
