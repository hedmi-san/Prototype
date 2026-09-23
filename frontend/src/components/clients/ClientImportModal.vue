<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useWarehouseStore } from '../../stores/warehouse.store';
import AppModal from '../common/AppModal.vue';
import {
  parseClientExcelFile,
  requestClientImportAnalysis,
  executeClientImportCommit,
  type WarehouseFileEntry,
  type RawClientRow,
  type ImportAnalysisResult,
} from '../../services/clientImport.service';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface Props {
  modelValue: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success', result: { importedCount: number; totalOpeningDebt: number }): void;
}>();

const warehouseStore = useWarehouseStore();

// Wizard step: 'upload' | 'review' | 'importing' | 'complete'
const currentStep = ref<'upload' | 'review' | 'importing' | 'complete'>('upload');
const activeReviewTab = ref<'tier2' | 'tier1' | 'tier3'>('tier2');

// Upload state
const fileEntries = ref<WarehouseFileEntry[]>([]);
const isDragOver = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isAnalyzing = ref(false);
const analyzeError = ref('');

// Analysis state
const analysisResult = ref<ImportAnalysisResult | null>(null);

// Operator decisions on Tier 2 conflicts: conflictId -> { decision: 'merge' | 'separate', preferredName?: string, preferredAddress?: string }
const tier2Decisions = ref<Record<string, { decision: 'merge' | 'separate'; preferredName?: string; preferredAddress?: string }>>({});

// Operator choices on Tier 1 field conflicts: clusterId -> { chosenAddress?: string; chosenActivite?: string }
const tier1Choices = ref<Record<string, { chosenAddress?: string; chosenActivite?: string }>>({});

// Execution state
const isImporting = ref(false);
const importError = ref('');
const executionResult = ref<{ importedCount: number; totalOpeningDebt: number } | null>(null);

const activeWarehouses = computed(() => warehouseStore.warehouses.filter((w) => w.active));

const canAnalyze = computed(() => {
  return (
    fileEntries.value.length > 0 &&
    fileEntries.value.every((entry) => entry.warehouseId > 0) &&
    !isAnalyzing.value
  );
});

const unreviewedTier2Count = computed(() => {
  if (!analysisResult.value) return 0;
  return analysisResult.value.tier2Conflicts.filter((c) => !tier2Decisions.value[c.conflictId]).length;
});

