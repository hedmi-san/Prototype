# data-export-csv Specification

## Purpose
Defines CSV data export generation, UTF-8 BOM encoding for spreadsheet compatibility, warehouse-scoped filtering, and secure browser downloads across product catalogs, sales transactions, and multi-warehouse inventory stock.
## Requirements
### Requirement: Product Catalog CSV Export
The system SHALL provide a CSV export endpoint (`GET /api/products/export/csv`) and user interface action allowing authorized users to download the product catalog in CSV format with UTF-8 BOM encoding.

#### Scenario: Download product catalog CSV
- **WHEN** an authorized user requests the product list CSV export
- **THEN** the system SHALL stream a CSV file containing columns for Product ID, SKU/Reference, Barcode, Product Name, Category, Purchase Price (DZD), Wholesale Price (DZD), Retail Price (DZD), Unit, Min Stock Threshold, and Active Status, encoded with UTF-8 BOM (`\uFEFF`) and proper header/comma/quote escaping.

#### Scenario: Filtered product catalog CSV export
- **WHEN** an authorized user applies a search query or category filter and requests CSV export
- **THEN** the system SHALL generate the CSV containing only the products matching the specified filter criteria.

### Requirement: Sales History CSV Export
The system SHALL provide a CSV export endpoint (`GET /api/sales/export/csv`) and user interface action allowing authorized users to export historical sales transactions with date range filtering and warehouse scoping, including issuer user and assigned follow-up worker attributes.

#### Scenario: Export sales within date range with issuer and worker details
- **WHEN** an authorized user selects a start date and end date and triggers sales CSV export
- **THEN** the system SHALL stream a CSV file containing Invoice Number, Sale Date, Warehouse Name, Customer Name, Customer Phone, Émis par (User Name), Agent de suivi (Worker/Employee Name), Total Amount (DZD), Status, Articles, and Created Date for all transactions within that date range.

#### Scenario: Role-based warehouse scoping for sales export
- **WHEN** a Manager or Accountant requests a sales CSV export
- **THEN** the system SHALL strictly restrict the export to sales records associated with the user's assigned warehouse.

#### Scenario: Admin multi-warehouse sales export
- **WHEN** an Administrator requests a sales CSV export with no specific warehouse selected
- **THEN** the system SHALL export sales records across all warehouses in the distribution network.

### Requirement: Warehouse Stock and Valuation CSV Export
The system SHALL provide a CSV export endpoint (`GET /api/inventory/export/csv`) and user interface action allowing authorized users to export warehouse inventory stock levels, low-stock alerts, and monetary valuations.

#### Scenario: Export warehouse inventory stock levels
- **WHEN** an authorized user requests the stock level CSV export for a warehouse
- **THEN** the system SHALL stream a CSV file containing Warehouse Name, Product Reference, Barcode, Product Name, Category, Physical Stock Quantity, Reserved Quantity, Available Quantity, Minimum Threshold, Alert Status, Unit Purchase Price, and Total Stock Valuation.

#### Scenario: Filter low-stock inventory export
- **WHEN** a user triggers the CSV export with low-stock filter enabled
- **THEN** the CSV file SHALL only include items where the available quantity is less than or equal to the minimum threshold.

### Requirement: Client-Side Download and Feedback
The system SHALL provide visual download triggers in the web frontend with progress/loading states and automatic browser file downloads.

#### Scenario: Browser download with timestamped filename
- **WHEN** a user clicks "Export CSV" on the Products, Sales, or Inventory view
- **THEN** the frontend SHALL show a loading indicator during generation, trigger a browser file download with a standardized timestamped filename (e.g., `products_export_YYYY-MM-DD.csv`), and display a success notification upon completion.

#### Scenario: Unauthorized export prevention
- **WHEN** an unauthenticated or unauthorized user attempts to access any CSV export endpoint
- **THEN** the system SHALL reject the request with HTTP 401 Unauthorized or HTTP 403 Forbidden.

