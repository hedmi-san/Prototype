## ADDED Requirements

### Requirement: Stock Movements Audit Ledger Query and Representation
The system SHALL expose and display complete stock movement records with unified attributes including movement type, delta quantity with sign, warehouse name, product reference and name, and reason/reference across both global views and warehouse-filtered queries.

#### Scenario: Query stock movements with full details
- **WHEN** an authenticated user requests stock movements via `GET /api/inventory/movements`
- **THEN** the API SHALL return an array of movement objects containing `id`, `warehouseId`, `warehouseName`, `productId`, `productName`, `productReference`, `type`, `movementType`, `quantity`, `quantityChange`, `reference`, `notes`, `reason`, and `createdAt`

#### Scenario: Display stock movement ledger in frontend
- **WHEN** a user visits the `/movements` page
- **THEN** each movement row SHALL display the formatted timestamp, warehouse name, product name with reference, movement type badge (such as 'Stock initial', 'Sortie Vente', 'Ajustement inventaire', 'Transfert entrant', 'Transfert sortant'), signed delta quantity with color coding, and reason or reference note
