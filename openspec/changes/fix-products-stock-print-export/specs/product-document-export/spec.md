## MODIFIED Requirements

### Requirement: Sales Price List / Devis PDF Generation
The system SHALL generate an A4 printable Sales Price List ("Devis / Liste de Vente") document containing company branding, emission date, and tabular product pricing data, flowing continuously across multiple portrait A4 pages when printed.

#### Scenario: User generates Devis PDF
- **WHEN** the user clicks "Devis / Liste de Vente (PDF)"
- **THEN** the application opens an A4 preview modal displaying company header info, document title, and a table with columns: N°, Référence, Désignation Produit, Marque, Colisage (Pièces/Carton), and Prix Unitaire de Vente (DZD), along with a total count and one-click "Imprimer / Enregistrer en PDF" button

#### Scenario: User prints Devis document across multiple pages
- **WHEN** the user initiates printing from the Devis modal for a dataset spanning multiple pages (such as 100+ products)
- **THEN** the browser print output renders in A4 portrait orientation across as many pages as required, does not clip to the modal scroll container, repeats table column headers at the top of every page, and suppresses the modal header, preview toolbar, and scope pills from the printed output

---

### Requirement: Simple Reference List PDF Generation
The system SHALL generate a clean, minimalist A4 printable Reference Catalog ("Catalogue Références") document, flowing continuously across multiple portrait A4 pages when printed.

#### Scenario: User generates simple reference list PDF
- **WHEN** the user clicks "Liste Références (PDF)"
- **THEN** the application opens an A4 preview modal displaying company header info, document title, and a clean minimalist table with columns: N°, Référence, and Désignation Produit (without pricing columns), along with total count and one-click print action

#### Scenario: User prints Reference Catalog document across multiple pages
- **WHEN** the user initiates printing from the Reference Catalog modal for a dataset spanning multiple pages
- **THEN** the browser print output renders in A4 portrait orientation across as many pages as required, repeats table column headers across pages, un-clips the modal preview container, and hides the modal toolbar chrome
