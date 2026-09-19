<script setup lang="ts">
import { computed } from 'vue';
import type { CounterCreditNote, CreditNoteReceiptPayload } from '../../types';
import { formatCurrency, formatDateTime, formatDate, amountInFrenchWords } from '../../utils/formatters';
import AppModal from '../common/AppModal.vue';
import AppButton from '../common/AppButton.vue';

interface Props {
  modelValue: boolean;
  creditNote: CounterCreditNote | CreditNoteReceiptPayload | null;
  companyName?: string;
  companySubtitle?: string;
}

const props = withDefaults(defineProps<Props>(), {
  companyName: 'EURL BOUSFOR GEN TRADING IMP.EXP',
  companySubtitle: 'OUTILLAGES & QUINCAILLERIE INDUSTRIELLE',
});

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
}>();

const formattedIssueDate = computed(() => {
  if (!props.creditNote?.issueDate) return formatDateTime(new Date(), false);
  return formatDateTime(props.creditNote.issueDate, false);
});

const formattedExpiryDate = computed(() => {
  if (!props.creditNote?.expiryDate) return '';
  return formatDate(props.creditNote.expiryDate);
});

const printTimestamp = computed(() => formatDateTime(new Date(), true));

const amountWords = computed(() => {
  if (!props.creditNote?.totalAmount) return '';
  return amountInFrenchWords(props.creditNote.totalAmount);
});

