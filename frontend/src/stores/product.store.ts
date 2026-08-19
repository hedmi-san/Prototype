import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Product } from '../types';
import { productService } from '../services/catalog.service';

export const useProductStore = defineStore('product', () => {
  const products = ref<Product[]>([]);
  const loading = ref(false);
  const lastFetched = ref<number | null>(null);

  // Cache duration: 5 minutes
  const CACHE_TTL = 5 * 60 * 1000;

  async function fetchProducts(force = false) {
    const isCacheValid = lastFetched.value && (Date.now() - lastFetched.value < CACHE_TTL);
    if (!force && products.value.length > 0 && isCacheValid) {
      return products.value;
    }

    loading.value = true;
    try {
      products.value = await productService.getProducts();
      lastFetched.value = Date.now();
      return products.value;
    } finally {
      loading.value = false;
    }
  }

  function getProductById(id: number): Product | undefined {
    return products.value.find((p) => p.id === id);
  }

  return {
    products,
    loading,
    lastFetched,
    fetchProducts,
    getProductById,
  };
});
