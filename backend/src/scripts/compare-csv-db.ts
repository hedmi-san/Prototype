import fs from 'fs';
import { query } from '../db/database.js';

interface CsvSale {
  invoice: string;
  date: string;
  depot: string;
  total: number;
  status: string;
}

async function main(): Promise<void> {
  const content = fs.readFileSync('../ventes_2026-09-21.csv', 'utf8');
  const lines = content.split(/\r?\n/).filter((l: string) => l.trim().length > 0);

  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let curr = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(curr);
        curr = '';
      } else {
        curr += c;
      }
    }
    result.push(curr);
    return result;
  }

  const csvRows = lines.slice(1).map(parseCsvLine);
  const csvByInvoice: Record<string, CsvSale> = {};

  csvRows.forEach((r: string[]) => {
    csvByInvoice[r[0]] = {
      invoice: r[0],
      date: r[1],
      depot: r[2],
      total: parseFloat(r[8]),
      status: r[11],
    };
  });

  const dbRes = await query(`
    SELECT id, invoice_number, total_amount, paid_amount, status, created_at
    FROM sales
    WHERE status = 'COMPLETED' AND created_at::date >= '2026-09-01' AND created_at::date <= '2026-09-30'
  `);

  console.log(`DB has ${dbRes.rows.length} completed sales. CSV has ${csvRows.length} total rows.`);

  const missingFromCsv: any[] = [];
  const statusMismatch: any[] = [];

  for (const dbSale of dbRes.rows) {
    const csvSale = csvByInvoice[dbSale.invoice_number as string];
    if (!csvSale) {
      missingFromCsv.push(dbSale);
    } else if (csvSale.status !== 'Complétée' && csvSale.status !== 'COMPLETED') {
      statusMismatch.push({ db: dbSale, csv: csvSale });
    }
  }

  console.log('\n--- Completed Sales in DB but Missing from CSV entirely ---');
  console.log(missingFromCsv);

  console.log('\n--- Completed Sales in DB but with DIFFERENT status in CSV ---');
  console.log(statusMismatch);

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
