"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_js_1 = require("../db/database.js");
const response_js_1 = require("../common/response.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
router.get('/', auth_js_1.authenticate, (req, res) => {
    const warehouses = database_js_1.db.prepare('SELECT * FROM warehouses ORDER BY id ASC').all();
    return (0, response_js_1.sendSuccess)(res, warehouses);
});
router.get('/:id', auth_js_1.authenticate, (req, res) => {
    const id = Number(req.params.id);
    const warehouse = database_js_1.db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
    if (!warehouse) {
        return (0, response_js_1.sendError)(res, `Warehouse not found with id ${id}`, 404);
    }
    return (0, response_js_1.sendSuccess)(res, warehouse);
});
router.post('/', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN'), (req, res) => {
    const { name, code, location, contactNumber, contact_number } = req.body;
    const phone = contactNumber || contact_number || '';
    if (!name || !code || !location) {
        return (0, response_js_1.sendError)(res, 'Name, code, and location are required', 400);
    }
    const existing = database_js_1.db.prepare('SELECT id FROM warehouses WHERE code = ?').get(code);
    if (existing) {
        return (0, response_js_1.sendError)(res, `Warehouse with code ${code} already exists`, 400);
    }
    const stmt = database_js_1.db.prepare(`
    INSERT INTO warehouses (name, code, location, contact_number, active)
    VALUES (?, ?, ?, ?, 1)
  `);
    const info = stmt.run(name, code, location, phone);
    const newWarehouse = database_js_1.db.prepare('SELECT * FROM warehouses WHERE id = ?').get(Number(info.lastInsertRowid));
    (0, auth_js_1.logAudit)(req.user, 'WAREHOUSE_CREATED', 'WAREHOUSE', Number(info.lastInsertRowid), `Created warehouse ${name} (${code})`);
    return (0, response_js_1.sendSuccess)(res, newWarehouse, 'Warehouse created successfully', 201);
});
router.put('/:id', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const { name, location, contactNumber, contact_number, active } = req.body;
    const phone = contactNumber || contact_number;
    const current = database_js_1.db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
    if (!current) {
        return (0, response_js_1.sendError)(res, `Warehouse not found with id ${id}`, 404);
    }
    const updatedName = name !== undefined ? name : current.name;
    const updatedLocation = location !== undefined ? location : current.location;
    const updatedPhone = phone !== undefined ? phone : current.contact_number;
    const updatedActive = active !== undefined ? (active ? 1 : 0) : current.active;
    database_js_1.db.prepare(`
    UPDATE warehouses
    SET name = ?, location = ?, contact_number = ?, active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(updatedName, updatedLocation, updatedPhone, updatedActive, id);
    const updatedWarehouse = database_js_1.db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
    (0, auth_js_1.logAudit)(req.user, 'WAREHOUSE_UPDATED', 'WAREHOUSE', id, `Updated warehouse ${updatedName}`);
    return (0, response_js_1.sendSuccess)(res, updatedWarehouse, 'Warehouse updated successfully');
});
exports.default = router;
