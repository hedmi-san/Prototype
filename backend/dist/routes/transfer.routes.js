import { Router } from 'express';
import { query, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, logAudit } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, async (req, res) => {
    try {
        const user = req.user;
        const filterWarehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const status = req.query.status;
        const search = req.query.search?.trim();
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
        const offset = (page - 1) * limit;
        let baseFromWhere = `
      FROM transfers t
      JOIN warehouses sw ON t.source_warehouse_id = sw.id
      JOIN warehouses dw ON t.destination_warehouse_id = dw.id
      JOIN users u ON t.requested_by_user_id = u.id
    `;
        const params = [];
        const whereClauses = [];
        // Enforce warehouse scoping for non-admin users
        if (user?.role !== 'ADMIN' && user?.warehouseId) {
            const p1 = params.length + 1;
            const p2 = params.length + 2;
            whereClauses.push(`(t.source_warehouse_id = $${p1} OR t.destination_warehouse_id = $${p2})`);
            params.push(user.warehouseId, user.warehouseId);
        }
        else if (filterWarehouseId) {
            const p1 = params.length + 1;
            const p2 = params.length + 2;
            whereClauses.push(`(t.source_warehouse_id = $${p1} OR t.destination_warehouse_id = $${p2})`);
            params.push(filterWarehouseId, filterWarehouseId);
        }
        if (status) {
            params.push(status);
            whereClauses.push(`t.status = $${params.length}`);
        }
        if (startDate) {
            const formattedStart = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
            params.push(formattedStart);
            whereClauses.push(`t.created_at >= $${params.length}`);
        }
        if (endDate) {
            const formattedEnd = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
            params.push(formattedEnd);
            whereClauses.push(`t.created_at <= $${params.length}`);
        }
        if (search) {
            const p1 = params.length + 1;
            const p2 = params.length + 2;
            const p3 = params.length + 3;
            const p4 = params.length + 4;
            const p5 = params.length + 5;
            whereClauses.push(`(t.transfer_number ILIKE $${p1} OR sw.name ILIKE $${p2} OR dw.name ILIKE $${p3} OR u.full_name ILIKE $${p4} OR t.notes ILIKE $${p5})`);
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }
        if (whereClauses.length > 0) {
            baseFromWhere += ' WHERE ' + whereClauses.join(' AND ');
        }
        const countQuery = `SELECT COUNT(*) as count ${baseFromWhere}`;
        const countRes = await query(countQuery, params);
        const total = Number(countRes.rows[0]?.count || 0);
        const selectParams = [...params, limit, offset];
        const limitIdx = selectParams.length - 1;
        const offsetIdx = selectParams.length;
        const selectQuery = `
      SELECT t.id, t.transfer_number,
             t.source_warehouse_id, sw.name as source_warehouse_name, sw.code as source_warehouse_code,
             t.destination_warehouse_id, dw.name as destination_warehouse_name, dw.code as destination_warehouse_code,
             t.requested_by_user_id, u.full_name as requested_by_name,
             t.status, t.notes, t.created_at, t.approved_at, t.confirmed_at, t.updated_at
      ${baseFromWhere}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;
        const transferRes = await query(selectQuery, selectParams);
        const transferRows = transferRes.rows;
        const transferIds = transferRows.map((t) => t.id);
        const itemsByTransferId = {};
        if (transferIds.length > 0) {
            const itemsRes = await query(`
        SELECT ti.id, ti.transfer_id, ti.product_id, p.name as product_name, p.reference as product_reference,
               ti.requested_quantity, ti.approved_quantity
        FROM transfer_items ti
        JOIN products p ON ti.product_id = p.id
        WHERE ti.transfer_id = ANY($1::int[])
      `, [transferIds]);
            for (const item of itemsRes.rows) {
                if (!itemsByTransferId[item.transfer_id]) {
                    itemsByTransferId[item.transfer_id] = [];
                }
                itemsByTransferId[item.transfer_id].push({
                    id: item.id,
                    productId: item.product_id,
                    productName: item.product_name,
                    productReference: item.product_reference,
                    requestedQuantity: Number(item.requested_quantity),
                    approvedQuantity: Number(item.approved_quantity),
                });
            }
        }
        const items = transferRows.map((t) => ({
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
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.get('/:id', authenticate, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const user = req.user;
        const transferRes = await query(`
      SELECT t.id, t.transfer_number,
             t.source_warehouse_id, sw.name as source_warehouse_name, sw.code as source_warehouse_code,
             t.destination_warehouse_id, dw.name as destination_warehouse_name, dw.code as destination_warehouse_code,
             t.requested_by_user_id, u.full_name as requested_by_name,
             t.status, t.notes, t.created_at, t.approved_at, t.confirmed_at, t.updated_at
      FROM transfers t
      JOIN warehouses sw ON t.source_warehouse_id = sw.id
      JOIN warehouses dw ON t.destination_warehouse_id = dw.id
      JOIN users u ON t.requested_by_user_id = u.id
      WHERE t.id = $1
    `, [id]);
        const t = transferRes.rows[0];
        if (!t)
            return sendError(res, `Transfer not found with id ${id}`, 404);
        if (user?.role !== 'ADMIN' && user?.warehouseId) {
            if (t.source_warehouse_id !== user.warehouseId && t.destination_warehouse_id !== user.warehouseId) {
                return sendError(res, 'Access denied: You cannot view transfers for warehouses you are not assigned to', 403);
            }
        }
        const itemsRes = await query(`
      SELECT ti.id, ti.product_id, p.name as product_name, p.reference as product_reference,
             ti.requested_quantity, ti.approved_quantity
      FROM transfer_items ti
      JOIN products p ON ti.product_id = p.id
      WHERE ti.transfer_id = $1
    `, [t.id]);
        const items = itemsRes.rows.map((i) => ({
            id: i.id,
            productId: i.product_id,
            productName: i.product_name,
            productReference: i.product_reference,
            requestedQuantity: Number(i.requested_quantity),
            approvedQuantity: Number(i.approved_quantity),
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
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.post('/', authenticate, async (req, res) => {
    const user = req.user;
    const { sourceWarehouseId, destinationWarehouseId, notes, items } = req.body;
    if (!sourceWarehouseId || !destinationWarehouseId || !items || !Array.isArray(items) || items.length === 0) {
        return sendError(res, 'sourceWarehouseId, destinationWarehouseId, and non-empty items are required', 400);
    }
    if (sourceWarehouseId === destinationWarehouseId) {
        return sendError(res, 'Source and destination warehouses must be different', 400);
    }
    if (user?.role !== 'ADMIN' && user?.warehouseId && user.warehouseId !== destinationWarehouseId) {
        return sendError(res, 'Access denied: You can only request transfers destined for your assigned warehouse', 403);
    }
    try {
        const result = await runTransaction(async (client) => {
            const transferNumber = `TRF-${Date.now().toString().slice(-8)}`;
            const insertRes = await client.query(`
        INSERT INTO transfers (transfer_number, source_warehouse_id, destination_warehouse_id, requested_by_user_id, status, notes)
        VALUES ($1, $2, $3, $4, 'REQUESTED', $5)
        RETURNING id
      `, [transferNumber, sourceWarehouseId, destinationWarehouseId, req.user?.id || 1, notes || '']);
            const transferId = insertRes.rows[0].id;
            for (const item of items) {
                await client.query(`
          INSERT INTO transfer_items (transfer_id, product_id, requested_quantity, approved_quantity)
          VALUES ($1, $2, $3, 0)
        `, [transferId, item.productId, item.requestedQuantity]);
            }
            return { id: transferId, transferNumber, status: 'REQUESTED' };
        });
        await logAudit(req.user, 'TRANSFER_REQUESTED', 'TRANSFER', result.id, `Created transfer request ${result.transferNumber}`, destinationWarehouseId);
        return sendSuccess(res, result, 'Transfer requested successfully', 201);
    }
    catch (err) {
        return sendError(res, err.message, 400);
    }
});
router.post('/:id/approve', authenticate, async (req, res) => {
    const id = Number(req.params.id);
    const user = req.user;
    const { items } = req.body;
    const transferRes = await query('SELECT * FROM transfers WHERE id = $1', [id]);
    const transfer = transferRes.rows[0];
    if (!transfer)
        return sendError(res, `Transfer not found with id ${id}`, 404);
    if (user?.role !== 'ADMIN') {
        if (user?.role !== 'MANAGER' || user?.warehouseId !== transfer.source_warehouse_id) {
            return sendError(res, 'Access denied: Only the source warehouse manager or an administrator can approve this transfer', 403);
        }
    }
    if (transfer.status !== 'REQUESTED')
        return sendError(res, `Cannot approve transfer in status ${transfer.status}`, 400);
    try {
        await runTransaction(async (client) => {
            const approvedItems = items && Array.isArray(items) ? items : [];
            const currentItemsRes = await client.query('SELECT * FROM transfer_items WHERE transfer_id = $1', [id]);
            const currentItems = currentItemsRes.rows;
            for (const curItem of currentItems) {
                const matchingApproved = approvedItems.find((i) => i.productId === curItem.product_id);
                const qtyToApprove = matchingApproved !== undefined ? Number(matchingApproved.approvedQuantity) : Number(curItem.requested_quantity);
                if (qtyToApprove < 0) {
                    throw new Error('Approved quantity cannot be negative');
                }
                const stockRes = await client.query('SELECT * FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE', [transfer.source_warehouse_id, curItem.product_id]);
                const stock = stockRes.rows[0];
                const physQty = stock ? Number(stock.physical_quantity) : 0;
                const resQty = stock ? Number(stock.reserved_quantity) : 0;
                const available = physQty - resQty;
                if (available < qtyToApprove) {
                    throw new Error(`Insufficient available stock at source warehouse to reserve ${qtyToApprove} units. Available: ${available}`);
                }
                if (qtyToApprove > 0) {
                    await client.query('UPDATE stock SET reserved_quantity = reserved_quantity + $1, updated_at = NOW() WHERE id = $2', [qtyToApprove, stock.id]);
                }
                await client.query('UPDATE transfer_items SET approved_quantity = $1 WHERE id = $2', [qtyToApprove, curItem.id]);
            }
            await client.query("UPDATE transfers SET status = 'APPROVED', approved_at = NOW(), updated_at = NOW() WHERE id = $1", [id]);
        });
        await logAudit(req.user, 'TRANSFER_APPROVED', 'TRANSFER', id, `Approved transfer ${transfer.transfer_number} and reserved stock`, transfer.source_warehouse_id);
        return sendSuccess(res, { id, status: 'APPROVED' }, 'Transfer approved and stock reserved');
    }
    catch (err) {
        return sendError(res, err.message, 400);
    }
});
router.post('/:id/confirm', authenticate, async (req, res) => {
    const id = Number(req.params.id);
    const user = req.user;
    const transferRes = await query(`
    SELECT t.*, sw.name as source_warehouse_name, dw.name as destination_warehouse_name
    FROM transfers t
    JOIN warehouses sw ON t.source_warehouse_id = sw.id
    JOIN warehouses dw ON t.destination_warehouse_id = dw.id
    WHERE t.id = $1
  `, [id]);
    const transfer = transferRes.rows[0];
    if (!transfer)
        return sendError(res, `Transfer not found with id ${id}`, 404);
    if (user?.role !== 'ADMIN') {
        if (user?.role !== 'MANAGER' || user?.warehouseId !== transfer.destination_warehouse_id) {
            return sendError(res, 'Access denied: Only the destination warehouse manager or an administrator can confirm receipt of this transfer', 403);
        }
    }
    if (transfer.status !== 'APPROVED')
        return sendError(res, `Cannot confirm transfer in status ${transfer.status}`, 400);
    try {
        await runTransaction(async (client) => {
            const itemsRes = await client.query('SELECT * FROM transfer_items WHERE transfer_id = $1', [id]);
            for (const item of itemsRes.rows) {
                const qty = Number(item.approved_quantity);
                if (qty <= 0)
                    continue;
                // Deduct physical and reserved at source
                const sourceStockRes = await client.query('SELECT * FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE', [transfer.source_warehouse_id, item.product_id]);
                const sourceStock = sourceStockRes.rows[0];
                if (!sourceStock || Number(sourceStock.physical_quantity) < qty || Number(sourceStock.reserved_quantity) < qty) {
                    throw new Error(`Source stock inconsistency for product ID ${item.product_id}: insufficient physical/reserved stock to deduct ${qty} units`);
                }
                await client.query(`
          UPDATE stock
          SET physical_quantity = physical_quantity - $1, reserved_quantity = reserved_quantity - $2, updated_at = NOW()
          WHERE warehouse_id = $3 AND product_id = $4
        `, [qty, qty, transfer.source_warehouse_id, item.product_id]);
                await client.query(`
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
          VALUES ($1, $2, 'TRANSFER_OUT', $3, $4, $5)
        `, [transfer.source_warehouse_id, item.product_id, -qty, transfer.transfer_number, `Transfert sortant vers ${transfer.destination_warehouse_name}`]);
                // Add physical at destination
                const destStockRes = await client.query('SELECT * FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE', [transfer.destination_warehouse_id, item.product_id]);
                const destStock = destStockRes.rows[0];
                if (destStock) {
                    await client.query('UPDATE stock SET physical_quantity = physical_quantity + $1, updated_at = NOW() WHERE id = $2', [qty, destStock.id]);
                }
                else {
                    await client.query('INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity) VALUES ($1, $2, $3, 0)', [transfer.destination_warehouse_id, item.product_id, qty]);
                }
                await client.query(`
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
          VALUES ($1, $2, 'TRANSFER_IN', $3, $4, $5)
        `, [transfer.destination_warehouse_id, item.product_id, qty, transfer.transfer_number, `Transfert entrant depuis ${transfer.source_warehouse_name}`]);
            }
            await client.query("UPDATE transfers SET status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW() WHERE id = $1", [id]);
        });
        await logAudit(req.user, 'TRANSFER_CONFIRMED', 'TRANSFER', id, `Confirmed transfer receipt ${transfer.transfer_number}`, transfer.destination_warehouse_id);
        return sendSuccess(res, { id, status: 'CONFIRMED' }, 'Transfer confirmed and inventory updated');
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.post('/:id/decline', authenticate, async (req, res) => {
    const id = Number(req.params.id);
    const user = req.user;
    const transferRes = await query('SELECT * FROM transfers WHERE id = $1', [id]);
    const transfer = transferRes.rows[0];
    if (!transfer)
        return sendError(res, `Transfer not found with id ${id}`, 404);
    if (user?.role !== 'ADMIN') {
        if (user?.role !== 'MANAGER' || user?.warehouseId !== transfer.source_warehouse_id) {
            return sendError(res, 'Access denied: Only the source warehouse manager or an administrator can decline this transfer', 403);
        }
    }
    if (transfer.status !== 'REQUESTED')
        return sendError(res, `Cannot decline transfer in status ${transfer.status}`, 400);
    await query("UPDATE transfers SET status = 'DECLINED', updated_at = NOW() WHERE id = $1", [id]);
    await logAudit(req.user, 'TRANSFER_DECLINED', 'TRANSFER', id, `Declined transfer request ${transfer.transfer_number}`, transfer.source_warehouse_id);
    return sendSuccess(res, { id, status: 'DECLINED' }, 'Transfer declined');
});
router.post('/:id/cancel', authenticate, async (req, res) => {
    const id = Number(req.params.id);
    const user = req.user;
    const transferRes = await query('SELECT * FROM transfers WHERE id = $1', [id]);
    const transfer = transferRes.rows[0];
    if (!transfer)
        return sendError(res, `Transfer not found with id ${id}`, 404);
    if (transfer.status === 'CONFIRMED' || transfer.status === 'CANCELLED' || transfer.status === 'DECLINED') {
        return sendError(res, `Cannot cancel transfer in status ${transfer.status}`, 400);
    }
    if (user?.role !== 'ADMIN') {
        const isRequester = user?.id === transfer.requested_by_user_id;
        const isDestManager = user?.role === 'MANAGER' && user?.warehouseId === transfer.destination_warehouse_id;
        if (!isRequester && !isDestManager) {
            return sendError(res, 'Access denied: You do not have permission to cancel this transfer', 403);
        }
    }
    try {
        await runTransaction(async (client) => {
            if (transfer.status === 'APPROVED') {
                const itemsRes = await client.query('SELECT * FROM transfer_items WHERE transfer_id = $1', [id]);
                for (const item of itemsRes.rows) {
                    const qty = Number(item.approved_quantity);
                    if (qty > 0) {
                        await client.query(`
              UPDATE stock SET reserved_quantity = reserved_quantity - $1, updated_at = NOW()
              WHERE warehouse_id = $2 AND product_id = $3
            `, [qty, transfer.source_warehouse_id, item.product_id]);
                    }
                }
            }
            await client.query("UPDATE transfers SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1", [id]);
        });
        await logAudit(req.user, 'TRANSFER_CANCELLED', 'TRANSFER', id, `Cancelled transfer ${transfer.transfer_number} and released reservation`, transfer.source_warehouse_id);
        return sendSuccess(res, { id, status: 'CANCELLED' }, 'Transfer cancelled');
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
export default router;
