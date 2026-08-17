<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { reportService } from '../../services/admin-reports.service';
import type { FinancialReport } from '../../types';
import AppButton from '../../components/common/AppButton.vue';
import AppSkeleton from '../../components/common/AppSkeleton.vue';

const authStore = useAuthStore();
const period = ref(new Date().toISOString().slice(0, 7)); // YYYY-MM
const report = ref<FinancialReport | null>(null);
const loading = ref(true);

onMounted(async () => {
  await fetchReport();
});

async function fetchReport() {
  loading.value = true;
  try {
    report.value = await reportService.getFinancialReport(
      authStore.activeWarehouseId || undefined,
      period.value
    );
  } catch (err) {
    console.error('Failed to load financial statement', err);
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
  <div class="financial-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Financial Income Statement (P&L)</h1>
        <p class="text-muted">Consolidated revenue, cost of goods sold, operating overhead, and net margin</p>
      </div>
      <div class="header-actions">
        <div class="period-picker">
          <label class="period-label">Period:</label>
          <input
            v-model="period"
            type="month"
            class="period-input"
            @change="fetchReport"
          />
        </div>
        <AppButton variant="secondary" onclick="window.print()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect width="12" height="8" x="6" y="14" />
          </svg>
          Print Statement
        </AppButton>
      </div>
    </div>

    <!-- Income Statement Document Card -->
    <div class="card statement-card">
      <div class="statement-header">
        <div>
          <h2>DISTRI-TOOLS DZ</h2>
          <p class="text-caption text-muted">Statement of Profit & Loss for Period: {{ report?.period }}</p>
          <p class="text-caption text-muted">Warehouse Entity: {{ report?.warehouseName }}</p>
        </div>
        <div class="net-profit-badge" :class="(report?.netProfit || 0) >= 0 ? 'bg-success-subtle' : 'bg-danger-subtle'">
          <span class="text-caption">NET OPERATING RESULT</span>
          <strong :class="['font-mono', 'text-h2', (report?.netProfit || 0) >= 0 ? 'text-success' : 'text-danger']">
            {{ formatCurrency(report?.netProfit) }}
          </strong>
        </div>
      </div>

      <div v-if="loading" class="statement-skeleton">
        <AppSkeleton height="40px" :count="8" />
      </div>

      <div v-else class="statement-body">
        <!-- 1. Revenue -->
        <div class="section-row header-row">
          <span>1. OPERATING REVENUE</span>
          <span></span>
        </div>
        <div class="line-row">
          <span class="line-indent">Gross Invoiced Tool Sales</span>
          <span class="font-mono font-bold">{{ formatCurrency(report?.totalRevenue) }}</span>
        </div>
        <div class="line-row subtotal-row">
          <span>Total Operating Revenue</span>
          <span class="font-mono font-bold">{{ formatCurrency(report?.totalRevenue) }}</span>
        </div>

        <!-- 2. Cost of Goods Sold -->
        <div class="section-row header-row mt-3">
          <span>2. DIRECT PRODUCT COSTS (COGS)</span>
          <span></span>
        </div>
        <div class="line-row">
          <span class="line-indent">Cost of Invoiced Products Sold (at Purchase Price)</span>
          <span class="font-mono text-muted">({{ formatCurrency(report?.costOfGoodsSold) }})</span>
        </div>
        <div class="line-row subtotal-row">
          <strong>GROSS PROFIT MARGIN</strong>
          <strong class="font-mono font-bold text-success">{{ formatCurrency(report?.grossProfit) }}</strong>
        </div>

        <!-- 3. Operating Expenses -->
        <div class="section-row header-row mt-3">
          <span>3. OPERATING OVERHEAD EXPENSES</span>
          <span></span>
        </div>
        <div v-for="(amount, category) in report?.expensesByCategory" :key="category" class="line-row">
          <span class="line-indent">{{ category }} Expenses</span>
          <span class="font-mono text-muted">({{ formatCurrency(amount) }})</span>
        </div>
        <div class="line-row subtotal-row">
          <span>Total Operating Expenses</span>
          <span class="font-mono text-muted">({{ formatCurrency(report?.totalExpenses) }})</span>
        </div>

        <!-- 4. Payroll & Staff Salaries -->
        <div class="section-row header-row mt-3">
          <span>4. PERSONNEL & PAYROLL DISBURSEMENTS</span>
          <span></span>
        </div>
        <div class="line-row">
          <span class="line-indent">Monthly Staff Base Salaries & Bonuses</span>
          <span class="font-mono text-muted">({{ formatCurrency(report?.totalSalaries) }})</span>
        </div>
        <div class="line-row subtotal-row">
          <span>Total Payroll Disbursements</span>
          <span class="font-mono text-muted">({{ formatCurrency(report?.totalSalaries) }})</span>
        </div>

        <!-- 5. Net Profit Result -->
        <div class="line-row final-total-row mt-4">
          <span class="text-h3 font-bold">NET PROFIT / (LOSS)</span>
          <span :class="['font-mono', 'text-h2', 'font-bold', (report?.netProfit || 0) >= 0 ? 'text-success' : 'text-danger']">
            {{ formatCurrency(report?.netProfit) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.financial-view {
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

.period-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.period-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.period-input {
  height: 38px;
  padding: 6px 10px;
  font-size: 13px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  outline: none;
}

.statement-card {
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
}

.statement-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--color-primary);
  margin-bottom: 20px;
}

.net-profit-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.bg-success-subtle {
  background-color: var(--color-success-bg);
  border-color: var(--color-success-border);
}

.bg-danger-subtle {
  background-color: var(--color-danger-bg);
  border-color: var(--color-danger-border);
}

.statement-body {
  display: flex;
  flex-direction: column;
}

.section-row {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
  padding: 8px 0;
}

.line-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: 13px;
}

.line-indent {
  padding-left: 16px;
}

.subtotal-row {
  background-color: var(--color-surface);
  font-weight: 600;
  border-bottom: 1px solid var(--color-border);
}

.final-total-row {
  background-color: var(--color-bg-subtle);
  padding: 16px 20px;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-sm);
}

.font-bold {
  font-weight: 600;
}

.text-success {
  color: var(--color-success);
}

.text-danger {
  color: var(--color-danger);
}

.mt-3 { margin-top: 16px; }
.mt-4 { margin-top: 24px; }
</style>
