## ADDED Requirements

### Requirement: Default Product Brand Pre-population
When creating a product in the catalog interface, the system SHALL initialize the brand field with `'WEHAND'`. The user interface SHALL present `'WEHAND'` pre-filled in the brand input field upon opening the creation modal.

#### Scenario: User opens the create product modal
- **WHEN** a user clicks "Nouveau Produit" in the product catalog view (`ProductListView.vue`)
- **THEN** the product modal opens with the "Marque" field populated with `"WEHAND"`

#### Scenario: Brand field default is independent of existing catalog brands
- **WHEN** products exist in the catalog with various brands (or when no products exist)
- **THEN** opening the create product modal initializes the brand field to `"WEHAND"` rather than selecting another existing brand

### Requirement: Editable Brand Selection and Custom Brand Creation
The brand field in the product creation and editing modal SHALL be an editable text input. Users SHALL be able to clear or change the brand value to any custom brand name, and submitting the form SHALL persist the entered brand.

#### Scenario: User creates product with default WEHAND brand
- **WHEN** a user opens the create product modal and saves the form without modifying the pre-filled brand
- **THEN** the product is persisted with brand `"WEHAND"`

#### Scenario: User overrides the brand with an external brand name
- **WHEN** a user opens the create product modal, replaces `"WEHAND"` with `"BOSCH"`, and saves the form
- **THEN** the product is created with brand `"BOSCH"`
- **AND** the new brand appears in the catalog brand filter options

### Requirement: Preservation of Existing Product Brand on Edit
When editing an existing product, the system SHALL pre-populate the brand field with the product's saved brand value without overwriting it with the default brand.

#### Scenario: User edits a product with a non-default brand
- **WHEN** a user opens the edit modal for an existing product with brand `"DEWALT"`
- **THEN** the modal displays `"DEWALT"` in the "Marque" field
- **AND** submitting the form preserves or updates the brand as modified by the user

### Requirement: Backend Default Fallback for Brand
When a product creation request is received by the backend API (`POST /api/products`), if `brand` is omitted or contains only whitespace, the backend SHALL assign `'WEHAND'` as the default brand in accordance with the database default constraint.

#### Scenario: Backend receives product creation without explicit brand
- **WHEN** a client sends a `POST /api/products` request omitting `brand` or providing an empty string
- **THEN** the backend assigns `"WEHAND"` to the product record
