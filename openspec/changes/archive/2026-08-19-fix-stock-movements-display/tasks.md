## 1. Backend Route Normalization

- [x] 1.1 Update `GET /api/inventory/movements` in `backend/src/routes/inventory.routes.ts` to include dual aliases (`type`, `movementType`, `quantity`, `quantityChange`, `reason`, `notes`, `reference`)

## 2. Frontend Interface and View Alignment

- [x] 2.1 Update `StockMovement` interface in `frontend/src/types/index.ts` to ensure compatibility across all properties
- [x] 2.2 Update `frontend/src/views/inventory/StockMovementsView.vue` template bindings, badge variants, and delta styling to use robust property fallbacks
- [x] 2.3 Update search query and type filter logic in `StockMovementsView.vue` to reliably filter across movement types and notes/reason/reference fields

## 3. Verification & Validation

- [x] 3.1 Verify backend API response returns expected payload format for stock movements
- [x] 3.2 Verify frontend `/movements` table displays correct badges, signed quantities, references/notes, and filtering
