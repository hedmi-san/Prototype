<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useClientStore } from '../../stores/client.store';
import { clientService } from '../../services/client.service';
import type { Client } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  modelValue?: number | null;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  maxResults?: number;
  autoSelectDefault?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  placeholder: 'Rechercher un client (nom, code, téléphone)...',
  disabled: false,
  required: false,
  maxResults: 10,
  autoSelectDefault: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | null): void;
  (e: 'select', client: Client | null): void;
}>();

const clientStore = useClientStore();

const comboboxRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');
const isOpen = ref(false);
const highlightedIndex = ref(-1);
const isFocused = ref(false);
const searchResults = ref<Client[]>([]);
const isSearchingRemote = ref(false);

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
  width: '340px',
  zIndex: 99999,
});

let debounceTimer: any = null;

onMounted(async () => {
  if (!clientStore.clients.length) {
    await clientStore.fetchClients({ limit: 100, activeOnly: true });
  }

  if (props.autoSelectDefault && !props.modelValue && clientStore.clients.length) {
    const defaultCl = clientStore.clients.find((c) => c.isDefault) || clientStore.clients[0];
    if (defaultCl) {
      emit('update:modelValue', defaultCl.id);
      emit('select', defaultCl);
    }
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

function formatClientDisplay(c: Client): string {
  if (c.isDefault) {
    return c.name;
  }
  return `[${c.code}] ${c.name}`;
}

function syncSearchQueryFromModel() {
  if (props.modelValue) {
    const found = clientStore.getClientById(props.modelValue) || searchResults.value.find((c) => c.id === props.modelValue);
    if (found) {
      searchQuery.value = formatClientDisplay(found);
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
  () => clientStore.clients,
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
  const dropdownWidth = Math.max(rect.width, 360);
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

const selectedClient = computed<Client | undefined>(() => {
  if (!props.modelValue) return undefined;
  return clientStore.getClientById(props.modelValue) || searchResults.value.find((c) => c.id === props.modelValue);
});

// Local + remote filtered clients
const displayedClients = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const allKnown = [...clientStore.clients];

  // Merge any remote search results not yet in store
  for (const r of searchResults.value) {
    if (!allKnown.some((c) => c.id === r.id)) {
      allKnown.push(r);
    }
  }

  // If query is empty or matches current selection, return initial top clients (default first)
  if (!q || (selectedClient.value && formatClientDisplay(selectedClient.value).toLowerCase() === q)) {
    return allKnown.slice(0, props.maxResults);
  }

  const tokens = q.split(/\s+/).filter(Boolean);

  const matched = allKnown.filter((c) => {
    const nameLower = c.name.toLowerCase();
    const codeLower = c.code.toLowerCase();
    const phoneLower = (c.phone || '').toLowerCase();
    const emailLower = (c.email || '').toLowerCase();

    return tokens.every(
      (token) =>
        nameLower.includes(token) ||
        codeLower.includes(token) ||
        phoneLower.includes(token) ||
        emailLower.includes(token)
    );
  });

  return matched.slice(0, props.maxResults);
});

function handleInputFocus() {
  if (props.disabled) return;
  isFocused.value = true;
  isOpen.value = true;
  highlightedIndex.value = -1;
  updateDropdownPosition();
  if (inputRef.value && selectedClient.value) {
    inputRef.value.select();
  }
}

function handleInputChange() {
  isOpen.value = true;
  highlightedIndex.value = 0;
  updateDropdownPosition();

  const query = searchQuery.value.trim();
  if (!query && props.modelValue) {
    emit('update:modelValue', null);
    emit('select', null);
  }

  // Trigger debounced remote search if query is at least 2 chars
  clearTimeout(debounceTimer);
  if (query.length >= 2) {
    debounceTimer = setTimeout(async () => {
      isSearchingRemote.value = true;
      try {
        const res = await clientService.getClients({
          search: query,
          limit: 15,
          activeOnly: true,
        });
        searchResults.value = res.items;
      } catch (err) {
        console.error('Failed remote client search', err);
      } finally {
        isSearchingRemote.value = false;
      }
    }, 200);
  }
}

function selectClient(c: Client) {
  searchQuery.value = formatClientDisplay(c);
  isOpen.value = false;
  highlightedIndex.value = -1;
  emit('update:modelValue', c.id);
  emit('select', c);
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

  const listLength = displayedClients.value.length;
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
        selectClient(displayedClients.value[highlightedIndex.value]);
      }
      break;
    case 'Tab':
      if (highlightedIndex.value >= 0 && highlightedIndex.value < listLength) {
        selectClient(displayedClients.value[highlightedIndex.value]);
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
  <div ref="comboboxRef" class="app-client-combobox">
    <div :class="['combobox-input-wrapper', { 'is-open': isOpen, 'has-value': !!modelValue, 'is-disabled': disabled }]">
      <span class="search-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </span>
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
        title="Effacer le client sélectionné"
        tabindex="-1"
        @click="clearSelection"
      >
        &times;
      </button>
    </div>

    <!-- Floating Dropdown Teleported to Body -->
    <Teleport to="body">
      <div
        v-if="isOpen && !disabled"
        ref="dropdownRef"
        class="client-floating-dropdown"
        :style="dropdownStyle"
      >
        <div v-if="displayedClients.length === 0" class="dropdown-empty">
          <span v-if="isSearchingRemote">Recherche des comptes clients...</span>
          <span v-else>Aucun client trouvé pour "{{ searchQuery }}"</span>
        </div>

        <ul v-else class="dropdown-list" role="listbox">
          <li
            v-for="(client, idx) in displayedClients"
            :key="client.id"
            :class="[
              'dropdown-item',
              {
                'is-highlighted': idx === highlightedIndex,
                'is-selected': client.id === modelValue,
              },
            ]"
            role="option"
            :aria-selected="client.id === modelValue"
            @mousedown.prevent="selectClient(client)"
            @mouseenter="highlightedIndex = idx"
          >
            <div class="item-main">
              <div class="item-header">
                <span class="client-code-tag">{{ client.code }}</span>
                <strong class="client-name">{{ client.name }}</strong>
                <span v-if="client.isDefault" class="default-badge">Comptoir</span>
              </div>
              <div class="item-footer">
                <span class="client-phone">
                  {{ client.phone || client.email || 'Sans contact' }}
                </span>
                <span
                  :class="[
                    'client-balance-tag',
                    client.currentBalance > 0 ? 'debt' : (client.currentBalance < 0 ? 'credit' : 'settled')
                  ]"
                >
                  <span class="bal-label">Solde :</span>
                  <strong>{{ formatCurrency(client.currentBalance) }}</strong>
                  <span v-if="client.currentBalance > 0" class="bal-status">(Dû)</span>
                  <span v-else-if="client.currentBalance < 0" class="bal-status">(Avance)</span>
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
.app-client-combobox {
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
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  pointer-events: none;
  user-select: none;
}

.combobox-input {
  width: 100%;
  height: 100%;
  padding: 8px 32px 8px 34px;
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
/* Global floating dropdown styles for teleported client list */
.client-floating-dropdown {
  box-sizing: border-box;
  max-height: 320px;
  overflow-y: auto;
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08);
  font-family: inherit;
  animation: client-fade 0.15s ease-out;
}

@keyframes client-fade {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.client-floating-dropdown .dropdown-empty {
  padding: 16px 20px;
  font-size: 13px;
  color: #64748b;
  text-align: center;
}

.client-floating-dropdown .dropdown-list {
  list-style: none;
  margin: 0;
  padding: 6px;
}

.client-floating-dropdown .dropdown-item {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.1s ease;
  border-bottom: 1px solid #f1f5f9;
}

.client-floating-dropdown .dropdown-item:last-child {
  border-bottom: none;
}

.client-floating-dropdown .dropdown-item:hover,
.client-floating-dropdown .dropdown-item.is-highlighted {
  background-color: #f1f5f9;
}

.client-floating-dropdown .dropdown-item.is-selected {
  background-color: rgba(59, 130, 246, 0.08);
  border-left: 3px solid #3b82f6;
}

.client-floating-dropdown .item-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.client-floating-dropdown .item-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  line-height: 1.3;
  flex-wrap: wrap;
}

.client-floating-dropdown .client-code-tag {
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  padding: 2px 6px;
  border-radius: 4px;
}

.client-floating-dropdown .client-name {
  color: #0f172a;
  font-weight: 600;
}

.client-floating-dropdown .default-badge {
  font-size: 10px;
  background: #e2e8f0;
  color: #475569;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.client-floating-dropdown .item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  margin-top: 2px;
}

.client-floating-dropdown .client-phone {
  color: #64748b;
  font-size: 11px;
}

.client-floating-dropdown .client-balance-tag {
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
}

.client-floating-dropdown .client-balance-tag.debt {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.client-floating-dropdown .client-balance-tag.credit {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.client-floating-dropdown .client-balance-tag.settled {
  background: #f1f5f9;
  color: #64748b;
}

.client-floating-dropdown .bal-label {
  opacity: 0.8;
}

.client-floating-dropdown .bal-status {
  font-weight: 600;
}
</style>
