export type RoleName = 'ADMIN' | 'SUPER_MANAGER' | 'MANAGER' | 'ACCOUNTANT';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  role_id: number;
  role_name: RoleName;
  warehouse_id: number | null;
  warehouse_name: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface UserContext {
  id: number;
  username: string;
  fullName: string;
  role: RoleName;
  warehouseId: number | null;
  warehouseName: string | null;
}

export interface Warehouse {
  id: number;
  name: string;
  code: string;
  location: string;
  contact_number: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  reference: string;
  name: string;
  brand: string;
  description: string;
  purchase_price: number;
  sale_price: number;
  min_stock_alert: number;
  unit: string;
  box_size?: number;
  tva?: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Stock {
  id: number;
  warehouse_id: number;
  warehouse_name?: string;
  product_id: number;
  product_name?: string;
  product_reference?: string;
  brand?: string;
  physical_quantity: number;
  reserved_quantity: number;
  available_quantity?: number;
  purchase_price?: number;
  sale_price?: number;
  total_valuation?: number;
  min_stock_alert?: number;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  warehouse_id: number;
  warehouse_name?: string;
  product_id: number;
  product_name?: string;
  product_reference?: string;
  movement_type: 'INITIAL_STOCK' | 'SALE' | 'SALE_EDIT' | 'SALE_CANCEL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';
  quantity_change: number;
  reference: string;
  notes: string;
  created_at: string;
}

export interface Sale {
  id: number;
  invoice_number: string;
  warehouse_id: number;
  warehouse_name?: string;
  origin_warehouse_id?: number;
  origin_warehouse_name?: string;
  has_inter_warehouse_fulfillment?: boolean;
  user_id: number;
  user_name?: string;
  employee_id?: number | null;
  client_id?: number | null;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  paid_amount?: number;
  advance_deducted?: number;
  payment_status?: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'CANCELLED';
  sale_date?: string;
  status: 'COMPLETED' | 'CANCELLED' | 'PARTIALLY_CANCELLED';
  created_at: string;
  updated_at: string;
  items?: SaleItem[];
  fulfillment_lines?: SaleFulfillmentLine[];
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name?: string;
  product_reference?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface SaleFulfillmentLine {
  id: number;
  sale_id: number;
  product_id: number;
  product_name?: string;
  product_reference?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  origin_warehouse_id: number;
  origin_warehouse_name?: string;
  fulfillment_warehouse_id: number;
  fulfillment_warehouse_name?: string;
  payment_warehouse_id: number;
  payment_warehouse_name?: string;
  fulfillment_status: 'PENDING_PICKUP' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
  payment_status: 'PAID' | 'COLLECT_ON_PICKUP';
  pickup_voucher_code: string;
  fulfilled_at?: string | null;
  fulfilled_by_user_id?: number | null;
  fulfilled_by_user_name?: string;
  reservation?: StockReservation;
  created_at: string;
  updated_at: string;
}

export interface StockReservation {
  id: number;
  fulfillment_line_id: number;
  warehouse_id: number;
  warehouse_name?: string;
  product_id: number;
  product_name?: string;
  reserved_quantity: number;
  status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
  expires_at: string;
  cancelled_at?: string | null;
  fulfilled_at?: string | null;
  created_at: string;
}

export interface InterWarehouseSettlement {
  id: number;
  settlement_number: string;
  debtor_warehouse_id: number;
  debtor_warehouse_name?: string;
  creditor_warehouse_id: number;
  creditor_warehouse_name?: string;
  amount: number;
  status: 'PENDING' | 'SETTLED';
  settlement_date?: string | null;
  settled_by_user_id?: number | null;
  settled_by_user_name?: string;
  notes?: string;
  created_at: string;
}

export interface FulfillmentAllocationInput {
  productId: number;
  originWarehouseId: number;
  fulfillmentWarehouseId: number;
  paymentWarehouseId: number;
  quantity: number;
  unitPrice: number;
  paymentStatus: 'PAID' | 'COLLECT_ON_PICKUP';
  ttlHours?: number;
}

export interface Transfer {
  id: number;
  transfer_number: string;
  source_warehouse_id: number;
  source_warehouse_name?: string;
  destination_warehouse_id: number;
  destination_warehouse_name?: string;
  requested_by_user_id: number;
  requested_by_name?: string;
  status: 'REQUESTED' | 'APPROVED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED';
  notes: string;
  created_at: string;
  updated_at: string;
  items?: TransferItem[];
}

export interface TransferItem {
  id: number;
  transfer_id: number;
  product_id: number;
  product_name?: string;
  product_reference?: string;
  requested_quantity: number;
  approved_quantity: number;
}

export interface Expense {
  id: number;
  warehouse_id: number;
  warehouse_name?: string;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  created_at: string;
}

export interface Employee {
  id: number;
  warehouse_id: number;
  warehouse_name?: string;
  full_name: string;
  national_id: string;
  phone: string;
  position: string;
  base_salary: number;
  active: number;
  hire_date: string;
  created_at: string;
}

export interface SalaryRecord {
  id: number;
  employee_id: number;
  employee_name?: string;
  warehouse_id: number;
  warehouse_name?: string;
  period: string;
  base_salary: number;
  bonus1: number;
  bonus2: number;
  total_amount: number;
  payment_date: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  username?: string;
  user_full_name?: string;
  warehouse_id: number | null;
  warehouse_name?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: string | null;
  new_values: string | null;
  description: string;
  ip_address: string | null;
  created_at: string;
}

export interface ClientRefund {
  id: number;
  refund_number: string;
  client_id: number;
  client_name?: string;
  client_code?: string;
  client_phone?: string;
  warehouse_id: number;
  warehouse_name?: string;
  warehouse_code?: string;
  amount: number;
  refund_method: 'CASH';
  notes?: string;
  transaction_id?: number;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  prior_balance?: number;
  new_balance?: number;
}

export interface CreateClientRefundRequest {
  amount: number;
  warehouseId?: number;
  notes?: string;
  refundMethod?: 'CASH';
}