const confirmedClientsToImport = computed(() => {
  if (!analysisResult.value) return [];
  const list: any[] = [];

  // 1. Tier 1 Clusters (Auto-merged)
  for (const cluster of analysisResult.value.tier1Clusters) {
    const choices = tier1Choices.value[cluster.clusterId] || {};
    list.push({
      name: cluster.suggestedClient.name,
      phone: cluster.suggestedClient.phone,
      address: choices.chosenAddress || cluster.suggestedClient.address,
      activite: choices.chosenActivite || cluster.suggestedClient.activite,
      rc: cluster.suggestedClient.rc,
      art: cluster.suggestedClient.art,
      numFiscal: cluster.suggestedClient.numFiscal,
      nis: cluster.suggestedClient.nis,
      nif: cluster.suggestedClient.nif,
      openingBalance: cluster.suggestedClient.totalBalance,
      warehouseBalances: cluster.records.map((r) => ({
        warehouseId: r.sourceWarehouseId,
        warehouseName: r.sourceWarehouseName,
        balance: r.balance,
      })),
    });
  }

  // 2. Tier 2 Conflicts according to decisions
  for (const conf of analysisResult.value.tier2Conflicts) {
    const dec = tier2Decisions.value[conf.conflictId];
    if (dec && dec.decision === 'merge') {
      const mergedBal = Math.round((conf.recordA.balance + conf.recordB.balance) * 100) / 100;
      const combinedPhone = Array.from(new Set([conf.recordA.phone, conf.recordB.phone].filter(Boolean))).join(' / ');
      list.push({
        name: dec.preferredName || conf.recordA.name,
        phone: combinedPhone,
        address: dec.preferredAddress || conf.recordA.address || conf.recordB.address,
        activite: conf.recordA.activite || conf.recordB.activite,
        rc: conf.recordA.rc || conf.recordB.rc,
        art: conf.recordA.art || conf.recordB.art,
        numFiscal: conf.recordA.numFiscal || conf.recordB.numFiscal,
        nis: conf.recordA.nis || conf.recordB.nis,
        nif: conf.recordA.nif || conf.recordB.nif,
        openingBalance: mergedBal,
        warehouseBalances: [
          { warehouseId: conf.recordA.sourceWarehouseId, warehouseName: conf.recordA.sourceWarehouseName, balance: conf.recordA.balance },
          { warehouseId: conf.recordB.sourceWarehouseId, warehouseName: conf.recordB.sourceWarehouseName, balance: conf.recordB.balance },
        ],
      });
    } else {
      list.push({
        name: conf.recordA.name,
        phone: conf.recordA.phone,
        address: conf.recordA.address,
        activite: conf.recordA.activite,
        rc: conf.recordA.rc,
        art: conf.recordA.art,
        numFiscal: conf.recordA.numFiscal,
        nis: conf.recordA.nis,
        nif: conf.recordA.nif,
        openingBalance: conf.recordA.balance,
        warehouseBalances: [
          { warehouseId: conf.recordA.sourceWarehouseId, warehouseName: conf.recordA.sourceWarehouseName, balance: conf.recordA.balance },
        ],
      });
      list.push({
        name: conf.recordB.name,
        phone: conf.recordB.phone,
        address: conf.recordB.address,
        activite: conf.recordB.activite,
        rc: conf.recordB.rc,
        art: conf.recordB.art,
        numFiscal: conf.recordB.numFiscal,
        nis: conf.recordB.nis,
        nif: conf.recordB.nif,
        openingBalance: conf.recordB.balance,
        warehouseBalances: [
          { warehouseId: conf.recordB.sourceWarehouseId, warehouseName: conf.recordB.sourceWarehouseName, balance: conf.recordB.balance },
        ],
      });
    }
  }

  // 3. Tier 3 Standalone clients
  for (const s of analysisResult.value.tier3Standalone) {
    list.push({
      name: s.name,
      phone: s.phone,
      address: s.address,
      activite: s.activite,
      rc: s.rc,
      art: s.art,
      numFiscal: s.numFiscal,
      nis: s.nis,
      nif: s.nif,
      openingBalance: s.balance,
      warehouseBalances: [
        { warehouseId: s.sourceWarehouseId, warehouseName: s.sourceWarehouseName, balance: s.balance },
      ],
    });
  }

  return list;
});

const totalProjectedDebt = computed(() => {
  return confirmedClientsToImport.value.reduce((sum, c) => sum + (c.openingBalance || 0), 0);
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      resetState();
    }
  }
);

onMounted(async () => {
  if (warehouseStore.warehouses.length === 0) {
    await warehouseStore.fetchWarehouses();
  }
});

function resetState() {
  currentStep.value = 'upload';
  activeReviewTab.value = 'tier2';
  fileEntries.value = [];
  isAnalyzing.value = false;
  analyzeError.value = '';
  analysisResult.value = null;
  tier2Decisions.value = {};
  tier1Choices.value = {};
  isImporting.value = false;
  importError.value = '';
  executionResult.value = null;
}

function onFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    addFiles(Array.from(target.files));
    target.value = '';
  }
}

function onDrop(event: DragEvent) {
  isDragOver.value = false;
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    addFiles(Array.from(event.dataTransfer.files));
  }
}

function addFiles(files: File[]) {
  const excelFiles = files.filter(
    (f) =>
      f.name.endsWith('.xlsx') ||
      f.name.endsWith('.xls') ||
      f.type.includes('spreadsheet') ||
      f.type.includes('excel')
  );

  for (const f of excelFiles) {
    if (!fileEntries.value.some((entry) => entry.file.name === f.name && entry.file.size === f.size)) {
      let suggestedWhId = activeWarehouses.value[0]?.id || 1;
      const lower = f.name.toLowerCase();
      const matchWh = activeWarehouses.value.find(
        (w) => lower.includes(w.name.toLowerCase()) || lower.includes(w.code.toLowerCase())
      );
      if (matchWh) suggestedWhId = matchWh.id;

      fileEntries.value.push({
        file: f,
        warehouseId: suggestedWhId,
        warehouseName: activeWarehouses.value.find((w) => w.id === suggestedWhId)?.name || 'Dépôt',
      });
    }
  }
}

