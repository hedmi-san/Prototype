<script setup lang="ts">
import AppModal from './AppModal.vue';
import AppButton from './AppButton.vue';

interface Props {
  modelValue: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
  hideConfirm?: boolean;
  error?: string;
  maxWidth?: string;
}

withDefaults(defineProps<Props>(), {
  confirmText: 'Confirmer',
  cancelText: 'Annuler',
  variant: 'primary',
  loading: false,
  hideConfirm: false,
  error: '',
  maxWidth: '460px',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

function onCancel() {
  emit('update:modelValue', false);
  emit('cancel');
}

function onConfirm() {
  emit('confirm');
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    :title="title"
    :max-width="maxWidth"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="error" class="confirm-error-banner">
      {{ error }}
    </div>
    <p class="confirm-message">{{ message }}</p>
    <template #footer>
      <div class="confirm-footer">
        <AppButton
          class="confirm-btn confirm-btn-cancel"
          variant="secondary"
          :disabled="loading"
          @click="onCancel"
        >
          {{ cancelText }}
        </AppButton>
        <AppButton
          v-if="!hideConfirm"
          class="confirm-btn confirm-btn-action"
          :variant="variant"
          :loading="loading"
          @click="onConfirm"
        >
          {{ confirmText }}
        </AppButton>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.confirm-message {
  font-size: 14px;
  color: var(--color-text-primary);
  line-height: 1.6;
}

.confirm-error-banner {
  padding: 10px 12px;
  border-radius: 6px;
  background-color: var(--color-danger-bg, #fee2e2);
  color: var(--color-danger, #dc2626);
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 12px;
  border: 1px solid var(--color-danger-border, #fca5a5);
}

.confirm-footer {
  display: flex;
  align-items: stretch;
  gap: 12px;
  width: 100%;
  flex: 1 1 100%;
  box-sizing: border-box;
}

.confirm-btn {
  flex: 1 1 0;
  min-width: 0;
  height: auto !important;
  min-height: 42px;
  padding: 8px 12px !important;
  white-space: normal !important;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.confirm-btn :deep(.btn-content) {
  white-space: normal !important;
  text-align: center;
  line-height: 1.35;
  word-break: normal;
  overflow-wrap: break-word;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

@media (max-width: 480px) {
  .confirm-footer {
    flex-direction: column-reverse;
    gap: 10px;
  }

  .confirm-btn {
    width: 100%;
    flex: none;
    min-height: 44px;
  }
}
</style>
