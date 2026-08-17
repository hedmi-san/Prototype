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
}

withDefaults(defineProps<Props>(), {
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'primary',
  loading: false,
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
    <p class="confirm-message">{{ message }}</p>
    <template #footer>
      <AppButton variant="secondary" :disabled="loading" @click="onCancel">
        {{ cancelText }}
      </AppButton>
      <AppButton :variant="variant" :loading="loading" @click="onConfirm">
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
</style>
