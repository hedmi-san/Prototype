import { Router } from 'express';
import { query, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { generateCsv, sendCsv, CsvColumn } from '../common/csv.js';
import { authenticate, AuthRequest, logAudit, validateWarehouseScope } from '../middleware/auth.js';

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

  try {
    await runTransaction(async (client) => {
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

      await client.query("UPDATE sales SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1", [id]);
    });

    await logAudit(req.user, 'SALE_CANCELLED', 'SALE', id, `Voided sale ${currentSale.invoice_number} and reversed stock`, currentSale.warehouse_id);
    return sendSuccess(res, { id, status: 'CANCELLED' }, 'Sale cancelled and stock reversed successfully');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
