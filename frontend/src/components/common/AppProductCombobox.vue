<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useProductStore } from '../../stores/product.store';
import type { Product, Stock } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';

interface Props {
  modelValue?: number | null;
  warehouseStock?: Stock[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxResults?: number;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  warehouseStock: () => [],
  placeholder: 'Rechercher un produit (nom ou référence)...',
  disabled: false,
  required: false,
  maxResults: 8,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | null): void;
  (e: 'select', product: Product | null): void;
}>();

const productStore = useProductStore();

const comboboxRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');
const isOpen = ref(false);
const highlightedIndex = ref(-1);
const isFocused = ref(false);

onMounted(async () => {
  if (!productStore.products.length) {
    await productStore.fetchProducts();
  }
  syncSearchQueryFromModel();
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

function formatProductDisplay(p: Product): string {
  return `[${p.reference}] ${p.name}${p.brand ? ` (${p.brand})` : ''}`;
}

function syncSearchQueryFromModel() {
  if (props.modelValue) {
    const found = productStore.getProductById(props.modelValue);
    if (found) {
      searchQuery.value = formatProductDisplay(found);
      return;
    }
  }
  searchQuery.value = '';
}

watch(
  () => props.modelValue,
  () => {
    if (!isFocused.value) {
      syncSearchQueryFromModel();
    }
  }
);

watch(
  () => productStore.products,
  () => {
    if (!isFocused.value && props.modelValue) {
      syncSearchQueryFromModel();
    }
  },
  { deep: true }
);

const selectedProduct = computed<Product | undefined>(() => {
  if (!props.modelValue) return undefined;
  return productStore.getProductById(props.modelValue);
});

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const all = productStore.products;

  // If query is empty or matches the currently selected product exactly, show initial top items
  if (!q || (selectedProduct.value && formatProductDisplay(selectedProduct.value).toLowerCase() === q)) {
    return all.slice(0, props.maxResults);
  }

  // Split query terms for multi-keyword matching
  const tokens = q.split(/\s+/).filter(Boolean);

  const matched = all.filter((p) => {
    const refLower = p.reference.toLowerCase();
    const nameLower = p.name.toLowerCase();
    const brandLower = (p.brand || '').toLowerCase();
    const categoryLower = (p.category || '').toLowerCase();

    return tokens.every(
      (token) =>
        refLower.includes(token) ||
        nameLower.includes(token) ||
        brandLower.includes(token) ||
        categoryLower.includes(token)
    );
  });

  return matched.slice(0, props.maxResults);
});

function getStockInfo(productId: number) {
  const stock = props.warehouseStock.find((s) => s.productId === productId);
  const qty = stock ? stock.availableQuantity : 0;
  const product = productStore.getProductById(productId);
  const minAlert = product?.minStockAlert ?? 5;

  if (qty <= 0) {
    return {
      quantity: 0,
      badgeClass: 'stock-out',
      label: '0 unité (Rupture)',
      icon: '🔴',
    };
  }
  if (qty <= minAlert) {
    return {
      quantity: qty,
      badgeClass: 'stock-low',
      label: `${formatNumber(qty)} unités (Faible)`,
      icon: '🟡',
    };
  }
  return {
    quantity: qty,
    badgeClass: 'stock-ok',
    label: `${formatNumber(qty)} unités`,
    icon: '🟢',
  };
}

function handleInputFocus() {
  if (props.disabled) return;
  isFocused.value = true;
  isOpen.value = true;
  highlightedIndex.value = -1;
  // If product is already selected, select text for quick replacement
  if (inputRef.value && selectedProduct.value) {
    inputRef.value.select();
  }
}

function handleInputChange() {
  isOpen.value = true;
  highlightedIndex.value = 0;
  // If user clears the input completely, reset selection
  if (!searchQuery.value.trim() && props.modelValue) {
    emit('update:modelValue', null);
    emit('select', null);
  }
}

function selectProduct(p: Product) {
  searchQuery.value = formatProductDisplay(p);
  isOpen.value = false;
  highlightedIndex.value = -1;
  emit('update:modelValue', p.id);
  emit('select', p);
}

function clearSelection(event?: Event) {
  if (event) {
    event.stopPropagation();
  }
  searchQuery.value = '';
  isOpen.value = false;
  highlightedIndex.value = -1;
  emit('update:modelValue', null);
  emit('select', null);
  nextTick(() => {
    inputRef.value?.focus();
  });
}

