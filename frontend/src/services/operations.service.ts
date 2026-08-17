import api from './api';
import type { ApiResponse, Stock, StockMovement, Sale, Transfer } from '../types';

export const inventoryService = {
  async getStock(warehouseId?: number): Promise<Stock[]> {
    const params = warehouseId ? { warehouseId } : {};
    const response = await api.get<ApiResponse<Stock[]>>('/inventory/stock', { params });
    return response.data.data;
  },
  async getMovements(warehouseId?: number): Promise<StockMovement[]> {
    const params = warehouseId ? { warehouseId } : {};
    const response = await api.get<ApiResponse<StockMovement[]>>('/inventory/movements', { params });
    return response.data.data;
  },
  async adjustStock(data: { warehouseId: number; productId: number; quantity: number; reason: string }): Promise<Stock> {
    const response = await api.post<ApiResponse<Stock>>('/inventory/adjustments', data);
    return response.data.data;
  },
  async receiveInitialStock(data: { warehouseId: number; productId: number; quantity: number; reference: string; notes?: string }): Promise<Stock> {
    const response = await api.post<ApiResponse<Stock>>('/inventory/initial-receipt', data);
    return response.data.data;
  }
};

export const saleService = {
  async getSales(warehouseId?: number): Promise<Sale[]> {
    const params = warehouseId ? { warehouseId } : {};
    const response = await api.get<ApiResponse<Sale[]>>('/sales', { params });
    return response.data.data;
  },
  async getSaleById(id: number): Promise<Sale> {
    const response = await api.get<ApiResponse<Sale>>(`/sales/${id}`);
    return response.data.data;
  },
  async createSale(data: { warehouseId: number; customerName?: string; customerPhone?: string; items: { productId: number; quantity: number }[] }): Promise<Sale> {
    const response = await api.post<ApiResponse<Sale>>('/sales', data);
    return response.data.data;
  },
  async updateSale(id: number, data: { customerName?: string; customerPhone?: string; items: { productId: number; quantity: number }[] }): Promise<Sale> {
    const response = await api.put<ApiResponse<Sale>>(`/sales/${id}`, data);
    return response.data.data;
  },
  async cancelSale(id: number): Promise<Sale> {
    const response = await api.post<ApiResponse<Sale>>(`/sales/${id}/cancel`);
    return response.data.data;
  }
};

export const transferService = {
  async getTransfers(warehouseId?: number): Promise<Transfer[]> {
    const params = warehouseId ? { warehouseId } : {};
    const response = await api.get<ApiResponse<Transfer[]>>('/transfers', { params });
    return response.data.data;
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
  }
};
