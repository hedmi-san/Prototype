import { Router } from 'express';
import { db } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, logAudit, validateWarehouseScope } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, (req, res) => {
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
    const expenses = db.prepare(query).all(...params).map((e) => ({
        id: e.id,
        warehouseId: e.warehouse_id,
        warehouseName: e.warehouse_name,
        category: e.category,
        amount: e.amount,
        description: e.description,
        expenseDate: e.expense_date,
        createdAt: e.created_at,
    }));
    return sendSuccess(res, expenses);
});
router.post('/', authenticate, requireRole('ADMIN', 'MANAGER', 'ACCOUNTANT'), (req, res) => {
    const { warehouseId, category, amount, description, expenseDate } = req.body;
    const targetWarehouseId = warehouseId || req.user?.warehouseId;
    if (!targetWarehouseId || !category || amount === undefined || Number(amount) <= 0) {
        return sendError(res, 'warehouseId, category, and positive amount are required', 400);
    }
    if (req.user) {
        try {
            validateWarehouseScope(req.user, targetWarehouseId);
        }
        catch (err) {
            return sendError(res, err.message, 403);
        }
    }
    const stmt = db.prepare(`
    INSERT INTO expenses (warehouse_id, category, amount, description, expense_date)
    VALUES (?, ?, ?, ?, ?)
  `);
    const info = stmt.run(targetWarehouseId, category, Number(amount), description || '', expenseDate || new Date().toISOString().substring(0, 10));
    const newId = Number(info.lastInsertRowid);
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(newId);
    logAudit(req.user, 'EXPENSE_RECORDED', 'EXPENSE', newId, `Recorded ${category} expense of ${amount} DZD`, targetWarehouseId);
    return sendSuccess(res, expense, 'Expense recorded successfully', 201);
});
router.put('/:id', authenticate, requireRole('ADMIN', 'MANAGER', 'ACCOUNTANT'), (req, res) => {
    const id = Number(req.params.id);
    const { category, amount, description, expenseDate } = req.body;
    const current = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!current)
        return sendError(res, `Expense not found with id ${id}`, 404);
    const updatedCategory = category || current.category;
    const updatedAmount = amount !== undefined ? Number(amount) : current.amount;
    const updatedDesc = description !== undefined ? description : current.description;
    const updatedDate = expenseDate || current.expense_date;
    db.prepare(`
    UPDATE expenses
    SET category = ?, amount = ?, description = ?, expense_date = ?
    WHERE id = ?
  `).run(updatedCategory, updatedAmount, updatedDesc, updatedDate, id);
    const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    logAudit(req.user, 'EXPENSE_UPDATED', 'EXPENSE', id, `Updated expense of ${updatedAmount} DZD`, current.warehouse_id);
    return sendSuccess(res, updated, 'Expense updated successfully');
});
export default router;
