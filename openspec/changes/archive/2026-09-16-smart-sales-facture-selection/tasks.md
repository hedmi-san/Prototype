## 1. Backend Enhancements

- [x] 1.1 Enrich `GET /sales` in `backend/src/routes/sale.routes.ts` by adding a `LEFT JOIN factures f ON f.sale_id = s.id` and selecting `f.id as facture_id` and `f.facture_number`.
- [x] 1.2 Verify and optimize `GET /sales-without-facture` in `backend/src/routes/facture.routes.ts` with a responsive default limit (15 items) and ILIKE search across invoice number, customer name, and client name.

## 2. Frontend Types & Services

- [x] 2.1 Update the `Sale` interface in `frontend/src/types/index.ts` to include optional `factureId?: number | null` and `factureNumber?: string | null`.
- [x] 2.2 Ensure `factureService.getSalesWithoutFacture(search?: string)` in `frontend/src/services/operations.service.ts` properly forwards search query parameters.

## 3. Direct Sales Table Action (Option B)

- [x] 3.1 In `frontend/src/views/sales/SalesListView.vue`, add a `[📄 Facturer]` button in the sales table row actions for eligible sales (`!sale.factureId` and completed/active status).
- [x] 3.2 Display an invoiced indicator or `[Facture N° ...]` button for sales that already have an associated fiscal invoice (`sale.factureNumber`).
- [x] 3.3 Verify clicking `[📄 Facturer]` calls `openCreateFactureForSale(sale)` to open the modal pre-filled with the sale and customer information.

## 4. Async Sale Search Combobox in Facture Modal (Option A)

- [x] 4.1 Replace the native `<select>` in the facture creation modal of `SalesListView.vue` with an interactive asynchronous search input and suggestion list.
- [x] 4.2 Load up to 10 recent unbilled sales as quick suggestions when opening the modal without a pre-selected sale.
- [x] 4.3 Add debounced (300ms) search input to query candidate sales by invoice number, customer name, or client code.
- [x] 4.4 Handle candidate selection, populating `selectedSaleForFacture` and pre-filling the customer's fiscal coordinates.

## 5. Verification & Testing

- [x] 5.1 Verify that direct billing from the sales table pre-populates all sale details without extra search.
- [x] 5.2 Verify that typing in the modal combobox filters results in real-time with negligible network payload and zero UI freezing.
- [x] 5.3 Verify that creating a fiscal invoice immediately reflects on the sales list as invoiced.
