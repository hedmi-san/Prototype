import { Router } from 'express';
import { query } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, AuthRequest, logAudit } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT * FROM warehouses ORDER BY id ASC');
    return sendSuccess(res, result.rows);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const result = await query('SELECT * FROM warehouses WHERE id = $1', [id]);
    const warehouse = result.rows[0];
    if (!warehouse) {
      return sendError(res, `Warehouse not found with id ${id}`, 404);
    }
    return sendSuccess(res, warehouse);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.post('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { name, code, location, contactNumber, contact_number } = req.body;
    const phone = contactNumber || contact_number || '';
    if (!name || !code || !location) {
      return sendError(res, 'Name, code, and location are required', 400);
    }

    const existing = await query('SELECT id FROM warehouses WHERE code = $1', [code]);
    if (existing.rowCount && existing.rowCount > 0) {
      return sendError(res, `Warehouse with code ${code} already exists`, 400);
    }

    const insertRes = await query(`
      INSERT INTO warehouses (name, code, location, contact_number, active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING *
    `, [name, code, location, phone]);
    const newWarehouse = insertRes.rows[0];

    await logAudit(req.user, 'WAREHOUSE_CREATED', 'WAREHOUSE', newWarehouse.id, `Created warehouse ${name} (${code})`);
    return sendSuccess(res, newWarehouse, 'Warehouse created successfully', 201);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.put('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { name, location, contactNumber, contact_number, active } = req.body;
    const phone = contactNumber || contact_number;

    const currentRes = await query('SELECT * FROM warehouses WHERE id = $1', [id]);
    const current = currentRes.rows[0];
    if (!current) {
      return sendError(res, `Warehouse not found with id ${id}`, 404);
    }

    const updatedName = name !== undefined ? name : current.name;
    const updatedLocation = location !== undefined ? location : current.location;
    const updatedPhone = phone !== undefined ? phone : current.contact_number;
    const updatedActive = active !== undefined ? Boolean(active) : Boolean(current.active);

    const updateRes = await query(`
      UPDATE warehouses
      SET name = $1, location = $2, contact_number = $3, active = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [updatedName, updatedLocation, updatedPhone, updatedActive, id]);

    const updatedWarehouse = updateRes.rows[0];
    await logAudit(req.user, 'WAREHOUSE_UPDATED', 'WAREHOUSE', id, `Updated warehouse ${updatedName}`);
    return sendSuccess(res, updatedWarehouse, 'Warehouse updated successfully');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
