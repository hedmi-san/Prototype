<script setup lang="ts">
import { computed } from 'vue';
import type { Facture } from '../../types';
import { generateBarcodeSvg, formatTradeBarcode } from '../../utils/barcode';
import { formatInvoiceAmount, formatInvoiceDate } from '../../utils/formatters';
import { amountToFrenchWords } from '../../utils/numberToWords';

interface Props {
  facture: Facture;
  companyName?: string;
  companySubtitle?: string;
  companyCapital?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyRc?: string;
  companyArt?: string;
  companyIf?: string;
  companyNis?: string;
}

const props = withDefaults(defineProps<Props>(), {
  companyName: 'EURL BOUSFOR Gen Trading VENTE EN GROS',
  companySubtitle: 'COMMERCE DE GROS DE QUINCAILLERIE ET FOURNITURES POUR PLOMBERIE ET CHAUFFAGE',
  companyCapital: '385 000 000.00',
  companyAddress: '',
  companyPhone: '',
  companyEmail: 'bousfor.hosna@yahoo.fr',
  companyRc: '19 B 0093646-19/01',
  companyArt: '19204502299',
  companyIf: '00191900936463819001',
  companyNis: '',
});

const companyAddress = computed(() => {
  return props.facture?.warehouseName || props.companyAddress || props.facture?.warehouseAddress || '';
});

const companyPhone = computed(() => {
  return props.facture?.warehousePhone || props.companyPhone || '';
});

const formattedDate = computed(() => {
  return formatInvoiceDate(props.facture?.factureDate);
});

const barcodeText = computed(() => {
  return formatTradeBarcode(
    props.facture?.factureDate || props.facture?.createdAt,
    props.facture?.factureNumber?.replace('/', ''),
    props.facture?.id
  );
});

const barcodeSvg = computed(() => {
  return generateBarcodeSvg(barcodeText.value, {
    height: 34,
    moduleWidth: 1.2,
    quietZone: 4,
    barColor: '#000000',
  });
});

const amountInWords = computed(() => {
  return amountToFrenchWords(props.facture?.totalTtc || 0);
});

const totalItems = computed(() => props.facture?.items?.length || 0);
</script>

