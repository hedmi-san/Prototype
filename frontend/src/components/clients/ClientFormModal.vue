<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Client } from '../../types';
import { clientService, type CreateClientDto, type UpdateClientDto } from '../../services/client.service';
import { useWarehouseStore } from '../../stores/warehouse.store';
import AppModal from '../common/AppModal.vue';
import AppButton from '../common/AppButton.vue';

interface Props {
  modelValue: boolean;
  client?: Client | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'saved', client: Client): void;
}>();

const warehouseStore = useWarehouseStore();

const code = ref('');
const name = ref('');
const phone = ref('');
const email = ref('');
const address = ref('');
const openingBalance = ref<number>(0);
const selectedWarehouseId = ref<number>(warehouseStore.warehouses[0]?.id || 1);
const active = ref(true);

const submitting = ref(false);
const errorMessage = ref('');

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      errorMessage.value = '';
      submitting.value = false;
      if (props.client) {
        code.value = props.client.code;
        name.value = props.client.name;
        phone.value = props.client.phone || '';
        email.value = props.client.email || '';
        address.value = props.client.address || '';
        openingBalance.value = props.client.openingBalance;
        active.value = props.client.active;
      } else {
        code.value = '';
        name.value = '';
        phone.value = '';
        email.value = '';
        address.value = '';
        openingBalance.value = 0;
        active.value = true;
      }
    }
  }
);

async function submitForm() {
  errorMessage.value = '';
  if (!name.value.trim()) {
    errorMessage.value = 'Le nom du client ou de l’entreprise est obligatoire.';
    return;
  }

  submitting.value = true;
  try {
    if (props.client) {
      const updateData: UpdateClientDto = {
        name: name.value.trim(),
        phone: phone.value.trim() || undefined,
        email: email.value.trim() || undefined,
        address: address.value.trim() || undefined,
        active: active.value,
      };
      const updated = await clientService.updateClient(props.client.id, updateData);
      emit('saved', updated);
    } else {
      const createData: CreateClientDto = {
        code: code.value.trim() || undefined,
        name: name.value.trim(),
        phone: phone.value.trim() || undefined,
        email: email.value.trim() || undefined,
        address: address.value.trim() || undefined,
        openingBalance: Number(openingBalance.value) || 0,
        warehouseId: selectedWarehouseId.value,
      };
      const created = await clientService.createClient(createData);
      emit('saved', created);
    }
    emit('update:modelValue', false);
  } catch (err: any) {
    errorMessage.value = err.response?.data?.message || err.message || "Erreur lors de l'enregistrement du client";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    :title="props.client ? 'Modifier les Informations du Client' : 'Ajouter un Nouveau Client'"
    max-width="560px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="client-form">
      <div v-if="errorMessage" class="error-banner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ errorMessage }}</span>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Code Client (Optionnel)</label>
          <input
            v-model="code"
            type="text"
            placeholder="Auto: CLT-0001"
            :disabled="!!props.client"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Nom / Raison Sociale *</label>
          <input
            v-model="name"
            type="text"
            placeholder="Ex: SARL Bâtiment Pro Alger"
            class="form-input"
          />
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Téléphone</label>
          <input
            v-model="phone"
            type="text"
            placeholder="Ex: +213 550 12 34 56"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Email</label>
          <input
            v-model="email"
            type="email"
            placeholder="contact@entreprise.dz"
            class="form-input"
          />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Adresse / Localisation</label>
        <textarea
          v-model="address"
          rows="2"
          placeholder="Ex: Zone Industrielle Oued Smar, Alger"
          class="form-textarea"
        ></textarea>
      </div>

      <!-- Opening balance (only on create) -->
      <div v-if="!props.client" class="form-grid-2 opening-section">
        <div class="form-group">
          <label class="form-label">Solde Initial Antérieur (DZD)</label>
          <input
            v-model.number="openingBalance"
            type="number"
            step="any"
            placeholder="0.00 (Positif = Dette, Négatif = Avance)"
            class="form-input"
          />
          <span class="help-text">Dette existante avant l'utilisation du système</span>
        </div>

        <div v-if="openingBalance !== 0" class="form-group">
          <label class="form-label">Dépôt d'affectation initial</label>
          <select v-model="selectedWarehouseId" class="form-select">
            <option v-for="w in warehouseStore.warehouses" :key="w.id" :value="w.id">
              {{ w.name }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="props.client" class="form-group form-checkbox-group">
        <label class="checkbox-label">
          <input v-model="active" type="checkbox" />
          <span>Client Actif (Autorisé aux transactions)</span>
        </label>
      </div>
    </div>

    <template #footer>
      <AppButton variant="secondary" :disabled="submitting" @click="emit('update:modelValue', false)">
        Annuler
      </AppButton>
      <AppButton variant="primary" :loading="submitting" @click="submitForm">
        {{ props.client ? 'Mettre à jour' : 'Créer le Client' }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.client-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-danger-subtle, rgba(239, 68, 68, 0.1));
  color: var(--color-danger, #ef4444);
  border: 1px solid var(--color-danger-border, rgba(239, 68, 68, 0.3));
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 13px;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--color-primary);
}

.form-input:disabled {
  background: var(--color-surface);
  cursor: not-allowed;
  opacity: 0.7;
}

.help-text {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.opening-section {
  background: var(--color-bg-subtle, rgba(0, 0, 0, 0.02));
  padding: 10px;
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
}

.form-checkbox-group {
  margin-top: 4px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-primary);
}
</style>
