import { Router } from 'express';
import { db } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, AuthRequest, logAudit, validateWarehouseScope } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
  const period = req.query.period ? String(req.query.period) : undefined;

  let query = `
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
    conditions.push('s.warehouse_id = ?');
    params.push(warehouseId);
  } else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
    conditions.push('s.warehouse_id = ?');
    params.push(req.user.warehouseId);
  }

  if (period) {
    conditions.push('s.period = ?');
    params.push(period);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY s.period DESC, s.payment_date DESC';

  const salaries = db.prepare(query).all(...params).map((s: any) => ({
    id: s.id,
    employeeId: s.employee_id,
    employeeName: s.employee_name,
    warehouseId: s.warehouse_id,
    warehouseName: s.warehouse_name,
    period: s.period,
    baseSalary: s.base_salary,
    bonus1: s.bonus1,
    bonus2: s.bonus2,
    totalAmount: s.total_amount,
    paymentDate: s.payment_date,
    createdAt: s.created_at,
  }));

  return sendSuccess(res, salaries);
});

router.post('/', authenticate, requireRole('ADMIN', 'ACCOUNTANT'), (req: AuthRequest, res) => {
  const { employeeId, period, baseSalary, bonus1, bonus2, paymentDate } = req.body;
  if (!employeeId || !period) {
    return sendError(res, 'employeeId and period (YYYY-MM) are required', 400);
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId) as any;
  if (!employee) return sendError(res, `Employee not found with id ${employeeId}`, 404);

  if (req.user) {
    try {
      validateWarehouseScope(req.user, employee.warehouse_id);
    } catch (err: any) {
      return sendError(res, err.message, 403);
    }
  }

  const existing = db.prepare('SELECT id FROM salaries WHERE employee_id = ? AND period = ?').get(employeeId, period);
  if (existing) {
    return sendError(res, `Salary for employee ${employee.full_name} for period ${period} already recorded`, 400);
  }

  const bSalary = baseSalary !== undefined ? Number(baseSalary) : employee.base_salary;
  const b1 = bonus1 !== undefined ? Number(bonus1) : 0;
  const b2 = bonus2 !== undefined ? Number(bonus2) : 0;
  const total = bSalary + b1 + b2;

  const stmt = db.prepare(`
    INSERT INTO salaries (employee_id, warehouse_id, period, base_salary, bonus1, bonus2, total_amount, payment_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    employeeId,
    employee.warehouse_id,
    period,
    bSalary,
    b1,
    b2,
    total,
    paymentDate || new Date().toISOString().substring(0, 10)
  );

  const newId = Number(info.lastInsertRowid);
  const salary = db.prepare('SELECT * FROM salaries WHERE id = ?').get(newId);
  logAudit(req.user, 'SALARY_PAID', 'SALARY', newId, `Processed salary of ${total} DZD for ${employee.full_name} (${period})`, employee.warehouse_id);
  return sendSuccess(res, salary, 'Salary recorded successfully', 201);
});

export default router;
