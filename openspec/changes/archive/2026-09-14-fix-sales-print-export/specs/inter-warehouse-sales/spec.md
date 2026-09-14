## MODIFIED Requirements

### Requirement: Pickup Slip (Bon de Retrait) Generation
The system SHALL generate a distinct, printable pickup slip (Bon de Retrait) for each destination warehouse involved in an inter-warehouse sale, flowing cleanly without scroll container clipping or UI chrome pollution when printed.

#### Scenario: Printing pickup slip for customer
- **WHEN** an inter-warehouse sale is submitted with lines destined for Warehouse B
- **THEN** the system generates a printable Bon de Retrait containing the parent invoice number, destination warehouse name and address, item list with quantities, customer information, reservation expiry timestamp, and a prominent badge indicating payment status (Pre-paid vs Due on Pickup)

#### Scenario: Printing pickup slip from post-sale creation modal
- **WHEN** staff triggers printing of a pickup slip from the vouchers modal immediately after sale creation
- **THEN** the printed output renders un-clipped without being constrained by preview scrollboxes, expands to full-page printable width, and suppresses the success alert banner and voucher tabs from the printed document

#### Scenario: Printing pickup slip from sales list line action
- **WHEN** staff opens and prints a pickup slip from the Sales List line item modal
- **THEN** the preview container is un-clipped and the pickup slip prints cleanly without modal chrome

#### Scenario: Printing customer sales invoice with associated fulfillment lines
- **WHEN** staff prints a sales invoice from the Invoice Viewer modal for a sale that includes inter-warehouse fulfillment lines
- **THEN** the internal administrative fulfillment breakdown card is suppressed from the print output, ensuring the customer invoice remains an official commercial document without operational logistics chrome
