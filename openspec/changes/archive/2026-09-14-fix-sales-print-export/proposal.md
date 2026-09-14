## Why

When printing commercial documents in the Sales section—specifically sales invoices in `SalesListView.vue` and pickup vouchers (Bons de Retrait) in both `CreateSaleView.vue` and `SalesListView.vue`—documents suffer from un-neutralized preview scrollboxes, leaked UI chrome, and missing print resets. In `CreateSaleView.vue`, `.voucher-preview-area` traps pickup slips in a `max-height: 520px; overflow-y: auto` scroll container, cutting off the bottom half of vouchers when printed. Additionally, the green success alert banner and tab strip bake into printed pickup slips, while internal fulfillment breakdown cards leak onto client invoices in `SalesListView.vue`.

## What Changes

- **Neutralize Sales Preview Scrollboxes & Flex Wrappers**: Add `.voucher-preview-area`, `.slip-preview-container`, `.invoice-modal-content`, and `.vouchers-modal-body` to the global print un-clipping and `display: block !important` reset rule in `main.css`.
- **Full-Width Canvas Reset for Pickup Slips**: Add `.pickup-slip-wrapper` and `.pickup-slip` to the global sheet reset rule in `main.css`, unconstraining `.pickup-slip-wrapper` from its `max-width: 780px` screen constraint to print full-width on A4 paper.
- **Suppress Sales UI Chrome & Administrative Breakdown Cards**: Suppress `.fulfillment-breakdown-card`, `.vouchers-alert-success`, and `.voucher-tabs` in print mode via `main.css` and template `no-print` utility classes, ensuring customer invoices and pickup receipts remain pristine.
- **Pickup Slip Print Action Consistency**: Ensure pickup slip preview modal actions and print styling cleanly integrate with modal footers without duplicate buttons or awkward screen margins.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `inter-warehouse-sales`: Specify that generated pickup slips (Bons de Retrait) must render across full-page A4 geometry without scroll container clipping or alert/tab banner pollution, and that internal inter-warehouse fulfillment breakdown cards must be suppressed from formal client invoices during print.

## Impact

- **Global Styles**: `frontend/src/assets/styles/main.css` — print rules for sales preview areas, modal wrappers, pickup slip sheets, and sales chrome suppression.
- **Sales Views**:
  - `frontend/src/views/sales/CreateSaleView.vue`: Add `.no-print` suppression to success alert and voucher tabs.
  - `frontend/src/views/sales/SalesListView.vue`: Add `.no-print` suppression to `.fulfillment-breakdown-card`.
- **Sales Components**:
  - `frontend/src/components/sales/PickupSlipDocument.vue`: Ensure full-width print sheet geometry and clean print action handling.
