## Context

The product catalog table currently contains two action buttons per row: "Tarif" (which opens a modal dedicated to updating purchase and sale prices) and "Modifier" (which opens the comprehensive product modal, including price inputs). This redundancy adds visual clutter to the catalog table. 

Removing the "Tarif" button leaves the table actions clean and optimal, with "Modifier" as the sole entry point for updating product specifications and prices.

## Goals / Non-Goals

**Goals:**
- Remove the "Tarif" button from the table actions column in `ProductListView.vue`.
- Clean up unused price modal markup, reactive state (`showPriceModal`, `priceUpdatingProduct`, `priceForm`), and handler methods (`openPriceModal`, `handleUpdatePrice`) in `ProductListView.vue`.
- Ensure product pricing remains fully modifiable through the existing "Modifier" modal.

**Non-Goals:**
- Implementing product deletion or soft deletion.
- Modifying backend routes or database schema.

## Decisions

- **Keep Backend Patch Route**:
  - *Decision*: Retain `PATCH /products/:id/price` in `backend/src/routes/product.routes.ts` and `productService.updatePrice` in `catalog.service.ts` rather than deleting them.
  - *Rationale*: Avoids breaking external consumers or other potential callers while achieving the UI simplification goal in the frontend.
- **Unified Edit Modal as Single Source of Truth**:
  - *Decision*: Rely completely on `productService.updateProduct` (invoked by the "Modifier" modal) to persist price changes along with product details.
  - *Rationale*: The `PUT /products/:id` endpoint already handles `purchasePrice` and `salePrice` validation and audit logging cleanly.

## Risks / Trade-offs

- **[Risk]** Users accustomed to the quick "Tarif" popup might search for it.
  - **Mitigation**: The "Modifier" modal clearly presents purchase and sale price inputs side-by-side in the main form row, providing an intuitive editing experience.
