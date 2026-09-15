## ADDED Requirements

### Requirement: Printable Transport Slip Generation
The system SHALL provide a printable logistics document ("Bon de transport") for inter-warehouse transfers that have been approved.

#### Scenario: Rendering transfer details on the transport slip
- **WHEN** an authorized user opens the transport slip for an approved transfer
- **THEN** the system displays the company header (`EURL BOUSFOR GEN TRADING IMP.EXP`), the document title "BON DE TRANSPORT INTER-ENTREPÔTS", the transfer number, the creation/approval date, the source warehouse name and code, and the destination warehouse name and code

#### Scenario: Displaying item reference, name, and approved quantity
- **WHEN** the transport slip manifest is rendered
- **THEN** it displays each item included in the transfer with its product reference code, product name, and strictly the approved quantity entered by the source warehouse (`approvedQuantity`), excluding items where approved quantity is zero

#### Scenario: Dual signature zones
- **WHEN** the transport slip is printed
- **THEN** it includes dedicated signature blocks for the source warehouse handler ("Visa & Signature Expéditeur") and the destination warehouse receiver ("Visa & Signature Réceptionnaire")

### Requirement: Role and Status Scoping for Transport Slip Access
The system SHALL restrict access to the transport slip button based on user warehouse assignment and transfer lifecycle status.

#### Scenario: Source warehouse access when transfer is approved
- **WHEN** a transfer has status `APPROVED` and the current user is assigned to the source warehouse or has administrative privileges (`ADMIN` or global `SUPER_MANAGER`)
- **THEN** the "Bon de Transport" action button is visible and accessible in the transfer list and transfer details modal

#### Scenario: Destination warehouse cannot access transport slip
- **WHEN** a transfer has status `APPROVED` and the current user is assigned to the destination warehouse and does not have administrative privileges
- **THEN** the "Bon de Transport" action button is hidden, and only the arrival confirmation action ("Confirmer Réception") is available

#### Scenario: Button hidden when status is not approved
- **WHEN** a transfer has status `REQUESTED`, `CANCELLED`, `DECLINED`, or `CONFIRMED`
- **THEN** the "Bon de Transport" action button is hidden, preventing reprinting after arrival has been confirmed
