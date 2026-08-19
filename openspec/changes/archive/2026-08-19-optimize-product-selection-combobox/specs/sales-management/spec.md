## ADDED Requirements

### Requirement: Real-Time Product Search and Stock Indicator Combobox
The point-of-sale invoicing interface SHALL provide a typeahead search combobox enabling cashiers to search products by typing partial names or references, displaying immediate matching results limited to top relevant items along with warehouse-specific available stock indicators, and emitting product selection events without altering subtotal calculations or checkout validation.

#### Scenario: Cashier searches product by reference or name
- **WHEN** a cashier enters a search query (e.g. "DCD796" or "Hammer Drill") in the invoice line item combobox
- **THEN** the combobox SHALL display a dropdown of up to 10 matching products showing product reference, name, brand, unit sale price, and real-time available stock count for the selected warehouse

#### Scenario: Cashier selects a product from the combobox
- **WHEN** a cashier clicks or presses Enter on a search result
- **THEN** the combobox SHALL update the line item's selected product ID, populate the input with the selected product title, close the dropdown, and update line item price and subtotal calculations
