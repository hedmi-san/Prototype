import { Router } from 'express';
import { db, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, AuthRequest, logAudit, validateWarehouseScope } from '../middleware/auth.js';

const router = Router();

router.get('/stock', authenticate, (req: AuthRequest, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
  if (warehouseId && req.user) {
    try {
      validateWarehouseScope(req.user, warehouseId);
    } catch (err: any) {
      return sendError(res, err.message, 403);
    }
  }

  let query = `
    SELECT s.id, s.warehouse_id, w.name as warehouse_name,
           s.product_id, p.name as product_name, p.reference as product_reference, p.brand,
           s.physical_quantity, s.reserved_quantity,
           (s.physical_quantity - s.reserved_quantity) as available_quantity,
           p.purchase_price, p.sale_price,
           (s.physical_quantity * p.purchase_price) as total_valuation,
           p.min_stock_alert, s.updated_at
    FROM stock s
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN products p ON s.product_id = p.id
  `;

  const params: any[] = [];
  if (warehouseId) {
    query += ' WHERE s.warehouse_id = ?';
    params.push(warehouseId);
  } else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
    query += ' WHERE s.warehouse_id = ?';
    params.push(req.user.warehouseId);
  }

  query += ' ORDER BY w.name ASC, p.name ASC';
  const rows = db.prepare(query).all(...params).map((row: any) => ({
    id: row.id,
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouse_name,
    productId: row.product_id,
    productName: row.product_name,
    productReference: row.product_reference,
    brand: row.brand,
    physicalQuantity: row.physical_quantity,
    reservedQuantity: row.reserved_quantity,
    availableQuantity: row.available_quantity,
    purchasePrice: row.purchase_price,
    salePrice: row.sale_price,
    totalValuation: row.total_valuation,
    minStockAlert: row.min_stock_alert,
    updatedAt: row.updated_at,
  }));

  return sendSuccess(res, rows);
});

router.get('/movements', authenticate, (req: AuthRequest, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
  let query = `
    SELECT m.id, m.warehouse_id, w.name as warehouse_name,
           m.product_id, p.name as product_name, p.reference as product_reference,
           m.movement_type, m.quantity_change, m.reference, m.notes, m.created_at
    FROM stock_movements m
    JOIN warehouses w ON m.warehouse_id = w.id
    JOIN products p ON m.product_id = p.id
  `;
  const params: any[] = [];
  if (warehouseId) {
    query += ' WHERE m.warehouse_id = ?';
    params.push(warehouseId);
  }
  query += ' ORDER BY m.created_at DESC, m.id DESC LIMIT 200';

  const rows = db.prepare(query).all(...params).map((m: any) => ({
    id: m.id,
    warehouseId: m.warehouse_id,
    warehouseName: m.warehouse_name,
    productId: m.product_id,
    productName: m.product_name,
    productReference: m.product_reference,
    movementType: m.movement_type,
    quantityChange: m.quantity_change,
    reference: m.reference,
    notes: m.notes,
    createdAt: m.created_at,
  }));

  return sendSuccess(res, rows);
});

router.post('/initial-receipt', authenticate, requireRole('ADMIN', 'MANAGER'), (req: AuthRequest, res) => {
  const { warehouseId, productId, quantity, reference, notes } = req.body;
  if (!warehouseId || !productId || !quantity || quantity <= 0) {
    return sendError(res, 'warehouseId, productId, and positive quantity are required', 400);
  }

  try {
    const result = runTransaction(() => {
      const stock = db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, productId) as any;
      if (stock) {
        db.prepare('UPDATE stock SET physical_quantity = physical_quantity + ?, updated_at = datetime("now") WHERE id = ?').run(quantity, stock.id);
      } else {
        db.prepare('INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity) VALUES (?, ?, ?, 0)').run(warehouseId, productId, quantity);
      }

      db.prepare(`
        INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
        VALUES (?, ?, 'INITIAL_STOCK', ?, ?, ?)
      `).run(warehouseId, productId, quantity, reference || 'INIT-STOCK', notes || 'Initial stock receipt');

      return db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, productId);
    });

    logAudit(req.user, 'INITIAL_STOCK_RECEIVED', 'STOCK', productId, `Received ${quantity} units into warehouse ID ${warehouseId}`, warehouseId);
    return sendSuccess(res, result, 'Stock received successfully');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.post('/adjustments', authenticate, requireRole('ADMIN', 'MANAGER', 'ACCOUNTANT'), (req: AuthRequest, res) => {
  const { warehouseId, productId, quantity, reason, notes } = req.body;
  if (!warehouseId || !productId || quantity === undefined) {
    return sendError(res, 'warehouseId, productId, and quantity adjustment are required', 400);
  }

  try {
    const result = runTransaction(() => {
      const stock = db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(warehouseId, productId) as any;
      const currentQty = stock ? stock.physical_quantity : 0;
      const newQty = currentQty + Number(quantity);
      if (newQty < (stock ? stock.reserved_quantity : 0)) {
        throw new Error(`Adjustment invalid: physical stock (${newQty}) cannot be less than reserved transfer stock (${stock ? stock.reserved_quantity : 0})`);
      }

      if (stock) {
        db.prepare('UPDATE stock SET physical_quantity = ?, updated_at = datetime("now") WHERE id = ?').run(newQty, stock.id);
      } else {
        if (newQty < 0) throw new Error('Initial stock quantity cannot be negative');
        db.prepare('INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity) VALUES (?, ?, ?, 0)').run(warehouseId, productId, newQty);
      }

      db.prepare(`
        INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
        VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?)
      `).run(warehouseId, productId, Number(quantity), reason || 'INVENTORY_AUDIT', notes || `Stock adjusted from ${currentQty} to ${newQty}`);

      return { warehouseId, productId, previousQuantity: currentQty, newQuantity: newQty };
    });

    logAudit(req.user, 'STOCK_ADJUSTED', 'STOCK', productId, `Adjusted stock by ${quantity} units (Reason: ${reason})`, warehouseId);
    return sendSuccess(res, result, 'Stock adjusted successfully');
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

export default router;
