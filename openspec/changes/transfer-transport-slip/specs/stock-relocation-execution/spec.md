## ADDED Requirements

### Requirement: Unified Dispatched Relocation Order Generation
The system SHALL generate inter-warehouse transfers from the stock relocation matrix directly in `APPROVED` status without prompting for execution modes or requiring an intermediate approval step.

#### Scenario: Submitting the relocation matrix
- **WHEN** an authorized user submits the bulk stock relocation matrix with allocated quantities for one or more destination warehouses
- **THEN** the system generates a transfer order for each destination warehouse with status `APPROVED`, sets `approved_quantity` equal to the allocated quantity for each item, reserves physical stock at the source warehouse (`reserved_quantity`), and sends a transfer notification to the destination warehouse

#### Scenario: No execution mode toggle in relocation interface
- **WHEN** a user opens the stock relocation modal
- **THEN** the modal does not display radio buttons for "Exécution Immédiate" or "Demandes de Transfert", and clearly indicates that orders are generated directly for dispatch and arrival confirmation

### Requirement: Destination Confirmation of Arrival Only
The system SHALL require only the destination warehouse to confirm arrival for relocation transfers.

#### Scenario: Destination confirms physical arrival of relocated goods
- **WHEN** a destination warehouse user receives goods from a relocation transfer with status `APPROVED` and clicks "Confirmer Réception"
- **THEN** the system deducts physical and reserved stock from the source warehouse, increments physical stock at the destination warehouse, logs `TRANSFER_OUT` and `TRANSFER_IN` movements, and updates the transfer status to `CONFIRMED`

### Requirement: Direct Transport Slip Printing from Relocation Summary
The system SHALL provide immediate access to print transport slips from the relocation execution result screen.

#### Scenario: Printing transport slips from the relocation success screen
- **WHEN** the relocation matrix execution finishes and displays the summary screen of generated transfer orders
- **THEN** each generated transfer card displays an "Imprimer Bon de Transport" button that opens the printable transport slip for that destination
