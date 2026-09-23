export interface RawImportRow {
  warehouseId: number;
  warehouseName: string;
  rowNumber?: number;
  name: string;
  solde?: number | string;
  phone?: string;
  address?: string;
  wilaya?: string;
  typeCli?: string;
  activitee?: string;
  rc?: string;
  art?: string;
  numFiscal?: string;
  nis?: string;
  nif?: string;
}

export interface NormalizedImportRecord {
  id: number; // sequential index in import pool
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

// 1. String & Entity Normalization Utilities

export function normalizeClientName(name: string): string {
  if (!name) return '';
  // Unicode NFD normalize accents
  let s = name
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Replace punctuation with spaces
  s = s.replace(/[\.\,\-\_\/\(\)\'\"\:\;\#\*\+]/g, ' ');

  // Strip common Algerian commercial legal form tokens
  const legalTokens = [
    /\bSARL\b/g,
    /\bEURL\b/g,
    /\bSNC\b/g,
    /\bSPA\b/g,
    /\bSTE\b/g,
    /\bSOCIETE\b/g,
    /\bETS\b/g,
    /\bETABLISSEMENT\b/g,
    /\bETB\b/g,
    /\bGROUPE\b/g,
    /\bENTREPRISE\b/g,
    /\bAMB\b/g,
  ];
  for (const token of legalTokens) {
    s = s.replace(token, ' ');
  }

  // Collapse spaces
  return s.replace(/\s+/g, ' ').trim();
}

export function extractPhoneTokens(phoneStr?: string): string[] {
  if (!phoneStr) return [];
  const cleaned = phoneStr.replace(/\+213/g, '0').replace(/^00213/g, '0');
  const allDigits = cleaned.replace(/[^\d]/g, '');

  const tokens: string[] = [];
  // Match Algerian mobile (05/06/07 followed by 8 digits) and landline (02x/03x/04x followed by 6-7 digits)
  const regex = /0[2-9]\d{7,8}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(allDigits)) !== null) {
    tokens.push(match[0]);
  }

  if (tokens.length === 0 && allDigits.length >= 8) {
    tokens.push(allDigits);
  }

  return Array.from(new Set(tokens));
}

export function normalizeId(val?: string | number | null): string {
  if (!val) return '';
  const s = String(val).trim().toUpperCase();
  return s.replace(/[\s\.\-\_\/]/g, '');
}

export function combineAddress(address?: string, wilaya?: string): string {
  const addr = (address || '').trim();
  const wil = (wilaya || '').trim();
  if (!addr && !wil) return '';
  if (!addr) return wil;
  if (!wil) return addr;
  if (addr.toUpperCase().includes(wil.toUpperCase())) {
    return addr;
  }
  return `${addr}, ${wil}`;
}

export function combineActivity(typeCli?: string, activitee?: string): string {
  const t = (typeCli || '').trim();
  const a = (activitee || '').trim();
  if (t && a) return `${t} - ${a}`;
  return t || a || '';
}

export function nameSimilarity(n1: string, n2: string): number {
  if (!n1 || !n2) return 0.0;
  if (n1 === n2) return 1.0;

  const t1 = new Set(n1.split(' ').filter(Boolean));
  const t2 = new Set(n2.split(' ').filter(Boolean));

  // Jaccard similarity on tokens
  const intersection = new Set([...t1].filter((x) => t2.has(x)));
  const union = new Set([...t1, ...t2]);
  const jaccard = union.size > 0 ? intersection.size / union.size : 0;

  // Levenshtein ratio approximation
  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 1.0;
  let matches = 0;
  const minLen = Math.min(n1.length, n2.length);
  for (let i = 0; i < minLen; i++) {
    if (n1[i] === n2[i]) matches++;
  }
  const prefixRatio = matches / maxLen;

  return Math.max(jaccard, prefixRatio);
}

// 2. Disjoint Set Union (Union-Find) for Clustering

class UnionFind {
  parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(i: number): number {
    if (this.parent[i] === i) return i;
    this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }

  union(i: number, j: number): void {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent[rootI] = rootJ;
    }
  }
}

// 3. Multi-Warehouse Analyze Pipeline

