import { Router, Response } from 'express';
import { query, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { generateCsv, sendCsv, CsvColumn } from '../common/csv.js';
import { authenticate, AuthRequest, logAudit, validateWarehouseScope } from '../middleware/auth.js';

const router = Router();

// GET /api/client-payments - List all payments with pagination & filters
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    let baseFromWhere = `
      FROM client_payments cp
      JOIN clients c ON cp.client_id = c.id
      JOIN warehouses w ON cp.warehouse_id = w.id
      JOIN users u ON cp.created_by = u.id
    `;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouseId) {
      params.push(warehouseId);
      whereClauses.push(`cp.warehouse_id = $${params.length}`);
    } else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
      params.push(req.user.warehouseId);
      whereClauses.push(`cp.warehouse_id = $${params.length}`);
    }

    if (clientId) {
      params.push(clientId);
      whereClauses.push(`cp.client_id = $${params.length}`);
    }

    if (startDate) {
      const formattedStart = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
      params.push(formattedStart);
      whereClauses.push(`cp.payment_date >= $${params.length}`);
    }

    if (endDate) {
      const formattedEnd = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
      params.push(formattedEnd);
      whereClauses.push(`cp.payment_date <= $${params.length}`);
    }

    if (search) {
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      const p3 = params.length + 3;
      const p4 = params.length + 4;
      whereClauses.push(`(cp.payment_number ILIKE $${p1} OR c.name ILIKE $${p2} OR c.code ILIKE $${p3} OR cp.reference_number ILIKE $${p4})`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (whereClauses.length > 0) {
      baseFromWhere += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Count
    const countRes = await query(`SELECT COUNT(*) as count ${baseFromWhere}`, params);
    const total = Number(countRes.rows[0]?.count || 0);

    // Sum total collected in this filtered view
    const sumRes = await query(`SELECT COALESCE(SUM(cp.amount), 0) as total_sum ${baseFromWhere}`, params);
    const totalAmountSum = Number(sumRes.rows[0]?.total_sum || 0);

    // Select paginated
    const selectParams = [...params, limit, offset];
    const limitIdx = selectParams.length - 1;
    const offsetIdx = selectParams.length;

    const selectQuery = `
      SELECT cp.*, c.name as client_name, c.code as client_code, c.phone as client_phone,
             w.name as warehouse_name, w.code as warehouse_code,
             u.full_name as created_by_name
      ${baseFromWhere}
      ORDER BY cp.payment_date DESC, cp.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const paymentsRes = await query(selectQuery, selectParams);
    const paymentsRows = paymentsRes.rows;

    const paymentIds = paymentsRows.map((p) => p.id);
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

    const items = paymentsRows.map((p: any) => ({
      id: p.id,
      paymentNumber: p.payment_number,
      clientId: p.client_id,
      clientName: p.client_name,
      clientCode: p.client_code,
      clientPhone: p.client_phone,
      warehouseId: p.warehouse_id,
      warehouseName: p.warehouse_name,
      warehouseCode: p.warehouse_code,
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

    return sendSuccess(res, {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalAmountSum,
      },
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// GET /api/client-payments/:id - Single payment details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const paymentRes = await query(`
      SELECT cp.*, c.name as client_name, c.code as client_code, c.phone as client_phone, c.address as client_address,
             w.name as warehouse_name, w.code as warehouse_code, w.location as warehouse_location, w.contact_number as warehouse_phone,
             u.full_name as created_by_name
      FROM client_payments cp
      JOIN clients c ON cp.client_id = c.id
      JOIN warehouses w ON cp.warehouse_id = w.id
      JOIN users u ON cp.created_by = u.id
      WHERE cp.id = $1
    `, [id]);

    const p = paymentRes.rows[0];
    if (!p) {
      return sendError(res, `Payment not found with id ${id}`, 404);
    }

    const allocRes = await query(`
      SELECT pa.*, s.invoice_number, s.total_amount as sale_total, s.sale_date
      FROM payment_allocations pa
      JOIN sales s ON pa.sale_id = s.id
      WHERE pa.payment_id = $1
    `, [id]);

    const allocations = allocRes.rows.map((a) => ({
      id: a.id,
      saleId: a.sale_id,
      invoiceNumber: a.invoice_number,
      allocatedAmount: Number(a.allocated_amount),
      saleTotal: Number(a.sale_total),
      saleDate: a.sale_date,
    }));

    return sendSuccess(res, {
      id: p.id,
      paymentNumber: p.payment_number,
      clientId: p.client_id,
      clientName: p.client_name,
      clientCode: p.client_code,
      clientPhone: p.client_phone,
      clientAddress: p.client_address,
      warehouseId: p.warehouse_id,
      warehouseName: p.warehouse_name,
      warehouseCode: p.warehouse_code,
      warehousePhone: p.warehouse_phone,
      warehouseLocation: p.warehouse_location,
      amount: Number(p.amount),
      paymentMethod: p.payment_method,
      referenceNumber: p.reference_number || '',
      paymentDate: p.payment_date,
      notes: p.notes || '',
      transactionId: p.transaction_id,
      createdById: p.created_by,
      createdByName: p.created_by_name,
      createdAt: p.created_at,
      allocations,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// POST /api/client-payments - Record new payment (Versement) with ACID ledger transaction
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId, warehouseId, amount, paymentMethod, referenceNumber, paymentDate, notes, allocations } = req.body;

    const numClientId = Number(clientId);
    const numAmount = Number(amount);
    const targetWhId = Number(warehouseId) || req.user?.warehouseId || 1;

    if (!numClientId) {
      return sendError(res, 'Le client est obligatoire', 400);
    }
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return sendError(res, 'Le montant du versement doit être supérieur à 0', 400);
    }

    if (req.user) {
      try {
        validateWarehouseScope(req.user, targetWhId);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    const paymentResult = await runTransaction(async (dbClient) => {
      // 1. Lock client row
      const clientRes = await dbClient.query('SELECT id, name, code, current_balance, active FROM clients WHERE id = $1 FOR UPDATE', [numClientId]);
      const client = clientRes.rows[0];
      if (!client) {
        throw new Error(`Client introuvable avec l'id ${numClientId}`);
      }
      if (!client.active) {
        throw new Error(`Le client ${client.name} est inactif`);
      }

      // 2. Validate allocations if provided
      let totalAllocated = 0;
      if (allocations && Array.isArray(allocations) && allocations.length > 0) {
        for (const alloc of allocations) {
          const allocAmt = Number(alloc.amount);
          if (isNaN(allocAmt) || allocAmt <= 0) {
            throw new Error(`Montant d'allocation invalide pour la facture #${alloc.saleId}`);
          }
          totalAllocated += allocAmt;

          const saleRes = await dbClient.query('SELECT id, client_id, total_amount, paid_amount, status FROM sales WHERE id = $1 FOR UPDATE', [alloc.saleId]);
          const sale = saleRes.rows[0];
          if (!sale) {
            throw new Error(`Facture de vente introuvable #${alloc.saleId}`);
          }
          if (sale.status === 'CANCELLED') {
            throw new Error(`Impossible d'allouer un versement à la vente annulée #${sale.id}`);
          }
          if (Number(sale.client_id) !== numClientId) {
            throw new Error(`La facture #${sale.id} n'appartient pas au client ${client.name}`);
          }

          const currentPaid = Number(sale.paid_amount || 0);
          const saleTotal = Number(sale.total_amount);
          const remainingToPay = saleTotal - currentPaid;

          if (allocAmt > remainingToPay + 0.01) {
            throw new Error(`L'allocation (${allocAmt} DZD) dépasse le reste à payer (${remainingToPay} DZD) de la facture #${sale.id}`);
          }
        }

        if (totalAllocated > numAmount + 0.01) {
          throw new Error(`Le total alloué aux factures (${totalAllocated} DZD) dépasse le montant du versement (${numAmount} DZD)`);
        }
      }

      // 3. Generate Payment Number
      const paymentNumber = `PAY-${Date.now().toString().slice(-8)}`;
      const formattedDate = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();

      // 4. Create Payment Row (temporarily without transaction_id)
      const payInsertRes = await dbClient.query(`
        INSERT INTO client_payments (payment_number, client_id, warehouse_id, amount, payment_method, reference_number, payment_date, notes, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id
      `, [
        paymentNumber,
        numClientId,
        targetWhId,
        numAmount,
        paymentMethod || 'CASH',
        referenceNumber || '',
        formattedDate,
        notes || '',
        req.user?.id || 1,
      ]);
      const paymentId = payInsertRes.rows[0].id;

      // 5. Create Ledger Transaction (Credit increases / debt decreases)
      const prevBal = Number(client.current_balance || 0);
      const newBal = prevBal - numAmount; // Credit reduces debt / increases advance

      const methodLabel = paymentMethod === 'CHECK' ? 'Chèque' : paymentMethod === 'BANK_TRANSFER' ? 'Virement' : paymentMethod === 'CARD' ? 'Carte' : 'Espèces';
      const refDesc = referenceNumber ? ` (Réf: ${referenceNumber})` : '';
      const txDesc = `Versement ${methodLabel}${refDesc} - ${paymentNumber}`;

      const txInsertRes = await dbClient.query(`
        INSERT INTO client_transactions (
          client_id, warehouse_id, type, reference_type, reference_id,
          debit, credit, running_balance, description, transaction_date, created_by, created_at
        ) VALUES ($1, $2, 'PAYMENT', 'CLIENT_PAYMENT', $3, 0, $4, $5, $6, $7, $8, NOW())
        RETURNING id
      `, [
        numClientId,
        targetWhId,
        paymentId,
        numAmount,
        newBal,
        txDesc,
        formattedDate,
        req.user?.id || 1,
      ]);
      const transactionId = txInsertRes.rows[0].id;

      // Link payment to transaction
      await dbClient.query('UPDATE client_payments SET transaction_id = $1 WHERE id = $2', [transactionId, paymentId]);

      // 6. Update Client Cached Balance
      await dbClient.query('UPDATE clients SET current_balance = $1, updated_at = NOW() WHERE id = $2', [newBal, numClientId]);

      // 7. Insert Allocations and update sales paid_amount / payment_status
      if (allocations && Array.isArray(allocations) && allocations.length > 0) {
        for (const alloc of allocations) {
          const allocAmt = Number(alloc.amount);
          await dbClient.query(`
            INSERT INTO payment_allocations (payment_id, sale_id, allocated_amount)
            VALUES ($1, $2, $3)
          `, [paymentId, alloc.saleId, allocAmt]);

          const saleRes = await dbClient.query('SELECT total_amount, paid_amount FROM sales WHERE id = $1', [alloc.saleId]);
          const sale = saleRes.rows[0];
          const newPaid = Number(sale.paid_amount || 0) + allocAmt;
          const totalAmt = Number(sale.total_amount);
          const newStatus = newPaid >= totalAmt ? 'PAID' : (newPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

          await dbClient.query(`
            UPDATE sales SET paid_amount = $1, payment_status = $2, updated_at = NOW()
            WHERE id = $3
          `, [newPaid, newStatus, alloc.saleId]);
        }
      }

      return {
        id: paymentId,
        paymentNumber,
        clientId: numClientId,
        clientName: client.name,
        amount: numAmount,
        previousBalance: prevBal,
        newBalance: newBal,
        transactionId,
        paymentDate: formattedDate,
      };
    });

    await logAudit(
      req.user,
      'CLIENT_PAYMENT_RECORDED',
      'CLIENT_PAYMENT',
      paymentResult.id,
      `Versement de ${numAmount} DZD enregistré pour le client ${paymentResult.clientName} (${paymentResult.paymentNumber})`,
      targetWhId
    );

    return sendSuccess(res, paymentResult, 'Versement enregistré avec succès', 201);
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

export default router;
