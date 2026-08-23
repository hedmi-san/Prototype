import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Warehouse } from '../types';
import { warehouseService } from '../services/catalog.service';

export const useWarehouseStore = defineStore('warehouse', () => {
  const warehouses = ref<Warehouse[]>([]);
  const loading = ref(false);

  const activeWarehouses = computed(() => warehouses.value.filter(w => w.active));
  const allWarehousesFormatted = computed(() =>
    warehouses.value.map(w => ({
      ...w,
      label: w.active ? w.name : `${w.name} (Inactif)`,
    }))
  );

  async function fetchWarehouses() {
    loading.value = true;
    try {
      warehouses.value = await warehouseService.getWarehouses();
    } finally {
      loading.value = false;
    }
  }

  return {
    warehouses,
    activeWarehouses,
    allWarehousesFormatted,
    loading,
    fetchWarehouses,
  };
});
