import { Router } from 'express';
import { db, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, AuthRequest, logAudit } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res) => {
  const user = req.user;
  const filterWarehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const status = req.query.status as string | undefined;
  const search = (req.query.search as string | undefined)?.trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
  const offset = (page - 1) * limit;

  let baseFromWhere = `
    FROM transfers t
    JOIN warehouses sw ON t.source_warehouse_id = sw.id
    JOIN warehouses dw ON t.destination_warehouse_id = dw.id
    JOIN users u ON t.requested_by_user_id = u.id
  `;

  const params: any[] = [];
  const whereClauses: string[] = [];

  // Enforce warehouse scoping for non-admin users
  if (user?.role !== 'ADMIN' && user?.warehouseId) {
    whereClauses.push('(t.source_warehouse_id = ? OR t.destination_warehouse_id = ?)');
    params.push(user.warehouseId, user.warehouseId);
  } else if (filterWarehouseId) {
    whereClauses.push('(t.source_warehouse_id = ? OR t.destination_warehouse_id = ?)');
    params.push(filterWarehouseId, filterWarehouseId);
  }

  if (status) {
    whereClauses.push('t.status = ?');
    params.push(status);
  }

  if (startDate) {
    const formattedStart = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
    whereClauses.push('t.created_at >= ?');
    params.push(formattedStart);
  }

  if (endDate) {
    const formattedEnd = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
    whereClauses.push('t.created_at <= ?');
    params.push(formattedEnd);
  }

  if (search) {
    whereClauses.push('(t.transfer_number LIKE ? OR sw.name LIKE ? OR dw.name LIKE ? OR u.full_name LIKE ? OR t.notes LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (whereClauses.length > 0) {
    baseFromWhere += ' WHERE ' + whereClauses.join(' AND ');
  }

  const countQuery = `SELECT COUNT(*) as count ${baseFromWhere}`;
  const total = (db.prepare(countQuery).get(...params) as any)?.count || 0;

  const selectQuery = `
    SELECT t.id, t.transfer_number,
           t.source_warehouse_id, sw.name as source_warehouse_name, sw.code as source_warehouse_code,
           t.destination_warehouse_id, dw.name as destination_warehouse_name, dw.code as destination_warehouse_code,
           t.requested_by_user_id, u.full_name as requested_by_name,
           t.status, t.notes, t.created_at, t.approved_at, t.confirmed_at, t.updated_at
    ${baseFromWhere}
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT ? OFFSET ?
  `;

  const transferRows = db.prepare(selectQuery).all(...params, limit, offset) as any[];

  // Batch load line items for the paginated slice
  const transferIds = transferRows.map((t) => t.id);
  const itemsByTransferId: Record<number, any[]> = {};

  if (transferIds.length > 0) {
    const placeholders = transferIds.map(() => '?').join(',');
    const itemsQuery = `
      SELECT ti.id, ti.transfer_id, ti.product_id, p.name as product_name, p.reference as product_reference,
             ti.requested_quantity, ti.approved_quantity
      FROM transfer_items ti
      JOIN products p ON ti.product_id = p.id
      WHERE ti.transfer_id IN (${placeholders})
    `;
    const itemRows = db.prepare(itemsQuery).all(...transferIds) as any[];
    for (const item of itemRows) {
      if (!itemsByTransferId[item.transfer_id]) {
        itemsByTransferId[item.transfer_id] = [];
      }
      itemsByTransferId[item.transfer_id].push({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        productReference: item.product_reference,
        requestedQuantity: item.requested_quantity,
        approvedQuantity: item.approved_quantity,
      });
    }
  }

  const items = transferRows.map((t: any) => ({
    id: t.id,
    transferNumber: t.transfer_number,
    sourceWarehouseId: t.source_warehouse_id,
    sourceWarehouseName: t.source_warehouse_name,
    sourceWarehouseCode: t.source_warehouse_code,
    destinationWarehouseId: t.destination_warehouse_id,
    destinationWarehouseName: t.destination_warehouse_name,
    destinationWarehouseCode: t.destination_warehouse_code,
    requestedByUserId: t.requested_by_user_id,
    requestedByName: t.requested_by_name,
    status: t.status,
    notes: t.notes,
    createdAt: t.created_at,
    approvedAt: t.approved_at || null,
    confirmedAt: t.confirmed_at || null,
    updatedAt: t.updated_at,
    items: itemsByTransferId[t.id] || [],
  }));

  const totalPages = Math.ceil(total / limit) || 1;

  return sendSuccess(res, {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

router.get('/:id', authenticate, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const user = req.user;
  const t = db.prepare(`
    SELECT t.id, t.transfer_number,
           t.source_warehouse_id, sw.name as source_warehouse_name, sw.code as source_warehouse_code,
           t.destination_warehouse_id, dw.name as destination_warehouse_name, dw.code as destination_warehouse_code,
           t.requested_by_user_id, u.full_name as requested_by_name,
           t.status, t.notes, t.created_at, t.approved_at, t.confirmed_at, t.updated_at
    FROM transfers t
    JOIN warehouses sw ON t.source_warehouse_id = sw.id
    JOIN warehouses dw ON t.destination_warehouse_id = dw.id
    JOIN users u ON t.requested_by_user_id = u.id
    WHERE t.id = ?
  `).get(id) as any;

  if (!t) return sendError(res, `Transfer not found with id ${id}`, 404);

  // Access control: Non-admin users can only view if their assigned warehouse is source or destination
  if (user?.role !== 'ADMIN' && user?.warehouseId) {
    if (t.source_warehouse_id !== user.warehouseId && t.destination_warehouse_id !== user.warehouseId) {
      return sendError(res, 'Access denied: You cannot view transfers for warehouses you are not assigned to', 403);
    }
  }

  const items = db.prepare(`
    SELECT ti.id, ti.product_id, p.name as product_name, p.reference as product_reference,
           ti.requested_quantity, ti.approved_quantity
      FROM transfer_items ti
      JOIN products p ON ti.product_id = p.id
      WHERE ti.transfer_id = ?
  `).all(t.id).map((i: any) => ({
    id: i.id,
    productId: i.product_id,
    productName: i.product_name,
    productReference: i.product_reference,
    requestedQuantity: i.requested_quantity,
    approvedQuantity: i.approved_quantity,
  }));

  return sendSuccess(res, {
    id: t.id,
    transferNumber: t.transfer_number,
    sourceWarehouseId: t.source_warehouse_id,
    sourceWarehouseName: t.source_warehouse_name,
    sourceWarehouseCode: t.source_warehouse_code,
    destinationWarehouseId: t.destination_warehouse_id,
    destinationWarehouseName: t.destination_warehouse_name,
    destinationWarehouseCode: t.destination_warehouse_code,
    requestedByUserId: t.requested_by_user_id,
    requestedByName: t.requested_by_name,
    status: t.status,
    notes: t.notes,
    createdAt: t.created_at,
    approvedAt: t.approved_at || null,
    confirmedAt: t.confirmed_at || null,
    updatedAt: t.updated_at,
    items,
  });
});

router.post('/', authenticate, (req: AuthRequest, res) => {
  const user = req.user;
  const { sourceWarehouseId, destinationWarehouseId, notes, items } = req.body;
  if (!sourceWarehouseId || !destinationWarehouseId || !items || !Array.isArray(items) || items.length === 0) {
    return sendError(res, 'sourceWarehouseId, destinationWarehouseId, and non-empty items are required', 400);
  }
  if (sourceWarehouseId === destinationWarehouseId) {
    return sendError(res, 'Source and destination warehouses must be different', 400);
  }

  // Non-admin can only request transfer for their own warehouse (as destination)
  if (user?.role !== 'ADMIN' && user?.warehouseId && user.warehouseId !== destinationWarehouseId) {
    return sendError(res, 'Access denied: You can only request transfers destined for your assigned warehouse', 403);
  }

  try {
    const result = runTransaction(() => {
      const transferNumber = `TRF-${Date.now().toString().slice(-8)}`;
      const insert = db.prepare(`
        INSERT INTO transfers (transfer_number, source_warehouse_id, destination_warehouse_id, requested_by_user_id, status, notes)
        VALUES (?, ?, ?, ?, 'REQUESTED', ?)
      `);
      const info = insert.run(transferNumber, sourceWarehouseId, destinationWarehouseId, req.user?.id || 1, notes || '');
      const transferId = Number(info.lastInsertRowid);

      const insertItem = db.prepare(`
        INSERT INTO transfer_items (transfer_id, product_id, requested_quantity, approved_quantity)
        VALUES (?, ?, ?, 0)
      `);
      for (const item of items) {
        insertItem.run(transferId, item.productId, item.requestedQuantity);
      }

      return { id: transferId, transferNumber, status: 'REQUESTED' };
    });

    logAudit(req.user, 'TRANSFER_REQUESTED', 'TRANSFER', result.id, `Created transfer request ${result.transferNumber}`, destinationWarehouseId);
    return sendSuccess(res, result, 'Transfer requested successfully', 201);
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

router.post('/:id/approve', authenticate, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const user = req.user;
  const { items } = req.body;

  const transfer = db.prepare('SELECT * FROM transfers WHERE id = ?').get(id) as any;
  if (!transfer) return sendError(res, `Transfer not found with id ${id}`, 404);

  // Authorization: Only source warehouse Manager or Admin can approve
  if (user?.role !== 'ADMIN') {
    if (user?.role !== 'MANAGER' || user?.warehouseId !== transfer.source_warehouse_id) {
      return sendError(res, 'Access denied: Only the source warehouse manager or an administrator can approve this transfer', 403);
    }
  }

  if (transfer.status !== 'REQUESTED') return sendError(res, `Cannot approve transfer in status ${transfer.status}`, 400);

  try {
    runTransaction(() => {
      // Reserve approved quantity at source warehouse
      const approvedItems = items && Array.isArray(items) ? items : [];
      const currentItems = db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id) as any[];

      for (const curItem of currentItems) {
        const matchingApproved = approvedItems.find((i: any) => i.productId === curItem.product_id);
        const qtyToApprove = matchingApproved !== undefined ? Number(matchingApproved.approvedQuantity) : curItem.requested_quantity;
        if (qtyToApprove < 0) {
          throw new Error('Approved quantity cannot be negative');
        }

        const stock = db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(transfer.source_warehouse_id, curItem.product_id) as any;
        const available = stock ? (stock.physical_quantity - stock.reserved_quantity) : 0;
        if (available < qtyToApprove) {
          throw new Error(`Insufficient available stock at source warehouse to reserve ${qtyToApprove} units. Available: ${available}`);
        }

        if (qtyToApprove > 0) {
          db.prepare("UPDATE stock SET reserved_quantity = reserved_quantity + ?, updated_at = datetime('now') WHERE id = ?")
            .run(qtyToApprove, stock.id);
        }

        db.prepare('UPDATE transfer_items SET approved_quantity = ? WHERE id = ?').run(qtyToApprove, curItem.id);
      }

      db.prepare("UPDATE transfers SET status = 'APPROVED', approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
    });

    logAudit(req.user, 'TRANSFER_APPROVED', 'TRANSFER', id, `Approved transfer ${transfer.transfer_number} and reserved stock`, transfer.source_warehouse_id);
    return sendSuccess(res, { id, status: 'APPROVED' }, 'Transfer approved and stock reserved');
  } catch (err: any) {
    return sendError(res, err.message, 400);
  }
});

router.post('/:id/confirm', authenticate, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const user = req.user;
  const transfer = db.prepare(`
    SELECT t.*, sw.name as source_warehouse_name, dw.name as destination_warehouse_name
    FROM transfers t
    JOIN warehouses sw ON t.source_warehouse_id = sw.id
    JOIN warehouses dw ON t.destination_warehouse_id = dw.id
    WHERE t.id = ?
  `).get(id) as any;
  if (!transfer) return sendError(res, `Transfer not found with id ${id}`, 404);

  // Authorization: Only destination warehouse Manager or Admin can confirm reception
  if (user?.role !== 'ADMIN') {
    if (user?.role !== 'MANAGER' || user?.warehouseId !== transfer.destination_warehouse_id) {
      return sendError(res, 'Access denied: Only the destination warehouse manager or an administrator can confirm receipt of this transfer', 403);
    }
  }

  if (transfer.status !== 'APPROVED') return sendError(res, `Cannot confirm transfer in status ${transfer.status}`, 400);

  try {
    runTransaction(() => {
      const items = db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id) as any[];
      for (const item of items) {
        const qty = Number(item.approved_quantity);
        if (qty <= 0) continue;

        // Deduct physical and reserved at source
        const sourceStock = db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(transfer.source_warehouse_id, item.product_id) as any;
        if (!sourceStock || sourceStock.physical_quantity < qty || sourceStock.reserved_quantity < qty) {
          throw new Error(`Source stock inconsistency for product ID ${item.product_id}: insufficient physical/reserved stock to deduct ${qty} units`);
        }

        db.prepare(`
          UPDATE stock
          SET physical_quantity = physical_quantity - ?, reserved_quantity = reserved_quantity - ?, updated_at = datetime('now')
          WHERE warehouse_id = ? AND product_id = ?
        `).run(qty, qty, transfer.source_warehouse_id, item.product_id);

        db.prepare(`
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
          VALUES (?, ?, 'TRANSFER_OUT', ?, ?, ?)
        `).run(transfer.source_warehouse_id, item.product_id, -qty, transfer.transfer_number, `Transfert sortant vers ${transfer.destination_warehouse_name}`);

        // Add physical at destination
        const destStock = db.prepare('SELECT * FROM stock WHERE warehouse_id = ? AND product_id = ?').get(transfer.destination_warehouse_id, item.product_id) as any;
        if (destStock) {
          db.prepare("UPDATE stock SET physical_quantity = physical_quantity + ?, updated_at = datetime('now') WHERE id = ?")
            .run(qty, destStock.id);
        } else {
          db.prepare('INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity) VALUES (?, ?, ?, 0)')
            .run(transfer.destination_warehouse_id, item.product_id, qty);
        }

        db.prepare(`
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
          VALUES (?, ?, 'TRANSFER_IN', ?, ?, ?)
        `).run(transfer.destination_warehouse_id, item.product_id, qty, transfer.transfer_number, `Transfert entrant depuis ${transfer.source_warehouse_name}`);
      }

      db.prepare("UPDATE transfers SET status = 'CONFIRMED', confirmed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
    });

    logAudit(req.user, 'TRANSFER_CONFIRMED', 'TRANSFER', id, `Confirmed transfer receipt ${transfer.transfer_number}`, transfer.destination_warehouse_id);
    return sendSuccess(res, { id, status: 'CONFIRMED' }, 'Transfer confirmed and inventory updated');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.post('/:id/decline', authenticate, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const user = req.user;
  const transfer = db.prepare('SELECT * FROM transfers WHERE id = ?').get(id) as any;
  if (!transfer) return sendError(res, `Transfer not found with id ${id}`, 404);

  // Authorization: Only source warehouse Manager or Admin can decline
  if (user?.role !== 'ADMIN') {
    if (user?.role !== 'MANAGER' || user?.warehouseId !== transfer.source_warehouse_id) {
      return sendError(res, 'Access denied: Only the source warehouse manager or an administrator can decline this transfer', 403);
    }
  }

  if (transfer.status !== 'REQUESTED') return sendError(res, `Cannot decline transfer in status ${transfer.status}`, 400);

  db.prepare("UPDATE transfers SET status = 'DECLINED', updated_at = datetime('now') WHERE id = ?").run(id);
  logAudit(req.user, 'TRANSFER_DECLINED', 'TRANSFER', id, `Declined transfer request ${transfer.transfer_number}`, transfer.source_warehouse_id);
  return sendSuccess(res, { id, status: 'DECLINED' }, 'Transfer declined');
});

router.post('/:id/cancel', authenticate, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const user = req.user;
  const transfer = db.prepare('SELECT * FROM transfers WHERE id = ?').get(id) as any;
  if (!transfer) return sendError(res, `Transfer not found with id ${id}`, 404);
  
  if (transfer.status === 'CONFIRMED' || transfer.status === 'CANCELLED' || transfer.status === 'DECLINED') {
    return sendError(res, `Cannot cancel transfer in status ${transfer.status}`, 400);
  }

  // Authorization: Only Requester, Destination Warehouse Manager, or Admin can cancel
  if (user?.role !== 'ADMIN') {
    const isRequester = user?.id === transfer.requested_by_user_id;
    const isDestManager = user?.role === 'MANAGER' && user?.warehouseId === transfer.destination_warehouse_id;
    if (!isRequester && !isDestManager) {
      return sendError(res, 'Access denied: You do not have permission to cancel this transfer', 403);
    }
  }

  try {
    runTransaction(() => {
      // If approved, release reservation
      if (transfer.status === 'APPROVED') {
        const items = db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id) as any[];
        for (const item of items) {
          const qty = Number(item.approved_quantity);
          if (qty > 0) {
            db.prepare("UPDATE stock SET reserved_quantity = reserved_quantity - ?, updated_at = datetime('now') WHERE warehouse_id = ? AND product_id = ?")
              .run(qty, transfer.source_warehouse_id, item.product_id);
          }
        }
      }
      db.prepare("UPDATE transfers SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?").run(id);
    });

    logAudit(req.user, 'TRANSFER_CANCELLED', 'TRANSFER', id, `Cancelled transfer ${transfer.transfer_number} and released reservation`, transfer.source_warehouse_id);
    return sendSuccess(res, { id, status: 'CANCELLED' }, 'Transfer cancelled');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
