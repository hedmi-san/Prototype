## Context

In the product catalog management UI (`ProductListView.vue`), adding a new product currently initializes the brand attribute to `brands.value[0] || 'KRAFT'`. If the database already contains other brands, or if the brand list is empty, this can cause unintended defaults (such as `'KRAFT'` or whichever brand is first alphabetically).

The primary brand distributed by the business is `WEHAND`. The user requirement states:
1. When adding a product, the brand field should have `WEHAND` pre-filled by default.
2. The field must remain freely editable so users can change or type any other brand name when external or third-party products are introduced.
3. Editing existing products must preserve their existing saved brand value.

## Goals / Non-Goals

**Goals:**
- Set `WEHAND` as the pre-filled default value in the brand input field when opening the create product modal in `ProductListView.vue`.
- Ensure the brand field is an editable text input that allows any custom brand string to be entered and saved.
- Ensure existing products retain their assigned brand when opened in the edit modal.
- Ensure the backend route `POST /api/products` aligns with the database schema default (`'WEHAND'`) if brand is omitted or empty.

**Non-Goals:**
- Restricting brand entry to a hardcoded enum or pre-defined selection list. Any brand name remains valid.
- Changing how distinct brands are listed in the catalog filter dropdown (which queries `SELECT DISTINCT brand ...`).
- Modifying the database schema (`backend/src/db/schema.ts` already defines `brand VARCHAR(100) NOT NULL DEFAULT 'WEHAND'`).

## Decisions

### Decision: Explicit Default in Frontend Modal State
- **Choice**: In `ProductListView.vue`, set `productForm.value.brand = 'WEHAND'` in both initial state definition and the `openCreateModal()` handler, replacing `brands.value[0] || 'KRAFT'`.
- **Rationale**: Direct, robust, and completely independent of asynchronous brand fetching. Guarantees that when the user opens the "Nouveau Produit" modal, `"WEHAND"` is immediately visible in the field.
- **Alternatives Considered**:
  - *Keep `brands.value[0]` if WEHAND exists in brands*: Fragile because if brands are loaded alphabetically or WEHAND is not yet seeded, another brand would be selected.
  - *Converting to a rigid select dropdown*: Would prevent users from quickly typing a new brand name when adding third-party products. A text input with a default string is much more flexible.

### Decision: Backend API Fallback
- **Choice**: In `backend/src/routes/product.routes.ts`, default `brand` to `'WEHAND'` if `brand?.trim()` is falsy or omitted during product creation:
  ```typescript
  const productBrand = brand?.trim() || 'WEHAND';
  ```
- **Rationale**: Harmonizes the backend route logic with the database table default (`DEFAULT 'WEHAND'`) and prevents saving empty or whitespace-only brand values.

## Risks / Trade-offs

- **[Risk] User clears the brand input and leaves it blank**:
  - *Mitigation*: The form input has `required`, and backend falls back to `'WEHAND'` if an empty string is submitted.
