import { Router } from 'express';
import { query, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, AuthRequest, logAudit } from '../middleware/auth.js';

const router = Router();

// ────────────────────────────────────────────────
// Helper: generate next facture number for the current year
// Format: {sequence}/{year}  e.g. "208/2026"
// ────────────────────────────────────────────────
async function generateFactureNumber(year?: number): Promise<string> {
  const y = year || new Date().getFullYear();
  const suffix = `/${y}`;
  const result = await query(
    `SELECT MAX(CAST(SPLIT_PART(facture_number, '/', 1) AS INTEGER)) as max_seq
     FROM factures
     WHERE facture_number LIKE $1`,
    [`%${suffix}`]
  );
  const nextSeq = (Number(result.rows[0]?.max_seq) || 0) + 1;
  return `${nextSeq}/${y}`;
}

// ────────────────────────────────────────────────
// Helper: map a facture DB row to a camelCase API object
// ────────────────────────────────────────────────
function mapFactureRow(r: any, items?: any[]): any {
  return {
    id: r.id,
    saleId: r.sale_id,
    invoiceNumber: r.invoice_number || null,
    warehouseId: r.warehouse_id || null,
    warehouseName: r.warehouse_name || null,
    warehouseAddress: r.warehouse_address || null,
    warehousePhone: r.warehouse_phone || null,
    factureNumber: r.facture_number,
    factureDate: r.facture_date,
    clientId: r.client_id,
    clientName: r.client_name,
    clientAddress: r.client_address || null,
    clientRc: r.client_rc || null,
    clientNif: r.client_nif || null,
    clientArt: r.client_art || null,
    clientActivite: r.client_activite || null,
    clientNis: r.client_nis || null,
    reglement: r.reglement,
    totalHt: Number(r.total_ht),
    totalTva: Number(r.total_tva),
    timbre: Number(r.timbre),
    totalRemise: Number(r.total_remise),
    totalTtc: Number(r.total_ttc),
    situation: r.situation,
    situationNotes: r.situation_notes || null,
    situationDate: r.situation_date || null,
    moyenTransport: r.moyen_transport || null,
    camionNumero: r.camion_numero || null,
    chauffeur: r.chauffeur || null,
    createdBy: r.created_by,
    createdByName: r.created_by_name || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items: items || [],
  };
}

function mapFactureItemRow(r: any): any {
  return {
    id: r.id,
    factureId: r.facture_id,
    productId: r.product_id,
    code: r.code,
    designation: r.designation,
    um: r.um,
    tvaRate: Number(r.tva_rate),
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    remisePct: Number(r.remise_pct),
    total: Number(r.total),
  };
}

