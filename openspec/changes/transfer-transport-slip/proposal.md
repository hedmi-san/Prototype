## Why

When stock transfers occur between warehouses, warehouse operators currently lack an official physical logistics document ("Bon de transport") to hand to warehouse workers for order picking and to transporters/drivers for cargo transit. Additionally, the stock relocation matrix offers redundant and impractical options ("Exécution Immédiate" vs "Demandes de Transfert") that either bypass physical transit checks entirely or require redundant source approval for pre-decided reallocations.

Introducing a printable "Bon de transport" for approved transfers and streamlining the relocation matrix to a direct-dispatch model with destination arrival confirmation resolves these operational gaps.

## What Changes

- **Add Printable "Bon de Transport"**: Provide a printable logistics slip for approved transfers displaying company branding, transfer number, dispatch date, source/destination warehouses, and an items manifest with product reference code, product designation, and approved quantity.
- **Strict Role and Status Visibility**: Restrict the "Bon de Transport" button strictly to the source warehouse (and administrators/global super managers) and strictly when transfer status is `APPROVED`. The button disappears once confirmed (`CONFIRMED`).
- **Simplify Stock Relocation Matrix**: Remove the two radio options ("Exécution Immédiate" and "Demandes de Transfert") from `StockRelocationModal`.
- **Pre-Approved Relocation Dispatch**: Relocation submissions automatically generate transfer orders in `APPROVED` status with source stock reserved immediately. No separate approval step is needed.
- **Arrival Confirmation Only**: Destination warehouses only need to confirm physical receipt of relocated stock via the existing arrival confirmation workflow.
- **Direct Slip Printing from Relocation Matrix**: Provide direct "Imprimer Bon de Transport" buttons on the relocation modal's success screen for immediate slip generation.

## Capabilities

### New Capabilities
- `transfer-transport-slip`: Printable physical transport voucher for inter-warehouse transfers showing reference code, product name, and approved quantity, accessible strictly to the source warehouse during `APPROVED` status.
- `stock-relocation-execution`: Streamlined bulk stock redistribution workflow creating pre-approved dispatched transfers requiring only destination arrival confirmation, eliminating manual radio toggles.

### Modified Capabilities
<!-- None of the existing specs in openspec/specs/ define warehouse transfers or stock relocation -->

## Impact

- **Backend (`backend/src/routes/transfer.routes.ts`)**:
  - Update `POST /transfers/bulk-relocation` to create transfers directly in `APPROVED` status with `approved_quantity = quantity`, reserving source stock (`reserved_quantity += quantity`), and omitting the `immediateExecution` flag.
  - Dispatch `TRANSFER_APPROVED` notifications to destination warehouses on bulk relocation.
- **Frontend (`frontend/src/`)**:
  - New component `TransportSlipDocument.vue`: Clean, high-contrast, printable A4 slip with items manifest and signature blocks for source handler and destination receiver.
  - New component or modal `TransportSlipModal.vue`: Preview and print modal triggering `window.print()`.
  - `TransferListView.vue`: Add "Bon de Transport" action button for source warehouse when status is `APPROVED`; integrate print button in transfer details modal.
  - `StockRelocationModal.vue`: Remove execution radio options, update submission payload, and add direct transport slip print actions on the summary screen.
  - `operations.service.ts`: Update `bulkRelocateStock` payload signature.
