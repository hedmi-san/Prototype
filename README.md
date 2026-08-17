# Multi-Warehouse Tool Distribution Management System

A multi-warehouse industrial tool distribution system built with **Spring Boot 3 (Java 21)**, **PostgreSQL 16**, and **Vue 3 (TypeScript + Vite)**.

## Key Features

- **Pessimistic Inventory Locking**: `SELECT ... FOR UPDATE` row-level locking guaranteeing zero negative stock under high concurrency.
- **Inter-Warehouse Transfers**: Explicit stock reservation workflow (`REQUESTED` $\rightarrow$ `APPROVED` $\rightarrow$ `CONFIRMED` / `CANCELLED`).
- **Sales Delta Reconciliation**: Automatic stock adjustment on invoice modification and non-destructive voiding.
- **Dynamic Asset Valuation**: Real-time stock valuation using current purchase prices.
- **Consolidated Financial Reports**: P&L income statement with gross margin, categorized operating expenses, payroll, and net profit.
- **Monochromatic UI Design System**: Tailored dark charcoal `#171717`, light gray `#f3f3f3`, and pure white `#ffffff` palette with fluid typography and skeleton screens.

## Quick Start

### 1. Start Database & Services
```bash
docker compose up -d postgres
```

### 2. Run Backend
```bash
cd backend
./mvnw spring-boot:run
```

### 3. Run Frontend
```bash
cd frontend
npm install
npm run dev
```

## Demo Credentials
- **Admin**: `admin` / `admin123`
- **Super Manager**: `supermanager` / `manager123`
- **Algiers Manager**: `manager_algiers` / `manager123`
- **Algiers Accountant**: `accountant_algiers` / `accountant123`
