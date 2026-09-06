<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { useWarehouseStore } from '../../stores/warehouse.store';
import AppModal from '../common/AppModal.vue';
import AppButton from '../common/AppButton.vue';
import AppBadge from '../common/AppBadge.vue';
import {
  parseStockExcel,
  executeChunkedImport,
  type ExcelParseResult,
  type ImportExecutionResult,
} from '../../services/excelImport.service';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface Props {
  modelValue: boolean;
  initialWarehouseId?: number;
}

const props = withDefaults(defineProps<Props>(), {
  initialWarehouseId: 0,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success', result: ImportExecutionResult): void;
}>();

const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();

const selectedWarehouseId = ref<number>(0);
const isParsing = ref(false);
const isImporting = ref(false);
const parseError = ref('');
const parseResult = ref<ExcelParseResult | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);
const showAllWarnings = ref(false);

// Progress tracking
const progress = ref({
  currentBatch: 0,
  totalBatches: 0,
  percentage: 0,
  processedCount: 0,
});

// Completion state
const executionResult = ref<ImportExecutionResult | null>(null);

const activeWarehouses = computed(() =>
  warehouseStore.warehouses.filter((w) => w.active)
);

const effectiveWarehouseId = computed(() => {
  if (authStore.isManager && authStore.user?.warehouseId) {
    return authStore.user.warehouseId;
  }
  return selectedWarehouseId.value;
});

const targetWarehouseName = computed(() => {
  const wid = effectiveWarehouseId.value;
  const found = warehouseStore.warehouses.find((w) => w.id === wid);
  return found ? found.name : 'Dépôt non sélectionné';
});

const canImport = computed(() => {
  return (
    !isParsing.value &&
    !isImporting.value &&
    parseResult.value !== null &&
    parseResult.value.validItems.length > 0 &&
    effectiveWarehouseId.value > 0
  );
});

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      resetState();
      initWarehouseSelection();
    }
  }
);

onMounted(async () => {
  if (warehouseStore.warehouses.length === 0) {
    await warehouseStore.fetchWarehouses();
  }
  initWarehouseSelection();
});

function initWarehouseSelection() {
  if (authStore.isManager && authStore.user?.warehouseId) {
    selectedWarehouseId.value = authStore.user.warehouseId;
  } else if (props.initialWarehouseId && props.initialWarehouseId > 0) {
    selectedWarehouseId.value = props.initialWarehouseId;
  } else if (activeWarehouses.value.length > 0) {
    selectedWarehouseId.value = activeWarehouses.value[0].id;
  }
}

function resetState() {
  parseResult.value = null;
  parseError.value = '';
  isParsing.value = false;
  isImporting.value = false;
  executionResult.value = null;
  showAllWarnings.value = false;
  progress.value = {
    currentBatch: 0,
    totalBatches: 0,
    percentage: 0,
    processedCount: 0,
  };
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

function triggerFileSelect() {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    await processFile(file);
  }
}

function onDrop(e: DragEvent) {
  isDragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    processFile(file);
  }
}

async function processFile(file: File) {
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    parseError.value = 'Format non supporté. Veuillez sélectionner un fichier Excel (.xlsx ou .xls).';
    return;
  }

  isParsing.value = true;
  parseError.value = '';
  parseResult.value = null;
  executionResult.value = null;

  try {
    const res = await parseStockExcel(file);
    parseResult.value = res;
  } catch (err: any) {
    parseError.value = err.message || "Échec de l'analyse du fichier Excel.";
  } finally {
    isParsing.value = false;
  }
}

async function startImport() {
  if (!canImport.value || !parseResult.value) return;

  const targetWhId = effectiveWarehouseId.value;
  if (!targetWhId) {
    parseError.value = 'Veuillez sélectionner un dépôt de destination.';
    return;
  }

  isImporting.value = true;
  parseError.value = '';

  try {
    const result = await executeChunkedImport(
      targetWhId,
      parseResult.value.validItems,
      1000,
      (prog) => {
        progress.value = prog;
      }
    );
    executionResult.value = result;
    emit('success', result);
  } catch (err: any) {
    parseError.value = err.response?.data?.message || err.message || "Une erreur est survenue lors de l'importation.";
  } finally {
    isImporting.value = false;
  }
}

