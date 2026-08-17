<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { auditService } from '../../services/admin-reports.service';
import type { AuditLog } from '../../types';
import { formatDateTime, formatAuditAction, formatEntityType } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppBadge from '../../components/common/AppBadge.vue';

const logs = ref<AuditLog[]>([]);
const loading = ref(true);
const searchQuery = ref('');

onMounted(async () => {
  await fetchLogs();
});

async function fetchLogs() {
  loading.value = true;
  try {
    logs.value = await auditService.getAuditLogs();
  } catch (err) {
    console.error('Failed to load audit logs', err);
  } finally {
    loading.value = false;
  }
}

const filteredLogs = computed(() => {
  if (!searchQuery.value.trim()) return logs.value;
  const q = searchQuery.value.toLowerCase();
  return logs.value.filter(
    (l) =>
      l.action.toLowerCase().includes(q) ||
      l.entityType.toLowerCase().includes(q) ||
      l.username.toLowerCase().includes(q) ||
      l.description.toLowerCase().includes(q) ||
      (l.warehouseName && l.warehouseName.toLowerCase().includes(q))
  );
});
</script>

<template>
  <div class="audit-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Journal d'Audit Système</h1>
        <p class="text-muted">Piste d'audit médico-légale immuable de toutes les transactions, modifications de prix et annulations</p>
      </div>
      <div class="header-actions">
        <button class="refresh-btn" @click="fetchLogs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Actualiser
        </button>
      </div>
    </div>

    <!-- Search Box -->
    <div class="filter-bar">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher dans l'audit par utilisateur, action, entité, entrepôt..."
          class="search-input"
        />
      </div>
      <div class="count-badge text-muted font-mono">
        {{ filteredLogs.length }} {{ filteredLogs.length > 1 ? 'événements enregistrés' : 'événement enregistré' }}
      </div>
    </div>

    <!-- Table -->
    <AppTable :loading="loading" :empty="!filteredLogs.length" empty-text="Aucun événement d'audit trouvé" :columns-count="6">
      <template #header>
        <th>Horodatage</th>
        <th>Utilisateur</th>
        <th>Action</th>
        <th>Entité</th>
        <th>Entrepôt</th>
        <th>Description & Détails de l'Audit</th>
      </template>
      <template #body>
        <tr v-for="log in filteredLogs" :key="log.id">
          <td class="font-mono text-caption">{{ formatDateTime(log.createdAt) }}</td>
          <td>
            <strong>{{ log.userFullName || log.username }}</strong>
            <span class="text-caption font-mono" style="display: block;">@{{ log.username }}</span>
          </td>
          <td>
            <AppBadge variant="neutral" size="sm">{{ formatAuditAction(log.action) }}</AppBadge>
          </td>
          <td>
            <span class="font-mono">{{ formatEntityType(log.entityType) }} #{{ log.entityId }}</span>
          </td>
          <td>{{ log.warehouseName || 'Global' }}</td>
          <td>
            <div class="description-cell">
              <span>{{ log.description }}</span>
              <div v-if="log.newValues" class="payload-box font-mono">
                <span v-if="log.oldValues" class="text-muted">Précédent : {{ log.oldValues }} &rarr; </span>
                <span class="text-success">{{ log.newValues }}</span>
              </div>
            </div>
          </td>
        </tr>
      </template>
    </AppTable>
  </div>
</template>

<style scoped>
.audit-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 480px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

.search-input {
  width: 100%;
  height: 38px;
  padding: 8px 12px 8px 36px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
}

.description-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.payload-box {
  background-color: var(--color-surface);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: 11px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-primary);
}

.refresh-btn:hover {
  background-color: var(--color-surface-hover);
}
</style>
