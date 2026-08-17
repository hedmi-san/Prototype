"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_js_1 = require("../db/database.js");
const response_js_1 = require("../common/response.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
router.get('/', auth_js_1.authenticate, (req, res) => {
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
    const params = [];
    const conditions = [];
    if (warehouseId) {
        conditions.push('s.warehouse_id = ?');
        params.push(warehouseId);
    }
    else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
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
    const salaries = database_js_1.db.prepare(query).all(...params).map((s) => ({
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
    return (0, response_js_1.sendSuccess)(res, salaries);
});
router.post('/', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN', 'ACCOUNTANT'), (req, res) => {
    const { employeeId, period, baseSalary, bonus1, bonus2, paymentDate } = req.body;
    if (!employeeId || !period) {
        return (0, response_js_1.sendError)(res, 'employeeId and period (YYYY-MM) are required', 400);
    }
    const employee = database_js_1.db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
    if (!employee)
        return (0, response_js_1.sendError)(res, `Employee not found with id ${employeeId}`, 404);
    if (req.user) {
        try {
            (0, auth_js_1.validateWarehouseScope)(req.user, employee.warehouse_id);
        }
        catch (err) {
            return (0, response_js_1.sendError)(res, err.message, 403);
        }
    }
    const existing = database_js_1.db.prepare('SELECT id FROM salaries WHERE employee_id = ? AND period = ?').get(employeeId, period);
    if (existing) {
        return (0, response_js_1.sendError)(res, `Salary for employee ${employee.full_name} for period ${period} already recorded`, 400);
    }
    const bSalary = baseSalary !== undefined ? Number(baseSalary) : employee.base_salary;
    const b1 = bonus1 !== undefined ? Number(bonus1) : 0;
    const b2 = bonus2 !== undefined ? Number(bonus2) : 0;
    const total = bSalary + b1 + b2;
    const stmt = database_js_1.db.prepare(`
    INSERT INTO salaries (employee_id, warehouse_id, period, base_salary, bonus1, bonus2, total_amount, payment_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const info = stmt.run(employeeId, employee.warehouse_id, period, bSalary, b1, b2, total, paymentDate || new Date().toISOString().substring(0, 10));
    const newId = Number(info.lastInsertRowid);
    const salary = database_js_1.db.prepare('SELECT * FROM salaries WHERE id = ?').get(newId);
    (0, auth_js_1.logAudit)(req.user, 'SALARY_PAID', 'SALARY', newId, `Processed salary of ${total} DZD for ${employee.full_name} (${period})`, employee.warehouse_id);
    return (0, response_js_1.sendSuccess)(res, salary, 'Salary recorded successfully', 201);
});
exports.default = router;
