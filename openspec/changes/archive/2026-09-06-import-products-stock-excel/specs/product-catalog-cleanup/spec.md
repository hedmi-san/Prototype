## MODIFIED Requirements

### Requirement: Product Data Model Without Category Attribute
The system SHALL NOT maintain or expose a `category` attribute on the `products` table or `Product` domain interfaces. Product records SHALL consist of `id`, `reference`, `name`, `brand`, `description`, `purchase_price`, `sale_price`, `min_stock_alert`, `unit`, `box_size`, `tva`, and `active`. The `tva` attribute SHALL represent the Value Added Tax percentage rate (default 19.00%).

#### Scenario: Database schema and table definitions exclude category and include tva
- **WHEN** the database migrations and table schema run
- **THEN** the `products` table does not contain a `category` column and contains a `tva NUMERIC(5, 2) NOT NULL DEFAULT 19.00` column

#### Scenario: Product creation and update API requests
- **WHEN** an admin creates or updates a product via `POST /api/products` or `PUT /api/products/:id`
- **THEN** the request accepts and returns the `tva` value defaulting to 19.00% if omitted, does not require or store a `category` value, and the returned product payload omits `category`
