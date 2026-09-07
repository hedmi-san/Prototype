<script setup lang="ts">
import { computed } from 'vue';
import type { ClientRefund } from '../../types';
import { formatCurrency, formatDateTime, amountInFrenchWords } from '../../utils/formatters';
import AppModal from '../common/AppModal.vue';
import AppButton from '../common/AppButton.vue';

interface Props {
  modelValue: boolean;
  refund: ClientRefund | null;
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

const formattedDate = computed(() => {
  if (!props.refund?.createdAt) return formatDateTime(new Date(), false);
  return formatDateTime(props.refund.createdAt, false);
});

const printTimestamp = computed(() => formatDateTime(new Date(), true));

const amountWords = computed(() => {
  if (!props.refund?.amount) return '';
  return amountInFrenchWords(props.refund.amount);
});

function handlePrint() {
  window.print();
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    title="Bon de Décharge - Remboursement d'Avance"
    max-width="850px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="refund-doc-wrapper">
      <!-- Toolbar (Screen only) -->
      <div class="doc-toolbar no-print">
        <div class="toolbar-info">
          <span class="toolbar-tag">Document Officiel de Caisse</span>
          <span class="font-mono text-muted">{{ refund?.refundNumber }}</span>
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
            Imprimer Bon de Décharge
          </AppButton>
        </div>
      </div>

      <!-- Printable A4 Document Sheet -->
      <div v-if="refund" class="a4-sheet printable-doc-target" id="printable-refund-voucher">
        <!-- Header -->
        <header class="doc-header">
          <div class="company-block">
            <h1 class="company-name">{{ companyName }}</h1>
            <p class="company-subtitle">{{ companySubtitle }}</p>
            <div class="warehouse-details">
              <span><strong>Dépôt / Caisse :</strong> {{ refund.warehouseName || refund.warehouseCode || 'Principal' }}</span>
              <span v-if="refund.warehouseLocation"> — {{ refund.warehouseLocation }}</span>
              <span v-if="refund.warehousePhone"> | Tél : {{ refund.warehousePhone }}</span>
            </div>
          </div>
          <div class="voucher-meta-block">
            <div class="voucher-badge">
              <span class="voucher-label">N° DE DÉCHARGE</span>
              <span class="voucher-num font-mono">{{ refund.refundNumber }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Date opération :</span>
              <span class="meta-val font-bold font-mono">{{ formattedDate }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Émis par :</span>
              <span class="meta-val">{{ refund.createdByName || 'Caisse' }}</span>
            </div>
          </div>
        </header>

        <div class="header-line" />

        <!-- Title Ribbon -->
        <div class="doc-title-box">
          <h2 class="doc-title">BON DE DÉCHARGE & REÇU DE DÉCAISSEMENT ESPÈCES</h2>
          <span class="doc-subtitle">Restitution d'avoir / remboursement d'avance sur compte client</span>
        </div>

        <!-- Client & Operation Details Grid -->
        <div class="details-grid">
          <!-- Client Card -->
          <div class="detail-box client-box">
            <div class="box-title">Bénéficiaire / Client</div>
            <div class="box-content">
              <div class="info-line">
                <span class="info-label">Code Client :</span>
                <span class="info-value font-mono font-bold">{{ refund.clientCode }}</span>
              </div>
              <div class="info-line">
                <span class="info-label">Nom / Raison Sociale :</span>
                <span class="info-value font-bold text-uppercase">{{ refund.clientName }}</span>
              </div>
              <div v-if="refund.clientPhone" class="info-line">
                <span class="info-label">Téléphone :</span>
                <span class="info-value">{{ refund.clientPhone }}</span>
              </div>
              <div v-if="refund.clientAddress" class="info-line">
                <span class="info-label">Adresse :</span>
                <span class="info-value">{{ refund.clientAddress }}</span>
              </div>
            </div>
          </div>

          <!-- Modalities Card -->
          <div class="detail-box mode-box">
            <div class="box-title">Modalités de l'Opération</div>
            <div class="box-content">
              <div class="info-line">
                <span class="info-label">Mode de Remise :</span>
                <span class="info-value font-bold">ESPÈCES (Caisse Comptoir)</span>
              </div>
              <div class="info-line">
                <span class="info-label">Nature Écriture :</span>
                <span class="info-value">Débit Compte Client (Diminution de l'avance)</span>
              </div>
              <div v-if="refund.notes" class="info-line">
                <span class="info-label">Motif / Justification :</span>
                <span class="info-value italic">{{ refund.notes }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Financial Summary Table -->
        <div class="financial-table-box">
          <table class="financial-table">
            <thead>
              <tr>
                <th>Désignation de l'Opération</th>
                <th class="text-right">Avance Avant</th>
                <th class="text-right">Montant Remboursé</th>
                <th class="text-right">Avance Restante</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Décaissement espèces sur avance client</strong>
                  <p class="table-subtext">Règlement en mains propres au client contre émargement</p>
                </td>
                <td class="text-right font-mono font-semibold text-muted">
                  {{ refund.availableAdvanceBefore !== null && refund.availableAdvanceBefore !== undefined ? formatCurrency(refund.availableAdvanceBefore) : '—' }}
                </td>
                <td class="text-right font-mono font-bold text-highlight">
                  {{ formatCurrency(refund.amount) }}
                </td>
                <td class="text-right font-mono font-bold text-success">
                  {{ refund.availableAdvanceAfter !== null && refund.availableAdvanceAfter !== undefined ? formatCurrency(refund.availableAdvanceAfter) : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Amount in Words Banner -->
        <div class="words-banner">
          <div class="words-label">Arrêté le présent bon de décharge à la somme en espèces de :</div>
          <div class="words-text font-bold text-uppercase">
            {{ amountWords }}
          </div>
        </div>

        <!-- Signatures Zone -->
        <div class="signatures-section">
          <div class="sig-card cashier-sig">
            <div class="sig-header">
              <span class="sig-title">Le Caissier / Mandataire</span>
              <span class="sig-sub font-mono">{{ refund.createdByName || 'Responsable Caisse' }}</span>
            </div>
            <div class="sig-body">
              <div class="sig-stamp-placeholder">
                Cachet & Signature
              </div>
            </div>
            <div class="sig-footer">
              <span>Date : {{ formattedDate }}</span>
            </div>
          </div>

          <div class="sig-card client-sig">
            <div class="sig-header">
              <span class="sig-title">Émargement du Client Bénéficiaire</span>
              <span class="sig-sub italic">« Bon pour réception de la somme en espèces »</span>
            </div>
            <div class="sig-body">
              <div class="mention-zone">
                <span class="mention-hint">Mention manuscrite obligatoire :</span>
                <span class="mention-text font-bold">« Reçu la somme de {{ formatCurrency(refund.amount) }} en espèces »</span>
              </div>
            </div>
            <div class="sig-footer">
              <span>Signature du client :</span>
            </div>
          </div>
        </div>

        <!-- Document Footer -->
        <footer class="doc-footer">
          <span>{{ companyName }} — Document de décharge comptable interne édité le {{ printTimestamp }}</span>
          <span class="font-mono">Réf: {{ refund.refundNumber }}</span>
        </footer>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.refund-doc-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.doc-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.85rem;
  background: var(--color-bg-subtle, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
}

.toolbar-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toolbar-tag {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  background: var(--color-primary-subtle, rgba(37, 99, 235, 0.1));
  color: var(--color-primary, #2563eb);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.toolbar-actions {
  display: flex;
  gap: 0.5rem;
}

/* Printable A4 Sheet */
.a4-sheet {
  background: #ffffff;
  color: #0f172a;
  padding: 2rem 2.25rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  font-family: inherit;
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
}

.company-name {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin: 0 0 0.2rem 0;
  color: #0f172a;
}

.company-subtitle {
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  margin: 0 0 0.5rem 0;
  letter-spacing: 0.5px;
}

.warehouse-details {
  font-size: 0.8rem;
  color: #475569;
}

.voucher-meta-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
}

.voucher-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
}

.voucher-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #475569;
  letter-spacing: 0.5px;
}

.voucher-num {
  font-size: 1.1rem;
  font-weight: 800;
  color: #0f172a;
}

.meta-row {
  display: flex;
  gap: 0.4rem;
  font-size: 0.8rem;
}

.meta-label {
  color: #64748b;
}

.header-line {
  height: 2px;
  background: #0f172a;
  margin: 1rem 0;
}

.doc-title-box {
  text-align: center;
  padding: 0.6rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-bottom: 1.25rem;
}

.doc-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
  letter-spacing: 0.5px;
}

.doc-subtitle {
  font-size: 0.78rem;
  color: #64748b;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.detail-box {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.box-title {
  background: #f1f5f9;
  padding: 0.4rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #334155;
  border-bottom: 1px solid #e2e8f0;
}

.box-content {
  padding: 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.82rem;
}

.info-line {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.info-label {
  color: #64748b;
  flex-shrink: 0;
}

.info-value {
  color: #0f172a;
  text-align: right;
}

.financial-table-box {
  margin-bottom: 1rem;
}

.financial-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #cbd5e1;
}

.financial-table th {
  background: #f8fafc;
  border-bottom: 2px solid #cbd5e1;
  padding: 0.6rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #334155;
}

.financial-table td {
  padding: 0.85rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.85rem;
}

.table-subtext {
  margin: 0.2rem 0 0 0;
  font-size: 0.75rem;
  color: #64748b;
}

.text-highlight {
  font-size: 1.15rem;
  color: #2563eb;
}

.words-banner {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-left: 4px solid #2563eb;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
}

.words-label {
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 0.2rem;
}

.words-text {
  font-size: 0.92rem;
  color: #0f172a;
  letter-spacing: 0.2px;
}

.signatures-section {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.sig-card {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  min-height: 140px;
}

.sig-header {
  background: #f8fafc;
  border-bottom: 1px solid #cbd5e1;
  padding: 0.4rem 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sig-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #1e293b;
}

.sig-sub {
  font-size: 0.72rem;
  color: #64748b;
}

.sig-body {
  flex: 1;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.sig-stamp-placeholder {
  border: 1px dashed #cbd5e1;
  border-radius: 4px;
  height: 65px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #94a3b8;
  font-style: italic;
}

.mention-zone {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.mention-hint {
  font-size: 0.7rem;
  color: #64748b;
}

.mention-text {
  font-size: 0.78rem;
  color: #334155;
  background: #f1f5f9;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
}

.sig-footer {
  border-top: 1px solid #e2e8f0;
  padding: 0.35rem 0.75rem;
  font-size: 0.72rem;
  color: #64748b;
}

.doc-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #e2e8f0;
  padding-top: 0.5rem;
  font-size: 0.7rem;
  color: #94a3b8;
}

.text-right {
  text-align: right;
}

.font-mono {
  font-family: monospace;
}

.font-bold {
  font-weight: 700;
}

.font-semibold {
  font-weight: 600;
}

.text-uppercase {
  text-transform: uppercase;
}

.italic {
  font-style: italic;
}

.text-muted {
  color: #64748b;
}

.text-success {
  color: #059669;
}

/* Print Rules */
@media print {
  body * {
    visibility: hidden;
  }

  #printable-refund-voucher,
  #printable-refund-voucher * {
    visibility: visible;
  }

  #printable-refund-voucher {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    border: none;
    box-shadow: none;
  }

  .no-print {
    display: none !important;
  }
}
</style>
