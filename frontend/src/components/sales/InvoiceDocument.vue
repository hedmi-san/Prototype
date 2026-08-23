<script setup lang="ts">
import { computed, onMounted } from 'vue';
import type { Sale } from '../../types';
import { useWarehouseStore } from '../../stores/warehouse.store';
import { generateBarcodeSvg, formatTradeBarcode } from '../../utils/barcode';
import {
  formatInvoiceAmount,
  formatInvoiceDate,
  formatInvoicePrintTimestamp,
  extractInvoiceSequence,
} from '../../utils/formatters';

interface Props {
  sale: Sale;
  companyName?: string;
  warehouseNameOverride?: string;
  phoneNumbers?: string;
  documentType?: string;
  solde?: string;
  cartonCount?: number;
  printDate?: Date | string;
}

const props = withDefaults(defineProps<Props>(), {
  companyName: 'EURL BOUSFOR GEN TRADING IMP.EXP',
  warehouseNameOverride: '',
  phoneNumbers: '',
  documentType: 'Vente',
  solde: '0.00',
  cartonCount: undefined,
  printDate: () => new Date(),
});

const warehouseStore = useWarehouseStore();

onMounted(async () => {
  if (warehouseStore.warehouses.length === 0) {
    try {
      await warehouseStore.fetchWarehouses();
    } catch (e) {
      console.error('Failed to load warehouses in InvoiceDocument', e);
    }
  }
});

const warehouseDisplay = computed(() => {
  if (props.warehouseNameOverride && props.warehouseNameOverride.trim().length > 0) {
    const name = props.warehouseNameOverride.toUpperCase();
    return name.includes('SHOWROOM') ? name : `SHOWROOM ${name}`;
  }
  if (props.sale?.warehouseName && props.sale.warehouseName.trim().length > 0) {
    const name = props.sale.warehouseName.toUpperCase();
    return name.includes('SHOWROOM') ? name : `SHOWROOM ${name}`;
  }
  const wh = warehouseStore.warehouses.find((w) => w.id === props.sale?.warehouseId);
  if (wh?.name && wh.name.trim().length > 0) {
    const name = wh.name.toUpperCase();
    return name.includes('SHOWROOM') ? name : `SHOWROOM ${name}`;
  }
  return 'SHOWROOM BOUSFOR';
});

const displayedPhoneNumbers = computed(() => {
  if (props.phoneNumbers && props.phoneNumbers.trim().length > 0) {
    return props.phoneNumbers.trim();
  }
  if (props.sale?.warehousePhone && props.sale.warehousePhone.trim().length > 0) {
    return props.sale.warehousePhone.trim();
  }
  const wh = warehouseStore.warehouses.find((w) => w.id === props.sale?.warehouseId);
  if (wh?.phone && wh.phone.trim().length > 0) {
    return wh.phone.trim();
  }
  if (wh?.contactNumber && wh.contactNumber.trim().length > 0) {
    return wh.contactNumber.trim();
  }
  if ((wh as any)?.contact_number && (wh as any).contact_number.trim().length > 0) {
    return (wh as any).contact_number.trim();
  }
  return '-';
});

const sequenceNumber = computed(() => {
  return extractInvoiceSequence(props.sale?.invoiceNumber, props.sale?.id);
});

const barcodeText = computed(() => {
  return formatTradeBarcode(
    props.sale?.saleDate || props.sale?.createdAt,
    props.sale?.invoiceNumber,
    props.sale?.id
  );
});

const barcodeSvg = computed(() => {
  return generateBarcodeSvg(barcodeText.value, {
    height: 38,
    moduleWidth: 1.35,
    quietZone: 5,
    barColor: '#000000',
  });
});

const formattedSaleDate = computed(() => {
  return formatInvoiceDate(props.sale?.saleDate || props.sale?.createdAt);
});

const printTimestamp = computed(() => {
  return formatInvoicePrintTimestamp(props.printDate);
});

const computedCartonCount = computed(() => {
  if (props.cartonCount !== undefined) return props.cartonCount;
  // Default to sum of quantities or distinct product line count
  const distinctLines = props.sale?.items?.length || 0;
  return distinctLines > 0 ? distinctLines : 1;
});
</script>