<template>
  <div class="facture-a4-sheet">
    <!-- Company Header -->
    <header class="facture-header">
      <h1 class="company-name">{{ companyName }}</h1>
      <p class="company-subtitle">{{ companySubtitle }}</p>
      <p class="company-capital">AU CAPITAL DE: {{ companyCapital }}</p>
      <p v-if="companyAddress" class="company-address">{{ companyAddress }}</p>
      <p class="company-contact">
        <span v-if="companyPhone">Tel : {{ companyPhone }} </span>
        <span>  E-MAIL {{ companyEmail }}</span>
      </p>
    </header>

    <div class="header-divider" />

    <!-- Address + Facture Meta Grid -->
    <section class="facture-meta-section">
      <!-- Left: Adressé à -->
      <div class="meta-left-box">
        <div class="addressed-label">═══════ Adressé à : ═══════</div>
        <div class="client-name-box">{{ facture.clientName || 'CLIENT' }}</div>
        <div v-if="facture.clientAddress" class="client-detail-row">
          <span class="detail-label">Adresse :</span> {{ facture.clientAddress }}
        </div>
        <div v-if="facture.clientActivite" class="client-detail-row">
          <span class="detail-label">Activité:</span> {{ facture.clientActivite }}
        </div>
        <div v-if="facture.clientRc || facture.clientNif" class="client-detail-row rc-if-row">
          <span v-if="facture.clientRc"><span class="detail-label">RC:</span> {{ facture.clientRc }}</span>
          <span v-if="facture.clientNif" class="if-span"><span class="detail-label">IF:</span> {{ facture.clientNif }}</span>
        </div>
        <div v-if="facture.clientArt || facture.clientNis" class="client-detail-row rc-if-row">
          <span v-if="facture.clientArt"><span class="detail-label">ART:</span> {{ facture.clientArt }}</span>
          <span v-if="facture.clientNis" class="if-span"><span class="detail-label">NIS:</span> {{ facture.clientNis }}</span>
        </div>
      </div>

      <!-- Right: Facture info box -->
      <div class="meta-right-box">
        <div class="facture-title-label">Facture</div>
        <div class="facture-info-grid">
          <div class="facture-info-row">
            <span class="info-label">N°:</span>
            <span class="info-value font-bold">{{ facture.factureNumber }}</span>
          </div>
          <div class="facture-info-row">
            <span class="info-label">Date :</span>
            <span class="info-value font-bold">{{ formattedDate }}</span>
          </div>
          <div class="facture-info-row spacer-row" />
          <div class="facture-info-row">
            <span class="info-label">Réglement :</span>
            <span class="info-value font-bold">{{ facture.reglement || 'Espèce' }}</span>
          </div>
        </div>
        <div class="barcode-wrapper">
          <div class="barcode-render" v-html="barcodeSvg" />
          <div class="barcode-text font-mono">{{ barcodeText }}</div>
        </div>
      </div>
    </section>

    <div class="page-indicator">Page : 1/1</div>

    <!-- Items Table -->
    <table class="facture-table">
      <thead>
        <tr>
          <th class="col-code">Code</th>
          <th class="col-designation">Désignation</th>
          <th class="col-um">UM</th>
          <th class="col-tva">TVA%</th>
          <th class="col-qty">Qté</th>
          <th class="col-pu">PU</th>
          <th class="col-rm">RM%</th>
          <th class="col-total">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in facture.items" :key="item.id">
          <td class="col-code">{{ item.code }}</td>
          <td class="col-designation text-uppercase">{{ item.designation }}</td>
          <td class="col-um">{{ item.um }}</td>
          <td class="col-tva">{{ item.tvaRate }}</td>
          <td class="col-qty">{{ item.quantity }}</td>
          <td class="col-pu">{{ formatInvoiceAmount(item.unitPrice) }}</td>
          <td class="col-rm">{{ item.remisePct }}</td>
          <td class="col-total font-bold">{{ formatInvoiceAmount(item.total) }}</td>
        </tr>
        <!-- Empty rows to fill space for short invoices -->
        <tr v-for="i in Math.max(0, 8 - totalItems)" :key="'empty-' + i" class="empty-row">
          <td colspan="8">&nbsp;</td>
        </tr>
      </tbody>
    </table>

    <!-- Footer: Summary + Totals -->
    <footer class="facture-footer">
      <div class="footer-left-col">
        <div class="arrete-text">
          <strong>Arrêté la présente Facture à la somme de :</strong>
        </div>
        <div class="amount-words">{{ amountInWords }}</div>

        <div class="transport-section">
          <div class="transport-row">
            <span class="detail-label font-bold">MOYEN DE TRANSPORT :</span>
            <span v-if="facture.moyenTransport">{{ facture.moyenTransport }}</span>
          </div>
          <div class="transport-row">
            <span class="detail-label font-bold">CAMION N° :</span>
            <span v-if="facture.camionNumero">{{ facture.camionNumero }}</span>
          </div>
          <div class="transport-row">
            <span class="detail-label font-bold">CHAUFFEUR :</span>
            <span v-if="facture.chauffeur">{{ facture.chauffeur }}</span>
          </div>
        </div>
      </div>

      <div class="footer-right-col">
        <table class="totals-table">
          <tbody>
            <tr>
              <td class="total-label">Total HT</td>
              <td class="total-value font-bold">{{ formatInvoiceAmount(facture.totalHt) }}</td>
            </tr>
            <tr>
              <td class="total-label">Total TVA</td>
              <td class="total-value font-bold">{{ formatInvoiceAmount(facture.totalTva) }}</td>
            </tr>
            <tr>
              <td class="total-label">Timbre 1%</td>
              <td class="total-value font-bold">{{ formatInvoiceAmount(facture.timbre) }}</td>
            </tr>
            <tr>
              <td class="total-label">Total Remise</td>
              <td class="total-value font-bold">{{ formatInvoiceAmount(facture.totalRemise) }}</td>
            </tr>
            <tr class="total-ttc-row">
              <td class="total-label font-bold">Total TTC</td>
              <td class="total-value font-bold">{{ formatInvoiceAmount(facture.totalTtc) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </footer>

    <!-- Legal Footer -->
    <div class="legal-footer-divider" />
    <div class="legal-footer">
      RC : {{ companyRc }}&nbsp;&nbsp;Art : {{ companyArt }}&nbsp;&nbsp;IF: {{ companyIf }}&nbsp;&nbsp;NIS : {{ companyNis }}
    </div>
  </div>
</template>

<style scoped>
.facture-a4-sheet {
  box-sizing: border-box;
  width: 100%;
  max-width: 210mm;
  min-height: 280mm;
  margin: 0 auto;
  padding: 10mm 12mm;
  background-color: #ffffff;
  color: #000000;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

/* Header */
.facture-header {
  width: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  margin: 0 auto 6px auto !important;
  padding: 0 !important;
}

.facture-header * {
  box-sizing: border-box;
}

.facture-header p {
  width: 100% !important;
  max-width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
  text-align: center !important;
}

.company-name {
  width: 100% !important;
  max-width: 100% !important;
  text-align: center !important;
  margin: 0 0 2px 0 !important;
  font-size: 16px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #000000 !important;
  line-height: 1.25;
}

.company-subtitle {
  width: 100% !important;
  max-width: 100% !important;
  text-align: center !important;
  margin: 0 0 2px 0 !important;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #000000 !important;
  line-height: 1.35;
}

.company-capital {
  width: 100% !important;
  max-width: 100% !important;
  text-align: center !important;
  margin: 0 0 2px 0 !important;
  font-size: 11px;
  font-weight: 600;
  color: #000000 !important;
  line-height: 1.35;
}

.company-address {
  width: 100% !important;
  max-width: 100% !important;
  text-align: center !important;
  margin: 0 0 1px 0 !important;
  font-size: 11px;
  font-weight: 600;
  color: #000000 !important;
  line-height: 1.35;
}

.company-contact {
  width: 100% !important;
  max-width: 100% !important;
  text-align: center !important;
  margin: 0 !important;
  font-size: 11px;
  color: #000000 !important;
  line-height: 1.35;
}

.header-divider {
  width: 100%;
  height: 2px;
  background-color: #000;
  margin: 8px 0;
}

/* Meta Section */
.facture-meta-section {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 6px;
}

.meta-left-box {
  flex: 1.1;
  border: 1px solid #000;
  padding: 8px 10px;
}

.addressed-label {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 6px;
  text-align: center;
}

.client-name-box {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.client-detail-row {
  font-size: 11px;
  margin-bottom: 2px;
}

.rc-if-row {
  display: flex;
  gap: 20px;
}

.if-span {
  margin-left: auto;
}

.detail-label {
  font-weight: 600;
}

.meta-right-box {
  flex: 0.9;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.facture-title-label {
  font-size: 22px;
  font-weight: 800;
  font-style: italic;
  margin-bottom: 4px;
  letter-spacing: 1px;
}

.facture-info-grid {
  border: 1px solid #000;
  width: 100%;
  padding: 4px 8px;
  margin-bottom: 6px;
}

.facture-info-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 1px 0;
}

.spacer-row {
  height: 6px;
}

.info-label {
  font-weight: 600;
}

.info-value {
  text-align: right;
}

.barcode-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 2px;
}

.barcode-render {
  max-width: 100%;
  overflow: hidden;
}

.barcode-text {
  font-size: 10px;
  letter-spacing: 1.5px;
  margin-top: 2px;
  font-weight: 600;
}

.page-indicator {
  text-align: right;
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 4px;
}

/* Table */
.facture-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  margin-bottom: 8px;
}

.facture-table thead th {
  border: 1px solid #000;
  padding: 5px 4px;
  font-weight: 700;
  text-align: center;
  font-size: 11px;
  background: #f5f5f5;
}

.facture-table tbody td {
  border-left: 1px solid #000;
  border-right: 1px solid #000;
  padding: 4px 4px;
  vertical-align: middle;
}

.facture-table tbody tr:last-child td {
  border-bottom: 1px solid #000;
}

.empty-row td {
  height: 18px;
}

.col-code { width: 80px; text-align: left; padding-left: 6px; }
.col-designation { text-align: left; }
.col-um { width: 35px; text-align: center; }
.col-tva { width: 40px; text-align: center; }
.col-qty { width: 40px; text-align: center; }
.col-pu { width: 70px; text-align: right; padding-right: 6px; }
.col-rm { width: 35px; text-align: center; }
.col-total { width: 90px; text-align: right; padding-right: 6px; }

/* Footer */
.facture-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-top: 12px;
}

.footer-left-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.arrete-text {
  font-size: 12px;
}

.amount-words {
  font-size: 11px;
  font-style: italic;
  margin-bottom: 8px;
}

.transport-section {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
}

.transport-row {
  display: flex;
  gap: 6px;
}

.footer-right-col {
  flex: 0 0 auto;
}

.totals-table {
  border-collapse: collapse;
  font-size: 12px;
}

.totals-table td {
  border: 1px solid #000;
  padding: 3px 10px;
}

.total-label {
  text-align: right;
  font-weight: 600;
  white-space: nowrap;
}

.total-value {
  text-align: right;
  white-space: nowrap;
  min-width: 90px;
}

.total-ttc-row td {
  background: #f0f0f0;
}

.legal-footer-divider {
  width: 100%;
  height: 2px;
  background-color: #000;
  margin: 16px 0 6px 0;
}

.legal-footer {
  font-size: 10px;
  font-weight: 600;
  text-align: center;
}

.font-bold { font-weight: 700; }
.font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.text-uppercase { text-transform: uppercase; }

/* Print */
@media print {
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .facture-a4-sheet {
    max-width: 100% !important;
    width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
  }

  .facture-table {
    page-break-inside: auto;
  }

  .facture-table tr {
    page-break-inside: avoid;
  }

  .facture-footer {
    page-break-inside: avoid;
  }
}
</style>
