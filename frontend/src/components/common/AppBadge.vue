<script setup lang="ts">
interface Props {
  variant?: 'neutral' | 'success' | 'danger' | 'warning' | 'info';
  size?: 'sm' | 'md';
}

withDefaults(defineProps<Props>(), {
  variant: 'neutral',
  size: 'md',
});
</script>

<template>
  <span :class="['app-badge', `badge-${variant}`, `badge-${size}`]">
    <slot />
  </span>
</template>

<style scoped>
.app-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  line-height: 1;
  white-space: nowrap;
}

.badge-sm {
  padding: 3px 6px;
  font-size: 11px;
}

.badge-md {
  padding: 4px 8px;
  font-size: 12px;
}

.badge-neutral {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.badge-success {
  background-color: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.badge-danger {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.badge-warning {
  background-color: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.badge-info {
  background-color: var(--color-info-bg);
  color: var(--color-info);
  border: 1px solid var(--color-info-border);
}
</style>
