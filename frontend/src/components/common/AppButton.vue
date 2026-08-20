<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
});
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="['app-btn', `btn-${variant}`, `btn-${size}`, { 'is-loading': loading }]"
  >
    <span v-if="loading" class="btn-spinner" />
    <span class="btn-content" :style="{ opacity: loading ? 0 : 1 }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--font-sans);
  font-weight: 500;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  position: relative;
  transition: all var(--transition-fast);
  white-space: nowrap;
  user-select: none;
}

.app-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.app-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* Sizes */
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
  height: 32px;
}

.btn-md {
  padding: 8px 16px;
  font-size: 13px;
  height: 38px;
}

.btn-lg {
  padding: 10px 20px;
  font-size: 14px;
  height: 44px;
}

/* Variants */
.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.btn-secondary {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-surface-hover);
  border-color: var(--color-border-dark);
}

.btn-outline {
  background-color: transparent;
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.btn-outline:hover:not(:disabled) {
  background-color: var(--color-surface);
  border-color: var(--color-border-dark);
}

.btn-danger {
  background-color: var(--color-danger-bg);
  color: var(--color-danger);
  border-color: var(--color-danger-border);
}

.btn-danger:hover:not(:disabled) {
  background-color: #fee;
}

.btn-ghost {
  background-color: transparent;
  color: var(--color-text-secondary);
  border-color: transparent;
}

.btn-ghost:hover:not(:disabled) {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
}

.btn-spinner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