function removeFile(index: number) {
  fileEntries.value.splice(index, 1);
}

function onWarehouseChange(entry: WarehouseFileEntry) {
  const found = activeWarehouses.value.find((w) => w.id === entry.warehouseId);
  if (found) {
    entry.warehouseName = found.name;
  }
}

async function handleRunAnalysis() {
  if (!canAnalyze.value) return;

  isAnalyzing.value = true;
  analyzeError.value = '';

  try {
    const pooledRows: RawClientRow[] = [];

    for (const entry of fileEntries.value) {
      const rows = await parseClientExcelFile(entry.file, entry.warehouseId, entry.warehouseName);
      entry.rowCount = rows.length;
      pooledRows.push(...rows);
    }

    if (pooledRows.length === 0) {
      throw new Error('Aucune ligne de client trouvée dans les fichiers sélectionnés.');
    }

    const res = await requestClientImportAnalysis(pooledRows);
    analysisResult.value = res;

    activeReviewTab.value = res.tier2Conflicts.length > 0 ? 'tier2' : 'tier1';
    currentStep.value = 'review';
  } catch (err: any) {
    analyzeError.value = err.response?.data?.message || err.message || "Erreur lors de l'analyse des fichiers.";
  } finally {
    isAnalyzing.value = false;
  }
}

function setTier2Decision(conflictId: string, decision: 'merge' | 'separate', preferredName?: string, preferredAddress?: string) {
  tier2Decisions.value[conflictId] = {
    decision,
    preferredName,
    preferredAddress,
  };
}

async function handleCommitImport() {
  if (isImporting.value || confirmedClientsToImport.value.length === 0) return;

  isImporting.value = true;
  importError.value = '';
  currentStep.value = 'importing';

  try {
    const res = await executeClientImportCommit({
      clients: confirmedClientsToImport.value,
    });
    executionResult.value = res;
    currentStep.value = 'complete';
    emit('success', res);
  } catch (err: any) {
    importError.value = err.response?.data?.message || err.message || "Erreur lors de l'importation en base.";
    currentStep.value = 'review';
  } finally {
    isImporting.value = false;
  }
}

