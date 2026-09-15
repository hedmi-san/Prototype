<script setup lang="ts">
import type { Transfer } from '../../types';
import AppModal from '../common/AppModal.vue';
import AppButton from '../common/AppButton.vue';
import TransportSlipDocument from './TransportSlipDocument.vue';

interface Props {
  modelValue: boolean;
  transfer: Transfer | any | null;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
}>();

function handleClose() {
  emit('update:modelValue', false);
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    :title="`Bon de Transport — ${transfer?.transferNumber || ('#TRF-' + (transfer?.id || ''))}`"
    max-width="880px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="transfer" class="slip-modal-content">
      <TransportSlipDocument :transfer="transfer" />
    </div>

    <template #footer>
      <div class="modal-footer-box">
        <AppButton variant="secondary" @click="handleClose">Fermer</AppButton>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.slip-modal-content {
  padding: 8px 0;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-footer-box {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style>
