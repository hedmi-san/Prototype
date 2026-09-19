import { Router } from 'express';
import { query, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { generateCsv, sendCsv, CsvColumn } from '../common/csv.js';
<<<<<<< Updated upstream
import { authenticate, AuthRequest, logAudit, validateWarehouseScope } from '../middleware/auth.js';
=======
import { authenticate, requireRole, AuthRequest, logAudit, validateWarehouseScope, enforceWarehouseScope, validateOriginWarehouseScope } from '../middleware/auth.js';
import {
  createStockReservation,
  releaseStockReservation,
  fulfillStockReservation,
  reassignReservationWarehouse,
  checkAndExpireReservations,
} from '../common/reservation.js';
import { createNotification } from '../common/notifications.js';
import { generateCreditNoteNumber, getCreditNoteValidityDays } from './credit-note.routes.js';
>>>>>>> Stashed changes

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
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
    `;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouseId) {
      params.push(warehouseId);
      whereClauses.push(`s.warehouse_id = $${params.length}`);
    } else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
      params.push(req.user.warehouseId);
      whereClauses.push(`s.warehouse_id = $${params.length}`);
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
      whereClauses.push(`(s.invoice_number ILIKE $${p1} OR s.customer_name ILIKE $${p2} OR s.customer_phone ILIKE $${p3} OR w.name ILIKE $${p4} OR e.full_name ILIKE $${p5})`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
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
             s.customer_name, s.customer_phone,
             s.total_amount, s.status, COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at, s.updated_at
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
      customerName: s.customer_name,
      customerPhone: s.customer_phone,
      totalAmount: Number(s.total_amount),
      saleDate: s.sale_date || s.created_at,
      status: s.status,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      items: itemsBySaleId[s.id] || [],
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    return sendSuccess(res, {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.get('/export/csv', authenticate, async (req: AuthRequest, res) => {
  try {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();

    let baseFromWhere = `
      FROM sales s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN employees e ON s.employee_id = e.id
    `;
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (warehouseId) {
      if (req.user) {
        try {
          validateWarehouseScope(req.user, warehouseId);
        } catch (err: any) {
          return sendError(res, err.message, 403);
        }
      }
      params.push(warehouseId);
      whereClauses.push(`s.warehouse_id = $${params.length}`);
    } else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
      params.push(req.user.warehouseId);
      whereClauses.push(`s.warehouse_id = $${params.length}`);
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
      whereClauses.push(`(s.invoice_number ILIKE $${p1} OR s.customer_name ILIKE $${p2} OR s.customer_phone ILIKE $${p3} OR w.name ILIKE $${p4} OR e.full_name ILIKE $${p5})`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (whereClauses.length > 0) {
      baseFromWhere += ' WHERE ' + whereClauses.join(' AND ');
    }

    const selectQuery = `
      SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
             s.user_id, u.full_name as user_name, s.employee_id, e.full_name as employee_name,
             s.customer_name, s.customer_phone,
             s.total_amount, s.status, COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at
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
      { header: 'Client', key: 'customer_name' },
      { header: 'Téléphone', key: 'customer_phone' },
      { header: 'Émis par', key: 'user_name' },
      { header: 'Agent de suivi', format: (s) => s.employee_name || 'Non spécifié' },
      { header: 'Montant Total (DZD)', key: 'total_amount' },
      {
        header: 'Statut',
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
             s.customer_name, s.customer_phone,
             s.total_amount, s.status, COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at, s.updated_at
      FROM sales s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN employees e ON s.employee_id = e.id
      WHERE s.id = $1
    `, [id]);

    const s = saleRes.rows[0];
    if (!s) {
      return sendError(res, `Sale not found with id ${id}`, 404);
    }

    const itemsRes = await query(`
      SELECT si.id, si.product_id, p.name as product_name, p.reference as product_reference,
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
      customerName: s.customer_name,
      customerPhone: s.customer_phone,
      totalAmount: Number(s.total_amount),
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
  const { warehouseId, employeeId, customerName, customerPhone, saleDate, items } = req.body;
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

  // Validate that target warehouse is active
  const whRes = await query('SELECT id, name, active FROM warehouses WHERE id = $1', [targetWarehouseId]);
  const targetWh = whRes.rows[0];
  if (!targetWh || !targetWh.active) {
    return sendError(res, `Impossible de créer une vente : l'entrepôt (${targetWh ? targetWh.name : targetWarehouseId}) est inactif`, 400);
  }

  // Validate employee if provided (must be active and in same warehouse)
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

  try {
    const sale = await runTransaction(async (client) => {
      const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
      let totalAmount = 0;

      // 1. Validate and deduct stock atomically
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
          throw new Error(`Insufficient stock for product ${product.name}. Available: ${available}, Requested: ${item.quantity}`);
        }

        await client.query(
          'UPDATE stock SET physical_quantity = physical_quantity - $1, updated_at = NOW() WHERE id = $2',
          [item.quantity, stock.id]
        );

        await client.query(`
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
          VALUES ($1, $2, 'SALE', $3, $4, $5)
        `, [targetWarehouseId, item.productId, -Number(item.quantity), invoiceNumber, `Sale to ${customerName || 'Retail Customer'}`]);

        const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(product.sale_price);
        if (isNaN(unitPrice) || unitPrice < 0) {
          throw new Error(`Prix unitaire invalide pour le produit ${product.name}`);
        }
        totalAmount += Number(item.quantity) * unitPrice;
      }

      // 2. Create Sale Record
      const formattedSaleDate = normalizeSaleDate(saleDate);
      const parsedEmployeeId = employeeId ? Number(employeeId) : null;

      const saleRes = await client.query(`
        INSERT INTO sales (invoice_number, warehouse_id, user_id, employee_id, customer_name, customer_phone, total_amount, status, sale_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED', COALESCE($8::timestamptz, NOW()), NOW(), NOW())
        RETURNING id
      `, [
        invoiceNumber,
        targetWarehouseId,
        req.user ? req.user.id : 1,
        parsedEmployeeId,
        customerName || 'Retail Customer',
        customerPhone || '',
        totalAmount,
        formattedSaleDate,
      ]);

      const saleId = saleRes.rows[0].id;

      // 3. Create Sale Items
      for (const item of items) {
        const prodRes = await client.query('SELECT sale_price FROM products WHERE id = $1', [item.productId]);
        const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(prodRes.rows[0].sale_price);
        const subtotal = Number(item.quantity) * unitPrice;

        await client.query(`
          INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
          VALUES ($1, $2, $3, $4, $5)
        `, [saleId, item.productId, Number(item.quantity), unitPrice, subtotal]);
      }

      return { id: saleId, invoiceNumber, totalAmount, saleDate: formattedSaleDate, employeeId: parsedEmployeeId };
    });

    await logAudit(req.user, 'SALE_CREATED', 'SALE', sale.id, `Created sale ${sale.invoiceNumber} (Total: ${sale.totalAmount} DZD)`, targetWarehouseId);

    const fullSaleRes = await query(`
      SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
             w.location as warehouse_address, w.contact_number as warehouse_phone,
             s.user_id, u.full_name as user_name, s.employee_id, e.full_name as employee_name,
             s.customer_name, s.customer_phone,
             s.total_amount, s.status, COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at, s.updated_at
      FROM sales s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN users u ON s.user_id = u.id
      LEFT JOIN employees e ON s.employee_id = e.id
      WHERE s.id = $1
    `, [sale.id]);

    const s = fullSaleRes.rows[0];
    const itemsRes = await query(`
      SELECT si.id, si.product_id, p.name as product_name, p.reference as product_reference,
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
      customerName: s.customer_name,
      customerPhone: s.customer_phone,
      totalAmount: Number(s.total_amount),
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
  const id = Number(req.params.id);
  const { employeeId, customerName, customerPhone, saleDate, items } = req.body;

  const currentRes = await query('SELECT * FROM sales WHERE id = $1', [id]);
  const currentSale = currentRes.rows[0];
  if (!currentSale) {
    return sendError(res, `Sale not found with id ${id}`, 404);
  }
  if (currentSale.status === 'CANCELLED') {
    return sendError(res, 'Cannot edit a cancelled sale', 400);
  }

  // Validate modified employee if provided (must be active and in same warehouse, unless unchanged from historical record)
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

  try {
    const updatedSale = await runTransaction(async (client) => {
      let newTotal = Number(currentSale.total_amount);

      if (items && Array.isArray(items) && items.length > 0) {
        const existingItemsRes = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [id]);
        for (const item of existingItemsRes.rows) {
          await client.query(`
            UPDATE stock SET physical_quantity = physical_quantity + $1, updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3
          `, [item.quantity, currentSale.warehouse_id, item.product_id]);
        }

        await client.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);

        newTotal = 0;
        for (const item of items) {
          const prodRes = await client.query('SELECT id, name, sale_price FROM products WHERE id = $1', [item.productId]);
          const product = prodRes.rows[0];
          if (!product) throw new Error(`Product not found with id ${item.productId}`);

          const stockRes = await client.query(
            'SELECT * FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
            [currentSale.warehouse_id, item.productId]
          );
          const stock = stockRes.rows[0];
          const physQty = stock ? Number(stock.physical_quantity) : 0;
          const resQty = stock ? Number(stock.reserved_quantity) : 0;
          const available = physQty - resQty;

          if (available < Number(item.quantity)) {
            throw new Error(`Insufficient stock for product ${product.name}. Available: ${available}, Requested: ${item.quantity}`);
          }

          await client.query(
            'UPDATE stock SET physical_quantity = physical_quantity - $1, updated_at = NOW() WHERE id = $2',
            [item.quantity, stock.id]
          );

          const unitPrice = item.unitPrice !== undefined ? Number(item.unitPrice) : Number(product.sale_price);
          if (isNaN(unitPrice) || unitPrice < 0) {
            throw new Error(`Prix unitaire invalide pour le produit ${product.name}`);
          }
          const subtotal = Number(item.quantity) * unitPrice;

          await client.query(`
            INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
            VALUES ($1, $2, $3, $4, $5)
          `, [id, item.productId, Number(item.quantity), unitPrice, subtotal]);

          newTotal += subtotal;
        }

        await client.query(`
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
          VALUES ($1, $2, 'SALE_EDIT', 0, $3, 'Sale modified with inventory reconciliation')
        `, [currentSale.warehouse_id, items[0]?.productId || 1, currentSale.invoice_number]);
      }

      const formattedSaleDate = saleDate !== undefined
        ? normalizeSaleDate(saleDate)
        : currentSale.sale_date;

      const parsedEmployeeId = employeeId !== undefined
        ? (employeeId ? Number(employeeId) : null)
        : currentSale.employee_id;

      await client.query(`
        UPDATE sales
        SET customer_name = $1, customer_phone = $2, total_amount = $3,
            employee_id = $4,
            sale_date = COALESCE($5::timestamptz, sale_date, created_at), updated_at = NOW()
        WHERE id = $6
      `, [
        customerName !== undefined ? customerName : currentSale.customer_name,
        customerPhone !== undefined ? customerPhone : currentSale.customer_phone,
        newTotal,
        parsedEmployeeId,
        formattedSaleDate,
        id,
      ]);

      return { id, invoiceNumber: currentSale.invoice_number, totalAmount: newTotal, saleDate: formattedSaleDate, employeeId: parsedEmployeeId };
    });

    await logAudit(req.user, 'SALE_MODIFIED', 'SALE', id, `Modified sale ${currentSale.invoice_number}`, currentSale.warehouse_id);
    return sendSuccess(res, updatedSale, 'Sale updated successfully');
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

router.post('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const currentRes = await query('SELECT * FROM sales WHERE id = $1', [id]);
  const currentSale = currentRes.rows[0];
  if (!currentSale) {
    return sendError(res, `Sale not found with id ${id}`, 404);
  }
  if (currentSale.status === 'CANCELLED') {
    return sendError(res, 'Sale is already cancelled', 400);
  }

<<<<<<< Updated upstream
  try {
    await runTransaction(async (client) => {
=======
async function handleClientSaleCancellationCredit(
  dbClient: any,
  currentSale: any,
  cancelledAmount: number,
  isPartial: boolean,
  options: {
    immediateRefund?: boolean;
    recipientName?: string;
    recipientPhone?: string;
    recipientIdCard?: string;
    refundWarehouseId?: number;
    notes?: string;
    user?: any;
  }
) {
  if (!currentSale.client_id || cancelledAmount <= 0) return null;

  const clientRes = await dbClient.query(
    'SELECT id, name, code, is_default, current_balance FROM clients WHERE id = $1 FOR UPDATE',
    [currentSale.client_id]
  );
  const clientRecord = clientRes.rows[0];
  if (!clientRecord) return null;

  const isDefault = Boolean(clientRecord.is_default);
  const prevBal = Number(clientRecord.current_balance || 0);
  const userId = options.user?.id || 1;

  if (isDefault) {
    const validityDays = await getCreditNoteValidityDays();
    const creditNoteNumber = generateCreditNoteNumber();

    if (options.immediateRefund) {
      if (!options.recipientName || !options.recipientName.trim()) {
        throw new Error('Le nom complet du bénéficiaire est obligatoire pour le remboursement immédiat du client passager.');
      }
      if (!options.recipientPhone || !options.recipientPhone.trim()) {
        throw new Error('Le numéro de téléphone du bénéficiaire est obligatoire pour le remboursement immédiat du client passager.');
      }

      // 1. Insert counter_credit_notes as FULLY_REFUNDED
      const cnRes = await dbClient.query(`
        INSERT INTO counter_credit_notes (
          credit_note_number, sale_id, client_id, warehouse_id,
          total_amount, refunded_amount, remaining_amount,
          status, issue_date, expiry_date, notes, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $5, 0.0, 'FULLY_REFUNDED', NOW(), NOW() + ($6 || ' days')::interval, $7, $8, NOW(), NOW())
        RETURNING id, credit_note_number, status
      `, [creditNoteNumber, currentSale.id, currentSale.client_id, currentSale.warehouse_id, cancelledAmount, validityDays, options.notes || null, userId]);
      const creditNoteId = cnRes.rows[0].id;

      // 2. Insert CREDIT_NOTE transaction
      const refType = isPartial ? 'SALES_PARTIAL_CANCEL' : 'SALES_CANCEL';
      await dbClient.query(`
        INSERT INTO client_transactions (
          client_id, warehouse_id, type, reference_type, reference_id,
          debit, credit, running_balance, description, transaction_date, created_by, created_at
        ) VALUES ($1, $2, 'CREDIT_NOTE', $3, $4, 0, $5, $6, $7, NOW(), $8, NOW())
      `, [currentSale.client_id, currentSale.warehouse_id, refType, currentSale.id, cancelledAmount, prevBal - cancelledAmount, `[${creditNoteNumber}] Avoir annulation vente ${currentSale.invoice_number}`, userId]);

      // 3. Insert REFUND transaction (brings balance back to prevBal)
      const refundTargetWh = Number(options.refundWarehouseId) || currentSale.warehouse_id;
      const d = new Date();
      const refundNumber = `REF-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const txRefundRes = await dbClient.query(`
        INSERT INTO client_transactions (
          client_id, warehouse_id, type, reference_type, reference_id,
          debit, credit, running_balance, description, transaction_date, created_by, created_at
        ) VALUES ($1, $2, 'REFUND', 'REFUND', $3, $4, 0, $5, $6, NOW(), $7, NOW())
        RETURNING id
      `, [currentSale.client_id, refundTargetWh, creditNoteId, cancelledAmount, prevBal, `Remboursement espèces guichet [${refundNumber}] suite annulation vente ${currentSale.invoice_number}`, userId]);
      const txRefundId = txRefundRes.rows[0].id;

      // 4. Insert client_refunds
      const cleanNotes = typeof options.notes === 'string' ? options.notes.trim() : '';
      const rfRes = await dbClient.query(`
        INSERT INTO client_refunds (
          refund_number, client_id, warehouse_id, credit_note_id,
          amount, refund_method, recipient_name, recipient_phone, recipient_id_card,
          notes, transaction_id, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, 'CASH', $6, $7, $8, $9, $10, $11, NOW())
        RETURNING id
      `, [refundNumber, currentSale.client_id, refundTargetWh, creditNoteId, cancelledAmount, options.recipientName.trim(), options.recipientPhone.trim(), options.recipientIdCard?.trim() || null, cleanNotes, txRefundId, userId]);

      return {
        creditNoteId,
        creditNoteNumber,
        status: 'FULLY_REFUNDED',
        totalAmount: cancelledAmount,
        refundId: rfRes.rows[0].id,
        refundNumber,
        isImmediateRefund: true,
      };
    } else {
      // Deferred credit note ticket
      const newBal = prevBal - cancelledAmount;
      const cnRes = await dbClient.query(`
        INSERT INTO counter_credit_notes (
          credit_note_number, sale_id, client_id, warehouse_id,
          total_amount, refunded_amount, remaining_amount,
          status, issue_date, expiry_date, notes, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 0.0, $5, 'PENDING', NOW(), NOW() + ($6 || ' days')::interval, $7, $8, NOW(), NOW())
        RETURNING id, credit_note_number, status, expiry_date
      `, [creditNoteNumber, currentSale.id, currentSale.client_id, currentSale.warehouse_id, cancelledAmount, validityDays, options.notes || null, userId]);
      const creditNoteId = cnRes.rows[0].id;

      const refType = isPartial ? 'SALES_PARTIAL_CANCEL' : 'SALES_CANCEL';
      await dbClient.query(`
        INSERT INTO client_transactions (
          client_id, warehouse_id, type, reference_type, reference_id,
          debit, credit, running_balance, description, transaction_date, created_by, created_at
        ) VALUES ($1, $2, 'CREDIT_NOTE', $3, $4, 0, $5, $6, $7, NOW(), $8, NOW())
      `, [currentSale.client_id, currentSale.warehouse_id, refType, currentSale.id, cancelledAmount, newBal, `[${creditNoteNumber}] Avoir annulation vente ${currentSale.invoice_number}`, userId]);

      await dbClient.query('UPDATE clients SET current_balance = $1, updated_at = NOW() WHERE id = $2', [newBal, currentSale.client_id]);

      return {
        creditNoteId,
        creditNoteNumber,
        status: 'PENDING',
        totalAmount: cancelledAmount,
        remainingAmount: cancelledAmount,
        expiryDate: cnRes.rows[0].expiry_date,
        isImmediateRefund: false,
      };
    }
  } else {
    // Nominative client
    const newBal = prevBal - cancelledAmount;
    const refType = isPartial ? 'SALES_PARTIAL_CANCEL' : 'SALES_CANCEL';
    await dbClient.query(`
      INSERT INTO client_transactions (
        client_id, warehouse_id, type, reference_type, reference_id,
        debit, credit, running_balance, description, transaction_date, created_by, created_at
      ) VALUES ($1, $2, 'CREDIT_NOTE', $3, $4, 0, $5, $6, $7, NOW(), $8, NOW())
    `, [currentSale.client_id, currentSale.warehouse_id, refType, currentSale.id, cancelledAmount, newBal, `${isPartial ? 'Annulation partielle' : 'Annulation complète'} vente ${currentSale.invoice_number}`, userId]);

    await dbClient.query('UPDATE clients SET current_balance = $1, updated_at = NOW() WHERE id = $2', [newBal, currentSale.client_id]);
    return null;
  }
}

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

    const {
      immediateRefund = false,
      recipientName,
      recipientPhone,
      recipientIdCard,
      refundWarehouseId,
      notes,
    } = req.body || {};

    const cancelOptions = {
      immediateRefund: Boolean(immediateRefund),
      recipientName: typeof recipientName === 'string' ? recipientName.trim() : '',
      recipientPhone: typeof recipientPhone === 'string' ? recipientPhone.trim() : '',
      recipientIdCard: typeof recipientIdCard === 'string' ? recipientIdCard.trim() : '',
      refundWarehouseId: refundWarehouseId ? Number(refundWarehouseId) : currentSale.warehouse_id,
      notes: typeof notes === 'string' ? notes.trim() : '',
      user: req.user,
    };

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

          const saleTotal = Number(currentSale.total_amount);
          const creditResult = await handleClientSaleCancellationCredit(client, currentSale, saleTotal, false, cancelOptions);

          await client.query('DELETE FROM payment_allocations WHERE sale_id = $1', [id]);
          await client.query("UPDATE sales SET status = 'CANCELLED', payment_status = 'CANCELLED', updated_at = NOW() WHERE id = $1", [id]);

          return {
            id,
            status: 'CANCELLED',
            paymentStatus: 'CANCELLED',
            creditNote: creditResult,
          };
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

          const cancelledAmount = pendingLines.reduce((acc, l) => acc + Number(l.subtotal), 0);
          const fulfilledAmount = fulfilledLines.reduce((acc, l) => acc + Number(l.subtotal), 0);

          let creditResult = null;
          if (cancelledAmount > 0) {
            creditResult = await handleClientSaleCancellationCredit(client, currentSale, cancelledAmount, true, cancelOptions);
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
            creditNote: creditResult,
          };
        });

        await logAudit(req.user, 'SALE_CANCELLED_PARTIAL', 'SALE', id, `Partial cancellation of sale ${currentSale.invoice_number} (cancelled ${result.cancelledLinesCount} pending lines)`, currentSale.warehouse_id);
        return sendSuccess(res, result, 'Partial cancellation successful. Pending lines cancelled and fulfilled lines retained.');
      }
    }

    // Standard legacy sale cancellation (no fulfillment lines)
    const result = await runTransaction(async (client) => {
      // 1. Reverse stock
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
      await client.query("UPDATE sales SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1", [id]);
    });

    await logAudit(req.user, 'SALE_CANCELLED', 'SALE', id, `Voided sale ${currentSale.invoice_number} and reversed stock`, currentSale.warehouse_id);
    return sendSuccess(res, { id, status: 'CANCELLED' }, 'Sale cancelled and stock reversed successfully');
=======
      const saleTotal = Number(currentSale.total_amount);
      const creditResult = await handleClientSaleCancellationCredit(client, currentSale, saleTotal, false, cancelOptions);

      // 3. Remove payment allocations associated with this cancelled sale so payments become unallocated
      await client.query('DELETE FROM payment_allocations WHERE sale_id = $1', [id]);

      // 4. Update Sale Status
      await client.query("UPDATE sales SET status = 'CANCELLED', payment_status = 'CANCELLED', updated_at = NOW() WHERE id = $1", [id]);

      return {
        id,
        status: 'CANCELLED',
        paymentStatus: 'CANCELLED',
        creditNote: creditResult,
      };
    });

    await logAudit(req.user, 'SALE_CANCELLED', 'SALE', id, `Voided sale ${currentSale.invoice_number} and reversed stock/ledger`, currentSale.warehouse_id);
    return sendSuccess(res, result, 'Sale cancelled and reversed successfully');
>>>>>>> Stashed changes
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