function handleClose() {
  emit('update:modelValue', false);
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    title="Importer des clients"
    subtitle="Depuis plusieurs dépôts"
    :max-width="currentStep === 'review' ? '820px' : '580px'"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="import-container">
      <!-- STEP 1: UPLOAD & DROPZONE CARD -->
      <div v-if="currentStep === 'upload'" class="upload-section">
        <!-- Compact Dropzone Card (Apple HIG style) -->
        <div
          class="dropzone-card"
          :class="{ 'is-dragover': isDragOver }"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop.prevent="onDrop"
        >
          <input
            ref="fileInputRef"
            type="file"
            multiple
            accept=".xlsx, .xls"
            class="native-file-input"
            @change="onFileSelect"
          />

          <!-- 40px Circular Badge with 20px Icon -->
          <div class="upload-icon-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
              <path d="M12 12v9" />
              <path d="m8 16 4-4 4 4" />
            </svg>
          </div>

          <h4 class="dropzone-title">Glissez vos fichiers Excel ici</h4>
          <p class="dropzone-helper">.XLSX ou .XLS, un fichier par dépôt</p>

          <button
            type="button"
            class="btn-choose-files"
            @click="fileInputRef?.click()"
          >
            Choisir des fichiers
          </button>
        </div>

        <!-- SELECTED FILES LIST -->
        <div v-if="fileEntries.length > 0" class="file-list-wrapper">
          <div class="file-list-header">
            <span>Fichiers sélectionnés ({{ fileEntries.length }}) :</span>
          </div>

          <div class="file-list">
            <div
              v-for="(entry, index) in fileEntries"
              :key="entry.file.name + index"
              class="file-item"
            >
              <div class="file-info">
                <div class="excel-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="16" y2="17" />
                  </svg>
                </div>
                <div class="file-names">
                  <span class="file-name">{{ entry.file.name }}</span>
                  <span class="file-size">{{ (entry.file.size / 1024).toFixed(1) }} KB</span>
                </div>
              </div>

              <div class="file-actions">
                <div class="warehouse-select-wrap">
                  <span class="select-label">Dépôt :</span>
                  <select
                    v-model="entry.warehouseId"
                    class="warehouse-select"
                    @change="onWarehouseChange(entry)"
                  >
                    <option
                      v-for="wh in activeWarehouses"
                      :key="wh.id"
                      :value="wh.id"
                    >
                      {{ wh.name }} ({{ wh.code }})
                    </option>
                  </select>
                </div>

                <button
                  type="button"
                  class="btn-remove-file"
                  title="Supprimer le fichier"
                  @click="removeFile(index)"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="analyzeError" class="error-banner">
          {{ analyzeError }}
        </div>
      </div>

      <!-- STEP 2: REVIEW & DEDUPLICATION DASHBOARD -->
      <div v-else-if="currentStep === 'review' && analysisResult" class="review-section">
        <!-- KPI SUMMARY METRICS -->
        <div class="kpi-grid">
          <div class="kpi-box">
            <span class="kpi-title">Lignes Scannées</span>
            <span class="kpi-number">{{ formatNumber(analysisResult.kpis.totalRows) }}</span>
            <span class="kpi-sub">Total fichiers</span>
          </div>

          <div class="kpi-box kpi-box-emerald">
            <span class="kpi-title text-emerald">Auto-Fusionnés</span>
            <span class="kpi-number text-emerald">{{ formatNumber(analysisResult.kpis.autoMergedClustersCount) }}</span>
            <span class="kpi-sub">{{ analysisResult.kpis.autoMergedRecordsCount }} lignes consolidées</span>
          </div>

          <div class="kpi-box kpi-box-amber">
            <span class="kpi-title text-amber">À Réviser</span>
            <span class="kpi-number text-amber">{{ formatNumber(analysisResult.kpis.reviewConflictsCount) }}</span>
            <span class="kpi-sub">Cas ambigus</span>
          </div>

          <div class="kpi-box kpi-box-blue">
            <span class="kpi-title text-blue">Nouveaux</span>
            <span class="kpi-number text-blue">{{ formatNumber(analysisResult.kpis.standaloneCount) }}</span>
            <span class="kpi-sub">Sans chevauchement</span>
          </div>

          <div class="kpi-box kpi-box-indigo">
            <span class="kpi-title text-indigo">Dette Nette Totale</span>
            <span class="kpi-number kpi-number-sm text-indigo">{{ formatCurrency(totalProjectedDebt) }}</span>
            <span class="kpi-sub">Grand livre consolidé</span>
          </div>
        </div>

        <!-- REVIEW TABS -->
        <div class="tabs-nav">
          <button
            type="button"
            class="tab-btn"
            :class="{ 'is-active is-amber': activeReviewTab === 'tier2' }"
            @click="activeReviewTab = 'tier2'"
          >
            <span>Conflits & Ambiguïtés (Tier 2)</span>
            <span class="tab-badge badge-amber">{{ analysisResult.tier2Conflicts.length }}</span>
          </button>

          <button
            type="button"
            class="tab-btn"
            :class="{ 'is-active is-emerald': activeReviewTab === 'tier1' }"
            @click="activeReviewTab = 'tier1'"
          >
            <span>Fusions Automatiques (Tier 1)</span>
            <span class="tab-badge badge-emerald">{{ analysisResult.tier1Clusters.length }}</span>
          </button>

          <button
            type="button"
            class="tab-btn"
            :class="{ 'is-active is-blue': activeReviewTab === 'tier3' }"
            @click="activeReviewTab = 'tier3'"
          >
            <span>Nouveaux Clients (Tier 3)</span>
            <span class="tab-badge badge-blue">{{ analysisResult.tier3Standalone.length }}</span>
          </button>
        </div>

        <!-- TAB 1: TIER 2 MANUAL REVIEW QUEUE -->
        <div v-if="activeReviewTab === 'tier2'" class="tab-pane">
          <div v-if="analysisResult.tier2Conflicts.length === 0" class="empty-state">
            <div class="empty-title">Aucun conflit d'identité détecté !</div>
            <div class="empty-desc">Tous les clients sont catégorisés proprement en Tier 1 ou Tier 3.</div>
          </div>

          <div
            v-for="conf in analysisResult.tier2Conflicts"
            :key="conf.conflictId"
            class="conflict-card"
          >
            <div class="conflict-header">
              <div class="conflict-badge-wrap">
                <span class="warning-icon">!</span>
                <span class="conflict-reason">{{ conf.reason }}</span>
              </div>

              <div v-if="tier2Decisions[conf.conflictId]" class="decision-status">
                <span v-if="tier2Decisions[conf.conflictId].decision === 'merge'" class="status-merged">✓ Fusionné</span>
                <span v-else class="status-separated">Séparés</span>
              </div>
            </div>

            <!-- SIDE-BY-SIDE RECORD COMPARISON -->
            <div class="comparison-grid">
              <!-- SIDE A -->
              <div class="side-card">
                <div class="side-top">
                  <span class="side-wh">{{ conf.recordA.sourceWarehouseName }} (Ligne {{ conf.recordA.sourceRow }})</span>
                  <span class="side-bal">{{ formatCurrency(conf.recordA.balance) }}</span>
                </div>
                <div class="side-client-name">{{ conf.recordA.name }}</div>
                <div class="side-details">
                  <div>📞 {{ conf.recordA.phone || 'Non renseigné' }}</div>
                  <div>📍 {{ conf.recordA.address || 'Non renseignée' }}</div>
                  <div class="side-fiscal">RC: {{ conf.recordA.rc || '-' }} | Art: {{ conf.recordA.art || '-' }}</div>
                </div>
              </div>

              <!-- SIDE B -->
              <div class="side-card">
                <div class="side-top">
                  <span class="side-wh">{{ conf.recordB.sourceWarehouseName }} (Ligne {{ conf.recordB.sourceRow }})</span>
                  <span class="side-bal">{{ formatCurrency(conf.recordB.balance) }}</span>
                </div>
                <div class="side-client-name">{{ conf.recordB.name }}</div>
                <div class="side-details">
                  <div>📞 {{ conf.recordB.phone || 'Non renseigné' }}</div>
                  <div>📍 {{ conf.recordB.address || 'Non renseignée' }}</div>
                  <div class="side-fiscal">RC: {{ conf.recordB.rc || '-' }} | Art: {{ conf.recordB.art || '-' }}</div>
                </div>
              </div>
            </div>

            <!-- ACTION BUTTONS FOR THIS CONFLICT -->
            <div class="conflict-actions">
              <button
                type="button"
                class="btn-action-outline"
                :class="{ 'is-selected': tier2Decisions[conf.conflictId]?.decision === 'separate' }"
                @click="setTier2Decision(conf.conflictId, 'separate')"
              >
                Garder comme 2 clients distincts
              </button>

              <button
                type="button"
                class="btn-action-merge"
                :class="{ 'is-selected': tier2Decisions[conf.conflictId]?.decision === 'merge' }"
                @click="setTier2Decision(conf.conflictId, 'merge', conf.recordA.name, conf.recordA.address)"
              >
                Fusionner en 1 seul client (Solde sommé : {{ formatCurrency(conf.recordA.balance + conf.recordB.balance) }})
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 2: TIER 1 AUTO-MERGED CLUSTERS -->
        <div v-else-if="activeReviewTab === 'tier1'" class="tab-pane">
          <div
            v-for="cluster in analysisResult.tier1Clusters"
            :key="cluster.clusterId"
            class="cluster-card"
          >
            <div class="cluster-header">
              <div>
                <span class="cluster-name">{{ cluster.suggestedClient.name }}</span>
                <span class="cluster-depot-tag">{{ cluster.records.length }} dépôts consolidés</span>
              </div>
              <div class="cluster-total-wrap">
                <span class="cluster-total-label">Solde Fusionné :</span>
                <span class="cluster-total-val">{{ formatCurrency(cluster.suggestedClient.totalBalance) }}</span>
              </div>
            </div>

            <div class="cluster-records">
              <div
                v-for="rec in cluster.records"
                :key="rec.sourceWarehouseId + '-' + rec.sourceRow"
                class="cluster-record-row"
              >
                <div class="cluster-record-meta">
                  <span class="wh-tag">{{ rec.sourceWarehouseName }}</span>
                  <span class="record-addr">{{ rec.address || 'Sans adresse' }}</span>
                </div>
                <div class="record-bal">{{ formatCurrency(rec.balance) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 3: TIER 3 STANDALONE CLIENTS -->
        <div v-else-if="activeReviewTab === 'tier3'" class="tab-pane">
          <p class="tab-desc">Ces clients n'ont aucun chevauchement avec les autres dépôts et seront importés directement.</p>
          <div class="standalone-list">
            <div
              v-for="st in analysisResult.tier3Standalone.slice(0, 50)"
              :key="st.sourceWarehouseId + '-' + st.sourceRow"
              class="standalone-row"
            >
              <div>
                <div class="st-name">{{ st.name }}</div>
                <div class="st-meta">{{ st.sourceWarehouseName }} • {{ st.address || 'Sans adresse' }} • {{ st.phone || 'Sans tel' }}</div>
              </div>
              <div class="st-bal">{{ formatCurrency(st.balance) }}</div>
            </div>
          </div>
          <div v-if="analysisResult.tier3Standalone.length > 50" class="more-indicator">
            ... et {{ analysisResult.tier3Standalone.length - 50 }} autres clients autonomes.
          </div>
        </div>

        <div v-if="importError" class="error-banner">
          {{ importError }}
        </div>
      </div>

      <!-- STEP 3: PROGRESS -->
      <div v-else-if="currentStep === 'importing'" class="loading-state">
        <div class="spinner"></div>
        <h4 class="loading-title">Importation en cours...</h4>
        <p class="loading-desc">Génération des codes CLT-XXXX et écritures comptables d'ouverture multi-dépôts.</p>
      </div>

      <!-- STEP 4: SUCCESS -->
      <div v-else-if="currentStep === 'complete' && executionResult" class="success-state">
        <div class="success-badge">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 class="success-title">Importation Réussie !</h3>
        <p class="success-text">
          <strong>{{ executionResult.importedCount }}</strong> comptes clients ont été consolidés et créés.
        </p>
        <div class="success-stat">
          Dette totale initiale enregistrée : <strong>{{ formatCurrency(executionResult.totalOpeningDebt) }}</strong>
        </div>
        <button type="button" class="btn-primary" @click="handleClose">
          Fermer et actualiser la liste
        </button>
      </div>
    </div>

    <!-- FOOTER ACTION BAR (Apple HIG Style in AppModal #footer) -->
    <template #footer v-if="currentStep === 'upload' || currentStep === 'review'">
      <div class="modal-actions-footer">
        <div class="footer-left">
          <button
            v-if="currentStep === 'review'"
            type="button"
            class="btn-back"
            @click="currentStep = 'upload'"
          >
            ← Retour aux fichiers
          </button>
        </div>

        <div class="footer-right">
          <!-- GHOST / SECONDARY BUTTON -->
          <button
            type="button"
            class="btn-cancel"
            @click="handleClose"
          >
            Annuler
          </button>

          <!-- PRIMARY ACTION WITH SF-SYMBOL CHEVRON -->
          <button
            v-if="currentStep === 'upload'"
            type="button"
            class="btn-primary"
            :disabled="!canAnalyze"
            @click="handleRunAnalysis"
          >
            <span v-if="isAnalyzing">Analyse en cours...</span>
            <span v-else>Analyser et détecter les doublons</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <button
            v-else-if="currentStep === 'review'"
            type="button"
            class="btn-primary"
            :disabled="isImporting"
            @click="handleCommitImport"
          >
            <span v-if="isImporting">Importation...</span>
            <span v-else>Valider et Importer {{ confirmedClientsToImport.length }} clients</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.import-container {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.upload-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* APPLE HIG DROPZONE CARD */
.dropzone-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  border: 1.5px dashed var(--color-border, #d1d5db);
  border-radius: 14px;
  background-color: var(--color-bg-subtle, #fbfcfd);
  padding: 30px 20px;
  transition: all 0.2s ease;
}

.dropzone-card.is-dragover {
  border-color: #2563eb;
  background-color: #eff6ff;
}

.native-file-input {
  display: none !important;
}

.upload-icon-badge {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: #eff6ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.dropzone-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin: 0 0 4px 0;
  letter-spacing: -0.01em;
}

.dropzone-helper {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
  margin: 0 0 16px 0;
}

.btn-choose-files {
  background-color: #ffffff;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 9px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary, #1f2937);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.15s ease;
}

.btn-choose-files:hover {
  background-color: #f9fafb;
  border-color: #9ca3af;
}

/* FILE LIST */
.file-list-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-list-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.file-list {
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  background-color: #ffffff;
  overflow: hidden;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border, #f3f4f6);
}

.file-item:last-child {
  border-bottom: none;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.excel-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: #ecfdf5;
  color: #059669;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-names {
  display: flex;
  flex-direction: column;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.file-size {
  font-size: 11px;
  color: var(--color-text-secondary, #6b7280);
}

.file-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.warehouse-select-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.select-label {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.warehouse-select {
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 7px;
  background-color: #ffffff;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.btn-remove-file {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.btn-remove-file:hover {
  color: #ef4444;
  background-color: #fee2e2;
}

.error-banner {
  border: 1px solid #fecaca;
  background-color: #fef2f2;
  color: #b91c1c;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 12px;
}

/* FOOTER ACTIONS (APPLE HIG) */
.modal-actions-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.footer-left {
  display: flex;
  align-items: center;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: auto;
}

.btn-cancel {
  background: transparent;
  border: none;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary, #4b5563);
  cursor: pointer;
  padding: 8px 14px;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.btn-cancel:hover {
  color: var(--color-text-primary, #111827);
  background-color: rgba(0, 0, 0, 0.04);
}

.btn-back {
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 500;
  color: #2563eb;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
}

.btn-back:hover {
  text-decoration: underline;
}

.btn-primary {
  background-color: #000000;
  color: #ffffff;
  border: none;
  border-radius: 9px;
  padding: 10px 18px;
  font-size: 13.5px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.92;
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* STEP 2: REVIEW DASHBOARD */
.review-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.kpi-box {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  background-color: #ffffff;
}

.kpi-box-emerald { border-color: #a7f3d0; background-color: #ecfdf5; }
.kpi-box-amber { border-color: #fde68a; background-color: #fffbeb; }
.kpi-box-blue { border-color: #bfdbfe; background-color: #eff6ff; }
.kpi-box-indigo { border-color: #c7d2fe; background-color: #eef2ff; }

.kpi-title { font-size: 11px; font-weight: 600; color: #6b7280; }
.kpi-number { font-size: 19px; font-weight: 700; color: #111827; margin: 2px 0; }
.kpi-number-sm { font-size: 14px; }
.kpi-sub { font-size: 10px; color: #9ca3af; }

.text-emerald { color: #059669 !important; }
.text-amber { color: #d97706 !important; }
.text-blue { color: #2563eb !important; }
.text-indigo { color: #4f46e5 !important; }

/* TABS */
.tabs-nav {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn.is-active.is-amber { border-color: #d97706; color: #d97706; font-weight: 600; }
.tab-btn.is-active.is-emerald { border-color: #059669; color: #059669; font-weight: 600; }
.tab-btn.is-active.is-blue { border-color: #2563eb; color: #2563eb; font-weight: 600; }

.tab-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
}
.badge-amber { background-color: #fef3c7; color: #92400e; }
.badge-emerald { background-color: #d1fae5; color: #065f46; }
.badge-blue { background-color: #dbeafe; color: #1e40af; }

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 480px;
  overflow-y: auto;
  padding-right: 4px;
}

.tab-desc {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
}

/* CONFLICT CARD */
.conflict-card {
  border: 1px solid #fde68a;
  border-radius: 12px;
  background-color: #ffffff;
  padding: 14px 16px;
}

.conflict-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #fef3c7;
  padding-bottom: 8px;
}

.conflict-badge-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.warning-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #fef3c7;
  color: #b45309;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.conflict-reason {
  font-size: 12px;
  font-weight: 600;
  color: #92400e;
}

.decision-status {
  font-size: 11px;
  font-weight: 700;
}
.status-merged { color: #059669; }
.status-separated { color: #6b7280; }

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 10px;
}

.side-card {
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  background-color: #f9fafb;
  padding: 10px 12px;
}

.side-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.side-wh { font-weight: 600; color: #6b7280; }
.side-bal { font-weight: 700; color: #111827; }

.side-client-name {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  margin-top: 4px;
}

.side-details {
  font-size: 11px;
  color: #4b5563;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.side-fiscal {
  font-size: 10px;
  color: #9ca3af;
  margin-top: 2px;
}

.conflict-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid #f3f4f6;
  padding-top: 10px;
  margin-top: 10px;
}

.btn-action-outline {
  border: 1px solid #d1d5db;
  border-radius: 7px;
  background: #ffffff;
  padding: 6px 12px;
  font-size: 11.5px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
}

.btn-action-outline.is-selected {
  background-color: #1f2937;
  color: #ffffff;
  border-color: #1f2937;
}

.btn-action-merge {
  border: 1px solid #a7f3d0;
  border-radius: 7px;
  background-color: #ecfdf5;
  color: #065f46;
  padding: 6px 12px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.btn-action-merge.is-selected {
  background-color: #059669;
  color: #ffffff;
  border-color: #059669;
}

/* CLUSTERS */
.cluster-card {
  border: 1px solid #a7f3d0;
  border-radius: 12px;
  background-color: #ffffff;
  padding: 12px 16px;
}

.cluster-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ecfdf5;
  padding-bottom: 8px;
}

.cluster-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #111827;
}

.cluster-depot-tag {
  font-size: 11px;
  color: #059669;
  margin-left: 8px;
}

.cluster-total-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cluster-total-label { font-size: 11px; color: #6b7280; }
.cluster-total-val { font-size: 13px; font-weight: 700; color: #059669; }

.cluster-records {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.cluster-record-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #4b5563;
  padding: 3px 0;
}

.wh-tag { font-weight: 600; color: #1f2937; }
.record-addr { font-size: 11px; color: #9ca3af; margin-left: 8px; }
.record-bal { font-weight: 600; color: #111827; }

/* STANDALONE */
.standalone-list {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background-color: #ffffff;
  overflow: hidden;
}

.standalone-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 12px;
}

.standalone-row:last-child { border-bottom: none; }
.st-name { font-weight: 600; color: #111827; }
.st-meta { font-size: 11px; color: #9ca3af; margin-top: 1px; }
.st-bal { font-weight: 700; color: #111827; }
.more-indicator { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 6px; }

/* LOADING & SUCCESS */
.loading-state, .success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3.5px solid #e5e7eb;
  border-top-color: #000000;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-title { font-size: 16px; font-weight: 600; color: #111827; margin: 14px 0 4px 0; }
.loading-desc { font-size: 13px; color: #6b7280; margin: 0; }

.success-badge {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background-color: #ecfdf5;
  color: #059669;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.success-title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 6px 0; }
.success-text { font-size: 14px; color: #4b5563; margin: 0 0 14px 0; }
.success-stat {
  border: 1px solid #e5e7eb;
  background-color: #f9fafb;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 12.5px;
  color: #374151;
  margin-bottom: 20px;
}

.empty-state {
  border: 1px dashed #d1d5db;
  border-radius: 12px;
  padding: 30px;
  text-align: center;
  background-color: #fbfcfd;
}
.empty-title { font-size: 14px; font-weight: 600; color: #059669; }
.empty-desc { font-size: 12px; color: #6b7280; margin-top: 3px; }
</style>
