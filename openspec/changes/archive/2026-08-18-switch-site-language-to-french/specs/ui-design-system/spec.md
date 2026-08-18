## ADDED Requirements

### Requirement: French Copy and Typography Adaptation
The UI design system SHALL mandate that all interface text, labels, messages, buttons, and placeholders be presented in French. Component layouts and typographic rules SHALL accommodate French text length expansion without clipping, horizontal overflow, or broken button wrapping.

#### Scenario: Layout adaptation for longer French labels
- **WHEN** action buttons, table column headers, form labels, or sidebar navigation links are rendered with French text
- **THEN** container dimensions, flex alignments, and truncation rules SHALL ensure text is readable, legible, and visually balanced without breaking layout grids or wrapping awkwardly

#### Scenario: French typographic punctuation and capitalization conventions
- **WHEN** labels, titles, numbers, and currency symbols are displayed
- **THEN** typography formatting SHALL respect French punctuation conventions (such as non-breaking spaces before colons and question marks, uppercase accented characters, and localized month/day names)
