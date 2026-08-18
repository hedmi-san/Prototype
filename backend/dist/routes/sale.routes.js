import { Router } from 'express';
import { db, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, logAudit, validateWarehouseScope } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    let query = `
    SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name,
           s.user_id, u.full_name as user_name, s.customer_name, s.customer_phone,
           s.total_amount, s.status, s.created_at, s.updated_at
    FROM sales s
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN users u ON s.user_id = u.id
  `;
    const params = [];
    if (warehouseId) {
        query += ' WHERE s.warehouse_id = ?';
        params.push(warehouseId);
    }
    else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
        query += ' WHERE s.warehouse_id = ?';
        params.push(req.user.warehouseId);
    }
    query += ' ORDER BY s.created_at DESC, s.id DESC';
    const sales = db.prepare(query).all(...params).map((s) => {
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
        return {
            id: s.id,
            invoiceNumber: s.invoice_number,
            warehouseId: s.warehouse_id,
            warehouseName: s.warehouse_name,
            userId: s.user_id,
            userName: s.user_name,
            customerName: s.customer_name,
            customerPhone: s.customer_phone,
            totalAmount: s.total_amount,
            status: s.status,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            items,
        };
    });
    return sendSuccess(res, sales);
});
router.get('/:id', authenticate, (req, res) => {
    const id = Number(req.params.id);
    const s = db.prepare(`
    SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name,
           s.user_id, u.full_name as user_name, s.customer_name, s.customer_phone,
           s.total_amount, s.status, s.created_at, s.updated_at
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
        userId: s.user_id,
        userName: s.user_name,
        customerName: s.customer_name,
        customerPhone: s.customer_phone,
        totalAmount: s.total_amount,
        status: s.status,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        items,
    });
});
router.post('/', authenticate, (req, res) => {
    const { warehouseId, customerName, customerPhone, items } = req.body;
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
            // 2. Create Sale Record
            const insertSale = db.prepare(`
        INSERT INTO sales (invoice_number, warehouse_id, user_id, customer_name, customer_phone, total_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED')
      `);
            const saleInfo = insertSale.run(invoiceNumber, targetWarehouseId, req.user ? req.user.id : 1, customerName || 'Retail Customer', customerPhone || '', totalAmount);
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
            return { id: saleId, invoiceNumber, totalAmount };
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
    const { customerName, customerPhone, items } = req.body;
    const currentSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!currentSale) {
        return sendError(res, `Sale not found with id ${id}`, 404);
    }
    if (currentSale.status === 'CANCELLED') {
        return sendError(res, 'Cannot edit a cancelled sale', 400);
    }
    try {
        const updatedSale = runTransaction(() => {
            // 1. Revert previous inventory items
            const existingItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
            for (const item of existingItems) {
                db.prepare("UPDATE stock SET physical_quantity = physical_quantity + ?, updated_at = datetime('now') WHERE warehouse_id = ? AND product_id = ?")
                    .run(item.quantity, currentSale.warehouse_id, item.product_id);
            }
            // 2. Delete existing items
            db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id);
            // 3. Apply new items and validate stock
            let newTotal = 0;
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
            // 4. Update Sale header
            db.prepare(`
        UPDATE sales
        SET customer_name = ?, customer_phone = ?, total_amount = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(customerName || currentSale.customer_name, customerPhone || currentSale.customer_phone, newTotal, id);
            db.prepare(`
        INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
        VALUES (?, ?, 'SALE_EDIT', 0, ?, 'Sale modified with inventory reconciliation')
      `).run(currentSale.warehouse_id, items[0]?.productId || 1, currentSale.invoice_number);
            return { id, invoiceNumber: currentSale.invoice_number, totalAmount: newTotal };
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
