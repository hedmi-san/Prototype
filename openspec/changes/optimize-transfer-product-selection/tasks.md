## 1. Transfer View Stock Integration

- [x] 1.1 Add `sourceWarehouseStock` state and `fetchSourceWarehouseStock` function in `TransferListView.vue`
- [x] 1.2 Trigger `fetchSourceWarehouseStock` on `openCreateModal` and upon modifying the source warehouse selection
- [x] 1.3 Bind `:warehouse-stock="sourceWarehouseStock"` to `AppProductCombobox` in the transfer items builder

## 2. Verification & Testing

- [x] 2.1 Verify product combobox typeahead search by name, reference, and brand in transfer creation modal
- [x] 2.2 Verify source warehouse available stock badge indicators update reactively when switching departure warehouse
- [x] 2.3 Verify transfer request submission, item validation, and table refresh
