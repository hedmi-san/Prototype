## Why

In the sales section, the sale date (*Date de Vente*) is neither saved nor displayed accurately. The backend sale endpoints (`GET /sales`, `GET /sales/:id`) omit `saleDate` from their mapped responses, the database schema lacks an explicit `sale_date` column with proper default/fallback mechanisms, and the frontend point-of-sale (`CreateSaleView.vue`) and edit modal (`SalesListView.vue`) lack dedicated input controls to view and specify the sale date during creation or revision.

## What Changes

- **Database Schema**: Add and ensure explicit support for `sale_date` in the `sales` table (with automatic default to current timestamp `datetime('now')` and fallback migration for existing databases).
- **Backend API Endpoints**:
  - Update `GET /sales` and `GET /sales/:id` to include `saleDate` (`sale_date` / `created_at`) in their JSON payloads.
  - Update `POST /sales` to accept an optional `saleDate` field (falling back to current ISO/SQLite datetime if omitted) and persist it to `sale_date`.
  - Update `PUT /sales/:id` to accept and update `saleDate` when sales are edited.
  - Ensure backend seed data populates `sale_date` consistently.
- **Frontend Types & Services**:
  - Update `Sale` TypeScript interface and `saleService` methods (`createSale`, `updateSale`) in `frontend/src/services/operations.service.ts` and `frontend/src/types/index.ts` to support `saleDate`.
- **Frontend POS & Sales Views**:
  - Add a "Date de Vente" (`saleDate`) field to `CreateSaleView.vue` (defaulting to current date/time).
  - Add a "Date de Vente" field to the Edit Sale modal in `SalesListView.vue`.
  - Ensure the Sales table list, Invoice preview modal, and Dashboard consistently display the formatted `saleDate`.

## Capabilities

### New Capabilities
<!-- No new standalone capabilities required; this extends existing sales-management -->

### Modified Capabilities
- `sales-management`: Add requirements for capturing, storing, updating, and displaying the explicit sale transaction date (`saleDate`) across sale creation, modification, list views, and invoice representations.

## Impact

- **Database**: `sales` table schema and existing SQLite databases via automatic column check / migration.
- **Backend**: `backend/src/routes/sale.routes.ts`, `backend/src/db/schema.ts`, `backend/src/db/seed.ts`.
- **Frontend**: `frontend/src/types/index.ts`, `frontend/src/services/operations.service.ts`, `frontend/src/views/sales/CreateSaleView.vue`, `frontend/src/views/sales/SalesListView.vue`.