<template>
  <div class="a4-invoice-sheet printable-invoice-target">
    <!-- Header: Company & Warehouse Info -->
    <header class="invoice-header">
      <h1 class="company-title">{{ companyName }}</h1>
      <h2 class="showroom-title">{{ warehouseDisplay }}</h2>
      <p class="phone-numbers">{{ displayedPhoneNumbers }}</p>
    </header>

    <div class="divider-line" />

    <!-- Metadata Section: Document Info, Barcode, Dates -->
    <section class="invoice-meta-grid">
      <!-- Left Column: Document Type, Bon N°, Customer -->
      <div class="meta-col meta-left">
        <div class="doc-type-label"><u>{{ documentType }}</u></div>
        <div class="bon-number-row">
          <span class="label">Bon de Caisse N°</span>
          <span class="value font-bold">{{ sequenceNumber }}</span>
        </div>
        <div class="client-row">
          <span class="label">Client :</span>
          <span class="value font-bold">{{ sale.customerName || 'DIVERS' }}</span>
        </div>
      </div>

      <!-- Center Column: Scannable 1D Barcode -->
      <div class="meta-col meta-center">
        <div class="barcode-container" v-html="barcodeSvg" />
        <div class="barcode-number font-mono">{{ barcodeText }}</div>
      </div>

      <!-- Right Column: Dates, Page Number, Item Count -->
      <div class="meta-col meta-right">
        <div class="date-bon-row">
          <span class="label font-bold">Date du Bon</span>
          <span class="value font-bold">{{ formattedSaleDate }}</span>
        </div>
        <div class="print-timestamp-row">
          <span class="label">Imprimer le :</span>
          <span class="value">{{ printTimestamp }}</span>
        </div>
        <div class="page-number-row">
          <span class="label">Page N°:</span>
          <span class="value">1/1</span>
        </div>
        <div class="product-count-row">
          <span class="label font-bold">Nombre de Produits :</span>
          <span class="value font-bold">{{ sale.items?.length || 0 }}</span>
        </div>
      </div>
    </section>

    <div class="divider-line table-divider" />

    <!-- Line Items Table -->
    <table class="invoice-table">
      <thead>
        <tr>
          <th class="col-check" />
          <th class="col-code">Code Art.</th>
          <th class="col-name">Désignation</th>
          <th class="col-qty">Quantité</th>
          <th class="col-price">Prix</th>
          <th class="col-total">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in sale.items" :key="item.id">
          <td class="col-check">
            <div class="picker-checkbox" />
          </td>
          <td class="col-code font-bold">{{ item.productReference || '—' }}</td>
          <td class="col-name text-uppercase">
            {{ item.productName }}
          </td>
          <td class="col-qty font-bold">{{ item.quantity }}</td>
          <td class="col-price">{{ formatInvoiceAmount(item.unitPrice) }}</td>
          <td class="col-total font-bold">{{ formatInvoiceAmount(item.subtotal || item.quantity * item.unitPrice) }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Summary & Footer Details -->
    <footer class="invoice-footer-summary">
      <!-- Left Column: Balance, Serving Staff, Cartons -->
      <div class="footer-left">
        <div class="solde-row">
          <span class="label font-bold">Solde :</span>
          <span class="value font-bold">{{ solde }}</span>
        </div>

        <div class="staff-and-cartons">
          <div v-if="sale.createdByName && sale.employeeName && sale.createdByName !== sale.employeeName" class="staff-row">
            <span class="label font-bold">Émis Par :</span>
            <span class="value font-bold text-uppercase">{{ sale.createdByName }}</span>
          </div>
          <div class="staff-row">
            <span class="label font-bold">Servi Par :</span>
            <span class="value font-bold text-uppercase">{{ sale.employeeName || sale.createdByName || sale.userName || 'SALIM' }}</span>
          </div>
        </div>
      </div>

      <!-- Right Column: Total Amount -->
      <div class="footer-right">
        <div class="total-payable-box">
          <span class="total-label font-bold">Total :</span>
          <span class="total-val font-bold">{{ formatInvoiceAmount(sale.totalAmount) }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Screen & Base Sheet Styles */
.a4-invoice-sheet {
  box-sizing: border-box;
  width: 100%;
  max-width: 210mm;
  min-height: 140mm;
  margin: 0 auto;
  padding: 12mm 14mm;
  background-color: #ffffff;
  color: #000000;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.35;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

/* Header Section */
.invoice-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 100%;
  margin-bottom: 8px;
}

.company-title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin: 0 0 3px 0;
  color: #000000;
  text-transform: uppercase;
  text-align: center;
  width: 100%;
}

.showroom-title {
  font-size: 13px;
  font-weight: 700;
  margin: 0 0 3px 0;
  color: #000000;
  letter-spacing: 0.5px;
  text-align: center;
  width: 100%;
}

.phone-numbers {
  font-size: 12px;
  font-weight: 600;
  margin: 0 auto;
  color: #000000;
  letter-spacing: 0.5px;
  text-align: center;
  width: 100%;
  max-width: 100%;
}

.divider-line {
  width: 100%;
  height: 1px;
  background-color: #000000;
  margin: 6px 0 10px 0;
}

.table-divider {
  margin: 10px 0 6px 0;
}

/* Metadata Grid */
.invoice-meta-grid {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.meta-col {
  display: flex;
  flex-direction: column;
}

.meta-left {
  flex: 1.2;
}

.doc-type-label {
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 8px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.bon-number-row,
.client-row {
  margin-bottom: 4px;
  font-size: 13px;
}

.bon-number-row .label,
.client-row .label {
  margin-right: 6px;
}

.meta-center {
  flex: 1.1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.barcode-container {
  display: flex;
  justify-content: center;
  max-width: 100%;
  overflow: hidden;
}

.barcode-number {
  font-size: 12px;
  letter-spacing: 2px;
  font-weight: 600;
  margin-top: 3px;
  text-align: center;
}

.meta-right {
  flex: 1.4;
  text-align: right;
  font-size: 12px;
  gap: 2px;
}

.date-bon-row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 2px;
  font-size: 13px;
}

.print-timestamp-row,
.page-number-row {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  font-size: 12px;
}

.product-count-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
  font-size: 13px;
}

/* Table Styles */
.invoice-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 4px;
  font-size: 12.5px;
}

.invoice-table thead th {
  padding: 6px 4px;
  font-size: 12.5px;
  font-weight: 700;
  color: #000000;
  border-bottom: 1px solid #000000;
}

.invoice-table tbody td {
  padding: 5px 4px;
  color: #000000;
  vertical-align: middle;
}

.col-check {
  width: 26px;
  text-align: center;
}

.picker-checkbox {
  width: 13px;
  height: 13px;
  border: 1.2px solid #000000;
  margin: 0 auto;
  background-color: transparent;
}

.col-code {
  width: 90px;
  text-align: left;
  padding-left: 6px;
}

.col-name {
  text-align: left;
  text-transform: uppercase;
}

.col-qty {
  width: 75px;
  text-align: right;
  padding-right: 12px;
}

.col-price {
  width: 95px;
  text-align: right;
  padding-right: 12px;
}

.col-total {
  width: 105px;
  text-align: right;
}

/* Footer Summary */
.invoice-footer-summary {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-top: 14px;
  font-size: 13px;
}

.footer-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.solde-row {
  margin-bottom: 4px;
}

.staff-and-cartons {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.footer-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-start;
}

.total-payable-box {
  display: flex;
  align-items: baseline;
  gap: 16px;
  font-size: 14px;
}

.total-label {
  font-size: 14px;
  font-weight: 700;
}

.total-val {
  font-size: 14.5px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.font-bold {
  font-weight: 700;
}

.text-uppercase {
  text-transform: uppercase;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* ==========================================================
   PRINT ISOLATION & A4 GEOMETRY RULES
   ========================================================== */
@media print {
  @page {
    size: A4 portrait;
    margin: 8mm 10mm;
  }

  body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .a4-invoice-sheet {
    max-width: 100% !important;
    width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    background: #ffffff !important;
    color: #000000 !important;
  }

  .invoice-table {
    page-break-inside: auto;
  }

  .invoice-table tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }

  .invoice-footer-summary {
    page-break-inside: avoid;
  }
}
</style>
