## Context

In our wholesale distribution system, sales orders (Bons de Livraison) are converted into official fiscal invoices (Factures). Currently, opening the facture creation modal triggers a blind query to `GET /sales-without-facture` which is hardcapped at 50 results in the backend and displayed in a native HTML `<select>`. For warehouses handling thousands of transactions, sales older than the last 50 are invisible, while removing the limit would transmit megabytes of JSON and crash browser memory.

## Goals / Non-Goals

**Goals:**
- Provide a single-click action from the sales table (`SalesListView.vue`) to bill any completed, unbilled sale, opening the facture modal with the sale pre-selected.
- Provide a responsive asynchronous combobox in the facture creation modal that displays the 10 most recent unbilled sales on open and performs debounced (300ms) server-side searches matching invoice numbers, customer names, or client codes.
- Enrich `GET /sales` responses with `factureId` and `factureNumber` so the sales list immediately reflects billing status.
- Ensure negligible memory overhead and sub-100ms response times regardless of database scale (10,000+ sales).

**Non-Goals:**
- Changing invoice calculation logic, tax rates (TVA), or the 30% invoice price formula.
- Modifying stock reservation, delivery, or pickup workflows.

## Decisions

### 1. Direct Action in Sales Table vs. Modal-Only Selection
- **Decision**: Add a direct `[📄 Facturer]` button to each unbilled sale row in the main Sales table (`activeMainTab === 'sales'`), and a `[Facture N° ...]` link if already billed.
- **Rationale**: Operators spend 90% of their time examining sales in the main list where date filters, client filters, and search are already active. Wiring the existing `openCreateFactureForSale(sale)` function removes the need for searching altogether in the primary workflow.
- **Alternatives considered**: Relying solely on the modal's search combobox. Rejected because it forces operators to re-search a sale they were already looking at.

### 2. Async Search Combobox in Modal
- **Decision**: Replace the `<select>` in the facture creation modal with an interactive combobox input with floating suggestion cards.
- **Rationale**: For users creating a facture from the "Gestion des Factures" tab, an async combobox queries `GET /factures/sales-without-facture?search=...&limit=15` with a 300ms debounce. Initial state loads only 10 recent suggestions.
- **Alternatives considered**: Paginated modal dialog. Rejected as overly complex for picking a single sale reference.

### 3. Backend Sales List Query Enrichment
- **Decision**: Add `LEFT JOIN factures f ON f.sale_id = s.id` to the main `GET /sales` query in `sale.routes.ts`, returning `f.id as facture_id` and `f.facture_number`.
- **Rationale**: Allows the frontend sales table to determine invoice status in a single query with zero N+1 overhead.
- **Alternatives considered**: Frontend checking a separate set of facture IDs. Rejected due to latency and data synchronization issues.

## Risks / Trade-offs

- **[Risk] Multiple operators billing the same sale concurrently**:
  - *Mitigation*: The backend transaction in `facture.routes.ts` already checks `SELECT id FROM factures WHERE sale_id = $1` and rejects duplicates with a 400 status code.
- **[Risk] Combobox input focus & outside click handling**:
  - *Mitigation*: Reuse the proven floating dropdown pattern used in `AppClientCombobox.vue` with click-outside listeners and keyboard navigation.
- **[Trade-off] Additional join on sales table**:
  - *Mitigation*: `factures.sale_id` is indexed or unique; joining on foreign key adds negligible overhead (< 2ms).
