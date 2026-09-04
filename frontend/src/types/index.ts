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
  location?: string;
  phone: string;
  contactNumber?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  reference: string;
  name: string;
  brand: string;
  description?: string;
  purchasePrice: number;
  salePrice: number;
  minStockAlert?: number;
  unit: string;
  boxSize?: number;
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
  productBoxSize?: number;
  boxCount?: number;
  productPurchasePrice: number;
  productSalePrice: number;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStockAlert?: number;
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
  movementType?: StockMovementType;
  quantity: number;
  quantityChange?: number;
  referenceType?: string;
  referenceId?: number | null;
  reference?: string;
  notes?: string;
  reason?: string;
  createdById?: number | null;
  createdByName?: string;
  createdAt: string;
}

export type SaleStatus = 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'CANCELLED';

export interface SaleItem {
  id: number;
  productId: number;
  productReference: string;
  productName: string;
  productBrand: string;
  productUnit: string;
  productBoxSize?: number;
  boxSize?: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Sale {
  id: number;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  warehousePhone?: string;
  warehouseAddress?: string;
  invoiceNumber: string;
  clientId?: number | null;
  clientName?: string | null;
  clientCode?: string | null;
  clientAddress?: string | null;
  customerName: string | null;
  customerPhone: string | null;
  totalAmount: number;
  paidAmount?: number;
  remainingAmount?: number;
  paymentStatus?: PaymentStatus;
  saleDate: string;
  status: SaleStatus;
  createdById: number | null;
  createdByName: string;
  userId?: number | null;
  userName?: string;
  employeeId?: number | null;
  employeeName?: string | null;
  items: SaleItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: number;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  openingBalance: number;
  currentBalance: number;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientStats {
  salesCount: number;
  totalInvoiced: number;
  totalPaid: number;
  openInvoicesCount: number;
}

export interface ClientDetail extends Client {
  stats?: ClientStats;
}

export interface ClientKPIs {
  totalClients: number;
  totalDebtors: number;
  totalDebt: number;
  totalAdvance: number;
}

export type TransactionType = 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'ADJUSTMENT' | 'OPENING_BALANCE';

export interface ClientTransaction {
  id: number;
  clientId: number;
  warehouseId: number;
  warehouseName?: string;
  warehouseCode?: string;
  type: TransactionType;
  referenceType?: string | null;
  referenceId?: number | null;
  debit: number;
  credit: number;
  runningBalance: number;
  storedRunningBalance?: number;
  description: string;
  transactionDate: string;
  createdById?: number | null;
  createdByName?: string | null;
  createdAt: string;
}

export interface PaymentAllocation {
  id?: number;
  paymentId?: number;
  saleId: number;
  invoiceNumber?: string;
  allocatedAmount: number;
  saleTotal?: number;
  saleDate?: string;
}

export type PaymentMethod = 'CASH' | 'CHECK' | 'BANK_TRANSFER' | 'CARD';

export interface ClientPayment {
  id: number;
  paymentNumber: string;
  clientId: number;
  clientName?: string;
  clientCode?: string;
  clientPhone?: string;
  clientAddress?: string;
  warehouseId: number;
  warehouseName?: string;
  warehouseCode?: string;
  warehousePhone?: string;
  warehouseLocation?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  paymentDate: string;
  notes?: string;
  transactionId?: number;
  createdById?: number;
  createdByName?: string;
  createdAt: string;
  allocations?: PaymentAllocation[];
}

export interface StatementOfAccount {
  client: Client;
  filter: {
    warehouseId: number | null;
    startDate: string | null;
    endDate: string | null;
  };
  periodOpeningBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  currentTotalBalance: number;
  transactions: ClientTransaction[];
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
  transferNumber?: string;
  sourceWarehouseId: number;
  sourceWarehouseName: string;
  sourceWarehouseCode: string;
  destinationWarehouseId: number;
  destinationWarehouseName: string;
  destinationWarehouseCode: string;
  status: TransferStatus;
  createdById?: number | null;
  requestedByUserId?: number | null;
  createdByName?: string;
  requestedByName?: string;
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

export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';

export interface Employee {
  id: number;
  warehouseId: number;
  warehouseName: string;
  warehouseCode?: string;
  warehouseLocation?: string;
  warehousePhone?: string;
  fullName: string;
  nationalId?: string;
  position: string;
  phone: string;
  hireDate: string;
  baseSalary: number;
  status: EmployeeStatus;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface EmployeeTopProduct {
  productId: number;
  productName: string;
  productReference: string;
  productBrand: string;
  quantitySold: number;
  totalAmount: number;
}

export interface EmployeePerformanceMetrics {
  employeeId: number;
  employeeName: string;
  currentBaseSalary: number;
  period: {
    preset?: string;
    startDate: string;
    endDate: string;
    periodLabel: string;
  };
  metrics: {
    salesCount: number;
    totalRevenue: number;
    totalUnitsSold: number;
    averageBasket: number;
    priorSalesCount: number;
    priorTotalRevenue: number;
    salesGrowthPct: number;
    revenueGrowthPct: number;
    lifetimePaid: number;
    totalPayouts: number;
  };
  topProducts: EmployeeTopProduct[];
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
  periodSales?: number;
  monthlyExpenses: number;
  monthlySalaries: number;
}

export type PeriodPreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'lastYear'
  | 'custom';

export interface SalesTrendItem {
  date: string;
  label: string;
  totalAmount: number;
  ordersCount: number;
}

export interface DashboardMetrics {
  preset?: PeriodPreset;
  startDate?: string;
  endDate?: string;
  periodLabel?: string;
  priorPeriodLabel?: string;

  // Selected period metrics
  periodSales?: number;
  periodOrders?: number;
  periodAverageBasket?: number;
  periodGrossProfit?: number;
  periodExpenses?: number;
  periodSalaries?: number;
  periodNetProfit?: number;

  // Comparison metrics
  priorSales?: number;
  priorOrders?: number;
  salesGrowthPercentage?: number;
  ordersGrowthPercentage?: number;

  // Time series
  salesTrend?: SalesTrendItem[];

  // Core metrics
  totalStockValue: number;
  totalStockValuation?: number;
  totalStockItems?: number;
  salesToday: number;
  totalSalesToday?: number;
  salesThisMonth: number;
  totalSalesThisMonth?: number;
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

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StockStatusCounts {
  total: number;
  normal: number;
  low: number;
  out: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
  counts?: StockStatusCounts;
}

export interface PaginatedStockData extends PaginatedData<Stock> {
  counts: StockStatusCounts;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
  warehouseId?: number;
  status?: string;
  type?: string;
  action?: string;
  ids?: number[] | string;
}

export type ProductSortBy = 'name' | 'salePrice' | 'purchasePrice' | 'reference' | 'brand' | 'createdAt' | 'id';
export type SortOrder = 'asc' | 'desc';

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  brand?: string;
  sortBy?: ProductSortBy;
  sortOrder?: SortOrder;
  all?: boolean;
  ids?: number[] | string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

