import { Router } from 'express';
import { query } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, logAudit, validateWarehouseScope } from '../middleware/auth.js';
const router = Router();
// GET / - List salaries with period filtering, search, and pagination
router.get('/', authenticate, async (req, res) => {
    try {
        const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
        const period = req.query.period;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const search = req.query.search?.trim();
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
        const offset = (page - 1) * limit;
        let baseFromWhere = `
      FROM salaries s
      JOIN employees e ON s.employee_id = e.id
      JOIN warehouses w ON s.warehouse_id = w.id
    `;
        const params = [];
        const conditions = [];
        if (warehouseId) {
            params.push(warehouseId);
            conditions.push(`s.warehouse_id = $${params.length}`);
        }
        else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
            params.push(req.user.warehouseId);
            conditions.push(`s.warehouse_id = $${params.length}`);
        }
        if (period) {
            params.push(period);
            conditions.push(`s.period = $${params.length}`);
        }
        else if (startDate && endDate) {
            const startMonth = startDate.slice(0, 7);
            const endMonth = endDate.slice(0, 7);
            params.push(startMonth);
            const p1 = params.length;
            params.push(endMonth);
            const p2 = params.length;
            conditions.push(`(s.period >= $${p1} AND s.period <= $${p2})`);
        }
        if (search) {
            const p1 = params.length + 1;
            const p2 = params.length + 2;
            const p3 = params.length + 3;
            conditions.push(`(e.full_name ILIKE $${p1} OR w.name ILIKE $${p2} OR s.period ILIKE $${p3})`);
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }
        if (conditions.length > 0) {
            baseFromWhere += ' WHERE ' + conditions.join(' AND ');
        }
        // Count and total summary
        const countQuery = `
      SELECT COUNT(*) as count, COALESCE(SUM(s.total_amount), 0) as total_disbursed
      ${baseFromWhere}
    `;
        const countRes = await query(countQuery, params);
        const total = Number(countRes.rows[0]?.count || 0);
        const totalDisbursed = Number(countRes.rows[0]?.total_disbursed || 0);
        // Paginated rows query
        const selectParams = [...params, limit, offset];
        const limitIdx = selectParams.length - 1;
        const offsetIdx = selectParams.length;
        const selectQuery = `
      SELECT s.id, s.employee_id, e.full_name as employee_name, e.position as employee_position,
             s.warehouse_id, w.name as warehouse_name,
             s.period, s.base_salary, s.bonus1, s.bonus2, s.total_amount,
             s.payment_date, s.created_at
      ${baseFromWhere}
      ORDER BY s.period DESC, s.payment_date DESC, s.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;
        const result = await query(selectQuery, selectParams);
        const salaries = result.rows.map((s) => ({
            id: s.id,
            employeeId: s.employee_id,
            employeeName: s.employee_name,
            employeePosition: s.employee_position,
            warehouseId: s.warehouse_id,
            warehouseName: s.warehouse_name,
            period: s.period,
            baseSalary: Number(s.base_salary),
            bonus1: Number(s.bonus1),
            bonus2: Number(s.bonus2),
            totalAmount: Number(s.total_amount),
            paymentDate: s.payment_date,
            createdAt: s.created_at,
        }));
        return sendSuccess(res, {
            items: salaries,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
            summary: {
                totalDisbursed,
            },
        });
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
// POST / - Create salary disbursement (ADMIN, SUPER_MANAGER, MANAGER, ACCOUNTANT)
router.post('/', authenticate, requireRole('ADMIN', 'SUPER_MANAGER', 'MANAGER', 'ACCOUNTANT'), async (req, res) => {
    try {
        const { employeeId, period, baseSalary, bonus1, bonus2, paymentDate } = req.body;
        if (!employeeId || !period) {
            return sendError(res, 'employeeId and period (YYYY-MM) are required', 400);
        }
        const employeeRes = await query('SELECT * FROM employees WHERE id = $1', [employeeId]);
        const employee = employeeRes.rows[0];
        if (!employee)
            return sendError(res, `Employee not found with id ${employeeId}`, 404);
        if (req.user) {
            try {
                validateWarehouseScope(req.user, employee.warehouse_id);
            }
            catch (err) {
                return sendError(res, err.message, 403);
            }
        }
        // Validate that employee warehouse is active
        const whRes = await query('SELECT id, name, active FROM warehouses WHERE id = $1', [employee.warehouse_id]);
        const targetWh = whRes.rows[0];
        if (!targetWh || !targetWh.active) {
            return sendError(res, `Impossible d'enregistrer un salaire : l'entrepôt (${targetWh ? targetWh.name : employee.warehouse_id}) est inactif`, 400);
        }
        const existingRes = await query('SELECT id FROM salaries WHERE employee_id = $1 AND period = $2', [employeeId, period]);
        if (existingRes.rowCount && existingRes.rowCount > 0) {
            return sendError(res, `Un versement de salaire pour l'employé ${employee.full_name} existe déjà pour la période ${period}`, 400);
        }
        const bSalary = baseSalary !== undefined ? Number(baseSalary) : Number(employee.base_salary);
        const b1 = bonus1 !== undefined ? Number(bonus1) : 0;
        const b2 = bonus2 !== undefined ? Number(bonus2) : 0;
        const total = bSalary + b1 + b2;
        const insertRes = await query(`
      INSERT INTO salaries (employee_id, warehouse_id, period, base_salary, bonus1, bonus2, total_amount, payment_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
            employeeId,
            employee.warehouse_id,
            period,
            bSalary,
            b1,
            b2,
            total,
            paymentDate || new Date().toISOString().substring(0, 10),
        ]);
        const salary = insertRes.rows[0];
        await logAudit(req.user, 'SALARY_PAID', 'SALARY', salary.id, `Processed salary of ${total} DZD for ${employee.full_name} (${period})`, employee.warehouse_id);
        return sendSuccess(res, salary, 'Salary recorded successfully', 201);
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
// PUT /:id - Update salary record (ADMIN, SUPER_MANAGER, MANAGER only)
router.put('/:id', authenticate, requireRole('ADMIN', 'SUPER_MANAGER', 'MANAGER'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { period, baseSalary, bonus1, bonus2, paymentDate } = req.body;
        const currentRes = await query(`
      SELECT s.*, e.full_name as employee_name, w.name as warehouse_name
      FROM salaries s
      JOIN employees e ON s.employee_id = e.id
      JOIN warehouses w ON s.warehouse_id = w.id
      WHERE s.id = $1
    `, [id]);
        const current = currentRes.rows[0];
        if (!current)
            return sendError(res, `Salary record not found with id ${id}`, 404);
        if (req.user) {
            try {
                validateWarehouseScope(req.user, current.warehouse_id);
            }
            catch (err) {
                return sendError(res, err.message, 403);
            }
        }
        // Validate warehouse active status
        const whRes = await query('SELECT id, name, active FROM warehouses WHERE id = $1', [current.warehouse_id]);
        const targetWh = whRes.rows[0];
        if (!targetWh || !targetWh.active) {
            return sendError(res, `Impossible de modifier ce versement : l'entrepôt (${targetWh ? targetWh.name : current.warehouse_id}) est inactif`, 400);
        }
        const updatedPeriod = period ? String(period).trim() : current.period;
        if (updatedPeriod !== current.period) {
            const dupRes = await query('SELECT id FROM salaries WHERE employee_id = $1 AND period = $2 AND id != $3', [
                current.employee_id,
                updatedPeriod,
                id,
            ]);
            if (dupRes.rowCount && dupRes.rowCount > 0) {
                return sendError(res, `Un versement de salaire pour ${current.employee_name} existe déjà pour la période ${updatedPeriod}`, 400);
            }
        }
        const updatedBaseSalary = baseSalary !== undefined ? Number(baseSalary) : Number(current.base_salary);
        const updatedBonus1 = bonus1 !== undefined ? Number(bonus1) : Number(current.bonus1);
        const updatedBonus2 = bonus2 !== undefined ? Number(bonus2) : Number(current.bonus2);
        const updatedTotal = updatedBaseSalary + updatedBonus1 + updatedBonus2;
        const updatedPaymentDate = paymentDate || current.payment_date;
        const updateRes = await query(`
      UPDATE salaries
      SET period = $1, base_salary = $2, bonus1 = $3, bonus2 = $4, total_amount = $5, payment_date = $6
      WHERE id = $7
      RETURNING *
    `, [
            updatedPeriod,
            updatedBaseSalary,
            updatedBonus1,
            updatedBonus2,
            updatedTotal,
            updatedPaymentDate,
            id,
        ]);
        const updated = updateRes.rows[0];
        await logAudit(req.user, 'SALARY_UPDATED', 'SALARY', id, `Updated salary of ${current.employee_name} (${updatedPeriod}) to ${updatedTotal} DZD`, current.warehouse_id, JSON.stringify(current), JSON.stringify(updated));
        return sendSuccess(res, {
            id: updated.id,
            employeeId: updated.employee_id,
            employeeName: current.employee_name,
            warehouseId: updated.warehouse_id,
            warehouseName: current.warehouse_name,
            period: updated.period,
            baseSalary: Number(updated.base_salary),
            bonus1: Number(updated.bonus1),
            bonus2: Number(updated.bonus2),
            totalAmount: Number(updated.total_amount),
            paymentDate: updated.payment_date,
            createdAt: updated.created_at,
        }, 'Salary record updated successfully');
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
// DELETE /:id - Delete salary record (ADMIN, SUPER_MANAGER, MANAGER only)
router.delete('/:id', authenticate, requireRole('ADMIN', 'SUPER_MANAGER', 'MANAGER'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const currentRes = await query(`
      SELECT s.*, e.full_name as employee_name, w.name as warehouse_name
      FROM salaries s
      JOIN employees e ON s.employee_id = e.id
      JOIN warehouses w ON s.warehouse_id = w.id
      WHERE s.id = $1
    `, [id]);
        const current = currentRes.rows[0];
        if (!current)
            return sendError(res, `Salary record not found with id ${id}`, 404);
        if (req.user) {
            try {
                validateWarehouseScope(req.user, current.warehouse_id);
            }
            catch (err) {
                return sendError(res, err.message, 403);
            }
        }
        await query('DELETE FROM salaries WHERE id = $1', [id]);
        await logAudit(req.user, 'SALARY_DELETED', 'SALARY', id, `Deleted salary record of ${current.employee_name} for period ${current.period} (${current.total_amount} DZD)`, current.warehouse_id, JSON.stringify(current), null);
        return sendSuccess(res, { id }, 'Salary record deleted successfully');
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
export default router;
