import { Router } from 'express';
import { query } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, logAudit, validateWarehouseScope } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, async (req, res) => {
    try {
        const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
        let sql = `
      SELECT e.id, e.warehouse_id, w.name as warehouse_name,
             e.full_name, e.national_id, e.phone, e.position,
             e.base_salary, e.active, e.hire_date, e.created_at
      FROM employees e
      JOIN warehouses w ON e.warehouse_id = w.id
    `;
        const params = [];
        if (warehouseId) {
            params.push(warehouseId);
            sql += ` WHERE e.warehouse_id = $${params.length}`;
        }
        else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
            params.push(req.user.warehouseId);
            sql += ` WHERE e.warehouse_id = $${params.length}`;
        }
        sql += ' ORDER BY e.id ASC';
        const result = await query(sql, params);
        const employees = result.rows.map((e) => ({
            id: e.id,
            warehouseId: e.warehouse_id,
            warehouseName: e.warehouse_name,
            fullName: e.full_name,
            nationalId: e.national_id,
            phone: e.phone,
            position: e.position,
            baseSalary: Number(e.base_salary),
            active: Boolean(e.active),
            hireDate: e.hire_date,
            createdAt: e.created_at,
        }));
        return sendSuccess(res, employees);
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
    try {
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
        const insertRes = await query(`
      INSERT INTO employees (warehouse_id, full_name, national_id, phone, position, base_salary, active, hire_date)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
      RETURNING *
    `, [
            targetWarehouseId,
            fullName,
            nationalId,
            phone || '',
            position,
            Number(baseSalary),
            hireDate || new Date().toISOString().substring(0, 10),
        ]);
        const employee = insertRes.rows[0];
        await logAudit(req.user, 'EMPLOYEE_CREATED', 'EMPLOYEE', employee.id, `Registered employee ${fullName} (${position})`, targetWarehouseId);
        return sendSuccess(res, employee, 'Employee registered successfully', 201);
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.put('/:id', authenticate, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { fullName, nationalId, phone, position, baseSalary, active } = req.body;
        const currentRes = await query('SELECT * FROM employees WHERE id = $1', [id]);
        const current = currentRes.rows[0];
        if (!current)
            return sendError(res, `Employee not found with id ${id}`, 404);
        const updatedName = fullName || current.full_name;
        const updatedNatId = nationalId || current.national_id;
        const updatedPhone = phone !== undefined ? phone : current.phone;
        const updatedPos = position || current.position;
        const updatedSalary = baseSalary !== undefined ? Number(baseSalary) : Number(current.base_salary);
        const updatedActive = active !== undefined ? Boolean(active) : Boolean(current.active);
        const updateRes = await query(`
      UPDATE employees
      SET full_name = $1, national_id = $2, phone = $3, position = $4, base_salary = $5, active = $6
      WHERE id = $7
      RETURNING *
    `, [updatedName, updatedNatId, updatedPhone, updatedPos, updatedSalary, updatedActive, id]);
        const updated = updateRes.rows[0];
        await logAudit(req.user, 'EMPLOYEE_UPDATED', 'EMPLOYEE', id, `Updated employee ${updatedName}`, current.warehouse_id);
        return sendSuccess(res, updated, 'Employee updated successfully');
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
export default router;
