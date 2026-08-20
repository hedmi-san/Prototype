import { Response } from 'express';

export interface CsvColumn<T = any> {
  header: string;
  key?: keyof T;
  format?: (row: T) => any;
}

/**
 * Formats and escapes a single value according to RFC 4180 rules.
 */
export function formatCsvValue(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }

  if (typeof val === 'boolean') {
    return val ? 'Oui' : 'Non';
  }

  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }

  const str = String(val);
  // If string contains comma, quote, semicolon, or newline, escape and quote it
  if (str.includes(',') || str.includes('"') || str.includes(';') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Serializes an array of records into CSV format with UTF-8 BOM for Excel compatibility.
 */
export function generateCsv<T = any>(columns: CsvColumn<T>[], data: T[]): string {
  const BOM = '\uFEFF';
  const headerRow = columns.map((c) => formatCsvValue(c.header)).join(',');
  const dataRows = data.map((row) =>
    columns
      .map((col) => {
        const val = col.format ? col.format(row) : col.key !== undefined ? row[col.key] : '';
        return formatCsvValue(val);
      })
      .join(',')
  );

  return BOM + [headerRow, ...dataRows].join('\r\n');
}

/**
 * Sends a CSV string as a downloadable HTTP attachment response.
 */
export function sendCsv(res: Response, filename: string, csvContent: string): Response {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csvContent);
}
