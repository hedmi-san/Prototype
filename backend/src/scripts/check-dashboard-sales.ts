import { query } from '../db/database.js';

async function main(): Promise<void> {
  const q1 = await query(`
    SELECT status, COUNT(*) as count, SUM(total_amount) as total
    FROM sales
    WHERE created_at::date >= '2026-09-01' AND created_at::date <= '2026-09-30'
    GROUP BY status
  `);
  console.log('--- Sales by status (created_at in Sept 2026) ---');
  console.log(q1.rows);

  const q2 = await query(`
    SELECT status, COUNT(*) as count, SUM(total_amount) as total
    FROM sales
    WHERE COALESCE(sale_date, created_at)::date >= '2026-09-01' AND COALESCE(sale_date, created_at)::date <= '2026-09-30'
    GROUP BY status
  `);
  console.log('--- Sales by status (COALESCE(sale_date, created_at) in Sept 2026) ---');
  console.log(q2.rows);

  const q3 = await query(`
    SELECT id, invoice_number, warehouse_id, total_amount, paid_amount, status, created_at::date as created_d, sale_date::date as sale_d
    FROM sales
    WHERE status = 'COMPLETED' AND created_at::date >= '2026-09-01' AND created_at::date <= '2026-09-30'
    ORDER BY id DESC
  `);
  console.log(`\nCOMPLETED sales (created_at): count = ${q3.rows.length}, sum = ${q3.rows.reduce((s: number, r: any) => s + Number(r.total_amount), 0)}`);

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
