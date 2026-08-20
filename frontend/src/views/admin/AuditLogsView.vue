<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { auditService } from '../../services/admin-reports.service';
import type { AuditLog } from '../../types';
import type { ComputedPeriodRange } from '../../utils/periodNavigator';
import { formatDateTime, formatAuditAction, formatEntityType } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppBadge from '../../components/common/AppBadge.vue';
import AppPeriodNavigator from '../../components/common/AppPeriodNavigator.vue';
import AppPagination from '../../components/common/AppPagination.vue';

const authStore = useAuthStore();
const logs = ref<AuditLog[]>([]);
const loading = ref(true);
const searchQuery = ref('');

// Period & Pagination state
const activeRange = ref<ComputedPeriodRange | null>(null);
const page = ref(1);
const limit = ref(25);
const total = ref(0);
const totalPages = ref(1);

onMounted(async () => {
  if (!activeRange.value) {
    await fetchLogs();
  }
});

// Watch warehouse changes to refresh
watch(() => authStore.activeWarehouseId, async () => {
  page.value = 1;
  await fetchLogs();
});

let searchTimeout: any = null;
function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    page.value = 1;
    await fetchLogs();
  }, 300);
}

async function onPeriodChange(range: ComputedPeriodRange) {
  activeRange.value = range;
  page.value = 1;
  await fetchLogs();
}

function onPageChange(payload: { page: number; limit: number }) {
  page.value = payload.page;
  limit.value = payload.limit;
  fetchLogs();
}

async function fetchLogs() {
  loading.value = true;
  try {
    const res = await auditService.getAuditLogs({
      warehouseId: authStore.activeWarehouseId || undefined,
      startDate: activeRange.value?.startDate,
      endDate: activeRange.value?.endDate,
      search: searchQuery.value.trim() || undefined,
      page: page.value,
      limit: limit.value,
    });
    logs.value = res.items;
    total.value = res.pagination.total;
    totalPages.value = res.pagination.totalPages;
    page.value = res.pagination.page;
  } catch (err) {
    console.error('Failed to load audit logs', err);
  } finally {
    loading.value = false;
  }
}
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

    <!-- Reusable Period Navigator -->
    <AppPeriodNavigator
      initial-granularity="month"
      @change="onPeriodChange"
    />

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
          @input="onSearchInput"
        />
      </div>
      <div class="count-badge text-muted font-mono">
        {{ total }} {{ total > 1 ? 'événements enregistrés' : 'événement enregistré' }}
      </div>
    </div>

    <!-- Table -->
    <AppTable :loading="loading" :empty="!logs.length" empty-text="Aucun événement d'audit trouvé pour cette période" :columns-count="6">
      <template #header>
        <th>Horodatage</th>
        <th>Utilisateur</th>
        <th>Action</th>
        <th>Entité</th>
        <th>Entrepôt</th>
        <th>Description & Détails de l'Audit</th>
      </template>
      <template #body>
        <tr v-for="log in logs" :key="log.id">
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

    <!-- Pagination -->
    <AppPagination
      v-model:page="page"
      v-model:limit="limit"
      :total="total"
      :total-pages="totalPages"
      :loading="loading"
      @change="onPageChange"
    />
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
