import { Router } from 'express';
import { query, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { generateCsv, sendCsv, CsvColumn } from '../common/csv.js';
import { authenticate, requireRole, AuthRequest, logAudit, validateWarehouseScope, enforceWarehouseScope, validateOriginWarehouseScope } from '../middleware/auth.js';
import {
  createStockReservation,
  releaseStockReservation,
  fulfillStockReservation,
  reassignReservationWarehouse,
  checkAndExpireReservations,
} from '../common/reservation.js';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const requestedWarehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const warehouseId = enforceWarehouseScope(req.user, requestedWarehouseId);
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const paymentStatus = req.query.paymentStatus as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    let baseFromWhere = `
      FROM sales s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN employees e ON s.employee_id = e.id
      LEFT JOIN clients cl ON s.client_id = cl.id
    `;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouseId) {
      params.push(warehouseId);
      whereClauses.push(`s.warehouse_id = $${params.length}`);
    }

    if (clientId) {
      params.push(clientId);
      whereClauses.push(`s.client_id = $${params.length}`);
    }

    if (paymentStatus) {
      params.push(paymentStatus);
      whereClauses.push(`s.payment_status = $${params.length}`);
    }

    if (startDate) {
      const formattedStart = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
      params.push(formattedStart);
      whereClauses.push(`COALESCE(s.sale_date, s.created_at) >= $${params.length}`);
    }

    if (endDate) {
      const formattedEnd = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
      params.push(formattedEnd);
      whereClauses.push(`COALESCE(s.sale_date, s.created_at) <= $${params.length}`);
    }

    if (search) {
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      const p3 = params.length + 3;
      const p4 = params.length + 4;
      const p5 = params.length + 5;
      const p6 = params.length + 6;
      whereClauses.push(`(s.invoice_number ILIKE $${p1} OR s.customer_name ILIKE $${p2} OR s.customer_phone ILIKE $${p3} OR cl.name ILIKE $${p4} OR cl.code ILIKE $${p5} OR w.name ILIKE $${p6})`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (whereClauses.length > 0) {
      baseFromWhere += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Count total matching records
    const countQuery = `SELECT COUNT(*) as count ${baseFromWhere}`;
    const countRes = await query(countQuery, params);
    const total = Number(countRes.rows[0]?.count || 0);

    // Fetch paginated slice
    const selectParams = [...params, limit, offset];
    const limitIdx = selectParams.length - 1;
    const offsetIdx = selectParams.length;

    const selectQuery = `
      SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
             w.location as warehouse_address, w.contact_number as warehouse_phone,
             s.user_id, u.full_name as user_name, s.employee_id, e.full_name as employee_name,
             s.client_id, cl.name as client_name, cl.code as client_code,
             s.customer_name, s.customer_phone,
             s.total_amount, s.paid_amount, s.advance_deducted, s.payment_status, s.status,
             COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at, s.updated_at
      ${baseFromWhere}
      ORDER BY COALESCE(s.sale_date, s.created_at) DESC, s.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const salesRes = await query(selectQuery, selectParams);
    const salesRows = salesRes.rows;

    // Batch-fetch line items for the paginated slice
    const saleIds = salesRows.map((s) => s.id);
    const itemsBySaleId: Record<number, any[]> = {};

    if (saleIds.length > 0) {
      const itemsRes = await query(`
        SELECT si.id, si.sale_id, si.product_id, p.name as product_name, p.reference as product_reference,
               p.box_size as product_box_size,
               si.quantity, si.unit_price, si.subtotal
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ANY($1::int[])
      `, [saleIds]);

      for (const item of itemsRes.rows) {
        if (!itemsBySaleId[item.sale_id]) {
          itemsBySaleId[item.sale_id] = [];
        }
        itemsBySaleId[item.sale_id].push({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          productReference: item.product_reference,
          productBoxSize: Number(item.product_box_size || 0),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          subtotal: Number(item.subtotal),
        });
      }
    }

    const items = salesRows.map((s: any) => ({
      id: s.id,
      invoiceNumber: s.invoice_number,
      warehouseId: s.warehouse_id,
      warehouseName: s.warehouse_name,
      warehouseCode: s.warehouse_code,
      warehousePhone: s.warehouse_phone || '',
      warehouseAddress: s.warehouse_address || '',
      userId: s.user_id,
      userName: s.user_name,
      createdById: s.user_id,
      createdByName: s.user_name,
      employeeId: s.employee_id,
      employeeName: s.employee_name,
      clientId: s.client_id,
      clientName: s.client_name,
      clientCode: s.client_code,
      customerName: s.customer_name || s.client_name || 'Client',
      customerPhone: s.customer_phone,
      totalAmount: Number(s.total_amount),
      paidAmount: Number(s.paid_amount || 0),
      advanceDeducted: Number(s.advance_deducted || 0),
      remainingAmount: Math.max(0, Number(s.total_amount) - Number(s.paid_amount || 0)),
      paymentStatus: s.payment_status || (Number(s.paid_amount) >= Number(s.total_amount) ? 'PAID' : 'UNPAID'),
      status: s.status,
      saleDate: s.sale_date || s.created_at,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      items: itemsBySaleId[s.id] || [],
    }));

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
    const isAccessDenied = err.message?.includes('Access denied');
    return sendError(res, err.message, isAccessDenied ? 403 : 500);
  }
});

router.get('/export/csv', authenticate, async (req: AuthRequest, res) => {
  try {
    const requestedWarehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const warehouseId = enforceWarehouseScope(req.user, requestedWarehouseId);
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const paymentStatus = req.query.paymentStatus as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();

    let baseFromWhere = `
      FROM sales s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN employees e ON s.employee_id = e.id
      LEFT JOIN clients cl ON s.client_id = cl.id
    `;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouseId) {
      params.push(warehouseId);
      whereClauses.push(`s.warehouse_id = $${params.length}`);
    }

    if (clientId) {
      params.push(clientId);
      whereClauses.push(`s.client_id = $${params.length}`);
    }

    if (paymentStatus) {
      params.push(paymentStatus);
      whereClauses.push(`s.payment_status = $${params.length}`);
    }

    if (startDate) {
      const formattedStart = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
      params.push(formattedStart);
      whereClauses.push(`COALESCE(s.sale_date, s.created_at) >= $${params.length}`);
    }

    if (endDate) {
      const formattedEnd = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
      params.push(formattedEnd);
      whereClauses.push(`COALESCE(s.sale_date, s.created_at) <= $${params.length}`);
    }

    if (search) {
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      const p3 = params.length + 3;
      const p4 = params.length + 4;
      const p5 = params.length + 5;
      const p6 = params.length + 6;
      whereClauses.push(`(s.invoice_number ILIKE $${p1} OR s.customer_name ILIKE $${p2} OR s.customer_phone ILIKE $${p3} OR cl.name ILIKE $${p4} OR cl.code ILIKE $${p5} OR w.name ILIKE $${p6})`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (whereClauses.length > 0) {
      baseFromWhere += ' WHERE ' + whereClauses.join(' AND ');
    }

    const selectQuery = `
      SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
             s.user_id, u.full_name as user_name, s.employee_id, e.full_name as employee_name,
             s.client_id, cl.name as client_name, cl.code as client_code,
             s.customer_name, s.customer_phone,
             s.total_amount, s.paid_amount, s.payment_status, s.status,
             COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at
      ${baseFromWhere}
      ORDER BY COALESCE(s.sale_date, s.created_at) DESC, s.id DESC
    `;

    const salesRes = await query(selectQuery, params);
    const salesRows = salesRes.rows;

    const saleIds = salesRows.map((s) => s.id);
    const itemsBySaleId: Record<number, string[]> = {};

    if (saleIds.length > 0) {
      const itemsRes = await query(`
        SELECT si.sale_id, p.name as product_name, si.quantity, si.unit_price, si.subtotal
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ANY($1::int[])
      `, [saleIds]);

      for (const item of itemsRes.rows) {
        if (!itemsBySaleId[item.sale_id]) {
          itemsBySaleId[item.sale_id] = [];
        }
        itemsBySaleId[item.sale_id].push(`${item.product_name} (x${item.quantity})`);
      }
    }

    const columns: CsvColumn[] = [
      { header: 'N° Facture', key: 'invoice_number' },
      { header: 'Date Vente', key: 'sale_date' },
      { header: 'Dépôt', key: 'warehouse_name' },
      { header: 'Client', format: (s) => s.client_name || s.customer_name || 'Comptoir' },
      { header: 'Code Client', format: (s) => s.client_code || '-' },
      { header: 'Téléphone', key: 'customer_phone' },
      { header: 'Émis par', key: 'user_name' },
      { header: 'Agent de suivi', format: (s) => s.employee_name || 'Non spécifié' },
      { header: 'Montant Total (DZD)', key: 'total_amount' },
      { header: 'Montant Payé (DZD)', key: 'paid_amount' },
      {
        header: 'Statut Paiement',
        format: (s) => (s.payment_status === 'PAID' ? 'Payée' : s.payment_status === 'PARTIALLY_PAID' ? 'Partielle' : 'Non payée'),
      },
      {
        header: 'Statut Vente',
        format: (s) => (s.status === 'COMPLETED' ? 'Complétée' : s.status === 'CANCELLED' ? 'Annulée' : s.status),
      },
      { header: 'Articles', format: (s) => (itemsBySaleId[s.id] || []).join(' ; ') },
      { header: 'Date Enregistrement', key: 'created_at' },
    ];

    const csv = generateCsv(columns, salesRows);
    const dateStr = new Date().toISOString().split('T')[0];
    return sendCsv(res, `ventes_${dateStr}.csv`, csv);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.get('/fulfillment-lines/pending', authenticate, async (req: AuthRequest, res) => {
  try {
    await checkAndExpireReservations();

    const requestedWarehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const warehouseId = enforceWarehouseScope(req.user, requestedWarehouseId);
    const search = (req.query.search as string | undefined)?.trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    let baseWhere = `
      FROM sale_fulfillment_lines fl
      JOIN sales s ON fl.sale_id = s.id
      JOIN products p ON fl.product_id = p.id
      JOIN warehouses ow ON fl.origin_warehouse_id = ow.id
      JOIN warehouses fw ON fl.fulfillment_warehouse_id = fw.id
      JOIN warehouses pw ON fl.payment_warehouse_id = pw.id
      LEFT JOIN stock_reservations sr ON sr.fulfillment_line_id = fl.id AND sr.status = 'ACTIVE'
      LEFT JOIN clients cl ON s.client_id = cl.id
      WHERE fl.fulfillment_status = 'PENDING_PICKUP'
    `;
    const params: any[] = [];

    if (warehouseId) {
      params.push(warehouseId);
      baseWhere += ` AND fl.fulfillment_warehouse_id = $${params.length}`;
    }

    if (search) {
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      const p3 = params.length + 3;
      const p4 = params.length + 4;
      const p5 = params.length + 5;
      baseWhere += ` AND (s.invoice_number ILIKE $${p1} OR fl.pickup_voucher_code ILIKE $${p2} OR s.customer_name ILIKE $${p3} OR cl.name ILIKE $${p4} OR p.name ILIKE $${p5})`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    const countRes = await query(`SELECT COUNT(*) as count ${baseWhere}`, params);
    const total = Number(countRes.rows[0]?.count || 0);

    const selectParams = [...params, limit, offset];
    const limitIdx = selectParams.length - 1;
    const offsetIdx = selectParams.length;

    const selectQuery = `
      SELECT fl.id, fl.sale_id, s.invoice_number, s.customer_name, s.customer_phone,
             s.client_id, cl.name as client_name, cl.code as client_code,
             fl.product_id, p.name as product_name, p.reference as product_reference, p.box_size as product_box_size,
             fl.quantity, fl.unit_price, fl.subtotal,
             fl.origin_warehouse_id, ow.name as origin_warehouse_name,
             fl.fulfillment_warehouse_id, fw.name as fulfillment_warehouse_name,
             fl.payment_warehouse_id, pw.name as payment_warehouse_name,
             fl.fulfillment_status, fl.payment_status, fl.pickup_voucher_code,
             sr.id as reservation_id, sr.reserved_quantity, sr.expires_at as reservation_expires_at,
             fl.created_at, fl.updated_at
      ${baseWhere}
      ORDER BY fl.created_at DESC, fl.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await query(selectQuery, selectParams);
    const items = result.rows.map((r: any) => ({
      id: r.id,
      saleId: r.sale_id,
      invoiceNumber: r.invoice_number,
      customerName: r.customer_name || r.client_name || 'Client',
      customerPhone: r.customer_phone || '',
      clientId: r.client_id,
      clientName: r.client_name,
      clientCode: r.client_code,
      productId: r.product_id,
      productName: r.product_name,
      productReference: r.product_reference,
      productBoxSize: Number(r.product_box_size || 0),
      quantity: Number(r.quantity),
      unitPrice: Number(r.unit_price),
      subtotal: Number(r.subtotal),
      originWarehouseId: r.origin_warehouse_id,
      originWarehouseName: r.origin_warehouse_name,
      fulfillmentWarehouseId: r.fulfillment_warehouse_id,
      fulfillmentWarehouseName: r.fulfillment_warehouse_name,
      paymentWarehouseId: r.payment_warehouse_id,
      paymentWarehouseName: r.payment_warehouse_name,
      fulfillmentStatus: r.fulfillment_status,
      paymentStatus: r.payment_status,
      pickupVoucherCode: r.pickup_voucher_code,
      reservationId: r.reservation_id,
      reservedQuantity: Number(r.reserved_quantity || r.quantity),
      reservationExpiresAt: r.reservation_expires_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

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

router.get('/fulfillment-lines/pending-count', authenticate, async (req: AuthRequest, res) => {
  try {
    await checkAndExpireReservations();
    const requestedWarehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const warehouseId = enforceWarehouseScope(req.user, requestedWarehouseId);

    let sql = `SELECT COUNT(*) as count FROM sale_fulfillment_lines WHERE fulfillment_status = 'PENDING_PICKUP'`;
    const params: any[] = [];
    if (warehouseId) {
      params.push(warehouseId);
      sql += ` AND fulfillment_warehouse_id = $1`;
    }
    const r = await query(sql, params);
    return sendSuccess(res, { count: Number(r.rows[0]?.count || 0) });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.post('/fulfillment-lines/:id/fulfill', authenticate, async (req: AuthRequest, res) => {
  try {
    const lineId = Number(req.params.id);
    const { paymentMethod } = req.body;

    const result = await runTransaction(async (client) => {
      const lineRes = await client.query(`
        SELECT fl.*, s.invoice_number, s.client_id, s.customer_name, s.paid_amount, s.total_amount
        FROM sale_fulfillment_lines fl
        JOIN sales s ON fl.sale_id = s.id
        WHERE fl.id = $1 FOR UPDATE
      `, [lineId]);

      const line = lineRes.rows[0];
      if (!line) {
        throw new Error(`Ligne de retrait introuvable avec l'identifiant ${lineId}`);
      }

      if (req.user) {
        validateWarehouseScope(req.user, line.fulfillment_warehouse_id);
      }

      if (line.fulfillment_status !== 'PENDING_PICKUP') {
        throw new Error(`Impossible de délivrer cette ligne : statut actuel '${line.fulfillment_status}'`);
      }

      // 1. Fulfill stock reservation and decrement physical stock
      await fulfillStockReservation(client, lineId);

      // 2. Insert stock movement at fulfillment warehouse
      await client.query(`
        INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
        VALUES ($1, $2, 'SALE', $3, $4, $5)
      `, [line.fulfillment_warehouse_id, line.product_id, -Number(line.quantity), line.invoice_number, `Inter-warehouse pickup fulfillment (Voucher ${line.pickup_voucher_code})`]);

      // 3. Handle payment collection if needed
      let linePaidAmount = 0;
      if (line.payment_status === 'COLLECT_ON_PICKUP') {
        linePaidAmount = Number(line.subtotal);
        const payNumber = `PAY-${Date.now().toString().slice(-8)}`;

        if (line.client_id) {
          const payRes = await client.query(`
            INSERT INTO client_payments (
              payment_number, client_id, warehouse_id, amount, payment_method,
              reference_number, payment_date, notes, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, NOW())
            RETURNING id
          `, [
            payNumber,
            line.client_id,
            line.fulfillment_warehouse_id,
            linePaidAmount,
            paymentMethod || 'CASH',
            line.invoice_number,
            `Encaissement au retrait vente ${line.invoice_number} (Bon ${line.pickup_voucher_code})`,
            req.user?.id || 1,
          ]);
          const paymentId = payRes.rows[0].id;

          await client.query(`
            INSERT INTO payment_allocations (payment_id, sale_id, allocated_amount)
            VALUES ($1, $2, $3)
          `, [paymentId, line.sale_id, linePaidAmount]);
        }

        // Update line payment status
        await client.query(`
          UPDATE sale_fulfillment_lines
          SET payment_status = 'PAID'
          WHERE id = $1
        `, [lineId]);

        // Update parent sale paid amount and payment status
        const newSalePaid = Number(line.paid_amount || 0) + linePaidAmount;
        const newPayStatus = newSalePaid >= Number(line.total_amount) ? 'PAID' : (newSalePaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
        await client.query(`
          UPDATE sales
          SET paid_amount = $1, payment_status = $2, updated_at = NOW()
          WHERE id = $3
        `, [newSalePaid, newPayStatus, line.sale_id]);
      }

      // 4. Update fulfillment line status
      await client.query(`
        UPDATE sale_fulfillment_lines
        SET fulfillment_status = 'FULFILLED', fulfilled_at = NOW(), fulfilled_by_user_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [req.user?.id || 1, lineId]);

      // 5. Check if all lines of the parent sale are now fulfilled
      const remainingPending = await client.query(`
        SELECT COUNT(*) as count FROM sale_fulfillment_lines
        WHERE sale_id = $1 AND fulfillment_status = 'PENDING_PICKUP'
      `, [line.sale_id]);

      if (Number(remainingPending.rows[0]?.count || 0) === 0) {
        await client.query(`
          UPDATE sales SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1
        `, [line.sale_id]);
      }

      return { lineId, status: 'FULFILLED', saleId: line.sale_id };
    });

    await logAudit(req.user, 'FULFILLMENT_LINE_FULFILLED', 'SALE_FULFILLMENT_LINE', lineId, `Fulfilled pickup line for voucher`, req.user?.warehouseId);
    return sendSuccess(res, result, 'Articles délivrés et stock mis à jour avec succès');
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

router.post('/fulfillment-lines/:id/cancel', authenticate, async (req: AuthRequest, res) => {
  try {
    const lineId = Number(req.params.id);
    const result = await runTransaction(async (client) => {
      const lineRes = await client.query(`
        SELECT fl.*, s.invoice_number, s.client_id, s.total_amount
        FROM sale_fulfillment_lines fl
        JOIN sales s ON fl.sale_id = s.id
        WHERE fl.id = $1 FOR UPDATE
      `, [lineId]);

      const line = lineRes.rows[0];
      if (!line) throw new Error(`Ligne introuvable avec l'id ${lineId}`);

      if (req.user && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_MANAGER') {
        if (Number(req.user.warehouseId) !== Number(line.origin_warehouse_id) && Number(req.user.warehouseId) !== Number(line.fulfillment_warehouse_id)) {
          throw new Error('Access denied: You cannot cancel this fulfillment line');
        }
      }

      if (line.fulfillment_status !== 'PENDING_PICKUP') {
        throw new Error(`Impossible d'annuler une ligne au statut '${line.fulfillment_status}'`);
      }

      // Release reservation
      const resQuery = await client.query(
        "SELECT id FROM stock_reservations WHERE fulfillment_line_id = $1 AND status = 'ACTIVE'",
        [lineId]
      );
      if (resQuery.rows[0]) {
        await releaseStockReservation(client, resQuery.rows[0].id, 'CANCELLED');
      }

      // Update line
      await client.query(`
        UPDATE sale_fulfillment_lines
        SET fulfillment_status = 'CANCELLED', updated_at = NOW()
        WHERE id = $1
      `, [lineId]);

      // Recompute parent status
      const linesCheck = await client.query(`
        SELECT fulfillment_status, subtotal FROM sale_fulfillment_lines WHERE sale_id = $1
      `, [line.sale_id]);

      const activeFulfilled = linesCheck.rows.filter((l: any) => l.fulfillment_status === 'FULFILLED');
      const activePending = linesCheck.rows.filter((l: any) => l.fulfillment_status === 'PENDING_PICKUP');

      let parentStatus = 'CANCELLED';
      if (activeFulfilled.length > 0 && activePending.length > 0) {
        parentStatus = 'PARTIALLY_CANCELLED';
      } else if (activeFulfilled.length > 0 && activePending.length === 0) {
        parentStatus = 'PARTIALLY_CANCELLED';
      } else if (activeFulfilled.length === 0 && activePending.length === 0) {
        parentStatus = 'CANCELLED';
      }

      await client.query('UPDATE sales SET status = $1, updated_at = NOW() WHERE id = $2', [parentStatus, line.sale_id]);

      return { lineId, status: 'CANCELLED', parentStatus };
    });

    return sendSuccess(res, result, 'Ligne de retrait annulée avec succès');
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

router.put('/fulfillment-lines/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const lineId = Number(req.params.id);
    const { quantity, fulfillmentWarehouseId, paymentStatus } = req.body;

    const result = await runTransaction(async (client) => {
      const lineRes = await client.query(`
        SELECT fl.*, s.invoice_number, s.total_amount
        FROM sale_fulfillment_lines fl
        JOIN sales s ON fl.sale_id = s.id
        WHERE fl.id = $1 FOR UPDATE
      `, [lineId]);

      const line = lineRes.rows[0];
      if (!line) throw new Error(`Ligne introuvable avec l'id ${lineId}`);

      if (line.fulfillment_status !== 'PENDING_PICKUP') {
        throw new Error('Une ligne déjà délivrée ou clôturée ne peut pas être modifiée');
      }

      // Reassign destination warehouse
      if (fulfillmentWarehouseId && Number(fulfillmentWarehouseId) !== Number(line.fulfillment_warehouse_id)) {
        await reassignReservationWarehouse(client, lineId, Number(fulfillmentWarehouseId), 120);
        await client.query(`
          UPDATE sale_fulfillment_lines
          SET fulfillment_warehouse_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [Number(fulfillmentWarehouseId), lineId]);
      }

      // Update quantity
      if (quantity && Number(quantity) !== Number(line.quantity)) {
        const newQty = Number(quantity);
        if (newQty <= 0) throw new Error('La quantité doit être supérieure à 0');

        // Cancel old reservation
        const resQuery = await client.query(
          "SELECT id FROM stock_reservations WHERE fulfillment_line_id = $1 AND status = 'ACTIVE'",
          [lineId]
        );
        if (resQuery.rows[0]) {
          await releaseStockReservation(client, resQuery.rows[0].id, 'CANCELLED');
        }

        // Target warehouse
        const targetWh = fulfillmentWarehouseId ? Number(fulfillmentWarehouseId) : line.fulfillment_warehouse_id;
        await createStockReservation(client, {
          fulfillmentLineId: lineId,
          warehouseId: targetWh,
          productId: line.product_id,
          quantity: newQty,
          ttlHours: 120,
        });

        const newSubtotal = newQty * Number(line.unit_price);
        await client.query(`
          UPDATE sale_fulfillment_lines
          SET quantity = $1, subtotal = $2, updated_at = NOW()
          WHERE id = $3
        `, [newQty, newSubtotal, lineId]);

        // Recompute parent total
        const sumRes = await client.query('SELECT SUM(subtotal) as total FROM sale_fulfillment_lines WHERE sale_id = $1', [line.sale_id]);
        const newTotal = Number(sumRes.rows[0]?.total || 0);
        await client.query('UPDATE sales SET total_amount = $1, updated_at = NOW() WHERE id = $2', [newTotal, line.sale_id]);
      }

      // Update payment mode
      if (paymentStatus && paymentStatus !== line.payment_status) {
        await client.query(`
          UPDATE sale_fulfillment_lines
          SET payment_status = $1, updated_at = NOW()
          WHERE id = $2
        `, [paymentStatus, lineId]);
      }

      return { lineId, updated: true };
    });

    return sendSuccess(res, result, 'Ligne de retrait mise à jour avec succès');
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const saleRes = await query(`
      SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
             w.location as warehouse_address, w.contact_number as warehouse_phone,
             s.origin_warehouse_id, ow.name as origin_warehouse_name,
             s.has_inter_warehouse_fulfillment,
             s.user_id, u.full_name as user_name, s.employee_id, e.full_name as employee_name,
             s.client_id, cl.name as client_name, cl.code as client_code, cl.address as client_address,
             s.customer_name, s.customer_phone,
             s.total_amount, s.paid_amount, s.advance_deducted, s.payment_status, s.status,
             COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at, s.updated_at
      FROM sales s
      JOIN warehouses w ON s.warehouse_id = w.id
      LEFT JOIN warehouses ow ON s.origin_warehouse_id = ow.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN employees e ON s.employee_id = e.id
      LEFT JOIN clients cl ON s.client_id = cl.id
      WHERE s.id = $1
    `, [id]);

    const s = saleRes.rows[0];
    if (!s) {
      return sendError(res, `Sale not found with id ${id}`, 404);
    }

    if (req.user) {
      try {
        validateWarehouseScope(req.user, s.warehouse_id);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    const itemsRes = await query(`
      SELECT si.id, si.product_id, p.name as product_name, p.reference as product_reference,
             p.box_size as product_box_size,
             si.quantity, si.unit_price, si.subtotal
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = $1
    `, [s.id]);

    const items = itemsRes.rows.map((i: any) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      productReference: i.product_reference,
      productBoxSize: Number(i.product_box_size || 0),
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      subtotal: Number(i.subtotal),
    }));

    // Fetch fulfillment lines if any
    const flRes = await query(`
      SELECT fl.*, p.name as product_name, p.reference as product_reference,
             ow.name as origin_warehouse_name, fw.name as fulfillment_warehouse_name, pw.name as payment_warehouse_name,
             sr.id as reservation_id, sr.reserved_quantity, sr.status as reservation_status, sr.expires_at as reservation_expires_at
      FROM sale_fulfillment_lines fl
      JOIN products p ON fl.product_id = p.id
      JOIN warehouses ow ON fl.origin_warehouse_id = ow.id
      JOIN warehouses fw ON fl.fulfillment_warehouse_id = fw.id
      JOIN warehouses pw ON fl.payment_warehouse_id = pw.id
      LEFT JOIN stock_reservations sr ON sr.fulfillment_line_id = fl.id AND sr.status = 'ACTIVE'
      WHERE fl.sale_id = $1
      ORDER BY fl.id ASC
    `, [s.id]);

    const fulfillmentLines = flRes.rows.map((fl: any) => ({
      id: fl.id,
      saleId: fl.sale_id,
      productId: fl.product_id,
      productName: fl.product_name,
      productReference: fl.product_reference,
      quantity: Number(fl.quantity),
      unitPrice: Number(fl.unit_price),
      subtotal: Number(fl.subtotal),
      originWarehouseId: fl.origin_warehouse_id,
      originWarehouseName: fl.origin_warehouse_name,
      fulfillmentWarehouseId: fl.fulfillment_warehouse_id,
      fulfillmentWarehouseName: fl.fulfillment_warehouse_name,
      paymentWarehouseId: fl.payment_warehouse_id,
      paymentWarehouseName: fl.payment_warehouse_name,
      fulfillmentStatus: fl.fulfillment_status,
      paymentStatus: fl.payment_status,
      pickupVoucherCode: fl.pickup_voucher_code,
      fulfilledAt: fl.fulfilled_at,
      reservationId: fl.reservation_id,
      reservedQuantity: Number(fl.reserved_quantity || fl.quantity),
      reservationExpiresAt: fl.reservation_expires_at,
      createdAt: fl.created_at,
      updatedAt: fl.updated_at,
    }));

    return sendSuccess(res, {
      id: s.id,
      invoiceNumber: s.invoice_number,
      warehouseId: s.warehouse_id,
      warehouseName: s.warehouse_name,
      warehouseCode: s.warehouse_code,
      originWarehouseId: s.origin_warehouse_id,
      originWarehouseName: s.origin_warehouse_name,
      hasInterWarehouseFulfillment: Boolean(s.has_inter_warehouse_fulfillment),
      warehousePhone: s.warehouse_phone || '',
      warehouseAddress: s.warehouse_address || '',
      userId: s.user_id,
      userName: s.user_name,
      createdById: s.user_id,
      createdByName: s.user_name,
      employeeId: s.employee_id,
      employeeName: s.employee_name,
      clientId: s.client_id,
      clientName: s.client_name,
      clientCode: s.client_code,
      clientAddress: s.client_address,
      customerName: s.customer_name || s.client_name || 'Client',
      customerPhone: s.customer_phone,
      totalAmount: Number(s.total_amount),
      paidAmount: Number(s.paid_amount || 0),
      advanceDeducted: Number(s.advance_deducted || 0),
      remainingAmount: Math.max(0, Number(s.total_amount) - Number(s.paid_amount || 0)),
      paymentStatus: s.payment_status || (Number(s.paid_amount) >= Number(s.total_amount) ? 'PAID' : 'UNPAID'),
      saleDate: s.sale_date || s.created_at,
      status: s.status,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      items,
      fulfillmentLines,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

function normalizeSaleDate(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  let str = input.trim();
  if (!str) return null;
  str = str.replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(str)) {
    str += ':00';
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    str += ' 00:00:00';
  }
  if (str.length > 19) {
    str = str.slice(0, 19);
  }
  return str;
}

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      warehouseId,
      employeeId,
      clientId,
      customerName,
      customerPhone,
      saleDate,
      items,
      paymentCondition, // 'FULL_CASH' | 'CREDIT' | 'PARTIAL_DOWNPAYMENT'
      downpaymentAmount,
      paymentMethod,
      useAdvanceCredit,
      fulfillmentAllocations, // Optional FulfillmentAllocationInput[]
    } = req.body;

    const targetWarehouseId = warehouseId || req.user?.warehouseId;
    if (!targetWarehouseId || !items || !Array.isArray(items) || items.length === 0) {
      return sendError(res, 'warehouseId and non-empty items array are required', 400);
    }

    if (req.user) {
      try {
        validateWarehouseScope(req.user, targetWarehouseId);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    // Validate warehouse
    const whRes = await query('SELECT id, name, active FROM warehouses WHERE id = $1', [targetWarehouseId]);
    const targetWh = whRes.rows[0];
    if (!targetWh || !targetWh.active) {
      return sendError(res, `Impossible de créer une vente : l'entrepôt (${targetWh ? targetWh.name : targetWarehouseId}) est inactif`, 400);
    }

    const hasAllocations = Boolean(fulfillmentAllocations && Array.isArray(fulfillmentAllocations) && fulfillmentAllocations.length > 0);
    const hasInterWarehouse = hasAllocations && fulfillmentAllocations.some((a: any) => Number(a.fulfillmentWarehouseId) !== Number(targetWarehouseId));

    if (hasInterWarehouse && req.user) {
      try {
        validateOriginWarehouseScope(req.user, targetWarehouseId);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    // Validate employee if provided
    if (employeeId) {
      const empRes = await query('SELECT id, full_name, status, active, warehouse_id FROM employees WHERE id = $1', [Number(employeeId)]);
      const emp = empRes.rows[0];
      if (!emp) {
        return sendError(res, `Employé non trouvé avec l'identifiant ${employeeId}`, 400);
      }
      if (emp.warehouse_id !== targetWarehouseId) {
        return sendError(res, `L'employé ${emp.full_name} n'est pas affecté à cet entrepôt`, 400);
      }
      const empStatus = emp.status || (emp.active ? 'ACTIVE' : 'TERMINATED');
      if (empStatus !== 'ACTIVE') {
        const statusLabel = empStatus === 'ON_LEAVE' ? 'En congé' : empStatus === 'SUSPENDED' ? 'Suspendu' : 'Inactif';
        return sendError(res, `Impossible d'assigner l'employé ${emp.full_name} à une vente : son statut est '${statusLabel}'`, 400);
      }
    }

    const sale = await runTransaction(async (client) => {
      const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
      let totalAmount = 0;

      // 1. Resolve client record
      let targetClientId: number | null = clientId ? Number(clientId) : null;
      let clientRecord: any = null;

      if (targetClientId) {
        const clRes = await client.query('SELECT id, name, code, current_balance, is_default, active FROM clients WHERE id = $1 FOR UPDATE', [targetClientId]);
        clientRecord = clRes.rows[0];
        if (!clientRecord) {
          throw new Error(`Client introuvable avec l'id ${targetClientId}`);
        }
        if (!clientRecord.active) {
          throw new Error(`Le client ${clientRecord.name} est inactif`);
        }
      } else {
        // Find default walk-in client
        const defClRes = await client.query('SELECT id, name, code, current_balance, is_default, active FROM clients WHERE is_default = TRUE LIMIT 1');
        if (defClRes.rowCount && defClRes.rowCount > 0) {
          clientRecord = defClRes.rows[0];
          targetClientId = clientRecord.id;
        }
      }

      // 2. Validate and process stock & pricing
      if (hasAllocations) {
        // Multi-warehouse allocation path
        for (const alloc of fulfillmentAllocations) {
          const prodRes = await client.query('SELECT id, name, sale_price FROM products WHERE id = $1', [alloc.productId]);
          const product = prodRes.rows[0];
          if (!product) throw new Error(`Product not found with id ${alloc.productId}`);

          const unitPrice = alloc.unitPrice !== undefined ? Number(alloc.unitPrice) : Number(product.sale_price);
          if (isNaN(unitPrice) || unitPrice < 0) {
            throw new Error(`Prix unitaire invalide pour le produit ${product.name}`);
          }
          totalAmount += Number(alloc.quantity) * unitPrice;

          if (Number(alloc.fulfillmentWarehouseId) === Number(targetWarehouseId)) {
            // Local stock deduction
            const stockRes = await client.query(
              'SELECT * FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
              [targetWarehouseId, alloc.productId]
            );
            const stock = stockRes.rows[0];
            const physQty = stock ? Number(stock.physical_quantity) : 0;
            const resQty = stock ? Number(stock.reserved_quantity) : 0;
            const available = physQty - resQty;

            if (available < Number(alloc.quantity)) {
              throw new Error(`Stock local insuffisant pour ${product.name}. Disponible: ${available}, Demandé: ${alloc.quantity}`);
            }

            await client.query(
              'UPDATE stock SET physical_quantity = physical_quantity - $1, updated_at = NOW() WHERE id = $2',
              [alloc.quantity, stock.id]
            );

            await client.query(`
              INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
              VALUES ($1, $2, 'SALE', $3, $4, $5)
            `, [targetWarehouseId, alloc.productId, -Number(alloc.quantity), invoiceNumber, `Sale to ${customerName || clientRecord?.name || 'Client'}`]);
          } else {
            // Remote warehouse validation
            const remoteWhCheck = await client.query('SELECT id, name, active FROM warehouses WHERE id = $1', [alloc.fulfillmentWarehouseId]);
            const rWh = remoteWhCheck.rows[0];
            if (!rWh || !rWh.active) {
              throw new Error(`Le dépôt de destination (${rWh ? rWh.name : alloc.fulfillmentWarehouseId}) est inactif ou introuvable`);
            }
          }
        }
      } else {
        // Standard single-warehouse sale path
        for (const item of items) {
          const prodRes = await client.query('SELECT id, name, sale_price FROM products WHERE id = $1', [item.productId]);
          const product = prodRes.rows[0];
          if (!product) throw new Error(`Product not found with id ${item.productId}`);

          const stockRes = await client.query(
            'SELECT * FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
            [targetWarehouseId, item.productId]
          );
          const stock = stockRes.rows[0];
          const physQty = stock ? Number(stock.physical_quantity) : 0;
          const resQty = stock ? Number(stock.reserved_quantity) : 0;
          const available = physQty - resQty;

          if (available < Number(item.quantity)) {
            throw new Error(`Stock insuffisant pour ${product.name}. Disponible: ${available}, Demandé: ${item.quantity}`);
          }

          await client.query(
            'UPDATE stock SET physical_quantity = physical_quantity - $1, updated_at = NOW() WHERE id = $2',
            [item.quantity, stock.id]
          );

          await client.query(`
            INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
            VALUES ($1, $2, 'SALE', $3, $4, $5)
          `, [targetWarehouseId, item.productId, -Number(item.quantity), invoiceNumber, `Sale to ${customerName || clientRecord?.name || 'Client'}`]);

          const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(product.sale_price);
          if (isNaN(unitPrice) || unitPrice < 0) {
            throw new Error(`Prix unitaire invalide pour le produit ${product.name}`);
          }
          totalAmount += Number(item.quantity) * unitPrice;
        }
      }

      // 3. Determine Payment Amount, Advance Deduction, and Status
      if (clientRecord?.is_default && paymentCondition && paymentCondition !== 'FULL_CASH') {
        throw new Error('Les ventes au Client Passager / Comptoir doivent être obligatoirement réglées au comptant (100%). Pour accorder un crédit ou un acompte, veuillez sélectionner ou enregistrer un compte client nominatif.');
      }

      const prevBal = Number(clientRecord?.current_balance || 0);
      const isWalkin = Boolean(clientRecord?.is_default);
      const availableAdvance = (!isWalkin && prevBal < 0) ? Math.abs(prevBal) : 0;

      let advanceDeducted = 0;
      let isOptedOut = false;

      if (availableAdvance > 0) {
        if (useAdvanceCredit === false) {
          isOptedOut = true;
          advanceDeducted = 0;
        } else {
          advanceDeducted = Math.min(totalAmount, availableAdvance);
        }
      }

      const netRemaining = Math.max(0, totalAmount - advanceDeducted);

      let cashPaid = 0;
      if (advanceDeducted > 0 && netRemaining === 0) {
        cashPaid = 0;
      } else if (paymentCondition === 'CREDIT') {
        cashPaid = 0;
      } else if (paymentCondition === 'PARTIAL_DOWNPAYMENT') {
        cashPaid = Math.max(0, Math.min(netRemaining, Number(downpaymentAmount) || 0));
      } else {
        // FULL_CASH
        cashPaid = netRemaining;
      }

      const paidAmount = advanceDeducted + cashPaid;
      let paymentStatus = 'PAID';
      if (paidAmount === 0) {
        paymentStatus = 'UNPAID';
      } else if (paidAmount < totalAmount) {
        paymentStatus = 'PARTIALLY_PAID';
      }

      // 4. Create Sale Record
      const formattedSaleDate = normalizeSaleDate(saleDate);
      const parsedEmployeeId = employeeId ? Number(employeeId) : null;
      const finalCustomerName = customerName?.trim() || clientRecord?.name || 'Client';
      const initialSaleStatus = hasInterWarehouse ? 'PENDING_PICKUP' : 'COMPLETED';

      const saleRes = await client.query(`
        INSERT INTO sales (
          invoice_number, warehouse_id, origin_warehouse_id, has_inter_warehouse_fulfillment,
          user_id, employee_id, client_id,
          customer_name, customer_phone, total_amount, paid_amount, advance_deducted, payment_status,
          status, sale_date, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, COALESCE($15::timestamptz, NOW()), NOW(), NOW())
        RETURNING id
      `, [
        invoiceNumber,
        targetWarehouseId,
        targetWarehouseId,
        hasInterWarehouse,
        req.user ? req.user.id : 1,
        parsedEmployeeId,
        targetClientId,
        finalCustomerName,
        customerPhone || clientRecord?.phone || '',
        totalAmount,
        paidAmount,
        advanceDeducted,
        paymentStatus,
        initialSaleStatus,
        formattedSaleDate,
      ]);

      const saleId = saleRes.rows[0].id;

      // 5. Create Sale Items & Fulfillment Lines
      if (hasAllocations) {
        for (const alloc of fulfillmentAllocations) {
          const prodRes = await client.query('SELECT sale_price FROM products WHERE id = $1', [alloc.productId]);
          const unitPrice = alloc.unitPrice !== undefined ? Number(alloc.unitPrice) : Number(prodRes.rows[0].sale_price);
          const subtotal = Number(alloc.quantity) * unitPrice;
          const isLocal = Number(alloc.fulfillmentWarehouseId) === Number(targetWarehouseId);
          const lineFulfillmentStatus = isLocal ? 'FULFILLED' : 'PENDING_PICKUP';
          const linePaymentStatus = alloc.paymentStatus || (isLocal ? 'PAID' : 'COLLECT_ON_PICKUP');
          const voucherPrefix = isLocal ? 'VOUCH-LOCAL-' : 'VOUCH-';
          const voucherCode = `${voucherPrefix}${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

          // Insert sale_item
          await client.query(`
            INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
            VALUES ($1, $2, $3, $4, $5)
          `, [saleId, alloc.productId, Number(alloc.quantity), unitPrice, subtotal]);

          // Insert sale_fulfillment_lines
          const flRes = await client.query(`
            INSERT INTO sale_fulfillment_lines (
              sale_id, product_id, quantity, unit_price, subtotal,
              origin_warehouse_id, fulfillment_warehouse_id, payment_warehouse_id,
              fulfillment_status, payment_status, pickup_voucher_code,
              fulfilled_at, fulfilled_by_user_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
            RETURNING id
          `, [
            saleId,
            alloc.productId,
            Number(alloc.quantity),
            unitPrice,
            subtotal,
            targetWarehouseId,
            alloc.fulfillmentWarehouseId,
            alloc.paymentWarehouseId || targetWarehouseId,
            lineFulfillmentStatus,
            linePaymentStatus,
            voucherCode,
            isLocal ? new Date() : null,
            isLocal ? (req.user?.id || 1) : null,
          ]);

          const flId = flRes.rows[0].id;

          if (!isLocal) {
            // Reserve remote stock
            await createStockReservation(client, {
              fulfillmentLineId: flId,
              warehouseId: Number(alloc.fulfillmentWarehouseId),
              productId: Number(alloc.productId),
              quantity: Number(alloc.quantity),
              ttlHours: Number(alloc.ttlHours) || 120,
            });

            // If prepaid at origin for goods from remote branch, establish inter-branch settlement liability
            if (Number(alloc.paymentWarehouseId) !== Number(alloc.fulfillmentWarehouseId) && linePaymentStatus === 'PAID') {
              const settlNumber = `SETTL-${Date.now().toString().slice(-8)}-${Math.floor(100 + Math.random() * 900)}`;
              await client.query(`
                INSERT INTO inter_warehouse_settlements (
                  settlement_number, debtor_warehouse_id, creditor_warehouse_id, amount, status, notes, created_at
                ) VALUES ($1, $2, $3, $4, 'PENDING', $5, NOW())
              `, [
                settlNumber,
                alloc.paymentWarehouseId || targetWarehouseId,
                alloc.fulfillmentWarehouseId,
                subtotal,
                `Vente ${invoiceNumber} payée au dépôt ${alloc.paymentWarehouseId || targetWarehouseId} et livrable au dépôt ${alloc.fulfillmentWarehouseId}`,
              ]);
            }
          }
        }
      } else {
        // Standard items creation
        for (const item of items) {
          const prodRes = await client.query('SELECT sale_price FROM products WHERE id = $1', [item.productId]);
          const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(prodRes.rows[0].sale_price);
          const subtotal = Number(item.quantity) * unitPrice;
          const voucherCode = `VOUCH-LOCAL-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

          await client.query(`
            INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
            VALUES ($1, $2, $3, $4, $5)
          `, [saleId, item.productId, Number(item.quantity), unitPrice, subtotal]);

          await client.query(`
            INSERT INTO sale_fulfillment_lines (
              sale_id, product_id, quantity, unit_price, subtotal,
              origin_warehouse_id, fulfillment_warehouse_id, payment_warehouse_id,
              fulfillment_status, payment_status, pickup_voucher_code,
              fulfilled_at, fulfilled_by_user_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'FULFILLED', 'PAID', $9, NOW(), $10, NOW(), NOW())
          `, [
            saleId,
            item.productId,
            Number(item.quantity),
            unitPrice,
            subtotal,
            targetWarehouseId,
            targetWarehouseId,
            targetWarehouseId,
            voucherCode,
            req.user?.id || 1,
          ]);
        }
      }

      // 6. Record Financial Ledger Entries (if client exists and is non-walkin, or walk-in with credit/downpayment)
      if (clientRecord && targetClientId) {
        // A. Invoice Debit Transaction
        const afterDebitBal = prevBal + totalAmount;
        let invoiceDesc = `Facture vente ${invoiceNumber}`;
        if (advanceDeducted > 0) {
          invoiceDesc += ` (Imputation avoir: ${advanceDeducted.toFixed(2)} DA)`;
        }

        await client.query(`
          INSERT INTO client_transactions (
            client_id, warehouse_id, type, reference_type, reference_id,
            debit, credit, running_balance, description, transaction_date, created_by, created_at
          ) VALUES ($1, $2, 'INVOICE', 'SALES_INVOICE', $3, $4, 0, $5, $6, COALESCE($7::timestamptz, NOW()), $8, NOW())
        `, [
          targetClientId,
          targetWarehouseId,
          saleId,
          totalAmount,
          afterDebitBal,
          invoiceDesc,
          formattedSaleDate,
          req.user?.id || 1,
        ]);

        let finalClientBalance = afterDebitBal;

        // B. Payment Credit Transaction ONLY if physical cash payment was made (cashPaid > 0)
        if (cashPaid > 0) {
          finalClientBalance = afterDebitBal - cashPaid;
          const payNumber = `PAY-${Date.now().toString().slice(-8)}`;

          const payInsertRes = await client.query(`
            INSERT INTO client_payments (
              payment_number, client_id, warehouse_id, amount, payment_method,
              reference_number, payment_date, notes, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()), $8, $9, NOW())
            RETURNING id
          `, [
            payNumber,
            targetClientId,
            targetWarehouseId,
            cashPaid,
            paymentMethod || 'CASH',
            invoiceNumber,
            formattedSaleDate,
            `Règlement au comptant vente ${invoiceNumber}`,
            req.user?.id || 1,
          ]);
          const paymentId = payInsertRes.rows[0].id;

          const payTxRes = await client.query(`
            INSERT INTO client_transactions (
              client_id, warehouse_id, type, reference_type, reference_id,
              debit, credit, running_balance, description, transaction_date, created_by, created_at
            ) VALUES ($1, $2, 'PAYMENT', 'CLIENT_PAYMENT', $3, 0, $4, $5, $6, COALESCE($7::timestamptz, NOW()), $8, NOW())
            RETURNING id
          `, [
            targetClientId,
            targetWarehouseId,
            paymentId,
            cashPaid,
            finalClientBalance,
            `Règlement ${paymentMethod || 'CASH'} vente ${invoiceNumber}`,
            formattedSaleDate,
            req.user?.id || 1,
          ]);
          const payTxId = payTxRes.rows[0].id;

          await client.query('UPDATE client_payments SET transaction_id = $1 WHERE id = $2', [payTxId, paymentId]);

          // Link allocation
          await client.query(`
            INSERT INTO payment_allocations (payment_id, sale_id, allocated_amount)
            VALUES ($1, $2, $3)
          `, [paymentId, saleId, cashPaid]);
        }

        // Update Client Cached Balance
        await client.query('UPDATE clients SET current_balance = $1, updated_at = NOW() WHERE id = $2', [finalClientBalance, targetClientId]);
      }

      return {
        id: saleId,
        invoiceNumber,
        totalAmount,
        paidAmount,
        advanceDeducted,
        paymentStatus,
        saleDate: formattedSaleDate,
        employeeId: parsedEmployeeId,
        clientId: targetClientId,
        isOptedOut,
        availableAdvance,
        clientName: clientRecord?.name,
      };
    });

    await logAudit(
      req.user,
      'SALE_CREATED',
      'SALE',
      sale.id,
      `Création vente ${sale.invoiceNumber} (Total: ${sale.totalAmount} DZD, Payé: ${sale.paidAmount} DZD, Statut: ${sale.paymentStatus})`,
      targetWarehouseId
    );

    if (sale.isOptedOut) {
      await logAudit(
        req.user,
        'SALE_CREDIT_OPT_OUT',
        'SALE',
        sale.id,
        `L'avoir disponible de ${sale.availableAdvance.toFixed(2)} DZD n'a pas été appliqué sur la facture ${sale.invoiceNumber} pour le client ${sale.clientName} (choix caissier/client)`,
        targetWarehouseId
      );
    }

    const fullSaleRes = await query(`
      SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
             w.location as warehouse_address, w.contact_number as warehouse_phone,
             s.user_id, u.full_name as user_name, s.employee_id, e.full_name as employee_name,
             s.client_id, cl.name as client_name, cl.code as client_code, cl.address as client_address,
             s.customer_name, s.customer_phone,
             s.total_amount, s.paid_amount, s.advance_deducted, s.payment_status, s.status,
             COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at, s.updated_at
      FROM sales s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN employees e ON s.employee_id = e.id
      LEFT JOIN clients cl ON s.client_id = cl.id
      WHERE s.id = $1
    `, [sale.id]);

    const s = fullSaleRes.rows[0];
    const itemsRes = await query(`
      SELECT si.id, si.product_id, p.name as product_name, p.reference as product_reference,
             p.box_size as product_box_size,
             si.quantity, si.unit_price, si.subtotal
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = $1
    `, [sale.id]);

    const fullItems = itemsRes.rows.map((i: any) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      productReference: i.product_reference,
      productBoxSize: Number(i.product_box_size || 0),
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      subtotal: Number(i.subtotal),
    }));

    const flRes = await query(`
      SELECT fl.*, p.name as product_name, p.reference as product_reference,
             ow.name as origin_warehouse_name, fw.name as fulfillment_warehouse_name, pw.name as payment_warehouse_name,
             sr.expires_at as reservation_expires_at, sr.id as reservation_id, sr.reserved_quantity
      FROM sale_fulfillment_lines fl
      JOIN products p ON fl.product_id = p.id
      JOIN warehouses ow ON fl.origin_warehouse_id = ow.id
      JOIN warehouses fw ON fl.fulfillment_warehouse_id = fw.id
      JOIN warehouses pw ON fl.payment_warehouse_id = pw.id
      LEFT JOIN stock_reservations sr ON sr.fulfillment_line_id = fl.id
      WHERE fl.sale_id = $1
      ORDER BY fl.id ASC
    `, [sale.id]);

    const fulfillmentLines = flRes.rows.map((fl: any) => ({
      id: fl.id,
      saleId: fl.sale_id,
      invoiceNumber: s.invoice_number,
      customerName: s.customer_name,
      customerPhone: s.customer_phone,
      productId: fl.product_id,
      productName: fl.product_name,
      productReference: fl.product_reference,
      quantity: Number(fl.quantity),
      unitPrice: Number(fl.unit_price),
      subtotal: Number(fl.subtotal),
      originWarehouseId: fl.origin_warehouse_id,
      originWarehouseName: fl.origin_warehouse_name,
      fulfillmentWarehouseId: fl.fulfillment_warehouse_id,
      fulfillmentWarehouseName: fl.fulfillment_warehouse_name,
      paymentWarehouseId: fl.payment_warehouse_id,
      paymentWarehouseName: fl.payment_warehouse_name,
      fulfillmentStatus: fl.fulfillment_status,
      paymentStatus: fl.payment_status,
      pickupVoucherCode: fl.pickup_voucher_code,
      reservationId: fl.reservation_id,
      reservedQuantity: Number(fl.reserved_quantity || fl.quantity),
      reservationExpiresAt: fl.reservation_expires_at,
      fulfilledAt: fl.fulfilled_at,
      fulfilledByUserId: fl.fulfilled_by_user_id,
      createdAt: fl.created_at,
      updatedAt: fl.updated_at,
    }));

    const responsePayload = {
      id: s.id,
      invoiceNumber: s.invoice_number,
      warehouseId: s.warehouse_id,
      warehouseName: s.warehouse_name,
      warehouseCode: s.warehouse_code,
      warehousePhone: s.warehouse_phone || '',
      warehouseAddress: s.warehouse_address || '',
      originWarehouseId: s.origin_warehouse_id,
      hasInterWarehouseFulfillment: Boolean(s.has_inter_warehouse_fulfillment),
      userId: s.user_id,
      userName: s.user_name,
      createdById: s.user_id,
      createdByName: s.user_name,
      employeeId: s.employee_id,
      employeeName: s.employee_name,
      clientId: s.client_id,
      clientName: s.client_name,
      clientCode: s.client_code,
      clientAddress: s.client_address,
      customerName: s.customer_name,
      customerPhone: s.customer_phone,
      totalAmount: Number(s.total_amount),
      paidAmount: Number(s.paid_amount || 0),
      advanceDeducted: Number(s.advance_deducted || 0),
      remainingAmount: Math.max(0, Number(s.total_amount) - Number(s.paid_amount || 0)),
      paymentStatus: s.payment_status,
      saleDate: s.sale_date || s.created_at,
      status: s.status,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      items: fullItems,
      fulfillmentLines,
    };

    return sendSuccess(res, responsePayload, 'Sale completed successfully', 201);
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { employeeId, customerName, customerPhone, saleDate, items } = req.body;

    const currentRes = await query('SELECT * FROM sales WHERE id = $1', [id]);
    const currentSale = currentRes.rows[0];
    if (!currentSale) {
      return sendError(res, `Sale not found with id ${id}`, 404);
    }
    if (req.user) {
      try {
        validateWarehouseScope(req.user, currentSale.warehouse_id);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }
    if (currentSale.status === 'CANCELLED') {
      return sendError(res, 'Cannot edit a cancelled sale', 400);
    }

    if (employeeId !== undefined && employeeId !== null && Number(employeeId) !== Number(currentSale.employee_id)) {
      const empRes = await query('SELECT id, full_name, status, active, warehouse_id FROM employees WHERE id = $1', [Number(employeeId)]);
      const emp = empRes.rows[0];
      if (!emp) {
        return sendError(res, `Employé non trouvé avec l'identifiant ${employeeId}`, 400);
      }
      if (emp.warehouse_id !== currentSale.warehouse_id) {
        return sendError(res, `L'employé ${emp.full_name} n'est pas affecté à cet entrepôt`, 400);
      }
      const empStatus = emp.status || (emp.active ? 'ACTIVE' : 'TERMINATED');
      if (empStatus !== 'ACTIVE') {
        const statusLabel = empStatus === 'ON_LEAVE' ? 'En congé' : empStatus === 'SUSPENDED' ? 'Suspendu' : 'Inactif';
        return sendError(res, `Impossible d'assigner l'employé ${emp.full_name} à une vente : son statut est '${statusLabel}'`, 400);
      }
    }

    const updatedSale = await runTransaction(async (client) => {
      // 1. Lock the sale record for update to prevent concurrent modifications
      const saleLockRes = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [id]);
      const currentSale = saleLockRes.rows[0];
      if (!currentSale) {
        throw new Error(`Sale not found with id ${id}`);
      }
      if (currentSale.status === 'CANCELLED') {
        throw new Error('Cannot edit a cancelled sale');
      }

      const revRef = `${currentSale.invoice_number}-REV-${Date.now().toString().slice(-6)}`;
      const oldTotal = Number(currentSale.total_amount);
      let newTotal = oldTotal;

      if (items && Array.isArray(items) && items.length > 0) {
        // 2. Fetch baseline items under lock
        const existingItemsRes = await client.query(
          'SELECT product_id, quantity, unit_price FROM sale_items WHERE sale_id = $1',
          [id]
        );

        const oldMap = new Map<number, number>();
        for (const row of existingItemsRes.rows) {
          const pid = Number(row.product_id);
          oldMap.set(pid, (oldMap.get(pid) || 0) + Number(row.quantity));
        }

        const newMap = new Map<number, { quantity: number; unitPrice?: number }>();
        for (const item of items) {
          const pid = Number(item.productId);
          const qty = Number(item.quantity);
          if (isNaN(qty) || qty <= 0) {
            throw new Error('La quantité doit être un entier strictement supérieur à zéro');
          }
          const existing = newMap.get(pid);
          if (existing) {
            existing.quantity += qty;
          } else {
            newMap.set(pid, {
              quantity: qty,
              unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : undefined,
            });
          }
        }

        // All distinct product IDs involved, sorted ascending to prevent deadlocks
        const allProductIds = Array.from(new Set([...oldMap.keys(), ...newMap.keys()])).sort((a, b) => a - b);

        // Fetch product information and lock stock rows
        const stockRowsMap = new Map<number, any>();
        const productInfoMap = new Map<number, any>();

        for (const pid of allProductIds) {
          const prodRes = await client.query('SELECT id, name, sale_price FROM products WHERE id = $1', [pid]);
          const product = prodRes.rows[0];
          if (!product) throw new Error(`Produit introuvable avec l'identifiant ${pid}`);
          productInfoMap.set(pid, product);

          const stockRes = await client.query(
            'SELECT id, physical_quantity, reserved_quantity FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
            [currentSale.warehouse_id, pid]
          );

          if (!stockRes.rows[0]) {
            const newStockRes = await client.query(
              'INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity) VALUES ($1, $2, 0, 0) RETURNING id, physical_quantity, reserved_quantity',
              [currentSale.warehouse_id, pid]
            );
            stockRowsMap.set(pid, newStockRes.rows[0]);
          } else {
            stockRowsMap.set(pid, stockRes.rows[0]);
          }
        }

        // 3. Validate stock availability for all quantity increases (deltaStock < 0)
        for (const pid of allProductIds) {
          const oldQty = oldMap.get(pid) || 0;
          const newQty = newMap.get(pid)?.quantity || 0;
          const deltaStock = oldQty - newQty;

          if (deltaStock < 0) {
            const neededExtra = Math.abs(deltaStock);
            const stock = stockRowsMap.get(pid);
            const physQty = stock ? Number(stock.physical_quantity || 0) : 0;
            const resQty = stock ? Number(stock.reserved_quantity || 0) : 0;
            const available = physQty - resQty;

            if (available < neededExtra) {
              const product = productInfoMap.get(pid);
              throw new Error(
                `Stock insuffisant pour ${product.name}. Disponible : ${available}, Requis en plus : ${neededExtra}`
              );
            }
          }
        }

        // 4. Stock check passed! Update stock quantities and log movements for non-zero deltas
        for (const pid of allProductIds) {
          const oldQty = oldMap.get(pid) || 0;
          const newQty = newMap.get(pid)?.quantity || 0;
          const deltaStock = oldQty - newQty;
          const stock = stockRowsMap.get(pid);

          if (deltaStock !== 0) {
            await client.query(
              'UPDATE stock SET physical_quantity = physical_quantity + $1, updated_at = NOW() WHERE id = $2',
              [deltaStock, stock.id]
            );

            const noteDesc = deltaStock > 0
              ? `[${revRef}] Retour suite modification vente (${oldQty} → ${newQty})`
              : `[${revRef}] Sortie suppl. suite modification vente (${oldQty} → ${newQty})`;

            await client.query(`
              INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
              VALUES ($1, $2, 'SALE_EDIT', $3, $4, $5)
            `, [currentSale.warehouse_id, pid, deltaStock, currentSale.invoice_number, noteDesc]);
          }
        }

        // 5. Replace sale_items and compute new total
        await client.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
        newTotal = 0;

        for (const item of items) {
          const pid = Number(item.productId);
          const product = productInfoMap.get(pid);
          const qty = Number(item.quantity);
          const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(product.sale_price);

          if (isNaN(unitPrice) || unitPrice < 0) {
            throw new Error(`Prix unitaire invalide pour le produit ${product.name}`);
          }
          const subtotal = qty * unitPrice;

          await client.query(`
            INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
            VALUES ($1, $2, $3, $4, $5)
          `, [id, pid, qty, unitPrice, subtotal]);

          newTotal += subtotal;
        }
      }

      // 6. Financial Ledger Reconciliation
      const deltaTotal = newTotal - oldTotal;

      if (currentSale.client_id && deltaTotal !== 0) {
        const clientRes = await client.query(
          'SELECT id, name, code, current_balance, is_default FROM clients WHERE id = $1 FOR UPDATE',
          [currentSale.client_id]
        );
        const clientRecord = clientRes.rows[0];

        if (clientRecord) {
          const prevBal = Number(clientRecord.current_balance || 0);

          if (clientRecord.is_default) {
            // Walk-in counter customer: balance stays 0.00 DA, cash movements traced
            if (deltaTotal < 0) {
              const refundAmount = Math.abs(deltaTotal);
              // Avoir (Credit Note)
              await client.query(`
                INSERT INTO client_transactions (
                  client_id, warehouse_id, type, reference_type, reference_id,
                  debit, credit, running_balance, description, transaction_date, created_by, created_at
                ) VALUES ($1, $2, 'CREDIT_NOTE', 'SALES_EDIT', $3, 0, $4, $5, $6, NOW(), $7, NOW())
              `, [
                clientRecord.id,
                currentSale.warehouse_id,
                id,
                refundAmount,
                prevBal - refundAmount,
                `[${revRef}] Avoir retour articles facture ${currentSale.invoice_number} (-${refundAmount.toFixed(2)} DA)`,
                req.user?.id || 1,
              ]);

              // Compensating cash refund (REFUND)
              await client.query(`
                INSERT INTO client_transactions (
                  client_id, warehouse_id, type, reference_type, reference_id,
                  debit, credit, running_balance, description, transaction_date, created_by, created_at
                ) VALUES ($1, $2, 'REFUND', 'SALES_EDIT', $3, $4, 0, $5, $6, NOW(), $7, NOW())
              `, [
                clientRecord.id,
                currentSale.warehouse_id,
                id,
                refundAmount,
                prevBal,
                `[${revRef}] Remboursement espèces comptoir suite modification facture ${currentSale.invoice_number}`,
                req.user?.id || 1,
              ]);
            } else {
              const extraAmount = deltaTotal;
              // Supplementary invoice debit
              await client.query(`
                INSERT INTO client_transactions (
                  client_id, warehouse_id, type, reference_type, reference_id,
                  debit, credit, running_balance, description, transaction_date, created_by, created_at
                ) VALUES ($1, $2, 'INVOICE', 'SALES_EDIT', $3, $4, 0, $5, $6, NOW(), $7, NOW())
              `, [
                clientRecord.id,
                currentSale.warehouse_id,
                id,
                extraAmount,
                prevBal + extraAmount,
                `[${revRef}] Complément facture ${currentSale.invoice_number} (+${extraAmount.toFixed(2)} DA)`,
                req.user?.id || 1,
              ]);

              // Immediate cash payment credit
              const payNumber = `PAY-${Date.now().toString().slice(-8)}`;
              const payInsertRes = await client.query(`
                INSERT INTO client_payments (
                  payment_number, client_id, warehouse_id, amount, payment_method,
                  reference_number, payment_date, notes, created_by, created_at
                ) VALUES ($1, $2, $3, $4, 'CASH', $5, NOW(), $6, $7, NOW())
                RETURNING id
              `, [
                payNumber,
                clientRecord.id,
                currentSale.warehouse_id,
                extraAmount,
                currentSale.invoice_number,
                `[${revRef}] Règlement complémentaire comptoir vente ${currentSale.invoice_number}`,
                req.user?.id || 1,
              ]);
              const paymentId = payInsertRes.rows[0].id;

              const payTxRes = await client.query(`
                INSERT INTO client_transactions (
                  client_id, warehouse_id, type, reference_type, reference_id,
                  debit, credit, running_balance, description, transaction_date, created_by, created_at
                ) VALUES ($1, $2, 'PAYMENT', 'CLIENT_PAYMENT', $3, 0, $4, $5, $6, NOW(), $7, NOW())
                RETURNING id
              `, [
                clientRecord.id,
                currentSale.warehouse_id,
                paymentId,
                extraAmount,
                prevBal,
                `[${revRef}] Encaissement complémentaire comptoir vente ${currentSale.invoice_number}`,
                req.user?.id || 1,
              ]);
              const payTxId = payTxRes.rows[0].id;

              await client.query('UPDATE client_payments SET transaction_id = $1 WHERE id = $2', [payTxId, paymentId]);
              await client.query(`
                INSERT INTO payment_allocations (payment_id, sale_id, allocated_amount)
                VALUES ($1, $2, $3)
              `, [paymentId, id, extraAmount]);
            }
          } else {
            // Nominative account: update balance and post transaction
            const newBalance = prevBal + deltaTotal;
            if (deltaTotal < 0) {
              const creditAmount = Math.abs(deltaTotal);
              await client.query(`
                INSERT INTO client_transactions (
                  client_id, warehouse_id, type, reference_type, reference_id,
                  debit, credit, running_balance, description, transaction_date, created_by, created_at
                ) VALUES ($1, $2, 'CREDIT_NOTE', 'SALES_EDIT', $3, 0, $4, $5, $6, NOW(), $7, NOW())
              `, [
                clientRecord.id,
                currentSale.warehouse_id,
                id,
                creditAmount,
                newBalance,
                `[${revRef}] Avoir suite modification facture ${currentSale.invoice_number} (-${creditAmount.toFixed(2)} DA)`,
                req.user?.id || 1,
              ]);
            } else {
              const debitAmount = deltaTotal;
              await client.query(`
                INSERT INTO client_transactions (
                  client_id, warehouse_id, type, reference_type, reference_id,
                  debit, credit, running_balance, description, transaction_date, created_by, created_at
                ) VALUES ($1, $2, 'INVOICE', 'SALES_EDIT', $3, $4, 0, $5, $6, NOW(), $7, NOW())
              `, [
                clientRecord.id,
                currentSale.warehouse_id,
                id,
                debitAmount,
                newBalance,
                `[${revRef}] Complément facturation suite modification ${currentSale.invoice_number} (+${debitAmount.toFixed(2)} DA)`,
                req.user?.id || 1,
              ]);
            }

            await client.query(
              'UPDATE clients SET current_balance = $1, updated_at = NOW() WHERE id = $2',
              [newBalance, clientRecord.id]
            );
          }
        }
      }

      // 7. Payment Lifecycle & Allocations Reconciliation
      let currentPaid = Number(currentSale.paid_amount || 0);
      let currentAdvanceDeducted = Number(currentSale.advance_deducted || 0);
      let newAdvanceDeducted = currentAdvanceDeducted;
      if (newAdvanceDeducted > newTotal) {
        newAdvanceDeducted = newTotal;
      }

      let newPaid = currentPaid;

      const isWalkinClient = currentSale.client_id
        ? (await client.query('SELECT is_default FROM clients WHERE id = $1', [currentSale.client_id])).rows[0]?.is_default
        : false;

      if (isWalkinClient) {
        newPaid = newTotal;
      } else if (newPaid > newTotal) {
        newPaid = newTotal;
      }

      let newPaymentStatus = 'UNPAID';
      if (newPaid >= newTotal && newTotal > 0) {
        newPaymentStatus = 'PAID';
      } else if (newPaid > 0) {
        newPaymentStatus = 'PARTIALLY_PAID';
      }

      // Cap payment allocations to newTotal
      await client.query(`
        UPDATE payment_allocations
        SET allocated_amount = LEAST(allocated_amount, $1)
        WHERE sale_id = $2
      `, [newTotal, id]);

      // 8. Update Sale Record
      const formattedSaleDate = saleDate !== undefined
        ? normalizeSaleDate(saleDate)
        : currentSale.sale_date;

      const parsedEmployeeId = employeeId !== undefined
        ? (employeeId ? Number(employeeId) : null)
        : currentSale.employee_id;

      await client.query(`
        UPDATE sales
        SET customer_name = $1, customer_phone = $2, total_amount = $3,
            paid_amount = $4, advance_deducted = $5, payment_status = $6, employee_id = $7,
            sale_date = COALESCE($8::timestamptz, sale_date, created_at), updated_at = NOW()
        WHERE id = $9
      `, [
        customerName !== undefined ? customerName : currentSale.customer_name,
        customerPhone !== undefined ? customerPhone : currentSale.customer_phone,
        newTotal,
        newPaid,
        newAdvanceDeducted,
        newPaymentStatus,
        parsedEmployeeId,
        formattedSaleDate,
        id,
      ]);

      return {
        id,
        invoiceNumber: currentSale.invoice_number,
        totalAmount: newTotal,
        paidAmount: newPaid,
        advanceDeducted: newAdvanceDeducted,
        paymentStatus: newPaymentStatus,
        saleDate: formattedSaleDate,
        employeeId: parsedEmployeeId,
        revisionRef: revRef,
      };
    });

    await logAudit(
      req.user,
      'SALE_MODIFIED',
      'SALE',
      id,
      `[${updatedSale.revisionRef}] Modified sale ${updatedSale.invoiceNumber}: total ${currentSale.total_amount} -> ${updatedSale.totalAmount}`,
      currentSale.warehouse_id
    );

    return sendSuccess(res, updatedSale, 'Sale updated successfully');
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

router.delete('/:id', authenticate, requireRole('ADMIN', 'SUPER_MANAGER'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const saleRes = await query('SELECT * FROM sales WHERE id = $1', [id]);
    const currentSale = saleRes.rows[0];
    if (!currentSale) {
      return sendError(res, `Sale not found with id ${id}`, 404);
    }

    if (req.user) {
      try {
        validateWarehouseScope(req.user, currentSale.warehouse_id);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    // Check if sale has inter-warehouse fulfillment lines or has_inter_warehouse_fulfillment flag
    const linesRes = await query('SELECT COUNT(*) as count FROM sale_fulfillment_lines WHERE sale_id = $1', [id]);
    const hasInterWarehouseLines = Number(linesRes.rows[0]?.count || 0) > 0 || Boolean(currentSale.has_inter_warehouse_fulfillment);

    if (hasInterWarehouseLines) {
      return sendError(res, 'Hard delete is prohibited for sales with inter-warehouse fulfillment lines. Use line-level cancellation or returns workflow instead.', 400);
    }

    if (currentSale.status === 'COMPLETED' || currentSale.status === 'PARTIALLY_CANCELLED') {
      return sendError(res, 'Cannot hard-delete a completed or partially cancelled sale. Use the cancellation or return workflow instead.', 400);
    }

    await runTransaction(async (client) => {
      await client.query('DELETE FROM payment_allocations WHERE sale_id = $1', [id]);
      await client.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);
      await client.query('DELETE FROM sales WHERE id = $1', [id]);
    });

    await logAudit(req.user, 'SALE_DELETED', 'SALE', id, `Deleted sale ${currentSale.invoice_number}`, currentSale.warehouse_id);
    return sendSuccess(res, { id, deleted: true }, 'Sale deleted successfully');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.post('/:id/cancel', authenticate, requireRole('ADMIN', 'SUPER_MANAGER', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const currentRes = await query('SELECT * FROM sales WHERE id = $1', [id]);
    const currentSale = currentRes.rows[0];
    if (!currentSale) {
      return sendError(res, `Sale not found with id ${id}`, 404);
    }
    if (req.user) {
      try {
        validateWarehouseScope(req.user, currentSale.warehouse_id);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }
    if (currentSale.status === 'CANCELLED') {
      return sendError(res, 'Sale is already cancelled', 400);
    }

    // Check fulfillment lines
    const linesRes = await query('SELECT * FROM sale_fulfillment_lines WHERE sale_id = $1', [id]);
    const fulfillmentLines = linesRes.rows;

    if (fulfillmentLines.length > 0) {
      const fulfilledLines = fulfillmentLines.filter((l: any) => l.fulfillment_status === 'FULFILLED');
      const pendingLines = fulfillmentLines.filter((l: any) => l.fulfillment_status === 'PENDING_PICKUP');

      // 1. If ALL lines are fulfilled -> reject cancellation, direct to return workflow
      if (fulfilledLines.length > 0 && pendingLines.length === 0) {
        return sendError(res, 'All items have already been fulfilled and dispensed from warehouse(s). Cancellation is not allowed. Please use the returns and refunds workflow.', 400);
      }

      // 2. If ALL lines are pending -> Full cancellation
      if (fulfilledLines.length === 0 && pendingLines.length > 0) {
        const result = await runTransaction(async (client) => {
          for (const line of pendingLines) {
            const resQuery = await client.query(
              "SELECT id FROM stock_reservations WHERE fulfillment_line_id = $1 AND status = 'ACTIVE'",
              [line.id]
            );
            if (resQuery.rows[0]) {
              await releaseStockReservation(client, resQuery.rows[0].id, 'CANCELLED');
            }

            await client.query(`
              UPDATE sale_fulfillment_lines
              SET fulfillment_status = 'CANCELLED', updated_at = NOW()
              WHERE id = $1
            `, [line.id]);
          }

          // Cancel pending inter-warehouse settlements
          await client.query(`
            UPDATE inter_warehouse_settlements
            SET status = 'CANCELLED', notes = notes || ' (Annulé suite à annulation de la vente)'
            WHERE status = 'PENDING' AND notes LIKE '%' || $1 || '%'
          `, [currentSale.invoice_number]);

          // Compensating ledger entry if attached to a client
          if (currentSale.client_id) {
            const clientRes = await client.query('SELECT id, current_balance FROM clients WHERE id = $1 FOR UPDATE', [currentSale.client_id]);
            if (clientRes.rowCount && clientRes.rowCount > 0) {
              const prevBal = Number(clientRes.rows[0].current_balance || 0);
              const saleTotal = Number(currentSale.total_amount);
              const newBal = prevBal - saleTotal;

              await client.query(`
                INSERT INTO client_transactions (
                  client_id, warehouse_id, type, reference_type, reference_id,
                  debit, credit, running_balance, description, transaction_date, created_by, created_at
                ) VALUES ($1, $2, 'CREDIT_NOTE', 'SALES_CANCEL', $3, 0, $4, $5, $6, NOW(), $7, NOW())
              `, [
                currentSale.client_id,
                currentSale.warehouse_id,
                id,
                saleTotal,
                newBal,
                `Annulation complète vente ${currentSale.invoice_number}`,
                req.user?.id || 1,
              ]);

              await client.query('UPDATE clients SET current_balance = $1, updated_at = NOW() WHERE id = $2', [newBal, currentSale.client_id]);
            }
          }

          await client.query('DELETE FROM payment_allocations WHERE sale_id = $1', [id]);
          await client.query("UPDATE sales SET status = 'CANCELLED', payment_status = 'CANCELLED', updated_at = NOW() WHERE id = $1", [id]);

          return { id, status: 'CANCELLED', paymentStatus: 'CANCELLED' };
        });

        await logAudit(req.user, 'SALE_CANCELLED_FULL', 'SALE', id, `Full cancellation of sale ${currentSale.invoice_number} (all pending lines released)`, currentSale.warehouse_id);
        return sendSuccess(res, result, 'Sale cancelled and all pending reservations released successfully');
      }

      // 3. Mixed state -> Partial cancellation
      if (fulfilledLines.length > 0 && pendingLines.length > 0) {
        const result = await runTransaction(async (client) => {
          for (const line of pendingLines) {
            const resQuery = await client.query(
              "SELECT id FROM stock_reservations WHERE fulfillment_line_id = $1 AND status = 'ACTIVE'",
              [line.id]
            );
            if (resQuery.rows[0]) {
              await releaseStockReservation(client, resQuery.rows[0].id, 'CANCELLED');
            }

            await client.query(`
              UPDATE sale_fulfillment_lines
              SET fulfillment_status = 'CANCELLED', updated_at = NOW()
              WHERE id = $1
            `, [line.id]);
          }

          // Cancel pending inter-warehouse settlements related to this sale
          await client.query(`
            UPDATE inter_warehouse_settlements
            SET status = 'CANCELLED', notes = notes || ' (Annulé suite à annulation partielle de la vente)'
            WHERE status = 'PENDING' AND notes LIKE '%' || $1 || '%'
          `, [currentSale.invoice_number]);

          const cancelledAmount = pendingLines.reduce((acc, l) => acc + Number(l.subtotal), 0);
          const fulfilledAmount = fulfilledLines.reduce((acc, l) => acc + Number(l.subtotal), 0);

          // Compensating ledger entry for the cancelled portion only
          if (currentSale.client_id && cancelledAmount > 0) {
            const clientRes = await client.query('SELECT id, current_balance FROM clients WHERE id = $1 FOR UPDATE', [currentSale.client_id]);
            if (clientRes.rowCount && clientRes.rowCount > 0) {
              const prevBal = Number(clientRes.rows[0].current_balance || 0);
              const newBal = prevBal - cancelledAmount;

              await client.query(`
                INSERT INTO client_transactions (
                  client_id, warehouse_id, type, reference_type, reference_id,
                  debit, credit, running_balance, description, transaction_date, created_by, created_at
                ) VALUES ($1, $2, 'CREDIT_NOTE', 'SALES_PARTIAL_CANCEL', $3, 0, $4, $5, $6, NOW(), $7, NOW())
              `, [
                currentSale.client_id,
                currentSale.warehouse_id,
                id,
                cancelledAmount,
                newBal,
                `Annulation partielle vente ${currentSale.invoice_number} (lignes non retirées)`,
                req.user?.id || 1,
              ]);

              await client.query('UPDATE clients SET current_balance = $1, updated_at = NOW() WHERE id = $2', [newBal, currentSale.client_id]);
            }
          }

          // Adjust parent sale total to fulfilledAmount and status to PARTIALLY_CANCELLED
          await client.query(`
            UPDATE sales
            SET status = 'PARTIALLY_CANCELLED',
                total_amount = $1,
                updated_at = NOW()
            WHERE id = $2
          `, [fulfilledAmount, id]);

          return {
            id,
            status: 'PARTIALLY_CANCELLED',
            cancelledAmount,
            remainingTotal: fulfilledAmount,
            cancelledLinesCount: pendingLines.length,
            fulfilledLinesCount: fulfilledLines.length,
          };
        });

        await logAudit(req.user, 'SALE_CANCELLED_PARTIAL', 'SALE', id, `Partial cancellation of sale ${currentSale.invoice_number} (cancelled ${result.cancelledLinesCount} pending lines)`, currentSale.warehouse_id);
        return sendSuccess(res, result, 'Partial cancellation successful. Pending lines cancelled and fulfilled lines retained.');
      }
    }

    // Standard legacy sale cancellation (no fulfillment lines)
    await runTransaction(async (client) => {
      // 1. Reverse stock
      const itemsRes = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [id]);
      for (const item of itemsRes.rows) {
        await client.query(`
          UPDATE stock SET physical_quantity = physical_quantity + $1, updated_at = NOW()
          WHERE warehouse_id = $2 AND product_id = $3
        `, [item.quantity, currentSale.warehouse_id, item.product_id]);

        await client.query(`
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
          VALUES ($1, $2, 'SALE_CANCEL', $3, $4, 'Sale voided / cancelled')
        `, [currentSale.warehouse_id, item.product_id, item.quantity, currentSale.invoice_number]);
      }

      // 2. Compensating ledger entry if attached to a client
      if (currentSale.client_id) {
        const clientRes = await client.query('SELECT id, current_balance FROM clients WHERE id = $1 FOR UPDATE', [currentSale.client_id]);
        if (clientRes.rowCount && clientRes.rowCount > 0) {
          const prevBal = Number(clientRes.rows[0].current_balance || 0);
          const saleTotal = Number(currentSale.total_amount);
          const newBal = prevBal - saleTotal;

          await client.query(`
            INSERT INTO client_transactions (
              client_id, warehouse_id, type, reference_type, reference_id,
              debit, credit, running_balance, description, transaction_date, created_by, created_at
            ) VALUES ($1, $2, 'CREDIT_NOTE', 'SALES_CANCEL', $3, 0, $4, $5, $6, NOW(), $7, NOW())
          `, [
            currentSale.client_id,
            currentSale.warehouse_id,
            id,
            saleTotal,
            newBal,
            `Annulation vente ${currentSale.invoice_number}`,
            req.user?.id || 1,
          ]);

          await client.query('UPDATE clients SET current_balance = $1, updated_at = NOW() WHERE id = $2', [newBal, currentSale.client_id]);
        }
      }

      // 3. Remove payment allocations associated with this cancelled sale so payments become unallocated
      await client.query('DELETE FROM payment_allocations WHERE sale_id = $1', [id]);

      // 4. Update Sale Status
      await client.query("UPDATE sales SET status = 'CANCELLED', payment_status = 'CANCELLED', updated_at = NOW() WHERE id = $1", [id]);
    });

    await logAudit(req.user, 'SALE_CANCELLED', 'SALE', id, `Voided sale ${currentSale.invoice_number} and reversed stock/ledger`, currentSale.warehouse_id);
    return sendSuccess(res, { id, status: 'CANCELLED', paymentStatus: 'CANCELLED' }, 'Sale cancelled and reversed successfully');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
