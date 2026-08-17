## ADDED Requirements

### Requirement: Application-Wide French Interface Language
The frontend application SHALL display all navigation items, page headers, buttons, tables, filters, forms, tooltips, dialogs, and labels in French as the primary and default interface language.

#### Scenario: Render navigation and dashboard in French
- **WHEN** any user logs into the application and navigates to the dashboard or any sidebar module
- **THEN** all navigation links (Tableau de bord, Inventaire, Produits, Ventes, Transferts, Dépenses, Salaires, Employés, Rapports, Administration), warehouse scope indicators, and header actions SHALL be displayed in French

#### Scenario: Render business modules and tables in French
- **WHEN** a user opens inventory, products, sales, transfers, salaries, expenses, or reports views
- **THEN** all column headers, action buttons (Ajouter, Modifier, Supprimer, Valider, Enregistrer, Exporter), search placeholders, filter dropdowns, and summary stat cards SHALL be rendered in French

### Requirement: Localized Feedback, Errors, and Confirmation Dialogs
The system SHALL display all validation errors, API failure notifications, success alerts, modal prompts, and deletion confirmation dialogs in natural, clear French.

#### Scenario: Display validation feedback in French
- **WHEN** a user submits a form with invalid or missing required fields
- **THEN** the form SHALL show validation messages in French (e.g., "Ce champ est obligatoire", "Montant invalide", "Quantité insuffisante")

#### Scenario: Display confirmation modal dialogs in French
- **WHEN** a user triggers a destructive or state-changing action (such as deleting an item, approving a transfer, or finalizing a sale)
- **THEN** the confirmation dialog title, description, and action buttons SHALL display in French (e.g., "Confirmer l'opération", "Êtes-vous sûr de vouloir supprimer cet élément ?", "Annuler", "Confirmer")

### Requirement: French Locale Formatting for Numbers, Dates, and Currencies
The frontend application SHALL format all monetary amounts, numerical quantities, timestamps, and calendar dates using French locale formatting conventions (`fr-FR`).

#### Scenario: Format monetary amounts and numbers in French style
- **WHEN** any monetary amount, price, or numeric balance is rendered in tables, cards, or inputs
- **THEN** the system SHALL format the numbers with space thousand separators and comma decimals (e.g., `1 250 000 FCFA` or `1 250,50 €` according to system currency config)

#### Scenario: Format dates and timestamps in French style
- **WHEN** order dates, transfer timestamps, payroll periods, or audit logs are displayed
- **THEN** the system SHALL display dates in French format (e.g., `DD/MM/YYYY` or `17 août 2026, 18:30`)

### Requirement: Translated Domain Enums and Status Badges
The frontend SHALL map and display backend domain enum values, user roles, order statuses, transfer states, payment methods, and expense categories as standardized French user-facing terms.

#### Scenario: Display order and transfer status badges in French
- **WHEN** an order or transfer with status `PENDING`, `COMPLETED`, `CANCELLED`, `IN_TRANSIT`, or `APPROVED` is displayed
- **THEN** the status badge SHALL show the corresponding French term ("En attente", "Terminé", "Annulé", "En transit", "Approuvé")

#### Scenario: Display user roles and permission titles in French
- **WHEN** a user's role (`ADMIN`, `WAREHOUSE_MANAGER`, `CASHIER`, `AUDITOR`) is rendered in user pills, employee lists, or access management tables
- **THEN** the role badge SHALL display the French label ("Administrateur", "Responsable d'entrepôt", "Caissier", "Auditeur")
