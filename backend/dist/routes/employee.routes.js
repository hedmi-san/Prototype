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
    const employees = database_js_1.db.prepare(query).all(...params).map((e) => ({
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
    return (0, response_js_1.sendSuccess)(res, employees);
});
router.post('/', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN', 'MANAGER'), (req, res) => {
    const { warehouseId, fullName, nationalId, phone, position, baseSalary, hireDate } = req.body;
    const targetWarehouseId = warehouseId || req.user?.warehouseId;
    if (!targetWarehouseId || !fullName || !nationalId || !position || baseSalary === undefined) {
        return (0, response_js_1.sendError)(res, 'warehouseId, fullName, nationalId, position, and baseSalary are required', 400);
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
    INSERT INTO employees (warehouse_id, full_name, national_id, phone, position, base_salary, active, hire_date)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `);
    const info = stmt.run(targetWarehouseId, fullName, nationalId, phone || '', position, Number(baseSalary), hireDate || new Date().toISOString().substring(0, 10));
    const newId = Number(info.lastInsertRowid);
    const employee = database_js_1.db.prepare('SELECT * FROM employees WHERE id = ?').get(newId);
    (0, auth_js_1.logAudit)(req.user, 'EMPLOYEE_CREATED', 'EMPLOYEE', newId, `Registered employee ${fullName} (${position})`, targetWarehouseId);
    return (0, response_js_1.sendSuccess)(res, employee, 'Employee registered successfully', 201);
});
router.put('/:id', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN', 'MANAGER'), (req, res) => {
    const id = Number(req.params.id);
    const { fullName, nationalId, phone, position, baseSalary, active } = req.body;
    const current = database_js_1.db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!current)
        return (0, response_js_1.sendError)(res, `Employee not found with id ${id}`, 404);
    const updatedName = fullName || current.full_name;
    const updatedNatId = nationalId || current.national_id;
    const updatedPhone = phone !== undefined ? phone : current.phone;
    const updatedPos = position || current.position;
    const updatedSalary = baseSalary !== undefined ? Number(baseSalary) : current.base_salary;
    const updatedActive = active !== undefined ? (active ? 1 : 0) : current.active;
    database_js_1.db.prepare(`
    UPDATE employees
    SET full_name = ?, national_id = ?, phone = ?, position = ?, base_salary = ?, active = ?
    WHERE id = ?
  `).run(updatedName, updatedNatId, updatedPhone, updatedPos, updatedSalary, updatedActive, id);
    const updated = database_js_1.db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    (0, auth_js_1.logAudit)(req.user, 'EMPLOYEE_UPDATED', 'EMPLOYEE', id, `Updated employee ${updatedName}`, current.warehouse_id);
    return (0, response_js_1.sendSuccess)(res, updated, 'Employee updated successfully');
});
exports.default = router;
