## 1. Frontend Product Form Default Brand

- [x] 1.1 Update `productForm` ref initial state in `frontend/src/views/products/ProductListView.vue` to set `brand: 'WEHAND'` instead of `'KRAFT'`
- [x] 1.2 Update `openCreateModal()` in `frontend/src/views/products/ProductListView.vue` to initialize `brand: 'WEHAND'`
- [x] 1.3 Verify that `openEditModal()` preserves `product.brand` and the template input `<AppInput v-model="productForm.brand" ... />` remains fully editable

## 2. Backend Product Creation Fallback

- [x] 2.1 Update `POST /api/products` handler in `backend/src/routes/product.routes.ts` to assign `'WEHAND'` as default fallback if brand is omitted or empty whitespace
- [x] 2.2 Verify that updating products via `PUT /api/products/:id` respects user-supplied brand edits

## 3. Verification & Validation

- [x] 3.1 Run frontend and backend typecheck/lint/build commands to ensure no syntax or type errors
- [x] 3.2 Verify through functional checks that opening "Nouveau Produit" displays "WEHAND", allowing custom input override and successful creation
