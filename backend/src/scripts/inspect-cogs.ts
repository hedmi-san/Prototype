import { query } from '../db/database.js';

async function main(): Promise<void> {
  const res = await query(`
    SELECT s.id, s.invoice_number, s.total_amount,
           COUNT(si.id) as items_count,
           SUM(si.quantity * p.purchase_price) as sale_cogs
    FROM sales s
    LEFT JOIN sale_items si ON s.id = si.sale_id
    LEFT JOIN products p ON si.product_id = p.id
    WHERE s.status = 'COMPLETED' AND s.created_at::date >= '2026-09-01' AND s.created_at::date <= '2026-09-30'
    GROUP BY s.id, s.invoice_number, s.total_amount
    ORDER BY s.id DESC
  `);

  console.log('--- Sales Analysis (Revenue vs COGS) ---');
  let totalRev = 0;
  let totalCogs = 0;
  let multiItemSales = 0;
  let inflatedRevSum = 0;

  for (const r of res.rows) {
    const rev = Number(r.total_amount);
    const cogs = Number(r.sale_cogs || 0);
    const count = Number(r.items_count);
    totalRev += rev;
    totalCogs += cogs;
    inflatedRevSum += rev * count;
    if (count > 1) {
      multiItemSales++;
      console.log(`Multi-item sale #${r.id} (${r.invoice_number}): Rev = ${rev}, Items = ${count}, Duplicated Rev in Join = ${rev * count}`);
    }

    if (cogs > rev) {
      console.log(`Negative margin sale #${r.id} (${r.invoice_number}): Rev = ${rev}, COGS = ${cogs}, Items = ${count}`);
      const itemsRes = await query(`
        SELECT si.product_id, p.name as prod_name, si.quantity, si.unit_price, si.subtotal,
               p.purchase_price, (si.quantity * p.purchase_price) as item_cogs
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = $1
      `, [r.id]);
      console.log('   Items:', itemsRes.rows);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total Sales Count: ${res.rows.length}`);
  console.log(`Multi-item Sales Count: ${multiItemSales}`);
  console.log(`True Sales Revenue (Dashboard): ${totalRev.toFixed(2)}`);
  console.log(`Inflated Joined Revenue (Financial Report): ${inflatedRevSum.toFixed(2)}`);
  console.log(`Total COGS: ${totalCogs.toFixed(2)}`);
  console.log(`True Net Margin (before salaries): ${(totalRev - totalCogs).toFixed(2)}`);
  console.log(`Inflated Net Margin (before salaries): ${(inflatedRevSum - totalCogs).toFixed(2)}`);

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
