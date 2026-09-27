# Multi-Warehouse Tool Distribution Management System
## Product Specification & Architecture Blueprint

> **System Version:** 2.0.0 (Production Blueprint)  
> **Target Market:** National Industrial & Hardware Tool Distribution (Algeria)  
> **Core Architecture:** Multi-Warehouse Scoped Monorepo (Node.js / Express / TypeScript / PostgreSQL + Vue 3 / Pinia / Vite)  
> **Design Language:** Architectural Monochromatic Palette (`#171717`, `#f3f3f3`, `#ffffff`) with Print-Optimized Layouts

---

## TABLE OF CONTENTS

1. [Executive Summary & Business Model](#1-executive-summary--business-model)
   - 1.1 Problem Statement & Value Proposition
   - 1.2 Multi-Warehouse Distribution Topology
   - 1.3 User Personas & Role-Based Access Control (RBAC)
   - 1.4 Business Differentiators
2. [System Architecture & Technology Stack](#2-system-architecture--technology-stack)
   - 2.1 Monorepo Architecture Overview
   - 2.2 Backend Architecture (Node.js / TypeScript / Express / PostgreSQL)
   - 2.3 Frontend Architecture (Vue 3 / TypeScript / Pinia / Vite)
   - 2.4 Design System & Visual Aesthetics
   - 2.5 Security, Hardening & Concurrency Safety
3. [Core Functional Modules & Business Logic](#3-core-functional-modules--business-logic)
   - 3.1 Warehouse Management & Tenant Scoping
   - 3.2 Product Catalog & Commercial Attributes
   - 3.3 Multi-Warehouse Stock Engine & Pessimistic Locking
   - 3.4 Point of Sale (POS) & Commercial Sales Engine
   - 3.5 Inter-Warehouse Sales & Distributed Split Fulfillment
   - 3.6 Client Accounts, Credit Ledger & Financial Balance
   - 3.7 Algerian Fiscal Invoicing (Module Facturation & Timbre Fiscal)
   - 3.8 Inter-Warehouse Stock Transfers (B2B Depots)
   - 3.9 Operating Expenses & Overhead Accounting
   - 3.10 Human Resources & Payroll Management
   - 3.11 Financial Analytics, Income Statements & Stock Valuation
   - 3.12 Cross-Warehouse Notifications Engine
   - 3.13 Comprehensive Immutable Audit Trail
4. [Database Schema & Data Model](#4-database-schema--data-model)
   - 4.1 Relational Architecture Diagram
   - 4.2 Complete Database DDL & Schema Definitions
   - 4.3 Composite Indexing & Performance Engineering
5. [REST API Surface & Contract Specifications](#5-rest-api-surface--contract-specifications)
   - 5.1 Authentication & Session Management
   - 5.2 Warehouse Operations
   - 5.3 Product Catalog
   - 5.4 Inventory & Movements
   - 5.5 Sales & Cash Register
   - 5.6 Clients, Ledger & Payments
   - 5.7 Inter-Warehouse Transfers
   - 5.8 Factures & Fiscal Documentation
   - 5.9 Expenses & Payroll
   - 5.10 Reports & Analytics
   - 5.11 Notifications & Audit Logs
6. [Non-Functional Requirements & Production Engineering](#6-non-functional-requirements--production-engineering)
   - 6.1 Transactional Integrity & Negative-Stock Prevention
   - 6.2 Data Security & Access Control
   - 6.3 Performance & Scalability Benchmarks
   - 6.4 Print Architecture & Commercial Document Layouts
7. [Repository File & Folder Structure](#7-repository-file--folder-structure)
   - 7.1 Complete Monorepo Directory Tree
   - 7.2 Key Architectural Files
8. [Blueprint & Adaptation Guide for Similar Future Projects](#8-blueprint--adaptation-guide-for-similar-future-projects)
   - 8.1 Reusability Checklist
   - 8.2 Modifying Business Rules for Other Industries
   - 8.3 Extending to B2B eCommerce or Multi-Company SaaS

---

## 1. EXECUTIVE SUMMARY & BUSINESS MODEL

### 1.1 Problem Statement & Value Proposition

In national physical goods distribution (e.g. industrial hand tools, power tools, safety equipment, hardware), companies operate multiple regional depots rather than standard retail stores. Managing inventory, counter sales, inter-depot logistics, customer credit, and operating finances across geographically dispersed sites with manual spreadsheets or fragmented point-of-sale software introduces severe risks:

- **Inventory Discrepancies & Overselling:** Desynchronized stock balances cause multiple depots to promise identical stock, leading to backorders and cancelled deliveries.
- **Untracked Cross-Warehouse Fulfillment:** Customers frequently arrive at one depot seeking products stocked only at another regional branch. Without split-fulfillment protocols and pickup vouchers, sales are lost.
- **Uncontrolled Customer Debt:** In traditional trade, wholesale customers purchase on credit or leave cash advances. Without an immutable double-column accounting ledger, debtor tracking becomes error-prone.
- **Fiscal Non-Compliance:** Algerian tax legislation mandates rigorous invoice structures, including commercial registry IDs (RC, NIF, ART, NIS), Value Added Tax (TVA at 19%), graduated fiscal stamps (*Droit de Timbre* for cash transactions), and legal amounts written out in words.
- **Opacity in Depot Profitability:** Central management lacks real-time consolidated reporting on gross margins, operating expenses (rent, fuel, utilities), and warehouse payroll.

#### The Core Value Proposition:
> **A single, centralized, transactionally-locked enterprise system providing real-time multi-depot stock synchronization, distributed sales fulfillment, double-column client credit tracking, compliant fiscal invoicing, and consolidated P&L statements across all company locations.**

---

### 1.2 Multi-Warehouse Distribution Topology

The application is structured around a centralized hub-and-spoke warehouse model:

```
                          ┌───────────────────────────┐
                          │   Central Administration  │
                          │   (Headquarters / Admin)  │
                          └─────────────┬─────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│  Algiers Hub Depot  │◄────►│   Oran West Depot   │◄────►│ Constantine Depot   │
│  (Central Stock)    │      │   (Regional Hub)    │      │ (Eastern Hub)       │
└──────────┬──────────┘      └──────────┬──────────┘      └──────────┬──────────┘
           │                            │                            │
           ├─ Counter Sales (Cash)      ├─ Counter Sales (Cash)      ├─ Counter Sales (Cash)
           ├─ Credit Account Sales      ├─ Credit Account Sales      ├─ Credit Account Sales
           ├─ Cross-Depot Pickup        ├─ Cross-Depot Pickup        ├─ Cross-Depot Pickup
           ├─ Dedicated Staff & Payroll ├─ Dedicated Staff & Payroll ├─ Dedicated Staff & Payroll
           └─ Operating Expenses        └─ Operating Expenses        └─ Operating Expenses
```

Every warehouse operates as an autonomous operational and accounting unit with:
- Its own physical inventory and reserved stock allocations.
- Its own sales cash registers, cashiers, and storekeepers.
- Its own operational expense tracking (rent, electricity, transport, fuel, maintenance).
- Its own localized employee roster and payroll records.
- Inter-warehouse transfer capabilities for replenishment and rebalancing.
- Cross-warehouse fulfillment routing (sell in Algiers, pick up in Oran).

---

### 1.3 User Personas & Role-Based Access Control (RBAC)

The application enforces a 4-tier hierarchical permission model coupled with strict server-side warehouse scoping:

| Role | Scope | Permissions & Capabilities | Restrictions |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | **Global** (All Warehouses) | Full access to all modules, warehouse creation, user administration, cross-warehouse inventory monitoring, consolidated financial statements (P&L), global audit logs, system configuration. | None. Unrestricted system owner. |
| **`SUPER_MANAGER`** | **Primary Warehouse** + Read-Only Cross-Depot | Complete managerial control over their assigned primary warehouse (sales, stock adjustments, HR, payroll, expenses, transfers). **Read-only visibility into stock levels of all other company warehouses** to facilitate customer transfers. | Cannot modify stock or finances of other depots. Cannot manage global users. |
| **`MANAGER`** | **Assigned Warehouse Only** | Full operational management of assigned depot: view/adjust stock, modify purchase and sale prices, create/approve/confirm transfers, manage employees, record salaries and bonuses, log expenses, review warehouse financial reports. | Strictly isolated to assigned warehouse. Cannot view other warehouses. Cannot access global user management. |
| **`ACCOUNTANT`** | **Assigned Warehouse Only** | Point-of-sale operations, customer credit ledger, cash payment receipts, invoice printing, fiscal invoice generation (*Factures*), stock lookups, stock adjustments with mandatory justification. | **Forbidden from viewing product purchase prices or warehouse profit margins.** Cannot manage employees, payroll, or expenses. Cannot approve inter-warehouse transfers. |

---

### 1.4 Business Differentiators

Unlike generic SaaS inventory systems or bloated traditional ERPs, this architecture is customized for national industrial distribution:
1. **Pessimistic Concurrency Engine:** Uses database-level row locking (`SELECT FOR UPDATE`) to eliminate race conditions and guarantee zero negative inventory under simultaneous cashier checkouts.
2. **Inter-Warehouse Split-Fulfillment & Pickup Vouchers:** When a branch faces a partial stockout, cashiers can fulfill available items locally while routing remaining items to other warehouses with printable cryptographic pickup slips (*Bons de Retrait*).
3. **Double-Column Immutable Client Ledger:** Professional accounting sub-ledger tracking debits, credits, running balances, payment allocations, cash advances, and refunds with zero destructive edits.
4. **Algerian Fiscal & Commercial Compliance:** Native support for Algerian billing standards (HT, TVA, graduated stamp duty, NIF/NIS/RC/ART numbers, and amount in French words).
5. **Architectural Monochromatic Theme:** Ultra-high contrast design system designed for warehouse terminals, dusty environments, and fast keyboard-driven data entry.

---

## 2. SYSTEM ARCHITECTURE & TECHNOLOGY STACK

### 2.1 Monorepo Architecture Overview

The system is engineered as an enterprise TypeScript monorepo with clean separation between the backend REST API service and the modern Single Page Application (SPA) frontend:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT BROWSER / TERMINAL                             │
│                  Vue 3 (Composition API) + Pinia + Vue Router                   │
│         Monochromatic Design System (#171717 / #f3f3f3) + Print Engine          │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ HTTPS / JSON REST
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            NODE.JS / EXPRESS BACKEND                            │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ Security & Middleware Layer: Helmet, CORS Matrix, Rate Limiter, JWT Auth    │ │
│ ├─────────────────────────────────────────────────────────────────────────────┤ │
│ │ Controller / Route Layer: REST Endpoints (16 Scoped Domain Routers)        │ │
│ ├─────────────────────────────────────────────────────────────────────────────┤ │
│ │ Business Logic & Locking: Atomic Immediate Transactions, Pessimistic Locks  │ │
│ ├─────────────────────────────────────────────────────────────────────────────┤ │
│ │ Audit & Notification Dispatcher: Real-Time Event & Cross-Depot Notifications │ │
│ └──────────────────────────────────────┬──────────────────────────────────────┘ │
└────────────────────────────────────────┼────────────────────────────────────────┘
                                         │ Pool Queries (pg)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               POSTGRESQL DATABASE                               │
│  - ACID Transactions (BEGIN ... COMMIT / ROLLBACK)                              │
│  - Row-Level Locking (SELECT FOR UPDATE)                                        │
│  - Extensions: pg_trgm (High-Performance Trigram Full-Text Search)              │
│  - 24 Interlinked Tables with Composite Performance & Scoping Indexes           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Backend Architecture

The backend is built with **Node.js (v20+)**, **TypeScript**, and **Express**, chosen for exceptional I/O throughput, type safety, and direct control over SQL query execution without heavy ORM overhead.

- **HTTP Engine:** Express 4.19 with modular router architecture.
- **Database Access:** Native PostgreSQL client (`pg` v8.12) utilizing connection pooling, parameterized SQL queries, explicit transaction wrappers, and PostgreSQL's `pg_trgm` extension for fuzzy search across products, references, and client names.
- **Security Middleware:** 
  - `helmet`: Hardens HTTP headers, disables unsafe CSP, prevents MIME-sniffing.
  - `cors`: Dynamic origin validation supporting local development (`localhost:5173`, `127.0.0.1`), Vercel preview branches, and production domains (e.g. Render deployments).
  - `express-rate-limit`: Rate limiting on sensitive endpoints (e.g. login).
  - `bcryptjs`: Industry-standard salted password hashing.
  - `jsonwebtoken (JWT)`: Stateless token-based authentication passing user credentials, assigned role, and warehouse ID in request context.
- **Error Handling:** Centralized asynchronous error wrapper preventing unhandled promise rejections and returning standardized API error responses:
  ```json
  {
    "success": false,
    "error": "Error description message",
    "details": null
  }
  ```

---

### 2.3 Frontend Architecture

The frontend is a reactive, client-side Single Page Application built with **Vue 3**, **Vite**, and **TypeScript**:

- **Framework:** Vue 3 utilizing `<script setup lang="ts">` and the Composition API for modular logic encapsulation.
- **State Management:** **Pinia** stores cleanly partitioned by business domain (`auth`, `warehouse`, `product`, `inventory`, `sale`, `client`, `dashboard`).
- **Routing:** **Vue Router 4** with navigation guards enforcing authentication, active session verification, and role-based route access (`requiresAdmin`, `requiresAuth`).
- **HTTP Client:** **Axios** configured with request/response interceptors that automatically attach the bearer JWT token and intercept `401 Unauthorized` responses to redirect to `/login`.
- **Document & Spreadsheet Export:** Integration with SheetJS (`xlsx`) for client-side Excel exports of catalog data, inventory movements, and client statements.

---

### 2.4 Design System & Visual Aesthetics

The application adopts an **Architectural Monochromatic Theme** prioritizing visual clarity, high contrast, and zero distraction:

- **Primary Canvas & Neutral Surfaces:**
  - Background: `#f3f3f3` (Light Surface) / `#171717` (Dark Charcoal Shell)
  - Card & Container Surface: `#ffffff`
  - Deep Accents & Primary Buttons: `#171717` with hover transition to `#262626`
  - Subtle Borders & Dividers: `#e5e5e5`
  - Secondary Text & Meta Labels: `#525252` and `#737373`
- **Status Badges:** Clean, desaturated status indicators:
  - `COMPLETED` / `PAID` / `ACTIVE`: Crisp slate emerald / solid monochrome tag.
  - `PENDING` / `REQUESTED` / `PARTIAL`: Warm neutral amber tag.
  - `CANCELLED` / `VOIDED` / `OUT_OF_STOCK`: Muted crimson tag.
- **Micro-Animations & Skeleton Loading:** CSS transitions on interactive elements, skeleton pulse states during asynchronous data fetching, and uncluttered data density.
- **Print Optimization (`@media print`):** Dedicated print stylesheet stripping navigation sidebars, headers, action buttons, and modal chrome, formatting commercial documents directly to standard A4/A5 page dimensions.

---

### 2.5 Security, Hardening & Concurrency Safety

1. **Server-Side Authorization Guarantee:** The frontend never decides whether a user has permission to view costs or alter stock. Every API endpoint inspects the decoded JWT token (`req.user`) and checks permissions against the database.
2. **Horizontal IDOR Protection:** Warehouse-scoped users (Managers, Accountants) can only read or mutate records matching their assigned `warehouse_id`. Tampering with query parameters or URL path IDs results in `403 Forbidden`.
3. **Pessimistic Concurrency Locking:** When deducting or reserving inventory, the database locks the target row:
   ```sql
   SELECT id, physical_quantity, reserved_quantity 
   FROM stock 
   WHERE warehouse_id = $1 AND product_id = $2 
   FOR UPDATE;
   ```
   Concurrent transactions must wait for the lock to release, guaranteeing that concurrent sales cannot decrement stock below zero.

---

## 3. CORE FUNCTIONAL MODULES & BUSINESS LOGIC

### 3.1 Warehouse Management & Tenant Scoping

Warehouses represent independent operational branches.
- **Creation & Administration:** Admin users can register new depots specifying `name`, unique `code` (e.g. `WH-ALG-01`, `WH-ORN-02`), geographical `location`, and `contact_number`.
- **Tenant Scoping:** Every business transaction (sales, movements, transfers, expenses, payroll, client ledger entries) contains a foreign key to `warehouse_id`.
- **Depot Switching:** Admin users possess a global warehouse switcher in the navigation bar to inspect any branch in isolation or view consolidated cross-warehouse figures.

---

### 3.2 Product Catalog & Commercial Attributes

The product catalog unifies the distributor's inventory references:

```text
id                  : Primary Key (Serial)
reference           : Unique SKU / Barcode / Catalog Reference (e.g. 'WE-8021', 'DRILL-20V')
name                : Commercial product name
brand               : Manufacturer / brand (Defaults to 'WEHAND')
description         : Technical specifications and package contents
purchase_price      : Cost price (Visible only to Admin, Super Manager, Manager)
sale_price          : Standard commercial sale price for counter transactions
facture_price       : Official billing price used when generating fiscal invoices (Factures)
min_stock_alert     : Threshold quantity triggering low-stock dashboard alerts (Default: 1)
unit                : Commercial unit of measure (e.g. 'PIECE', 'SET', 'BOX')
box_size            : Number of units per master carton / pack (0 = loose item)
tva                 : Applicable VAT rate percentage (Default: 19.00%)
active              : Soft-delete toggle
```

#### Key Rules:
- **Price Separation:** The `purchase_price` is strictly hidden from Accountants via database query projection (returning `0.00` or `null`).
- **Historical Price Immutability:** Updating a product's sale price updates future orders only. Existing sales and invoices retain the exact unit price locked in their respective line items (`sale_items.unit_price`).
- **Excel Import / Export:** Bulk catalog ingestion and stock initialization via standardized `.xlsx` templates.

---

### 3.3 Multi-Warehouse Stock Engine & Pessimistic Locking

Stock is tracked at the warehouse-product intersection:

$$\text{Available Stock} = \text{physical\_quantity} - \text{reserved\_quantity}$$

```text
physical_quantity  : Units physically on shelves in the warehouse (CHECK >= 0)
reserved_quantity  : Units promised to pending inter-warehouse pickup vouchers (CHECK >= 0)
```

#### Stock Movements & Auditability:
Direct manual modifications of stock numbers are prohibited. Every inventory change must create an immutable `stock_movements` record:
- **`SALE`**: Decrement physical stock on completed sale or voucher pickup.
- **`TRANSFER_OUT`**: Decrement source warehouse stock on transfer confirmation.
- **`TRANSFER_IN`**: Increment destination warehouse stock on transfer confirmation.
- **`ADJUSTMENT`**: Manual correction by Manager or Accountant requiring a **mandatory textual reason** (e.g., "Physical inventory count adjustment", "Damaged goods in transit").
- **`RESERVATION`**: Increment `reserved_quantity` when an order promises stock for remote pickup.
- **`RELEASE`**: Decrement `reserved_quantity` on order cancellation or expiration.

---

### 3.4 Point of Sale (POS) & Commercial Sales Engine

The POS / Caisse module handles fast, high-volume counter operations:

```
Cashier selects Products & Quantities
               │
               ▼
   Check Available Stock (Local)
      ├── Sufficient? ──► Allocate Local Fulfillment
      └── Insufficient? ─► Split to Inter-Warehouse Fulfillment (or Reject)
               │
               ▼
   Assign Customer (Default Walk-in "CLT-COMPTOIR" or Registered Account Client)
               │
               ▼
   Select Payment Method (Cash, Check, Advance Credit, Collect on Pickup)
               │
               ▼
   Atomic Transaction:
     - Insert `sales` & `sale_items`
     - Decrement local `stock.physical_quantity` (with FOR UPDATE lock)
     - Insert `stock_movements`
     - If Registered Client: Post `INVOICE` debit to `client_transactions`
     - Generate Printable Thermal / A4 Receipt
```

#### Sales Reconciliation on Modification:
When a sale is edited after creation, the system calculates the delta per product:
- If $\text{New Quantity} > \text{Old Quantity}$: The system locks stock and deducts the difference ($Q_{\text{new}} - Q_{\text{old}}$) if available.
- If $\text{New Quantity} < \text{Old Quantity}$: The excess quantity ($Q_{\text{old}} - Q_{\text{new}}$) is automatically returned to physical stock with a movement note.
- **Ledger Balancing:** If tied to a registered client, compensating `CREDIT_NOTE` or supplementary `INVOICE` entries are posted to maintain accounting balance.

---

### 3.5 Inter-Warehouse Sales & Distributed Split Fulfillment

A critical capability when a regional depot lacks sufficient inventory to fulfill a customer's entire order:

```
Customer at Warehouse A wants 10 Drills (Warehouse A only has 3 in stock)
                                  │
                                  ▼
Cashier splits fulfillment in POS:
  - Line 1: 3 Units fulfilled immediately by Warehouse A
  - Line 2: 7 Units routed to Warehouse B for Customer Pickup
                                  │
                                  ▼
Database Transaction:
  - Line 1: Immediate physical stock decrement at Warehouse A
  - Line 2: Creates `sale_fulfillment_lines` with status `PENDING_PICKUP`
  - Locks Warehouse B inventory and increments `reserved_quantity` by 7
  - Emits notification to Warehouse B
  - Prints customer receipt AND dedicated "Bon de Retrait" (Pickup Voucher)
```

#### Payment Location Flexibility:
1. **Pre-paid at Origin (`PAID`):** Customer pays the full amount at Warehouse A. The voucher indicates `PAID AT ORIGIN — DO NOT COLLECT CASH`. Inter-branch clearing ledger logs that Warehouse A owes Warehouse B the cost of goods.
2. **Collect on Pickup (`COLLECT_ON_PICKUP`):** Customer pays for the 7 units upon arriving at Warehouse B. Warehouse B registers the cash payment locally.

#### Pickup Verification Workflow:
Staff at Warehouse B inspect the customer's pickup voucher code (`pickup_voucher_code`). Clicking "Fulfill Pickup":
1. Decrements Warehouse B's `physical_quantity` by 7.
2. Decrements Warehouse B's `reserved_quantity` by 7.
3. Transitions line status to `FULFILLED`.
4. Emits a `SALE_PICKUP_COMPLETED` notification back to Warehouse A.

---

### 3.6 Client Accounts, Credit Ledger & Financial Balance

To support wholesale relationships and credit terms, the system implements an **immutable double-column accounting ledger**:

#### Client Data Profile:
- Standard Details: `code` (e.g. `CLT-0042`), `name`, `phone`, `email`, `address`.
- Legal & Fiscal Registry: `rc` (Registre de Commerce), `nif`, `art` (Article d'Imposition), `nis`, `num_fiscal`, `activite`.
- Balance Tracking: `opening_balance`, `current_balance`.
- Default Counter Client: Special system client `CLT-COMPTOIR` for anonymous retail transactions.

#### Double-Column Ledger (`client_transactions`):
Every financial interaction creates an immutable row with non-negative `debit` and `credit` values, computing a progressive `running_balance`:

$$\text{Running Balance} = \text{Previous Balance} + \text{Debit} - \text{Credit}$$

- **Sales Invoice Issued:** Debit = Total Invoice Amount, Credit = 0 (Client owes more).
- **Payment Received (*Versement*):** Debit = 0, Credit = Amount Paid (Client owes less).
- **Credit Note (*Avoir*):** Debit = 0, Credit = Returned / Discounted Amount.
- **Cash Refund (*Remboursement d'Avance*):** Debit = Refunded Amount, Credit = 0 (Disbursing cash advance back to client).

#### Statement of Account (*Extrait de Compte*):
- Interactive tabular view and printable PDF report bounded by date ranges.
- Computes carried-forward opening balance prior to the selected start date.
- Warehouse filter allowing managers to inspect client debt incurred specifically at their branch or across the entire company.

---

### 3.7 Algerian Fiscal Invoicing (Module Facturation & Timbre Fiscal)

Separate from informal counter sales receipts, official registered clients frequently demand a certified commercial tax invoice (*Facture*):

```
                      ┌────────────────────────────┐
                      │    Completed Sale Order    │
                      └─────────────┬──────────────┘
                                    │ Click "Facturer"
                                    ▼
                      ┌────────────────────────────┐
                      │  Facturation Configuration │
                      │  - Confirm Client RC/NIF   │
                      │  - Select Payment Mode     │
                      │  - Driver & Truck Details  │
                      └─────────────┬──────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      OFFICIAL ALGERIAN FACTURE                         │
│                                                                        │
│ 1. Header: Distributor Legal Identifiers (RC, NIF, NIS, ART, Capital)  │
│ 2. Client: Customer Legal Identifiers & Professional Activity         │
│ 3. Logistics: Moyen de Transport, N° Camion, Nom du Chauffeur          │
│ 4. Table: Code, Désignation, U/M, Qté, Prix Unitaire HT, Total HT     │
│ 5. Calculations:                                                       │
│    - Total Montant Hors Taxes (HT)                                     │
│    - Total TVA (19.00%)                                                │
│    - Droit de Timbre Fiscal (Applicable for Cash payments)             │
│    - Montant Total TTC (Toutes Taxes Comprises)                        │
│ 6. Legal Text: "Arrêté la présente facture à la somme de [En Lettres]"│
└────────────────────────────────────────────────────────────────────────┘
```

#### Timbre Fiscal Calculation (Algerian Tax Code):
When payment mode is cash (`Espèce`), graduated fiscal stamp duty is automatically computed:
- 1% on invoice TTC value, capped between legal thresholds (minimum 5.00 DZD, maximum 10,000.00 DZD according to applicable finance laws).
- Non-cash settlements (Cheque, Bank Transfer) incur 0.00 DZD fiscal stamp duty.

#### Facture Immutability & Annulation:
Factures cannot be deleted. If an issued invoice contains legal errors, it must be officially voided (*Annulée*), recording the cancellation timestamp, responsible user, and mandatory reason.

---

### 3.8 Inter-Warehouse Stock Transfers (B2B Depots)

Handles bulk inventory redistribution between regional warehouses:

```
[Origin Warehouse A]              [Destination Warehouse B]
         │                                    │
         │─── Creates Transfer Request ──────►│ Status: REQUESTED
         │    (Product X: 20 units)           │
         │                                    │
         │                                    │ Warehouse B checks stock &
         │                                    │ enters approved quantity (e.g. 15)
         │                                    │
         │◄── Approves Transfer Request ──────│ Status: APPROVED
         │    (Approved: 15 units)            │
         │                                    │
         │ Physical Goods Transported         │
         │ Driver carries "Bon de Transfert"  │
         │                                    │
         │─── Goods Arrive at Warehouse A ────│
         │    Warehouse A clicks "Confirm"    │
         │                                    │
         │                                    │ Status: CONFIRMED
         │                                    │ Atomic Stock Execution:
         │                                    │ - Warehouse B: Stock -15 (TRANSFER_OUT)
         │                                    │ - Warehouse A: Stock +15 (TRANSFER_IN)
```

- **Safety Rule:** No inventory changes occur during `REQUESTED` or `APPROVED` states. Only when the receiving warehouse physically accepts and confirms the shipment are stock balances updated simultaneously in a single atomic transaction.

---

### 3.9 Operating Expenses & Overhead Accounting

Depot managers record localized operational expenditures:
- **Categories:** `ELECTRICITY`, `WATER`, `RENT`, `FUEL`, `MAINTENANCE`, `TRANSPORTATION`, `SUPPLIES`, `OTHER`.
- **Fields:** Warehouse ID, Category, Amount (DZD), Description, Date of Expense.
- **Reporting Integration:** Expenses feed directly into the warehouse-specific and consolidated Income Statements to calculate Net Operating Profit.

---

### 3.10 Human Resources & Payroll Management

Tracks warehouse personnel and recurring labor expenses:
- **Employee Records:** Full Name, National ID Number (NIN), Phone, Position/Role (e.g. Storekeeper, Driver, Cashier), Date of Hire, Base Monthly Salary, Status (`ACTIVE`, `TERMINATED`).
- **Monthly Payroll (`salaries`):**
  - Base Salary for the period.
  - Holiday / Eid Bonuses (`bonus1`, `bonus2`).
  - Total Gross Compensation.
  - Payment date and settlement status.
- Feeds into monthly P&L financial reports under operational payroll overhead.

---

### 3.11 Financial Analytics, Income Statements & Stock Valuation

Real-time executive reporting accessible to Admins and Managers:

1. **Stock Valuation Report:**
   - Multiplies current physical stock by latest unit purchase price:
     $$\text{Asset Valuation} = \sum (\text{physical\_quantity} \times \text{purchase\_price})$$
   - Breakdown by warehouse depot and aggregate company asset valuation.

2. **Income Statement (Compte de Résultat):**
   - **Gross Revenue (Chiffre d'Affaires):** Total sales completed in the period.
   - **Cost of Goods Sold (COGS):** Total purchase cost of items sold.
   - **Gross Profit Margin:** $\text{Gross Profit} = \text{Revenue} - \text{COGS}$.
   - **Operating Expenses:** Sum of categorized expenses for the period.
   - **Payroll Expenses:** Sum of base salaries and holiday bonuses paid.
   - **Net Profit (Résultat Net):** $\text{Gross Profit} - (\text{Operating Expenses} + \text{Payroll})$.

---

### 3.12 Cross-Warehouse Notifications Engine

An event-driven notification system keeping distributed teams aligned:
- **Events Emitted:**
  - `SALE_PICKUP_PENDING`: Emitted to fulfilling warehouse when an inter-warehouse sale allocates items to it.
  - `SALE_PICKUP_COMPLETED`: Emitted back to origin warehouse when customer collects their goods.
  - `TRANSFER_REQUESTED`: Emitted to source warehouse when a depot requests stock replenishment.
  - `TRANSFER_APPROVED`: Emitted to requesting depot when transfer quantities are confirmed.
- Interactive notification bell in navigation bar with unread counts and direct routing links.

---

### 3.13 Comprehensive Immutable Audit Trail

Every state-modifying action across all modules is permanently logged in `audit_logs`:
- **Captured Metadata:** `user_id`, `warehouse_id`, `action` (e.g. `CREATE_SALE`, `ADJUST_STOCK`, `UPDATE_PRICE`, `VOID_FACTURE`), `entity_type`, `entity_id`, `old_values` (JSON snapshot), `new_values` (JSON snapshot), `description`, `ip_address`, and `created_at`.
- Direct search and inspection interface for Admins to identify who changed prices, modified sales, or adjusted stock quantities.

---

## 4. DATABASE SCHEMA & DATA MODEL

### 4.1 Relational Architecture Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  warehouses  │◄──────┤    users     ├──────►│    roles     │
└──────┬───────┘       └──────┬───────┘       └──────────────┘
       │                      │
       ├──────────────┬───────┴──────────────┬──────────────┐
       ▼              ▼                      ▼              ▼
┌──────────────┐┌──────────────┐      ┌──────────────┐┌──────────────┐
│  employees   ││  customers   │      │   products   ││  audit_logs  │
│  & salaries  ││  & ledger    │      │  & pricing   ││ (immutable)  │
└──────────────┘└──────┬───────┘      └──────┬───────┘└──────────────┘
                       │                     │
                       ▼                     ▼
              ┌────────────────────────────────┐
              │             sales              │
              │  - sale_items                  │
              │  - sale_fulfillment_lines      │
              │  - stock_reservations          │
              │  - factures & facture_items    │
              └────────────────────────────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │             stock              │
              │  - physical & reserved         │
              │  - stock_movements             │
              │  - transfers & transfer_items  │
              └────────────────────────────────┘
```

---

### 4.2 Complete Database DDL & Schema Definitions

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Roles & Permissions
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);

-- 2. Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  location TEXT NOT NULL,
  contact_number VARCHAR(50),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Products & Catalog
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100) NOT NULL DEFAULT 'WEHAND',
  description TEXT,
  purchase_price NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  facture_price NUMERIC(14, 2) DEFAULT NULL,
  min_stock_alert INTEGER NOT NULL DEFAULT 1,
  unit VARCHAR(50) NOT NULL DEFAULT 'PIECE',
  box_size INTEGER NOT NULL DEFAULT 0,
  tva NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Warehouse Stock Balances
CREATE TABLE IF NOT EXISTS stock (
  id SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  physical_quantity INTEGER NOT NULL DEFAULT 0 CHECK(physical_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK(reserved_quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(warehouse_id, product_id)
);

-- 6. Stock Movement Ledger
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL, -- 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT'
  quantity_change INTEGER NOT NULL,
  reference VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Clients & Customer Accounts
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(150),
  email VARCHAR(100),
  address TEXT,
  rc VARCHAR(100),
  nif VARCHAR(100),
  art VARCHAR(100),
  activite TEXT,
  nis VARCHAR(100),
  num_fiscal VARCHAR(100),
  opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Client Financial Ledger (Double-Column)
CREATE TABLE IF NOT EXISTS client_transactions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  type VARCHAR(50) NOT NULL, -- 'INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'REFUND', 'ADJUSTMENT'
  reference_type VARCHAR(50),
  reference_id INTEGER,
  debit NUMERIC(14, 2) NOT NULL DEFAULT 0.0 CHECK(debit >= 0),
  credit NUMERIC(14, 2) NOT NULL DEFAULT 0.0 CHECK(credit >= 0),
  running_balance NUMERIC(14, 2) NOT NULL,
  description TEXT NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Client Payments (Versements)
CREATE TABLE IF NOT EXISTS client_payments (
  id SERIAL PRIMARY KEY,
  payment_number VARCHAR(50) NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  amount NUMERIC(14, 2) NOT NULL CHECK(amount > 0),
  payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH', -- 'CASH', 'CHECK', 'TRANSFER'
  reference_number VARCHAR(100),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  transaction_id INTEGER REFERENCES client_transactions(id) ON DELETE RESTRICT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Sales Orders
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  customer_name VARCHAR(100) DEFAULT 'Standard Retail Customer',
  customer_phone VARCHAR(50),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  advance_deducted NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'PAID', -- 'PAID', 'PARTIAL', 'UNPAID', 'COLLECT_ON_PICKUP'
  status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'VOIDED', 'CANCELLED'
  origin_warehouse_id INTEGER REFERENCES warehouses(id),
  has_inter_warehouse_fulfillment BOOLEAN NOT NULL DEFAULT FALSE,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Sale Line Items
CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price NUMERIC(14, 2) NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL
);

-- 12. Inter-Warehouse Sale Fulfillment Lines
CREATE TABLE IF NOT EXISTS sale_fulfillment_lines (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price NUMERIC(14, 2) NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL,
  origin_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  fulfillment_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  payment_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  fulfillment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_PICKUP', -- 'PENDING_PICKUP', 'FULFILLED', 'CANCELLED'
  payment_status VARCHAR(50) NOT NULL DEFAULT 'PAID',
  pickup_voucher_code VARCHAR(50) NOT NULL UNIQUE,
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by_user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Stock Reservations
CREATE TABLE IF NOT EXISTS stock_reservations (
  id SERIAL PRIMARY KEY,
  fulfillment_line_id INTEGER NOT NULL REFERENCES sale_fulfillment_lines(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reserved_quantity INTEGER NOT NULL CHECK(reserved_quantity > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'FULFILLED', 'CANCELLED'
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Fiscal Invoices (Factures)
CREATE TABLE IF NOT EXISTS factures (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  facture_number VARCHAR(50) NOT NULL UNIQUE,
  facture_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  client_name VARCHAR(255) NOT NULL,
  client_address TEXT,
  client_rc VARCHAR(100),
  client_nif VARCHAR(100),
  client_art VARCHAR(100),
  client_activite TEXT,
  client_nis VARCHAR(100),
  reglement VARCHAR(50) NOT NULL DEFAULT 'Espèce',
  total_ht NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  total_tva NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  timbre NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  total_remise NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  total_ttc NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  situation VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'ANNULÉE'
  situation_notes TEXT,
  situation_date TIMESTAMPTZ,
  moyen_transport VARCHAR(100),
  camion_numero VARCHAR(50),
  chauffeur VARCHAR(100),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Facture Line Items
CREATE TABLE IF NOT EXISTS facture_items (
  id SERIAL PRIMARY KEY,
  facture_id INTEGER NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  code VARCHAR(50) NOT NULL,
  designation VARCHAR(255) NOT NULL,
  um VARCHAR(50) NOT NULL DEFAULT 'PCS',
  tva_rate NUMERIC(5, 2) NOT NULL DEFAULT 19.00,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price NUMERIC(14, 2) NOT NULL,
  remise_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  total NUMERIC(14, 2) NOT NULL
);

-- 16. Inter-Warehouse Transfers
CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  transfer_number VARCHAR(50) NOT NULL UNIQUE,
  source_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  destination_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  requested_by_user_id INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED', -- 'REQUESTED', 'APPROVED', 'CONFIRMED', 'DECLINED', 'CANCELLED'
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfer_items (
  id SERIAL PRIMARY KEY,
  transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  requested_quantity INTEGER NOT NULL CHECK(requested_quantity > 0),
  approved_quantity INTEGER NOT NULL DEFAULT 0 CHECK(approved_quantity >= 0)
);

-- 17. Operating Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Employees & Payroll
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  national_id VARCHAR(50) NOT NULL,
  phone VARCHAR(50),
  position VARCHAR(100) NOT NULL,
  base_salary NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salaries (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  period VARCHAR(20) NOT NULL,
  base_salary NUMERIC(14, 2) NOT NULL,
  bonus1 NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  bonus2 NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
  total_amount NUMERIC(14, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. Cross-Warehouse Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 20. System Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  old_values TEXT,
  new_values TEXT,
  description TEXT NOT NULL,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 4.3 Composite Indexing & Performance Engineering

To maintain sub-50ms API responses under heavy transaction volumes across multiple depots, the database implements specialized composite and GIN trigram indexes:

```sql
-- Sales and Operations Indexing
CREATE INDEX IF NOT EXISTS idx_sales_sale_date_wh ON sales(sale_date, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at_wh ON sales(created_at, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);

-- Trigram Fuzzy Search on Products & Clients
CREATE INDEX IF NOT EXISTS idx_clients_trgm_search ON clients 
  USING gin ((name || ' ' || code || ' ' || COALESCE(phone, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_search ON products 
  (reference, name, brand);

-- Ledger Performance Queries
CREATE INDEX IF NOT EXISTS idx_client_transactions_client_date ON client_transactions(client_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_client_transactions_client_wh_date ON client_transactions(client_id, warehouse_id, transaction_date);

-- Stock Reservation Expiration & Lookup
CREATE INDEX IF NOT EXISTS idx_stock_reservations_wh_prod ON stock_reservations(warehouse_id, product_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_status_expires ON stock_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_sale_fulfillment_lines_voucher ON sale_fulfillment_lines(pickup_voucher_code);

-- Transfer & Movement Queries
CREATE INDEX IF NOT EXISTS idx_transfers_created_wh ON transfers(created_at, source_warehouse_id, destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_wh ON stock_movements(created_at, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_wh ON audit_logs(created_at, warehouse_id);
```

---

## 5. REST API SURFACE & CONTRACT SPECIFICATIONS

All endpoints accept and return `application/json`. Authenticated requests require the header:
`Authorization: Bearer <JWT_TOKEN>`.

### 5.1 Authentication & Session Management
- `POST /api/auth/login`: Authenticates username and password. Returns signed JWT, user profile, role, and assigned warehouse details.
- `GET /api/auth/me`: Validates existing session token and returns active user state.
- `POST /api/auth/logout`: Invalidates client session.

### 5.2 Warehouse Operations
- `GET /api/warehouses`: List all warehouses (filterable by active status).
- `GET /api/warehouses/:id`: Get detailed warehouse metadata, staff, and statistics.
- `POST /api/warehouses`: Create new warehouse branch (*Admin only*).
- `PUT /api/warehouses/:id`: Update branch contact information, name, or status (*Admin only*).

### 5.3 Product Catalog
- `GET /api/products`: Paginated product list with search filters (`search`, `brand`, `active`). Accountants receive masked purchase costs.
- `GET /api/products/:id`: Detailed product specifications and stock across warehouses.
- `POST /api/products`: Create a new catalog item (*Admin, Manager*).
- `PUT /api/products/:id`: Update product descriptions, prices, box size, TVA (*Admin, Manager*).
- `POST /api/products/import-excel`: Bulk catalog import from spreadsheet (*Admin*).

### 5.4 Inventory & Movements
- `GET /api/inventory/stock`: List inventory levels for assigned warehouse (physical, reserved, available).
- `GET /api/inventory/movements`: Paginated stock movement audit trail with type, date, and product filters.
- `POST /api/inventory/adjust`: Post manual stock adjustment (requires `quantity_change`, `reason`).
- `GET /api/inventory/cross-warehouse/:productId`: Look up stock availability across all branches (*Admin, Super Manager*).

### 5.5 Sales & Cash Register
- `GET /api/sales`: Retrieve sales history with pagination, date scoping, and payment status filters.
- `GET /api/sales/:id`: Detailed sale view with line items, fulfillment breakdown, and linked invoice.
- `POST /api/sales`: Create new sale with atomic stock deduction or inter-warehouse split reservations.
- `PUT /api/sales/:id`: Edit existing sale with automatic stock delta reconciliation.
- `POST /api/sales/:id/cancel`: Void/cancel an existing sale and restore inventory.
- `GET /api/sales/voucher/:voucherCode`: Look up pending inter-warehouse pickup voucher.
- `POST /api/sales/fulfill-voucher`: Mark pickup voucher as fulfilled, dispense physical stock.

### 5.6 Clients, Ledger & Payments
- `GET /api/clients`: List clients with balance summaries and debt indicators.
- `GET /api/clients/:id`: Retrieve client profile with legal numbers (RC/NIF/ART/NIS).
- `POST /api/clients`: Create a new registered client account.
- `PUT /api/clients/:id`: Update client information.
- `GET /api/clients/:id/statement`: Paginated Statement of Account (*Extrait de Compte*) with dynamic opening balance and running balances.
- `POST /api/client-payments`: Register customer payment (*Versement*) and allocate across open sales.
- `POST /api/clients/:id/refund`: Disburse cash refund for client holding an advance credit balance.

### 5.7 Inter-Warehouse Transfers
- `GET /api/transfers`: List inter-depot transfer requests.
- `POST /api/transfers`: Initiate transfer request from source to destination.
- `PUT /api/transfers/:id/approve`: Source warehouse approves request and specifies quantities.
- `PUT /api/transfers/:id/confirm`: Destination warehouse confirms physical arrival; executes atomic stock updates.
- `PUT /api/transfers/:id/decline`: Source warehouse declines transfer request.
- `PUT /api/transfers/:id/cancel`: Cancel an unconfirmed transfer.

### 5.8 Factures & Fiscal Documentation
- `GET /api/factures`: Retrieve registered fiscal invoices.
- `GET /api/factures/:id`: Detailed facture view with legal French amounts and timbre breakdown.
- `GET /api/factures/sales-without-facture`: Debounced lookup of completed sales eligible for invoicing.
- `POST /api/factures`: Generate formal fiscal invoice from a completed sale.
- `POST /api/factures/:id/annuler`: Officially void an issued facture with mandatory legal justification.

### 5.9 Expenses & Payroll
- `GET /api/expenses`: Retrieve categorized warehouse expenses.
- `POST /api/expenses`: Record an operating expense (*Admin, Manager*).
- `GET /api/employees`: List warehouse employees and contract details (*Admin, Manager*).
- `POST /api/employees`: Register new employee.
- `GET /api/salaries`: List monthly payroll records.
- `POST /api/salaries`: Process and log monthly salary payment with bonuses.

### 5.10 Reports & Analytics
- `GET /api/reports/dashboard`: Summary KPI cards (today's sales, month-to-date sales, stock value, alerts).
- `GET /api/reports/stock-valuation`: Asset valuation report based on current purchase prices.
- `GET /api/reports/financial`: Comprehensive Income Statement (Revenue, COGS, Margins, Expenses, Net Profit).
- `GET /api/reports/warehouse-comparison`: Cross-depot benchmarking.

### 5.11 Notifications & Audit Logs
- `GET /api/notifications`: List unread and recent depot notifications.
- `PUT /api/notifications/:id/read`: Mark notification as read.
- `GET /api/audit-logs`: Searchable, filterable system audit trail (*Admin only*).

---

## 6. NON-FUNCTIONAL REQUIREMENTS & PRODUCTION ENGINEERING

### 6.1 Transactional Integrity & Negative-Stock Prevention

Under no circumstances may stock become negative or desynchronized:
1. **Explicit Immediate Transactions:** All stock-mutating operations execute within explicit database transactions (`BEGIN` ... `COMMIT`).
2. **Pessimistic Row-Level Locks:** Queries use `FOR UPDATE` on `stock` records to serialize concurrent requests.
3. **Database Constraints:** Database table definitions enforce `CHECK (physical_quantity >= 0)` and `CHECK (reserved_quantity >= 0)` as absolute safeguards against logic bugs.

---

### 6.2 Data Security & Access Control

- **Password Cryptography:** Passwords hashed with `bcryptjs` using a minimum salt work factor of 10.
- **Stateless Tokens:** JWT tokens signed with a high-entropy secret, expiring after 24 hours.
- **OWASP Compliance:** Parameterized queries eliminate SQL injection vulnerabilities. Cross-Site Scripting (XSS) mitigated by Vue's reactive text interpolations and sanitized HTML outputs.

---

### 6.3 Performance & Scalability Benchmarks

- **Response Latency:** Primary operational endpoints (`POST /sales`, `GET /inventory/stock`, `GET /clients/:id/statement`) must respond in $< 80\text{ms}$ under typical server loads.
- **Database Index Coverage:** All foreign keys and high-frequency filter columns (`warehouse_id`, `created_at`, `client_id`, `sale_date`) are indexed with composite B-tree indexes. Full-text search leverages GIN trigram indexes.

---

### 6.4 Print Architecture & Commercial Document Layouts

The frontend features custom-crafted `@media print` rules ensuring that invoices, pickup vouchers, transport slips, and client statements format cleanly without clipping, cutoffs, or modal backgrounds:
- **`Bon de Caisse / Reçu de Vente`**: Formats cleanly for 80mm thermal receipt printers or compact A5 slips.
- **`Facture Fiscale`**: Strict A4 format displaying two-column header (Distributor Details on left, Client Coordinates on right), structured product table, tax breakdown summary, and legal footer.
- **`Bon de Retrait (Pickup Voucher)`**: Displays prominent pickup status badges, destination address, and QR/voucher code for storekeeper scanning.
- **`Extrait de Compte (Statement of Account)`**: Formats a formal tabular banking-style ledger with previous balance carried forward, page numbers, and total debt summary.

---

## 7. REPOSITORY FILE & FOLDER STRUCTURE

### 7.1 Complete Monorepo Directory Tree

```text
Prototype/
├── package.json                         # Root workspace scripts & tooling
├── README.md                            # Quickstart & deployment documentation
│
├── backend/                             # Express + TypeScript REST API
│   ├── package.json                     # Backend dependencies (pg, express, helmet, etc.)
│   ├── tsconfig.json                    # TypeScript compiler configuration
│   └── src/
│       ├── server.ts                    # Server initialization, CORS, middleware, health
│       ├── db/
│       │   ├── database.ts              # PostgreSQL connection pool & query wrappers
│       │   ├── schema.ts                # DDL migrations, tables, indexes, constraints
│       │   └── seed.ts                  # Seed data (admin user, sample depots, products)
│       ├── middleware/
│       │   ├── auth.middleware.ts       # JWT verification & role authorization
│       │   └── warehouse.middleware.ts  # Multi-tenant warehouse boundary enforcement
│       ├── routes/                      # REST Route Controllers
│       │   ├── auth.routes.ts           # Authentication & session routes
│       │   ├── warehouse.routes.ts      # Warehouse administration
│       │   ├── product.routes.ts        # Product catalog & pricing
│       │   ├── inventory.routes.ts      # Stock balances, movements & adjustments
│       │   ├── sale.routes.ts           # POS sales, voucher fulfillment & voids
│       │   ├── client.routes.ts         # Client profiles, ledger & statements
│       │   ├── client-payment.routes.ts # Versements, allocations & refunds
│       │   ├── transfer.routes.ts       # B2B Inter-warehouse transfers
│       │   ├── facture.routes.ts        # Algerian fiscal invoices
│       │   ├── expense.routes.ts        # Operating expenses
│       │   ├── employee.routes.ts       # Employee registry
│       │   ├── salary.routes.ts         # Monthly payroll & bonuses
│       │   ├── report.routes.ts         # Financial statements & asset valuation
│       │   ├── notification.routes.ts   # Cross-depot alert dispatch
│       │   ├── audit.routes.ts          # System audit trail viewer
│       │   └── user.routes.ts           # User account administration
│       └── types/                       # Shared backend TypeScript interfaces
│
├── frontend/                            # Vue 3 + Vite Single Page Application
│   ├── package.json                     # Frontend dependencies (vue, pinia, axios, xlsx)
│   ├── vite.config.ts                   # Vite bundler configuration
│   ├── tsconfig.json                    # TypeScript client configuration
│   ├── index.html                       # HTML5 entrypoint with Google Fonts
│   └── src/
│       ├── main.ts                      # Vue application bootstrap
│       ├── App.vue                      # Root component & global toast container
│       ├── router/
│       │   └── index.ts                 # Vue Router routes & navigation guards
│       ├── layouts/
│       │   ├── AuthLayout.vue           # Minimalist shell for login
│       │   └── DashboardLayout.vue      # Main application shell with navbar & sidebar
│       ├── stores/                      # Pinia State Management
│       │   ├── auth.store.ts            # User session & permissions
│       │   ├── warehouse.store.ts       # Active warehouse context
│       │   ├── product.store.ts         # Catalog cache
│       │   ├── inventory.store.ts       # Stock counts & movements
│       │   ├── sale.store.ts            # Sales journal & POS cart
│       │   ├── client.store.ts          # Client accounts & ledger cache
│       │   └── dashboard.store.ts       # Executive KPI metrics
│       ├── services/                    # Axios API Client Adapters
│       │   ├── api.ts                   # Base Axios instance with JWT interceptor
│       │   ├── auth.service.ts
│       │   ├── product.service.ts
│       │   ├── inventory.service.ts
│       │   ├── sale.service.ts
│       │   ├── client.service.ts
│       │   ├── transfer.service.ts
│       │   ├── facture.service.ts
│       │   └── report.service.ts
│       ├── views/                       # Application Views
│       │   ├── auth/LoginView.vue
│       │   ├── dashboard/DashboardView.vue
│       │   ├── products/ProductListView.vue
│       │   ├── inventory/StockView.vue
│       │   ├── inventory/StockMovementsView.vue
│       │   ├── sales/SalesListView.vue
│       │   ├── sales/CreateSaleView.vue
│       │   ├── clients/ClientsListView.vue
│       │   ├── clients/ClientProfileView.vue
│       │   ├── transfers/TransferListView.vue
│       │   ├── expenses/ExpenseListView.vue
│       │   ├── employees/EmployeeListView.vue
│       │   ├── employees/EmployeeDetailView.vue
│       │   ├── salaries/SalaryManagementView.vue
│       │   ├── reports/StockValuationView.vue
│       │   ├── reports/FinancialReportsView.vue
│       │   └── admin/
│       │       ├── UsersView.vue
│       │       ├── WarehousesView.vue
│       │       └── AuditLogsView.vue
│       └── assets/
│           └── styles/
│               ├── main.css             # Architectural monochromatic design system
│               └── print.css            # Print stylesheets for A4/A5/Thermal formats
│
└── openspec/                            # OpenSpec specifications & change history
    ├── config.yaml
    └── specs/                           # Granular feature specifications
```

---

## 8. BLUEPRINT & ADAPTATION GUIDE FOR SIMILAR FUTURE PROJECTS

This specification serves as a proven architectural foundation for other multi-location physical inventory systems (e.g. automotive spare parts, electrical wholesale, building materials, pharmaceutical distribution). When adapting this blueprint for a new system, follow these principles:

### 8.1 Reusability Checklist
1. **Retain the Core Ledger:** Do not replace the double-column `client_transactions` ledger with a simple mutable `balance` float. The immutable audit trail is essential for debtor reconciliation.
2. **Preserve Pessimistic Locking:** Retain `SELECT FOR UPDATE` in stock transactions. High-concurrency operations inevitably create negative stock if optimistic locking is used on hot inventory items.
3. **Keep Warehouse-Scoped Tenants:** Even if a business currently operates only one warehouse, keeping `warehouse_id` on all entities ensures future multi-site expansion requires zero database refactoring.
4. **Maintain Print Stylesheets:** Clean, browser-native print stylesheets are significantly faster, more reliable, and easier to style than server-side PDF generation binaries (Puppeteer, wkhtmltopdf).

### 8.2 Modifying Business Rules for Other Industries
- **Serial / Batch Tracking:** For electronics, automotive parts, or pharmaceuticals, add a `batches` table (`batch_number`, `expiry_date`) linking to `stock` and `sale_items`.
- **Custom Tax Formulas:** If deploying outside Algeria, adapt the TVA and Timbre Fiscal calculations in `facture.routes.ts` to match local tax regulations (e.g. GST, VAT, Sales Tax).
- **Multi-Currency:** If purchasing from international suppliers in foreign currencies (EUR, USD) and selling locally, introduce a `currency_rates` table to track exchange gains/losses in COGS calculations.

### 8.3 Extending to B2B eCommerce or Multi-Company SaaS
- **Customer Web Portal:** Expose read-only endpoints allowing clients to log in, view their current credit balance, download Statement of Account PDFs, and track pending pickup orders.
- **Multi-Company SaaS Conversion:** To support multiple independent distributor companies on a single hosted cluster, introduce a `company_id` tenant identifier to all tables and enforce multi-tenancy at the database or connection pool level.

---
*Product Specification and Architecture Blueprint maintained by the Engineering Team.*