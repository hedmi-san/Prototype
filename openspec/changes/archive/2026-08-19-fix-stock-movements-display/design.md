## Context

The system maintains a `stock_movements` table recording all inventory transitions (Initial stock, Sales, Inventory adjustments, and Inter-warehouse transfers).
While the Dashboard's recent movements widget was recently updated to handle both camelCase and snake_case alias fields (`movementType ?? type`, `quantityChange ?? quantity`), the standalone Stock Movements page (`StockMovementsView.vue`) strictly reads `m.type`, `m.quantity`, and `m.reason`. Because the backend `GET /api/inventory/movements` route returned `movementType`, `quantityChange`, `reference`, and `notes` without backwards/forwards-compatible aliases, the full ledger page displays empty badges (`-`), `0` delta quantities, and missing reason strings (`—`).

## Goals / Non-Goals

**Goals:**
- Unify the response payload of `GET /api/inventory/movements` so both `type`/`movementType` and `quantity`/`quantityChange` and `notes`/`reason`/`reference` are provided consistently.
- Align `StockMovementsView.vue` to use robust fallbacks (`m.movementType || m.type`, `m.quantityChange ?? m.quantity ?? 0`, `m.reason || m.notes || m.reference`) to guard against future field shifts.
- Update `StockMovement` interface in `frontend/src/types/index.ts` to document both canonical and alias fields.
- Ensure the table search and type filter in `StockMovementsView.vue` correctly evaluate `type`/`movementType` and textual descriptions.

**Non-Goals:**
- Modifying underlying SQLite database schema for `stock_movements`.
- Altering stock mutation logic in sales, transfers, or adjustments.

## Decisions

1. **Dual Property Return in Backend Route**:
   In `backend/src/routes/inventory.routes.ts`, `GET /movements` will explicitly map:
   - `type: m.movement_type` and `movementType: m.movement_type`
   - `quantity: m.quantity_change` and `quantityChange: m.quantity_change`
   - `reason: m.notes || m.reference`, `notes: m.notes`, `reference: m.reference`
   - `createdAt: m.created_at`
   *Rationale*: Ensures backwards compatibility with older frontend expectations while remaining standard with camelCase backend APIs.

2. **Defensive Template Binding in `StockMovementsView.vue`**:
   Update template bindings and computed filter properties in `StockMovementsView.vue` to handle both `movementType` / `type`, `quantityChange` / `quantity`, and `reason` / `notes` / `reference`.
   *Rationale*: Prevents UI display breakdowns even if one consumer or mock passes one property naming convention over another.

## Risks / Trade-offs

- **[Field redundancy in JSON response]** → Returning dual keys adds negligible bytes to the response while guaranteeing complete resilience across all views.
