import { Router } from 'express';
import { query } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, AuthRequest, logAudit } from '../middleware/auth.js';

const router = Router();

function mapWarehouseRow(w: any) {
  return {
    id: w.id,
    name: w.name,
    code: w.code,
    location: w.location || '',
    address: w.location || '',
    contactNumber: w.contact_number || '',
    contact_number: w.contact_number || '',
    phone: w.contact_number || '',
    active: w.active,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT * FROM warehouses ORDER BY id ASC');
    return sendSuccess(res, result.rows.map(mapWarehouseRow));
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
    return sendSuccess(res, mapWarehouseRow(warehouse));
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.post('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { name, code, location, address, contactNumber, contact_number, phone } = req.body;
    const warehouseLocation = location || address || '';
    const warehousePhone = contactNumber || contact_number || phone || '';
    if (!name || !code || !warehouseLocation) {
      return sendError(res, 'Name, code, and location/address are required', 400);
    }

    const existing = await query('SELECT id FROM warehouses WHERE code = $1', [code]);
    if (existing.rowCount && existing.rowCount > 0) {
      return sendError(res, `Warehouse with code ${code} already exists`, 400);
    }

    const insertRes = await query(`
      INSERT INTO warehouses (name, code, location, contact_number, active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING *
    `, [name, code, warehouseLocation, warehousePhone]);
    const newWarehouse = insertRes.rows[0];

    await logAudit(req.user, 'WAREHOUSE_CREATED', 'WAREHOUSE', newWarehouse.id, `Created warehouse ${name} (${code})`);
    return sendSuccess(res, mapWarehouseRow(newWarehouse), 'Warehouse created successfully', 201);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.put('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { name, code, location, address, contactNumber, contact_number, phone, active } = req.body;
    const warehouseLocation = location !== undefined ? location : address;
    const warehousePhone = contactNumber !== undefined ? contactNumber : (contact_number !== undefined ? contact_number : phone);

    const currentRes = await query('SELECT * FROM warehouses WHERE id = $1', [id]);
    const current = currentRes.rows[0];
    if (!current) {
      return sendError(res, `Warehouse not found with id ${id}`, 404);
    }

    const updatedName = name !== undefined ? name : current.name;
    const updatedCode = code !== undefined ? code : current.code;
    const updatedLocation = warehouseLocation !== undefined ? warehouseLocation : current.location;
    const updatedPhone = warehousePhone !== undefined ? warehousePhone : current.contact_number;
    const updatedActive = active !== undefined ? Boolean(active) : Boolean(current.active);

    const updateRes = await query(`
      UPDATE warehouses
      SET name = $1, code = $2, location = $3, contact_number = $4, active = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [updatedName, updatedCode, updatedLocation, updatedPhone, updatedActive, id]);

    const updatedWarehouse = updateRes.rows[0];
    await logAudit(req.user, 'WAREHOUSE_UPDATED', 'WAREHOUSE', id, `Updated warehouse ${updatedName}`);
    return sendSuccess(res, mapWarehouseRow(updatedWarehouse), 'Warehouse updated successfully');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