function handleKeyDown(event: KeyboardEvent) {
  if (props.disabled) return;

  if (!isOpen.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
      isOpen.value = true;
      event.preventDefault();
    }
    return;
  }

  const listLength = filteredProducts.value.length;
  if (!listLength) {
    if (event.key === 'Escape') {
      isOpen.value = false;
    }
    return;
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      highlightedIndex.value = (highlightedIndex.value + 1) % listLength;
      break;
    case 'ArrowUp':
      event.preventDefault();
      highlightedIndex.value = (highlightedIndex.value - 1 + listLength) % listLength;
      break;
    case 'Enter':
      event.preventDefault();
      if (highlightedIndex.value >= 0 && highlightedIndex.value < listLength) {
        selectProduct(filteredProducts.value[highlightedIndex.value]);
      }
      break;
    case 'Tab':
      if (highlightedIndex.value >= 0 && highlightedIndex.value < listLength) {
        selectProduct(filteredProducts.value[highlightedIndex.value]);
      }
      isOpen.value = false;
      break;
    case 'Escape':
      event.preventDefault();
      isOpen.value = false;
      highlightedIndex.value = -1;
      syncSearchQueryFromModel();
      break;
  }
}

function handleClickOutside(event: MouseEvent) {
  if (comboboxRef.value && !comboboxRef.value.contains(event.target as Node)) {
    isOpen.value = false;
    isFocused.value = false;
    highlightedIndex.value = -1;
    syncSearchQueryFromModel();
  }
}
</script>

<template>
  <div ref="comboboxRef" class="app-product-combobox">
    <div :class="['combobox-input-wrapper', { 'is-open': isOpen, 'has-value': !!modelValue, 'is-disabled': disabled }]">
      <span class="search-icon">🔍</span>
      <input
        ref="inputRef"
        v-model="searchQuery"
        type="text"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required && !modelValue"
        class="combobox-input"
        autocomplete="off"
        spellcheck="false"
        @focus="handleInputFocus"
        @input="handleInputChange"
        @keydown="handleKeyDown"
      />
      <button
        v-if="modelValue && !disabled"
        type="button"
        class="clear-btn"
        title="Effacer la sélection"
        tabindex="-1"
        @click="clearSelection"
      >
        &times;
      </button>
    </div>

    <!-- Floating Dropdown Menu -->
    <div v-if="isOpen && !disabled" class="combobox-dropdown">
      <div v-if="filteredProducts.length === 0" class="dropdown-empty">
        Aucun produit trouvé pour "{{ searchQuery }}"
      </div>

      <ul v-else class="dropdown-list" role="listbox">
        <li
          v-for="(product, idx) in filteredProducts"
          :key="product.id"
          :class="[
            'dropdown-item',
            {
              'is-highlighted': idx === highlightedIndex,
              'is-selected': product.id === modelValue,
            },
          ]"
          role="option"
          :aria-selected="product.id === modelValue"
          @mousedown.prevent="selectProduct(product)"
          @mouseenter="highlightedIndex = idx"
        >
          <div class="item-primary">
            <div class="item-title">
              <span class="product-ref font-mono">[{{ product.reference }}]</span>
              <span class="product-name">{{ product.name }}</span>
              <span v-if="product.brand" class="product-brand">({{ product.brand }})</span>
            </div>
            <div class="item-meta">
              <span class="item-price font-mono">{{ formatCurrency(product.salePrice) }}</span>
              <span v-if="warehouseStock.length" :class="['item-stock', getStockInfo(product.id).badgeClass]">
                {{ getStockInfo(product.id).icon }} {{ getStockInfo(product.id).label }}
              </span>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.app-product-combobox {
  position: relative;
  width: 100%;
  font-family: var(--font-sans);
}

.combobox-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 36px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.combobox-input-wrapper:focus-within,
.combobox-input-wrapper.is-open {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.combobox-input-wrapper.is-disabled {
  background-color: var(--color-surface);
  cursor: not-allowed;
  opacity: 0.7;
}

.search-icon {
  position: absolute;
  left: 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
  pointer-events: none;
  user-select: none;
}

.combobox-input {
  width: 100%;
  height: 100%;
  padding: 8px 32px 8px 32px;
  font-size: 13px;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  outline: none;
}

.combobox-input:disabled {
  cursor: not-allowed;
  color: var(--color-text-secondary);
}

.clear-btn {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 16px;
  line-height: 1;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.clear-btn:hover {
  background-color: var(--color-surface-hover);
  color: var(--color-danger);
}

.combobox-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 360px;
  width: 100%;
  max-width: 540px;
  z-index: 9999;
  max-height: 290px;
  overflow-y: auto;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 14px 35px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.12);
}

.dropdown-empty {
  padding: 14px 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
}

.dropdown-list {
  list-style: none;
  margin: 0;
  padding: 4px;
}

.dropdown-item {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.dropdown-item:hover,
.dropdown-item.is-highlighted {
  background-color: var(--color-surface-hover);
}

.dropdown-item.is-selected {
  background-color: rgba(59, 130, 246, 0.08);
}

.item-primary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
  line-height: 1.3;
}

.product-ref {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary);
}

.product-name {
  font-weight: 600;
  color: var(--color-text-primary);
}

.product-brand {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.item-price {
  font-weight: 600;
  color: var(--color-text-primary);
}

.item-stock {
  font-size: 11px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.stock-ok {
  color: var(--color-success);
}

.stock-low {
  color: var(--color-warning);
}

.stock-out {
  color: var(--color-danger);
  font-weight: 600;
}
</style>
