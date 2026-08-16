# Multi-Warehouse Tool Distribution Management System

## 1. BUSINESS MODEL

### 1.1 Problem Statement / Value Proposition

The company is the **national distributor of a tool brand in Algeria**. It does not operate retail stores; it operates multiple warehouses that distribute the brand's products.

The current business requires centralized visibility and control over:

- Product stock across multiple warehouses.
- Sales made by each warehouse.
- Transfers of products between warehouses.
- Warehouse employees and salaries.
- Warehouse operating expenses.
- Product pricing.
- Stock movements and inventory adjustments.
- Financial and operational reporting.
- User permissions and accountability.

The application will provide a centralized web-based system where every warehouse operates within the same system while maintaining its own stock, sales, employees, salaries, expenses, and financial information.

The primary value proposition is:

> **Give the distributor one reliable source of truth for stock, sales, warehouse operations, HR, expenses, and financial performance across all warehouses.**

The system should make it possible for management to answer questions such as:

- How much stock do we have in total?
- How much stock does each warehouse have?
- What is the total value of our inventory?
- How much did each warehouse sell today?
- How much did we sell this month?
- Which products are out of stock or running low?
- Which warehouse sells the most?
- What expenses does each warehouse have?
- How much are warehouse salaries?
- What is the company's revenue, gross profit, expenses, and net profit?
- Who changed a sale, stock quantity, price, transfer, or other important record?

---

### 1.2 Target Users / Customer Segments

#### Primary users

The application is primarily an **internal business management system** for the distributor.

The main user roles are:

**Admin**

Global system administrator.

**Manager**

Responsible for one warehouse and its operations.

**Super Manager**

Responsible for one warehouse like a Manager, with additional visibility into stock in other warehouses.

**Accountant**

Responsible for sales, stock operations, invoice printing, and financial operations for a warehouse.

#### Future commercial segment

The application could eventually be developed into a reusable product for other distributors with multiple warehouses, but this is **not part of the current confirmed business model**.

---

### 1.3 Core Features Delivering the Value Proposition

#### Global Dashboard

Admin dashboard showing:

- Total stock value.
- Total sales today.
- Total sales this month.
- Out-of-stock products.
- Low-stock products.
- Total expenses.
- Total salaries.
- Financial indicators.
- Warehouse comparison.
- Sales comparison between warehouses.

Managers have a warehouse-level dashboard showing:

- Total sales today.
- Total sales this month.
- Total stock value.
- Warehouse-specific operational information.

Super Managers additionally have visibility into stock in other warehouses.

---

#### Warehouse Management

Each warehouse is an independent operational unit with:

- Its own stock.
- Its own sales.
- Its own employees.
- Its own salaries.
- Its own expenses.
- Its own transfer activity.
- Its own warehouse-level reports.

---

#### Product Management

Each product contains:

```text
id
reference
name
brand
purchase_price
sale_price
unit
```

The previously discussed `box_size` field has been removed because it has no business meaning for this application.

Product pricing follows this rule:

- Manager can modify purchase price and sale price.
- Accountant can modify sale price.
- Accountant cannot view or modify purchase price.
- Price changes affect **future sales only**.
- Historical sales retain the price that was used at the time of the sale.

---

#### Stock Management

Stock is managed through **stock movements** rather than arbitrary manual changes.

A stock movement conceptually contains:

```text
id
product
warehouse
type
quantity
reference
date
user
```

The movement types currently required are:

```text
SALE
TRANSFER_IN
TRANSFER_OUT
ADJUSTMENT
```

Manual stock adjustments are allowed for:

- Accountant.
- Manager.

An adjustment:

- Can increase or decrease stock.
- Requires a reason.
- Does not require approval.
- Must be recorded as a stock movement.
- Must be included in the audit trail.

---

#### Sales

Sales are created by accountants and can be edited by accountants and managers.

Sale lifecycle:

```text
Create Sale
    ↓
Select Products
    ↓
Check Available Stock
    ↓
Enough Stock?
 ┌──┴───────────┐
 NO             YES
 ↓               ↓
Reject Product   Add Product
                 ↓
              Save Sale
                 ↓
            Update Stock
                 ↓
            Print Invoice
```

A product cannot be added to a sale when the available warehouse stock is insufficient.

When the sale is saved, inventory is updated.

#### Editing sales

Sales remain editable after creation.

For each product, the application compares the old quantity with the new quantity.

Example:

```text
Old quantity: 20
New quantity: 10
```

The quantity decreased by 10, so:

```text
Stock +10
```

No additional stock check is required.

When:

```text
Old quantity: 20
New quantity: 30
```

The quantity increased by 10, so:

```text
Check available stock
        ↓
Enough?
 ├── NO → Reject modification
 └── YES → Stock -10
```

Therefore:

```text
new_quantity > old_quantity
    → check stock
    → deduct difference

new_quantity < old_quantity
    → no stock check
    → return difference to stock

new_quantity = old_quantity
    → no stock operation
```

Sales corrections must not erase the historical event. Changes should remain traceable through audit logging.

---

#### Warehouse Transfers

Transfers occur between warehouses.

Transfer lifecycle:

```text
Warehouse A creates request
          ↓
Warehouse B receives request
          ↓
Warehouse B approves request
          ↓
Warehouse B checks its stock
          ↓
Warehouse B decides what quantity it can provide
          ↓
Warehouse A receives the products
          ↓
Warehouse A confirms the transfer
          ↓
Stock is updated
```

Example:

Warehouse A requests:

```text
Hammer: 7
Drill: 20
```

Warehouse B determines that it can provide:

```text
Hammer: 6
Drill: 10
```

The transfer therefore records:

```text
Product    Requested    Sent/Approved
Hammer         7              6
Drill         20             10
```

The source warehouse does not necessarily fulfill the complete request.

There is **no concept of "goods physically in transit" in the application's business model**.

