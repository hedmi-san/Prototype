<script setup lang="ts">
import { computed } from 'vue';
import type { Transfer } from '../../types';
import { generateBarcodeSvg } from '../../utils/barcode';
import { formatDateTime, formatNumber } from '../../utils/formatters';
import AppButton from '../common/AppButton.vue';

interface Props {
  transfer: Transfer | any;
  companyName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  companyName: 'EURL BOUSFOR GEN TRADING IMP.EXP',
});

const transferNumber = computed(() => {
  return props.transfer.transferNumber || `TRF-${props.transfer.id}`;
});

const formattedDate = computed(() => {
  const dateVal = props.transfer.approvedAt || props.transfer.createdAt || new Date().toISOString();
  return formatDateTime(dateVal);
});

const items = computed<any[]>(() => {
  const rawItems = props.transfer?.items || [];
  return rawItems.filter((i: any) => (i.approvedQuantity !== undefined ? Number(i.approvedQuantity) : Number(i.quantity || 0)) > 0);
});

const totalUnits = computed(() => {
  return items.value.reduce((sum: number, i: any) => {
    const qty = i.approvedQuantity !== undefined ? Number(i.approvedQuantity) : Number(i.quantity || 0);
    return sum + qty;
  }, 0);
});

const barcodeSvg = computed(() => {
  if (!transferNumber.value) return '';
  return generateBarcodeSvg(transferNumber.value, {
    height: 38,
    moduleWidth: 1.4,
    quietZone: 4,
    barColor: '#000000',
    bgColor: '#ffffff',
  });
});

function printSlip() {
  window.print();
}
</script>

<template>
  <div class="transport-slip-wrapper">
    <!-- Screen Actions Toolbar (Hidden on Print) -->
    <div class="no-print print-actions">
      <AppButton variant="primary" size="md" @click="printSlip">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-1">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        Imprimer le Bon de Transport
      </AppButton>
    </div>

    <!-- Printable Document Body -->
    <div class="transport-slip">
      <!-- Header Section -->
      <div class="slip-header">
        <div class="company-brand">
          <div>
            <h2 class="company-name">{{ companyName }}</h2>
            <p class="company-sub">IMPORTATION &amp; DISTRIBUTION OUTILLAGE &amp; QUINCAILLERIE</p>
          </div>
        </div>
        <div class="slip-title-box">
          <h3 class="slip-title">BON DE TRANSPORT</h3>
        </div>
      </div>

      <!-- Voucher Meta & Barcode -->
      <div class="meta-barcode-section">
        <div class="voucher-info">
          <div class="info-row">
            <span class="label">N° Transfert :</span>
            <span class="value font-mono font-bold text-primary">{{ transferNumber }}</span>
          </div>
          <div class="info-row">
            <span class="label">Date d'approbation :</span>
            <span class="value font-mono">{{ formattedDate }}</span>
          </div>
          <div v-if="transfer.notes" class="info-row notes-row">
            <span class="label">Motif / Notes :</span>
            <span class="value">{{ transfer.notes }}</span>
          </div>
        </div>

        <div class="barcode-container" v-if="barcodeSvg">
          <div v-html="barcodeSvg"></div>
          <span class="barcode-text font-mono">{{ transferNumber }}</span>
        </div>
      </div>

      <!-- Routing Grid (Source -> Destination) -->
      <div class="routing-grid">
        <div class="routing-card origin-card">
          <div class="card-tag">DÉPÔT EXPÉDITEUR (DÉPART)</div>
          <div class="wh-title">{{ transfer.sourceWarehouseName }}</div>
          <div class="wh-meta font-mono">{{ transfer.sourceWarehouseCode }}</div>
        </div>
        <div class="routing-arrow">
          <span>➔</span>
        </div>
        <div class="routing-card destination-card">
          <div class="card-tag dest-tag">DÉPÔT DESTINATAIRE (ARRIVÉE)</div>
          <div class="wh-title">{{ transfer.destinationWarehouseName }}</div>
          <div class="wh-meta font-mono">{{ transfer.destinationWarehouseCode }}</div>
        </div>
      </div>

      <!-- Items Manifest Table -->
      <table class="slip-items-table">
        <thead>
          <tr>
            <th style="width: 40px;" class="text-center">#</th>
            <th style="width: 140px;">Code Référence</th>
            <th>Désignation Produit</th>
            <th style="width: 130px;" class="text-right">Quantité Expédiée</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in items" :key="item.id || item.productId || idx">
            <td class="text-center text-muted font-mono">{{ idx + 1 }}</td>
            <td class="font-mono font-bold">{{ item.productReference || '—' }}</td>
            <td class="font-semibold">{{ item.productName }}</td>
            <td class="text-right font-mono font-bold qty-cell">
              {{ formatNumber(item.approvedQuantity !== undefined ? item.approvedQuantity : item.quantity) }}
            </td>
          </tr>
          <tr v-if="items.length === 0">
            <td colspan="4" class="text-center text-muted py-3">Aucun article enregistré pour ce transfert</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td colspan="2" class="font-bold">Total Articles : {{ items.length }}</td>
            <td class="text-right font-bold">Total Unités Expédiées :</td>
            <td class="text-right font-mono font-bold total-qty-cell">{{ formatNumber(totalUnits) }} pcs</td>
          </tr>
        </tfoot>
      </table>

    </div>
  </div>
