import { Router, Response } from 'express';
import { query, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { generateCsv, sendCsv, CsvColumn } from '../common/csv.js';
import { authenticate, requireRole, AuthRequest, logAudit } from '../middleware/auth.js';

const router = Router();

function mapClientRow(c: any) {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    phone: c.phone || '',
    email: c.email || '',
    address: c.address || '',
    openingBalance: Number(c.opening_balance || 0),
    currentBalance: Number(c.current_balance || 0),
    isDefault: Boolean(c.is_default),
    active: Boolean(c.active),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

// GET /api/clients - List with search, filtering, and summary KPIs
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const search = (req.query.search as string | undefined)?.trim();
    const balanceFilter = req.query.balanceFilter as string | undefined; // 'debtors', 'advance', 'settled'
    const activeOnly = req.query.activeOnly === 'true' || req.query.activeOnly === undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (activeOnly && req.query.activeOnly !== 'all') {
      whereClauses.push('active = TRUE');
    }

    if (balanceFilter === 'debtors') {
      whereClauses.push('current_balance > 0');
    } else if (balanceFilter === 'advance') {
      whereClauses.push('current_balance < 0');
    } else if (balanceFilter === 'settled') {
      whereClauses.push('current_balance = 0');
    }

    if (search) {
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      const p3 = params.length + 3;
      whereClauses.push(`(code ILIKE $${p1} OR name ILIKE $${p2} OR phone ILIKE $${p3})`);
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Summary KPIs
    const kpiRes = await query(`
      SELECT
        COUNT(*) as total_clients,
        COUNT(CASE WHEN current_balance > 0 THEN 1 END) as total_debtors,
        COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) as total_debt,
        COALESCE(SUM(CASE WHEN current_balance < 0 THEN ABS(current_balance) ELSE 0 END), 0) as total_advance
      FROM clients
      WHERE active = TRUE
    `);
    const kpiRow = kpiRes.rows[0];

    // Total count for current query
    const countRes = await query(`SELECT COUNT(*) as cnt FROM clients ${whereSql}`, params);
    const total = Number(countRes.rows[0]?.cnt || 0);

    // Fetch paginated clients
    const selectParams = [...params, limit, offset];
    const limitIdx = selectParams.length - 1;
    const offsetIdx = selectParams.length;

    const clientsRes = await query(`
      SELECT * FROM clients
      ${whereSql}
      ORDER BY is_default DESC, current_balance DESC, name ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, selectParams);

    const items = clientsRes.rows.map(mapClientRow);

    return sendSuccess(res, {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      kpis: {
        totalClients: Number(kpiRow.total_clients || 0),
        totalDebtors: Number(kpiRow.total_debtors || 0),
        totalDebt: Number(kpiRow.total_debt || 0),
        totalAdvance: Number(kpiRow.total_advance || 0),
      },
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// GET /api/clients/kpis - Global summary KPIs
router.get('/kpis', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const kpiRes = await query(`
      SELECT
        COUNT(*) as total_clients,
        COUNT(CASE WHEN current_balance > 0 THEN 1 END) as total_debtors,
        COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) as total_debt,
        COALESCE(SUM(CASE WHEN current_balance < 0 THEN ABS(current_balance) ELSE 0 END), 0) as total_advance
      FROM clients
      WHERE active = TRUE
    `);
    const r = kpiRes.rows[0];
    return sendSuccess(res, {
      totalClients: Number(r.total_clients || 0),
      totalDebtors: Number(r.total_debtors || 0),
      totalDebt: Number(r.total_debt || 0),
      totalAdvance: Number(r.total_advance || 0),
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// GET /api/clients/:id - Client details + statistics
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const clientRes = await query('SELECT * FROM clients WHERE id = $1', [id]);
    const client = clientRes.rows[0];
    if (!client) {
      return sendError(res, `Client not found with id ${id}`, 404);
    }

    // Stats
    const statsRes = await query(`
      SELECT
        COUNT(s.id) as sales_count,
        COALESCE(SUM(s.total_amount), 0) as total_invoiced,
        COALESCE(SUM(s.paid_amount), 0) as total_paid,
        COUNT(CASE WHEN s.payment_status IN ('UNPAID', 'PARTIALLY_PAID') AND s.status != 'CANCELLED' THEN 1 END) as open_invoices_count
      FROM sales s
      WHERE s.client_id = $1 AND s.status != 'CANCELLED'
    `, [id]);

    const stats = statsRes.rows[0];

    return sendSuccess(res, {
      ...mapClientRow(client),
      stats: {
        salesCount: Number(stats.sales_count || 0),
        totalInvoiced: Number(stats.total_invoiced || 0),
        totalPaid: Number(stats.total_paid || 0),
        openInvoicesCount: Number(stats.open_invoices_count || 0),
      },
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// POST /api/clients - Create new client
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { code, name, phone, email, address, openingBalance, warehouseId } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return sendError(res, 'Le nom du client est obligatoire', 400);
    }

    const opBal = Number(openingBalance) || 0.0;
    const targetWhId = warehouseId || req.user?.warehouseId || 1;

    const result = await runTransaction(async (dbClient) => {
      let clientCode = code ? code.trim() : '';
      if (!clientCode) {
        const nextIdRes = await dbClient.query("SELECT nextval(pg_get_serial_sequence('clients', 'id')) as next_id");
        const nextId = nextIdRes.rows[0].next_id;
        clientCode = `CLT-${String(nextId).padStart(4, '0')}`;

        const insertRes = await dbClient.query(`
          INSERT INTO clients (id, code, name, phone, email, address, opening_balance, current_balance, is_default, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $7, FALSE, TRUE)
          RETURNING *
        `, [nextId, clientCode, name.trim(), phone || '', email || '', address || '', opBal]);
        const newClient = insertRes.rows[0];

        if (opBal !== 0) {
          const debit = opBal > 0 ? opBal : 0;
          const credit = opBal < 0 ? Math.abs(opBal) : 0;
          await dbClient.query(`
            INSERT INTO client_transactions (
              client_id, warehouse_id, type, reference_type, reference_id,
              debit, credit, running_balance, description, transaction_date, created_by, created_at
            ) VALUES ($1, $2, 'OPENING_BALANCE', 'CLIENT', $1, $3, $4, $5, 'Solde d''ouverture initial', NOW(), $6, NOW())
          `, [newClient.id, targetWhId, debit, credit, opBal, req.user?.id || 1]);
        }

        return newClient;
      } else {
        const existing = await dbClient.query('SELECT id FROM clients WHERE code = $1', [clientCode]);
        if (existing.rowCount && existing.rowCount > 0) {
          throw new Error(`Un client avec le code ${clientCode} existe déjà`);
        }

        const insertRes = await dbClient.query(`
          INSERT INTO clients (code, name, phone, email, address, opening_balance, current_balance, is_default, active)
          VALUES ($1, $2, $3, $4, $5, $6, $6, FALSE, TRUE)
          RETURNING *
        `, [clientCode, name.trim(), phone || '', email || '', address || '', opBal]);
        const newClient = insertRes.rows[0];

        if (opBal !== 0) {
          const debit = opBal > 0 ? opBal : 0;
          const credit = opBal < 0 ? Math.abs(opBal) : 0;
          await dbClient.query(`
            INSERT INTO client_transactions (
              client_id, warehouse_id, type, reference_type, reference_id,
              debit, credit, running_balance, description, transaction_date, created_by, created_at
            ) VALUES ($1, $2, 'OPENING_BALANCE', 'CLIENT', $1, $3, $4, $5, 'Solde d''ouverture initial', NOW(), $6, NOW())
          `, [newClient.id, targetWhId, debit, credit, opBal, req.user?.id || 1]);
        }

        return newClient;
      }
    });

    await logAudit(req.user, 'CLIENT_CREATED', 'CLIENT', result.id, `Création client ${result.name} (${result.code})`);
    return sendSuccess(res, mapClientRow(result), 'Client créé avec succès', 201);
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

// PUT /api/clients/:id - Update client info
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, phone, email, address, active } = req.body;

    const currentRes = await query('SELECT * FROM clients WHERE id = $1', [id]);
    const current = currentRes.rows[0];
    if (!current) {
      return sendError(res, `Client not found with id ${id}`, 404);
    }

    const updatedName = name !== undefined ? name.trim() : current.name;
    const updatedPhone = phone !== undefined ? phone : current.phone;
    const updatedEmail = email !== undefined ? email : current.email;
    const updatedAddress = address !== undefined ? address : current.address;
    const updatedActive = active !== undefined ? Boolean(active) : Boolean(current.active);

    const updateRes = await query(`
      UPDATE clients
      SET name = $1, phone = $2, email = $3, address = $4, active = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [updatedName, updatedPhone, updatedEmail, updatedAddress, updatedActive, id]);

    const updated = updateRes.rows[0];
    await logAudit(req.user, 'CLIENT_UPDATED', 'CLIENT', id, `Mise à jour client ${updatedName} (${current.code})`);
    return sendSuccess(res, mapClientRow(updated), 'Client mis à jour avec succès');
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

// GET /api/clients/:id/statement - Statement of Account (Extrait de Compte)
router.get('/:id/statement', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const clientRes = await query('SELECT * FROM clients WHERE id = $1', [id]);
    const client = clientRes.rows[0];
    if (!client) {
      return sendError(res, `Client not found with id ${id}`, 404);
    }

    // 1. Calculate Period Opening Balance (transactions before startDate)
    let periodOpeningBalance = 0;
    if (startDate) {
      const priorParams: any[] = [id, `${startDate} 00:00:00`];
      let priorSql = `
        SELECT COALESCE(SUM(debit) - SUM(credit), 0) as prior_balance
        FROM client_transactions
        WHERE client_id = $1 AND transaction_date < $2
      `;
      if (warehouseId) {
        priorParams.push(warehouseId);
        priorSql += ` AND warehouse_id = $3`;
      }
      const priorRes = await query(priorSql, priorParams);
      periodOpeningBalance = Number(priorRes.rows[0]?.prior_balance || 0);
    }

    // 2. Fetch Period Transactions
    const txParams: any[] = [id];
    const txWhere: string[] = ['t.client_id = $1'];

    if (warehouseId) {
      txParams.push(warehouseId);
      txWhere.push(`t.warehouse_id = $${txParams.length}`);
    }

    if (startDate) {
      txParams.push(`${startDate} 00:00:00`);
      txWhere.push(`t.transaction_date >= $${txParams.length}`);
    }

    if (endDate) {
      txParams.push(`${endDate} 23:59:59`);
      txWhere.push(`t.transaction_date <= $${txParams.length}`);
    }

    const txSql = `
      SELECT t.*, w.name as warehouse_name, w.code as warehouse_code, u.full_name as created_by_name
      FROM client_transactions t
      JOIN warehouses w ON t.warehouse_id = w.id
      JOIN users u ON t.created_by = u.id
      WHERE ${txWhere.join(' AND ')}
      ORDER BY t.transaction_date ASC, t.id ASC
    `;

    const txRes = await query(txSql, txParams);

    // Compute cumulative running balances for the requested period
    let currentPeriodRunning = periodOpeningBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const transactions = txRes.rows.map((row) => {
      const debit = Number(row.debit);
      const credit = Number(row.credit);
      totalDebit += debit;
      totalCredit += credit;
      currentPeriodRunning = currentPeriodRunning + debit - credit;

      return {
        id: row.id,
        clientId: row.client_id,
        warehouseId: row.warehouse_id,
        warehouseName: row.warehouse_name,
        warehouseCode: row.warehouse_code,
        type: row.type,
        referenceType: row.reference_type,
        referenceId: row.reference_id,
        debit,
        credit,
        runningBalance: currentPeriodRunning,
        storedRunningBalance: Number(row.running_balance),
        description: row.description,
        transactionDate: row.transaction_date,
        createdById: row.created_by,
        createdByName: row.created_by_name,
        createdAt: row.created_at,
      };
    });

    const closingBalance = periodOpeningBalance + totalDebit - totalCredit;

    return sendSuccess(res, {
      client: mapClientRow(client),
      filter: {
        warehouseId: warehouseId || null,
        startDate: startDate || null,
        endDate: endDate || null,
      },
      periodOpeningBalance,
      totalDebit,
      totalCredit,
      closingBalance,
      currentTotalBalance: Number(client.current_balance),
      transactions,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// GET /api/clients/:id/statement/csv - Statement CSV Export
router.get('/:id/statement/csv', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const clientRes = await query('SELECT * FROM clients WHERE id = $1', [id]);
    const client = clientRes.rows[0];
    if (!client) {
      return sendError(res, `Client not found with id ${id}`, 404);
    }

    // Reuse statement query
    let periodOpeningBalance = 0;
    if (startDate) {
      const priorParams: any[] = [id, `${startDate} 00:00:00`];
      let priorSql = `
        SELECT COALESCE(SUM(debit) - SUM(credit), 0) as prior_balance
        FROM client_transactions
        WHERE client_id = $1 AND transaction_date < $2
      `;
      if (warehouseId) {
        priorParams.push(warehouseId);
        priorSql += ` AND warehouse_id = $3`;
      }
      const priorRes = await query(priorSql, priorParams);
      periodOpeningBalance = Number(priorRes.rows[0]?.prior_balance || 0);
    }

    const txParams: any[] = [id];
    const txWhere: string[] = ['t.client_id = $1'];

    if (warehouseId) {
      txParams.push(warehouseId);
      txWhere.push(`t.warehouse_id = $${txParams.length}`);
    }
    if (startDate) {
      txParams.push(`${startDate} 00:00:00`);
      txWhere.push(`t.transaction_date >= $${txParams.length}`);
    }
    if (endDate) {
      txParams.push(`${endDate} 23:59:59`);
      txWhere.push(`t.transaction_date <= $${txParams.length}`);
    }

    const txSql = `
      SELECT t.*, w.name as warehouse_name
      FROM client_transactions t
      JOIN warehouses w ON t.warehouse_id = w.id
      WHERE ${txWhere.join(' AND ')}
      ORDER BY t.transaction_date ASC, t.id ASC
    `;

    const txRes = await query(txSql, txParams);

    let currentBalance = periodOpeningBalance;
    const rows = txRes.rows.map((row) => {
      const debit = Number(row.debit);
      const credit = Number(row.credit);
      currentBalance = currentBalance + debit - credit;
      return {
        date: new Date(row.transaction_date).toISOString().split('T')[0],
        warehouse: row.warehouse_name,
        type: row.type,
        reference: row.reference_type ? `${row.reference_type} #${row.reference_id || ''}` : '',
        description: row.description,
        debit,
        credit,
        balance: currentBalance,
      };
    });

    const columns: CsvColumn[] = [
      { header: 'Date', key: 'date' },
      { header: 'Dépôt', key: 'warehouse' },
      { header: 'Type', key: 'type' },
      { header: 'Référence', key: 'reference' },
      { header: 'Libellé', key: 'description' },
      { header: 'Débit (DZD)', key: 'debit' },
      { header: 'Crédit (DZD)', key: 'credit' },
      { header: 'Solde Progressif (DZD)', key: 'balance' },
    ];

    const csv = generateCsv(columns, rows);
    const sanitizedCode = client.code.replace(/[^a-zA-Z0-9_-]/g, '');
    const dateStr = new Date().toISOString().split('T')[0];
    return sendCsv(res, `extrait_compte_${sanitizedCode}_${dateStr}.csv`, csv);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// GET /api/clients/:id/invoices - Sales invoices for this client
router.get('/:id/invoices', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const salesRes = await query(`
      SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name,
             s.total_amount, s.paid_amount, s.payment_status, s.status,
             COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at
      FROM sales s
      JOIN warehouses w ON s.warehouse_id = w.id
      WHERE s.client_id = $1
      ORDER BY COALESCE(s.sale_date, s.created_at) DESC, s.id DESC
    `, [id]);

    const items = salesRes.rows.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoice_number,
      warehouseId: s.warehouse_id,
      warehouseName: s.warehouse_name,
      totalAmount: Number(s.total_amount),
      paidAmount: Number(s.paid_amount || 0),
      remainingAmount: Math.max(0, Number(s.total_amount) - Number(s.paid_amount || 0)),
      paymentStatus: s.payment_status || (Number(s.paid_amount) >= Number(s.total_amount) ? 'PAID' : 'UNPAID'),
      status: s.status,
      saleDate: s.sale_date,
      createdAt: s.created_at,
    }));

    return sendSuccess(res, items);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// GET /api/clients/:id/payments - Payments history for this client
router.get('/:id/payments', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const paymentsRes = await query(`
      SELECT cp.*, w.name as warehouse_name, u.full_name as created_by_name
      FROM client_payments cp
      JOIN warehouses w ON cp.warehouse_id = w.id
      JOIN users u ON cp.created_by = u.id
      WHERE cp.client_id = $1
      ORDER BY cp.payment_date DESC, cp.id DESC
    `, [id]);

    const paymentIds = paymentsRes.rows.map((p) => p.id);
    const allocationsByPaymentId: Record<number, any[]> = {};

    if (paymentIds.length > 0) {
      const allocRes = await query(`
        SELECT pa.*, s.invoice_number, s.total_amount as sale_total
        FROM payment_allocations pa
        JOIN sales s ON pa.sale_id = s.id
        WHERE pa.payment_id = ANY($1::int[])
      `, [paymentIds]);

      for (const a of allocRes.rows) {
        if (!allocationsByPaymentId[a.payment_id]) {
          allocationsByPaymentId[a.payment_id] = [];
        }
        allocationsByPaymentId[a.payment_id].push({
          id: a.id,
          saleId: a.sale_id,
          invoiceNumber: a.invoice_number,
          allocatedAmount: Number(a.allocated_amount),
          saleTotal: Number(a.sale_total),
        });
      }
    }

    const items = paymentsRes.rows.map((p) => ({
      id: p.id,
      paymentNumber: p.payment_number,
      clientId: p.client_id,
      warehouseId: p.warehouse_id,
      warehouseName: p.warehouse_name,
      amount: Number(p.amount),
      paymentMethod: p.payment_method,
      referenceNumber: p.reference_number || '',
      paymentDate: p.payment_date,
      notes: p.notes || '',
      transactionId: p.transaction_id,
      createdById: p.created_by,
      createdByName: p.created_by_name,
      createdAt: p.created_at,
      allocations: allocationsByPaymentId[p.id] || [],
    }));

    return sendSuccess(res, items);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// POST /api/clients/:id/adjustment - Manual balance adjustment (Admin / Super Manager only)
router.post('/:id/adjustment', authenticate, requireRole('ADMIN', 'SUPER_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { amount, direction, description, warehouseId } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return sendError(res, "Le montant de l'ajustement doit être strictement positif", 400);
    }
    if (!direction || (direction !== 'DEBIT' && direction !== 'CREDIT')) {
      return sendError(res, 'La direction doit être DEBIT (augmente la dette) ou CREDIT (diminue la dette)', 400);
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return sendError(res, 'Un motif détaillé est obligatoire pour tout ajustement de solde', 400);
    }

    const targetWhId = warehouseId || req.user?.warehouseId || 1;

    const result = await runTransaction(async (client) => {
      const lockRes = await client.query('SELECT id, name, code, current_balance FROM clients WHERE id = $1 FOR UPDATE', [id]);
      const current = lockRes.rows[0];
      if (!current) {
        throw new Error(`Client introuvable avec l'id ${id}`);
      }

      const prevBal = Number(current.current_balance || 0);
      const debit = direction === 'DEBIT' ? numAmount : 0;
      const credit = direction === 'CREDIT' ? numAmount : 0;
      const newBal = prevBal + debit - credit;

      const txRes = await client.query(`
        INSERT INTO client_transactions (
          client_id, warehouse_id, type, reference_type, reference_id,
          debit, credit, running_balance, description, transaction_date, created_by, created_at
        ) VALUES ($1, $2, 'ADJUSTMENT', 'MANUAL_ADJUSTMENT', NULL, $3, $4, $5, $6, NOW(), $7, NOW())
        RETURNING id
      `, [id, targetWhId, debit, credit, newBal, description.trim(), req.user?.id || 1]);

      await client.query('UPDATE clients SET current_balance = $1, updated_at = NOW() WHERE id = $2', [newBal, id]);

      return {
        transactionId: txRes.rows[0].id,
        previousBalance: prevBal,
        newBalance: newBal,
        debit,
        credit,
      };
    });

    await logAudit(
      req.user,
      'CLIENT_BALANCE_ADJUSTED',
      'CLIENT',
      id,
      `Ajustement de solde pour client #${id} (${direction} ${numAmount} DZD) : ${description.trim()}`,
      targetWhId
    );

    return sendSuccess(res, result, 'Ajustement de solde enregistré avec succès');
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

export default router;
