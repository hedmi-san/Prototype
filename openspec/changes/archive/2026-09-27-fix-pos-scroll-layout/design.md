## Context

The "Nouvelle Vente" (POS) view in `frontend/src/views/sales/CreateSaleView.vue` is the primary interface used by cashiers and warehouse agents to process sales in the multi-warehouse distribution system. The page utilizes a two-column grid (`.pos-layout`):
1. **Left Column (`.pos-main`)**: Product search/combobox, stock availability badges, unit price, quantity inputs, multi-warehouse shortfall badges, and item removal actions.
2. **Right Column (`.pos-sidebar`)**: Warehouse selection, employee assignment, sale date, client search, client balance card, invoice name/phone, payment condition radios (comptant, acompte, crédit), advance deduction toggles, downpayment inputs, physical payment methods, real-time invoice totals, and the confirmation button.

Because the right column contains numerous configuration steps and real-time financial calculations, its vertical height exceeds standard screen viewports (typically 900–1200px tall). Currently, `.pos-main` does not have sticky positioning or constrained height. As a result, when the user scrolls down the page to select payment options, enter an acompte, or click the submit button, the left column scrolls up and completely exits the viewport, leaving large white space on the left and hiding the product cart lines.

In addition, in `frontend/src/layouts/DashboardLayout.vue`, `.top-header` is sticky (`top: 0; height: 60px`), but `.sidebar` has only `min-height: calc(100vh - 60px)` without sticky positioning. Page-level scrolling therefore scrolls the sidebar out of the viewport, cutting off top navigation links and leaving lower links like "Journaux d'Audit" pinned awkwardly at the top edge.

## Goals / Non-Goals

**Goals:**
- **Pin Cart in Viewport**: Keep `.pos-main` sticky within the viewport (`position: sticky; top: 76px`) so product lines and running totals remain visible while the user scrolls down through the payment form on the right.
- **Independent Internal Scrolling for Long Carts**: Provide an internal scroll container (`overflow-y: auto`) on the items table wrapper with `max-height: calc(100vh - 96px)` so carts with many lines (8+) scroll comfortably without exceeding the screen or blanking out.
- **Non-Floating Layout for Short Carts**: Ensure that carts with few items (1–3 lines) sit neatly at the top without stretching or creating unnatural blank gaps.
- **Persistent Cart Running Total**: Add a dedicated summary bar at the bottom of the sticky left column displaying item count, total quantity, and cumulative total (`Cumul panier: X DA`), ensuring immediate cross-check validation before sale confirmation.
- **Sticky Main Navigation Sidebar**: Update `.sidebar` in `DashboardLayout.vue` with `position: sticky; top: 60px; height: calc(100vh - 60px); overflow-y: auto;` so global navigation is never scrolled out of view.
- **Preserve Business and Print Logic**: Ensure 100% fidelity of existing payment calculations, client restrictions, advance credit logic, and print isolation stylesheets.

**Non-Goals:**
- Modifying backend APIs, database models, or validation logic.
- Changing payment conditions or invoice financial formulas.
- Redesigning unrelated application views or altering visual themes.

## Decisions

### Decision 1: Flex Column Card with Sticky Top for `.pos-main`
- **Choice**: Structure `.pos-main` as a flex container (`display: flex; flex-direction: column; position: sticky; top: 76px; max-height: calc(100vh - 92px); align-self: start;`).
- **Rationale**:
  - The card header (title and "+ Ajouter une Ligne de Produit" button) remains locked at the top of the card.
  - The middle section (`.items-table-wrapper`) takes `flex: 1; overflow-y: auto; min-height: 0;` to scroll line items internally when they overflow.
  - The new persistent footer (`.pos-cart-footer`) stays locked at the bottom of the card.
- **Alternatives Considered**:
  - *Window-level scroll only*: Leaving height unconstrained causes the cart to scroll out of view when few lines exist and the right form is long.
  - *Fixed pixel height (e.g. 500px)*: Fails to adapt to different laptop/monitor viewport heights.

### Decision 2: Grid Container Alignment (`align-items: start`)
- **Choice**: Enforce `display: grid; grid-template-columns: minmax(0, 1fr) 340px; align-items: start;` on `.pos-layout`.
- **Rationale**: The default CSS grid `align-items: stretch` forces the left column track to match the height of the right column. In combination with sticky positioning, this can cause calculation jitter or clipping. `align-items: start` allows `.pos-main` to maintain its natural or max-bounded height while sticking smoothly during scroll.
- **Alternatives Considered**:
  - *Floating layout with absolute positioning*: Breaks responsive layouts and requires fragile coordinate calculations.

### Decision 3: Persistent Running Total Footer in `.pos-main`
- **Choice**: Add `<div class="pos-cart-footer">` directly beneath `.items-table-wrapper` in `.pos-main`.
- **Rationale**: Cashiers need to verify the cart total at the exact moment they enter payment amounts (e.g., downpayment or cash received) on the right column. Having the cart cumulative total pinned directly under the product list eliminates the need to look back and forth or wonder if an item was missed.

### Decision 4: Sticky Viewport Isolation for Application Navigation Sidebar
- **Choice**: Add `position: sticky; top: 60px; height: calc(100vh - 60px); align-self: flex-start;` to `.sidebar` in `DashboardLayout.vue`.
- **Rationale**: The top header is 60px tall and sticky. The sidebar sits directly below the header. Giving the sidebar sticky positioning with its own scroll container prevents the document scroll from pulling the sidebar upward and clipping items like "Journaux d'Audit".

## Risks / Trade-offs

- **[Risk] Dropdown menu clipping inside `.items-table-wrapper`**:
  `overflow-y: auto` on `.items-table-wrapper` could potentially clip product search autocomplete dropdowns from `AppProductCombobox`.
  *Mitigation*: Verify that `AppProductCombobox` handles menu stacking properly or has sufficient padding/z-index. If necessary, provide adequate min-height on rows or ensure dropdowns overflow or flip upward.
- **[Risk] Small Screen / Mobile Responsiveness**:
  Sticky side-by-side columns can cause horizontal cramming on viewports narrower than 1024px.
  *Mitigation*: Include responsive media query `@media (max-width: 1024px)` where `.pos-layout` switches to single-column (`grid-template-columns: 1fr;`) and `.pos-main` resets `position: static; max-height: none;` allowing standard linear document scrolling.
