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
}

withDefaults(defineProps<Props>(), {
  confirmText: 'Confirmer',
  cancelText: 'Annuler',
  variant: 'primary',
  loading: false,
  hideConfirm: false,
  error: '',
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
    max-width="440px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="error" class="confirm-error-banner">
      {{ error }}
    </div>
    <p class="confirm-message">{{ message }}</p>
    <template #footer>
      <AppButton variant="secondary" :disabled="loading" @click="onCancel">
        {{ cancelText }}
      </AppButton>
      <AppButton v-if="!hideConfirm" :variant="variant" :loading="loading" @click="onConfirm">
        {{ confirmText }}
      </AppButton>
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
</style>