There is also no discrepancy workflow for sent versus received quantities because, according to the defined real-world process, Warehouse A receives exactly what Warehouse B sent.

The transfer item therefore requires at minimum:

```text
requested_quantity
approved_quantity
```

Stock is updated only when Warehouse A confirms the transfer:

```text
Source warehouse:
TRANSFER_OUT

Destination warehouse:
TRANSFER_IN
```

Transfer actions available to Managers:

- Create transfer.
- Approve transfer.
- Confirm transfer.
- Decline transfer.
- Cancel transfer.

---

#### Warehouse Expenses

Expenses belong to a specific warehouse.

Initial expense categories include:

- Electricity.
- Water.
- Rent.
- Fuel.
- Maintenance.
- Other operating expenses.

Expense lifecycle:

```text
Manager creates expense
        ↓
Expense recorded
        ↓
Included in warehouse financial reports
```

No approval workflow is required.

Managers are responsible for warehouse expenses.

---

#### Employees and Salaries

Each warehouse has its own employees.

The Manager is responsible for the HR section.

Each employee has:

- A fixed monthly salary.
- Two holiday bonuses.

The Manager can:

- Manage employees.
- Record salaries.
- Record bonuses.
- Modify salaries.
- Modify bonuses.

Salary and bonus information must appear in the appropriate financial reports.

---

#### Reports

##### Stock Reports

- Stock by warehouse.
- Stock valuation.
- Low-stock products.
- Out-of-stock products.
- Stock movements.
- Fast-moving products.
- Slow-moving products.

##### Sales Reports

- Sales by day.
- Sales by warehouse.
- Sales by accountant.

##### Financial Reports

- Revenue.
- Gross profit.
- Expenses.
- Net profit.
- Salaries.

The Admin can view reports:

- For an individual warehouse.
- For all warehouses combined.
- As warehouse comparisons.

---

#### Audit Log

Important operations must be recorded.

At minimum:

```text
who
what
when
where
```

Examples:

```text
Sale created
Sale modified
Sale deleted
Stock adjusted
Product price changed
Transfer created
Transfer approved
Transfer declined
Transfer cancelled
Transfer confirmed
Expense created
Employee modified
Salary modified
User created
Warehouse created
```

For important modifications, the audit system should ideally also preserve relevant before/after values.

---

### 1.4 Revenue Model

For the current project, the application is an **internal business system**, not a commercial SaaS product.

Therefore:

**Application revenue model: Not applicable for the initial implementation.**

The company's actual revenue comes from:

> Distribution and sales of the represented tool brand in Algeria.

If the software is later turned into a commercial product for other distributors, possible models would include:

- Monthly/annual SaaS subscription.
- Per-warehouse pricing.
- One-time enterprise license plus maintenance.
- Hosted deployment and support contracts.

This is a future business possibility, not a confirmed requirement.

---

### 1.5 Competitive Landscape / Differentiation

The application will compete conceptually with:

- Generic inventory-management software.
- Generic ERP systems.
- POS/inventory systems.
- Warehouse-management systems.
- Custom business-management software.

The proposed differentiation is not "having inventory management"; many products already do that.

The differentiation should be:

**Built specifically around the operational reality of a multi-warehouse national tool distributor.**

Important differentiators include:

- Multiple independent warehouses under one company.
- Warehouse-specific stock.
- Warehouse-to-warehouse transfer workflow.
- Source warehouse deciding fulfillment quantities.
- Destination warehouse confirming transfers.
- Role-based warehouse isolation.
- Super Manager cross-warehouse stock visibility.
- Product price permissions.
- Stock movement-based inventory.
- Editable sales with correct inventory reconciliation.
- Warehouse-specific HR and expenses.
- Unified management dashboard.
- Detailed audit trail.

The goal should be **business correctness and simplicity**, not trying to reproduce every feature found in a large generic ERP.

---

### 1.6 Risks, Assumptions, and Open Questions

#### Confirmed assumptions

- The company has multiple warehouses.
- A warehouse has its own stock.
- A warehouse can sell products.
- Warehouses can transfer products between each other.
- Stock cannot become negative.
- Sales reduce stock.
- Confirmed transfers update source and destination stock.
- Manual stock adjustments are allowed.
- Stock adjustments require a reason.
- Sales can be corrected after creation.
- Managers and accountants can edit sales.
- Managers and accountants can adjust stock.
- Managers manage warehouse HR.
- Every employee has a fixed monthly salary.
- Employees have two holiday bonuses.
- Managers manage expenses.
- Price changes affect future sales only.
- There is no transit-stock concept.
- There is no sent-vs-received discrepancy process.

#### Important open questions

These have not yet been fully specified and should be resolved before database implementation:

1. **Sale deletion**
   - What exactly happens to stock when a sale is deleted?
   - Is deletion a true delete or a cancellation/reversal?
   - Who can delete a sale and under what conditions?

2. **Transfer cancellation**
   - At which stages can a transfer be cancelled?
   - What happens if it has already been approved?
   - What happens if the destination has already confirmed it?

3. **Transfer decline**
   - Can the source warehouse decline the entire request?
   - Is a reason required?

4. **Inventory valuation**
   - The system needs a defined method for calculating stock value and gross profit.
   - Weighted-average cost is a strong candidate, but this is not yet a confirmed business decision.

5. **Invoice requirements**
   - Required invoice fields.
   - Invoice numbering format.
   - Taxes/VAT, if applicable.
   - Company legal information.
   - Customer information.
   - Whether invoices need to comply with specific Algerian accounting/tax requirements.

6. **Employee salary details**
   - Salary payment date.
   - Salary status.
   - Bonus schedule.
   - Possible deductions.
   - Whether salary history must be preserved.

7. **Authentication**
   - Password policy.
   - Password reset.
   - Session expiration.
   - Whether multi-factor authentication is required.