export function analyzeClientImports(rows: RawImportRow[]): ImportAnalysisResult {
  const records: NormalizedImportRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rawName = (r.name || '').trim();
    if (!rawName) continue;

    let bal = 0.0;
    if (typeof r.solde === 'number') {
      bal = r.solde;
    } else if (r.solde) {
      const parsed = parseFloat(String(r.solde).replace(',', '.').trim());
      bal = isNaN(parsed) ? 0.0 : parsed;
    }

    records.push({
      id: records.length,
      sourceWarehouseId: r.warehouseId || 1,
      sourceWarehouseName: r.warehouseName || 'Dépôt',
      sourceRow: r.rowNumber || i + 2,
      name: rawName,
      normName: normalizeClientName(rawName),
      balance: bal,
      phone: (r.phone || '').trim(),
      phoneTokens: extractPhoneTokens(r.phone),
      address: combineAddress(r.address, r.wilaya),
      activite: combineActivity(r.typeCli, r.activitee),
      rc: (r.rc || '').trim(),
      normRc: normalizeId(r.rc),
      art: (r.art || '').trim(),
      normArt: normalizeId(r.art),
      numFiscal: (r.numFiscal || '').trim(),
      normFiscal: normalizeId(r.numFiscal),
      nis: (r.nis || '').trim(),
      normNis: normalizeId(r.nis),
      nif: (r.nif || '').trim(),
      normNif: normalizeId(r.nif),
    });
  }

  const uf = new UnionFind(records.length);

  // Inverted indexes for fast matching
  const byRc = new Map<string, number[]>();
  const byArt = new Map<string, number[]>();
  const byName = new Map<string, number[]>();
  const byPhone = new Map<string, number[]>();

  for (let idx = 0; idx < records.length; idx++) {
    const rec = records[idx];
    if (rec.normRc) {
      const list = byRc.get(rec.normRc) || [];
      list.push(idx);
      byRc.set(rec.normRc, list);
    }
    if (rec.normArt) {
      const list = byArt.get(rec.normArt) || [];
      list.push(idx);
      byArt.set(rec.normArt, list);
    }
    if (rec.normName) {
      const list = byName.get(rec.normName) || [];
      list.push(idx);
      byName.set(rec.normName, list);
    }
    for (const p of rec.phoneTokens) {
      const list = byPhone.get(p) || [];
      list.push(idx);
      byPhone.set(p, list);
    }
  }

  const evaluatedPairs = new Set<string>();
  const tier2Conflicts: Tier2Conflict[] = [];

  function evaluatePair(i: number, j: number) {
    if (i === j) return;
    const pairKey = i < j ? `${i}:${j}` : `${j}:${i}`;
    if (evaluatedPairs.has(pairKey)) return;
    evaluatedPairs.add(pairKey);

    const r1 = records[i];
    const r2 = records[j];

    const rcMatch = Boolean(r1.normRc && r1.normRc === r2.normRc);
    const artMatch = Boolean(r1.normArt && r1.normArt === r2.normArt);
    const nameMatch = Boolean(r1.normName && r1.normName === r2.normName);
    const phoneMatch = Boolean(r1.phoneTokens.some((p) => r2.phoneTokens.includes(p)));
    const sim = nameSimilarity(r1.normName, r2.normName);

    // Tier 1 Auto-merge criteria
    if (rcMatch || artMatch) {
      if (sim >= 0.5 || phoneMatch) {
        uf.union(i, j);
      } else {
        tier2Conflicts.push({
          conflictId: `t2-${i}-${j}`,
          reason: `Identifiant fiscal identique (${rcMatch ? 'RC' : 'Art'}) mais noms divergents (${r1.name} vs ${r2.name})`,
          recordA: r1,
          recordB: r2,
        });
      }
    } else if (nameMatch && phoneMatch) {
      uf.union(i, j);
    } else if (nameMatch && !phoneMatch) {
      if (r1.phoneTokens.length > 0 && r2.phoneTokens.length > 0) {
        tier2Conflicts.push({
          conflictId: `t2-${i}-${j}`,
          reason: `Même nom (${r1.normName}) mais téléphones différents (${r1.phone} vs ${r2.phone})`,
          recordA: r1,
          recordB: r2,
        });
      } else {
        tier2Conflicts.push({
          conflictId: `t2-${i}-${j}`,
          reason: `Même nom (${r1.normName}) sans téléphone ou RC de confirmation`,
          recordA: r1,
          recordB: r2,
        });
      }
    } else if (phoneMatch && !nameMatch) {
      tier2Conflicts.push({
        conflictId: `t2-${i}-${j}`,
        reason: `Même numéro de téléphone (${r1.phone}) mais noms différents (${r1.name} vs ${r2.name})`,
        recordA: r1,
        recordB: r2,
      });
    }
  }

  // Evaluate candidate pairs from indices
  for (const group of byRc.values()) {
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) evaluatePair(group[a], group[b]);
    }
  }
  for (const group of byArt.values()) {
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) evaluatePair(group[a], group[b]);
    }
  }
  for (const group of byName.values()) {
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) evaluatePair(group[a], group[b]);
    }
  }
  for (const group of byPhone.values()) {
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) evaluatePair(group[a], group[b]);
    }
  }

  // Aggregate into clusters
  const clusterMap = new Map<number, number[]>();
  for (let idx = 0; idx < records.length; idx++) {
    const root = uf.find(idx);
    const list = clusterMap.get(root) || [];
    list.push(idx);
    clusterMap.set(root, list);
  }

  const tier1Clusters: ConsolidatedCluster[] = [];
  const tier3Standalone: NormalizedImportRecord[] = [];
  let autoMergedRecordsCount = 0;

  for (const [root, memberIndices] of clusterMap.entries()) {
    if (memberIndices.length > 1) {
      const clusterRecords = memberIndices.map((idx) => records[idx]);
      autoMergedRecordsCount += clusterRecords.length;

      // Detect field conflicts across members
      const conflicts: FieldConflict[] = [];

      // Check Address differences
      const addresses = Array.from(new Set(clusterRecords.map((r) => r.address).filter(Boolean)));
      if (addresses.length > 1) {
        conflicts.push({
          field: 'address',
          label: 'Adresse',
          values: clusterRecords.map((r) => ({ value: r.address, warehouseName: r.sourceWarehouseName })),
        });
      }

      // Check Activity differences
      const activities = Array.from(new Set(clusterRecords.map((r) => r.activite).filter(Boolean)));
      if (activities.length > 1) {
        conflicts.push({
          field: 'activite',
          label: 'Activité',
          values: clusterRecords.map((r) => ({ value: r.activite, warehouseName: r.sourceWarehouseName })),
        });
      }

      // Consolidate best field values
      const primaryName = clusterRecords.find((r) => r.name.length > 3)?.name || clusterRecords[0].name;
      const primaryPhone = clusterRecords.map((r) => r.phone).filter(Boolean).join(' / ') || '';
      const primaryAddress = clusterRecords.find((r) => r.address)?.address || '';
      const primaryActivite = clusterRecords.find((r) => r.activite)?.activite || '';
      const primaryRc = clusterRecords.find((r) => r.rc)?.rc || '';
      const primaryArt = clusterRecords.find((r) => r.art)?.art || '';
      const primaryNumFiscal = clusterRecords.find((r) => r.numFiscal)?.numFiscal || '';
      const primaryNis = clusterRecords.find((r) => r.nis)?.nis || '';
      const primaryNif = clusterRecords.find((r) => r.nif)?.nif || '';
      const totalBalance = clusterRecords.reduce((sum, r) => sum + r.balance, 0);

      tier1Clusters.push({
        clusterId: `c-${root}`,
        suggestedClient: {
          name: primaryName,
          phone: primaryPhone,
          address: primaryAddress,
          activite: primaryActivite,
          rc: primaryRc,
          art: primaryArt,
          numFiscal: primaryNumFiscal,
          nis: primaryNis,
          nif: primaryNif,
          totalBalance: Math.round(totalBalance * 100) / 100,
        },
        records: clusterRecords,
        conflicts,
      });
    } else {
      tier3Standalone.push(records[memberIndices[0]]);
    }
  }

  const totalOpeningBalance = records.reduce((sum, r) => sum + r.balance, 0);

  return {
    kpis: {
      totalRows: records.length,
      autoMergedClustersCount: tier1Clusters.length,
      autoMergedRecordsCount,
      reviewConflictsCount: tier2Conflicts.length,
      standaloneCount: tier3Standalone.length,
      totalOpeningBalance: Math.round(totalOpeningBalance * 100) / 100,
    },
    tier1Clusters,
    tier2Conflicts,
    tier3Standalone,
  };
}
