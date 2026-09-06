import { read, utils } from 'xlsx';

export interface ExcelProductItem {
  code: string;
  name: string;
  brand: string;
  stock: number;
  purchasePrice: number;
  salePrice: number;
  tva: number;
  boxSize: number;
  minStockAlert: number;
  rawRowIndex: number;
}

export interface ImportParseAnomaly {
  row: number;
  code: string;
  field: string;
  originalValue: string;
  adjustedValue: string | number;
  message: string;
}

export interface ExcelParseResult {
  fileName: string;
  totalRows: number;
  validItems: ExcelProductItem[];
  previewRows: ExcelProductItem[];
  anomalies: ImportParseAnomaly[];
  detectedColumns: string[];
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // strip accents
}

export async function parseStockExcel(file: File): Promise<ExcelParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Le fichier Excel ne contient aucune feuille.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Parse raw sheet data as array of objects
  const rawRows = utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error('La feuille Excel est vide.');
  }

  // Detect column mapping based on first row keys
  const firstRow = rawRows[0];
  const detectedColumns = Object.keys(firstRow);

  let codeKey = '';
  let nameKey = '';
  let stockKey = '';
  let purchasePriceKey = '';
  let salePriceKey = '';
  let tvaKey = '';
  let boxSizeKey = '';
  let minStockAlertKey = '';

  for (const col of detectedColumns) {
    const norm = normalizeHeader(col);
    if (!codeKey && norm === 'code') {
      codeKey = col;
    } else if (!nameKey && (norm.includes('designation') || norm === 'nom' || norm === 'libelle')) {
      nameKey = col;
    } else if (!stockKey && (norm === 'stock' || norm.startsWith('qte') && !norm.includes('cart'))) {
      stockKey = col;
    } else if (!purchasePriceKey && (norm.includes('pu achat') || norm.includes('prix achat') || norm.includes('achat'))) {
      purchasePriceKey = col;
    } else if (!salePriceKey && (norm.includes('prix vente gros') || norm.includes('vente gros') || norm.includes('prix vente'))) {
      salePriceKey = col;
    } else if (!tvaKey && norm === 'tva') {
      tvaKey = col;
    } else if (!boxSizeKey && (norm.includes('cart') || norm.includes('colisage'))) {
      boxSizeKey = col;
    } else if (!minStockAlertKey && (norm.includes('alerte') || norm.includes('seuil') || norm.includes('min'))) {
      minStockAlertKey = col;
    }
  }

  if (!codeKey) {
    throw new Error("Colonne 'Code' introuvable dans le fichier Excel. Veuillez vérifier les en-têtes.");
  }

  const anomalies: ImportParseAnomaly[] = [];
  const validItems: ExcelProductItem[] = [];

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rowNum = idx + 2; // +2 to account for 1-based index and header row

    const rawCode = String(row[codeKey] || '').trim();
    if (!rawCode) {
      anomalies.push({
        row: rowNum,
        code: 'N/A',
        field: 'Code',
        originalValue: '',
        adjustedValue: 'Ignoré',
        message: 'Ligne ignorée : Code manquant ou vide.',
      });
      continue;
    }

    const code = rawCode.toUpperCase();
    const name = nameKey && row[nameKey] ? String(row[nameKey]).trim() : `Produit ${code}`;

    // Sanitization: Stock
    let stock = 0;
    const rawStock = stockKey ? row[stockKey] : 0;
    if (rawStock !== undefined && rawStock !== null && rawStock !== '') {
      const stockStr = String(rawStock).trim().replace(',', '.');
      const parsedStock = parseFloat(stockStr);
      if (isNaN(parsedStock)) {
        anomalies.push({
          row: rowNum,
          code,
          field: 'Stock',
          originalValue: String(rawStock),
          adjustedValue: 0,
          message: `Stock non numérique ('${rawStock}') ajusté à 0.`,
        });
        stock = 0;
      } else if (parsedStock < 0) {
        anomalies.push({
          row: rowNum,
          code,
          field: 'Stock',
          originalValue: String(rawStock),
          adjustedValue: 0,
          message: `Stock négatif (${parsedStock}) ajusté à 0.`,
        });
        stock = 0;
      } else {
        stock = Math.floor(parsedStock);
      }
    }

    // Sanitization: Purchase Price
    let purchasePrice = 0.0;
    const rawPurchase = purchasePriceKey ? row[purchasePriceKey] : 0;
    if (rawPurchase !== undefined && rawPurchase !== null && rawPurchase !== '') {
      const purchaseStr = String(rawPurchase).trim().replace(',', '.');
      const parsed = parseFloat(purchaseStr);
      if (isNaN(parsed) || parsed < 0) {
        anomalies.push({
          row: rowNum,
          code,
          field: 'Pu Achat',
          originalValue: String(rawPurchase),
          adjustedValue: 0,
          message: `Prix d'achat invalide ('${rawPurchase}') ajusté à 0.00 DZD.`,
        });
        purchasePrice = 0.0;
      } else {
        purchasePrice = Number(parsed.toFixed(2));
      }
    }

    // Sanitization: Sale Price
    let salePrice = 0.0;
    const rawSale = salePriceKey ? row[salePriceKey] : 0;
    if (rawSale !== undefined && rawSale !== null && rawSale !== '') {
      const saleStr = String(rawSale).trim().replace(',', '.');
      const parsed = parseFloat(saleStr);
      if (isNaN(parsed) || parsed < 0) {
        anomalies.push({
          row: rowNum,
          code,
          field: 'Prix Vente Gros',
          originalValue: String(rawSale),
          adjustedValue: 0,
          message: `Prix de vente invalide ('${rawSale}') ajusté à 0.00 DZD.`,
        });
        salePrice = 0.0;
      } else {
        salePrice = Number(parsed.toFixed(2));
      }
    }

    // Sanitization: TVA
    let tva = 19.0;
    const rawTva = tvaKey ? row[tvaKey] : 19;
    if (rawTva !== undefined && rawTva !== null && rawTva !== '') {
      const tvaStr = String(rawTva).trim().replace(',', '.').replace('%', '');
      const parsed = parseFloat(tvaStr);
      if (!isNaN(parsed) && parsed >= 0) {
        tva = Number(parsed.toFixed(2));
      }
    }

    // Sanitization: Box Size (Colisage)
    let boxSize = 0;
    const rawBox = boxSizeKey ? row[boxSizeKey] : 0;
    if (rawBox !== undefined && rawBox !== null && rawBox !== '') {
      const parsed = parseInt(String(rawBox).trim(), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        boxSize = parsed;
      }
    }

    // Sanitization: Min Stock Alert
    let minStockAlert = 1;
    const rawAlert = minStockAlertKey ? row[minStockAlertKey] : 1;
    if (rawAlert !== undefined && rawAlert !== null && rawAlert !== '') {
      const parsed = parseInt(String(rawAlert).trim(), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        minStockAlert = parsed;
      }
    }

    validItems.push({
      code,
      name,
      brand: 'WEHAND',
      stock,
      purchasePrice,
      salePrice,
      tva,
      boxSize,
      minStockAlert,
      rawRowIndex: rowNum,
    });
  }

  return {
    fileName: file.name,
    totalRows: rawRows.length,
    validItems,
    previewRows: validItems.slice(0, 5),
    anomalies,
    detectedColumns,
  };
}

