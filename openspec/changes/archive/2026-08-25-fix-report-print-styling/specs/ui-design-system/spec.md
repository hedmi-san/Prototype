## ADDED Requirements

### Requirement: Dual-Mode Print Isolation Architecture
The UI design system SHALL support dual-mode print isolation that dynamically differentiates between modal-isolated document printing (e.g. A4 invoice vouchers) and direct page-level report printing (e.g. stock valuation, financial statements).

#### Scenario: Print from teleported document modal
- **WHEN** a print action is triggered while a modal backdrop is active in the DOM (`body:has(.modal-backdrop)`)
- **THEN** the system SHALL hide the main application container (`#app`) and render only the teleported modal document sheet

#### Scenario: Print from direct application view
- **WHEN** a print action is triggered from a direct view without an active modal backdrop
- **THEN** the system SHALL keep the main application container (`#app`) visible, hide UI chrome (`.top-header`, `.sidebar`, `.header-actions`, `.read-only-banner`, and interactive buttons), and stretch `.main-content` to 100% width with visible overflow
