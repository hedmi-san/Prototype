import api from './api';
import type { ApiResponse, Stock, StockMovement, Sale, Transfer, PaginationParams, PaginatedData } from '../types';
import { downloadCsvResponse } from '../utils/export';

function normalizeParams(params?: PaginationParams | number): Record<string, any> {
  if (typeof params === 'number') {
    return { warehouseId: params };
  }
  return params || {};
}

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

export const inventoryService = {
  async getStock(warehouseId?: number): Promise<Stock[]> {
    const params = warehouseId ? { warehouseId } : {};
    const response = await api.get<ApiResponse<Stock[]>>('/inventory/stock', { params });
    return response.data.data;
  },
  async getMovements(params?: PaginationParams | number): Promise<PaginatedData<StockMovement>> {
    const queryParams = normalizeParams(params);
    const response = await api.get<ApiResponse<any>>('/inventory/movements', { params: queryParams });
    return normalizePaginatedResponse<StockMovement>(response.data.data);
  },
  async adjustStock(data: { warehouseId: number; productId: number; quantity: number; reason: string }): Promise<Stock> {
    const response = await api.post<ApiResponse<Stock>>('/inventory/adjustments', data);
    return response.data.data;
  },
  async receiveInitialStock(data: { warehouseId: number; productId: number; quantity: number; reference: string; notes?: string }): Promise<Stock> {
    const response = await api.post<ApiResponse<Stock>>('/inventory/initial-receipt', data);
    return response.data.data;
  },
  async exportStockCsv(params?: { warehouseId?: number; lowStock?: boolean; search?: string }): Promise<void> {
    const response = await api.get('/inventory/export/csv', {
      params,
      responseType: 'blob',
    });
    downloadCsvResponse(response, `stock_inventaire_${new Date().toISOString().split('T')[0]}.csv`);
  }
};

export const saleService = {
  async getSales(params?: PaginationParams | number): Promise<PaginatedData<Sale>> {
    const queryParams = normalizeParams(params);
    const response = await api.get<ApiResponse<any>>('/sales', { params: queryParams });
    return normalizePaginatedResponse<Sale>(response.data.data);
  },
  async getSaleById(id: number): Promise<Sale> {
    const response = await api.get<ApiResponse<Sale>>(`/sales/${id}`);
    return response.data.data;
  },
  async createSale(data: {
    warehouseId: number;
    employeeId?: number | null;
    customerName?: string;
    customerPhone?: string;
    saleDate?: string;
    items: { productId: number; quantity: number; unitPrice?: number }[];
  }): Promise<Sale> {
    const response = await api.post<ApiResponse<Sale>>('/sales', data);
    return response.data.data;
  },
  async updateSale(
    id: number,
    data: {
      employeeId?: number | null;
      customerName?: string;
      customerPhone?: string;
      saleDate?: string;
      items?: { productId: number; quantity: number; unitPrice?: number }[];
    }
  ): Promise<Sale> {
    const response = await api.put<ApiResponse<Sale>>(`/sales/${id}`, data);
    return response.data.data;
  },
  async cancelSale(id: number): Promise<Sale> {
    const response = await api.post<ApiResponse<Sale>>(`/sales/${id}/cancel`);
    return response.data.data;
  },
  async exportSalesCsv(params?: { warehouseId?: number; startDate?: string; endDate?: string; search?: string }): Promise<void> {
    const response = await api.get('/sales/export/csv', {
      params,
      responseType: 'blob',
    });
    downloadCsvResponse(response, `ventes_${new Date().toISOString().split('T')[0]}.csv`);
  }
};

export const transferService = {
  async getTransfers(params?: PaginationParams | number): Promise<PaginatedData<Transfer>> {
    const queryParams = normalizeParams(params);
    const response = await api.get<ApiResponse<any>>('/transfers', { params: queryParams });
    return normalizePaginatedResponse<Transfer>(response.data.data);
  },
  async getTransferById(id: number): Promise<Transfer> {
    const response = await api.get<ApiResponse<Transfer>>(`/transfers/${id}`);
    return response.data.data;
  },
  async createTransfer(data: { sourceWarehouseId: number; destinationWarehouseId: number; notes?: string; items: { productId: number; requestedQuantity: number }[] }): Promise<Transfer> {
    const response = await api.post<ApiResponse<Transfer>>('/transfers', data);
    return response.data.data;
  },
  async approveTransfer(id: number, data: { items: { productId: number; approvedQuantity: number }[] }): Promise<Transfer> {
    const response = await api.post<ApiResponse<Transfer>>(`/transfers/${id}/approve`, data);
    return response.data.data;
  },
  async confirmTransfer(id: number): Promise<Transfer> {
    const response = await api.post<ApiResponse<Transfer>>(`/transfers/${id}/confirm`);
    return response.data.data;
  },
  async declineTransfer(id: number): Promise<Transfer> {
    const response = await api.post<ApiResponse<Transfer>>(`/transfers/${id}/decline`);
    return response.data.data;
  },
  async cancelTransfer(id: number): Promise<Transfer> {
    const response = await api.post<ApiResponse<Transfer>>(`/transfers/${id}/cancel`);
    return response.data.data;
  },
  async bulkRelocateStock(data: {
    sourceWarehouseId: number;
    distributions: {
      destinationWarehouseId: number;
      items: { productId: number; quantity: number }[];
    }[];
    immediateExecution?: boolean;
    notes?: string;
  }): Promise<{
    transfers: any[];
    immediateExecution: boolean;
    sourceWarehouseId: number;
    totalRemainingStock: number;
    sourceIsEmpty: boolean;
  }> {
    const response = await api.post<ApiResponse<any>>('/transfers/bulk-relocation', data);
    return response.data.data;
  }
};
