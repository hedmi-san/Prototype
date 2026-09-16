/**
 * Convert a number to French words for invoice display.
 * e.g. 24879.33 → "vingt quatre mille huit cent soixante dix neuf DINARS, 33 centimes"
 */

const UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const TEENS = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function convertHundreds(n: number): string {
  if (n === 0) return '';
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];

  if (n < 100) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;

    // French special cases: 70-79 use soixante-dix, 90-99 use quatre-vingt-dix
    if (ten === 7) {
      // 70-79: soixante-dix, soixante et onze, soixante-douze...
      if (unit === 0) return 'soixante-dix';
      if (unit === 1) return 'soixante et onze';
      return `soixante-${TEENS[unit]}`;
    }
    if (ten === 9) {
      // 90-99: quatre-vingt-dix, quatre-vingt-onze...
      if (unit === 0) return 'quatre-vingt-dix';
      return `quatre-vingt-${TEENS[unit]}`;
    }
    if (ten === 8) {
      // 80-89: quatre-vingts, quatre-vingt-un...
      if (unit === 0) return 'quatre-vingts';
      return `quatre-vingt-${UNITS[unit]}`;
    }

    // Standard tens
    if (unit === 0) return TENS[ten];
    if (unit === 1 && ten < 7) return `${TENS[ten]} et un`;
    return `${TENS[ten]}-${UNITS[unit]}`;
  }

  // 100-999
  const hundred = Math.floor(n / 100);
  const remainder = n % 100;

  let result: string;
  if (hundred === 1) {
    result = 'cent';
  } else {
    result = `${UNITS[hundred]} cent`;
  }

  if (remainder === 0) {
    // "cents" with 's' when it's a multiple of 100 (except 100)
    return hundred > 1 ? `${UNITS[hundred]} cents` : 'cent';
  }

  return `${result} ${convertHundreds(remainder)}`;
}

function convertNumber(n: number): string {
  if (n === 0) return 'zéro';
  if (n < 0) return `moins ${convertNumber(-n)}`;

  const parts: string[] = [];

  // Billions
  const billions = Math.floor(n / 1_000_000_000);
  if (billions > 0) {
    if (billions === 1) {
      parts.push('un milliard');
    } else {
      parts.push(`${convertHundreds(billions)} milliards`);
    }
    n %= 1_000_000_000;
  }

  // Millions
  const millions = Math.floor(n / 1_000_000);
  if (millions > 0) {
    if (millions === 1) {
      parts.push('un million');
    } else {
      parts.push(`${convertHundreds(millions)} millions`);
    }
    n %= 1_000_000;
  }

  // Thousands
  const thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('mille');
    } else {
      parts.push(`${convertHundreds(thousands)} mille`);
    }
    n %= 1000;
  }

  // Remainder
  if (n > 0) {
    parts.push(convertHundreds(n));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Convert amount to French words for invoice.
 * @param amount - e.g. 24879.33
 * @returns "vingt quatre mille huit cent soixante dix neuf DINARS , 33 centimes"
 */
export function amountToFrenchWords(amount: number): string {
  const wholePart = Math.floor(Math.abs(amount));
  const centimes = Math.round((Math.abs(amount) - wholePart) * 100);

  let result = convertNumber(wholePart);
  result += ' DINARS';

  if (centimes > 0) {
    result += ` , ${String(centimes).padStart(2, '0')} centimes`;
  }

  return result;
}

export default amountToFrenchWords;
