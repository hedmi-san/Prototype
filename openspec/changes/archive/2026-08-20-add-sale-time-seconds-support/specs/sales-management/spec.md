## MODIFIED Requirements

### Requirement: Sale Date Persistence and Multi-View Display
The system SHALL store, return, and display the formatted sale transaction timestamp (`saleDate`) with full date and time precision including hours, minutes, and seconds (`DD/MM/YYYY HH:mm:ss`) across all sales views including the sales list table, the fiscal invoice preview modal, the sale edit modal, and dashboard recent sales.

#### Scenario: View sale list with formatted date
- **WHEN** an authenticated user navigates to the sales list page (`/sales`)
- **THEN** the table SHALL display the formatted sale date and time with seconds (e.g. `20/08/2026 14:30:15`) for each invoice row in the "Date de Vente" column

#### Scenario: View fiscal invoice modal with sale date
- **WHEN** a user clicks to view or print an invoice from the sales list
- **THEN** the invoice modal header SHALL display the exact fiscal issue timestamp "Date : <formatted saleDate with seconds>"

#### Scenario: Pre-populate sale date in edit modal
- **WHEN** an authorized user opens the edit modal for an existing sale
- **THEN** the form SHALL include a "Date de Vente" datetime-local input field with step="1" precision pre-filled with the sale's current `saleDate` including seconds
