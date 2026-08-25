<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { reportService } from '../../services/admin-reports.service';
import type { FinancialReport } from '../../types';
import type { ComputedPeriodRange } from '../../utils/periodNavigator';
import { formatCurrency, formatExpenseCategory, formatDateTime } from '../../utils/formatters';
import { downloadBlob } from '../../utils/export';
import AppButton from '../../components/common/AppButton.vue';
import AppSkeleton from '../../components/common/AppSkeleton.vue';
import AppPeriodNavigator from '../../components/common/AppPeriodNavigator.vue';

const authStore = useAuthStore();
const period = ref(new Date().toISOString().slice(0, 7)); // YYYY-MM
const activeRange = ref<ComputedPeriodRange | null>(null);
const report = ref<FinancialReport | null>(null);
const loading = ref(true);

const printTimestamp = computed(() => formatDateTime(new Date(), false));

onMounted(async () => {
  if (!activeRange.value) {
    await fetchReport();
  }
});

async function onPeriodChange(range: ComputedPeriodRange) {
  activeRange.value = range;
  period.value = range.startDate.slice(0, 7);
  await fetchReport();
}

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

function handleExportCsv() {
  if (!report.value) return;
  const BOM = '\uFEFF';
  const rows: (string | number)[][] = [
    ['Rubrique', 'Montant (DZD)'],
    ["Revenus Bruts d'Exploitation", report.value.totalRevenue],
    ['Coût des Marchandises Vendues (COGS)', -report.value.costOfGoodsSold],
    ['Marge Brute Commerciale', report.value.grossProfit],
    ...Object.entries(report.value.expensesByCategory || {}).map(([cat, amt]) => [`Charges : ${formatExpenseCategory(cat as any)}`, -amt]),
    ["Total Charges d'Exploitation", -report.value.totalExpenses],
    ['Total Salaires et Personnel', -report.value.totalSalaries],
    ["Résultat Net d'Exploitation", report.value.netProfit],
  ];

  const csv = BOM + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `compte_de_resultat_${report.value.period || 'bilan'}.csv`);
}

function handlePrint() {
  window.print();
}
</script>

<template>
  <div class="financial-view">
    <!-- Printable Document Header (visible exclusively in print) -->
    <header class="print-header">
      <div class="print-header-top">
        <div>
          <div class="print-company-name">DISTRI-TOOLS DZ &bull; EURL BOUSFOR HOSNA</div>
          <h1 class="print-doc-title">Compte de Résultat Financier (P&L)</h1>
          <p class="print-doc-subtitle">Revenus consolidés, coût des marchandises vendues, charges d'exploitation et marge nette</p>
        </div>
        <div class="print-meta-box">
          <div><span class="meta-label">Périmètre Entrepôt :</span> <strong>{{ report?.warehouseName || 'Tous les entrepôts' }}</strong></div>
          <div><span class="meta-label">Période :</span> <strong>{{ activeRange?.label || report?.period || period }}</strong></div>
          <div><span class="meta-label">Date d'édition :</span> <strong>{{ printTimestamp }}</strong></div>
        </div>
      </div>
      <div class="print-header-divider" />
    </header>

    <div class="page-header">
      <div>
        <h1 class="page-title">Compte de Résultat Financier (P&L)</h1>
        <p class="text-muted">Revenus consolidés, coût des marchandises vendues, charges d'exploitation et marge nette</p>
      </div>
      <div class="header-actions">
        <AppButton variant="secondary" @click="handleExportCsv">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exporter CSV
        </AppButton>
        <AppButton variant="secondary" @click="handlePrint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect width="12" height="8" x="6" y="14" />
          </svg>
          Imprimer le Bilan
        </AppButton>
      </div>
    </div>

    <!-- Reusable Period Navigator -->
    <AppPeriodNavigator
      initial-granularity="month"
      @change="onPeriodChange"
    />

    <!-- Income Statement Document Card -->
    <div class="card statement-card">
      <div class="statement-header">
        <div>
          <h2>BOUSFOR HOSNA</h2>
          <p class="text-caption text-muted">Compte de Résultat pour la période : {{ activeRange?.label || report?.period }}</p>
          <p class="text-caption text-muted">Entité Entrepôt : {{ report?.warehouseName }}</p>
        </div>
        <div class="net-profit-badge" :class="(report?.netProfit || 0) >= 0 ? 'bg-success-subtle' : 'bg-danger-subtle'">
          <span class="text-caption">RÉSULTAT NET D'EXPLOITATION</span>
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
          <span>1. REVENUS D'EXPLOITATION</span>
          <span></span>
        </div>
        <div class="line-row">
          <span class="line-indent">Ventes brutes d'outillage facturées</span>
          <span class="font-mono font-bold">{{ formatCurrency(report?.totalRevenue) }}</span>
        </div>
        <div class="line-row subtotal-row">
          <span>Total des Revenus d'Exploitation</span>
          <span class="font-mono font-bold">{{ formatCurrency(report?.totalRevenue) }}</span>
        </div>

        <!-- 2. Cost of Goods Sold -->
        <div class="section-row header-row mt-3">
          <span>2. COÛT DES MARCHANDISES VENDUES (COGS)</span>
          <span></span>
        </div>
        <div class="line-row">
          <span class="line-indent">Coût d'achat des produits facturés et vendus</span>
          <span class="font-mono text-muted">({{ formatCurrency(report?.costOfGoodsSold) }})</span>
        </div>
        <div class="line-row subtotal-row">
          <strong>MARGE BRUTE COMMERCIALE</strong>
          <strong class="font-mono font-bold text-success">{{ formatCurrency(report?.grossProfit) }}</strong>
        </div>

        <!-- 3. Operating Expenses -->
        <div class="section-row header-row mt-3">
          <span>3. CHARGES & DÉPENSES D'EXPLOITATION</span>
          <span></span>
        </div>
        <div v-for="(amount, category) in report?.expensesByCategory" :key="category" class="line-row">
          <span class="line-indent">Charges : {{ formatExpenseCategory(category as any) }}</span>
          <span class="font-mono text-muted">({{ formatCurrency(amount) }})</span>
        </div>
        <div class="line-row subtotal-row">
          <span>Total des Charges d'Exploitation</span>
          <span class="font-mono text-muted">({{ formatCurrency(report?.totalExpenses) }})</span>
        </div>

        <!-- 4. Payroll & Staff Salaries -->
        <div class="section-row header-row mt-3">
          <span>4. RÉMUNÉRATION & CHARGES DU PERSONNEL</span>
          <span></span>
        </div>
        <div class="line-row">
          <span class="line-indent">Salaires de base et primes du personnel</span>
          <span class="font-mono text-muted">({{ formatCurrency(report?.totalSalaries) }})</span>
        </div>
        <div class="line-row subtotal-row">
          <span>Total des Frais de Personnel</span>
          <span class="font-mono text-muted">({{ formatCurrency(report?.totalSalaries) }})</span>
        </div>

        <!-- 5. Net Profit Result -->
        <div class="line-row final-total-row mt-4">
          <span class="text-h3 font-bold">BÉNÉFICE / (PERTE) NETTE</span>
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

