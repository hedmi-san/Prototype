## Why

Currently, when creating a new product in the catalog, the brand field is initialized with either the first existing brand found in the database (`brands.value[0]`) or hardcoded to `'KRAFT'`. The business primary brand is `WEHAND`. Users should see `WEHAND` pre-filled by default when adding a new product, while retaining the full flexibility to edit and enter any other brand name if importing or cataloging external brands.

## What Changes

- **Product Form Default Brand**: Update `productForm` initialization in `frontend/src/views/products/ProductListView.vue` so that `brand` defaults to `'WEHAND'` instead of `'KRAFT'` or `brands.value[0]`.
- **Product Creation Modal**: When opening the creation modal (`openCreateModal`), initialize the brand field with `'WEHAND'`.
- **Editable Brand Input**: Ensure the brand field remains an editable text input allowing users to change the brand to any custom value (e.g., when introducing third-party brands).
- **Backend Consistency**: Ensure backend `POST /api/products` handles default brand assignment consistently with the database schema default (`'WEHAND'`) if brand is omitted or empty.

## Capabilities

### New Capabilities
- `product-brand-default`: Defines requirements and scenarios for the default product brand value (`WEHAND`), its pre-population in the product creation modal, its full editability for custom brand names, and preservation of existing brand values during product updates.

### Modified Capabilities

## Impact

- **Frontend UI**: `frontend/src/views/products/ProductListView.vue` (state initialization in `productForm` and `openCreateModal`).
- **Backend API**: `backend/src/routes/product.routes.ts` (validation and fallback default for product creation if applicable).
