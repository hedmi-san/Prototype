## Context

The Multi-Warehouse Tool Distribution System handles wholesale tool distribution where items are stored in piece units but often handled, packed, and loaded in bulk cartons (colisage). The system needs to capture carton sizes in product definitions, display carton availability in inventory stocks, and compute total full cartons on printable customer invoices to accelerate warehouse dispatching.

## Goals / Non-Goals

**Goals:**
- Add `box_size` (integer $\ge 0$, default 0) to `products` table and all product CRUD APIs.
- Provide user input for "Colisage (Pièces par Carton)" in product creation/edit modals and display packaging info in product listings.
- Compute and display full carton counts ($\lfloor \text{quantity} / \text{box\_size} \rfloor$) in warehouse inventory stock views and CSV exports.
- Compute and render `Nombre de Cartons` in the printable sales invoice document (`InvoiceDocument.vue`) footer for warehouse loading.

**Non-Goals:**
- Changing underlying inventory unit of measure (inventory remains tracked in piece units, not cartons).
- Support for multiple nested packaging tiers (e.g. inner box vs master carton) — a single box size attribute suffices.
- Fractional carton sales or decimal carton counts (strict integer floor calculation).

## Decisions

### 1. Database Schema & Zero Default
- **Decision**: Add `box_size INTEGER NOT NULL DEFAULT 0` to `products`.
- **Rationale**: `0` explicitly represents items that are unboxed / sold loose or have no carton packaging. Setting `DEFAULT 0` prevents `NULL` edge cases and simplifies integer arithmetic.
- **Alternatives Considered**: `box_size = 1` as default. Rejected because a single unpacked piece is not a "carton of 1", and 0 cleanly avoids generating false 1-carton counts for loose tools.

### 2. Strict Floor Division for Carton Computation
- **Decision**: Calculate cartons using $\lfloor \text{quantity} / \text{box\_size} \rfloor$ for any item where $\text{box\_size} > 0$.
- **Rationale**: A box is only counted if the quantity contains the full box packaging. Quantities below the box size (e.g., 10 units of box size 16) represent loose pieces and yield `0` cartons.

### 3. Dynamic Calculation in Invoice Document
- **Decision**: Join `products.box_size` in sale items query (`sale.routes.ts`) and compute the total cartons in `InvoiceDocument.vue` using Vue computed properties.
- **Rationale**: Keeps invoice generation reactive and lightweight without requiring separate redundant carton columns in the `sales` table.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DATA FLOW & INTEGRATION                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [ Product Catalog ]                                                        │
│   products.box_size (e.g. 16) ─────────────┐                                │
│                                            │                                │
│                                            ▼                                │
│  [ Inventory Stock API ]           [ Sales / Invoice API ]                  │
│   stock.physical_quantity (100)     sale_items.quantity (32)                │
│   ➔ Cartons = floor(100/16) = 6     ➔ Cartons = floor(32/16) = 2            │
│   ➔ Render in StockView             ➔ Sum in InvoiceDocument footer         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

- **[Product Box Size Modified After Sale]** → If an admin edits a product's box size in the future, past printed invoices recomputed dynamically will reflect the updated packaging size. *Mitigation*: In the tool distribution domain, manufacturer packaging sizes for a specific SKU/reference are fixed physical properties.
- **[Zero / Negative Input]** → Users might input negative numbers. *Mitigation*: Frontend form enforces `min="0"` and backend clamps/validates `Math.max(0, Number(boxSize) || 0)`.