/* Print header hidden in standard screen view */
.print-header {
  display: none;
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

/* ==========================================================
   PRINT MEDIA STYLES - A4 PORTRAIT FINANCIAL STATEMENT
   ========================================================== */
@media print {
  @page {
    size: A4 portrait;
    margin: 10mm;
  }

  .financial-view {
    display: block !important;
    width: 100% !important;
    gap: 0 !important;
  }

  .page-header,
  :deep(.app-period-navigator) {
    display: none !important;
  }

  .print-header {
    display: block !important;
    margin-bottom: 14px;
  }

  .print-header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .print-company-name {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: #000000;
    text-transform: uppercase;
    margin-bottom: 2px;
  }

  .print-doc-title {
    font-size: 18px;
    font-weight: 700;
    color: #000000;
    margin-bottom: 2px;
  }

  .print-doc-subtitle {
    font-size: 11px;
    color: #555555;
    margin: 0;
  }

  .print-meta-box {
    font-size: 12px;
    text-align: right;
    color: #000000;
    line-height: 1.5;
  }

  .meta-label {
    color: #444444;
  }

  .print-header-divider {
    width: 100%;
    height: 1.5px;
    background-color: #000000;
    margin: 8px 0 14px 0;
  }

  .statement-card {
    max-width: 100% !important;
    border: 1px solid #777777 !important;
    box-shadow: none !important;
    padding: 16px !important;
    background: #ffffff !important;
    page-break-inside: avoid;
  }

  .statement-header {
    padding-bottom: 12px !important;
    margin-bottom: 12px !important;
    border-bottom: 2px solid #000000 !important;
  }

  .net-profit-badge {
    border: 1px solid #777777 !important;
    background: transparent !important;
  }

  .line-row {
    padding: 6px 8px !important;
    border-bottom: 1px solid #e0e0e0 !important;
    font-size: 12px !important;
  }

  .subtotal-row {
    background-color: #f5f5f5 !important;
    border-bottom: 1px solid #999999 !important;
  }

  .final-total-row {
    border: 2px solid #000000 !important;
    background-color: #f9f9f9 !important;
    padding: 12px 16px !important;
  }
}
</style>
