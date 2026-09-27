## Why

On the "Nouvelle Vente" (POS / Point of Sale) page (`CreateSaleView.vue`), the interface uses a two-column split layout: the left column contains the product cart ("Lignes de Produits"), and the right column contains the order options, client details, payment terms, summary totals, and confirmation action ("Détails & Règlement"). As cashiers and sales agents scroll down the longer right column to configure payment terms, enter downpayment details, review invoice totals, and click the confirmation button, the left column scrolls out of view, leaving large empty dead space on the left and hiding the product lines at the exact moment they must cross-check the cart before finalizing a sale.

Simultaneously, the main navigation sidebar (`DashboardLayout.vue`) is not pinned to the viewport during page-level scrolling. When users scroll down longer pages, the top sections of the sidebar scroll out of the viewport, clipping the upper navigation items and leaving lower items awkwardly displayed at the top edge.

Fixing these layout and scroll container behaviors ensures cashiers maintain uninterrupted visibility of cart items, line subtotals, and overall order totals, preventing costly ordering errors and providing a seamless POS cashier experience.

## What Changes

- **Sticky POS Cart Column**: Pin the left column ("Lignes de Produits") within the viewport using `position: sticky` and viewport-bounded height constraints, preventing it from scrolling away into blank space while the right column scrolls.
- **Independent Cart Internal Scroll**: Provide internal vertical scrolling (`overflow-y: auto`) on the product items table container when cart lines exceed viewport height (e.g., 8+ product lines), while ensuring clean non-floating presentation for small carts (e.g., 1 line).
- **Persistent Cart Running Summary**: Add a persistent running summary bar at the bottom of the sticky cart card displaying item line count, total units, and formatted running total (`Cumul panier: X DA`), providing instant visibility of cart status at any scroll position.
- **Parent Grid Alignment**: Enforce proper flex/grid alignment (`align-items: start`) on the POS container to ensure column height divergence does not cause visual truncation or blanking.
- **Sticky Navigation Sidebar**: Pin the main navigation sidebar in `DashboardLayout.vue` to the viewport below the top header (`position: sticky; top: 60px; height: calc(100vh - 60px); overflow-y: auto;`) so navigating through any page never scrolls or clips the persistent navigation bar.
- **Preserved Business Rules**: Keep all invoice calculation logic, payment terms validation, advance credit rules, and client restrictions (such as walk-in cash-only enforcement) 100% intact.

## Capabilities

### New Capabilities
- `pos-layout-and-navigation`: Defines presentation and scroll behavior requirements for the POS two-column layout, sticky cart pane, persistent cart totals, and application sidebar navigation pinning.

### Modified Capabilities
*None. Existing calculation, ledger, and payment tracking requirements remain unchanged.*

## Impact

- **Frontend Components**:
  - `frontend/src/views/sales/CreateSaleView.vue`: Layout grid rules, sticky left column wrapper, internal table scroll, and persistent bottom cart summary footer.
  - `frontend/src/layouts/DashboardLayout.vue`: Sidebar styling to enable viewport stickiness and independent vertical scrolling.
- **Backend / APIs**: No backend or database changes required.
- **Dependencies**: No external library additions.