8. **Backup and disaster recovery**
   - Backup frequency.
   - Backup location.
   - Recovery procedure.
   - Whether the application must continue operating during internet/server outages.

9. **Low-stock threshold**
   - Whether each product has one global minimum stock value.
   - Or whether each warehouse has its own minimum stock threshold.

10. **Customer records**
   - The current specification includes sales and invoices but does not yet define whether customers will have persistent records/accounts.

11. **Supplier/purchase management**
   - Products have purchase prices, but a complete purchasing/supplier workflow has not yet been defined.

---

# 2. APPLICATION SPECS

## 2.1 Functional Requirements

### Authentication

Users log in to the centralized application.

Every authenticated user has:

- User account.
- Role.
- Assigned warehouse when applicable.
- Permissions based on role and warehouse relationship.

Authorization must be enforced on the backend rather than relying only on the frontend. This is particularly important because a user must never be able to manipulate another warehouse's data merely by changing an ID in an API request. OWASP recommends server-side authorization enforcement, deny-by-default policies, least privilege, and testing authorization rules.

---

## 2.2 Role / Permission Model

### Accountant

For assigned warehouse:

```text
View stock
Create sale
Edit sale
Delete sale
Adjust stock
Change sale price
Print invoices
View relevant financial information
```

The accountant cannot:

```text
View purchase price
Change purchase price
Manage employees
Manage salaries
Manage warehouse expenses
Create/approve/confirm transfers
```

---

### Manager

For assigned warehouse:

```text
Everything Accountant can do
+
Create transfer
Approve transfer
Confirm transfer
Decline transfer
Cancel transfer
Manage employees
Manage salaries
Manage bonuses
Manage expenses
View financial reports
View total sales today
View total sales this month
View total stock value
Change purchase price
```

---

### Super Manager

Everything the Manager can do for their warehouse, plus:

```text
View stock in other warehouses
```

The visibility into other warehouses is **read-only**.

---

### Admin

Global access:

```text
Global dashboard
View all warehouses
View all stock
View all sales
View all expenses
View all salaries
Create users
Create warehouses
Assign users to warehouses
View financial reports
View individual warehouse reports
View consolidated reports
Compare warehouses
Manage global configuration
View audit logs
```

---

## 2.3 Core Screens

### Authentication

```text
Login
Logout
Session / authentication state
```

### Dashboard

Global or warehouse-specific depending on role.

### Warehouses

```text
Warehouse list
Warehouse details
Warehouse stock
Warehouse users/employees
Warehouse sales
Warehouse expenses
Warehouse transfers
Warehouse reports
```

### Products

```text
Product list
Create product
Edit product
Product details
Stock by warehouse
Price management
```

### Stock

```text
Current stock
Stock movements
Stock adjustments
Low stock
Out of stock
Stock valuation
```

### Sales

```text
Sale list
Create sale
Sale details
Edit sale
Delete/cancel sale
Print invoice
Sales reports
```

### Transfers

```text
Transfer list
Create transfer
Transfer request details
Approve
Decline
Cancel
Confirm reception
Transfer history
```

### Employees / HR

```text
Employee list
Create employee
Edit employee
Employee details
Salary records
Holiday bonuses
```

### Expenses

```text
Expense list
Create expense
Edit expense
Expense details
Expense reports
```

### Reports

```text
Stock reports
Sales reports
Financial reports
Warehouse comparison
```

### Administration

```text
Users
Roles / permissions
Warehouses
User-to-warehouse assignment
Audit logs
```

---

## 2.4 Key Business Rules

### Stock cannot become negative

Every operation that decreases stock must validate availability.

This validation must occur **atomically at the backend/database level**, not only in Vue.

---

### Sales and inventory must be transactional

Creating a sale should result in:

```text
Sale created
+
Sale items created
+
Stock movements created
+
Stock quantities updated
```

as one transaction.

The application should never produce a successfully saved sale while failing to update its corresponding inventory.

---

### Editing sales must reconcile inventory

The difference between the old and new quantity determines the inventory adjustment.

```text
New > Old
→ stock decreases by difference
→ availability required

New < Old
→ stock increases by difference
→ availability check unnecessary
```

---

### Stock adjustment

```text
Increase or decrease allowed
Reason mandatory
No approval
Stock movement created
Audit log created
```

---

### Product price history

A product's current sale price may change.

Historical sales must retain the actual unit price used when they occurred.

Therefore, `sale_item.unit_price` should be stored independently of the current product sale price.

---

### Warehouse isolation

Managers and accountants must be restricted to their assigned warehouse.

A manager must not be able to manipulate Warehouse B merely by changing a warehouse identifier supplied to an API endpoint.

Super Manager is explicitly granted read-only stock visibility across warehouses.

---

## 2.5 Non-Functional Requirements

### Security

Recommended baseline:

- HTTPS in production.
- Secure password hashing.
- Server-side authorization.
- Warehouse-level authorization.
- Role-based permissions with resource-level restrictions.
- Secure session/token handling.
- Input validation.
- Database constraints.
- Audit logging.
- Protection against IDOR/horizontal privilege escalation.
- Protection against SQL injection.
- CSRF protection where applicable.
- Secure HTTP headers.
- Rate limiting for authentication endpoints.
- No sensitive data in client-side authorization decisions.

OWASP specifically recommends enforcing authorization server-side, applying least privilege, denying by default, and testing authorization logic.

---

### Concurrency

Concurrent stock operations must be handled safely.

Example:

```text
Warehouse stock = 10

Accountant A sells 7
Accountant B sells 5
```

The application must prevent both operations from successfully consuming the same 10 units.

Stock-changing operations should therefore use:

- Database transactions.
- Appropriate row-level locking or optimistic concurrency controls.
- Atomic stock validation/update logic.
- Tests for concurrent operations.

The backend/database, not the browser, is ultimately responsible for guaranteeing this rule.

