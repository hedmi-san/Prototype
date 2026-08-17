import { Router } from 'express';
import { db } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, logAudit, validateWarehouseScope } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    let query = `
    SELECT e.id, e.warehouse_id, w.name as warehouse_name,
           e.full_name, e.national_id, e.phone, e.position,
           e.base_salary, e.active, e.hire_date, e.created_at
    FROM employees e
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
    query += ' ORDER BY e.id ASC';
    const employees = db.prepare(query).all(...params).map((e) => ({
        id: e.id,
        warehouseId: e.warehouse_id,
        warehouseName: e.warehouse_name,
        fullName: e.full_name,
        nationalId: e.national_id,
        phone: e.phone,
        position: e.position,
        baseSalary: e.base_salary,
        active: Boolean(e.active),
        hireDate: e.hire_date,
        createdAt: e.created_at,
    }));
    return sendSuccess(res, employees);
});
router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), (req, res) => {
    const { warehouseId, fullName, nationalId, phone, position, baseSalary, hireDate } = req.body;
    const targetWarehouseId = warehouseId || req.user?.warehouseId;
    if (!targetWarehouseId || !fullName || !nationalId || !position || baseSalary === undefined) {
        return sendError(res, 'warehouseId, fullName, nationalId, position, and baseSalary are required', 400);
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
    INSERT INTO employees (warehouse_id, full_name, national_id, phone, position, base_salary, active, hire_date)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);
    const info = stmt.run(targetWarehouseId, fullName, nationalId, phone || '', position, Number(baseSalary), hireDate || new Date().toISOString().substring(0, 10));
    const newId = Number(info.lastInsertRowid);
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(newId);
    logAudit(req.user, 'EMPLOYEE_CREATED', 'EMPLOYEE', newId, `Registered employee ${fullName} (${position})`, targetWarehouseId);
    return sendSuccess(res, employee, 'Employee registered successfully', 201);
});
router.put('/:id', authenticate, requireRole('ADMIN', 'MANAGER'), (req, res) => {
    const id = Number(req.params.id);
    const { fullName, nationalId, phone, position, baseSalary, active } = req.body;
    const current = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!current)
        return sendError(res, `Employee not found with id ${id}`, 404);
    const updatedName = fullName || current.full_name;
    const updatedNatId = nationalId || current.national_id;
    const updatedPhone = phone !== undefined ? phone : current.phone;
    const updatedPos = position || current.position;
    const updatedSalary = baseSalary !== undefined ? Number(baseSalary) : current.base_salary;
    const updatedActive = active !== undefined ? (active ? 1 : 0) : current.active;
    db.prepare(`
    UPDATE employees
    SET full_name = ?, national_id = ?, phone = ?, position = ?, base_salary = ?, active = ?
    WHERE id = ?
  `).run(updatedName, updatedNatId, updatedPhone, updatedPos, updatedSalary, updatedActive, id);
    const updated = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    logAudit(req.user, 'EMPLOYEE_UPDATED', 'EMPLOYEE', id, `Updated employee ${updatedName}`, current.warehouse_id);
    return sendSuccess(res, updated, 'Employee updated successfully');
});
export default router;
