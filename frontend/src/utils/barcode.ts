/**
 * Code 128 (Set B & Set C) Pure TypeScript Vector SVG Barcode Generator
 * Generates lightweight, high-resolution vector SVG barcodes for invoice documents and printouts.
 */

// Code 128 pattern widths (each pattern is 6 numbers: bar, space, bar, space, bar, space)
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (104=Start B, 105=Start C, 106=Stop)
];

const START_B = 104;
const START_C = 105;
const STOP = 106;

/**
 * Encode an alphanumeric or numeric string into Code 128 pattern values
 */
export function encodeCode128(text: string): number[] {
  if (!text) return [];

  // Check if string is purely numeric and even-length for Code C efficiency
  const isPureDigits = /^\d+$/.test(text);

  if (isPureDigits && text.length % 2 === 0 && text.length >= 4) {
    // Use Code C (two digits per symbol)
    const codes: number[] = [START_C];
    let checksum = START_C;

    for (let i = 0; i < text.length; i += 2) {
      const val = parseInt(text.slice(i, i + 2), 10);
      codes.push(val);
      const pos = (i / 2) + 1;
      checksum += val * pos;
    }

    const checkDigit = checksum % 103;
    codes.push(checkDigit);
    codes.push(STOP);
    return codes;
  }

  // Standard Code B (ASCII 32-126)
  const codes: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // ASCII 32 (' ') -> Code 0, ..., ASCII 126 ('~') -> Code 94
    const val = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    codes.push(val);
    checksum += val * (i + 1);
  }

  const checkDigit = checksum % 103;
  codes.push(checkDigit);
  codes.push(STOP);
  return codes;
}

export interface BarcodeOptions {
  height?: number;
  moduleWidth?: number;
  quietZone?: number;
  barColor?: string;
  bgColor?: string;
}

/**
 * Generate an SVG string for a Code 128 barcode
 */
export function generateBarcodeSvg(text: string, options: BarcodeOptions = {}): string {
  const height = options.height || 40;
  const moduleWidth = options.moduleWidth || 1.4;
  const quietZone = options.quietZone || 10;
  const barColor = options.barColor || '#000000';
  const bgColor = options.bgColor || 'transparent';

  const patternIndices = encodeCode128(text);
  if (patternIndices.length === 0) return '';

  let totalModules = quietZone * 2;
  const patternStrings: string[] = [];

  for (const idx of patternIndices) {
    const pattern = CODE128_PATTERNS[idx] || CODE128_PATTERNS[0];
    patternStrings.push(pattern);
    for (let i = 0; i < pattern.length; i++) {
      totalModules += parseInt(pattern[i], 10);
    }
  }

  const svgWidth = totalModules * moduleWidth;
  let currentX = quietZone * moduleWidth;
  const rects: string[] = [];

  for (const pattern of patternStrings) {
    for (let i = 0; i < pattern.length; i++) {
      const width = parseInt(pattern[i], 10) * moduleWidth;
      const isBar = (i % 2 === 0);
      if (isBar) {
        rects.push(`<rect x="${currentX.toFixed(2)}" y="0" width="${width.toFixed(2)}" height="${height}" fill="${barColor}" />`);
      }
      currentX += width;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth.toFixed(2)} ${height}" width="${svgWidth.toFixed(2)}" height="${height}" preserveAspectRatio="none" style="background:${bgColor};display:block;">${rects.join('')}</svg>`;
}

/**
 * Format a standard Algerian commercial receipt barcode value
 * Format: DDMMYYYY + 6-digit numeric identifier (e.g. 22082026002761)
 */
export function formatTradeBarcode(saleDateInput?: string | Date | null, invoiceNumberInput?: string | null, saleId?: number | null): string {
  // Extract date in DDMMYYYY format
  const dateObj = saleDateInput ? (typeof saleDateInput === 'string' ? new Date(saleDateInput.includes(' ') && !saleDateInput.includes('T') ? saleDateInput.replace(' ', 'T') : saleDateInput) : saleDateInput) : new Date();
  const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;

  const day = String(validDate.getDate()).padStart(2, '0');
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const year = String(validDate.getFullYear());
  const datePrefix = `${day}${month}${year}`;

  // Extract clean sequential digits from invoice number or saleId
  let numericSuffix = '';
  if (invoiceNumberInput) {
    const digitsOnly = invoiceNumberInput.replace(/\D/g, '');
    if (digitsOnly.length > 0) {
      numericSuffix = digitsOnly.slice(-6).padStart(6, '0');
    }
  }

  if (!numericSuffix && saleId) {
    numericSuffix = String(saleId).padStart(6, '0');
  }

  if (!numericSuffix) {
    numericSuffix = '000001';
  }

  return `${datePrefix}${numericSuffix}`;
}
