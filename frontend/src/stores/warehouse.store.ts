import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Warehouse } from '../types';
import { warehouseService } from '../services/catalog.service';

export const useWarehouseStore = defineStore('warehouse', () => {
  const warehouses = ref<Warehouse[]>([]);
  const loading = ref(false);

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
    loading,
    fetchWarehouses,
  };
});
