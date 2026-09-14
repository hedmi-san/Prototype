## Context

The Sales subsystem provides two primary commercial documents:
1. **Sales Invoices (`InvoiceDocument.vue`)**: Previewed in `SalesListView.vue` within `AppModal`. When an order involves inter-warehouse transfers, an administrative breakdown card (`.fulfillment-breakdown-card`) is displayed below the invoice.
2. **Pickup Slips / Bons de Retrait (`PickupSlipDocument.vue`)**: Previewed either in `CreateSaleView.vue` immediately following sale validation (inside `.voucher-preview-area`), or in `SalesListView.vue` via individual line actions (inside `.slip-preview-container`).

While `frontend/src/assets/styles/main.css` resets ancestors and preview containers for invoices and product catalogs, it does not account for sales voucher preview containers or modal content wrappers. Specifically:
- `.voucher-preview-area` in `CreateSaleView.vue` is constrained to `max-height: 520px; overflow-y: auto`, collapsing to a truncated slice on paper.
- Green confirmation banners (`.vouchers-alert-success`) and voucher tabs (`.voucher-tabs`) in `CreateSaleView.vue` lack print suppression.
- The internal `.fulfillment-breakdown-card` in `SalesListView.vue` prints directly on customer invoices.
- `.pickup-slip-wrapper` and `.pickup-slip` are missing from the global print sheet reset, retaining a `max-width: 780px` constraint.
- Wrapper containers (`.invoice-modal-content`, `.vouchers-modal-body`) retain `display: flex` during print, hindering page fragmentation.

## Goals / Non-Goals

**Goals:**
- Completely un-clip `.voucher-preview-area` and `.slip-preview-container` so pickup slips paginate without truncation or scroll boundaries.
- Ensure `.pickup-slip-wrapper` and `.pickup-slip` adopt full-width A4 printable canvas styling.
- Prevent internal logistics chrome (`.fulfillment-breakdown-card`) from leaking onto commercial invoices.
- Prevent checkout notifications (`.vouchers-alert-success`) and navigation tabs (`.voucher-tabs`) from leaking onto pickup slips.
- Force modal wrapper elements (`.invoice-modal-content`, `.vouchers-modal-body`) to `display: block !important` in print mode.
- Maintain identical screen UI behavior across all modals.

**Non-Goals:**
- Altering the visual layout, typography, or field contents of invoices or pickup slips on screen.
- Changing sales creation, payment allocation, or voucher routing backend logic.

## Decisions

### Decision 1: Expand Global Preview Un-Clipping and Block Formatting Rule
In `frontend/src/assets/styles/main.css` under `@media print`:
- Add `.voucher-preview-area`, `.slip-preview-container`, `.invoice-modal-content`, and `.vouchers-modal-body` to the existing container un-clipping rule:
  ```css
  .invoice-preview-wrapper,
  .document-preview-container,
  .voucher-preview-area,
  .slip-preview-container,
  .invoice-modal-content,
  .vouchers-modal-body {
    background: transparent !important;
    padding: 0 !important;
    margin: 0 !important;
    border-radius: 0 !important;
    overflow: visible !important;
    max-height: none !important;
    display: block !important;
  }
  ```
*Rationale*: Eliminates scroll clipping and collapses flex contexts to block formatting so print engines can paginate without truncation.

### Decision 2: Add Pickup Slips to the Printable Sheet Reset
In `main.css`:
- Add `.pickup-slip-wrapper, .pickup-slip` to:
  ```css
  .a4-invoice-sheet,
  .printable-invoice-target,
  .a4-document-sheet,
  .pickup-slip-wrapper,
  .pickup-slip {
    position: static !important;
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    background: #ffffff !important;
    color: #000000 !important;
    overflow: visible !important;
  }
  ```
- In `PickupSlipDocument.vue`, mirror this reset in its scoped `@media print` block for `.pickup-slip-wrapper` (`max-width: 100% !important; margin: 0 !important;`).

*Rationale*: Allows pickup slips to expand to the natural A4 printable area rather than being constrained to a fixed 780px centered box.

### Decision 3: Suppress Sales Modal Chrome and Administrative Cards
In `main.css`:
- Add `.fulfillment-breakdown-card`, `.vouchers-alert-success`, and `.voucher-tabs` to the global suppression list:
  ```css
  .fulfillment-breakdown-card,
  .vouchers-alert-success,
  .voucher-tabs {
    display: none !important;
  }
  ```
In Vue templates (Defense-in-depth):
- `SalesListView.vue`: Add `no-print` class to `.fulfillment-breakdown-card`.
- `CreateSaleView.vue`: Add `no-print` class to `.vouchers-alert-success` and `.voucher-tabs`.

*Rationale*: Dual enforcement ensures these non-document UI elements never appear on formal customer-facing paperwork.

## Risks / Trade-offs

- **[Risk] Styling variance on pickup slip borders/padding**:
  - Resetting `.pickup-slip` removes the screen-only `1px solid #94a3b8` border and `box-shadow` during print.
  - *Mitigation*: This is intentional; commercial paper documents should print clean without faux-card shadows or gray card borders.
