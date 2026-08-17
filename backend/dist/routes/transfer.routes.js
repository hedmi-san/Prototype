"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_js_1 = require("../db/database.js");
const response_js_1 = require("../common/response.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
router.get('/', auth_js_1.authenticate, (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    let query = `
    SELECT t.id, t.transfer_number,
           t.source_warehouse_id, sw.name as source_warehouse_name,
           t.destination_warehouse_id, dw.name as destination_warehouse_name,
           t.requested_by_user_id, u.full_name as requested_by_name,
           t.status, t.notes, t.created_at, t.updated_at
    FROM transfers t
    JOIN warehouses sw ON t.source_warehouse_id = sw.id
    JOIN warehouses dw ON t.destination_warehouse_id = dw.id
    JOIN users u ON t.requested_by_user_id = u.id
  `;
    const params = [];
    if (warehouseId) {
        query += ' WHERE t.source_warehouse_id = ? OR t.destination_warehouse_id = ?';
        params.push(warehouseId, warehouseId);
    }
    else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
        query += ' WHERE t.source_warehouse_id = ? OR t.destination_warehouse_id = ?';
        params.push(req.user.warehouseId, req.user.warehouseId);
    }
    query += ' ORDER BY t.created_at DESC, t.id DESC';
    const transfers = database_js_1.db.prepare(query).all(...params).map((t) => {
        const items = database_js_1.db.prepare(`
      SELECT ti.id, ti.product_id, p.name as product_name, p.reference as product_reference,
             ti.requested_quantity, ti.approved_quantity
      FROM transfer_items ti
      JOIN products p ON ti.product_id = p.id
      WHERE ti.transfer_id = ?
    `).all(t.id).map((i) => ({
            id: i.id,
            productId: i.product_id,
            productName: i.product_name,
            productReference: i.product_reference,
            requestedQuantity: i.requested_quantity,
            approvedQuantity: i.approved_quantity,
        }));
        return {
            id: t.id,
            transferNumber: t.transfer_number,
            sourceWarehouseId: t.source_warehouse_id,
            sourceWarehouseName: t.source_warehouse_name,
            destinationWarehouseId: t.destination_warehouse_id,
            destinationWarehouseName: t.destination_warehouse_name,
            requestedByUserId: t.requested_by_user_id,
            requestedByName: t.requested_by_name,
            status: t.status,
            notes: t.notes,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            items,
        };
    });
    return (0, response_js_1.sendSuccess)(res, transfers);
});
router.get('/:id', auth_js_1.authenticate, (req, res) => {
    const id = Number(req.params.id);
    const t = database_js_1.db.prepare(`
    SELECT t.id, t.transfer_number,
           t.source_warehouse_id, sw.name as source_warehouse_name,
           t.destination_warehouse_id, dw.name as destination_warehouse_name,
           t.requested_by_user_id, u.full_name as requested_by_name,
           t.status, t.notes, t.created_at, t.updated_at
    FROM transfers t
    JOIN warehouses sw ON t.source_warehouse_id = sw.id
    JOIN warehouses dw ON t.destination_warehouse_id = dw.id
    JOIN users u ON t.requested_by_user_id = u.id
    WHERE t.id = ?
  `).get(id);
    if (!t)
        return (0, response_js_1.sendError)(res, `Transfer not found with id ${id}`, 404);
    const items = database_js_1.db.prepare(`
    SELECT ti.id, ti.product_id, p.name as product_name, p.reference as product_reference,
           ti.requested_quantity, ti.approved_quantity
    FROM transfer_items ti
    JOIN products p ON ti.product_id = p.id
    WHERE ti.transfer_id = ?
  `).all(t.id).map((i) => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        productReference: i.product_reference,
        requestedQuantity: i.requested_quantity,
        approvedQuantity: i.approved_quantity,
    }));
    return (0, response_js_1.sendSuccess)(res, {
        id: t.id,
        transferNumber: t.transfer_number,
        sourceWarehouseId: t.source_warehouse_id,
        sourceWarehouseName: t.source_warehouse_name,
        destinationWarehouseId: t.destination_warehouse_id,
        destinationWarehouseName: t.destination_warehouse_name,
        requestedByUserId: t.requested_by_user_id,
        requestedByName: t.requested_by_name,
        status: t.status,
        notes: t.notes,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        items,
    });
});
router.post('/', auth_js_1.authenticate, (req, res) => {
    const { sourceWarehouseId, destinationWarehouseId, notes, items } = req.body;
    if (!sourceWarehouseId || !destinationWarehouseId || !items || !Array.isArray(items) || items.length === 0) {
        return (0, response_js_1.sendError)(res, 'sourceWarehouseId, destinationWarehouseId, and non-empty items are required', 400);
    }
    if (sourceWarehouseId === destinationWarehouseId) {
        return (0, response_js_1.sendError)(res, 'Source and destination warehouses must be different', 400);
    }
    try {
        const result = (0, database_js_1.runTransaction)(() => {
            const transferNumber = `TRF-${Date.now().toString().slice(-8)}`;
            const insert = database_js_1.db.prepare(`
        INSERT INTO transfers (transfer_number, source_warehouse_id, destination_warehouse_id, requested_by_user_id, status, notes)
        VALUES (?, ?, ?, ?, 'REQUESTED', ?)
      `);
            const info = insert.run(transferNumber, sourceWarehouseId, destinationWarehouseId, req.user?.id || 1, notes || '');
            const transferId = Number(info.lastInsertRowid);
            const insertItem = database_js_1.db.prepare(`
        INSERT INTO transfer_items (transfer_id, product_id, requested_quantity, approved_quantity)
        VALUES (?, ?, ?, 0)
      `);
            for (const item of items) {
                insertItem.run(transferId, item.productId, item.requestedQuantity);
            }
            return { id: transferId, transferNumber, status: 'REQUESTED' };
        });
        (0, auth_js_1.logAudit)(req.user, 'TRANSFER_REQUESTED', 'TRANSFER', result.id, `Created transfer request ${result.transferNumber}`, destinationWarehouseId);
        return (0, response_js_1.sendSuccess)(res, result, 'Transfer requested successfully', 201);
    }
    catch (err) {
        return (0, response_js_1.sendError)(res, err.message, 400);
    }
});
router.post('/:id/approve', auth_js_1.authenticate, (req, res) => {
    const id = Number(req.params.id);
    const { items } = req.body;
    const transfer = database_js_1.db.prepare('SELECT * FROM transfers WHERE id = ?').get(id);
    if (!transfer)
        return (0, response_js_1.sendError)(res, `Transfer not found with id ${id}`, 404);
    if (transfer.status !== 'REQUESTED')
        return (0, response_js_1.sendError)(res, `Cannot approve transfer in status ${transfer.status}`, 400);
    try {
        (0, database_js_1.runTransaction)(() => {
            // Reserve approved quantity at source warehouse
            const approvedItems = items && Array.isArray(items) ? items : [];
            const currentItems = database_js_1.db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id);
            for (const curItem of currentItems) {
                const matchingApproved = approvedItems.find((i) => i.productId === curItem.product_id);
                const qtyToApprove = matchingApproved ? matchingApproved.approvedQuantity : curItem.requested_quantity;
                const stock = database_js_1.db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(transfer.source_warehouse_id, curItem.product_id);
                const available = stock ? (stock.physical_quantity - stock.reserved_quantity) : 0;
                if (available < qtyToApprove) {
                    throw new Error(`Insufficient available stock at source warehouse to reserve ${qtyToApprove} units. Available: ${available}`);
                }
                database_js_1.db.prepare('UPDATE stock SET reserved_quantity = reserved_quantity + ?, updated_at = datetime("now") WHERE id = ?')
                    .run(qtyToApprove, stock.id);
                database_js_1.db.prepare('UPDATE transfer_items SET approved_quantity = ? WHERE id = ?').run(qtyToApprove, curItem.id);
            }
            database_js_1.db.prepare('UPDATE transfers SET status = "APPROVED", updated_at = datetime("now") WHERE id = ?').run(id);
        });
        (0, auth_js_1.logAudit)(req.user, 'TRANSFER_APPROVED', 'TRANSFER', id, `Approved transfer ${transfer.transfer_number} and reserved stock`, transfer.source_warehouse_id);
        return (0, response_js_1.sendSuccess)(res, { id, status: 'APPROVED' }, 'Transfer approved and stock reserved');
    }
    catch (err) {
        return (0, response_js_1.sendError)(res, err.message, 400);
    }
});
router.post('/:id/confirm', auth_js_1.authenticate, (req, res) => {
    const id = Number(req.params.id);
    const transfer = database_js_1.db.prepare('SELECT * FROM transfers WHERE id = ?').get(id);
    if (!transfer)
        return (0, response_js_1.sendError)(res, `Transfer not found with id ${id}`, 404);
    if (transfer.status !== 'APPROVED')
        return (0, response_js_1.sendError)(res, `Cannot confirm transfer in status ${transfer.status}`, 400);
    try {
        (0, database_js_1.runTransaction)(() => {
            const items = database_js_1.db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id);
            for (const item of items) {
                // Deduct physical and reserved at source
                database_js_1.db.prepare(`
          UPDATE stock
          SET physical_quantity = physical_quantity - ?, reserved_quantity = reserved_quantity - ?, updated_at = datetime('now')
          WHERE warehouse_id = ? AND product_id = ?
        `).run(item.approved_quantity, item.approved_quantity, transfer.source_warehouse_id, item.product_id);
                database_js_1.db.prepare(`
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
          VALUES (?, ?, 'TRANSFER_OUT', ?, ?, ?)
        `).run(transfer.source_warehouse_id, item.product_id, -item.approved_quantity, transfer.transfer_number, `Transfer out to warehouse ID ${transfer.destination_warehouse_id}`);
                // Add physical at destination
                const destStock = database_js_1.db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(transfer.destination_warehouse_id, item.product_id);
                if (destStock) {
                    database_js_1.db.prepare('UPDATE stock SET physical_quantity = physical_quantity + ?, updated_at = datetime("now") WHERE id = ?')
                        .run(item.approved_quantity, destStock.id);
                }
                else {
                    database_js_1.db.prepare('INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity) VALUES (?, ?, ?, 0)')
                        .run(transfer.destination_warehouse_id, item.product_id, item.approved_quantity);
                }
                database_js_1.db.prepare(`
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
          VALUES (?, ?, 'TRANSFER_IN', ?, ?, ?)
        `).run(transfer.destination_warehouse_id, item.product_id, item.approved_quantity, transfer.transfer_number, `Transfer in from warehouse ID ${transfer.source_warehouse_id}`);
            }
            database_js_1.db.prepare('UPDATE transfers SET status = "CONFIRMED", updated_at = datetime("now") WHERE id = ?').run(id);
        });
        (0, auth_js_1.logAudit)(req.user, 'TRANSFER_CONFIRMED', 'TRANSFER', id, `Confirmed transfer receipt ${transfer.transfer_number}`, transfer.destination_warehouse_id);
        return (0, response_js_1.sendSuccess)(res, { id, status: 'CONFIRMED' }, 'Transfer confirmed and inventory updated');
    }
    catch (err) {
        return (0, response_js_1.sendError)(res, err.message, 500);
    }
});
router.post('/:id/decline', auth_js_1.authenticate, (req, res) => {
    const id = Number(req.params.id);
    const transfer = database_js_1.db.prepare('SELECT * FROM transfers WHERE id = ?').get(id);
    if (!transfer)
        return (0, response_js_1.sendError)(res, `Transfer not found with id ${id}`, 404);
    if (transfer.status !== 'REQUESTED')
        return (0, response_js_1.sendError)(res, `Cannot decline transfer in status ${transfer.status}`, 400);
    database_js_1.db.prepare('UPDATE transfers SET status = "DECLINED", updated_at = datetime("now") WHERE id = ?').run(id);
    (0, auth_js_1.logAudit)(req.user, 'TRANSFER_DECLINED', 'TRANSFER', id, `Declined transfer request ${transfer.transfer_number}`, transfer.source_warehouse_id);
    return (0, response_js_1.sendSuccess)(res, { id, status: 'DECLINED' }, 'Transfer declined');
});
router.post('/:id/cancel', auth_js_1.authenticate, (req, res) => {
    const id = Number(req.params.id);
    const transfer = database_js_1.db.prepare('SELECT * FROM transfers WHERE id = ?').get(id);
    if (!transfer)
        return (0, response_js_1.sendError)(res, `Transfer not found with id ${id}`, 404);
    if (transfer.status === 'CONFIRMED' || transfer.status === 'CANCELLED') {
        return (0, response_js_1.sendError)(res, `Cannot cancel transfer in status ${transfer.status}`, 400);
    }
    try {
        (0, database_js_1.runTransaction)(() => {
            // If approved, release reservation
            if (transfer.status === 'APPROVED') {
                const items = database_js_1.db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id);
                for (const item of items) {
                    database_js_1.db.prepare('UPDATE stock SET reserved_quantity = reserved_quantity - ?, updated_at = datetime("now") WHERE warehouse_id = ? AND product_id = ?')
                        .run(item.approved_quantity, transfer.source_warehouse_id, item.product_id);
                }
            }
            database_js_1.db.prepare('UPDATE transfers SET status = "CANCELLED", updated_at = datetime("now") WHERE id = ?').run(id);
        });
        (0, auth_js_1.logAudit)(req.user, 'TRANSFER_CANCELLED', 'TRANSFER', id, `Cancelled transfer ${transfer.transfer_number} and released reservation`, transfer.source_warehouse_id);
        return (0, response_js_1.sendSuccess)(res, { id, status: 'CANCELLED' }, 'Transfer cancelled');
    }
    catch (err) {
        return (0, response_js_1.sendError)(res, err.message, 500);
    }
});
exports.default = router;