---

### Performance

The system should remain responsive with:

- Multiple warehouses.
- Many products.
- Large sales history.
- Large stock movement history.
- Multiple simultaneous users.

Indexes should be designed around common queries such as:

```text
warehouse_id + product_id
product_id + date
warehouse_id + date
sale_id
transfer_id
user_id + date
```

---

### Reliability

The application should provide:

- Database transactions for financial and inventory operations.
- Automated backups.
- Restore procedures.
- Error logging.
- Health monitoring.
- Auditability.

Spring Boot provides production-oriented capabilities including health checks and metrics, and the Spring documentation specifically points to Actuator for production health, auditing, and metrics endpoints.

---

### Platform

Primary target:

```text
Web browser
Desktop/laptop computers
```

Recommended browser support:

```text
Chrome
Edge
Firefox
```

A responsive design is useful, but the primary users are expected to operate the system from desktop computers in warehouse/office environments.

---

### Scalability

The first version should support:

```text
Multiple warehouses
Multiple users
Concurrent users
Large stock movement history
Large sales history
```

The architecture should allow additional warehouses to be added without changing the application architecture.

---

## 2.6 Recommended Tech Stack

### Frontend

```text
Vue 3
TypeScript
Vite
Pinia
Vue Router
Axios
```

Vue officially supports TypeScript and recommends Vite-based scaffolding for new Vue applications; `vue-tsc` should be used for Vue-aware type checking.

---

### Backend

```text
Java
Spring Boot
Spring Security
Spring Data JPA
Hibernate
Bean Validation
Maven
```

Spring Boot is a strong fit because the project needs a production-oriented Java backend with security, data access, transactions, configuration, health monitoring, and API development.

---

### Database

```text
PostgreSQL
```

Recommended over SQLite because this system is:

- Multi-user.
- Multi-warehouse.
- Concurrent.
- Transaction-heavy.
- Centralized.

Inventory and financial operations should rely heavily on database transactions and concurrency controls.

---

### Infrastructure

Recommended initial deployment:

```text
Linux server
Docker
Docker Compose
Nginx
PostgreSQL
Spring Boot
Vue static frontend
```

Initial architecture:

```text
Browser
   ↓
Nginx
   ├── Vue Frontend
   └── Spring Boot API
             ↓
        PostgreSQL
```

---

### Desktop Application

Tauri is **not required for the first version**.

This is fundamentally a web application, so it should remain a browser-based system initially.

A desktop wrapper can be considered later if there is a real business need for it.

---

## 2.7 Data Model / Key Entities

### users

```text
id
username
password_hash
role_id
warehouse_id
active
created_at
updated_at
```

---

### roles

```text
id
name
```

Possible roles:

```text
ADMIN
MANAGER
SUPER_MANAGER
ACCOUNTANT
```

---

### warehouses

```text
id
name
code
address
phone
active
created_at
updated_at
```

---

### products

```text
id
reference
name
brand
purchase_price
sale_price
unit
active
created_at
updated_at
```

`box_size` is intentionally excluded.

---

### stock

A current-stock representation can be maintained for efficient reads:

```text
id
warehouse_id
product_id
quantity
updated_at
```

There should be a unique constraint on:

```text
warehouse_id + product_id
```

---

### stock_movements

```text
id
warehouse_id
product_id
type
quantity
reference_type
reference_id
created_by
reason
created_at
```

Potential movement types:

```text
SALE
TRANSFER_IN
TRANSFER_OUT
ADJUSTMENT
```

Positive/negative quantity conventions should be standardized during implementation.

---

### sales

```text
id
warehouse_id
invoice_number
created_by
customer information / reference
total_amount
sale_date
status
created_at
updated_at
```

---

### sale_items

```text
id
sale_id
product_id
quantity
unit_price
subtotal
```

`unit_price` must be stored here so historical sales are not changed when the product's current sale price changes.

---

### transfers

```text
id
source_warehouse_id
destination_warehouse_id
created_by
status
created_at
approved_at
confirmed_at
```

Possible statuses:

```text
REQUESTED
APPROVED
CONFIRMED
DECLINED
CANCELLED
```

---

### transfer_items

```text
id
transfer_id
product_id
requested_quantity
approved_quantity
```

The current business model does not require:

```text
in_transit_quantity
received_quantity
discrepancy_quantity
```

because Warehouse A confirms exactly what Warehouse B sent.

---

### employees

```text
id
warehouse_id
first_name
last_name
position
phone
hire_date
monthly_salary
active
created_at
updated_at
```

---

### salary_records

```text
id
employee_id
warehouse_id
period
base_salary
bonus_1
bonus_2
total_amount
payment_date
status
created_by
created_at
updated_at
```

The exact structure of the two holiday bonuses can be refined later.

---

### expenses

```text
id
warehouse_id
category
amount
description
expense_date
created_by
created_at
updated_at
```

Example categories:

```text
ELECTRICITY
WATER
RENT
FUEL
MAINTENANCE
OTHER
```

---

### audit_logs

```text
id
user_id
action
entity_type
entity_id
warehouse_id
old_values
new_values
description
created_at
```

This provides traceability for important business operations.

---

### Future entities

Not required for the initial MVP because they have not yet been fully defined:

```text
customers
suppliers
purchase_orders
purchases
payments
tax_records
```

They can be added once the business requirements are clarified.

---

## 2.8 Third-Party Integrations / APIs

### Required for MVP

No major external API is required.

The core application can operate using:

```text
Vue
Spring Boot
PostgreSQL
```

### Useful integrations

**Invoice PDF generation**

For printing/downloading invoices.

Possible implementation options:

- Server-generated PDF.
- Browser print stylesheet.

**Barcode scanners**

Most USB barcode scanners behave like keyboards, so no special external API is required for the basic workflow.

**Printer**

Standard browser printing should be sufficient initially.

