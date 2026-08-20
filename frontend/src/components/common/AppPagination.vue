<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  loading?: boolean;
  pageSizes?: number[];
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  pageSizes: () => [25, 50, 100],
});

const emit = defineEmits<{
  (e: 'update:page', page: number): void;
  (e: 'update:limit', limit: number): void;
  (e: 'change', payload: { page: number; limit: number }): void;
}>();

const startRecord = computed(() => {
  if (props.total === 0) return 0;
  return (props.page - 1) * props.limit + 1;
});

const endRecord = computed(() => {
  return Math.min(props.page * props.limit, props.total);
});

// Generate visible page numbers with ellipsis
const visiblePages = computed(() => {
  const current = props.page;
  const total = props.totalPages;
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('...');
    pages.push(total);
  } else if (current >= total - 3) {
    pages.push(1);
    pages.push('...');
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push('...');
    for (let i = current - 1; i <= current + 1; i++) pages.push(i);
    pages.push('...');
    pages.push(total);
  }
  return pages;
});

function goToPage(newPage: number) {
  if (newPage < 1 || newPage > props.totalPages || newPage === props.page || props.loading) return;
  emit('update:page', newPage);
  emit('change', { page: newPage, limit: props.limit });
}

function onLimitChange(event: Event) {
  const newLimit = Number((event.target as HTMLSelectElement).value);
  emit('update:limit', newLimit);
  emit('update:page', 1);
  emit('change', { page: 1, limit: newLimit });
}
</script>

<template>
  <div class="pagination-bar" :class="{ 'is-loading': loading }">
    <!-- Left: Count & Range Info -->
    <div class="pagination-info text-muted">
      <span v-if="total > 0">
        Affichage <strong>{{ startRecord }}</strong> à <strong>{{ endRecord }}</strong> sur <strong class="font-mono">{{ total }}</strong> enregistrements
      </span>
      <span v-else>
        0 enregistrement trouvé
      </span>
    </div>

    <!-- Right: Page Controls & Limit Selector -->
    <div class="pagination-actions">
      <!-- Page Size Selector -->
      <div class="page-size-selector">
        <label for="page-size-select" class="text-caption text-muted">Lignes par page :</label>
        <select
          id="page-size-select"
          :value="limit"
          :disabled="loading"
          class="page-size-select"
          @change="onLimitChange"
        >
          <option v-for="size in pageSizes" :key="size" :value="size">
            {{ size }}
          </option>
        </select>
      </div>

      <!-- Navigation Steppers & Page Buttons -->
      <nav class="page-nav" aria-label="Pagination">
        <!-- First Page Button -->
        <button
          type="button"
          class="page-btn nav-btn"
          :disabled="page <= 1 || loading"
          title="Première page"
          @click="goToPage(1)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
        </button>

        <!-- Previous Page Button -->
        <button
          type="button"
          class="page-btn nav-btn"
          :disabled="page <= 1 || loading"
          title="Page précédente"
          @click="goToPage(page - 1)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <!-- Page Numbers -->
        <template v-for="(p, idx) in visiblePages" :key="idx">
          <span v-if="p === '...'" class="page-ellipsis">&hellip;</span>
          <button
            v-else
            type="button"
            class="page-btn num-btn"
            :class="{ active: p === page }"
            :disabled="loading"
            @click="goToPage(Number(p))"
          >
            {{ p }}
          </button>
        </template>

        <!-- Next Page Button -->
        <button
          type="button"
          class="page-btn nav-btn"
          :disabled="page >= totalPages || totalPages === 0 || loading"
          title="Page suivante"
          @click="goToPage(page + 1)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <!-- Last Page Button -->
        <button
          type="button"
          class="page-btn nav-btn"
          :disabled="page >= totalPages || totalPages === 0 || loading"
          title="Dernière page"
          @click="goToPage(totalPages)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="13 17 18 12 13 7" />
            <polyline points="6 17 11 12 6 7" />
          </svg>
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  transition: opacity 0.2s ease;
}

.pagination-bar.is-loading {
  opacity: 0.7;
  pointer-events: none;
}

.pagination-info {
  font-size: 12px;
}

.pagination-info strong {
  color: var(--color-text-primary);
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.page-size-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-size-select {
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  font-size: 12px;
  font-weight: 500;
  outline: none;
  cursor: pointer;
}

.page-size-select:focus {
  border-color: var(--color-primary);
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.page-btn:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-hover, var(--color-border));
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-btn.active {
  background-color: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
  font-weight: 600;
}

.page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 32px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

@media (max-width: 640px) {
  .pagination-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .pagination-actions {
    justify-content: space-between;
  }
}
</style>