export interface ImportExecutionResult {
  totalProcessed: number;
  totalCreated: number;
  totalExisting: number;
  totalStockUpdated: number;
  warehouseName: string;
}

export async function executeChunkedImport(
  warehouseId: number,
  items: ExcelProductItem[],
  chunkSize: number = 1000,
  onProgress?: (progress: { currentBatch: number; totalBatches: number; percentage: number; processedCount: number }) => void
): Promise<ImportExecutionResult> {
  const { productService } = await import('./catalog.service');
  const totalItems = items.length;
  const totalBatches = Math.ceil(totalItems / chunkSize) || 1;

  let totalCreated = 0;
  let totalExisting = 0;
  let totalStockUpdated = 0;
  let warehouseName = '';

  for (let b = 0; b < totalBatches; b++) {
    const start = b * chunkSize;
    const end = Math.min(start + chunkSize, totalItems);
    const chunk = items.slice(start, end);

    const res = await productService.importBatch(warehouseId, chunk);
    totalCreated += res.created;
    totalExisting += res.existing;
    totalStockUpdated += res.stockUpdated;
    warehouseName = res.warehouseName || warehouseName;

    if (onProgress) {
      const processedCount = end;
      const percentage = Math.round((processedCount / totalItems) * 100);
      onProgress({
        currentBatch: b + 1,
        totalBatches,
        percentage,
        processedCount,
      });
    }
  }

  return {
    totalProcessed: totalItems,
    totalCreated,
    totalExisting,
    totalStockUpdated,
    warehouseName,
  };
}
