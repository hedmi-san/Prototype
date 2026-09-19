import { Router, Response } from 'express';
import { query, runTransaction } from '../db/database.js';
import { authenticate, AuthRequest, requireRole, logAudit, validateWarehouseScope } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../common/response.js';

const router = Router();

export function generateCreditNoteNumber(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AVR-${yyyy}${mm}${dd}-${rand}`;
}

export async function getCreditNoteValidityDays(): Promise<number> {
  try {
    const res = await query("SELECT value FROM system_settings WHERE key = 'credit_note_validity_days'");
    if (res.rows[0]?.value) {
      const val = parseInt(res.rows[0].value, 10);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch (err) {
    console.warn('Error reading credit_note_validity_days setting, using fallback 90 days:', err);
  }
  return 90;
}

// Background sync: updates PENDING or PARTIALLY_REFUNDED credit notes to EXPIRED if past expiry_date
export async function syncExpiredCreditNotes(): Promise<number> {
  try {
    const res = await query(`
      UPDATE counter_credit_notes
      SET status = 'EXPIRED', updated_at = NOW()
      WHERE status IN ('PENDING', 'PARTIALLY_REFUNDED')
        AND NOW() > expiry_date
        AND remaining_amount > 0
    `);
    return res.rowCount || 0;
  } catch (err) {
    console.error('Error syncing expired credit notes:', err);
    return 0;
  }
}

// GET /api/credit-notes - List credit notes with filtering and pagination
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Keep statuses synchronized
    await syncExpiredCreditNotes();

    const {
      clientId,
      warehouseId,
      status,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 25,
    } = req.query;

    const numPage = Math.max(1, Number(page) || 1);
    const numLimit = Math.max(1, Math.min(100, Number(limit) || 25));
    const offset = (numPage - 1) * numLimit;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    // Filter warehouse scope for regular managers / cashiers
    if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_MANAGER') {
      if (req.user.warehouseId) {
        params.push(req.user.warehouseId);
        conditions.push(`ccn.warehouse_id = $${params.length}`);
      }
    } else if (warehouseId) {
      params.push(Number(warehouseId));
      conditions.push(`ccn.warehouse_id = $${params.length}`);
    }

    if (clientId) {
      params.push(Number(clientId));
      conditions.push(`ccn.client_id = $${params.length}`);
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      params.push(status);
      conditions.push(`ccn.status = $${params.length}`);
    }

    if (startDate && typeof startDate === 'string') {
      params.push(startDate);
      conditions.push(`ccn.issue_date >= $${params.length}::timestamptz`);
    }

    if (endDate && typeof endDate === 'string') {
      params.push(`${endDate} 23:59:59.999`);
      conditions.push(`ccn.issue_date <= $${params.length}::timestamptz`);
    }

    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(
        LOWER(ccn.credit_note_number) LIKE $${params.length} OR
        LOWER(s.invoice_number) LIKE $${params.length} OR
        LOWER(c.name) LIKE $${params.length} OR
        LOWER(c.code) LIKE $${params.length}
      )`);
    }

    const whereSql = conditions.join(' AND ');

    const countRes = await query(`
      SELECT COUNT(*) as total
      FROM counter_credit_notes ccn
      JOIN sales s ON ccn.sale_id = s.id
      JOIN clients c ON ccn.client_id = c.id
      WHERE ${whereSql}
    `, params);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    const totalPages = Math.ceil(total / numLimit);

    const listParams = [...params, numLimit, offset];
    const limitIdx = listParams.length - 1;
    const offsetIdx = listParams.length;

    const listRes = await query(`
      SELECT
        ccn.*,
        s.invoice_number as sale_invoice_number,
        s.sale_date as sale_date,
        c.name as client_name,
        c.code as client_code,
        c.phone as client_phone,
        c.is_default as client_is_default,
        w.name as warehouse_name,
        w.code as warehouse_code,
        u.full_name as created_by_name,
        ru.full_name as reactivated_by_name,
        fu.full_name as forfeited_by_name
      FROM counter_credit_notes ccn
      JOIN sales s ON ccn.sale_id = s.id
      JOIN clients c ON ccn.client_id = c.id
      JOIN warehouses w ON ccn.warehouse_id = w.id
      JOIN users u ON ccn.created_by = u.id
      LEFT JOIN users ru ON ccn.reactivated_by = ru.id
      LEFT JOIN users fu ON ccn.forfeited_by = fu.id
      WHERE ${whereSql}
      ORDER BY ccn.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, listParams);

    const items = listRes.rows.map((r) => ({
      id: r.id,
      creditNoteNumber: r.credit_note_number,
      saleId: r.sale_id,
      saleInvoiceNumber: r.sale_invoice_number,
      saleDate: r.sale_date,
      clientId: r.client_id,
      clientName: r.client_name,
      clientCode: r.client_code,
      clientPhone: r.client_phone,
      clientIsDefault: Boolean(r.client_is_default),
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      warehouseCode: r.warehouse_code,
      totalAmount: Number(r.total_amount),
      refundedAmount: Number(r.refunded_amount),
      remainingAmount: Number(r.remaining_amount),
      status: r.status,
      issueDate: r.issue_date,
      expiryDate: r.expiry_date,
      reactivatedAt: r.reactivated_at,
      reactivatedByName: r.reactivated_by_name,
      forfeitedAt: r.forfeited_at,
      forfeitedByName: r.forfeited_by_name,
      forfeitedTransactionId: r.forfeited_transaction_id,
      notes: r.notes || '',
      createdById: r.created_by,
      createdByName: r.created_by_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return sendSuccess(res, {
      items,
      pagination: {
        page: numPage,
        limit: numLimit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    console.error('Failed to list credit notes:', err);
    return sendError(res, err.message, 500);
  }
});

// GET /api/credit-notes/:id - Get single credit note details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return sendError(res, 'ID avoir invalide', 400);

    await syncExpiredCreditNotes();

    const noteRes = await query(`
      SELECT
        ccn.*,
        s.invoice_number as sale_invoice_number,
        s.sale_date as sale_date,
        s.total_amount as sale_total_amount,
        c.name as client_name,
        c.code as client_code,
        c.phone as client_phone,
        c.address as client_address,
        c.is_default as client_is_default,
        w.name as warehouse_name,
        w.code as warehouse_code,
        w.location as warehouse_location,
        w.contact_number as warehouse_phone,
        u.full_name as created_by_name,
        ru.full_name as reactivated_by_name,
        fu.full_name as forfeited_by_name
      FROM counter_credit_notes ccn
      JOIN sales s ON ccn.sale_id = s.id
      JOIN clients c ON ccn.client_id = c.id
      JOIN warehouses w ON ccn.warehouse_id = w.id
      JOIN users u ON ccn.created_by = u.id
      LEFT JOIN users ru ON ccn.reactivated_by = ru.id
      LEFT JOIN users fu ON ccn.forfeited_by = fu.id
      WHERE ccn.id = $1
    `, [id]);

    const r = noteRes.rows[0];
    if (!r) return sendError(res, `Avoir introuvable avec l'id ${id}`, 404);

    if (req.user) {
      try {
        validateWarehouseScope(req.user, r.warehouse_id);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    // Get linked refunds
    const refundsRes = await query(`
      SELECT
        cr.*,
        u.full_name as created_by_name
      FROM client_refunds cr
      JOIN users u ON cr.created_by = u.id
      WHERE cr.credit_note_id = $1
      ORDER BY cr.created_at ASC
    `, [id]);

    const refunds = refundsRes.rows.map((rf) => ({
      id: rf.id,
      refundNumber: rf.refund_number,
      amount: Number(rf.amount),
      refundMethod: rf.refund_method,
      recipientName: rf.recipient_name,
      recipientPhone: rf.recipient_phone,
      recipientIdCard: rf.recipient_id_card,
      notes: rf.notes,
      createdByName: rf.created_by_name,
      createdAt: rf.created_at,
    }));

    return sendSuccess(res, {
      id: r.id,
      creditNoteNumber: r.credit_note_number,
      saleId: r.sale_id,
      saleInvoiceNumber: r.sale_invoice_number,
      saleDate: r.sale_date,
      saleTotalAmount: Number(r.sale_total_amount),
      clientId: r.client_id,
      clientName: r.client_name,
      clientCode: r.client_code,
      clientPhone: r.client_phone,
      clientAddress: r.client_address,
      clientIsDefault: Boolean(r.client_is_default),
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      warehouseCode: r.warehouse_code,
      warehouseLocation: r.warehouse_location,
      warehousePhone: r.warehouse_phone,
      totalAmount: Number(r.total_amount),
      refundedAmount: Number(r.refunded_amount),
      remainingAmount: Number(r.remaining_amount),
      status: r.status,
      issueDate: r.issue_date,
      expiryDate: r.expiry_date,
      reactivatedAt: r.reactivated_at,
      reactivatedByName: r.reactivated_by_name,
      forfeitedAt: r.forfeited_at,
      forfeitedByName: r.forfeited_by_name,
      forfeitedTransactionId: r.forfeited_transaction_id,
      notes: r.notes || '',
      createdById: r.created_by,
      createdByName: r.created_by_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      refunds,
    });
  } catch (err: any) {
    console.error('Failed to get credit note detail:', err);
    return sendError(res, err.message, 500);
  }
});