function handlePrint() {
  window.print();
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    title="Reçu d'Avoir Comptoir"
    max-width="850px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="credit-note-doc-wrapper">
      <!-- Toolbar (Screen only) -->
      <div class="doc-toolbar no-print">
        <div class="toolbar-info">
          <span class="toolbar-tag">Titre de Créance Comptoir</span>
          <span class="font-mono text-muted">{{ creditNote?.creditNoteNumber }}</span>
        </div>
        <div class="toolbar-actions">
          <AppButton variant="secondary" size="sm" @click="emit('update:modelValue', false)">
            Fermer
          </AppButton>
          <AppButton variant="primary" size="sm" @click="handlePrint">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Imprimer Reçu d'Avoir
          </AppButton>
        </div>
      </div>

      <!-- Printable A4 Document Sheet -->
      <div v-if="creditNote" class="a4-sheet printable-doc-target" id="printable-credit-note-receipt">
        <!-- Header -->
        <header class="doc-header">
          <div class="company-block">
            <h1 class="company-name">{{ companyName }}</h1>
            <p class="company-subtitle">{{ companySubtitle }}</p>
            <div class="warehouse-details">
              <span><strong>Dépôt / Caisse :</strong> {{ creditNote.warehouseName || creditNote.warehouseCode || 'Comptoir Principal' }}</span>
              <span v-if="creditNote.warehouseLocation"> — {{ creditNote.warehouseLocation }}</span>
              <span v-if="creditNote.warehousePhone"> | Tél : {{ creditNote.warehousePhone }}</span>
            </div>
          </div>
          <div class="voucher-meta-block">
            <div class="voucher-badge credit-note-badge">
              <span class="voucher-label">REÇU D'AVOIR COMPTOIR</span>
              <span class="voucher-num font-mono">{{ creditNote.creditNoteNumber }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Date d'émission :</span>
              <span class="meta-val font-bold font-mono">{{ formattedIssueDate }}</span>
            </div>
            <div class="meta-row highlight-expiry">
              <span class="meta-label">Date limite de validité :</span>
              <span class="meta-val font-bold font-mono text-danger">{{ formattedExpiryDate }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Émis par :</span>
              <span class="meta-val">{{ creditNote.createdByName || 'Caisse Comptoir' }}</span>
            </div>
          </div>
        </header>

        <div class="header-line" />

        <!-- Title Ribbon -->
        <div class="doc-title-box">
          <h2 class="doc-title">TITRE D'AVOIR & JUSTIFICATIF DE RESTITUTION</h2>
          <span class="doc-subtitle">Émis suite à annulation de commande comptoir - Valable 90 jours pour remboursement ou achat</span>
        </div>

        <!-- Details Grid -->
        <div class="details-grid">
          <!-- Client Card -->
          <div class="detail-box client-box">
            <div class="box-title">Bénéficiaire / Client</div>
            <div class="box-content">
              <div class="info-line">
                <span class="info-label">Code Client :</span>
                <span class="info-value font-mono font-bold">{{ creditNote.clientCode || 'CLT-COMPTOIR' }}</span>
              </div>
              <div class="info-line">
                <span class="info-label">Client :</span>
                <span class="info-value font-bold text-uppercase">{{ creditNote.clientName || 'Client Passager / Comptoir' }}</span>
              </div>
              <div v-if="creditNote.clientPhone && creditNote.clientPhone !== 'N/A'" class="info-line">
                <span class="info-label">Téléphone :</span>
                <span class="info-value font-mono">{{ creditNote.clientPhone }}</span>
              </div>
            </div>
          </div>

          <!-- Operation Card -->
          <div class="detail-box op-box">
            <div class="box-title">Détails de l'Opération</div>
            <div class="box-content">
              <div class="info-line">
                <span class="info-label">Facture Vente d'Origine :</span>
                <span class="info-value font-bold font-mono text-primary">{{ creditNote.saleInvoiceNumber }}</span>
              </div>
              <div v-if="creditNote.saleDate" class="info-line">
                <span class="info-label">Date de la Vente :</span>
                <span class="info-value">{{ formatDate(creditNote.saleDate) }}</span>
              </div>
              <div class="info-line">
                <span class="info-label">Motif :</span>
                <span class="info-value">{{ creditNote.notes || "Annulation et restitution d'articles au comptoir" }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Financial Amount Section -->
        <div class="amount-card">
          <div class="amount-main-row">
            <div class="amount-caption">
              <span class="amount-label">MONTANT DE L'AVOIR (CRÉDIT DISPONIBLE)</span>
              <span class="amount-sublabel">Somme remboursable en espèces sur présentation de ce reçu</span>
            </div>
            <div class="amount-figure font-mono">
              {{ formatCurrency(creditNote.totalAmount) }}
            </div>
          </div>
          <div class="amount-in-words-box">
            <span class="words-label">Arrêté le présent avoir à la somme de :</span>
            <span class="words-content">« {{ amountWords }} »</span>
          </div>
        </div>

        <!-- Prominent 90-day Notice Box -->
        <div class="expiry-notice-box">
          <div class="notice-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div class="notice-text">
            <strong>MENTION LÉGALE IMPORTANTE - DÉLAI DE VALIDITÉ :</strong>
            <p>
              Cet avoir est valable <strong>90 jours</strong> à compter de sa date d'émission (date limite : <strong>{{ formattedExpiryDate }}</strong>).
              Il donne droit au remboursement en espèces au guichet de la caisse émettrice ou en déduction d'achats ultérieurs,
              <strong>sur présentation obligatoire de cet imprimé original</strong>.
              Conformément à la politique commerciale et aux règles de clôture de caisse, passé ce délai de 90 jours sans réclamation,
              le titre expire et ne pourra plus être décaissé sans dérogation administrative expresse.
            </p>
          </div>
        </div>

        <!-- Signatures Section -->
        <div class="signatures-wrapper">
          <div class="sig-column">
            <div class="sig-title">Cachet et Visa de la Caisse</div>
            <div class="sig-space">
              <span class="sig-hint">Nom de l'agent : {{ creditNote.createdByName || 'Caisse' }}</span>
            </div>
            <div class="sig-line">Date et Signature</div>
          </div>
          <div class="sig-column">
            <div class="sig-title">Reçu et Accepté par le Client</div>
            <div class="sig-space">
              <span class="sig-hint">Signature du client / bénéficiaire</span>
            </div>
            <div class="sig-line">Date et Signature</div>
          </div>
        </div>

        <!-- Document Footer -->
        <footer class="doc-footer">
          <div class="footer-meta">
            <span>Édité le : {{ printTimestamp }}</span>
            <span>Réf Unique : {{ creditNote.creditNoteNumber }}</span>
            <span>Système ERP BOUSFOR HOSNA</span>
          </div>
        </footer>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.credit-note-doc-wrapper {
  display: flex;
  flex-direction: column;
}

.doc-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--color-bg-subtle, #f8fafc);
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px 6px 0 0;
  margin-bottom: 16px;
}

.toolbar-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-tag {
  display: inline-block;
  padding: 3px 8px;
  background-color: #fef3c7;
  color: #92400e;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.a4-sheet {
  background: white;
  color: #0f172a;
  padding: 32px 36px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-family: inherit;
  line-height: 1.4;
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.company-name {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 4px 0;
  letter-spacing: -0.02em;
}

.company-subtitle {
  font-size: 0.8rem;
  font-weight: 600;
  color: #64748b;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.warehouse-details {
  font-size: 0.75rem;
  color: #475569;
}

.voucher-meta-block {
  text-align: right;
  min-width: 260px;
}

.credit-note-badge {
  background-color: #eff6ff;
  border: 2px solid #3b82f6;
  border-radius: 6px;
  padding: 8px 12px;
  text-align: center;
  margin-bottom: 8px;
}

.voucher-label {
  display: block;
  font-size: 0.65rem;
  font-weight: 800;
  color: #1e40af;
  letter-spacing: 0.08em;
}

.voucher-num {
  font-size: 1.1rem;
  font-weight: 800;
  color: #1e3a8a;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  margin-top: 4px;
}

.meta-row.highlight-expiry {
  background-color: #fef2f2;
  padding: 2px 6px;
  border-radius: 4px;
  border-left: 3px solid #dc2626;
}

.header-line {
  height: 2px;
  background: #0f172a;
  margin-bottom: 16px;
}

.doc-title-box {
  text-align: center;
  background: #f1f5f9;
  padding: 10px 16px;
  border-radius: 6px;
  margin-bottom: 20px;
  border: 1px solid #e2e8f0;
}

.doc-title {
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #0f172a;
  margin: 0 0 2px 0;
}

.doc-subtitle {
  font-size: 0.75rem;
  color: #64748b;
  font-style: italic;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.detail-box {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  overflow: hidden;
}

.box-title {
  background: #f8fafc;
  padding: 6px 12px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #334155;
  border-bottom: 1px solid #cbd5e1;
  text-transform: uppercase;
}

.box-content {
  padding: 10px 12px;
  font-size: 0.8rem;
}

.info-line {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.info-line:last-child {
  margin-bottom: 0;
}

.info-label {
  color: #64748b;
  font-weight: 500;
}

.info-value {
  color: #0f172a;
}

.amount-card {
  border: 2px solid #0f172a;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
  background-color: #fafaf9;
}

.amount-main-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px dashed #cbd5e1;
  padding-bottom: 12px;
  margin-bottom: 10px;
}

.amount-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #0f172a;
}

.amount-sublabel {
  display: block;
  font-size: 0.75rem;
  color: #64748b;
}

.amount-figure {
  font-size: 1.6rem;
  font-weight: 800;
  color: #047857;
}

.amount-in-words-box {
  font-size: 0.8rem;
  color: #334155;
}

.words-label {
  font-weight: 600;
  margin-right: 6px;
}

.words-content {
  font-weight: 700;
  font-style: italic;
  color: #0f172a;
}

.expiry-notice-box {
  display: flex;
  gap: 12px;
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 4px solid #d97706;
  border-radius: 6px;
  padding: 12px 14px;
  margin-bottom: 24px;
}

.notice-icon {
  color: #d97706;
  flex-shrink: 0;
  margin-top: 2px;
}

.notice-text {
  font-size: 0.75rem;
  color: #78350f;
  line-height: 1.4;
}

.notice-text strong {
  display: block;
  margin-bottom: 4px;
  font-weight: 800;
}

.notice-text p {
  margin: 0;
}

.signatures-wrapper {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 36px;
  margin-bottom: 24px;
  margin-top: 20px;
}

.sig-column {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 10px 14px;
  text-align: center;
}

.sig-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #334155;
  margin-bottom: 8px;
}

.sig-space {
  height: 60px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sig-hint {
  font-size: 0.7rem;
  color: #94a3b8;
  font-style: italic;
}

.sig-line {
  border-top: 1px dashed #cbd5e1;
  margin-top: 8px;
  padding-top: 4px;
  font-size: 0.7rem;
  color: #64748b;
}

.doc-footer {
  border-top: 1px solid #e2e8f0;
  padding-top: 8px;
  font-size: 0.65rem;
  color: #94a3b8;
}

.footer-meta {
  display: flex;
  justify-content: space-between;
}

@media print {
  body * {
    visibility: hidden;
  }
  #printable-credit-note-receipt,
  #printable-credit-note-receipt * {
    visibility: visible;
  }
  #printable-credit-note-receipt {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 20mm;
    box-shadow: none;
    border: none;
  }
  .no-print {
    display: none !important;
  }
}
</style>
