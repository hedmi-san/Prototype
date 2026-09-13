<script setup lang="ts">
import { computed } from 'vue';
import type { SaleFulfillmentLine, Sale } from '../../types';
import { generateBarcodeSvg } from '../../utils/barcode';
import { formatCurrency, formatInvoiceDate } from '../../utils/formatters';
import AppButton from '../common/AppButton.vue';

interface Props {
  line: SaleFulfillmentLine;
  sale?: Partial<Sale>;
  companyName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  companyName: 'EURL BOUSFOR GEN TRADING IMP.EXP',
});

const isPrepaid = computed(() => {
  return props.line.paymentStatus === 'PAID';
});

const barcodeSvg = computed(() => {
  if (!props.line.pickupVoucherCode) return '';
  return generateBarcodeSvg(props.line.pickupVoucherCode, {
    height: 40,
    moduleWidth: 1.5,
    quietZone: 5,
    barColor: '#000000',
    bgColor: '#ffffff',
  });
});

function printSlip() {
  window.print();
}
</script>

<template>
  <div class="pickup-slip-wrapper">
    <div class="no-print print-actions">
      <AppButton variant="primary" @click="printSlip">
        Imprimer le bon de retrait
      </AppButton>
    </div>

    <div class="pickup-slip">
      <div class="slip-header">
        <div class="company-brand">
          <div class="brand-mark">GB</div>
          <div>
          <h2 class="company-name">{{ companyName }}</h2>
          <p class="company-sub">IMPORTATION & DISTRIBUTION OUTILLAGE & QUINCAILLERIE</p>
          <p class="company-doc-line">DOCUMENT LOGISTIQUE · ORIGINAL CLIENT</p>
          </div>
        </div>
        <div class="slip-title-box">
          <h3 class="slip-title">BON DE MISE À DISPOSITION</h3>
          <span class="slip-sub">RETRAIT CLIENT · INTER-DÉPÔTS</span>
        </div>
      </div>

      <div class="voucher-barcode-section">
        <div class="voucher-info">
          <div class="info-row">
            <span class="label">N° de bon</span>
            <span class="value font-mono font-bold text-primary">{{ line.pickupVoucherCode }}</span>
          </div>
          <div class="info-row" v-if="line.invoiceNumber || sale?.invoiceNumber">
            <span class="label">Facture associée</span>
            <span class="value font-mono font-semibold">{{ line.invoiceNumber || sale?.invoiceNumber }}</span>
          </div>
          <div class="info-row">
            <span class="label">Émis le</span>
            <span class="value">{{ formatInvoiceDate(line.createdAt) }}</span>
          </div>
        </div>
        <div class="barcode-container" v-if="barcodeSvg">
          <div v-html="barcodeSvg"></div>
          <span class="barcode-text font-mono">{{ line.pickupVoucherCode }}</span>
        </div>
      </div>

      <div
        class="payment-banner"
        :class="isPrepaid ? 'banner-prepaid' : 'banner-collect'"
      >
        <div class="banner-text">
          <h4 v-if="isPrepaid" class="banner-heading">
            STATUT DE RÈGLEMENT : DÉJÀ RÉGLÉE
          </h4>
          <h4 v-else class="banner-heading">
            STATUT DE RÈGLEMENT : À ENCAISSER AU RETRAIT — {{ formatCurrency(line.subtotal) }}
          </h4>
          <p v-if="isPrepaid" class="banner-desc">
            Aucune somme ne doit être encaissée au dépôt de retrait. La commande a été réglée au point de vente d'origine.
          </p>
          <p v-else class="banner-desc">
            Encaisser le montant indiqué avant remise de la marchandise, puis valider le retrait dans le système.
          </p>
        </div>
      </div>

      <div class="routing-grid">
        <div class="routing-card origin-card">
          <div class="card-tag">POINT DE VENTE ÉMETTEUR</div>
          <div class="wh-title">{{ line.originWarehouseName || 'Dépôt Origine' }}</div>
          <div class="wh-meta text-muted">Lieu d'enregistrement de la commande</div>
        </div>
        <div class="routing-arrow">
          <span>→</span>
        </div>
        <div class="routing-card destination-card">
          <div class="card-tag dest-tag">DÉPÔT DE RETRAIT AUTORISÉ</div>
          <div class="wh-title">{{ line.fulfillmentWarehouseName || 'Dépôt Retrait' }}</div>
          <div class="wh-meta text-muted">Remise exclusivement contre présentation de ce bon</div>
        </div>
      </div>

      <div class="customer-section">
        <div class="customer-title">BÉNÉFICIAIRE AUTORISÉ</div>
        <div class="customer-details">
          <span class="cust-name font-bold">{{ line.customerName || line.clientName || sale?.customerName || 'Client' }}</span>
          <span v-if="line.customerPhone || sale?.customerPhone" class="cust-phone">
            Tél. {{ line.customerPhone || sale?.customerPhone }}
          </span>
          <span v-if="line.clientCode" class="cust-code font-mono">
            Code: {{ line.clientCode }}
          </span>
        </div>
      </div>

      <table class="slip-items-table">
        <thead>
          <tr>
            <th>Réf. Produit</th>
            <th>Désignation</th>
            <th class="text-right">Qté autorisée</th>
            <th class="text-right">P.U.</th>
            <th class="text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-mono font-semibold">{{ line.productReference }}</td>
            <td class="font-semibold">{{ line.productName }}</td>
            <td class="text-right font-mono font-bold qty-cell">{{ line.quantity }}</td>
            <td class="text-right font-mono">{{ formatCurrency(line.unitPrice) }}</td>
            <td class="text-right font-mono font-semibold">{{ formatCurrency(line.subtotal) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="ttl-warning-box" v-if="line.reservationExpiresAt">
        <div class="ttl-title">VALIDITÉ DE LA MISE À DISPOSITION</div>
        <div class="ttl-desc">
          Ce bon est valable jusqu'au <strong>{{ formatInvoiceDate(line.reservationExpiresAt) }}</strong>. Après cette date, la réservation est libérée automatiquement et la remise nécessite une nouvelle validation.
        </div>
      </div>

      <div class="signatures-grid">
        <div class="sig-box">
          <span class="sig-label">BÉNÉFICIAIRE / PORTEUR</span>
          <div class="sig-space"></div>
          <span class="sig-hint">Nom, signature et mention « Bon pour réception »</span>
        </div>
        <div class="sig-box">
          <span class="sig-label">RESPONSABLE DU DÉPÔT</span>
          <div class="sig-space"></div>
          <span class="sig-hint">Date, signature et cachet lors de la remise</span>
        </div>
      </div>
      <div class="slip-footer">Ce document autorise la remise des articles ci-dessus. Toute modification manuscrite doit être validée par le responsable du dépôt.</div>
    </div>
  </div>
</template>

<style scoped>
.pickup-slip-wrapper {
  max-width: 780px;
  margin: 0 auto;
}

.print-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.pickup-slip {
  background: white;
  border: 1px solid #94a3b8;
  border-radius: 2px;
  padding: 1.5rem 2rem;
  color: #0f172a;
  font-family: Arial, Helvetica, sans-serif;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
}

.slip-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #0f172a;
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}

.company-name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: #172554;
}

