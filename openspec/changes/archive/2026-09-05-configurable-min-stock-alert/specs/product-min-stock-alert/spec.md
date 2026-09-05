## ADDED Requirements

### Requirement: Default Minimum Stock Alert Value
The system SHALL set the default value of `min_stock_alert` on the `products` database table and backend creation endpoints to `1`. When a new product is created without specifying a `minStockAlert` value, the system SHALL assign `1` as its threshold.

#### Scenario: Product created without explicit alert threshold
- **WHEN** a user or client creates a product and omits `minStockAlert`
- **THEN** the product record is created with `min_stock_alert = 1`

#### Scenario: Database schema default constraint
- **WHEN** the database schema initializes or products are inserted via direct SQL without specifying `min_stock_alert`
- **THEN** PostgreSQL applies the column default constraint of `1`

### Requirement: Configurable Minimum Stock Alert in Product Form
The product management modal in `ProductListView.vue` SHALL provide a dedicated numeric input field for "Seuil d'Alerte Stock Min". The field SHALL accept non-negative integers ($\ge 0$). When opening the modal to create a new product, the input SHALL be initialized to `1`. When opening the modal to edit an existing product, the input SHALL be pre-populated with the product's saved `minStockAlert` value.

#### Scenario: User creates a product with a customized alert threshold
- **WHEN** a user opens the "Ajouter un Nouveau Produit" modal, enters `5` into the "Seuil d'Alerte Stock Min" field, and submits the form
- **THEN** the application sends `minStockAlert: 5` to `POST /api/products` and the product is persisted with `min_stock_alert = 5`

#### Scenario: User modifies an existing product's alert threshold
- **WHEN** a user opens the "Modifier la Fiche Produit" modal for a product with `minStockAlert = 1`, changes the threshold to `8`, and submits the form
- **THEN** the application sends `minStockAlert: 8` to `PUT /api/products/:id` and the product is updated with `min_stock_alert = 8`

### Requirement: Inventory Alert Evaluation Based on Custom Threshold
The inventory stock view and stock alert status indicators SHALL evaluate low stock conditions using the product's configured `min_stock_alert` value, with a fallback default of `1` if unassigned. A stock record SHALL be flagged as low stock when available quantity is strictly greater than 0 and less than or equal to `min_stock_alert` ($0 < \text{available\_quantity} \le \text{min\_stock\_alert}$).

#### Scenario: Product with custom threshold triggers low stock alert
- **WHEN** a warehouse has `3` available units of a product whose `min_stock_alert` is set to `5`
- **THEN** the stock entry is flagged as low stock ("Stock Faible") because available quantity `3` is less than or equal to `5`

#### Scenario: Product with default threshold remains normal
- **WHEN** a warehouse has `3` available units of a product whose `min_stock_alert` is set to `1`
- **THEN** the stock entry is flagged as normal stock because available quantity `3` is greater than `1`
