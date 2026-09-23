import { read, utils } from 'xlsx';
import api from './api';
import type { ApiResponse } from '../types';

export interface WarehouseFileEntry {
  file: File;
  warehouseId: number;
  warehouseName: string;
  rowCount?: number;
  status?: 'pending' | 'parsed' | 'error';
  errorMessage?: string;
}

export interface RawClientRow {
  warehouseId: number;
  warehouseName: string;
  rowNumber: number;
  name: string;
  solde: number | string;
  phone: string;
  address: string;
  wilaya: string;
  typeCli: string;
  activitee: string;
  rc: string;
  art: string;
  numFiscal: string;
  nis: string;
  nif: string;
}

export interface NormalizedImportRecord {
  id: number;
  sourceWarehouseId: number;
  sourceWarehouseName: string;
  sourceRow: number;
  name: string;
  normName: string;
  balance: number;
  phone: string;
  phoneTokens: string[];
  address: string;
  activite: string;
  rc: string;
  normRc: string;
  art: string;
  normArt: string;
  numFiscal: string;
  normFiscal: string;
  nis: string;
  normNis: string;
  nif: string;
  normNif: string;
}

export interface FieldConflict {
  field: 'name' | 'phone' | 'address' | 'activite' | 'rc' | 'art' | 'numFiscal' | 'nis' | 'nif';
  label: string;
  values: { value: string; warehouseName: string }[];
}

export interface ConsolidatedCluster {
  clusterId: string;
  suggestedClient: {
    name: string;
    phone: string;
    address: string;
    activite: string;
    rc: string;
    art: string;
    numFiscal: string;
    nis: string;
    nif: string;
    totalBalance: number;
  };
  records: NormalizedImportRecord[];
  conflicts: FieldConflict[];
}

export interface Tier2Conflict {
  conflictId: string;
  reason: string;
  recordA: NormalizedImportRecord;
  recordB: NormalizedImportRecord;
}

export interface ImportAnalysisResult {
  kpis: {
    totalRows: number;
    autoMergedClustersCount: number;
    autoMergedRecordsCount: number;
    reviewConflictsCount: number;
    standaloneCount: number;
    totalOpeningBalance: number;
  };
  tier1Clusters: ConsolidatedCluster[];
  tier2Conflicts: Tier2Conflict[];
  tier3Standalone: NormalizedImportRecord[];
}

function normalizeHeaderKey(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\.\,\-\_\/\(\)\'\"\:\;\#\*\+]/g, ' ')
    .replace(/\s+/g, ' ');
}

export async function parseClientExcelFile(
  file: File,
  warehouseId: number,
  warehouseName: string
): Promise<RawClientRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error(`Le fichier ${file.name} ne contient aucune feuille.`);
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: false });

  if (rawRows.length === 0) {
    return [];
  }

  // Detect column mapping based on first row
  const firstRow = rawRows[0];
  const detectedCols = Object.keys(firstRow);

  let clientKey = '';
  let soldeKey = '';
  let telKey = '';
  let adresseKey = '';
  let wilayaKey = '';
  let typeCliKey = '';
  let activiteeKey = '';
  let rcKey = '';
  let artKey = '';
  let fiscalKey = '';
  let nisKey = '';
  let nifKey = '';

  for (const col of detectedCols) {
    const norm = normalizeHeaderKey(col);
    if (!clientKey && norm.includes('client') && !norm.includes('code') && !norm.includes('type') && !norm.includes('tyep')) {
      clientKey = col;
    } else if (!soldeKey && (norm.includes('solde') || norm.includes('soldactual') || norm.includes('sold'))) {
      soldeKey = col;
    } else if (!telKey && (norm.includes('tel') || norm.includes('phone') || norm.includes('mobile'))) {
      telKey = col;
    } else if (!adresseKey && norm.includes('adresse')) {
      adresseKey = col;
    } else if (!wilayaKey && norm.includes('wilaya')) {
      wilayaKey = col;
    } else if (!typeCliKey && (norm.includes('tyep cli') || norm.includes('type cli') || norm.includes('type client'))) {
      typeCliKey = col;
    } else if (!activiteeKey && (norm.includes('activitee') || norm.includes('activite'))) {
      activiteeKey = col;
    } else if (!rcKey && (norm.includes('registre') || norm.includes('rc'))) {
      rcKey = col;
    } else if (!artKey && (norm.includes('article') || norm.includes('art'))) {
      artKey = col;
    } else if (!fiscalKey && norm.includes('fiscal')) {
      fiscalKey = col;
    } else if (!nisKey && norm.includes('nis')) {
      nisKey = col;
    } else if (!nifKey && norm.includes('nif')) {
      nifKey = col;
    }
  }

  if (!clientKey) {
    throw new Error(`Colonne client introuvable dans ${file.name}. Veuillez vérifier les en-têtes.`);
  }

  const result: RawClientRow[] = [];
  for (let idx = 0; idx < rawRows.length; idx++) {
    const r = rawRows[idx];
    const nameVal = r[clientKey] ? String(r[clientKey]).trim() : '';
    if (!nameVal) continue;

    result.push({
      warehouseId,
      warehouseName,
      rowNumber: idx + 2,
      name: nameVal,
      solde: soldeKey ? r[soldeKey] : '0',
      phone: telKey && r[telKey] ? String(r[telKey]).trim() : '',
      address: adresseKey && r[adresseKey] ? String(r[adresseKey]).trim() : '',
      wilaya: wilayaKey && r[wilayaKey] ? String(r[wilayaKey]).trim() : '',
      typeCli: typeCliKey && r[typeCliKey] ? String(r[typeCliKey]).trim() : '',
      activitee: activiteeKey && r[activiteeKey] ? String(r[activiteeKey]).trim() : '',
      rc: rcKey && r[rcKey] ? String(r[rcKey]).trim() : '',
      art: artKey && r[artKey] ? String(r[artKey]).trim() : '',
      numFiscal: fiscalKey && r[fiscalKey] ? String(r[fiscalKey]).trim() : '',
      nis: nisKey && r[nisKey] ? String(r[nisKey]).trim() : '',
      nif: nifKey && r[nifKey] ? String(r[nifKey]).trim() : '',
    });
  }

  return result;
}

export async function requestClientImportAnalysis(rows: RawClientRow[]): Promise<ImportAnalysisResult> {
  const response = await api.post<ApiResponse<ImportAnalysisResult>>('/clients/import/analyze', { rows });
  return response.data.data;
}

export async function executeClientImportCommit(payload: {
  clients: Array<{
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    rc?: string;
    nif?: string;
    art?: string;
    activite?: string;
    nis?: string;
    numFiscal?: string;
    openingBalance: number;
    warehouseBalances?: Array<{
      warehouseId: number;
      warehouseName: string;
      balance: number;
    }>;
  }>;
}): Promise<{ importedCount: number; totalOpeningDebt: number }> {
  const response = await api.post<ApiResponse<{ importedCount: number; totalOpeningDebt: number }>>('/clients/import/commit', payload);
  return response.data.data;
}
