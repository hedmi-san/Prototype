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
    SELECT e.id, e.warehouse_id, w.name as warehouse_name,
           e.category, e.amount, e.description, e.expense_date, e.created_at
    FROM expenses e
    JOIN warehouses w ON e.warehouse_id = w.id
  `;
    const params = [];
    if (warehouseId) {
        query += ' WHERE e.warehouse_id = ?';
        params.push(warehouseId);
    }
    else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
        query += ' WHERE e.warehouse_id = ?';
        params.push(req.user.warehouseId);
    }
    query += ' ORDER BY e.expense_date DESC, e.id DESC';
    const expenses = database_js_1.db.prepare(query).all(...params).map((e) => ({
        id: e.id,
        warehouseId: e.warehouse_id,
        warehouseName: e.warehouse_name,
        category: e.category,
        amount: e.amount,
        description: e.description,
        expenseDate: e.expense_date,
        createdAt: e.created_at,
    }));
    return (0, response_js_1.sendSuccess)(res, expenses);
});
router.post('/', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN', 'MANAGER', 'ACCOUNTANT'), (req, res) => {
    const { warehouseId, category, amount, description, expenseDate } = req.body;
    const targetWarehouseId = warehouseId || req.user?.warehouseId;
    if (!targetWarehouseId || !category || amount === undefined || Number(amount) <= 0) {
        return (0, response_js_1.sendError)(res, 'warehouseId, category, and positive amount are required', 400);
    }
    if (req.user) {
        try {
            (0, auth_js_1.validateWarehouseScope)(req.user, targetWarehouseId);
        }
        catch (err) {
            return (0, response_js_1.sendError)(res, err.message, 403);
        }
    }
    const stmt = database_js_1.db.prepare(`
    INSERT INTO expenses (warehouse_id, category, amount, description, expense_date)
    VALUES (?, ?, ?, ?, ?)
  `);
    const info = stmt.run(targetWarehouseId, category, Number(amount), description || '', expenseDate || new Date().toISOString().substring(0, 10));
    const newId = Number(info.lastInsertRowid);
    const expense = database_js_1.db.prepare('SELECT * FROM expenses WHERE id = ?').get(newId);
    (0, auth_js_1.logAudit)(req.user, 'EXPENSE_RECORDED', 'EXPENSE', newId, `Recorded ${category} expense of ${amount} DZD`, targetWarehouseId);
    return (0, response_js_1.sendSuccess)(res, expense, 'Expense recorded successfully', 201);
});
router.put('/:id', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN', 'MANAGER', 'ACCOUNTANT'), (req, res) => {
    const id = Number(req.params.id);
    const { category, amount, description, expenseDate } = req.body;
    const current = database_js_1.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!current)
        return (0, response_js_1.sendError)(res, `Expense not found with id ${id}`, 404);
    const updatedCategory = category || current.category;
    const updatedAmount = amount !== undefined ? Number(amount) : current.amount;
    const updatedDesc = description !== undefined ? description : current.description;
    const updatedDate = expenseDate || current.expense_date;
    database_js_1.db.prepare(`
    UPDATE expenses
    SET category = ?, amount = ?, description = ?, expense_date = ?
    WHERE id = ?
  `).run(updatedCategory, updatedAmount, updatedDesc, updatedDate, id);
    const updated = database_js_1.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    (0, auth_js_1.logAudit)(req.user, 'EXPENSE_UPDATED', 'EXPENSE', id, `Updated expense of ${updatedAmount} DZD`, current.warehouse_id);
    return (0, response_js_1.sendSuccess)(res, updated, 'Expense updated successfully');
});
exports.default = router;
