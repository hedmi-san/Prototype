import api from './api';
import type { ApiResponse, Warehouse, Product, ProductQueryParams, PaginatedData } from '../types';
import { downloadCsvResponse } from '../utils/export';

function normalizePaginatedResponse<T>(data: any): PaginatedData<T> {
  if (data && typeof data === 'object' && Array.isArray(data.items) && data.pagination) {
    return data as PaginatedData<T>;
  }
  const items = Array.isArray(data) ? data : [];
  return {
    items,
    pagination: {
      page: 1,
      limit: items.length || 25,
      total: items.length,
      totalPages: 1,
    },
  };
}

export const warehouseService = {
  async getWarehouses(): Promise<Warehouse[]> {
    const response = await api.get<ApiResponse<Warehouse[]>>('/warehouses');
    return response.data.data;
  },
  async getWarehouseById(id: number): Promise<Warehouse> {
    const response = await api.get<ApiResponse<Warehouse>>(`/warehouses/${id}`);
    return response.data.data;
  },
  async createWarehouse(data: Partial<Warehouse>): Promise<Warehouse> {
    const response = await api.post<ApiResponse<Warehouse>>('/warehouses', data);
    return response.data.data;
  },
  async updateWarehouse(id: number, data: Partial<Warehouse>): Promise<Warehouse> {
    const response = await api.put<ApiResponse<Warehouse>>(`/warehouses/${id}`, data);
    return response.data.data;
  }
};

function formatQueryParams(params?: ProductQueryParams): Record<string, any> | undefined {
  if (!params) return undefined;
  const copy: Record<string, any> = { ...params };
  if (Array.isArray(copy.ids)) {
    copy.ids = copy.ids.join(',');
  }
  return copy;
}

export const productService = {
  async getProducts(params?: ProductQueryParams): Promise<PaginatedData<Product>> {
    const formattedParams = formatQueryParams(params);
    const response = await api.get<ApiResponse<any>>('/products', { params: formattedParams });
    return normalizePaginatedResponse<Product>(response.data.data);
  },
  async getAllProducts(params?: Omit<ProductQueryParams, 'all'>): Promise<Product[]> {
    const formattedParams = formatQueryParams({ ...params, all: true });
    const response = await api.get<ApiResponse<any>>('/products', { params: formattedParams });
    if (Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return response.data.data?.items || [];
  },
  async getBrands(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/products/brands');
    return response.data.data || [];
  },
  async getProductById(id: number): Promise<Product> {
    const response = await api.get<ApiResponse<Product>>(`/products/${id}`);
    return response.data.data;
  },
  async createProduct(data: Partial<Product>): Promise<Product> {
    const response = await api.post<ApiResponse<Product>>('/products', data);
    return response.data.data;
  },
  async updateProduct(id: number, data: Partial<Product>): Promise<Product> {
    const response = await api.put<ApiResponse<Product>>(`/products/${id}`, data);
    return response.data.data;
  },
  async updatePrice(id: number, data: { purchasePrice?: number; salePrice?: number }): Promise<Product> {
    const response = await api.patch<ApiResponse<Product>>(`/products/${id}/price`, data);
    return response.data.data;
  },
  async exportProductsCsv(params?: { search?: string; brand?: string; ids?: number[] | string }): Promise<void> {
    const queryParams: Record<string, any> = { ...params };
    if (Array.isArray(params?.ids)) {
      queryParams.ids = params.ids.join(',');
    }
    const response = await api.get('/products/export/csv', {
      params: queryParams,
      responseType: 'blob',
    });
    downloadCsvResponse(response, `produits_${new Date().toISOString().split('T')[0]}.csv`);
  }
};


