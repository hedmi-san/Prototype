## ADDED Requirements

### Requirement: Sticky Cart Column in POS Interface
The Point of Sale (POS) interface (`CreateSaleView.vue`) SHALL maintain the product cart column ("Lignes de Produits") in a sticky position within the active viewport as the user scrolls through the sale configuration and payment form in the right column.

#### Scenario: User scrolls down long payment and settlement form with single-item cart
- **WHEN** a cashier enters a sale with 1 line item and scrolls down the right column to inspect payment conditions, enter downpayments, or click confirmation
- **THEN** the left cart column remains visibly pinned below the navigation header, does not scroll out of view, and does not leave blank dead space

#### Scenario: User scrolls down with multi-item cart exceeding viewport height
- **WHEN** a cashier enters 8 or more product line items such that the table exceeds the viewport height
- **THEN** the cart container adheres to viewport bounds (`max-height: calc(100vh - 92px)`), the item table scrolls internally (`overflow-y: auto`), and the right column scrolls independently without causing cart content to vanish

### Requirement: Persistent Running Cart Summary Footer
The sticky product cart column SHALL display a persistent footer at the bottom of the cart card showing the total line count, total quantity of units, and cumulative cart currency total.

#### Scenario: Immediate visual verification of cart total during payment entry
- **WHEN** a cashier configures payment terms or enters an acompte in the right column
- **THEN** the running cart total ("Cumul panier") is displayed persistently at the bottom of the left column matching the invoice total calculation in real-time

#### Scenario: Dynamic updates to cart total
- **WHEN** line items are added, removed, or their quantities or prices are adjusted in the table
- **THEN** the persistent cart summary footer immediately reflects the updated line count, total units, and monetary total

### Requirement: Sticky Global Navigation Sidebar
The main application sidebar (`DashboardLayout.vue`) SHALL remain pinned in place below the top application header during document scrolling, providing an independent vertical scroll container for navigation links when required.

#### Scenario: Page content vertical scroll does not cut off sidebar navigation
- **WHEN** a user navigates to any content-heavy page and scrolls down to view lower content
- **THEN** the sidebar remains sticky with `position: sticky; top: 60px; height: calc(100vh - 60px); overflow-y: auto`, the top navigation links remain visible, and lower items like "Journaux d'Audit" are never clipped or partially rendered