.company-brand { display: flex; align-items: center; gap: 10px; }

.brand-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  color: #fff;
  background: #172554;
  border: 2px solid #334155;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.company-sub {
  margin: 0.2rem 0 0 0;
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 600;
}

.company-doc-line { margin: 0.25rem 0 0; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; color: #475569; }

.slip-title-box {
  text-align: right;
}

.slip-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: 0.05em;
}

.slip-sub {
  font-size: 0.7rem;
  font-weight: 700;
  color: #334155;
  letter-spacing: 0.08em;
}

.voucher-barcode-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.voucher-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
}

.info-row .label {
  color: #64748b;
  margin-right: 0.5rem;
  display: inline-block;
  min-width: 118px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

.barcode-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.barcode-text {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  margin-top: 0.15rem;
}

/* Big Banner */
.payment-banner {
  padding: 0.85rem 1rem;
  border-radius: 0;
  margin-bottom: 1.25rem;
}

.banner-prepaid {
  background: #f0fdf4;
  border: 1px solid #15803d;
  border-left: 5px solid #15803d;
  color: #14532d;
}

.banner-collect {
  background: #fffbeb;
  border: 1px solid #b45309;
  border-left: 5px solid #b45309;
  color: #78350f;
}

.banner-heading {
  margin: 0 0 0.25rem 0;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.banner-desc {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.35;
}

/* Routing */
.routing-grid {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.routing-card {
  flex: 1;
  border: 1px solid #cbd5e1;
  border-radius: 0;
  padding: 0.75rem 1rem;
  background: #ffffff;
}

.origin-card {
  border-left: 4px solid #3b82f6;
}

.destination-card {
  border-left: 4px solid #10b981;
  background: #f0fdf4;
}

.card-tag {
  font-size: 0.65rem;
  font-weight: 700;
  color: #3b82f6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.2rem;
}

.dest-tag {
  color: #059669;
}

.wh-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
}

.wh-meta {
  font-size: 0.75rem;
  margin-top: 0.2rem;
}

.routing-arrow {
  font-size: 1.5rem;
  color: #94a3b8;
}

/* Customer */
.customer-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border-radius: 0;
  border: 1px solid #e2e8f0;
}

.customer-title {
  color: #64748b;
  font-weight: 600;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
}

.customer-details {
  display: flex;
  gap: 1rem;
}

/* Table */
.slip-items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.25rem;
}

.slip-items-table th {
  background: #1e293b;
  color: white;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  font-weight: 600;
}

.slip-items-table td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.9rem;
}

.qty-cell {
  font-size: 1.2rem;
  color: #1e3a8a;
}

.text-right {
  text-align: right;
}

/* TTL */
.ttl-warning-box {
  background: #fffaf0;
  border: 1px solid #d97706;
  border-left: 5px solid #d97706;
  padding: 0.65rem 0.85rem;
  margin-bottom: 1.5rem;
  font-size: 0.8rem;
  color: #991b1b;
}

.ttl-title {
  font-weight: 700;
  margin-bottom: 0.15rem;
}

/* Signatures */
.signatures-grid {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  margin-top: 2rem;
}

.sig-box {
  flex: 1;
  border: 1px dashed #94a3b8;
  border-radius: 0;
  padding: 0.75rem;
  text-align: center;
}

.sig-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  color: #475569;
}

.sig-space {
  height: 55px;
}

.sig-hint {
  display: block;
  font-size: 0.7rem;
  color: #94a3b8;
  font-style: italic;
}

.slip-footer {
  margin-top: 1rem;
  padding-top: 0.65rem;
  border-top: 1px solid #cbd5e1;
  text-align: center;
  font-size: 0.65rem;
  line-height: 1.4;
  color: #64748b;
}

@media print {
  .no-print {
    display: none !important;
  }
  .pickup-slip {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
}
</style>