</template>

<style scoped>
.transport-slip-wrapper {
  max-width: 820px;
  margin: 0 auto;
}

.print-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.transport-slip {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 1.8rem 2.2rem;
  color: #0f172a;
  font-family: Arial, Helvetica, sans-serif;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
}

.slip-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #0f172a;
  padding-bottom: 0.8rem;
  margin-bottom: 1.2rem;
}

.company-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: #ffffff;
  background: #1e3a8a;
  border: 2px solid #0f172a;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.05em;
  border-radius: 4px;
}

.company-name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: #1e3a8a;
}

.company-sub {
  margin: 0.2rem 0 0 0;
  font-size: 0.7rem;
  color: #475569;
  font-weight: 600;
}

.company-doc-line {
  margin: 0.25rem 0 0 0;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #64748b;
}

.slip-title-box {
  text-align: right;
}

.slip-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: 0.06em;
}

.slip-sub {
  font-size: 0.75rem;
  font-weight: 700;
  color: #1e3a8a;
  display: block;
  margin-top: 2px;
}

.meta-barcode-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 0.9rem 1.2rem;
  margin-bottom: 1.2rem;
}

.voucher-info {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.info-row .label {
  font-weight: 600;
  color: #475569;
  min-width: 140px;
}

.info-row .value {
  color: #0f172a;
}

.barcode-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.barcode-text {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: #334155;
  margin-top: 2px;
}

.routing-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  margin-bottom: 1.4rem;
}

.routing-card {
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 0.75rem 1rem;
  background: #fdfdfd;
}

.card-tag {
  font-size: 0.65rem;
  font-weight: 800;
  color: #1e3a8a;
  letter-spacing: 0.05em;
  margin-bottom: 0.3rem;
}

.dest-tag {
  color: #047857;
}

.wh-title {
  font-size: 1rem;
  font-weight: 800;
  color: #0f172a;
}

.wh-meta {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 2px;
}

.routing-arrow {
  font-size: 1.4rem;
  font-weight: bold;
  color: #64748b;
  text-align: center;
}

.slip-items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.4rem;
  font-size: 0.85rem;
}

.slip-items-table th {
  background-color: #f1f5f9;
  color: #1e293b;
  font-weight: 700;
  border-top: 1px solid #cbd5e1;
  border-bottom: 2px solid #0f172a;
  padding: 8px 10px;
  text-align: left;
}

.slip-items-table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 8px 10px;
  color: #0f172a;
}

.qty-cell {
  font-size: 0.95rem;
  color: #1e3a8a;
}

.totals-row td {
  background-color: #f8fafc;
  border-top: 2px solid #0f172a;
  border-bottom: 2px solid #0f172a;
  padding: 10px;
  font-size: 0.9rem;
}

.total-qty-cell {
  font-size: 1rem;
  color: #1e3a8a;
}

.signatures-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 1.6rem;
  margin-bottom: 1.2rem;
}

.sig-box {
  border: 1px dashed #94a3b8;
  border-radius: 4px;
  padding: 0.8rem 1rem;
  display: flex;
  flex-direction: column;
  height: 120px;
  justify-content: space-between;
}

.sig-label {
  font-size: 0.72rem;
  font-weight: 800;
  color: #334155;
  letter-spacing: 0.04em;
}

.sig-hint {
  font-size: 0.65rem;
  color: #64748b;
  font-style: italic;
}

.slip-footer {
  border-top: 1px solid #e2e8f0;
  padding-top: 0.8rem;
  font-size: 0.7rem;
  color: #64748b;
  text-align: center;
  line-height: 1.4;
}

/* Print Optimization */
@media print {
  @page {
    size: A4 portrait;
    margin: 10mm 12mm;
  }

  body {
    background: #ffffff !important;
    color: #000000 !important;
  }

  .no-print {
    display: none !important;
  }

  .transport-slip-wrapper {
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .transport-slip {
    box-shadow: none !important;
    border: 1px solid #94a3b8 !important;
    padding: 10mm !important;
  }

  .brand-mark {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .slip-items-table th,
  .totals-row td,
  .meta-barcode-section {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
</style>
