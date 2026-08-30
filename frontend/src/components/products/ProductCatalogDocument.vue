<script setup lang="ts">
import { computed } from 'vue';
import type { Product } from '../../types';
import { formatDateTime } from '../../utils/formatters';

interface Props {
  products: Product[];
  companyName?: string;
  subtitle?: string;
  documentTitle?: string;
  printDate?: Date | string;
}

const props = withDefaults(defineProps<Props>(), {
  companyName: 'EURL BOUSFOR GEN TRADING IMP.EXP',
  subtitle: 'OUTILLAGES & QUINCAILLERIE INDUSTRIELLE',
  documentTitle: 'CATALOGUE RÉFÉRENCES PRODUITS',
  printDate: () => new Date(),
});

const formattedPrintDate = computed(() => {
  return formatDateTime(props.printDate, false);
});
</script>

<template>
  <div class="a4-document-sheet printable-doc-target">
    <!-- Header -->
    <header class="doc-header">
      <div class="header-main">
        <h1 class="company-title">{{ companyName }}</h1>
        <h2 class="company-subtitle">{{ subtitle }}</h2>
      </div>
      <div class="header-meta">
        <div class="meta-row">
          <span class="meta-label">Date :</span>
          <span class="meta-val font-bold">{{ formattedPrintDate }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Total Références :</span>
          <span class="meta-val font-bold font-mono">{{ products.length }}</span>
        </div>
      </div>
    </header>

    <div class="doc-divider" />

    <!-- Document Title Badge -->
    <div class="doc-title-bar">
      <h2 class="doc-title">{{ documentTitle }}</h2>
    </div>

    <!-- Minimalist Reference Table -->
    <table class="doc-table">
      <thead>
        <tr>
          <th class="col-num">N°</th>
          <th class="col-ref">Référence</th>
          <th class="col-name">Désignation Produit</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(p, index) in products" :key="p.id">
          <td class="col-num text-center text-muted font-mono">{{ index + 1 }}</td>
          <td class="col-ref font-bold font-mono">{{ p.reference }}</td>
          <td class="col-name font-semibold text-uppercase">{{ p.name }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Footer Summary -->
    <footer class="doc-footer">
      <div class="footer-left">
        <span class="text-caption text-muted">Référentiel produits édité le {{ formattedPrintDate }}</span>
      </div>
      <div class="footer-right">
        <div class="summary-pill">
          <span class="summary-label">Nombre de références :</span>
          <span class="summary-val font-bold font-mono">{{ products.length }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.a4-document-sheet {
  box-sizing: border-box;
  width: 100%;
  max-width: 210mm;
  min-height: 140mm;
  margin: 0 auto;
  padding: 12mm 14mm;
  background-color: #ffffff;
  color: #000000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 12.5px;
  line-height: 1.4;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.company-title {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin: 0 0 2px 0;
  text-transform: uppercase;
  color: #000000;
}

.company-subtitle {
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
  margin: 0;
  letter-spacing: 0.3px;
}

.header-meta {
  text-align: right;
  font-size: 12px;
}

.meta-row {
  margin-bottom: 2px;
}

.meta-label {
  color: #6b7280;
  margin-right: 4px;
}

.doc-divider {
  width: 100%;
  height: 1.5px;
  background-color: #111827;
  margin: 8px 0 12px 0;
}

.doc-title-bar {
  text-align: center;
  margin-bottom: 12px;
}

.doc-title {
  display: inline-block;
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 3px 12px;
  border: 1.5px solid #111827;
  border-radius: 4px;
  background-color: #f9fafb;
}

/* Table */
.doc-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 4px;
  font-size: 12px;
}

.doc-table thead th {
  padding: 7px 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background-color: #f3f4f6;
  color: #111827;
  border: 1px solid #d1d5db;
  border-bottom: 2px solid #111827;
}

.doc-table tbody td {
  padding: 6px 8px;
  color: #111827;
  border: 1px solid #e5e7eb;
  vertical-align: middle;
}

.doc-table tbody tr:nth-child(even) {
  background-color: #f9fafb;
}

.col-num {
  width: 40px;
}

.col-ref {
  width: 160px;
}

.col-name {
  text-align: left;
}

/* Footer */
.doc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
}

.summary-pill {
  display: flex;
  gap: 6px;
  font-size: 13px;
}

.text-center { text-align: center; }
.text-muted { color: #6b7280; }
.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }
.text-uppercase { text-transform: uppercase; }
.font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

/* Print Mode */
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

  .a4-document-sheet {
    max-width: 100% !important;
    width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    background: #ffffff !important;
    color: #000000 !important;
  }

  .doc-table {
    page-break-inside: auto;
  }

  .doc-table tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }

  .doc-footer {
    page-break-inside: avoid;
  }
}
</style>
