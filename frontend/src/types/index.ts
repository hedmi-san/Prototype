export type RoleType = 'ADMIN' | 'MANAGER' | 'SUPER_MANAGER' | 'ACCOUNTANT';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: RoleType;
  warehouseId: number | null;
  warehouseName: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  userId: number;
  username: string;
  fullName: string;
  role: RoleType;
  warehouseId: number | null;
  warehouseName: string | null;
}

export interface Warehouse {
  id: number;
  name: string;
  code: string;
  address: string;
  phone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  reference: string;
  name: string;
  brand: string;
  purchasePrice: number;
  salePrice: number;
  unit: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Stock {
  id: number;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  productId: number;
  productReference: string;
  productName: string;
  productBrand: string;
  productUnit: string;
  productPurchasePrice: number;
  productSalePrice: number;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  totalValuation: number;
  updatedAt: string;
}

export type StockMovementType = 'INITIAL_STOCK' | 'SALE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';

export interface StockMovement {
  id: number;
  warehouseId: number;
  warehouseName: string;
  productId: number;
  productReference: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  referenceType: string;
  referenceId: number | null;
  reason: string;
  createdById: number | null;
  createdByName: string;
  createdAt: string;
}

export type SaleStatus = 'COMPLETED' | 'CANCELLED';

export interface SaleItem {
  id: number;
  productId: number;
  productReference: string;
  productName: string;
  productBrand: string;
  productUnit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Sale {
  id: number;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  invoiceNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: number;
  saleDate: string;
  status: SaleStatus;
  createdById: number | null;
  createdByName: string;
  items: SaleItem[];
  createdAt: string;
  updatedAt: string;
}

export type TransferStatus = 'REQUESTED' | 'APPROVED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED';

export interface TransferItem {
  id: number;
  productId: number;
  productReference: string;
  productName: string;
  productBrand: string;
  productUnit: string;
  requestedQuantity: number;
  approvedQuantity: number;
}

export interface Transfer {
  id: number;
  sourceWarehouseId: number;
  sourceWarehouseName: string;
  sourceWarehouseCode: string;
  destinationWarehouseId: number;
  destinationWarehouseName: string;
  destinationWarehouseCode: string;
  status: TransferStatus;
  createdById: number | null;
  createdByName: string;
  notes: string | null;
  items: TransferItem[];
  createdAt: string;
  approvedAt: string | null;
  confirmedAt: string | null;
  updatedAt: string;
}

export type ExpenseCategory = 'ELECTRICITY' | 'WATER' | 'RENT' | 'FUEL' | 'MAINTENANCE' | 'OTHER';

export interface Expense {
  id: number;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  expenseDate: string;
  createdById: number | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: number;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string;
  phone: string;
  hireDate: string;
  monthlySalary: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SalaryStatus = 'PAID' | 'PENDING';

export interface SalaryRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  employeePosition: string;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  period: string;
  baseSalary: number;
  bonus1: number;
  bonus2: number;
  totalAmount: number;
  paymentDate: string;
  status: SalaryStatus;
  createdById: number | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseComparison {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  stockValue: number;
  totalProductsCount: number;
  monthlySales: number;
  monthlyExpenses: number;
  monthlySalaries: number;
}

export interface DashboardMetrics {
  totalStockValue: number;
  salesToday: number;
  salesThisMonth: number;
  outOfStockCount: number;
  lowStockCount: number;
  totalExpensesThisMonth: number;
  totalSalariesThisMonth: number;
  totalRevenueThisMonth: number;
  grossProfitThisMonth: number;
  netProfitThisMonth: number;
  pendingTransfersCount: number;
  warehouseComparisons?: WarehouseComparison[];
  recentSales: Sale[];
  recentMovements: StockMovement[];
}

export interface StockValuationReport {
  warehouseId: number | null;
  warehouseName: string;
  totalValuation: number;
  totalPhysicalUnits: number;
  totalReservedUnits: number;
  totalAvailableUnits: number;
  items: Stock[];
}

export interface FinancialReport {
  warehouseId: number | null;
  warehouseName: string;
  period: string;
  totalRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  totalSalaries: number;
  netProfit: number;
}

export interface AuditLog {
  id: number;
  userId: number | null;
  username: string;
  userFullName: string;
  action: string;
  entityType: string;
  entityId: number | null;
  warehouseId: number | null;
  warehouseName: string;
  oldValues: string | null;
  newValues: string | null;
  description: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}
