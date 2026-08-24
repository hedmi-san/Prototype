## ADDED Requirements

### Requirement: Inactive Warehouse Sale Creation Prevention
The system SHALL prevent creating new sales or issuing invoices for an inactive warehouse while preserving full access to search, view, and reprint historical invoices.

#### Scenario: Attempting sale creation on inactive warehouse
- **WHEN** a user or client sends a `POST /api/sales` request specifying or bound to an inactive warehouse
- **THEN** the system SHALL abort the transaction with an HTTP 400 Bad Request error stating that sales cannot be recorded for an inactive warehouse

#### Scenario: Historical invoice consultation for inactive warehouse
- **WHEN** an authenticated user searches or views sales records associated with an inactive warehouse
- **THEN** the system SHALL return the historical sale records and render the complete A4 invoice preview and reprint layout normally