**Backup storage**

Could later integrate:

```text
S3-compatible storage
Cloud storage
NAS
```

for database backup archives.

### Not required initially

```text
WhatsApp API
SMS API
Payment gateway
External accounting API
External ERP integration
```

unless business requirements later demand them.

---

## 2.9 MVP Scope

The MVP should concentrate on the operational core.

### MVP includes

```text
Authentication
Users
Roles
Warehouses
Products
Warehouse stock
Stock movements
Stock adjustments
Sales
Sale editing
Invoice printing
Transfers
Expenses
Employees
Salaries
Holiday bonuses
Dashboard
Stock reports
Sales reports
Financial reports
Audit logs
```

### MVP role scope

```text
Admin
Manager
Super Manager
Accountant
```

### MVP inventory rules

```text
No negative stock
Transactional stock updates
Sale stock deduction
Sale correction logic
Transfer workflow
Manual adjustments with mandatory reason
Concurrency protection
```

---

## 2.10 Later Phases

Potential future functionality:

### Phase 2

```text
Customer management
Supplier management
Purchasing
Purchase invoices
Supplier debts
Customer debts
Payments
Advanced financial reporting
```

### Phase 3

```text
Barcode-first workflows
Advanced inventory analytics
Forecasting
Automatic reorder suggestions
Advanced warehouse analytics
Mobile/PWA access
```

### Phase 4

```text
Commercial SaaS version
Multi-company support
Subscription management
Cloud onboarding
Tenant isolation
```

These should not be added to the MVP until the core warehouse/sales system is stable.

---

# 3. PROJECT FILE/FOLDER STRUCTURE

## 3.1 Recommended Repository

A monorepo is appropriate:

