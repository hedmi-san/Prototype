<script setup lang="ts">
import { computed } from 'vue';
import type { Product } from '../../types';
import AppModal from '../common/AppModal.vue';
import AppButton from '../common/AppButton.vue';
import ProductPriceListDocument from './ProductPriceListDocument.vue';
import ProductCatalogDocument from './ProductCatalogDocument.vue';

interface Props {
  modelValue: boolean;
  documentType: 'price_list' | 'catalog';
  products: Product[];
  scopeText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  documentType: 'price_list',
  products: () => [],
  scopeText: '',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:documentType', type: 'price_list' | 'catalog'): void;
}>();

const modalTitle = computed(() => {
  if (props.documentType === 'price_list') {
    return `Devis / Liste de Vente (${props.products.length} ${props.products.length > 1 ? 'produits' : 'produit'})`;
  }
  return `Catalogue Références Produits (${props.products.length} ${props.products.length > 1 ? 'produits' : 'produit'})`;
});

function handleClose() {
  emit('update:modelValue', false);
}

function handlePrint() {
  window.print();
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    :title="modalTitle"
    max-width="900px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- Format Selector Switcher -->
    <div class="document-modal-toolbar">
      <div class="format-tabs">
        <button
          type="button"
          class="format-tab-btn"
          :class="{ active: documentType === 'price_list' }"
          @click="emit('update:documentType', 'price_list')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Devis & Prix de Vente
        </button>
        <button
          type="button"
          class="format-tab-btn"
          :class="{ active: documentType === 'catalog' }"
          @click="emit('update:documentType', 'catalog')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          Catalogue Références (Simple)
        </button>
      </div>

      <div v-if="scopeText" class="scope-pill">
        {{ scopeText }}
      </div>
    </div>

    <!-- Document Preview Sheet -->
    <div class="document-preview-container">
      <ProductPriceListDocument
        v-if="documentType === 'price_list'"
        :products="products"
      />
      <ProductCatalogDocument
        v-else-if="documentType === 'catalog'"
        :products="products"
      />
    </div>

    <template #footer>
      <AppButton variant="secondary" @click="handleClose">
        Fermer
      </AppButton>
      <AppButton variant="primary" @click="handlePrint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect width="12" height="8" x="6" y="14" />
        </svg>
        Imprimer / Enregistrer PDF (A4)
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
.document-modal-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 4px 8px;
  background-color: var(--color-surface, #f9fafb);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-md, 8px);
}

.format-tabs {
  display: flex;
  gap: 6px;
}

.format-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12.5px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s ease;
}

.format-tab-btn:hover {
  color: var(--color-text-primary, #111827);
  background-color: rgba(0, 0, 0, 0.04);
}

.format-tab-btn.active {
  background-color: #ffffff;
  color: var(--color-primary, #2563eb);
  border-color: var(--color-border, #e5e7eb);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.scope-pill {
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
  padding: 4px 10px;
  background-color: #f3f4f6;
  border-radius: 9999px;
}

.document-preview-container {
  max-height: 65vh;
  overflow-y: auto;
  padding: 12px;
  background-color: #e5e7eb;
  border-radius: 8px;
  display: flex;
  justify-content: center;
}
</style>
