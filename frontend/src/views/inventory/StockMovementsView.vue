<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../../stores/auth.store';
import { inventoryService } from '../../services/operations.service';
import type { StockMovement } from '../../types';
import { formatDateTime, formatNumber, formatMovementType } from '../../utils/formatters';
import AppTable from '../../components/common/AppTable.vue';
import AppBadge from '../../components/common/AppBadge.vue';

const authStore = useAuthStore();
const movements = ref<StockMovement[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const typeFilter = ref('');

onMounted(async () => {
  await fetchMovements();
});

async function fetchMovements() {
  loading.value = true;
  try {
    movements.value = await inventoryService.getMovements(authStore.activeWarehouseId || undefined);
  } catch (err) {
    console.error('Failed to load movements', err);
  } finally {
    loading.value = false;
  }
}

const filteredMovements = computed(() => {
  return movements.value.filter((m) => {
    const matchesType = !typeFilter.value || m.type === typeFilter.value;
    if (!matchesType) return false;

    if (!searchQuery.value.trim()) return true;
    const q = searchQuery.value.toLowerCase();
    return (
      m.productName.toLowerCase().includes(q) ||
      m.productReference.toLowerCase().includes(q) ||
      m.warehouseName.toLowerCase().includes(q) ||
      (m.reason && m.reason.toLowerCase().includes(q)) ||
      (m.createdByName && m.createdByName.toLowerCase().includes(q))
    );
  });
});

function getBadgeVariant(type: string): 'neutral' | 'success' | 'danger' | 'warning' | 'info' {
  switch (type) {
    case 'INITIAL_STOCK': return 'info';
    case 'SALE': return 'danger';
    case 'TRANSFER_IN': return 'success';
    case 'TRANSFER_OUT': return 'warning';
    case 'ADJUSTMENT': return 'neutral';
    default: return 'neutral';
  }
}
</script>

<template>
  <div class="movements-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Grand Livre des Mouvements de Stock</h1>
        <p class="text-muted">Journal d'audit exhaustif des entrées, sorties et ajustements de stock</p>
      </div>
      <div class="header-actions">
        <button class="refresh-btn" @click="fetchMovements">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Actualiser
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Rechercher par produit, référence, entrepôt, motif, utilisateur..."
          class="search-input"
        />
      </div>

      <div class="type-filter">
        <select v-model="typeFilter" class="filter-select">
          <option value="">Tous les types de mouvement</option>
          <option value="INITIAL_STOCK">Stock initial</option>
          <option value="SALE">Sortie Vente</option>
          <option value="TRANSFER_IN">Transfert entrant</option>
          <option value="TRANSFER_OUT">Transfert sortant</option>
          <option value="ADJUSTMENT">Ajustement inventaire</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <AppTable :loading="loading" :empty="!filteredMovements.length" empty-text="Aucun mouvement de stock trouvé" :columns-count="7">
      <template #header>
        <th>Date & Heure</th>
        <th>Entrepôt</th>
        <th>Produit</th>
        <th>Type</th>
        <th>Quantité Delta</th>
        <th>Motif / Référence</th>
        <th>Enregistré par</th>
      </template>
      <template #body>
        <tr v-for="m in filteredMovements" :key="m.id">
          <td class="font-mono text-caption">{{ formatDateTime(m.createdAt) }}</td>
          <td>
            <strong>{{ m.warehouseName }}</strong>
          </td>
          <td>
            <strong>{{ m.productName }}</strong>
            <span class="text-caption font-mono" style="display: block;">{{ m.productReference }}</span>
          </td>
          <td>
            <AppBadge :variant="getBadgeVariant(m.type)" size="sm">
              {{ formatMovementType(m.type) }}
            </AppBadge>
          </td>
          <td :class="['font-mono', 'font-bold', m.quantity > 0 ? 'text-success' : 'text-danger']">
            {{ m.quantity > 0 ? '+' : '' }}{{ formatNumber(m.quantity) }}
          </td>
          <td>
            <div class="reason-cell">
              <span class="reason-text">{{ m.reason || '—' }}</span>
              <span v-if="m.referenceType" class="text-caption text-muted">Réf : {{ m.referenceType }} #{{ m.referenceId || '' }}</span>
            </div>
          </td>
          <td>
            <span class="text-caption">{{ m.createdByName || 'Système' }}</span>
          </td>
        </tr>
      </template>
    </AppTable>
  </div>
</template>

<style scoped>
.movements-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 480px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

.search-input, .filter-select {
  height: 38px;
  padding: 8px 12px;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  outline: none;
  transition: all var(--transition-fast);
}

.search-input {
  width: 100%;
  padding-left: 36px;
}

.search-input:focus, .filter-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.font-bold {
  font-weight: 600;
}

.text-success {
  color: var(--color-success);
}

.text-danger {
  color: var(--color-danger);
}

.reason-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  color: var(--color-text-primary);
  transition: all var(--transition-fast);
}

.refresh-btn:hover {
  background-color: var(--color-surface-hover);
}
</style>
