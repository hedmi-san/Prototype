# Multi-Warehouse Tool Distribution Management System

A multi-warehouse industrial tool distribution management system built with **Node.js (Express + TypeScript + SQLite WAL)** and **Vue 3 (TypeScript + Vite + Pinia)** with a monochromatic design system (`#171717`, `#f3f3f3`, `#ffffff`).

## Key Features

- **Zero-Config Embedded Database**: Uses Node.js native `node:sqlite` (SQLite) with Write-Ahead Logging (`WAL`) mode and atomic immediate write transactions (`BEGIN IMMEDIATE`), ensuring zero external dependencies (no Docker or external database needed).
- **Pessimistic Inventory Locking & Safety**: Guaranteed prevention of negative stock under concurrent sales and stock adjustments.
- **Inter-Warehouse Transfers**: Explicit stock reservation workflow (`REQUESTED` $\rightarrow$ `APPROVED` $\rightarrow$ `CONFIRMED` / `CANCELLED`).
- **Sales Delta Reconciliation**: Automatic stock adjustment on invoice modification and non-destructive voiding.
- **Dynamic Asset Valuation**: Real-time stock valuation using current purchase prices.
- **Consolidated Financial Reports**: Income statements with gross profit margin, categorized operating expenses, payroll, and net profit.
- **Monochromatic UI Design System**: Premium `#171717` dark charcoal, `#f3f3f3` surface, and `#ffffff` light palette with fluid typography and skeleton loading screens.

## Quick Start

### 1. Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Run Application
```bash
# Terminal 1: Run Backend (Port 8080)
cd backend
npm run dev

# Terminal 2: Run Frontend (Port 5173)
cd frontend
npm run dev
```

Open `http://localhost:5173/` in your browser.

## Demo Credentials (Quick Login)
- **Admin**: `admin` / `AdminPass123!` (Global Access)
- **Manager (Algiers Hub)**: `manager_algiers` / `ManagerPass123!`
- **Super Manager (Oran Hub)**: `super_oran` / `SuperPass123!`
- **Accountant (Constantine)**: `accountant_constantine` / `AccountantPass123!`
