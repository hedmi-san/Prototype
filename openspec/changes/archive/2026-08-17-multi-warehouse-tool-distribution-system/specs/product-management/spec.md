## ADDED Requirements

### Requirement: Product Catalog Management
The system SHALL maintain a catalog of distributed tool products with reference code, name, brand, purchase price, sale price, unit of measure, and active status.

#### Scenario: Create a product
- **WHEN** an authorized user (Admin, Manager, or Accountant) provides a unique reference, name, brand, purchase price, sale price, and unit
- **THEN** the system SHALL create the product and initialize zero-stock records across warehouses

#### Scenario: Reject duplicate product reference
- **WHEN** a user attempts to create a product with an existing reference code
- **THEN** the system SHALL reject the request with a conflict error

### Requirement: Product Pricing Management and Permissions
The system SHALL allow both Managers and Accountants to view and update the purchase price and sale price of products.

#### Scenario: Accountant updates purchase and sale prices
- **WHEN** an Accountant or Manager submits an updated purchase price or sale price for a product
- **THEN** the system SHALL update the product prices, record an audit event, and apply the new prices to future operations without retroactively modifying historical sales
