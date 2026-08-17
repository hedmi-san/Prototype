# reporting-audit-logging Specification

## Purpose
TBD - created by archiving change multi-warehouse-tool-distribution-system. Update Purpose after archive.
## Requirements
### Requirement: Role-Based Dashboard Metrics
The system SHALL provide customized dashboards displaying real-time operational KPIs for Admins across all warehouses, and for Managers and Accountants filtered to their assigned warehouse.

#### Scenario: Admin views global dashboard
- **WHEN** an Admin accesses the dashboard
- **THEN** the system SHALL display consolidated KPIs including total stock value, today's sales, monthly sales, low/out-of-stock counts, total operating expenses, total salaries, and warehouse performance comparisons

#### Scenario: Manager views warehouse dashboard
- **WHEN** a Manager accesses the dashboard
- **THEN** the system SHALL display KPIs scoped exclusively to their warehouse (today's sales, monthly sales, warehouse stock valuation, and local expenses)

### Requirement: Stock Valuation using Current Purchase Prices
The system SHALL calculate the monetary valuation of inventory using the product's current purchase price multiplied by its current physical stock quantity.

#### Scenario: Calculate warehouse stock valuation
- **WHEN** a stock report is generated for a warehouse having 20 units of Product A (purchase price 5,000 DZD) and 10 units of Product B (purchase price 2,000 DZD)
- **THEN** the system SHALL calculate the total stock valuation as (20 * 5,000) + (10 * 2,000) = 120,000 DZD

### Requirement: Immutable Audit Trail Logging
The system SHALL automatically capture and persist structured audit logs for critical operations (sale creation/edit/void, stock adjustments, price changes, transfer actions, expenses, HR modifications) capturing actor, action, timestamp, warehouse, and before/after values.

#### Scenario: Audit entry generated on sale edit
- **WHEN** an Accountant modifies the quantity of an item in an existing sale
- **THEN** the system SHALL create an audit log entry recording the user ID, action `SALE_EDITED`, the sale ID, warehouse ID, previous line item quantity in `old_values`, and updated quantity in `new_values`

