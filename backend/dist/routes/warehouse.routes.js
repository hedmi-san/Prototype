import { Router } from 'express';
import { db } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, (req, res) => {
    const warehouses = db.prepare('SELECT * FROM warehouses ORDER BY id ASC').all();
    return sendSuccess(res, warehouses);
});
router.get('/:id', authenticate, (req, res) => {
    const id = Number(req.params.id);
    const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
    if (!warehouse) {
        return sendError(res, `Warehouse not found with id ${id}`, 404);
    }
    return sendSuccess(res, warehouse);
});
router.post('/', authenticate, requireRole('ADMIN'), (req, res) => {
    const { name, code, location, contactNumber, contact_number } = req.body;
    const phone = contactNumber || contact_number || '';
    if (!name || !code || !location) {
        return sendError(res, 'Name, code, and location are required', 400);
    }
    const existing = db.prepare('SELECT id FROM warehouses WHERE code = ?').get(code);
    if (existing) {
        return sendError(res, `Warehouse with code ${code} already exists`, 400);
    }
    const stmt = db.prepare(`
    INSERT INTO warehouses (name, code, location, contact_number, active)
    VALUES (?, ?, ?, ?, 1)
  `);
    const info = stmt.run(name, code, location, phone);
    const newWarehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(Number(info.lastInsertRowid));
    logAudit(req.user, 'WAREHOUSE_CREATED', 'WAREHOUSE', Number(info.lastInsertRowid), `Created warehouse ${name} (${code})`);
    return sendSuccess(res, newWarehouse, 'Warehouse created successfully', 201);
});
router.put('/:id', authenticate, requireRole('ADMIN'), (req, res) => {
    const id = Number(req.params.id);
    const { name, location, contactNumber, contact_number, active } = req.body;
    const phone = contactNumber || contact_number;
    const current = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
    if (!current) {
        return sendError(res, `Warehouse not found with id ${id}`, 404);
    }
    const updatedName = name !== undefined ? name : current.name;
    const updatedLocation = location !== undefined ? location : current.location;
    const updatedPhone = phone !== undefined ? phone : current.contact_number;
    const updatedActive = active !== undefined ? (active ? 1 : 0) : current.active;
    db.prepare(`
    UPDATE warehouses
    SET name = ?, location = ?, contact_number = ?, active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(updatedName, updatedLocation, updatedPhone, updatedActive, id);
    const updatedWarehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
    logAudit(req.user, 'WAREHOUSE_UPDATED', 'WAREHOUSE', id, `Updated warehouse ${updatedName}`);
    return sendSuccess(res, updatedWarehouse, 'Warehouse updated successfully');
});
export default router;
