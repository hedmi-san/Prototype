## 1. Backend: Refactor Bulk Relocation Workflow

- [x] 1.1 Update `POST /transfers/bulk-relocation` in `backend/src/routes/transfer.routes.ts` to always create transfers with status `APPROVED` and `approved_at = NOW()`.
- [x] 1.2 In `POST /transfers/bulk-relocation`, record `approved_quantity` equal to the allocated quantity for all transfer items and reserve stock at source (`reserved_quantity += quantity`).
- [x] 1.3 Update notification dispatch in `POST /transfers/bulk-relocation` to send `TRANSFER_APPROVED` to each destination warehouse.
- [x] 1.4 Include full transfer and item details in the `bulk-relocation` response to facilitate immediate document printing.

## 2. Frontend: Printable Transport Slip Components

- [x] 2.1 Create `TransportSlipDocument.vue` in `frontend/src/components/transfers/` with company branding, transfer metadata, item table (reference code, product name, approved quantity), and dual signature blocks.
- [x] 2.2 Add print styling (`@media print` and `@page`) to `TransportSlipDocument.vue` with an interactive "Imprimer" button (`window.print()`) hidden during printing.
- [x] 2.3 Create `TransportSlipModal.vue` in `frontend/src/components/transfers/` wrapping `TransportSlipDocument` inside `AppModal`.

## 3. Frontend: TransferListView Integration and Scoping

- [x] 3.1 Implement `canPrintTransportSlip(t: Transfer)` helper in `TransferListView.vue` strictly permitting source warehouse operators and administrators when status is `APPROVED`.
- [x] 3.2 Add the "Bon de Transport" button in the table actions column for matching transfers, ensuring it is hidden once status is `CONFIRMED` or `REQUESTED`.
- [x] 3.3 Add the "Bon de Transport" button in the Transfer Details modal for source warehouse operators on approved transfers.

## 4. Frontend: Stock Relocation Modal Simplification & Direct Printing

- [x] 4.1 Remove the two radio options ("Exécution Immédiate" and "Demandes de Transfert") from `StockRelocationModal.vue` and replace with a direct dispatch notice.
- [x] 4.2 Update `handleSubmit` and `operations.service.ts` to remove the `immediateExecution` parameter from the bulk relocation payload.
- [x] 4.3 Add an "Imprimer Bon de Transport" button to each generated transfer card in the `StockRelocationModal.vue` success summary screen.

## 5. Verification and End-to-End Validation

- [x] 5.1 Verify TypeScript compilation and lint checks across frontend and backend.
- [x] 5.2 Validate standard transfer workflow: verify "Bon de Transport" is visible to source warehouse upon approval, displays correct approved quantities, and disappears upon confirmation.
- [x] 5.3 Validate stock relocation workflow: execute relocation matrix, verify transfers are generated in `APPROVED` status with stock reserved, verify direct print from summary screen, and confirm arrival from destination warehouse.