```text
tool-distributor-management/
├── README.md                              # Project documentation and setup instructions.
├── .gitignore                             # Git exclusions.
├── .env.example                           # Example environment configuration.
├── docker-compose.yml                     # Local/production service orchestration.
├── docs/
│   ├── business-rules.md                  # Confirmed business rules and workflows.
│   ├── roles-permissions.md               # Role and permission matrix.
│   ├── database.md                        # Database design documentation.
│   ├── api.md                              # API documentation.
│   └── deployment.md                       # Deployment and server documentation.
│
├── backend/
│   ├── pom.xml                            # Maven project configuration.
│   ├── Dockerfile                          # Backend container image definition.
│   └── src/
│       ├── main/
│       │   ├── java/
│       │   │   └── dz/company/distributor/
│       │   │       ├── DistributorApplication.java
│       │   │       │   # Spring Boot application entry point.
│       │   │       │
│       │   │       ├── config/
│       │   │       │   ├── SecurityConfig.java
│       │   │       │   │   # Spring Security configuration.
│       │   │       │   ├── CorsConfig.java
│       │   │       │   │   # CORS configuration.
│       │   │       │   ├── JacksonConfig.java
│       │   │       │   │   # JSON serialization configuration.
│       │   │       │   └── OpenApiConfig.java
│       │   │       │       # OpenAPI/Swagger configuration.
│       │   │       │
│       │   │       ├── security/
│       │   │       │   ├── CustomUserDetailsService.java
│       │   │       │   │   # Loads authenticated users.
│       │   │       │   ├── JwtAuthenticationFilter.java
│       │   │       │   │   # Processes authentication tokens.
│       │   │       │   ├── JwtService.java
│       │   │       │   │   # Creates and validates tokens.
│       │   │       │   └── AuthEntryPoint.java
│       │   │       │       # Handles unauthorized requests.
│       │   │       │
│       │   │       ├── common/
│       │   │       │   ├── exception/
│       │   │       │   │   ├── GlobalExceptionHandler.java
│       │   │       │   │   │   # Global REST exception handling.
│       │   │       │   │   ├── ResourceNotFoundException.java
│       │   │       │   │   │   # Missing-resource exception.
│       │   │       │   │   ├── BusinessException.java
│       │   │       │   │   │   # Business-rule exception.
│       │   │       │   │   └── InsufficientStockException.java
│       │   │       │   │       # Insufficient inventory exception.
│       │   │       │   │
│       │   │       │   ├── response/
│       │   │       │   │   └── ApiResponse.java
│       │   │       │   │       # Standard API response structure.
│       │   │       │   │
│       │   │       │   └── audit/
│       │   │       │       ├── AuditService.java
│       │   │       │       │   # Records important business actions.
│       │   │       │       └── AuditEntry.java
│       │   │       │           # Audit event model.
│       │   │       │
│       │   │       ├── auth/
│       │   │       │   ├── AuthController.java
│       │   │       │   │   # Login/logout authentication endpoints.
│       │   │       │   ├── AuthService.java
│       │   │       │   │   # Authentication business logic.
│       │   │       │   ├── LoginRequest.java
│       │   │       │   │   # Login request DTO.
│       │   │       │   └── LoginResponse.java
│       │   │       │       # Login response DTO.
│       │   │       │
│       │   │       ├── users/
│       │   │       │   ├── User.java
│       │   │       │   │   # User entity.
│       │   │       │   ├── Role.java
│       │   │       │   │   # User role entity.
│       │   │       │   ├── Permission.java
│       │   │       │   │   # Permission definition.
│       │   │       │   ├── UserRepository.java
│       │   │       │   │   # User database access.
│       │   │       │   ├── UserService.java
│       │   │       │   │   # User management logic.
│       │   │       │   └── UserController.java
│       │   │       │       # User administration endpoints.
│       │   │       │
│       │   │       ├── warehouses/
│       │   │       │   ├── Warehouse.java
│       │   │       │   │   # Warehouse entity.
│       │   │       │   ├── WarehouseRepository.java
│       │   │       │   │   # Warehouse database access.
│       │   │       │   ├── WarehouseService.java
│       │   │       │   │   # Warehouse business logic.
│       │   │       │   └── WarehouseController.java
│       │   │       │       # Warehouse endpoints.
│       │   │       │
│       │   │       ├── products/
│       │   │       │   ├── Product.java
│       │   │       │   │   # Product entity.
│       │   │       │   ├── ProductRepository.java
│       │   │       │   │   # Product database access.
│       │   │       │   ├── ProductService.java
│       │   │       │   │   # Product business logic.
│       │   │       │   ├── ProductController.java
│       │   │       │   │   # Product endpoints.
│       │   │       │   └── dto/
│       │   │       │       ├── ProductRequest.java
│       │   │       │       │   # Product create/update request.
│       │   │       │       └── ProductResponse.java
│       │   │       │           # Product API response.
│       │   │       │
│       │   │       ├── inventory/
│       │   │       │   ├── Stock.java
│       │   │       │   │   # Current product quantity per warehouse.
│       │   │       │   ├── StockMovement.java
│       │   │       │   │   # Inventory movement history.
│       │   │       │   ├── StockMovementType.java
│       │   │       │   │   # Inventory movement types.
│       │   │       │   ├── StockRepository.java
│       │   │       │   │   # Current stock database access.
│       │   │       │   ├── StockMovementRepository.java
│       │   │       │   │   # Movement history database access.
│       │   │       │   ├── InventoryService.java
│       │   │       │   │   # Central inventory business logic.
│       │   │       │   ├── StockAdjustmentService.java
│       │   │       │   │   # Manual stock adjustment logic.
│       │   │       │   └── InventoryController.java
│       │   │       │       # Inventory endpoints.
│       │   │       │
│       │   │       ├── sales/
│       │   │       │   ├── Sale.java
│       │   │       │   │   # Sale entity.
│       │   │       │   ├── SaleItem.java
│       │   │       │   │   # Sale line item entity.
│       │   │       │   ├── SaleRepository.java
│       │   │       │   │   # Sale database access.
│       │   │       │   ├── SaleService.java
│       │   │       │   │   # Sale creation/editing business logic.
│       │   │       │   ├── SaleController.java
│       │   │       │   │   # Sales API endpoints.
│       │   │       │   └── dto/
│       │   │       │       ├── CreateSaleRequest.java
│       │   │       │       │   # New sale request.
│       │   │       │       ├── UpdateSaleRequest.java
│       │   │       │       │   # Sale modification request.
│       │   │       │       └── SaleResponse.java
│       │   │       │           # Sale API response.
│       │   │       │
│       │   │       ├── transfers/
│       │   │       │   ├── Transfer.java
│       │   │       │   │   # Warehouse transfer entity.
│       │   │       │   ├── TransferItem.java
│       │   │       │   │   # Transfer line item entity.
│       │   │       │   ├── TransferStatus.java
│       │   │       │   │   # Transfer lifecycle statuses.
│       │   │       │   ├── TransferRepository.java
│       │   │       │   │   # Transfer database access.
│       │   │       │   ├── TransferService.java
│       │   │       │   │   # Transfer workflow logic.
│       │   │       │   └── TransferController.java
│       │   │       │       # Transfer endpoints.
│       │   │       │
│       │   │       ├── employees/
│       │   │       │   ├── Employee.java
│       │   │       │   │   # Employee entity.
│       │   │       │   ├── EmployeeRepository.java
│       │   │       │   │   # Employee database access.
│       │   │       │   ├── EmployeeService.java
│       │   │       │   │   # Employee management logic.
│       │   │       │   └── EmployeeController.java
│       │   │       │       # HR endpoints.
│       │   │       │
│       │   │       ├── salaries/
│       │   │       │   ├── SalaryRecord.java
│       │   │       │   │   # Monthly salary record.
│       │   │       │   ├── SalaryRepository.java
│       │   │       │   │   # Salary database access.
│       │   │       │   ├── SalaryService.java
│       │   │       │   │   # Salary and bonus business logic.
│       │   │       │   └── SalaryController.java
│       │   │       │       # Salary endpoints.
│       │   │       │
│       │   │       ├── expenses/
│       │   │       │   ├── Expense.java
│       │   │       │   │   # Warehouse expense entity.
│       │   │       │   ├── ExpenseCategory.java
│       │   │       │   │   # Expense categories.
│       │   │       │   ├── ExpenseRepository.java
│       │   │       │   │   # Expense database access.
│       │   │       │   ├── ExpenseService.java
│       │   │       │   │   # Expense business logic.
│       │   │       │   └── ExpenseController.java
│       │   │       │       # Expense endpoints.
│       │   │       │
│       │   │       ├── reports/
│       │   │       │   ├── DashboardService.java
│       │   │       │   │   # Dashboard calculations.
│       │   │       │   ├── StockReportService.java
│       │   │       │   │   # Stock reporting.
│       │   │       │   ├── SalesReportService.java
│       │   │       │   │   # Sales reporting.
│       │   │       │   ├── FinancialReportService.java
│       │   │       │   │   # Financial reporting.
│       │   │       │   └── ReportController.java
│       │   │       │       # Report endpoints.
│       │   │       │
│       │   │       └── audit/
│       │   │           ├── AuditLog.java
│       │   │           │   # Persistent audit log entity.
│       │   │           ├── AuditLogRepository.java
│       │   │           │   # Audit log database access.
│       │   │           └── AuditLogController.java
│       │   │               # Admin audit-log endpoints.
│       │   │
│       │   └── resources/
│       │       ├── application.yml
│       │       │   # Application configuration.
│       │       ├── application-dev.yml
│       │       │   # Development configuration.
│       │       ├── application-prod.yml
│       │       │   # Production configuration.
│       │       └── db/
│       │           └── migration/
│       │               ├── V1__create_users_and_roles.sql
│       │               │   # Authentication and authorization tables.
│       │               ├── V2__create_warehouses.sql
│       │               │   # Warehouse tables.
│       │               ├── V3__create_products.sql
│       │               │   # Product tables.
│       │               ├── V4__create_inventory.sql
│       │               │   # Stock and movement tables.
│       │               ├── V5__create_sales.sql
│       │               │   # Sales tables.
│       │               ├── V6__create_transfers.sql
│       │               │   # Transfer tables.
│       │               ├── V7__create_employees.sql
│       │               │   # Employee tables.
│       │               ├── V8__create_salaries.sql
│       │               │   # Salary and bonus tables.
│       │               ├── V9__create_expenses.sql
│       │               │   # Expense tables.
│       │               └── V10__create_audit_logs.sql
│       │                   # Audit tables.
│       │
│       └── test/
│           └── java/
│               └── dz/company/distributor/
│                   ├── inventory/
│                   │   ├── InventoryConcurrencyTest.java
│                   │   │   # Concurrent stock modification tests.
│                   │   ├── StockAdjustmentTest.java
│                   │   │   # Stock adjustment business-rule tests.
│                   │   └── InsufficientStockTest.java
│                   │       # Negative-stock prevention tests.
│                   ├── sales/
│                   │   ├── SaleCreationTest.java
│                   │   │   # Sale creation tests.
│                   │   └── SaleModificationTest.java
│                   │       # Sale inventory correction tests.
│                   ├── transfers/
│                   │   └── TransferWorkflowTest.java
│                   │       # Transfer lifecycle tests.
│                   └── security/
│                       └── AuthorizationTest.java
│                           # Role and warehouse authorization tests.
│
├── frontend/
│   ├── package.json                        # Frontend dependencies and scripts.
│   ├── vite.config.ts                     # Vite configuration.
│   ├── tsconfig.json                      # TypeScript configuration.
│   ├── tsconfig.app.json                  # Application TypeScript configuration.
│   ├── tsconfig.node.json                 # Node/Vite TypeScript configuration.
│   ├── index.html                         # Frontend HTML entry point.
│   ├── Dockerfile                         # Frontend container image definition.
│   ├── .env.example                       # Frontend environment example.
│   │
│   └── src/
│       ├── main.ts                        # Vue application entry point.
│       ├── App.vue                        # Root application component.
│       │
│       ├── router/
│       │   └── index.ts                   # Application routes and route guards.
│       │
│       ├── stores/
│       │   ├── auth.store.ts              # Authentication state.
│       │   ├── warehouse.store.ts         # Current warehouse state.
│       │   ├── product.store.ts           # Product state.
│       │   ├── inventory.store.ts         # Inventory state.
│       │   ├── sale.store.ts              # Sales state.
│       │   └── dashboard.store.ts         # Dashboard state.
│       │
│       ├── services/
│       │   ├── api.ts                     # Axios/API client configuration.
│       │   ├── auth.service.ts            # Authentication API calls.
│       │   ├── warehouse.service.ts       # Warehouse API calls.
│       │   ├── product.service.ts         # Product API calls.
│       │   ├── inventory.service.ts       # Inventory API calls.
│       │   ├── sale.service.ts            # Sales API calls.
│       │   ├── transfer.service.ts        # Transfer API calls.
│       │   ├── employee.service.ts        # HR API calls.
│       │   ├── salary.service.ts          # Salary API calls.
│       │   ├── expense.service.ts         # Expense API calls.
│       │   └── report.service.ts          # Reporting API calls.
│       │
│       ├── types/
│       │   ├── auth.ts                    # Authentication TypeScript types.
│       │   ├── user.ts                    # User and role types.
│       │   ├── warehouse.ts               # Warehouse types.
│       │   ├── product.ts                 # Product types.
│       │   ├── inventory.ts               # Inventory types.
│       │   ├── sale.ts                    # Sale types.
│       │   ├── transfer.ts                # Transfer types.
│       │   ├── employee.ts                # Employee types.
│       │   ├── salary.ts                  # Salary types.
│       │   ├── expense.ts                 # Expense types.
│       │   └── report.ts                  # Report types.
│       │
│       ├── layouts/
│       │   ├── AuthLayout.vue             # Layout for authentication pages.
│       │   └── DashboardLayout.vue        # Main authenticated application layout.
│       │
│       ├── components/
│       │   ├── common/
│       │   │   ├── AppButton.vue          # Shared button component.
│       │   │   ├── AppModal.vue           # Shared modal component.
│       │   │   ├── AppTable.vue           # Shared table component.
│       │   │   ├── AppPagination.vue      # Shared pagination component.
│       │   │   ├── AppSearch.vue          # Shared search component.
│       │   │   ├── LoadingSpinner.vue     # Loading indicator.
│       │   │   └── ConfirmDialog.vue       # Confirmation dialog.
│       │   │
│       │   ├── dashboard/
│       │   │   ├── MetricCard.vue         # Dashboard metric card.
│       │   │   ├── WarehouseComparison.vue # Warehouse comparison display.
│       │   │   └── LowStockWidget.vue     # Low-stock dashboard widget.
│       │   │
│       │   ├── inventory/
│       │   │   ├── StockTable.vue         # Current stock table.
│       │   │   ├── StockMovementTable.vue # Movement history table.
│       │   │   └── StockAdjustmentForm.vue # Stock adjustment form.
│       │   │
│       │   ├── sales/
│       │   │   ├── SaleForm.vue           # Sale creation/editing form.
│       │   │   ├── SaleItemsTable.vue     # Sale product lines.
│       │   │   └── InvoicePreview.vue     # Printable invoice preview.
│       │   │
│       │   └── transfers/
│       │       ├── TransferForm.vue       # Transfer request form.
│       │       ├── TransferItemsTable.vue # Transfer items.
│       │       └── TransferActions.vue    # Approve/decline/confirm/cancel controls.
│       │
│       ├── views/
│       │   ├── auth/
│       │   │   └── LoginView.vue           # Login screen.
│       │   │
│       │   ├── dashboard/
│       │   │   ├── AdminDashboardView.vue # Global admin dashboard.
│       │   │   └── WarehouseDashboardView.vue # Manager/accountant dashboard.
│       │   │
│       │   ├── warehouses/
│       │   │   ├── WarehouseListView.vue   # Warehouse administration.
│       │   │   └── WarehouseDetailsView.vue # Warehouse details.
│       │   │
│       │   ├── products/
│       │   │   ├── ProductListView.vue     # Product listing.
│       │   │   ├── ProductCreateView.vue   # Product creation.
│       │   │   └── ProductEditView.vue     # Product editing.
│       │   │
│       │   ├── inventory/
│       │   │   ├── StockView.vue           # Warehouse stock.
│       │   │   ├── StockMovementsView.vue  # Stock movement history.
│       │   │   └── StockAdjustmentView.vue # Stock adjustment screen.
│       │   │
│       │   ├── sales/
│       │   │   ├── SalesListView.vue       # Sales history.
│       │   │   ├── CreateSaleView.vue     # New sale screen.
│       │   │   ├── EditSaleView.vue       # Sale editing screen.
│       │   │   └── SaleDetailsView.vue     # Sale details.
│       │   │
│       │   ├── transfers/
│       │   │   ├── TransferListView.vue    # Transfer list.
│       │   │   ├── CreateTransferView.vue # Create transfer request.
│       │   │   └── TransferDetailsView.vue # Transfer workflow screen.
│       │   │
│       │   ├── employees/
│       │   │   ├── EmployeeListView.vue    # Employee list.
│       │   │   └── EmployeeDetailsView.vue # Employee details.
│       │   │
│       │   ├── salaries/
│       │   │   └── SalaryManagementView.vue # Salary and bonus management.
│       │   │
│       │   ├── expenses/
│       │   │   ├── ExpenseListView.vue     # Expense list.
│       │   │   └── CreateExpenseView.vue   # Expense creation.
│       │   │
│       │   ├── reports/
│       │   │   ├── StockReportsView.vue    # Stock reports.
│       │   │   ├── SalesReportsView.vue    # Sales reports.
│       │   │   └── FinancialReportsView.vue # Financial reports.
│       │   │
│       │   └── admin/
│       │       ├── UsersView.vue           # User administration.
│       │       ├── RolesView.vue           # Role/permission administration.
│       │       └── AuditLogsView.vue       # Audit-log viewer.
│       │
│       ├── composables/
│       │   ├── useAuth.ts                  # Authentication helpers.
│       │   ├── usePermissions.ts           # Permission checking helpers.
│       │   ├── useWarehouse.ts             # Warehouse context helpers.
│       │   └── usePagination.ts            # Pagination helpers.
│       │
│       ├── utils/
│       │   ├── currency.ts                 # Currency formatting utilities.
│       │   ├── date.ts                     # Date formatting utilities.
│       │   ├── validation.ts               # Client-side validation helpers.
│       │   └── permissions.ts              # Permission-related utilities.
│       │
│       └── assets/
│           ├── styles/
│           │   ├── main.css               # Global styles.
│           │   └── variables.css          # Design variables.
│           └── icons/
│               └── README.md               # Icon asset documentation.
│
├── infrastructure/
│   ├── nginx/
│   │   └── nginx.conf                      # Reverse proxy and frontend configuration.
│   ├── postgres/
│   │   └── init.sql                        # Optional local PostgreSQL initialization.
│   └── docker/
│       └── README.md                       # Container deployment notes.
│
└── scripts/
    ├── dev.sh                              # Starts development environment.
    ├── build.sh                            # Builds frontend and backend.
    └── backup-db.sh                        # Creates a PostgreSQL backup.
```

