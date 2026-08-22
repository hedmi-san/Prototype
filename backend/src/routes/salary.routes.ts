import { Router } from 'express';
import { query } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, AuthRequest, logAudit, validateWarehouseScope } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const period = req.query.period ? String(req.query.period) : undefined;

    let sql = `
      SELECT s.id, s.employee_id, e.full_name as employee_name,
             s.warehouse_id, w.name as warehouse_name,
             s.period, s.base_salary, s.bonus1, s.bonus2, s.total_amount,
             s.payment_date, s.created_at
      FROM salaries s
      JOIN employees e ON s.employee_id = e.id
      JOIN warehouses w ON s.warehouse_id = w.id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (warehouseId) {
      params.push(warehouseId);
      conditions.push(`s.warehouse_id = $${params.length}`);
    } else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
      params.push(req.user.warehouseId);
      conditions.push(`s.warehouse_id = $${params.length}`);
    }

    if (period) {
      params.push(period);
      conditions.push(`s.period = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY s.period DESC, s.payment_date DESC';

    const result = await query(sql, params);
    const salaries = result.rows.map((s: any) => ({
      id: s.id,
      employeeId: s.employee_id,
      employeeName: s.employee_name,
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

    return sendSuccess(res, salaries);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.post('/', authenticate, requireRole('ADMIN', 'ACCOUNTANT'), async (req: AuthRequest, res) => {
  try {
    const { employeeId, period, baseSalary, bonus1, bonus2, paymentDate } = req.body;
    if (!employeeId || !period) {
      return sendError(res, 'employeeId and period (YYYY-MM) are required', 400);
    }

    const employeeRes = await query('SELECT * FROM employees WHERE id = $1', [employeeId]);
    const employee = employeeRes.rows[0];
    if (!employee) return sendError(res, `Employee not found with id ${employeeId}`, 404);

    if (req.user) {
      try {
        validateWarehouseScope(req.user, employee.warehouse_id);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    const existingRes = await query('SELECT id FROM salaries WHERE employee_id = $1 AND period = $2', [employeeId, period]);
    if (existingRes.rowCount && existingRes.rowCount > 0) {
      return sendError(res, `Salary for employee ${employee.full_name} for period ${period} already recorded`, 400);
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
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
