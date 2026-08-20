import { Router } from 'express';
import { db, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { generateCsv, sendCsv, CsvColumn } from '../common/csv.js';
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

router.get('/export/csv', authenticate, (req: AuthRequest, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
  const lowStock = req.query.lowStock === 'true';
  const search = (req.query.search as string | undefined)?.trim();

  if (warehouseId && req.user) {
    try {
      validateWarehouseScope(req.user, warehouseId);
    } catch (err: any) {
      return sendError(res, err.message, 403);
    }
  }

  let query = `
    SELECT s.id, s.warehouse_id, w.name as warehouse_name,
           s.product_id, p.name as product_name, p.reference as product_reference, p.brand, p.category,
           s.physical_quantity, s.reserved_quantity,
           (s.physical_quantity - s.reserved_quantity) as available_quantity,
           p.purchase_price, p.sale_price,
           (s.physical_quantity * p.purchase_price) as total_valuation,
           p.min_stock_alert, s.updated_at
    FROM stock s
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN products p ON s.product_id = p.id
  `;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (warehouseId) {
    whereClauses.push('s.warehouse_id = ?');
    params.push(warehouseId);
  } else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
    whereClauses.push('s.warehouse_id = ?');
    params.push(req.user.warehouseId);
  }

  if (lowStock) {
    whereClauses.push('(s.physical_quantity - s.reserved_quantity) <= p.min_stock_alert');
  }

  if (search) {
    whereClauses.push('(p.name LIKE ? OR p.reference LIKE ? OR p.brand LIKE ? OR w.name LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  if (whereClauses.length > 0) {
    query += ' WHERE ' + whereClauses.join(' AND ');
  }

  query += ' ORDER BY w.name ASC, p.name ASC';
  const rows = db.prepare(query).all(...params) as any[];

  const columns: CsvColumn[] = [
    { header: 'Dépôt', key: 'warehouse_name' },
    { header: 'Référence', key: 'product_reference' },
    { header: 'Désignation', key: 'product_name' },
    { header: 'Marque', key: 'brand' },
    { header: 'Catégorie', key: 'category' },
    { header: 'Quantité Physique', key: 'physical_quantity' },
    { header: 'Quantité Réservée', key: 'reserved_quantity' },
    { header: 'Quantité Disponible', key: 'available_quantity' },
    { header: 'Seuil Alerte Min', key: 'min_stock_alert' },
    {
      header: 'Statut',
      format: (r) =>
        r.available_quantity <= 0
          ? 'Rupture'
          : r.available_quantity <= r.min_stock_alert
          ? 'Alerte Stock Bas'
          : 'Normal',
    },
    { header: 'Prix Achat Unitaire (DZD)', key: 'purchase_price' },
    { header: 'Prix Vente Unitaire (DZD)', key: 'sale_price' },
    { header: 'Valorisation Totale (DZD)', key: 'total_valuation' },
    { header: 'Dernière Mise à Jour', key: 'updated_at' },
  ];

  const csv = generateCsv(columns, rows);
  const dateStr = new Date().toISOString().split('T')[0];
  return sendCsv(res, `stock_inventaire_${dateStr}.csv`, csv);
});

router.get('/movements', authenticate, (req: AuthRequest, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const type = req.query.type as string | undefined;
  const search = (req.query.search as string | undefined)?.trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
  const offset = (page - 1) * limit;

  let baseFromWhere = `
    FROM stock_movements m
    JOIN warehouses w ON m.warehouse_id = w.id
    JOIN products p ON m.product_id = p.id
  `;
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (warehouseId) {
    whereClauses.push('m.warehouse_id = ?');
    params.push(warehouseId);
  } else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
    whereClauses.push('m.warehouse_id = ?');
    params.push(req.user.warehouseId);
  }

  if (type) {
    whereClauses.push('m.movement_type = ?');
    params.push(type);
  }

  if (startDate) {
    const formattedStart = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
    whereClauses.push('m.created_at >= ?');
    params.push(formattedStart);
  }

  if (endDate) {
    const formattedEnd = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
    whereClauses.push('m.created_at <= ?');
    params.push(formattedEnd);
  }

  if (search) {
    whereClauses.push('(p.name LIKE ? OR p.reference LIKE ? OR w.name LIKE ? OR m.reference LIKE ? OR m.notes LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (whereClauses.length > 0) {
    baseFromWhere += ' WHERE ' + whereClauses.join(' AND ');
  }

  const countQuery = `SELECT COUNT(*) as count ${baseFromWhere}`;
  const total = (db.prepare(countQuery).get(...params) as any)?.count || 0;

  const selectQuery = `
    SELECT m.id, m.warehouse_id, w.name as warehouse_name,
           m.product_id, p.name as product_name, p.reference as product_reference,
           m.movement_type, m.quantity_change, m.reference, m.notes, m.created_at
    ${baseFromWhere}
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(selectQuery).all(...params, limit, offset).map((m: any) => ({
    id: m.id,
    warehouseId: m.warehouse_id,
    warehouseName: m.warehouse_name,
    productId: m.product_id,
    productName: m.product_name,
    productReference: m.product_reference,
    movementType: m.movement_type,
    type: m.movement_type,
    quantityChange: m.quantity_change,
    quantity: m.quantity_change,
    reference: m.reference,
    notes: m.notes,
    reason: m.notes || m.reference,
    createdByName: 'Système',
    createdAt: m.created_at,
  }));

  const totalPages = Math.ceil(total / limit) || 1;

  return sendSuccess(res, {
    items: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
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
        db.prepare("UPDATE stock SET physical_quantity = physical_quantity + ?, updated_at = datetime('now') WHERE id = ?").run(quantity, stock.id);
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
        db.prepare("UPDATE stock SET physical_quantity = ?, updated_at = datetime('now') WHERE id = ?").run(newQty, stock.id);
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
