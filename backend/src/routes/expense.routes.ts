import { Router } from 'express';
import { query } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, AuthRequest, logAudit, validateWarehouseScope, enforceWarehouseScope } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const requestedWarehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const warehouseId = enforceWarehouseScope(req.user, requestedWarehouseId);
    let sql = `
      SELECT e.id, e.warehouse_id, w.name as warehouse_name,
             e.category, e.amount, e.description, e.expense_date, e.created_at
      FROM expenses e
      JOIN warehouses w ON e.warehouse_id = w.id
    `;

    const params: any[] = [];
    if (warehouseId) {
      params.push(warehouseId);
      sql += ` WHERE e.warehouse_id = $${params.length}`;
    }
    sql += ' ORDER BY e.expense_date DESC, e.id DESC';

    const result = await query(sql, params);
    const expenses = result.rows.map((e: any) => ({
      id: e.id,
      warehouseId: e.warehouse_id,
      warehouseName: e.warehouse_name,
      category: e.category,
      amount: Number(e.amount),
      description: e.description,
      expenseDate: e.expense_date,
      createdAt: e.created_at,
    }));

    return sendSuccess(res, expenses);
  } catch (err: any) {
    const isAccessDenied = err.message?.includes('Access denied');
    return sendError(res, err.message, isAccessDenied ? 403 : 500);
  }
});

router.post('/', authenticate, requireRole('ADMIN', 'MANAGER', 'ACCOUNTANT'), async (req: AuthRequest, res) => {
  try {
    const { warehouseId, category, amount, description, expenseDate } = req.body;
    const targetWarehouseId = warehouseId || req.user?.warehouseId;
    if (!targetWarehouseId || !category || amount === undefined || Number(amount) <= 0) {
      return sendError(res, 'warehouseId, category, and positive amount are required', 400);
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
      return sendError(res, `Impossible d'enregistrer une dépense : l'entrepôt (${targetWh ? targetWh.name : targetWarehouseId}) est inactif`, 400);
    }

    const insertRes = await query(`
      INSERT INTO expenses (warehouse_id, category, amount, description, expense_date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      targetWarehouseId,
      category,
      Number(amount),
      description || '',
      expenseDate || new Date().toISOString().substring(0, 10),
    ]);

    const expense = insertRes.rows[0];
    await logAudit(req.user, 'EXPENSE_RECORDED', 'EXPENSE', expense.id, `Recorded ${category} expense of ${amount} DZD`, targetWarehouseId);
    return sendSuccess(res, expense, 'Expense recorded successfully', 201);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.put('/:id', authenticate, requireRole('ADMIN', 'MANAGER', 'ACCOUNTANT'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { category, amount, description, expenseDate, warehouseId } = req.body;

    const currentRes = await query('SELECT * FROM expenses WHERE id = $1', [id]);
    const current = currentRes.rows[0];
    if (!current) return sendError(res, `Expense not found with id ${id}`, 404);

    if (req.user) {
      try {
        validateWarehouseScope(req.user, current.warehouse_id);
        if (warehouseId && warehouseId !== current.warehouse_id) {
          validateWarehouseScope(req.user, warehouseId);
        }
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    const updatedWarehouseId = (req.user?.role === 'ADMIN' && warehouseId) ? warehouseId : current.warehouse_id;
    const updatedCategory = category || current.category;
    const updatedAmount = amount !== undefined ? Number(amount) : Number(current.amount);
    const updatedDesc = description !== undefined ? description : current.description;
    const updatedDate = expenseDate || current.expense_date;

    if (updatedAmount <= 0) {
      return sendError(res, 'Le montant de la dépense doit être strictement positif', 400);
    }

    const updateRes = await query(`
      UPDATE expenses
      SET warehouse_id = $1, category = $2, amount = $3, description = $4, expense_date = $5
      WHERE id = $6
      RETURNING *
    `, [updatedWarehouseId, updatedCategory, updatedAmount, updatedDesc, updatedDate, id]);

    const updated = updateRes.rows[0];
    await logAudit(
      req.user,
      'EXPENSE_UPDATED',
      'EXPENSE',
      id,
      `Updated ${updatedCategory} expense to ${updatedAmount} DZD`,
      updatedWarehouseId,
      JSON.stringify(current),
      JSON.stringify(updated)
    );

    return sendSuccess(res, {
      id: updated.id,
      warehouseId: updated.warehouse_id,
      category: updated.category,
      amount: Number(updated.amount),
      description: updated.description,
      expenseDate: updated.expense_date,
      createdAt: updated.created_at,
    }, 'Expense updated successfully');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.delete('/:id', authenticate, requireRole('ADMIN', 'MANAGER', 'ACCOUNTANT'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const currentRes = await query('SELECT * FROM expenses WHERE id = $1', [id]);
    const current = currentRes.rows[0];
    if (!current) return sendError(res, `Expense not found with id ${id}`, 404);

    if (req.user) {
      try {
        validateWarehouseScope(req.user, current.warehouse_id);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    await query('DELETE FROM expenses WHERE id = $1', [id]);
    await logAudit(
      req.user,
      'EXPENSE_DELETED',
      'EXPENSE',
      id,
      `Deleted ${current.category} expense of ${current.amount} DZD`,
      current.warehouse_id,
      JSON.stringify(current),
      null
    );

    return sendSuccess(res, { id }, 'Expense deleted successfully');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
