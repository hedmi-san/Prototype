import { query, runTransaction } from '../db/database.js';

export async function runCreditNoteBackfill(): Promise<{ backfilledCount: number }> {
  console.log('--- Starting Credit Note Backfill for Cancelled Walk-in Sales ---');

  const cancelledSalesRes = await query(`
    SELECT s.id, s.invoice_number, s.client_id, s.warehouse_id, s.total_amount, s.employee_id, s.updated_at
    FROM sales s
    JOIN clients c ON s.client_id = c.id
    WHERE c.is_default = TRUE
      AND s.status = 'CANCELLED'
      AND NOT EXISTS (
        SELECT 1 FROM counter_credit_notes ccn WHERE ccn.sale_id = s.id
      )
    ORDER BY s.id ASC
  `);

  const salesToBackfill = cancelledSalesRes.rows;
  console.log(`Found ${salesToBackfill.length} unlinked cancelled walk-in sales to backfill.`);

  let backfilledCount = 0;

  for (const sale of salesToBackfill) {
    const creditNoteNumber = `AVR-LEGACY-${String(sale.id).padStart(4, '0')}`;
    const totalAmount = Number(sale.total_amount);

    await query(`
      INSERT INTO counter_credit_notes (
        credit_note_number, sale_id, client_id, warehouse_id,
        total_amount, refunded_amount, remaining_amount,
        status, issue_date, expiry_date, notes, created_by, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 0.0, $5, 'PENDING', $6, $6::timestamptz + INTERVAL '90 days', $7, $8, $6, $6)
      ON CONFLICT (credit_note_number) DO NOTHING
    `, [
      creditNoteNumber,
      sale.id,
      sale.client_id,
      sale.warehouse_id,
      totalAmount,
      sale.updated_at,
      `Rétro-création automatique suite annulation vente ${sale.invoice_number}`,
      sale.employee_id || 1,
    ]);

    backfilledCount++;
    console.log(`Backfilled credit note ${creditNoteNumber} for sale ${sale.invoice_number} (${totalAmount.toFixed(2)} DA)`);
  }

  console.log(`Successfully backfilled ${backfilledCount} credit notes.`);
  return { backfilledCount };
}

if (process.argv[1]?.endsWith('backfill-credit-notes.ts') || process.argv[1]?.endsWith('backfill-credit-notes.js')) {
  runCreditNoteBackfill()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error during credit note backfill:', err);
      process.exit(1);
    });
}
