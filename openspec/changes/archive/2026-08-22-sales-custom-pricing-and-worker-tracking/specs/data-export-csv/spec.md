## MODIFIED Requirements

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
