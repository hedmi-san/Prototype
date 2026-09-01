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
  maxResults: 10,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | null): void;
  (e: 'select', product: Product | null): void;
}>();

const productStore = useProductStore();

const comboboxRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');
const isOpen = ref(false);
const highlightedIndex = ref(-1);
const isFocused = ref(false);

const dropdownStyle = ref<{
  position: 'fixed';
  top: string;
  left: string;
  width: string;
  zIndex: number;
}>({
  position: 'fixed',
  top: '0px',
  left: '0px',
  width: '380px',
  zIndex: 99999,
});

onMounted(async () => {
  if (!productStore.products.length) {
    await productStore.fetchProducts();
  }
  syncSearchQueryFromModel();
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', handleWindowEvents);
  window.addEventListener('scroll', handleWindowEvents, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', handleWindowEvents);
  window.removeEventListener('scroll', handleWindowEvents, true);
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

watch(isOpen, (open) => {
  if (open) {
    updateDropdownPosition();
  }
});

function updateDropdownPosition() {
  if (!comboboxRef.value) return;
  const rect = comboboxRef.value.getBoundingClientRect();
  const dropdownHeight = 320;
  const spaceBelow = window.innerHeight - rect.bottom;
  const showAbove = spaceBelow < 200 && rect.top > dropdownHeight;

  const top = showAbove ? Math.max(8, rect.top - dropdownHeight - 4) : rect.bottom + 4;
  const dropdownWidth = Math.max(rect.width, 420);
  const maxLeft = window.innerWidth - dropdownWidth - 12;
  const left = Math.max(8, Math.min(rect.left, maxLeft));

  dropdownStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${dropdownWidth}px`,
    zIndex: 99999,
  };
}

function handleWindowEvents() {
  if (isOpen.value) {
    updateDropdownPosition();
  }
}

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

    return tokens.every(
      (token) =>
        refLower.includes(token) ||
        nameLower.includes(token) ||
        brandLower.includes(token)
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
      label: '0 u. (Rupture)',
      icon: '🔴',
    };
  }
  if (qty <= minAlert) {
    return {
      quantity: qty,
      badgeClass: 'stock-low',
      label: `${formatNumber(qty)} u. (Faible)`,
      icon: '🟡',
    };
  }
  return {
    quantity: qty,
    badgeClass: 'stock-ok',
    label: `${formatNumber(qty)} u.`,
    icon: '🟢',
  };
}

function handleInputFocus() {
  if (props.disabled) return;
  isFocused.value = true;
  isOpen.value = true;
  highlightedIndex.value = -1;
  updateDropdownPosition();
  // If product is already selected, select text for quick replacement
  if (inputRef.value && selectedProduct.value) {
    inputRef.value.select();
  }
}

function handleInputChange() {
  isOpen.value = true;
  highlightedIndex.value = 0;
  updateDropdownPosition();
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
      updateDropdownPosition();
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
      scrollToHighlighted();
      break;
    case 'ArrowUp':
      event.preventDefault();
      highlightedIndex.value = (highlightedIndex.value - 1 + listLength) % listLength;
      scrollToHighlighted();
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

function scrollToHighlighted() {
  nextTick(() => {
    if (!dropdownRef.value) return;
    const highlightedEl = dropdownRef.value.querySelector('.is-highlighted') as HTMLElement;
    if (highlightedEl) {
      highlightedEl.scrollIntoView({ block: 'nearest' });
    }
  });
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node;
  const isInsideCombobox = comboboxRef.value && comboboxRef.value.contains(target);
  const isInsideDropdown = dropdownRef.value && dropdownRef.value.contains(target);

  if (!isInsideCombobox && !isInsideDropdown) {
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

    <!-- Teleported Floating Dropdown Menu (No clipping, completely free above tables) -->
    <Teleport to="body">
      <div
        v-if="isOpen && !disabled"
        ref="dropdownRef"
        class="combobox-floating-dropdown"
        :style="dropdownStyle"
      >
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
    </Teleport>
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
  height: 38px;
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
  width: 22px;
  height: 22px;
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
</style>

<style>
/* Global floating dropdown styles to work when teleported to body */
.combobox-floating-dropdown {
  box-sizing: border-box;
  max-height: 320px;
  overflow-y: auto;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08);
  font-family: inherit;
  animation: combobox-fade 0.15s ease-out;
}

@keyframes combobox-fade {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.combobox-floating-dropdown .dropdown-empty {
  padding: 16px 20px;
  font-size: 13px;
  color: #64748b;
  text-align: center;
}

.combobox-floating-dropdown .dropdown-list {
  list-style: none;
  margin: 0;
  padding: 6px;
}

.combobox-floating-dropdown .dropdown-item {
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.1s ease;
  border-bottom: 1px solid #f1f5f9;
}

.combobox-floating-dropdown .dropdown-item:last-child {
  border-bottom: none;
}

.combobox-floating-dropdown .dropdown-item:hover,
.combobox-floating-dropdown .dropdown-item.is-highlighted {
  background-color: #f1f5f9;
}

.combobox-floating-dropdown .dropdown-item.is-selected {
  background-color: rgba(59, 130, 246, 0.08);
  border-left: 3px solid #3b82f6;
}

.combobox-floating-dropdown .item-primary {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.combobox-floating-dropdown .item-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
  line-height: 1.35;
  flex-wrap: wrap;
}

.combobox-floating-dropdown .product-ref {
  font-size: 11px;
  font-weight: 700;
  color: #2563eb;
}

.combobox-floating-dropdown .product-name {
  font-weight: 600;
  color: #0f172a;
}

.combobox-floating-dropdown .product-brand {
  font-size: 12px;
  color: #64748b;
}

.combobox-floating-dropdown .item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  margin-top: 2px;
}

.combobox-floating-dropdown .item-price {
  font-weight: 700;
  color: #0f172a;
}

.combobox-floating-dropdown .item-stock {
  font-size: 11px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.combobox-floating-dropdown .stock-ok {
  color: #10b981;
}

.combobox-floating-dropdown .stock-low {
  color: #f59e0b;
}

.combobox-floating-dropdown .stock-out {
  color: #ef4444;
  font-weight: 600;
}
</style>