---

## 3.2 Recommended Application Architecture

The system should follow:

```text
┌────────────────────────────────────────────┐
│                  Browser                   │
│                                            │
│              Vue 3 + TypeScript            │
│                                            │
└───────────────────┬────────────────────────┘
                    │ HTTPS / REST
                    ▼
┌────────────────────────────────────────────┐
│              Spring Boot API               │
│                                            │
│ Authentication                             │
│ Authorization                              │
│ Business Logic                             │
│ Inventory Transactions                     │
│ Sales                                      │
│ Transfers                                  │
│ HR / Salaries                              │
│ Expenses                                   │
│ Reports                                    │
│ Audit                                      │
└───────────────────┬────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────┐
│                 PostgreSQL                 │
│                                            │
│ Users / Roles                              │
│ Warehouses                                 │
│ Products                                   │
│ Stock                                      │
│ Stock Movements                            │
│ Sales                                      │
│ Transfers                                  │
│ Employees                                  │
│ Salaries                                   │
│ Expenses                                   │
│ Audit Logs                                 │
└────────────────────────────────────────────┘
```

The most important architectural principle is:

> **The frontend requests operations; the backend owns the business rules; PostgreSQL guarantees transactional consistency.**

Vue should never be trusted to enforce rules such as "stock cannot go negative" or "Accountant cannot modify purchase price." Those rules must be enforced server-side.

---

## 3.3 Development Priorities

The implementation should proceed in this order:

```text
1. Database model
2. Authentication and authorization
3. Warehouse and user management
4. Product management
5. Inventory / stock movements
6. Sales
7. Sale editing and inventory reconciliation
8. Transfers
9. Expenses
10. Employees / salaries
11. Dashboard
12. Reports
13. Audit logs
14. Invoice printing
15. Hardening / testing / deployment
```

The most critical components to get correct before expanding the UI are:

```text
Stock consistency
Sale transaction logic
Sale editing logic
Transfer lifecycle
Warehouse-level authorization
Concurrent stock modification
Audit logging
```

These are the parts where a bug can directly produce incorrect inventory or financial information.