function closeModal() {
  if (!isImporting.value) {
    emit('update:modelValue', false);
  }
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    title="Importer les Produits et Stocks (Excel)"
    max-width="780px"
    @close="closeModal"
  >
    <div class="import-container">
      <!-- 1. Destination Warehouse Selector -->
      <div class="section warehouse-section">
        <label class="section-label">Dépôt de destination :</label>
        <div v-if="authStore.isAdmin" class="warehouse-select-wrap">
          <select
            v-model="selectedWarehouseId"
            class="warehouse-select"
            :disabled="isImporting || executionResult !== null"
          >
            <option
              v-for="wh in activeWarehouses"
              :key="wh.id"
              :value="wh.id"
            >
              {{ wh.name }} ({{ wh.code }})
            </option>
          </select>
          <span class="field-hint">Le stock physique sera alloué à ce dépôt.</span>
        </div>
        <div v-else class="manager-warehouse-badge">
          <span class="wh-pin">📍</span>
          <strong>{{ targetWarehouseName }}</strong>
          <span class="wh-tag">Assigné à votre compte</span>
        </div>
      </div>

      <!-- 2. Completion Screen -->
      <div v-if="executionResult" class="success-screen">
        <div class="success-icon">✓</div>
        <h4 class="success-title">Importation réussie avec succès !</h4>
        <p class="success-subtitle">
          Toutes les données ont été synchronisées vers <strong>{{ executionResult.warehouseName }}</strong>.
        </p>

        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-val">{{ formatNumber(executionResult.totalProcessed) }}</span>
            <span class="metric-label">Articles traités</span>
          </div>
          <div class="metric-card metric-new">
            <span class="metric-val">{{ formatNumber(executionResult.totalCreated) }}</span>
            <span class="metric-label">Nouveaux produits créés</span>
          </div>
          <div class="metric-card metric-matched">
            <span class="metric-val">{{ formatNumber(executionResult.totalExisting) }}</span>
            <span class="metric-label">Articles déjà existants</span>
          </div>
          <div class="metric-card metric-stock">
            <span class="metric-val">{{ formatNumber(executionResult.totalStockUpdated) }}</span>
            <span class="metric-label">Lignes de stock allouées</span>
          </div>
        </div>

        <p class="catalog-protection-note">
          ℹ️ <strong>Protection du catalogue :</strong> Les désignations et prix des produits déjà existants ont été préservés pour garantir l'intégrité de la base centrale.
        </p>
      </div>

      <!-- 3. File Upload Dropzone (When not completed) -->
      <div v-else class="upload-section">
        <!-- Hidden file input -->
        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx, .xls"
          class="hidden-file-input"
          @change="handleFileChange"
        />

        <div
          v-if="!parseResult && !isParsing"
          class="dropzone"
          :class="{ 'dropzone-active': isDragOver }"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop.prevent="onDrop"
          @click="triggerFileSelect"
        >
          <div class="dropzone-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 12 15 15" />
            </svg>
          </div>
          <div class="dropzone-text">
            <strong>Cliquez pour parcourir</strong> ou glissez-déposez votre fichier <code>STOCK.xlsx</code>
          </div>
          <div class="dropzone-subtext">Fichiers Excel supportés (.xlsx, .xls) jusqu'à 10 000 lignes</div>
        </div>

        <!-- Parsing Loader -->
        <div v-if="isParsing" class="parsing-state">
          <div class="spinner"></div>
          <span>Analyse du fichier Excel en mémoire...</span>
        </div>

        <!-- Error banner -->
        <div v-if="parseError" class="alert-banner alert-error">
          <span class="alert-icon">⚠️</span>
          <div class="alert-content">
            <strong>Erreur :</strong> {{ parseError }}
          </div>
        </div>

        <!-- 4. Parsed Summary & Pre-Flight Preview -->
        <div v-if="parseResult && !isParsing" class="preview-container">
          <div class="file-summary-bar">
            <div class="file-info">
              <span class="file-icon">📊</span>
              <div>
                <strong class="file-name">{{ parseResult.fileName }}</strong>
                <span class="file-count">{{ formatNumber(parseResult.totalRows) }} lignes détectées</span>
              </div>
            </div>
            <button
              type="button"
              class="change-file-btn"
              :disabled="isImporting"
              @click="triggerFileSelect"
            >
              Changer de fichier
            </button>
          </div>

          <!-- Pre-flight stats -->
          <div class="preflight-stats">
            <div class="stat-pill stat-valid">
              <span class="pill-dot">●</span>
              <span><strong>{{ formatNumber(parseResult.validItems.length) }}</strong> articles valides prêts à importer</span>
            </div>
            <div v-if="parseResult.anomalies.length > 0" class="stat-pill stat-warning">
              <span class="pill-dot">▲</span>
              <span><strong>{{ parseResult.anomalies.length }}</strong> avertissements (valeurs corrigées)</span>
            </div>
          </div>

          <!-- Anomalies Accordion if any -->
          <div v-if="parseResult.anomalies.length > 0" class="warnings-box">
            <div class="warnings-header" @click="showAllWarnings = !showAllWarnings">
              <span>⚠️ Diagnostics de nettoyage automatique des données</span>
              <span class="toggle-link">{{ showAllWarnings ? 'Masquer' : 'Voir les détails' }}</span>
            </div>
            <div v-if="showAllWarnings" class="warnings-list">
              <div
                v-for="(anom, i) in parseResult.anomalies.slice(0, 10)"
                :key="i"
                class="warning-item"
              >
                <span class="warn-row">Ligne {{ anom.row }}</span>
                <span class="warn-code">[{{ anom.code }}]</span>
                <span class="warn-msg">{{ anom.message }}</span>
              </div>
              <div v-if="parseResult.anomalies.length > 10" class="warning-more">
                ... et {{ parseResult.anomalies.length - 10 }} autres ajustements mineurs pris en charge.
              </div>
            </div>
          </div>

          <!-- Sample Table Preview -->
          <div class="table-preview-wrapper">
            <div class="preview-table-header">
              Aperçu des 5 premières lignes :
            </div>
            <div class="table-responsive">
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>Code (Réf)</th>
                    <th>Désignation</th>
                    <th>Stock</th>
                    <th>Pu Achat</th>
                    <th>Prix Vente</th>
                    <th>TVA</th>
                    <th>Colisage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in parseResult.previewRows" :key="item.code">
                    <td class="font-mono"><strong>{{ item.code }}</strong></td>
                    <td>{{ item.name }}</td>
                    <td class="text-right"><strong>{{ formatNumber(item.stock) }}</strong></td>
                    <td class="text-right">{{ formatCurrency(item.purchasePrice) }}</td>
                    <td class="text-right">{{ formatCurrency(item.salePrice) }}</td>
                    <td class="text-center">{{ item.tva }}%</td>
                    <td class="text-center">{{ item.boxSize || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Progress bar during execution -->
          <div v-if="isImporting" class="progress-box">
            <div class="progress-header">
              <span>Traitement par lots (Lot {{ progress.currentBatch }} / {{ progress.totalBatches }})...</span>
              <strong>{{ progress.percentage }}%</strong>
            </div>
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: `${progress.percentage}%` }"></div>
            </div>
            <div class="progress-sub">
              {{ formatNumber(progress.processedCount) }} / {{ formatNumber(parseResult.validItems.length) }} produits importés
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="footer-actions">
        <AppButton
          variant="secondary"
          :disabled="isImporting"
          @click="closeModal"
        >
          {{ executionResult ? 'Fermer' : 'Annuler' }}
        </AppButton>

        <AppButton
          v-if="!executionResult"
          variant="primary"
          :disabled="!canImport"
          :loading="isImporting"
          @click="startImport"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Lancer l'Importation</span>
        </AppButton>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.import-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 6px;
}

.warehouse-section {
  padding: 12px 14px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.warehouse-select-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.warehouse-select {
  width: 100%;
  max-width: 420px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  font-size: 14px;
  outline: none;
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.warehouse-select:focus {
  border-color: var(--color-primary);
}

.field-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.manager-warehouse-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: var(--color-bg);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: 14px;
}

.wh-tag {
  font-size: 11px;
  background-color: var(--color-surface);
  color: var(--color-text-secondary);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

/* Dropzone */
.hidden-file-input {
  display: none;
}

.dropzone {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: 32px 20px;
  text-align: center;
  background-color: var(--color-bg-subtle);
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.dropzone:hover,
.dropzone-active {
  border-color: var(--color-primary);
  background-color: rgba(var(--color-primary-rgb, 59, 130, 246), 0.04);
}

.dropzone-icon {
  color: var(--color-primary);
  margin-bottom: 4px;
}

.dropzone-text {
  font-size: 14px;
  color: var(--color-text-primary);
}

.dropzone-subtext {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* Parsing state */
.parsing-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 36px 20px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Alert Banner */
.alert-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-size: 13px;
}

.alert-error {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

/* Preview section */
.preview-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.file-summary-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-icon {
  font-size: 24px;
}

.file-name {
  display: block;
  font-size: 14px;
  color: var(--color-text-primary);
}

.file-count {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.change-file-btn {
  background: none;
  border: 1px solid var(--color-border);
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.change-file-btn:hover {
  background-color: var(--color-bg);
  color: var(--color-text-primary);
}

.preflight-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-full, 9999px);
  font-size: 12px;
}

.stat-valid {
  background-color: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.stat-valid .pill-dot {
  color: #10b981;
}

.stat-warning {
  background-color: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}

.stat-warning .pill-dot {
  color: #f59e0b;
}

/* Warnings Box */
.warnings-box {
  background-color: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 12px;
}

.warnings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-weight: 600;
  color: #92400e;
}

.toggle-link {
  font-size: 11px;
  text-decoration: underline;
}

.warnings-list {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(245, 158, 11, 0.2);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.warning-item {
  display: flex;
  gap: 6px;
  color: #78350f;
}

.warn-row {
  font-weight: 600;
}

.warn-code {
  font-family: monospace;
}

.warning-more {
  margin-top: 4px;
  font-style: italic;
  color: #92400e;
}

/* Table preview */
.table-preview-wrapper {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.preview-table-header {
  padding: 8px 12px;
  background-color: var(--color-bg-subtle);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
}

.table-responsive {
  max-height: 200px;
  overflow-y: auto;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.preview-table th {
  position: sticky;
  top: 0;
  background-color: var(--color-surface);
  color: var(--color-text-secondary);
  font-weight: 600;
  padding: 6px 10px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.preview-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
  white-space: nowrap;
}

.font-mono {
  font-family: monospace;
}

.text-right {
  text-align: right;
}

.text-center {
  text-align: center;
}

/* Progress Box */
.progress-box {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--color-text-primary);
}

.progress-track {
  width: 100%;
  height: 8px;
  background-color: var(--color-bg-subtle);
  border-radius: var(--radius-full, 9999px);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--color-primary);
  border-radius: var(--radius-full, 9999px);
  transition: width 0.2s ease;
}

.progress-sub {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: right;
}

/* Success Screen */
.success-screen {
  text-align: center;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.success-icon {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background-color: #ecfdf5;
  color: #059669;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.success-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.success-subtitle {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 520px;
  margin-top: 10px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 10px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.metric-val {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.metric-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.metric-new .metric-val {
  color: #059669;
}

.metric-matched .metric-val {
  color: var(--color-primary);
}

.catalog-protection-note {
  font-size: 12px;
  color: var(--color-text-secondary);
  max-width: 540px;
  background-color: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  padding: 8px 12px;
  border-radius: var(--radius-md);
  text-align: left;
  margin-top: 8px;
}

.footer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
}
</style>
