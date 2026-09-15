## Context

The system supports inter-warehouse transfers with an explicit reservation lifecycle (`REQUESTED` → `APPROVED` → `CONFIRMED` / `CANCELLED`). However, when transfers are approved, operators do not have an official physical transport document ("Bon de transport") to hand to warehouse packing workers and shipping transporters.

Simultaneously, the bulk stock relocation matrix (`StockRelocationModal`) currently presents two modes: "Exécution Immédiate" (which marks transfers confirmed immediately without physical transit verification) and "Demandes de Transfert" (which creates unapproved requests requiring redundant approval from the source). The desired workflow is a single direct-dispatch model where relocation creates pre-approved orders ready for transport, leaving only confirmation of arrival to the destination warehouse.

## Goals / Non-Goals

**Goals:**
- Provide a dedicated printable component `TransportSlipDocument.vue` formatted for clean A4 printing using standard `@media print` styling.
- Render the exact fields required: Company header, document title, transfer number, dispatch date, source & destination warehouse details, and an items table with product reference code, designation, and approved quantity (`approvedQuantity`).
- Restrict visibility of the "Bon de Transport" button strictly to the source warehouse (and administrators/global super managers) and strictly when status is `APPROVED`.
- Hide the button once the transfer is confirmed (`CONFIRMED`) with no reprint capability after arrival confirmation.
- Simplify `StockRelocationModal` by removing the radio toggle for immediate vs request mode.
- Update `POST /transfers/bulk-relocation` in the backend to create transfers directly in `APPROVED` status with source stock reserved (`reserved_quantity`), removing `immediateExecution`.
- Add direct "Imprimer Bon de Transport" buttons on each transfer card within the relocation modal's success screen.

**Non-Goals:**
- No driver or vehicle input fields (explicitly excluded by user requirement).
- No new intermediate database status enum (e.g., `IN_TRANSIT` is not needed; `APPROVED` accurately represents stock reserved at source awaiting destination receipt).
- No modifications to the standard transfer request creation flow (`POST /transfers` still generates `REQUESTED` transfers when requested by destination).
- No external PDF generation libraries; leverage browser `window.print()` consistent with existing print slip patterns.

## Decisions

### 1. Leverage Existing `APPROVED` Status for Relocation Orders
- **Decision:** Bulk relocation transfers are generated directly with `status = 'APPROVED'` and `approved_quantity = quantity`, incrementing `reserved_quantity` at the source warehouse.
- **Rationale:** The existing transfer confirmation endpoint (`POST /transfers/:id/confirm`) already handles transfers in `APPROVED` status by deducting `physical_quantity` and `reserved_quantity` from source, adding `physical_quantity` to destination, and logging `TRANSFER_OUT` / `TRANSFER_IN`. Utilizing this existing contract ensures 100% architectural and transactional consistency without database migrations.
- **Alternatives considered:**
  - Creating a separate `IN_TRANSIT` status: Rejected because it requires database enum migrations and changes to multiple queries and warehouse deactivation rules with no functional benefit over `APPROVED`.

### 2. Dedicated Printable Slip Component (`TransportSlipDocument.vue`)
- **Decision:** Build a dedicated Vue component patterned after `PickupSlipDocument.vue`, containing:
  - Header with `EURL BOUSFOR GEN TRADING IMP.EXP` and document title "BON DE TRANSPORT INTER-ENTREPÔTS"
  - Logistics routing cards (Source Warehouse → Destination Warehouse)
  - Manifest table: Réf. Produit, Désignation, Quantité Expédiée (using `approvedQuantity`)
  - Two signature boxes: "Visa & Signature Expéditeur" and "Visa & Signature Réceptionnaire"
  - Screen action bar with an "Imprimer le bon de transport" button that invokes `window.print()`, hidden in `@media print`.
- **Alternatives considered:**
  - Embedding print markup inside `TransferListView.vue`: Rejected as it degrades maintainability and prevents reuse inside the relocation success screen.

### 3. Strict Source Warehouse Permission & Status Scoping
- **Decision:** A helper method `canPrintTransportSlip(transfer)` enforces:
  1. `transfer.status === 'APPROVED'` strictly.
  2. The user is an `ADMIN`, global `SUPER_MANAGER`, or their active warehouse ID strictly equals `transfer.sourceWarehouseId`.
  If the transfer status moves to `CONFIRMED`, `DECLINED`, or `CANCELLED`, the button is not rendered.
- **Rationale:** Prevents destination warehouses from printing shipping vouchers they do not issue, and satisfies the requirement that vouchers cannot be reprinted after confirmation of arrival.

### 4. Direct Printing from Relocation Modal
- **Decision:** When the relocation matrix executes successfully, the backend returns full transfer details including `items`. The relocation modal's success screen renders an "Imprimer Bon de Transport" button on each generated transfer card, opening the printable slip modal directly.
- **Rationale:** Enables the operator liquidating or relocating warehouse stock to immediately print all transport slips in one place.

## Risks / Trade-offs

- **[Risk] Destination warehouse confirms receipt before the truck physically arrives**
  → *Mitigation:* The confirmation dialog prompts the user to verify physical arrival of all units before confirming.
- **[Risk] Source stock remains reserved if shipment is cancelled**
  → *Mitigation:* Operators with appropriate privileges retain the ability to cancel an `APPROVED` transfer, which immediately releases reserved stock back to available stock at the source.
