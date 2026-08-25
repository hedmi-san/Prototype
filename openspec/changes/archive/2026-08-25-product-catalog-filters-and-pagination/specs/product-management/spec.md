## ADDED Requirements

### Requirement: Server-Side Paginated Product Catalog Query
The system SHALL provide a paginated product retrieval endpoint supporting page and limit parameters, returning matching product records alongside pagination metadata including current page, limit, total records count, and total pages count.

#### Scenario: Query default paginated products
- **WHEN** a user requests the product list with default pagination parameters
- **THEN** the system SHALL return the first 25 products with pagination metadata indicating total count and total pages

#### Scenario: Custom page size and offset
- **WHEN** a user requests page 2 with a limit of 50 products
- **THEN** the system SHALL return items 51 to 100 with accurate total page calculations

#### Scenario: Unpaginated lookup for selection comboboxes
- **WHEN** an internal service or POS component requests all products with `all=true` or unpaginated query
- **THEN** the system SHALL return the full active product array for instant local lookup

### Requirement: Multi-Criteria Product Sorting
The system SHALL allow sorting the product catalog by sale price, purchase price, product name, reference, or creation timestamp in both ascending and descending orders.

#### Scenario: Sort products by sale price ascending
- **WHEN** a user selects sorting by sale price with ascending order
- **THEN** the system SHALL return products ordered from the lowest sale price to the highest sale price

#### Scenario: Sort products by sale price descending
- **WHEN** a user selects sorting by sale price with descending order
- **THEN** the system SHALL return products ordered from the highest sale price to the lowest sale price

#### Scenario: Sort products by purchase price
- **WHEN** a user selects sorting by purchase price ascending or descending
- **THEN** the system SHALL return products ordered according to their purchase price valuation

#### Scenario: Sort products alphabetically by name or reference
- **WHEN** a user selects alphabetical sorting by name (A-Z or Z-A) or reference
- **THEN** the system SHALL return products ordered alphabetically by the designated field

### Requirement: Brand Filtering and Distinct Brand Listing
The system SHALL allow filtering the product catalog by brand and provide a lightweight endpoint to retrieve all distinct available brands.

#### Scenario: Retrieve distinct brand list
- **WHEN** a client calls `GET /products/brands`
- **THEN** the system SHALL return a sorted array of unique, non-empty brand names present in the active catalog

#### Scenario: Filter catalog by specific brand
- **WHEN** a user filters products by brand name (e.g. "WEHAND")
- **THEN** the system SHALL return only products matching the selected brand and adjust pagination totals accordingly
