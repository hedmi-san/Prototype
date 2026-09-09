import { Router } from 'express';
import { query, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { generateCsv, sendCsv, CsvColumn } from '../common/csv.js';
import { authenticate, requireRole, AuthRequest, logAudit, validateWarehouseScope, enforceWarehouseScope } from '../middleware/auth.js';

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

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const saleRes = await query(`
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

    return sendSuccess(res, {
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

      // 2. Validate and deduct stock atomically
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

      const saleRes = await client.query(`
        INSERT INTO sales (
          invoice_number, warehouse_id, user_id, employee_id, client_id,
          customer_name, customer_phone, total_amount, paid_amount, advance_deducted, payment_status,
          status, sale_date, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'COMPLETED', COALESCE($12::timestamptz, NOW()), NOW(), NOW())
        RETURNING id
      `, [
        invoiceNumber,
        targetWarehouseId,
        req.user ? req.user.id : 1,
        parsedEmployeeId,
        targetClientId,
        finalCustomerName,
        customerPhone || clientRecord?.phone || '',
        totalAmount,
        paidAmount,
        advanceDeducted,
        paymentStatus,
        formattedSaleDate,
      ]);

      const saleId = saleRes.rows[0].id;

      // 5. Create Sale Items
      for (const item of items) {
        const prodRes = await client.query('SELECT sale_price FROM products WHERE id = $1', [item.productId]);
        const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(prodRes.rows[0].sale_price);
        const subtotal = Number(item.quantity) * unitPrice;

        await client.query(`
          INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
          VALUES ($1, $2, $3, $4, $5)
        `, [saleId, item.productId, Number(item.quantity), unitPrice, subtotal]);
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

    const responsePayload = {
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
          const newBal = prevBal - saleTotal; // Reversing the original invoice debit

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
