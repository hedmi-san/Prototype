## ADDED Requirements

### Requirement: Automated Cross-Warehouse Sale Notification Emittance
The system SHALL emit automated notification records to the appropriate warehouse depot upon creation, completion, or cancellation of inter-warehouse fulfillment lines.

#### Scenario: Notification emitted to fulfillment warehouse on sale creation
- **WHEN** a sale is created at Warehouse A allocating 15 units to be fulfilled by Warehouse B
- **THEN** the system creates a notification of type `SALE_PICKUP_PENDING` addressed to Warehouse B detailing the customer name, voucher code, quantity, and product name

#### Scenario: Notification emitted to origin warehouse upon customer pickup
- **WHEN** staff at Warehouse B fulfill a pending pickup line and hand over the goods to the customer
- **THEN** the system creates a notification of type `SALE_PICKUP_COMPLETED` addressed to Warehouse A indicating that the customer has completed pickup for the order

#### Scenario: Notification emitted to fulfillment warehouse upon line cancellation
- **WHEN** a sale with a pending fulfillment line at Warehouse B is cancelled or refunded at Warehouse A
- **THEN** the system creates a notification of type `SALE_PICKUP_CANCELLED` addressed to Warehouse B indicating that the reservation is released and the pickup voucher is invalidated
