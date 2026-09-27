## 1. Global Navigation Sidebar Stickiness

- [x] 1.1 Update `.sidebar` styling in `frontend/src/layouts/DashboardLayout.vue` to use sticky positioning (`position: sticky; top: 60px; height: calc(100vh - 60px); overflow-y: auto; align-self: flex-start;`).
- [x] 1.2 Verify that scrolling main page content does not cause the sidebar to scroll out of view or clip links such as "Journaux d'Audit".

## 2. POS Cart Sticky Layout and Internal Scrolling

- [x] 2.1 Enforce `align-items: start;` on `.pos-layout` in `frontend/src/views/sales/CreateSaleView.vue` to decouple left and right column track stretching.
- [x] 2.2 Configure `.pos-main` as a sticky flex column (`position: sticky; top: 76px; max-height: calc(100vh - 92px); display: flex; flex-direction: column;`) pinned below the top navigation bar.
- [x] 2.3 Enable internal vertical scrolling on `.items-table-wrapper` (`flex: 1; overflow-y: auto; min-height: 0;`) so lists exceeding viewport height scroll cleanly within the card.

## 3. Persistent Running Cart Summary Footer

- [x] 3.1 Add computed property in `frontend/src/views/sales/CreateSaleView.vue` calculating total unit count across all cart line items (`totalQuantity`).
- [x] 3.2 Insert `.pos-cart-footer` at the bottom of `.pos-main` displaying line count, total units, and formatted running total (`Cumul panier: X DA`).
- [x] 3.3 Add CSS styles for `.pos-cart-footer` (fixed to bottom of card, border-top separator, contrasting font-mono total amount, responsive flexbox layout).

## 4. Verification and Edge Case Testing

- [x] 4.1 Test with 1 product line: Confirm the left card stays pinned near the top without awkward floating or blank dead space as the right column form is scrolled to the confirm button.
- [x] 4.2 Test with 8+ product lines: Confirm internal table scroll operates smoothly without blanking or truncating, while preserving combobox dropdown visibility.
- [x] 4.3 Test responsive breakpoints: Ensure narrow screens (<1024px) revert cleanly to single-column non-sticky document scrolling.
- [x] 4.4 Verify business rule preservation: Confirm invoice totals, advance credit toggles, payment condition radios, and walk-in client rules remain completely intact.
