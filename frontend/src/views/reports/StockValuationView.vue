<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { reportService } from '../../services/admin-reports.service';
import { inventoryService } from '../../services/operations.service';
import type { StockValuationReport } from '../../types';
import { formatCurrency, formatNumber, formatDateTime } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppButton from '../../components/common/AppButton.vue';

const authStore = useAuthStore();
const report = ref<StockValuationReport | null>(null);
const loading = ref(true);
const exporting = ref(false);

const printTimestamp = computed(() => formatDateTime(new Date(), false));

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

async function handleExportCsv() {
  exporting.value = true;
  try {
    await inventoryService.exportStockCsv({ warehouseId: authStore.activeWarehouseId || undefined });
  } catch (err) {
    console.error('Failed to export stock valuation CSV', err);
  } finally {
    exporting.value = false;
  }
}

function handlePrint() {
  window.print();
}
</script>

<template>
  <div class="valuation-view">
    <!-- Printable Document Header (visible exclusively in print) -->
    <header class="print-header">
      <div class="print-header-top">
        <div>
          <div class="print-company-name">EURL BOUSFOR HOSNA</div>
          <h1 class="print-doc-title">État de Valorisation des Stocks </h1>
          <p class="print-doc-subtitle">Valorisation des actifs basée sur les prix d'achat actuels : &sum;(Unités Physiques &times; Prix d'Achat)</p>
        </div>
        <div class="print-meta-box">
          <div><span class="meta-label">Périmètre Entrepôt :</span> <strong>{{ report?.warehouseName || 'Tous les entrepôts' }}</strong></div>
          <div><span class="meta-label">Date d'édition :</span> <strong>{{ printTimestamp }}</strong></div>
        </div>
      </div>
      <div class="print-header-divider" />
    </header>

    <div class="page-header">
      <div>
        <h1 class="page-title">État de Valorisation des Stocks</h1>
        <p class="text-muted">
          Valorisation des actifs basée sur les prix d'achat actuels : &sum;(Unités Physiques &times; Prix d'Achat)
        </p>
      </div>
      <div class="header-actions">
        <AppButton variant="secondary" :loading="exporting" @click="handleExportCsv">
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

    <!-- Summary Metrics Header -->
    <div class="valuation-cards">
      <div class="val-card highlight-card">
        <span class="val-label">VALORISATION TOTALE DU PORTEFEUILLE</span>
        <strong class="font-mono text-h1 font-bold">{{ formatCurrency(report?.totalValuation) }}</strong>
        <span class="text-caption text-muted">Périmètre : {{ report?.warehouseName }}</span>
      </div>

      <div class="val-card">
        <span class="val-label">UNITÉS PHYSIQUES TOTALES</span>
        <strong class="font-mono text-h2">{{ formatNumber(report?.totalPhysicalUnits) }}</strong>
        <span class="text-caption text-muted">Unités physiquement en rayon</span>
      </div>

      <div class="val-card">
        <span class="val-label">RÉSERVÉ EN TRANSIT</span>
        <strong class="font-mono text-h2 text-warning">{{ formatNumber(report?.totalReservedUnits) }}</strong>
        <span class="text-caption text-muted">Unités verrouillées pour transferts</span>
      </div>

      <div class="val-card">
        <span class="val-label">DISPONIBLE À LA VENTE</span>
        <strong class="font-mono text-h2 text-success">{{ formatNumber(report?.totalAvailableUnits) }}</strong>
        <span class="text-caption text-muted">Stock net librement vendable</span>
      </div>
    </div>

    <!-- Valuation Breakdown Table -->
    <AppTable :loading="loading" :empty="!report?.items?.length" empty-text="Aucun article en stock trouvé" :columns-count="7">
      <template #header>
        <th>Entrepôt</th>
        <th>Réf Produit</th>
        <th>Nom du Produit</th>
        <th>Prix d'Achat</th>
        <th>Unités Physiques</th>
        <th>Unités Disponibles</th>
        <th>Sous-total Valorisation</th>
      </template>
      <template #body>
        <tr v-for="item in report?.items" :key="item.id">
          <td>{{ item.warehouseName }}</td>
          <td class="font-mono font-bold">{{ item.productReference }}</td>
          <td>
            <strong>{{ item.productName }}</strong>
            <span class="text-caption text-muted" style="display: block;">Marque : {{ item.productBrand }}</span>
          </td>
          <td class="font-mono">{{ formatCurrency(item.productPurchasePrice) }}</td>
          <td class="font-mono font-bold">{{ formatNumber(item.physicalQuantity) }}</td>
          <td class="font-mono text-success">{{ formatNumber(item.availableQuantity) }}</td>
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

/* Print header hidden in standard screen view */
.print-header {
  display: none;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
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

/* ==========================================================
   PRINT MEDIA STYLES - A4 LANDSCAPE VALUATION STATEMENT
   ========================================================== */
@media print {
  @page {
    size: A4 landscape;
    margin: 8mm 10mm;
  }

  .valuation-view {
    display: block !important;
    width: 100% !important;
    gap: 0 !important;
  }

  .page-header {
    display: none !important;
  }

  .print-header {
    display: block !important;
    margin-bottom: 12px;
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

  .valuation-cards {
    display: grid !important;
    grid-template-columns: repeat(4, 1fr) !important;
    gap: 8px !important;
    margin-bottom: 14px !important;
    page-break-inside: avoid;
  }

  .val-card {
    padding: 8px 10px !important;
    border: 1px solid #777777 !important;
    border-radius: 4px !important;
    background: #ffffff !important;
    box-shadow: none !important;
  }

  .val-label {
    font-size: 10px !important;
    color: #333333 !important;
  }

  .val-card strong {
    font-size: 15px !important;
  }

  .text-caption {
    font-size: 10px !important;
    color: #555555 !important;
  }

  :deep(.table-container) {
    border: 1px solid #777777 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow: visible !important;
    background: #ffffff !important;
  }

  :deep(.app-table) {
    width: 100% !important;
    border-collapse: collapse !important;
    font-size: 11px !important;
  }

  :deep(th) {
    background-color: #f2f2f2 !important;
    color: #000000 !important;
    border-bottom: 1.5px solid #000000 !important;
    padding: 5px 8px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
  }

  :deep(td) {
    padding: 5px 8px !important;
    border-bottom: 1px solid #cccccc !important;
    color: #000000 !important;
    font-size: 11px !important;
  }

  :deep(tr) {
    page-break-inside: avoid;
  }
}
</style>
