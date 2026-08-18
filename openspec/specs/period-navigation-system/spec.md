# Period Navigation System

## Requirements

### Requirement: Granular Time Scale Selection
The system SHALL provide a segmented control allowing users to switch between 5 distinct time granularities: `Jour` (Day), `Semaine` (Week), `Mois` (Month), `Trimestre` (Quarter), and `Année` (Year).

#### Scenario: User changes granularity from Month to Quarter
- **WHEN** the user selects the `Trimestre` granularity tab
- **THEN** the system SHALL compute the calendar quarter boundaries encompassing the current reference date and update the period label accordingly (e.g. "T1 2026")

### Requirement: Unit Stepper Navigation
The system SHALL provide previous (◀) and next (▶) stepper buttons to shift the reference date by exactly one period unit of the active granularity.

#### Scenario: User clicks previous button in Month mode
- **WHEN** the active period is "Mars 2025" and the user clicks ◀
- **THEN** the system SHALL shift the period to "Février 2025" with start date 2025-02-01 and end date 2025-02-28

#### Scenario: Quarter crossing year boundary
- **WHEN** the active period is "T1 2025" and the user clicks ◀
- **THEN** the system SHALL shift the period to "T4 2024" (2024-10-01 to 2024-12-31)

### Requirement: Future Date Protection
The system SHALL prevent navigation into future dates by disabling the next (▶) stepper button when the next unit's start date is greater than the current date.

#### Scenario: Next button disabled on current period
- **WHEN** the active period is the current calendar month
- **THEN** the system SHALL set the next (▶) button state to disabled

### Requirement: Quick Jump Popover
The system SHALL open an interactive selector popover when the central period label is clicked, allowing direct selection of year, month, or quarter.

#### Scenario: User jumps directly to past month
- **WHEN** the user opens the popover, changes year to 2024, and clicks "Novembre"
- **THEN** the system SHALL immediately set the active period to November 2024 and close the popover

### Requirement: Reset to Current Period Shortcut
The system SHALL provide a shortcut action to instantly reset the navigator back to the current period.

#### Scenario: Reset from past year to today
- **WHEN** the user is viewing data from 2023 and clicks "Revenir à aujourd'hui"
- **THEN** the system SHALL restore the reference date to today's date in the active granularity
