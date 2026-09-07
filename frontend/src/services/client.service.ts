import api from './api';
import type {
  ApiResponse,
  Client,
  ClientDetail,
  ClientKPIs,
  ClientPayment,
  ClientRefund,
  PaymentAllocation,
  StatementOfAccount,
  Sale,
  PaginationParams,
  PaginatedData,
} from '../types';
import { downloadCsvResponse } from '../utils/export';

export interface ClientQueryParams extends PaginationParams {
  search?: string;
  balanceFilter?: 'all' | 'debtors' | 'advance' | 'settled';
  activeOnly?: boolean | string;
}

export interface ClientListResponse {
  items: Client[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  kpis: ClientKPIs;
}

export interface CreateClientDto {
  code?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  openingBalance?: number;
  warehouseId?: number;
}

export interface UpdateClientDto {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  active?: boolean;
}

export interface StatementQueryParams {
  warehouseId?: number;
  startDate?: string;
  endDate?: string;
}

export interface CreatePaymentDto {
  clientId: number;
  warehouseId: number;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  paymentDate?: string;
  notes?: string;
  allocations?: { saleId: number; amount: number }[];
}

export interface AdjustBalanceDto {
  amount: number;
  direction: 'DEBIT' | 'CREDIT';
  description: string;
  warehouseId?: number;
}

export const clientService = {
  async getClients(params?: ClientQueryParams): Promise<ClientListResponse> {
    const response = await api.get<ApiResponse<ClientListResponse>>('/clients', { params });
    return response.data.data;
  },

  async getClientKpis(): Promise<ClientKPIs> {
    const response = await api.get<ApiResponse<ClientKPIs>>('/clients/kpis');
    return response.data.data;
  },

  async getClientById(id: number): Promise<ClientDetail> {
    const response = await api.get<ApiResponse<ClientDetail>>(`/clients/${id}`);
    return response.data.data;
  },

  async createClient(data: CreateClientDto): Promise<Client> {
    const response = await api.post<ApiResponse<Client>>('/clients', data);
    return response.data.data;
  },

  async updateClient(id: number, data: UpdateClientDto): Promise<Client> {
    const response = await api.put<ApiResponse<Client>>(`/clients/${id}`, data);
    return response.data.data;
  },

  async getClientStatement(id: number, params?: StatementQueryParams): Promise<StatementOfAccount> {
    const response = await api.get<ApiResponse<StatementOfAccount>>(`/clients/${id}/statement`, { params });
    return response.data.data;
  },

  async exportStatementCsv(id: number, params?: StatementQueryParams, clientCode = 'client'): Promise<void> {
    const response = await api.get(`/clients/${id}/statement/csv`, {
      params,
      responseType: 'blob',
    });
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsvResponse(response, `extrait_compte_${clientCode}_${dateStr}.csv`);
  },

  async getClientInvoices(id: number): Promise<Sale[]> {
    const response = await api.get<ApiResponse<Sale[]>>(`/clients/${id}/invoices`);
    return response.data.data;
  },

  async getClientPayments(id: number): Promise<ClientPayment[]> {
    const response = await api.get<ApiResponse<ClientPayment[]>>(`/clients/${id}/payments`);
    return response.data.data;
  },

  async adjustClientBalance(id: number, data: AdjustBalanceDto): Promise<any> {
    const response = await api.post<ApiResponse<any>>(`/clients/${id}/adjustment`, data);
    return response.data.data;
  },

  // Payment receipts & general payments
  async getPayments(params?: {
    warehouseId?: number;
    clientId?: number;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: ClientPayment[]; pagination: any; summary: { totalAmountSum: number } }> {
    const response = await api.get<ApiResponse<any>>('/client-payments', { params });
    return response.data.data;
  },

  async getPaymentById(id: number): Promise<ClientPayment> {
    const response = await api.get<ApiResponse<ClientPayment>>(`/client-payments/${id}`);
    return response.data.data;
  },

  async createPayment(data: CreatePaymentDto): Promise<ClientPayment> {
    const response = await api.post<ApiResponse<ClientPayment>>('/client-payments', data);
    return response.data.data;
  },

  async refundClientAdvance(clientId: number, data: { amount: number; warehouseId?: number; notes?: string }): Promise<ClientRefund> {
    const response = await api.post<ApiResponse<ClientRefund>>(`/clients/${clientId}/refund`, data);
    return response.data.data;
  },

  async getClientRefunds(clientId: number, warehouseId?: number): Promise<ClientRefund[]> {
    const response = await api.get<ApiResponse<ClientRefund[]>>(`/clients/${clientId}/refunds`, {
      params: warehouseId ? { warehouseId } : undefined,
    });
    return response.data.data;
  },

  async getClientRefundById(clientId: number, refundId: number): Promise<ClientRefund> {
    const response = await api.get<ApiResponse<ClientRefund>>(`/clients/${clientId}/refunds/${refundId}`);
    return response.data.data;
  },
};

