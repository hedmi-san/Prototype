## 1. Project Scaffolding & Infrastructure

- [x] 1.1 Initialize monorepo directory layout for backend, frontend, infrastructure, and scripts
- [x] 1.2 Setup Docker Compose with PostgreSQL 16 service and health checks
- [x] 1.3 Initialize Spring Boot 3 backend project with Maven, Spring Web, Spring Security, Spring Data JPA, Validation, Flyway, and PostgreSQL driver
- [x] 1.4 Initialize Vue 3 + TypeScript frontend project with Vite, Pinia, Vue Router, Axios, and InterVariable font setup

## 2. Database Schema & Flyway Migrations

- [x] 2.1 Write V1 migration for users, roles, and permissions tables
- [x] 2.2 Write V2 migration for warehouses table
- [x] 2.3 Write V3 migration for products table
- [x] 2.4 Write V4 migration for stock (with physical, reserved, available checks) and stock_movements tables
- [x] 2.5 Write V5 migration for sales and sale_items tables
- [x] 2.6 Write V6 migration for transfers and transfer_items tables
- [x] 2.7 Write V7 migration for employees table
- [x] 2.8 Write V8 migration for salary_records table
- [x] 2.9 Write V9 migration for expenses table
- [x] 2.10 Write V10 migration for audit_logs table

## 3. Backend Core, Security & Authentication

- [x] 3.1 Implement base response envelopes, custom exceptions, and GlobalExceptionHandler
- [x] 3.2 Implement User, Role, Warehouse JPA entities and repositories
- [x] 3.3 Implement JWT token generation, validation service, and Spring Security filter chain
- [x] 3.4 Implement AuthController and AuthService (login, logout, current user profile)
- [x] 3.5 Implement server-side warehouse-isolation security annotations and evaluation helpers

## 4. Product Catalog & Warehouse Management

- [x] 4.1 Implement Warehouse JPA entity, repository, service, and controller
- [x] 4.2 Implement Product JPA entity, repository, service, and controller (purchase & sale prices editable by Manager/Accountant)
- [x] 4.3 Implement AuditService for recording entity mutations

## 5. Inventory & Concurrency Engine

- [x] 5.1 Implement Stock and StockMovement JPA entities and repositories
- [x] 5.2 Implement pessimistic row-locking queries (`SELECT ... FOR UPDATE`) in StockRepository
- [x] 5.3 Implement InventoryService with atomic stock mutations and INITIAL_STOCK receipt logic
- [x] 5.4 Implement StockAdjustmentService with mandatory reason validation and movement auditing
- [x] 5.5 Implement InventoryController endpoints (current stock, movements, adjustments)

## 6. Sales Management & Inventory Reconciliation

- [x] 6.1 Implement Sale and SaleItem JPA entities, repositories, and DTOs
- [x] 6.2 Implement SaleService creation logic with stock availability validation and snapshot unit pricing
- [x] 6.3 Implement SaleService delta reconciliation on sale editing (handling positive and negative deltas)
- [x] 6.4 Implement SaleService non-destructive cancellation/voiding with compensating stock reversal
- [x] 6.5 Implement SaleController endpoints and invoice generation data endpoint

## 7. Inter-Warehouse Transfers & Stock Reservation

- [x] 7.1 Implement Transfer and TransferItem JPA entities, repositories, and status enums
- [x] 7.2 Implement TransferService request creation logic
- [x] 7.3 Implement TransferService approval logic with source stock reservation (`reserved_quantity`)
- [x] 7.4 Implement TransferService destination confirmation logic (decrementing source physical & reserved, incrementing destination physical)
- [x] 7.5 Implement TransferService cancellation and decline logic (releasing reserved stock)
- [x] 7.6 Implement TransferController endpoints

## 8. Operating Expenses & HR / Salaries

- [x] 8.1 Implement Expense JPA entity, repository, service, and controller with categories
- [x] 8.2 Implement Employee JPA entity, repository, and service
- [x] 8.3 Implement SalaryRecord JPA entity, repository, and service (monthly base salary + 2 holiday bonuses)
- [x] 8.4 Implement EmployeeController and SalaryController endpoints

## 9. Reporting, Dashboards & Audit Trail

- [x] 9.1 Implement DashboardService for global Admin metrics and warehouse-specific metrics
- [x] 9.2 Implement StockReportService with dynamic valuation using current purchase prices
- [x] 9.3 Implement SalesReportService and FinancialReportService (revenue, gross profit, expenses, salaries, net profit)
- [x] 9.4 Implement AuditLogController for querying audit records
- [x] 9.5 Implement ReportController endpoints

## 10. Frontend Design System, Architecture & Layout

- [x] 10.1 Implement `variables.css` and `main.css` containing monochromatic color tokens, typography scales, spacing, border-radii, and shadow elevations
- [x] 10.2 Setup Vue Router with authentication guards and role-based permissions
- [x] 10.3 Setup Pinia stores for auth, active warehouse, products, inventory, and sales
- [x] 10.4 Implement AuthLayout and LoginView styled with monochromatic enterprise aesthetics
- [x] 10.5 Implement DashboardLayout with responsive sidebar, navigation, warehouse context switcher, and user profile header
- [x] 10.6 Implement core reusable UI components (AppTable, AppButton, AppModal, AppPagination, AppBadge, AppInput, ConfirmDialog)
- [x] 10.7 Implement AppSkeleton loading components for tables, metric cards, and forms to eliminate layout shifts

## 11. Frontend Feature Views & Workflows

- [x] 11.1 Implement Admin and Warehouse DashboardViews with KPI metric cards, skeleton states, and low stock alerts
- [x] 11.2 Implement ProductListView, ProductCreateView, ProductEditView with dual price controls
- [x] 11.3 Implement StockView, StockMovementsView, and StockAdjustmentView with filterable movement history
- [x] 11.4 Implement SalesListView, CreateSaleView, EditSaleView, SaleDetailsView, and InvoicePreview
- [x] 11.5 Implement TransferListView, CreateTransferView, and TransferDetailsView with approval/confirmation action panels
- [x] 11.6 Implement ExpenseListView and CreateExpenseView
- [x] 11.7 Implement EmployeeListView and SalaryManagementView
- [x] 11.8 Implement StockReportsView, SalesReportsView, FinancialReportsView, and AuditLogsView

## 12. Verification & Automated Testing

- [x] 12.1 Implement InventoryConcurrencyTest validating concurrent sale requests against finite stock
- [x] 12.2 Implement SaleModificationTest and NegativeStockTest validating inventory delta reconciliation
- [x] 12.3 Implement TransferWorkflowTest validating stock reservation, reception, and cancellation release
- [x] 12.4 Implement AuthorizationTest validating warehouse isolation and role permissions
- [x] 12.5 Perform UI verification of monochromatic styling, skeleton screen transitions, and keyboard focus visibility
