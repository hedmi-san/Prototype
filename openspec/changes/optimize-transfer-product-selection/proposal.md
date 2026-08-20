## Why

In the Inter-Warehouse Transfers interface (`TransferListView.vue`), managers create transfer requests to replenish stock between warehouses. Previously, selecting products lacked source-warehouse stock visibility and seamless reactivity when changing source warehouses. Applying the typeahead search and real-time stock indicator combobox pattern established in the sales management interface provides managers with an intuitive, fast way to search products by reference or name and instantly view real-time available stock at the source warehouse.

## What Changes

- **Source Warehouse Stock Fetching & Reactivity**: In `TransferListView.vue`, dynamically fetch and maintain stock levels for the selected source warehouse when opening the transfer request modal or changing the source warehouse dropdown.
- **Product Combobox Integration with Source Stock**: Pass the source warehouse stock array to `AppProductCombobox` in the transfer request modal so that managers see real-time stock availability badges (🟢 In Stock, 🟡 Low Stock, 🔴 Out of Stock) for each item at the chosen source warehouse.
- **Improved Transfer Line Item Workflow**: Provide dual-match typeahead search (by reference, name, brand), keyboard navigation, and clear actions for each transfer line item while maintaining existing transfer creation validations and authorization rules.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `transfers-management`: Add real-time product search and source warehouse stock indicators to the inter-warehouse transfer request interface.

## Impact

- `frontend/src/views/transfers/TransferListView.vue`: Reactive source warehouse stock fetching and combobox integration in the transfer creation modal.
- `openspec/specs/transfers-management/spec.md`: Specification update for inter-warehouse transfer product selection and source stock visibility.
