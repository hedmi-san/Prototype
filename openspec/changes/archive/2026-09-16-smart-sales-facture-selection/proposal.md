## Why

When converting a delivery sale (Bon de Livraison) into an official fiscal invoice (Facture), the system currently attempts to populate an unsearchable native `<select>` dropdown. The backend implicitly caps this list at 50 sales, leaving any older sales completely unreachable, while loading thousands of sales without filtering would cause massive database scans, multi-megabyte JSON payloads, Vue reactivity memory bloat (~40MB+), and browser freezing.

Operators need a high-performance, ergonomic way to locate and bill sales at scale (10,000+ sales), both directly from the sales list with a single click and via an instant debounced asynchronous search inside the facture creation modal.

## What Changes

- **Direct Table Action (Zero-Search Flow)**: Add an "Émettre Facture" action button on every eligible (unbilled) sale row in the main sales table ("Toutes les Ventes"), opening the modal with the target sale pre-selected and customer details pre-filled. If already invoiced, display an indicator/badge linking directly to the facture.
- **Async Combobox Search in Creation Modal**: Replace the native HTML `<select>` with a high-performance asynchronous combobox. When opening without a pre-selected sale, it displays a small list of recent unbilled sales (<10 items) and allows instant debounced (300ms) server-side searching by invoice number (`INV-...`), customer name, or client code.
- **Backend Sales List Enrichment**: Update `GET /sales` to include `factureId` and `factureNumber` (via a `LEFT JOIN factures f ON f.sale_id = s.id`) so the sales table immediately knows which sales have factures without extra API calls.
- **Optimized Unbilled Sales Endpoint**: Enhance `GET /factures/sales-without-facture` to cleanly handle search terms and return lightweight paginated candidate records without risk of memory overflow.

## Capabilities

### New Capabilities
- `sales-facture-linking`: Streamlined, scalable workflow for locating, filtering, and converting warehouse delivery sales into official fiscal invoices (factures) with instant search and direct table actions.

### Modified Capabilities
<!-- None -->

## Impact

- **Backend**:
  - `backend/src/routes/sale.routes.ts`: Add facture ID and number to the `SELECT` query in `GET /`.
  - `backend/src/routes/facture.routes.ts`: Verify and optimize `GET /sales-without-facture` filtering and limits.
- **Frontend**:
  - `frontend/src/types/index.ts`: Add `factureId?: number | null` and `factureNumber?: string | null` to `Sale` interface.
  - `frontend/src/views/sales/SalesListView.vue`: Wire action buttons in the sales table and integrate an async search combobox in the facture modal.
  - `frontend/src/services/operations.service.ts`: Ensure search parameters pass cleanly to the endpoint.
- **Breaking Changes**: None. Backwards compatible API response extensions.
