## ADDED Requirements

### Requirement: Direct Facture Creation from Sales List
The sales management interface SHALL allow operators to directly initiate fiscal invoice creation from any eligible unbilled sale in the sales list.

#### Scenario: Operator clicks facturer on an unbilled sale
- **WHEN** the operator clicks the "Facturer" action button on an eligible sale in the sales table
- **THEN** the fiscal invoice creation modal opens with that sale pre-selected and customer details automatically populated

#### Scenario: Sale already has an issued facture
- **WHEN** a sale has already been converted into a fiscal invoice
- **THEN** the sales table displays an indicator or link showing the facture number instead of the unbilled action button

### Requirement: Asynchronous Sale Search in Facture Modal
The fiscal invoice creation modal SHALL provide an asynchronous, debounced combobox for searching and selecting unbilled delivery sales without loading the full sales dataset.

#### Scenario: Opening modal displays initial recent suggestions
- **WHEN** the operator opens the fiscal invoice modal without a pre-selected sale
- **THEN** the system loads and displays up to 10 recent unbilled sales as quick suggestions

#### Scenario: Searching by partial invoice number or customer name
- **WHEN** the operator types two or more characters in the sale search input
- **THEN** the system issues a debounced query to the server and updates the candidate list with matching unbilled sales

#### Scenario: Selecting a search result
- **WHEN** the operator clicks on a candidate sale from the search results
- **THEN** the sale is selected, the combobox closes, and client billing coordinates (name, address, RC, NIF, ART, NIS) are populated into the form

### Requirement: Backend Sales Invoicing Metadata
The sales retrieval endpoint (`GET /sales`) SHALL return facture linkage information for every sale.

#### Scenario: Fetching sales with facture metadata
- **WHEN** the client requests the paginated sales list
- **THEN** each returned sale record includes `factureId` and `factureNumber` (or null if not yet invoiced)

### Requirement: Scalable Querying of Unbilled Sales
The unbilled sales retrieval endpoint (`GET /factures/sales-without-facture`) SHALL efficiently filter and limit candidate results.

#### Scenario: Querying candidate sales with a search term
- **WHEN** a request is made with query parameter `search`
- **THEN** the endpoint filters candidate sales where the invoice number, customer name, or client name matches the term, returning a limited result set (at most 15-20 items)
