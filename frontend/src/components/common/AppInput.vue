<script setup lang="ts">
interface Props {
  modelValue: string | number;
  label?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  hint?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  required: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
}>();

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', props.type === 'number' ? (target.value === '' ? '' : Number(target.value)) : target.value);
}
</script>

<template>
  <div class="app-input-group">
    <label v-if="label" class="input-label">
      {{ label }}
      <span v-if="required" class="required-star">*</span>
    </label>
    <div class="input-wrapper">
      <input
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :class="['app-input', { 'has-error': !!error }]"
        @input="onInput"
      />
    </div>
    <span v-if="error" class="input-error">{{ error }}</span>
    <span v-else-if="hint" class="input-hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.app-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.input-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.required-star {
  color: var(--color-danger);
  margin-left: 2px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.app-input {
  width: 100%;
  height: 38px;
  padding: 8px 12px;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-text-primary);
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.app-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.app-input:disabled {
  background-color: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: not-allowed;
}

.app-input.has-error {
  border-color: var(--color-danger);
}

.app-input.has-error:focus {
  box-shadow: 0 0 0 1px var(--color-danger);
}

.input-error {
  font-size: 11px;
  color: var(--color-danger);
}

.input-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
}
</style>
