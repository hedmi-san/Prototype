## ADDED Requirements

### Requirement: Typeahead Product Search for Stock Receipts
The inventory stock reception interface SHALL provide a searchable typeahead combobox allowing users to filter and select products by reference, name, brand, or category from the cached product catalog, omitting current stock quantity badges and updating the receipt form selection upon confirmation.

#### Scenario: User searches product by reference or name in receipt modal
- **WHEN** a user opens the manufacturer stock receipt modal and types a search query (e.g. "BOSCH" or "226") in the product combobox
- **THEN** the combobox SHALL display matching products in a dropdown limited to top results showing product reference, name, brand, and unit sale price without rendering warehouse stock availability badges

#### Scenario: User selects a product for receipt
- **WHEN** a user selects a product from the combobox dropdown or presses Enter on a highlighted result
- **THEN** the combobox SHALL update the receipt form's product ID, format the input with the selected product reference and name, and allow the user to submit the stock receipt
