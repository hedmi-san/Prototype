## 1. Global Print Engine Updates in main.css

- [x] 1.1 Add `.voucher-preview-area`, `.slip-preview-container`, `.invoice-modal-content`, and `.vouchers-modal-body` to the preview un-clipping and `display: block !important` print rule in `frontend/src/assets/styles/main.css`
- [x] 1.2 Add `.pickup-slip-wrapper` and `.pickup-slip` to the printable sheet reset rule in `frontend/src/assets/styles/main.css`
- [x] 1.3 Add `.fulfillment-breakdown-card`, `.vouchers-alert-success`, and `.voucher-tabs` to the print chrome suppression list in `frontend/src/assets/styles/main.css`

## 2. Sales Views Chrome Suppression

- [x] 2.1 Add `no-print` class to `.fulfillment-breakdown-card` in `frontend/src/views/sales/SalesListView.vue`
- [x] 2.2 Add `no-print` class to `.vouchers-alert-success` and `.voucher-tabs` in `frontend/src/views/sales/CreateSaleView.vue`

## 3. Pickup Slip Component Print Sheet Styles

- [x] 3.1 Update `@media print` in `frontend/src/components/sales/PickupSlipDocument.vue` to reset `.pickup-slip-wrapper` to `max-width: 100% !important; margin: 0 !important;`

## 4. Verification & Testing

- [x] 4.1 Validate frontend build via `npm run build` (`vue-tsc && vite build`)
- [x] 4.2 Verify invoice print from `SalesListView.vue` (ensure `.fulfillment-breakdown-card` is suppressed from print output)
- [x] 4.3 Verify pickup slip print from `SalesListView.vue` (ensure full-width un-clipped A4 rendering)
- [x] 4.4 Verify post-sale pickup slip print from `CreateSaleView.vue` (ensure `.voucher-preview-area` is un-clipped and `.vouchers-alert-success` / `.voucher-tabs` are hidden)
