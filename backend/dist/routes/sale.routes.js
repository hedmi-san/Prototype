import { Router } from 'express';
import { db, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { generateCsv, sendCsv } from '../common/csv.js';
import { authenticate, logAudit, validateWarehouseScope } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const search = req.query.search?.trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    let baseFromWhere = `
    FROM sales s
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN users u ON s.user_id = u.id
  `;
    const whereClauses = [];
    const params = [];
    if (warehouseId) {
        whereClauses.push('s.warehouse_id = ?');
        params.push(warehouseId);
    }
    else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
        whereClauses.push('s.warehouse_id = ?');
        params.push(req.user.warehouseId);
    }
    if (startDate) {
        const formattedStart = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
        whereClauses.push('COALESCE(s.sale_date, s.created_at) >= ?');
        params.push(formattedStart);
    }
    if (endDate) {
        const formattedEnd = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
        whereClauses.push('COALESCE(s.sale_date, s.created_at) <= ?');
        params.push(formattedEnd);
    }
    if (search) {
        whereClauses.push('(s.invoice_number LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ? OR w.name LIKE ?)');
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    if (whereClauses.length > 0) {
        baseFromWhere += ' WHERE ' + whereClauses.join(' AND ');
    }
    // Count total matching records
    const countQuery = `SELECT COUNT(*) as count ${baseFromWhere}`;
    const total = db.prepare(countQuery).get(...params)?.count || 0;
    // Fetch paginated slice
    const selectQuery = `
    SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
           s.user_id, u.full_name as user_name, s.customer_name, s.customer_phone,
           s.total_amount, s.status, COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at, s.updated_at
    ${baseFromWhere}
    ORDER BY COALESCE(s.sale_date, s.created_at) DESC, s.id DESC
    LIMIT ? OFFSET ?
  `;
    const salesRows = db.prepare(selectQuery).all(...params, limit, offset);
    // Batch-fetch line items for the paginated slice (eliminating N+1 queries)
    const saleIds = salesRows.map((s) => s.id);
    const itemsBySaleId = {};
    if (saleIds.length > 0) {
        const placeholders = saleIds.map(() => '?').join(',');
        const itemsQuery = `
      SELECT si.id, si.sale_id, si.product_id, p.name as product_name, p.reference as product_reference,
             si.quantity, si.unit_price, si.subtotal
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id IN (${placeholders})
    `;
        const itemRows = db.prepare(itemsQuery).all(...saleIds);
        for (const item of itemRows) {
            if (!itemsBySaleId[item.sale_id]) {
                itemsBySaleId[item.sale_id] = [];
            }
            itemsBySaleId[item.sale_id].push({
                id: item.id,
                productId: item.product_id,
                productName: item.product_name,
                productReference: item.product_reference,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                subtotal: item.subtotal,
            });
        }
    }
    const items = salesRows.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoice_number,
        warehouseId: s.warehouse_id,
        warehouseName: s.warehouse_name,
        warehouseCode: s.warehouse_code,
        userId: s.user_id,
        userName: s.user_name,
        createdById: s.user_id,
        createdByName: s.user_name,
        customerName: s.customer_name,
        customerPhone: s.customer_phone,
        totalAmount: s.total_amount,
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
});
router.get('/export/csv', authenticate, (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const search = req.query.search?.trim();
    let baseFromWhere = `
    FROM sales s
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN users u ON s.user_id = u.id
  `;
    const whereClauses = [];
    const params = [];
    if (warehouseId) {
        if (req.user) {
            try {
                validateWarehouseScope(req.user, warehouseId);
            }
            catch (err) {
                return sendError(res, err.message, 403);
            }
        }
        whereClauses.push('s.warehouse_id = ?');
        params.push(warehouseId);
    }
    else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
        whereClauses.push('s.warehouse_id = ?');
        params.push(req.user.warehouseId);
    }
    if (startDate) {
        const formattedStart = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
        whereClauses.push('COALESCE(s.sale_date, s.created_at) >= ?');
        params.push(formattedStart);
    }
    if (endDate) {
        const formattedEnd = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
        whereClauses.push('COALESCE(s.sale_date, s.created_at) <= ?');
        params.push(formattedEnd);
    }
    if (search) {
        whereClauses.push('(s.invoice_number LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ? OR w.name LIKE ?)');
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    if (whereClauses.length > 0) {
        baseFromWhere += ' WHERE ' + whereClauses.join(' AND ');
    }
    const selectQuery = `
    SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
           s.user_id, u.full_name as user_name, s.customer_name, s.customer_phone,
           s.total_amount, s.status, COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at
    ${baseFromWhere}
    ORDER BY COALESCE(s.sale_date, s.created_at) DESC, s.id DESC
  `;
    const salesRows = db.prepare(selectQuery).all(...params);
    // Fetch items for all exported sales
    const saleIds = salesRows.map((s) => s.id);
    const itemsBySaleId = {};
    if (saleIds.length > 0) {
        const placeholders = saleIds.map(() => '?').join(',');
        const itemsQuery = `
      SELECT si.sale_id, p.name as product_name, si.quantity, si.unit_price, si.subtotal
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id IN (${placeholders})
    `;
        const itemRows = db.prepare(itemsQuery).all(...saleIds);
        for (const item of itemRows) {
            if (!itemsBySaleId[item.sale_id]) {
                itemsBySaleId[item.sale_id] = [];
            }
            itemsBySaleId[item.sale_id].push(`${item.product_name} (x${item.quantity})`);
        }
    }
    const columns = [
        { header: 'N° Facture', key: 'invoice_number' },
        { header: 'Date Vente', key: 'sale_date' },
        { header: 'Dépôt', key: 'warehouse_name' },
        { header: 'Client', key: 'customer_name' },
        { header: 'Téléphone', key: 'customer_phone' },
        { header: 'Vendeur', key: 'user_name' },
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
});
router.get('/:id', authenticate, (req, res) => {
    const id = Number(req.params.id);
    const s = db.prepare(`
    SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
           s.user_id, u.full_name as user_name, s.customer_name, s.customer_phone,
           s.total_amount, s.status, COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at, s.updated_at
    FROM sales s
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(id);
    if (!s) {
        return sendError(res, `Sale not found with id ${id}`, 404);
    }
    const items = db.prepare(`
    SELECT si.id, si.product_id, p.name as product_name, p.reference as product_reference,
           si.quantity, si.unit_price, si.subtotal
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.sale_id = ?
  `).all(s.id).map((i) => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        productReference: i.product_reference,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        subtotal: i.subtotal,
    }));
    return sendSuccess(res, {
        id: s.id,
        invoiceNumber: s.invoice_number,
        warehouseId: s.warehouse_id,
        warehouseName: s.warehouse_name,
        warehouseCode: s.warehouse_code,
        userId: s.user_id,
        userName: s.user_name,
        createdById: s.user_id,
        createdByName: s.user_name,
        customerName: s.customer_name,
        customerPhone: s.customer_phone,
        totalAmount: s.total_amount,
        saleDate: s.sale_date || s.created_at,
        status: s.status,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        items,
    });
});
function normalizeSaleDate(input) {
    if (!input || typeof input !== 'string')
        return null;
    let str = input.trim();
    if (!str)
        return null;
    str = str.replace('T', ' ');
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(str)) {
        str += ':00';
    }
    else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        str += ' 00:00:00';
    }
    if (str.length > 19) {
        str = str.slice(0, 19);
    }
    return str;
}
router.post('/', authenticate, (req, res) => {
    const { warehouseId, customerName, customerPhone, saleDate, items } = req.body;
    const targetWarehouseId = warehouseId || req.user?.warehouseId;
    if (!targetWarehouseId || !items || !Array.isArray(items) || items.length === 0) {
        return sendError(res, 'warehouseId and non-empty items array are required', 400);
    }
    if (req.user) {
        try {
            validateWarehouseScope(req.user, targetWarehouseId);
        }
        catch (err) {
            return sendError(res, err.message, 403);
        }
    }
    try {
        const sale = runTransaction(() => {
            const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
            let totalAmount = 0;
            // 1. Validate and deduct stock atomically
            for (const item of items) {
                const product = db.prepare('SELECT id, name, sale_price FROM products WHERE id = ?').get(item.productId);
                if (!product)
                    throw new Error(`Product not found with id ${item.productId}`);
                const stock = db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(targetWarehouseId, item.productId);
                const available = stock ? (stock.physical_quantity - stock.reserved_quantity) : 0;
                if (available < item.quantity) {
                    throw new Error(`Insufficient stock for product ${product.name}. Available: ${available}, Requested: ${item.quantity}`);
                }
                db.prepare("UPDATE stock SET physical_quantity = physical_quantity - ?, updated_at = datetime('now') WHERE id = ?")
                    .run(item.quantity, stock.id);
                db.prepare(`
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
          VALUES (?, ?, 'SALE', ?, ?, ?)
        `).run(targetWarehouseId, item.productId, -item.quantity, invoiceNumber, `Sale to ${customerName || 'Retail Customer'}`);
                totalAmount += item.quantity * (item.unitPrice || product.sale_price);
            }
            // 2. Create Sale Record with normalized full timestamp (including seconds)
            const formattedSaleDate = normalizeSaleDate(saleDate);
            const insertSale = db.prepare(`
        INSERT INTO sales (invoice_number, warehouse_id, user_id, customer_name, customer_phone, total_amount, status, sale_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', COALESCE(?, datetime('now')), datetime('now'), datetime('now'))
      `);
            const saleInfo = insertSale.run(invoiceNumber, targetWarehouseId, req.user ? req.user.id : 1, customerName || 'Retail Customer', customerPhone || '', totalAmount, formattedSaleDate);
            const saleId = Number(saleInfo.lastInsertRowid);
            // 3. Create Sale Items
            const insertItem = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `);
            for (const item of items) {
                const product = db.prepare('SELECT sale_price FROM products WHERE id = ?').get(item.productId);
                const unitPrice = item.unitPrice || product.sale_price;
                insertItem.run(saleId, item.productId, item.quantity, unitPrice, item.quantity * unitPrice);
            }
            return { id: saleId, invoiceNumber, totalAmount, saleDate: formattedSaleDate };
        });
        logAudit(req.user, 'SALE_CREATED', 'SALE', sale.id, `Created sale ${sale.invoiceNumber} (Total: ${sale.totalAmount} DZD)`, targetWarehouseId);
        return sendSuccess(res, sale, 'Sale completed successfully', 201);
    }
    catch (err) {
        return sendError(res, err.message, 400);
    }
});
router.put('/:id', authenticate, (req, res) => {
    const id = Number(req.params.id);
    const { customerName, customerPhone, saleDate, items } = req.body;
    const currentSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!currentSale) {
        return sendError(res, `Sale not found with id ${id}`, 404);
    }
    if (currentSale.status === 'CANCELLED') {
        return sendError(res, 'Cannot edit a cancelled sale', 400);
    }
    try {
        const updatedSale = runTransaction(() => {
            let newTotal = currentSale.total_amount;
            // 1. Revert previous inventory items and re-apply if items provided
            if (items && Array.isArray(items) && items.length > 0) {
                const existingItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
                for (const item of existingItems) {
                    db.prepare("UPDATE stock SET physical_quantity = physical_quantity + ?, updated_at = datetime('now') WHERE warehouse_id = ? AND product_id = ?")
                        .run(item.quantity, currentSale.warehouse_id, item.product_id);
                }
                // 2. Delete existing items
                db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
                // 3. Apply new items and validate stock
                newTotal = 0;
                const insertItem = db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
          VALUES (?, ?, ?, ?, ?)
        `);
                for (const item of items) {
                    const product = db.prepare('SELECT id, name, sale_price FROM products WHERE id = ?').get(item.productId);
                    if (!product)
                        throw new Error(`Product not found with id ${item.productId}`);
                    const stock = db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(currentSale.warehouse_id, item.productId);
                    const available = stock ? (stock.physical_quantity - stock.reserved_quantity) : 0;
                    if (available < item.quantity) {
                        throw new Error(`Insufficient stock for product ${product.name}. Available: ${available}, Requested: ${item.quantity}`);
                    }
                    db.prepare("UPDATE stock SET physical_quantity = physical_quantity - ?, updated_at = datetime('now') WHERE id = ?")
                        .run(item.quantity, stock.id);
                    const unitPrice = item.unitPrice || product.sale_price;
                    const subtotal = item.quantity * unitPrice;
                    insertItem.run(id, item.productId, item.quantity, unitPrice, subtotal);
                    newTotal += subtotal;
                }
                db.prepare(`
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
          VALUES (?, ?, 'SALE_EDIT', 0, ?, 'Sale modified with inventory reconciliation')
        `).run(currentSale.warehouse_id, items[0]?.productId || 1, currentSale.invoice_number);
            }
            const formattedSaleDate = saleDate !== undefined
                ? normalizeSaleDate(saleDate)
                : currentSale.sale_date;
            // 4. Update Sale header
            db.prepare(`
        UPDATE sales
        SET customer_name = ?, customer_phone = ?, total_amount = ?, sale_date = COALESCE(?, sale_date, created_at), updated_at = datetime('now')
        WHERE id = ?
      `).run(customerName !== undefined ? customerName : currentSale.customer_name, customerPhone !== undefined ? customerPhone : currentSale.customer_phone, newTotal, formattedSaleDate, id);
            return { id, invoiceNumber: currentSale.invoice_number, totalAmount: newTotal, saleDate: formattedSaleDate };
        });
        logAudit(req.user, 'SALE_MODIFIED', 'SALE', id, `Modified sale ${currentSale.invoice_number}`, currentSale.warehouse_id);
        return sendSuccess(res, updatedSale, 'Sale updated successfully');
    }
    catch (err) {
        return sendError(res, err.message, 400);
    }
});
router.post('/:id/cancel', authenticate, (req, res) => {
    const id = Number(req.params.id);
    const currentSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!currentSale) {
        return sendError(res, `Sale not found with id ${id}`, 404);
    }
    if (currentSale.status === 'CANCELLED') {
        return sendError(res, 'Sale is already cancelled', 400);
    }
    try {
        runTransaction(() => {
            // Revert items stock
            const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
            for (const item of items) {
                db.prepare("UPDATE stock SET physical_quantity = physical_quantity + ?, updated_at = datetime('now') WHERE warehouse_id = ? AND product_id = ?")
                    .run(item.quantity, currentSale.warehouse_id, item.product_id);
                db.prepare(`
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
          VALUES (?, ?, 'SALE_CANCEL', ?, ?, 'Sale voided / cancelled')
        `).run(currentSale.warehouse_id, item.product_id, item.quantity, currentSale.invoice_number);
            }
            db.prepare("UPDATE sales SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?").run(id);
        });
        logAudit(req.user, 'SALE_CANCELLED', 'SALE', id, `Voided sale ${currentSale.invoice_number} and reversed stock`, currentSale.warehouse_id);
        return sendSuccess(res, { id, status: 'CANCELLED' }, 'Sale cancelled and stock reversed successfully');
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
export default router;
