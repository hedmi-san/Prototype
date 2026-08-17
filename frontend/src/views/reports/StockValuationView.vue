<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { reportService } from '../../services/admin-reports.service';
import type { StockValuationReport } from '../../types';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';

const authStore = useAuthStore();
const report = ref<StockValuationReport | null>(null);
const loading = ref(true);

onMounted(async () => {
  await fetchReport();
});

async function fetchReport() {
  loading.value = true;
  try {
    report.value = await reportService.getStockValuation(authStore.activeWarehouseId || undefined);
  } catch (err) {
    console.error('Failed to load valuation report', err);
  } finally {
    loading.value = false;
  }
}

function formatCurrency(val?: number) {
  if (val === undefined || val === null) return '0.00 DZD';
  return new Intl.NumberFormat('fr-DZ', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val) + ' DZD';
}
</script>

<template>
  <div class="valuation-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Stock Valuation Statement</h1>
        <p class="text-muted">
          Asset valuation calculated using active current purchase prices: &sum;(Physical Units &times; Purchase Price)
        </p>
      </div>
      <div class="header-actions">
        <AppButton variant="secondary" onclick="window.print()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect width="12" height="8" x="6" y="14" />
          </svg>
          Export / Print Statement
        </AppButton>
      </div>
    </div>

    <!-- Summary Metrics Header -->
    <div class="valuation-cards">
      <div class="val-card highlight-card">
        <span class="val-label">TOTAL PORTFOLIO VALUATION</span>
        <strong class="font-mono text-h1 font-bold">{{ formatCurrency(report?.totalValuation) }}</strong>
        <span class="text-caption text-muted">Scope: {{ report?.warehouseName }}</span>
      </div>

      <div class="val-card">
        <span class="val-label">TOTAL PHYSICAL UNITS</span>
        <strong class="font-mono text-h2">{{ report?.totalPhysicalUnits || 0 }}</strong>
        <span class="text-caption text-muted">Units physically on shelves</span>
      </div>

      <div class="val-card">
        <span class="val-label">RESERVED IN TRANSIT</span>
        <strong class="font-mono text-h2 text-warning">{{ report?.totalReservedUnits || 0 }}</strong>
        <span class="text-caption text-muted">Units locked for transfer orders</span>
      </div>

      <div class="val-card">
        <span class="val-label">AVAILABLE FOR SALE</span>
        <strong class="font-mono text-h2 text-success">{{ report?.totalAvailableUnits || 0 }}</strong>
        <span class="text-caption text-muted">Net freely sellable inventory</span>
      </div>
    </div>

    <!-- Valuation Breakdown Table -->
    <AppTable :loading="loading" :empty="!report?.items?.length" empty-text="No stock items found" :columns-count="7">
      <template #header>
        <th>Warehouse</th>
        <th>Product Ref</th>
        <th>Product Name</th>
        <th>Purchase Price</th>
        <th>Physical Units</th>
        <th>Available Units</th>
        <th>Valuation Subtotal</th>
      </template>
      <template #body>
        <tr v-for="item in report?.items" :key="item.id">
          <td>{{ item.warehouseName }}</td>
          <td class="font-mono font-bold">{{ item.productReference }}</td>
          <td>
            <strong>{{ item.productName }}</strong>
            <span class="text-caption text-muted" style="display: block;">Brand: {{ item.productBrand }}</span>
          </td>
          <td class="font-mono">{{ formatCurrency(item.productPurchasePrice) }}</td>
          <td class="font-mono font-bold">{{ item.physicalQuantity }}</td>
          <td class="font-mono text-success">{{ item.availableQuantity }}</td>
          <td class="font-mono font-bold">{{ formatCurrency(item.totalValuation) }}</td>
        </tr>
      </template>
    </AppTable>
  </div>
</template>

<style scoped>
.valuation-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.valuation-cards {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr;
  gap: 16px;
}

.val-card {
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.highlight-card {
  background-color: var(--color-surface);
  border-color: var(--color-border-dark);
}

.val-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.05em;
}

.font-bold {
  font-weight: 600;
}

.text-success {
  color: var(--color-success);
}

.text-warning {
  color: var(--color-warning);
}

@media (max-width: 900px) {
  .valuation-cards {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