// ────────────────────────────────────────────────
// GET /  — list factures (paginated, filterable)
// ────────────────────────────────────────────────
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string | undefined)?.trim();
    const situation = (req.query.situation as string | undefined)?.trim();
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    let baseFromWhere = `
      FROM factures f
      JOIN sales s ON f.sale_id = s.id
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      LEFT JOIN users u ON f.created_by = u.id
    `;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (situation && situation !== 'all') {
      params.push(situation);
      whereClauses.push(`f.situation = $${params.length}`);
    }

    if (startDate) {
      const formatted = startDate.length === 10 ? `${startDate}` : startDate;
      params.push(formatted);
      whereClauses.push(`f.facture_date >= $${params.length}::date`);
    }

    if (endDate) {
      const formatted = endDate.length === 10 ? `${endDate}` : endDate;
      params.push(formatted);
      whereClauses.push(`f.facture_date <= $${params.length}::date`);
    }

    if (search) {
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      const p3 = params.length + 3;
      whereClauses.push(`(f.facture_number ILIKE $${p1} OR f.client_name ILIKE $${p2} OR s.invoice_number ILIKE $${p3})`);
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (whereClauses.length > 0) {
      baseFromWhere += ' WHERE ' + whereClauses.join(' AND ');
    }

    const countRes = await query(`SELECT COUNT(*) as count ${baseFromWhere}`, params);
    const total = Number(countRes.rows[0]?.count || 0);

    const selectParams = [...params, limit, offset];
    const limitIdx = selectParams.length - 1;
    const offsetIdx = selectParams.length;

    const selectQuery = `
      SELECT f.*, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.location as warehouse_address, w.contact_number as warehouse_phone, u.full_name as created_by_name
      ${baseFromWhere}
      ORDER BY f.facture_date DESC, f.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const facturesRes = await query(selectQuery, selectParams);
    const items = facturesRes.rows.map((r: any) => mapFactureRow(r));

    return sendSuccess(res, {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// ────────────────────────────────────────────────
// GET /sales-without-facture  — list sales that don't have a facture yet
// ────────────────────────────────────────────────
router.get('/sales-without-facture', authenticate, async (req: AuthRequest, res) => {
  try {
    const search = (req.query.search as string | undefined)?.trim();
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 15));

    let whereSql = `WHERE s.status != 'CANCELLED' AND NOT EXISTS (SELECT 1 FROM factures f WHERE f.sale_id = s.id)`;
    const params: any[] = [];

    if (search) {
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      const p3 = params.length + 3;
      const p4 = params.length + 4;
      const term = `%${search}%`;
      params.push(term, term, term, term);
      whereSql += ` AND (s.invoice_number ILIKE $${p1} OR s.customer_name ILIKE $${p2} OR cl.name ILIKE $${p3} OR cl.code ILIKE $${p4})`;
    }

    params.push(limit);
    const limitIdx = params.length;

    const result = await query(`
      SELECT s.id, s.invoice_number, s.customer_name, s.client_id,
             cl.name as client_name, cl.code as client_code, cl.address as client_address,
             cl.rc as client_rc, cl.nif as client_nif, cl.art as client_art,
             cl.activite as client_activite, cl.nis as client_nis,
             s.total_amount, COALESCE(s.sale_date, s.created_at) as sale_date
      FROM sales s
      LEFT JOIN clients cl ON s.client_id = cl.id
      ${whereSql}
      ORDER BY COALESCE(s.sale_date, s.created_at) DESC
      LIMIT $${limitIdx}
    `, params);

    const items = result.rows.map((r: any) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      customerName: r.customer_name || r.client_name || 'Client',
      clientId: r.client_id,
      clientName: r.client_name,
      clientCode: r.client_code,
      clientAddress: r.client_address,
      clientRc: r.client_rc || null,
      clientNif: r.client_nif || null,
      clientArt: r.client_art || null,
      clientActivite: r.client_activite || null,
      clientNis: r.client_nis || null,
      totalAmount: Number(r.total_amount),
      saleDate: r.sale_date,
    }));

    return sendSuccess(res, items);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// ────────────────────────────────────────────────
// GET /:id  — single facture with items
// ────────────────────────────────────────────────
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return sendError(res, 'Invalid facture ID', 400);

    const factureRes = await query(`
      SELECT f.*, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.location as warehouse_address, w.contact_number as warehouse_phone, u.full_name as created_by_name
      FROM factures f
      JOIN sales s ON f.sale_id = s.id
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = $1
    `, [id]);

    if (factureRes.rows.length === 0) return sendError(res, 'Facture not found', 404);

    const itemsRes = await query(`
      SELECT * FROM facture_items WHERE facture_id = $1 ORDER BY id ASC
    `, [id]);

    const items = itemsRes.rows.map(mapFactureItemRow);
    const facture = mapFactureRow(factureRes.rows[0], items);

    return sendSuccess(res, facture);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// ────────────────────────────────────────────────
// POST /  — create facture from a sale
// ────────────────────────────────────────────────
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      saleId,
      clientName,
      clientAddress,
      clientRc,
      clientNif,
      clientArt,
      clientActivite,
      clientNis,
      reglement,
      moyenTransport,
      camionNumero,
      chauffeur,
      itemOverrides,  // optional array of { productId, unitPrice } to override per-item facture price
    } = req.body;

    if (!saleId) return sendError(res, 'saleId is required', 400);

    // Check if sale exists
    const saleRes = await query(`
      SELECT s.id, s.invoice_number, s.client_id, s.customer_name,
             cl.name as client_db_name, cl.code as client_db_code, cl.is_default as client_db_is_default,
             cl.address as client_db_address,
             cl.rc as client_db_rc, cl.nif as client_db_nif, cl.art as client_db_art,
             cl.activite as client_db_activite, cl.nis as client_db_nis
      FROM sales s
      LEFT JOIN clients cl ON s.client_id = cl.id
      WHERE s.id = $1
    `, [saleId]);

    if (saleRes.rows.length === 0) return sendError(res, 'Sale not found', 404);
    const sale = saleRes.rows[0];

    // Check 1:1 — no existing facture for this sale
    const existingRes = await query(`SELECT id FROM factures WHERE sale_id = $1`, [saleId]);
    if (existingRes.rows.length > 0) {
      return sendError(res, `Une facture existe déjà pour cette vente (Facture #${existingRes.rows[0].id})`, 409);
    }

    // Load sale items with product info (including facture_price)
    const saleItemsRes = await query(`
      SELECT si.product_id, si.quantity, si.unit_price as sale_unit_price,
             p.reference, p.name, p.unit, p.purchase_price, p.facture_price, p.tva
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = $1
      ORDER BY si.id ASC
    `, [saleId]);

    if (saleItemsRes.rows.length === 0) {
      return sendError(res, 'Sale has no items', 400);
    }

    // Build override map if provided
    const overrideMap: Record<number, number> = {};
    if (Array.isArray(itemOverrides)) {
      for (const ov of itemOverrides) {
        if (ov.productId && ov.unitPrice !== undefined) {
          overrideMap[ov.productId] = Number(ov.unitPrice);
        }
      }
    }

    // Determine client info (prioritize payload, fallback to sale customerName if walk-in or custom, then linked client in DB)
    const isWalkIn = sale.client_db_code === 'CLT-COMPTOIR' || Boolean(sale.client_db_is_default) || sale.client_id === 1;
    const defaultName = isWalkIn
      ? (sale.customer_name && !['CLIENT PASSAGER / COMPTOIR', 'CLIENT PASSAGER'].includes(sale.customer_name.toUpperCase()) ? sale.customer_name : (sale.client_db_name || 'Client Passager'))
      : (sale.customer_name || sale.client_db_name || 'Client');

    const resolvedClientName = clientName || defaultName || 'Client Passager';
    const resolvedClientId = sale.client_id || null;
    const resolvedClientAddress = clientAddress || ((isWalkIn && sale.client_db_address?.toLowerCase().includes('comptoir')) ? null : sale.client_db_address) || null;
    const resolvedClientRc = clientRc || sale.client_db_rc || null;
    const resolvedClientNif = clientNif || sale.client_db_nif || null;
    const resolvedClientArt = clientArt || sale.client_db_art || null;
    const resolvedClientActivite = clientActivite || sale.client_db_activite || null;
    const resolvedClientNis = clientNis || sale.client_db_nis || null;

    // Generate next facture number
    const factureNumber = await generateFactureNumber();

    const result = await runTransaction(async (client) => {
      // Build facture items and calculate totals
      let totalHt = 0;
      const factureItems: any[] = [];

      for (const item of saleItemsRes.rows) {
        // Priority: override > product.facture_price > purchase_price * 0.30
        let unitPrice: number;
        if (overrideMap[item.product_id] !== undefined) {
          unitPrice = overrideMap[item.product_id];
        } else if (item.facture_price !== null && item.facture_price !== undefined) {
          unitPrice = Number(item.facture_price);
        } else {
          unitPrice = Math.round(Number(item.purchase_price) * 0.30 * 100) / 100;
        }

        const qty = Number(item.quantity);
        const lineTotal = Math.round(unitPrice * qty * 100) / 100;
        totalHt += lineTotal;

        factureItems.push({
          productId: item.product_id,
          code: item.reference,
          designation: item.name,
          um: item.unit || 'PCS',
          tvaRate: Number(item.tva || 19),
          quantity: qty,
          unitPrice,
          remisePct: 0,
          total: lineTotal,
        });
      }

      totalHt = Math.round(totalHt * 100) / 100;
      const totalTva = Math.round(totalHt * 0.19 * 100) / 100;
      const timbre = Math.round((totalHt + totalTva) * 0.01 * 100) / 100;
      const totalTtc = Math.round((totalHt + totalTva + timbre) * 100) / 100;

      // Insert facture
      const insertRes = await client.query(`
        INSERT INTO factures (
          sale_id, facture_number, facture_date, client_id, client_name, client_address,
          client_rc, client_nif, client_art, client_activite, client_nis,
          reglement, total_ht, total_tva, timbre, total_remise, total_ttc,
          moyen_transport, camion_numero, chauffeur, created_by
        ) VALUES (
          $1, $2, CURRENT_DATE, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20
        ) RETURNING *
      `, [
        saleId, factureNumber, resolvedClientId, resolvedClientName, resolvedClientAddress,
        resolvedClientRc, resolvedClientNif, resolvedClientArt, resolvedClientActivite, resolvedClientNis,
        reglement || 'Espèce', totalHt, totalTva, timbre, 0, totalTtc,
        moyenTransport || null, camionNumero || null, chauffeur || null, req.user!.id,
      ]);

      const factureId = insertRes.rows[0].id;

      // Insert facture items
      for (const fi of factureItems) {
        await client.query(`
          INSERT INTO facture_items (
            facture_id, product_id, code, designation, um, tva_rate,
            quantity, unit_price, remise_pct, total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          factureId, fi.productId, fi.code, fi.designation, fi.um, fi.tvaRate,
          fi.quantity, fi.unitPrice, fi.remisePct, fi.total,
        ]);
      }

      return insertRes.rows[0];
    });

    // Re-fetch full facture with items
    const fullFactureRes = await query(`
      SELECT f.*, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.location as warehouse_address, w.contact_number as warehouse_phone, u.full_name as created_by_name
      FROM factures f
      JOIN sales s ON f.sale_id = s.id
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = $1
    `, [result.id]);

    const fullItemsRes = await query(`SELECT * FROM facture_items WHERE facture_id = $1 ORDER BY id ASC`, [result.id]);
    const facture = mapFactureRow(fullFactureRes.rows[0], fullItemsRes.rows.map(mapFactureItemRow));

    await logAudit(req.user, 'CREATE', 'FACTURE', String(result.id), `Facture ${factureNumber} créée pour la vente #${saleId}`);

    return sendSuccess(res, facture, 'Facture créée avec succès', 201);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// ────────────────────────────────────────────────
// PUT /:id  — update facture (client info, prices, transport, reglement)
// ────────────────────────────────────────────────
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return sendError(res, 'Invalid facture ID', 400);

    const existingRes = await query(`SELECT * FROM factures WHERE id = $1`, [id]);
    if (existingRes.rows.length === 0) return sendError(res, 'Facture not found', 404);

    const {
      clientName,
      clientAddress,
      clientRc,
      clientNif,
      clientArt,
      clientActivite,
      clientNis,
      reglement,
      moyenTransport,
      camionNumero,
      chauffeur,
      items,  // optional: array of { id, unitPrice, remisePct } to update item prices
    } = req.body;

    await runTransaction(async (client) => {
      // Update facture header fields (only those provided)
      const updates: string[] = [];
      const updateParams: any[] = [];

      if (clientName !== undefined) { updateParams.push(clientName); updates.push(`client_name = $${updateParams.length}`); }
      if (clientAddress !== undefined) { updateParams.push(clientAddress); updates.push(`client_address = $${updateParams.length}`); }
      if (clientRc !== undefined) { updateParams.push(clientRc); updates.push(`client_rc = $${updateParams.length}`); }
      if (clientNif !== undefined) { updateParams.push(clientNif); updates.push(`client_nif = $${updateParams.length}`); }
      if (clientArt !== undefined) { updateParams.push(clientArt); updates.push(`client_art = $${updateParams.length}`); }
      if (clientActivite !== undefined) { updateParams.push(clientActivite); updates.push(`client_activite = $${updateParams.length}`); }
      if (clientNis !== undefined) { updateParams.push(clientNis); updates.push(`client_nis = $${updateParams.length}`); }
      if (reglement !== undefined) { updateParams.push(reglement); updates.push(`reglement = $${updateParams.length}`); }
      if (moyenTransport !== undefined) { updateParams.push(moyenTransport); updates.push(`moyen_transport = $${updateParams.length}`); }
      if (camionNumero !== undefined) { updateParams.push(camionNumero); updates.push(`camion_numero = $${updateParams.length}`); }
      if (chauffeur !== undefined) { updateParams.push(chauffeur); updates.push(`chauffeur = $${updateParams.length}`); }

      // If items are updated, recalculate totals
      if (Array.isArray(items) && items.length > 0) {
        let totalHt = 0;

        for (const itemUpdate of items) {
          if (!itemUpdate.id) continue;
          const newPrice = Number(itemUpdate.unitPrice);
          const remise = Number(itemUpdate.remisePct || 0);

          // Get current quantity
          const currentItem = await client.query(`SELECT quantity FROM facture_items WHERE id = $1 AND facture_id = $2`, [itemUpdate.id, id]);
          if (currentItem.rows.length === 0) continue;

          const qty = Number(currentItem.rows[0].quantity);
          const lineTotal = Math.round(newPrice * qty * (1 - remise / 100) * 100) / 100;
          totalHt += lineTotal;

          await client.query(`
            UPDATE facture_items SET unit_price = $1, remise_pct = $2, total = $3 WHERE id = $4 AND facture_id = $5
          `, [newPrice, remise, lineTotal, itemUpdate.id, id]);
        }

        // Also add totals from items NOT being updated
        const unchangedRes = await client.query(`
          SELECT SUM(total) as unchanged_total FROM facture_items
          WHERE facture_id = $1 AND id != ALL($2::int[])
        `, [id, items.map((i: any) => i.id)]);
        totalHt += Number(unchangedRes.rows[0]?.unchanged_total || 0);

        totalHt = Math.round(totalHt * 100) / 100;
        const totalTva = Math.round(totalHt * 0.19 * 100) / 100;
        const timbre = Math.round((totalHt + totalTva) * 0.01 * 100) / 100;
        const totalTtc = Math.round((totalHt + totalTva + timbre) * 100) / 100;

        updateParams.push(totalHt); updates.push(`total_ht = $${updateParams.length}`);
        updateParams.push(totalTva); updates.push(`total_tva = $${updateParams.length}`);
        updateParams.push(timbre); updates.push(`timbre = $${updateParams.length}`);
        updateParams.push(totalTtc); updates.push(`total_ttc = $${updateParams.length}`);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        updateParams.push(id);
        await client.query(`UPDATE factures SET ${updates.join(', ')} WHERE id = $${updateParams.length}`, updateParams);
      }
    });

    // Re-fetch
    const fullRes = await query(`
      SELECT f.*, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.location as warehouse_address, w.contact_number as warehouse_phone, u.full_name as created_by_name
      FROM factures f
      JOIN sales s ON f.sale_id = s.id
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = $1
    `, [id]);
    const fullItemsRes = await query(`SELECT * FROM facture_items WHERE facture_id = $1 ORDER BY id ASC`, [id]);
    const facture = mapFactureRow(fullRes.rows[0], fullItemsRes.rows.map(mapFactureItemRow));

    await logAudit(req.user, 'UPDATE', 'FACTURE', String(id), `Facture ${facture.factureNumber} mise à jour`);

    return sendSuccess(res, facture);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// ────────────────────────────────────────────────
// PATCH /:id/situation  — update situation status
// ────────────────────────────────────────────────
router.patch('/:id/situation', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return sendError(res, 'Invalid facture ID', 400);

    const { situation, situationNotes } = req.body;
    if (!situation) return sendError(res, 'situation is required', 400);

    const validSituations = ['ACTIVE', 'DETAINED', 'DESTROYED'];
    if (!validSituations.includes(situation)) {
      return sendError(res, `Invalid situation. Must be one of: ${validSituations.join(', ')}`, 400);
    }

    const existingRes = await query(`SELECT id, facture_number, situation FROM factures WHERE id = $1`, [id]);
    if (existingRes.rows.length === 0) return sendError(res, 'Facture not found', 404);

    const oldSituation = existingRes.rows[0].situation;

    await query(`
      UPDATE factures SET situation = $1, situation_notes = $2, situation_date = NOW(), updated_at = NOW()
      WHERE id = $3
    `, [situation, situationNotes || null, id]);

    await logAudit(
      req.user, 'UPDATE_SITUATION', 'FACTURE', String(id),
      `Facture ${existingRes.rows[0].facture_number}: ${oldSituation} → ${situation}${situationNotes ? ` (${situationNotes})` : ''}`
    );

    // Re-fetch
    const fullRes = await query(`
      SELECT f.*, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.location as warehouse_address, w.contact_number as warehouse_phone, u.full_name as created_by_name
      FROM factures f
      JOIN sales s ON f.sale_id = s.id
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = $1
    `, [id]);
    const fullItemsRes = await query(`SELECT * FROM facture_items WHERE facture_id = $1 ORDER BY id ASC`, [id]);
    const facture = mapFactureRow(fullRes.rows[0], fullItemsRes.rows.map(mapFactureItemRow));

    return sendSuccess(res, facture);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// ────────────────────────────────────────────────
// DELETE /:id  — delete a facture (only if ACTIVE)
// ────────────────────────────────────────────────
router.delete('/:id', authenticate, requireRole('ADMIN', 'SUPER_MANAGER'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return sendError(res, 'Invalid facture ID', 400);

    const existingRes = await query(`SELECT id, facture_number, situation FROM factures WHERE id = $1`, [id]);
    if (existingRes.rows.length === 0) return sendError(res, 'Facture not found', 404);

    if (existingRes.rows[0].situation !== 'ACTIVE') {
      return sendError(res, `Cannot delete facture with situation '${existingRes.rows[0].situation}'. Only ACTIVE factures can be deleted.`, 400);
    }

    await runTransaction(async (client) => {
      await client.query(`DELETE FROM facture_items WHERE facture_id = $1`, [id]);
      await client.query(`DELETE FROM factures WHERE id = $1`, [id]);
    });

    await logAudit(req.user, 'DELETE', 'FACTURE', String(id), `Facture ${existingRes.rows[0].facture_number} supprimée`);

    return sendSuccess(res, { deleted: true });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
