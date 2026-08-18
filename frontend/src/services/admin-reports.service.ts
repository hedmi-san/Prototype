import api from './api';
import type { ApiResponse, Expense, Employee, SalaryRecord, DashboardMetrics, PeriodPreset, StockValuationReport, FinancialReport, AuditLog, User, Sale } from '../types';

export const expenseService = {
  async getExpenses(warehouseId?: number): Promise<Expense[]> {
    const params = warehouseId ? { warehouseId } : {};
    const response = await api.get<ApiResponse<Expense[]>>('/expenses', { params });
    return response.data.data;
  },
  async createExpense(data: Partial<Expense>): Promise<Expense> {
    const response = await api.post<ApiResponse<Expense>>('/expenses', data);
    return response.data.data;
  },
  async updateExpense(id: number, data: Partial<Expense>): Promise<Expense> {
    const response = await api.put<ApiResponse<Expense>>(`/expenses/${id}`, data);
    return response.data.data;
  }
};

export const employeeService = {
  async getEmployees(warehouseId?: number): Promise<Employee[]> {
    const params = warehouseId ? { warehouseId } : {};
    const response = await api.get<ApiResponse<Employee[]>>('/employees', { params });
    return response.data.data;
  },
  async createEmployee(data: Partial<Employee>): Promise<Employee> {
    const response = await api.post<ApiResponse<Employee>>('/employees', data);
    return response.data.data;
  },
  async updateEmployee(id: number, data: Partial<Employee>): Promise<Employee> {
    const response = await api.put<ApiResponse<Employee>>(`/employees/${id}`, data);
    return response.data.data;
  }
};

export const salaryService = {
  async getSalaries(warehouseId?: number): Promise<SalaryRecord[]> {
    const params = warehouseId ? { warehouseId } : {};
    const response = await api.get<ApiResponse<SalaryRecord[]>>('/salaries', { params });
    return response.data.data;
  },
  async recordSalary(data: { employeeId: number; period: string; baseSalary: number; bonus1?: number; bonus2?: number; paymentDate: string }): Promise<SalaryRecord> {
    const response = await api.post<ApiResponse<SalaryRecord>>('/salaries', data);
    return response.data.data;
  }
};

export const reportService = {
  async getDashboardMetrics(
    warehouseId?: number,
    preset?: PeriodPreset,
    startDate?: string,
    endDate?: string
  ): Promise<DashboardMetrics> {
    const params: Record<string, string | number> = {};
    if (warehouseId) params.warehouseId = warehouseId;
    if (preset) params.preset = preset;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await api.get<ApiResponse<DashboardMetrics>>('/reports/dashboard', { params });
    return response.data.data;
  },
  async getStockValuation(warehouseId?: number): Promise<StockValuationReport> {
    const params = warehouseId ? { warehouseId } : {};
    const response = await api.get<ApiResponse<StockValuationReport>>('/reports/stock-valuation', { params });
    return response.data.data;
  },
  async getSalesReport(warehouseId?: number, startDate?: string, endDate?: string): Promise<Sale[]> {
    const params: Record<string, string | number> = {};
    if (warehouseId) params.warehouseId = warehouseId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await api.get<ApiResponse<Sale[]>>('/reports/sales', { params });
    return response.data.data;
  },
  async getFinancialReport(warehouseId?: number, period?: string): Promise<FinancialReport> {
    const params: Record<string, string | number> = {};
    if (warehouseId) params.warehouseId = warehouseId;
    if (period) params.period = period;
    const response = await api.get<ApiResponse<FinancialReport>>('/reports/financial', { params });
    return response.data.data;
  }
};

export const auditService = {
  async getAuditLogs(warehouseId?: number): Promise<AuditLog[]> {
    const params = warehouseId ? { warehouseId } : {};
    const response = await api.get<ApiResponse<AuditLog[]>>('/admin/audit-logs', { params });
    return response.data.data;
  }
};

export const adminService = {
  async getUsers(): Promise<User[]> {
    const response = await api.get<ApiResponse<User[]>>('/admin/users');
    return response.data.data;
  },
  async createUser(data: { username: string; password: string; fullName: string; roleName: string; warehouseId?: number | null }): Promise<User> {
    const response = await api.post<ApiResponse<User>>('/admin/users', data);
    return response.data.data;
  }
};
