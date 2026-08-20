## ADDED Requirements

### Requirement: Real-Time Product Search and Source Warehouse Stock Combobox in Transfers
The inter-warehouse transfer request interface SHALL provide a typeahead search combobox enabling users to search products by partial names, references, or brands, displaying immediate matching results limited to top relevant items along with real-time available stock indicators for the selected source warehouse, and dynamically updating stock indicator availability when the source warehouse is changed.

#### Scenario: User searches product by reference or name in transfer line item
- **WHEN** a user enters a search query (e.g. "DCD796" or "Hammer Drill") in a transfer request line item combobox
- **THEN** the combobox SHALL display a dropdown of matching products showing product reference, name, brand, unit price, and real-time available stock status for the chosen source warehouse

#### Scenario: User changes source warehouse in transfer request
- **WHEN** a user modifies the source warehouse in the transfer request modal
- **THEN** the system SHALL re-fetch or update the stock availability for the newly selected source warehouse, and the comboboxes SHALL update their stock indicator badges accordingly

#### Scenario: User selects a product from the combobox in transfer request
- **WHEN** a user clicks or presses Enter on a search result in the transfer line item
- **THEN** the combobox SHALL update the line item's selected product ID, populate the search field with the selected product label, close the dropdown, and preserve transfer validation
