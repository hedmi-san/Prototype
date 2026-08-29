## ADDED Requirements

### Requirement: Product Box Size Definition in Catalog
The system SHALL store an integer `box_size` attribute on each product record, representing the number of pieces per carton (Colisage / Pièces par Carton). If a product is sold unpackaged or has no carton packaging, its `box_size` SHALL be `0`. The product creation and modification forms in `ProductListView.vue` and backend endpoints SHALL support defining and updating `box_size`.

#### Scenario: Admin creates a product with a defined box size
- **WHEN** an admin creates a new product and inputs `16` in the "Colisage (Pièces par Carton)" field
- **THEN** the product is saved with `box_size = 16`, and the product catalog table displays `Colisage : 16 pcs/ctn`

#### Scenario: Admin creates a product without box packaging
- **WHEN** an admin creates a new product and leaves the box size as `0`
- **THEN** the product is saved with `box_size = 0`, and the catalog displays `Colisage : —`

#### Scenario: Admin edits an existing product box size
- **WHEN** an admin opens the edit modal for a product, modifies the box size from `0` to `24`, and submits
- **THEN** the product is updated in the database and catalog table with `box_size = 24`

### Requirement: Carton Quantity Calculation in Inventory Stock
The inventory management system SHALL calculate and display the number of complete cartons in stock for each product record. The number of cartons SHALL be determined using strict integer floor division ($\lfloor \text{physical\_quantity} / \text{box\_size} \rfloor$) when `box_size > 0`. If `box_size` is `0`, the carton count SHALL be `0` / unapplicable.

#### Scenario: Product stock with complete cartons and loose pieces
- **WHEN** a warehouse has `100` physical units in stock for a product with `box_size = 16`
- **THEN** the stock view displays `100` physical units and indicates `6 Cartons` ($\lfloor 100 / 16 \rfloor = 6$)

#### Scenario: Product stock with box size 0
- **WHEN** a warehouse has `50` physical units in stock for a product with `box_size = 0`
- **THEN** the stock view displays `50` physical units with no carton count breakdown

### Requirement: Total Carton Count on Sales Invoice
The sales invoice document (`InvoiceDocument.vue`) SHALL compute and display the total number of complete cartons (`Nombre de Cartons`) for the entire sale order in its summary footer. The total cartons count SHALL be calculated as the sum of complete cartons for each line item ($\sum \lfloor \text{quantity} / \text{box\_size} \rfloor$ for items with $\text{box\_size} > 0$).

#### Scenario: Sale containing complete cartons
- **WHEN** an invoice contains line item A (qty: 32, box size: 16 $\rightarrow$ 2 cartons) and line item B (qty: 24, box size: 12 $\rightarrow$ 2 cartons)
- **THEN** the invoice footer summary displays `Nombre de Cartons : 4`

#### Scenario: Sale containing partial quantities below box size
- **WHEN** an invoice contains line item A (qty: 10, box size: 16 $\rightarrow$ $\lfloor 10/16 \rfloor = 0$ cartons) and line item B (qty: 20, box size: 16 $\rightarrow$ $\lfloor 20/16 \rfloor = 1$ carton)
- **THEN** the invoice footer summary displays `Nombre de Cartons : 1`

#### Scenario: Sale containing products with box size 0
- **WHEN** an invoice contains line items for products with `box_size = 0`
- **THEN** those line items contribute `0` to the total carton calculation