// GET /api/credit-notes/:id/receipt - Payload formatted for printable CreditNoteReceipt.vue
router.get('/:id/receipt', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return sendError(res, 'ID avoir invalide', 400);

    const noteRes = await query(`
      SELECT
        ccn.*,
        s.invoice_number as sale_invoice_number,
        s.sale_date as sale_date,
        c.name as client_name,
        c.code as client_code,
        c.phone as client_phone,
        w.name as warehouse_name,
        w.code as warehouse_code,
        w.location as warehouse_location,
        w.contact_number as warehouse_phone,
        u.full_name as created_by_name
      FROM counter_credit_notes ccn
      JOIN sales s ON ccn.sale_id = s.id
      JOIN clients c ON ccn.client_id = c.id
      JOIN warehouses w ON ccn.warehouse_id = w.id
      JOIN users u ON ccn.created_by = u.id
      WHERE ccn.id = $1
    `, [id]);

    const r = noteRes.rows[0];
    if (!r) return sendError(res, `Avoir introuvable avec l'id ${id}`, 404);

    return sendSuccess(res, {
      id: r.id,
      creditNoteNumber: r.credit_note_number,
      saleInvoiceNumber: r.sale_invoice_number,
      saleDate: r.sale_date,
      clientName: r.client_name,
      clientCode: r.client_code,
      clientPhone: r.client_phone,
      warehouseName: r.warehouse_name,
      warehouseCode: r.warehouse_code,
      warehouseLocation: r.warehouse_location,
      warehousePhone: r.warehouse_phone,
      totalAmount: Number(r.total_amount),
      remainingAmount: Number(r.remaining_amount),
      status: r.status,
      issueDate: r.issue_date,
      expiryDate: r.expiry_date,
      createdByName: r.created_by_name,
      notes: r.notes || '',
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// POST /api/credit-notes/:id/reactivate - Admin / Super Manager reactivates an expired credit note
router.post('/:id/reactivate', authenticate, requireRole('ADMIN', 'SUPER_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { justification } = req.body;

    if (!id || isNaN(id)) return sendError(res, 'ID avoir invalide', 400);

    const result = await runTransaction(async (dbClient) => {
      const lockRes = await dbClient.query('SELECT * FROM counter_credit_notes WHERE id = $1 FOR UPDATE', [id]);
      const cn = lockRes.rows[0];
      if (!cn) throw new Error(`Avoir introuvable avec l'id ${id}`);

      if (cn.status !== 'EXPIRED') {
        throw new Error(`Seul un avoir au statut 'EXPIRED' peut être réactivé (statut actuel: ${cn.status})`);
      }
      if (Number(cn.remaining_amount) <= 0) {
        throw new Error(`Cet avoir n'a aucun reliquat remboursable`);
      }

      // Re-activate: set status to PENDING or PARTIALLY_REFUNDED and extend expiry date by validity period
      const validityDays = await getCreditNoteValidityDays();
      const newStatus = Number(cn.refunded_amount) > 0 ? 'PARTIALLY_REFUNDED' : 'PENDING';
      const cleanJustification = typeof justification === 'string' ? justification.trim() : 'Réactivation commerciale administrative';

      const updateRes = await dbClient.query(`
        UPDATE counter_credit_notes
        SET status = $1,
            reactivated_at = NOW(),
            reactivated_by = $2,
            expiry_date = NOW() + ($3 || ' days')::interval,
            notes = COALESCE(notes, '') || ' | ' || $4,
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `, [newStatus, req.user?.id || 1, validityDays, `[RÉACTIVATION] ${cleanJustification}`, id]);

      return updateRes.rows[0];
    });

    await logAudit(
      req.user,
      'CREDIT_NOTE_REACTIVATED',
      'COUNTER_CREDIT_NOTE',
      id,
      `Réactivation de l'avoir ${result.credit_note_number} (${Number(result.remaining_amount).toFixed(2)} DA)`,
      result.warehouse_id
    );

    return sendSuccess(res, {
      id: result.id,
      creditNoteNumber: result.credit_note_number,
      status: result.status,
      expiryDate: result.expiry_date,
      remainingAmount: Number(result.remaining_amount),
    }, 'Avoir réactivé avec succès');
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

// POST /api/credit-notes/:id/forfeit - Accountant / Admin triggers manual forfeiture of expired credit note
router.post('/:id/forfeit', authenticate, requireRole('ADMIN', 'SUPER_MANAGER', 'ACCOUNTANT'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { justification } = req.body;

    if (!id || isNaN(id)) return sendError(res, 'ID avoir invalide', 400);

    const result = await runTransaction(async (dbClient) => {
      // 1. Lock credit note
      const lockRes = await dbClient.query('SELECT * FROM counter_credit_notes WHERE id = $1 FOR UPDATE', [id]);
      const cn = lockRes.rows[0];
      if (!cn) throw new Error(`Avoir introuvable avec l'id ${id}`);

      if (cn.status !== 'EXPIRED') {
        throw new Error(`Seul un avoir au statut 'EXPIRED' peut faire l'objet d'une forclusion comptable (statut actuel: ${cn.status})`);
      }

      const remaining = Number(cn.remaining_amount || 0);
      if (remaining <= 0) {
        throw new Error(`Cet avoir n'a aucun reliquat à forclore`);
      }

      // 2. Lock client row
      const clientRes = await dbClient.query('SELECT id, name, code, current_balance FROM clients WHERE id = $1 FOR UPDATE', [cn.client_id]);
      const clientRecord = clientRes.rows[0];
      if (!clientRecord) throw new Error('Client associé introuvable');

      const prevBal = Number(clientRecord.current_balance || 0);
      const newBal = prevBal + remaining; // Extinguish credit by debiting client account back towards 0
      const cleanJustification = typeof justification === 'string' ? justification.trim() : 'Prescription délai de réclamation (Compte 758)';

      // 3. Insert into client_transactions (DEBIT - Forfeiture / Exceptional income)
      const txDesc = `Forclusion avoir comptoir expiré [${cn.credit_note_number}] - Extinction dette client (Produits exceptionnels Cpt 758)${cleanJustification ? ' : ' + cleanJustification : ''}`;
      const txRes = await dbClient.query(`
        INSERT INTO client_transactions (
          client_id, warehouse_id, type, reference_type, reference_id,
          debit, credit, running_balance, description, transaction_date, created_by, created_at
        ) VALUES ($1, $2, 'ADJUSTMENT', 'CREDIT_NOTE_FORFEIT', $3, $4, 0, $5, $6, NOW(), $7, NOW())
        RETURNING id
      `, [cn.client_id, cn.warehouse_id, id, remaining, newBal, txDesc, req.user?.id || 1]);

      const txId = txRes.rows[0].id;

      // 4. Update client balance
      await dbClient.query('UPDATE clients SET current_balance = $1, updated_at = NOW() WHERE id = $2', [newBal, cn.client_id]);

      // 5. Update counter_credit_notes
      const updateRes = await dbClient.query(`
        UPDATE counter_credit_notes
        SET status = 'FORFEITED',
            forfeited_at = NOW(),
            forfeited_by = $1,
            forfeited_transaction_id = $2,
            remaining_amount = 0.0,
            notes = COALESCE(notes, '') || ' | ' || $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [req.user?.id || 1, txId, `[FORCLUSION] ${cleanJustification}`, id]);

      return {
        creditNote: updateRes.rows[0],
        transactionId: txId,
        forfeitedAmount: remaining,
        previousBalance: prevBal,
        newBalance: newBal,
      };
    });

    await logAudit(
      req.user,
      'CREDIT_NOTE_FORFEITED',
      'COUNTER_CREDIT_NOTE',
      id,
      `Forclusion comptable de l'avoir ${result.creditNote.credit_note_number} (${result.forfeitedAmount.toFixed(2)} DA) -> Compte 758`,
      result.creditNote.warehouse_id
    );

    return sendSuccess(res, result, 'Forclusion comptable enregistrée avec succès');
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

export default router;
