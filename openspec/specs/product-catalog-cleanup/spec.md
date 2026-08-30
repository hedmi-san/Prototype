# product-catalog-cleanup Specification

## Purpose
Defines requirements and validation scenarios for maintaining a streamlined product data model without category attributes, including product creation, updates, querying, search tokenization, and CSV exports.
## Requirements
### Requirement: Product Data Model Without Category Attribute
The system SHALL NOT maintain or expose a `category` attribute on the `products` table or `Product` domain interfaces. Product records SHALL consist of `id`, `reference`, `name`, `brand`, `description`, `purchase_price`, `sale_price`, `min_stock_alert`, `unit`, `box_size`, and `active`.

#### Scenario: Database schema and table definitions exclude category
- **WHEN** the database migrations and table schema run
- **THEN** the `products` table does not contain a `category` column

#### Scenario: Product creation and update API requests
- **WHEN** an admin creates or updates a product via `POST /api/products` or `PUT /api/products/:id`
- **THEN** the request does not require or store a `category` value, and the returned product payload omits `category`

### Requirement: Streamlined Product Queries and Search Filtering
Product query endpoints and frontend search helpers SHALL NOT filter by or search across product categories. Search queries SHALL search across `reference`, `name`, and `brand`.

#### Scenario: User performs text search in product catalog
- **WHEN** a user enters a search string on the product catalog view
- **THEN** the backend matches against `reference`, `name`, and `brand` without referencing a category field

#### Scenario: User searches for products in autocomplete combobox
- **WHEN** a user types search terms into `AppProductCombobox`
- **THEN** matching tokens are evaluated against product `name`, `reference`, and `brand`

### Requirement: Category-Free Product and Inventory CSV Exports
CSV export endpoints for product catalog (`GET /api/products/export/csv`) and inventory stock (`GET /api/inventory/export/csv`) SHALL NOT contain a "Catégorie" column or category parameter filters.

#### Scenario: Exporting products CSV
- **WHEN** a user exports products to CSV
- **THEN** the generated CSV file does not contain a "Catégorie" column and contains only reference, designation, brand, purchase/sale price, margin, unit, box size, and status columns

#### Scenario: Exporting inventory stock CSV
- **WHEN** a user exports warehouse stock to CSV
- **THEN** the generated CSV file does not include a "Catégorie" column

