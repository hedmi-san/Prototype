<script setup lang="ts">
import AppSkeleton from './AppSkeleton.vue';

interface Props {
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  columnsCount?: number;
}

withDefaults(defineProps<Props>(), {
  loading: false,
  empty: false,
  emptyText: 'Aucune donnée disponible',
  columnsCount: 5,
});
</script>

<template>
  <div class="table-container">
    <table class="app-table">
      <thead>
        <tr>
          <slot name="header" />
        </tr>
      </thead>
      <tbody>
        <template v-if="loading">
          <tr v-for="i in 5" :key="i" class="skeleton-row">
            <td :colspan="columnsCount">
              <AppSkeleton height="24px" />
            </td>
          </tr>
        </template>
        <template v-else-if="empty">
          <tr>
            <td :colspan="columnsCount" class="empty-cell">
              <div class="empty-state">
                <p class="text-muted">{{ emptyText }}</p>
              </div>
            </td>
          </tr>
        </template>
        <template v-else>
          <slot name="body" />
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-container {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-bg);
  box-shadow: var(--shadow-sm);
}

.app-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}

:deep(th) {
  padding: 12px 16px;
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

:deep(td) {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-primary);
  vertical-align: middle;
}

:deep(tr:last-child td) {
  border-bottom: none;
}

:deep(tbody tr:hover:not(.skeleton-row)) {
  background-color: #fafafa;
}

.empty-cell {
  text-align: center;
  padding: 48px 16px !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
