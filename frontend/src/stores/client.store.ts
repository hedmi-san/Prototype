import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Client, ClientKPIs } from '../types';
import { clientService, type ClientQueryParams } from '../services/client.service';

export const useClientStore = defineStore('client', () => {
  const clients = ref<Client[]>([]);
  const kpis = ref<ClientKPIs>({
    totalClients: 0,
    totalDebtors: 0,
    totalDebt: 0,
    totalAdvance: 0,
  });
  const loading = ref(false);
  const lastFetched = ref<number | null>(null);

  const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

  async function fetchClients(params?: ClientQueryParams, force = false) {
    const isCacheValid = lastFetched.value && (Date.now() - lastFetched.value < CACHE_TTL);
    if (!force && clients.value.length > 0 && isCacheValid && !params?.search && !params?.balanceFilter) {
      return clients.value;
    }

    loading.value = true;
    try {
      const res = await clientService.getClients(params || { limit: 500, activeOnly: true });
      clients.value = res.items;
      if (res.kpis) {
        kpis.value = res.kpis;
      }
      lastFetched.value = Date.now();
      return clients.value;
    } finally {
      loading.value = false;
    }
  }

  async function fetchKpis() {
    try {
      const res = await clientService.getClientKpis();
      kpis.value = res;
      return res;
    } catch (err) {
      console.error('Failed to fetch client KPIs', err);
    }
  }

  function getClientById(id: number): Client | undefined {
    return clients.value.find((c) => c.id === id);
  }

  return {
    clients,
    kpis,
    loading,
    lastFetched,
    fetchClients,
    fetchKpis,
    getClientById,
  };
});
