## 1. Product Catalog View Refactoring

- [x] 1.1 Remove the "Tarif" action button from the table row actions in `frontend/src/views/products/ProductListView.vue`
- [x] 1.2 Remove the price update modal template markup (`AppModal` with `showPriceModal`) from `frontend/src/views/products/ProductListView.vue`
- [x] 1.3 Clean up unused reactive state (`showPriceModal`, `priceUpdatingProduct`, `priceForm`) and handler methods (`openPriceModal`, `handleUpdatePrice`) in `frontend/src/views/products/ProductListView.vue`
- [x] 1.4 Update `handleWindowFocus` condition in `frontend/src/views/products/ProductListView.vue` to remove references to `showPriceModal`

## 2. Verification & Validation

- [x] 2.1 Verify that the product catalog table actions column displays only the "Modifier" button without visual regressions
- [x] 2.2 Verify that price adjustments made through the "Modifier" modal save and reflect correctly in the catalog table and profit margins
