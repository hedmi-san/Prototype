## 1. Stock Receipt Modal Product Combobox Integration

- [x] 1.1 Import `AppProductCombobox` and `useProductStore` in `StockView.vue`
- [x] 1.2 Replace the native `<select>` element with `<AppProductCombobox>` in the receipt modal without `:warehouse-stock`
- [x] 1.3 Update `openReceiptModal` and `handleSaveReceipt` to properly initialize and validate `receiptForm.productId`
- [x] 1.4 Clean up redundant `productService.getProducts` calls in `StockView.vue` in favor of `productStore`

## 2. Verification

- [x] 2.1 Verify product searching, keyboard navigation, and selection in the receipt modal
- [x] 2.2 Verify that stock quantity badges ("XX unités") are not displayed in the combobox dropdown during stock receipt
- [x] 2.3 Verify successful submission of manufacturer stock receipt with the selected product
