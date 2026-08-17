"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_js_1 = require("../db/database.js");
const response_js_1 = require("../common/response.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
router.get('/stock', auth_js_1.authenticate, (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    if (warehouseId && req.user) {
        try {
            (0, auth_js_1.validateWarehouseScope)(req.user, warehouseId);
        }
        catch (err) {
            return (0, response_js_1.sendError)(res, err.message, 403);
        }
    }
    let query = `
    SELECT s.id, s.warehouse_id, w.name as warehouse_name,
           s.product_id, p.name as product_name, p.reference as product_reference, p.brand,
           s.physical_quantity, s.reserved_quantity,
           (s.physical_quantity - s.reserved_quantity) as available_quantity,
           p.purchase_price, p.sale_price,
           (s.physical_quantity * p.purchase_price) as total_valuation,
           p.min_stock_alert, s.updated_at
    FROM stock s
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN products p ON s.product_id = p.id
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
    query += ' ORDER BY w.name ASC, p.name ASC';
    const rows = database_js_1.db.prepare(query).all(...params).map((row) => ({
        id: row.id,
        warehouseId: row.warehouse_id,
        warehouseName: row.warehouse_name,
        productId: row.product_id,
        productName: row.product_name,
        productReference: row.product_reference,
        brand: row.brand,
        physicalQuantity: row.physical_quantity,
        reservedQuantity: row.reserved_quantity,
        availableQuantity: row.available_quantity,
        purchasePrice: row.purchase_price,
        salePrice: row.sale_price,
        totalValuation: row.total_valuation,
        minStockAlert: row.min_stock_alert,
        updatedAt: row.updated_at,
    }));
    return (0, response_js_1.sendSuccess)(res, rows);
});
router.get('/movements', auth_js_1.authenticate, (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    let query = `
    SELECT m.id, m.warehouse_id, w.name as warehouse_name,
           m.product_id, p.name as product_name, p.reference as product_reference,
           m.movement_type, m.quantity_change, m.reference, m.notes, m.created_at
    FROM stock_movements m
    JOIN warehouses w ON m.warehouse_id = w.id
    JOIN products p ON m.product_id = p.id
  `;
    const params = [];
    if (warehouseId) {
        query += ' WHERE m.warehouse_id = ?';
        params.push(warehouseId);
    }
    query += ' ORDER BY m.created_at DESC, m.id DESC LIMIT 200';
    const rows = database_js_1.db.prepare(query).all(...params).map((m) => ({
        id: m.id,
        warehouseId: m.warehouse_id,
        warehouseName: m.warehouse_name,
        productId: m.product_id,
        productName: m.product_name,
        productReference: m.product_reference,
        movementType: m.movement_type,
        quantityChange: m.quantity_change,
        reference: m.reference,
        notes: m.notes,
        createdAt: m.created_at,
    }));
    return (0, response_js_1.sendSuccess)(res, rows);
});
router.post('/initial-receipt', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN', 'MANAGER'), (req, res) => {
    const { warehouseId, productId, quantity, reference, notes } = req.body;
    if (!warehouseId || !productId || !quantity || quantity <= 0) {
        return (0, response_js_1.sendError)(res, 'warehouseId, productId, and positive quantity are required', 400);
    }
    try {
        const result = (0, database_js_1.runTransaction)(() => {
            const stock = database_js_1.db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, productId);
            if (stock) {
                database_js_1.db.prepare('UPDATE stock SET physical_quantity = physical_quantity + ?, updated_at = datetime("now") WHERE id = ?').run(quantity, stock.id);
            }
            else {
                database_js_1.db.prepare('INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity) VALUES (?, ?, ?, 0)').run(warehouseId, productId, quantity);
            }
            database_js_1.db.prepare(`
        INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
        VALUES (?, ?, 'INITIAL_STOCK', ?, ?, ?)
      `).run(warehouseId, productId, quantity, reference || 'INIT-STOCK', notes || 'Initial stock receipt');
            return database_js_1.db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, productId);
        });
        (0, auth_js_1.logAudit)(req.user, 'INITIAL_STOCK_RECEIVED', 'STOCK', productId, `Received ${quantity} units into warehouse ID ${warehouseId}`, warehouseId);
        return (0, response_js_1.sendSuccess)(res, result, 'Stock received successfully');
    }
    catch (err) {
        return (0, response_js_1.sendError)(res, err.message, 500);
    }
});
router.post('/adjustments', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN', 'MANAGER', 'ACCOUNTANT'), (req, res) => {
    const { warehouseId, productId, quantity, reason, notes } = req.body;
    if (!warehouseId || !productId || quantity === undefined) {
        return (0, response_js_1.sendError)(res, 'warehouseId, productId, and quantity adjustment are required', 400);
    }
    try {
        const result = (0, database_js_1.runTransaction)(() => {
            const stock = database_js_1.db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, productId);
            const currentQty = stock ? stock.physical_quantity : 0;
            const newQty = currentQty + Number(quantity);
            if (newQty < (stock ? stock.reserved_quantity : 0)) {
                throw new Error(`Adjustment invalid: physical stock (${newQty}) cannot be less than reserved transfer stock (${stock ? stock.reserved_quantity : 0})`);
            }
            if (stock) {
                database_js_1.db.prepare('UPDATE stock SET physical_quantity = ?, updated_at = datetime("now") WHERE id = ?').run(newQty, stock.id);
            }
            else {
                if (newQty < 0)
                    throw new Error('Initial stock quantity cannot be negative');
                database_js_1.db.prepare('INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity) VALUES (?, ?, ?, 0)').run(warehouseId, productId, newQty);
            }
            database_js_1.db.prepare(`
        INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
        VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?)
      `).run(warehouseId, productId, Number(quantity), reason || 'INVENTORY_AUDIT', notes || `Stock adjusted from ${currentQty} to ${newQty}`);
            return { warehouseId, productId, previousQuantity: currentQty, newQuantity: newQty };
        });
        (0, auth_js_1.logAudit)(req.user, 'STOCK_ADJUSTED', 'STOCK', productId, `Adjusted stock by ${quantity} units (Reason: ${reason})`, warehouseId);
        return (0, response_js_1.sendSuccess)(res, result, 'Stock adjusted successfully');
    }
    catch (err) {
        return (0, response_js_1.sendError)(res, err.message, 400);
    }
});
exports.default = router;
