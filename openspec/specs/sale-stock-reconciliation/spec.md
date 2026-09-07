# Sale Stock Reconciliation Specification

## Purpose
Provides atomic, per-product inventory reconciliation during sale invoice edits, computing signed quantity deltas against locked in-database baseline items, checking stock availability with full rollback, and logging auditable movements.

## Requirements

### Requirement: Per-Product Inventory Delta Calculation on Sale Edit
The system SHALL compute the signed difference $\Delta_{\text{stock}} = \text{oldQty} - \text{newQty}$ for each product involved in a sale update using the locked in-database `sale_items` as the baseline.

#### Scenario: Item quantity decreased (Customer returns items)
- **WHEN** a user modifies a sale and reduces the quantity of a product (e.g., from 7 to 3 units)
- **THEN** the system calculates $\Delta_{\text{stock}} = +4$, increases physical stock in `stock` by 4, and logs a `SALE_EDIT` stock movement with `quantity_change = +4`

#### Scenario: Item quantity increased (Customer takes more units)
- **WHEN** a user modifies a sale and increases the quantity of a product (e.g., from 1 to 3 units)
- **THEN** the system calculates $\Delta_{\text{stock}} = -2$, verifies stock availability, decrements physical stock in `stock` by 2, and logs a `SALE_EDIT` stock movement with `quantity_change = -2`

#### Scenario: Item removed from invoice
- **WHEN** a user removes an existing product line from a sale invoice
- **THEN** the system calculates $\Delta_{\text{stock}} = +\text{oldQty}$, restores the full quantity back to physical stock, and logs a `SALE_EDIT` movement with `quantity_change = +\text{oldQty}`

#### Scenario: New item added to invoice
- **WHEN** a user adds a new product line not previously on the invoice
- **THEN** the system calculates $\Delta_{\text{stock}} = -\text{newQty}$, verifies stock availability, deducts the quantity from physical stock, and logs a `SALE_EDIT` movement with `quantity_change = -\text{newQty}`

#### Scenario: Item quantity unchanged
- **WHEN** a product line remains at the exact same quantity in the updated sale
- **THEN** the system calculates $\Delta_{\text{stock}} = 0$ and inserts no row into `stock_movements` for that product

### Requirement: Atomic Stock Availability Check with Full Rollback
The system SHALL verify physical stock availability for every product where $\Delta_{\text{stock}} < 0$ and enforce complete transaction rollback if any product lacks sufficient stock.

#### Scenario: Requested quantity increase exceeds physical stock availability
- **WHEN** an edit increases the quantity of a product beyond the available physical stock (`physical_quantity - reserved_quantity < |Δ|`)
- **THEN** the transaction immediately rolls back completely, leaving `sales`, `sale_items`, `stock`, and `stock_movements` in their exact prior state, and returns HTTP 400 with a detailed error naming the product, available stock, and required excess

#### Scenario: Stock check passes and physical quantities are updated
- **WHEN** all products requesting increased stock have sufficient physical availability
- **THEN** all physical quantities in `stock` are updated atomically within the database transaction

### Requirement: Stock Movement Auditing and Cross-Referencing
The system SHALL tag each generated `SALE_EDIT` stock movement with a unified revision reference `[<invoiceNumber>-REV-<timestamp>]` and descriptive notes.

#### Scenario: Movement recorded with revision tag
- **WHEN** a stock movement is logged for a sale modification
- **THEN** `stock_movements.reference` contains the invoice number, and `stock_movements.notes` contains the revision tag, product delta, and direction (e.g., `[INV-71727116-REV-101204] Retour suite modification vente (7 → 3)`)

#### Scenario: Idempotent resubmission produces zero duplicate movements
- **WHEN** a duplicate `PUT /sales/:id` request is received with identical desired items
- **THEN** the system reads the already-updated `sale_items`, calculates $\Delta_{\text{stock}} = 0$ for all products, and generates zero additional `stock_movements`
