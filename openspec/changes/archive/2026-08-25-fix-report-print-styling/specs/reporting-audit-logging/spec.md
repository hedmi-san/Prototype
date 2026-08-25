## ADDED Requirements

### Requirement: Printable Inventory and Valuation Statement
The system SHALL provide high-fidelity printable layouts for the Stock Valuation report (`StockValuationView.vue`), including an official company and warehouse header, generation timestamp, valuation metric summary, and full tabular breakdown optimized for landscape A4 rendering without horizontal truncation.

#### Scenario: User prints stock valuation report
- **WHEN** the user clicks "Imprimer le Bilan" on the Stock Valuation report page
- **THEN** the system SHALL launch the browser print preview displaying the full stock valuation summary, company entity, warehouse scope, and complete product table on white background with navigation elements excluded

### Requirement: Printable Income and Financial Statement
The system SHALL provide high-fidelity printable layouts for the Financial P&L report (`FinancialReportsView.vue`), displaying the selected period, warehouse entity, revenue, COGS, itemized operating expenses, salaries, and net profit with clean tabular borders and page-break optimization.

#### Scenario: User prints financial statement
- **WHEN** the user clicks "Imprimer le Bilan" on the Financial Reports page
- **THEN** the system SHALL launch the browser print preview displaying the complete statement breakdown without navigation bars, period switchers, or action buttons
