import { Router } from 'express';
import { query, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { generateCsv, sendCsv } from '../common/csv.js';
import { authenticate, requireRole, logAudit, validateWarehouseScope, enforceWarehouseScope } from '../middleware/auth.js';
const router = Router();
router.get('/stock', authenticate, async (req, res) => {
    try {
        const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
        const status = req.query.status?.toLowerCase();
        const search = req.query.search?.trim();
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
        const offset = (page - 1) * limit;
        if (warehouseId && req.user) {
            try {
                validateWarehouseScope(req.user, warehouseId);
            }
            catch (err) {
                return sendError(res, err.message, 403);
            }
        }
        const baseWhere = 'FROM stock s JOIN warehouses w ON s.warehouse_id = w.id JOIN products p ON s.product_id = p.id';
        const baseWhereClauses = [];
        const baseParams = [];
        if (warehouseId) {
            baseParams.push(warehouseId);
            baseWhereClauses.push(`s.warehouse_id = $${baseParams.length}`);
        }
        else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
            baseParams.push(req.user.warehouseId);
            baseWhereClauses.push(`s.warehouse_id = $${baseParams.length}`);
        }
        const baseWhereSql = baseWhereClauses.length > 0 ? ` WHERE ${baseWhereClauses.join(' AND ')}` : '';
        // Calculate aggregated counts for status tabs across the current warehouse scope in one single-pass query
        const countsSql = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE (s.physical_quantity - s.reserved_quantity) > p.min_stock_alert) as normal_count,
        COUNT(*) FILTER (WHERE (s.physical_quantity - s.reserved_quantity) > 0 AND (s.physical_quantity - s.reserved_quantity) <= p.min_stock_alert) as low_count,
        COUNT(*) FILTER (WHERE (s.physical_quantity - s.reserved_quantity) <= 0) as out_count
      ${baseWhere}
      ${baseWhereSql}
    `;
        const countsRes = await query(countsSql, baseParams);
        const countsRow = countsRes.rows[0] || {};
        const counts = {
            total: Number(countsRow.total_count || 0),
            normal: Number(countsRow.normal_count || 0),
            low: Number(countsRow.low_count || 0),
            out: Number(countsRow.out_count || 0),
        };
        // Filtered Query (combining warehouse scope + status filter + search filter)
        const filteredWhereClauses = [...baseWhereClauses];
        const filteredParams = [...baseParams];
        if (status === 'normal') {
            filteredWhereClauses.push('(s.physical_quantity - s.reserved_quantity) > p.min_stock_alert');
        }
        else if (status === 'low') {
            filteredWhereClauses.push('(s.physical_quantity - s.reserved_quantity) > 0 AND (s.physical_quantity - s.reserved_quantity) <= p.min_stock_alert');
        }
        else if (status === 'out') {
            filteredWhereClauses.push('(s.physical_quantity - s.reserved_quantity) <= 0');
        }
        if (search) {
            const p1 = filteredParams.length + 1;
            const p2 = filteredParams.length + 2;
            const p3 = filteredParams.length + 3;
            const p4 = filteredParams.length + 4;
            filteredWhereClauses.push(`(p.name ILIKE $${p1} OR p.reference ILIKE $${p2} OR p.brand ILIKE $${p3} OR w.name ILIKE $${p4})`);
            const term = `%${search}%`;
            filteredParams.push(term, term, term, term);
        }
        const filteredWhereSql = filteredWhereClauses.length > 0 ? ` WHERE ${filteredWhereClauses.join(' AND ')}` : '';
        const countQuery = `SELECT COUNT(*) as count ${baseWhere} ${filteredWhereSql}`;
        const countRes = await query(countQuery, filteredParams);
        const total = Number(countRes.rows[0]?.count || 0);
        const selectParams = [...filteredParams, limit, offset];
        const limitParamIdx = selectParams.length - 1;
        const offsetParamIdx = selectParams.length;
        const selectSql = `
      SELECT s.id, s.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
             s.product_id, p.name as product_name, p.reference as product_reference, p.brand as product_brand, p.unit as product_unit,
             p.box_size as product_box_size,
             s.physical_quantity, s.reserved_quantity,
             (s.physical_quantity - s.reserved_quantity) as available_quantity,
             p.purchase_price as product_purchase_price, p.sale_price as product_sale_price,
             p.purchase_price, p.sale_price,
             (s.physical_quantity * p.purchase_price) as total_valuation,
             p.min_stock_alert, s.updated_at
      ${baseWhere}
      ${filteredWhereSql}
      ORDER BY w.name ASC, p.name ASC
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `;
        const result = await query(selectSql, selectParams);
        const rows = result.rows.map((row) => ({
            id: row.id,
            warehouseId: row.warehouse_id,
            warehouseName: row.warehouse_name,
            warehouseCode: row.warehouse_code,
            productId: row.product_id,
            productName: row.product_name,
            productReference: row.product_reference,
            productBrand: row.product_brand,
            brand: row.product_brand,
            productUnit: row.product_unit,
            productBoxSize: Number(row.product_box_size || 0),
            boxCount: Number(row.product_box_size) > 0 ? Math.floor(Number(row.physical_quantity) / Number(row.product_box_size)) : 0,
            productPurchasePrice: Number(row.product_purchase_price),
            productSalePrice: Number(row.product_sale_price),
            physicalQuantity: Number(row.physical_quantity),
            reservedQuantity: Number(row.reserved_quantity),
            availableQuantity: Number(row.available_quantity),
            purchasePrice: Number(row.purchase_price),
            salePrice: Number(row.sale_price),
            totalValuation: Number(row.total_valuation),
            minStockAlert: Number(row.min_stock_alert),
            updatedAt: row.updated_at,
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
            counts,
        });
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.get('/export/csv', authenticate, async (req, res) => {
    try {
        const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
        const status = req.query.status?.toLowerCase();
        const lowStock = req.query.lowStock === 'true';
        const search = req.query.search?.trim();
        const idsParam = req.query.ids?.trim();
        if (warehouseId && req.user) {
            try {
                validateWarehouseScope(req.user, warehouseId);
            }
            catch (err) {
                return sendError(res, err.message, 403);
            }
        }
        let sql = `
      SELECT s.id, s.warehouse_id, w.name as warehouse_name,
             s.product_id, p.name as product_name, p.reference as product_reference, p.brand,
             p.box_size,
             s.physical_quantity, s.reserved_quantity,
             (s.physical_quantity - s.reserved_quantity) as available_quantity,
             p.purchase_price, p.sale_price,
             (s.physical_quantity * p.purchase_price) as total_valuation,
             p.min_stock_alert, s.updated_at
      FROM stock s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN products p ON s.product_id = p.id
    `;
        const whereClauses = [];
        const params = [];
        if (idsParam) {
            const parsedIds = idsParam
                .split(',')
                .map((id) => Number(id.trim()))
                .filter((id) => !isNaN(id) && id > 0);
            if (parsedIds.length > 0) {
                params.push(parsedIds);
                whereClauses.push(`s.id = ANY($${params.length}::int[])`);
            }
        }
        if (warehouseId) {
            params.push(warehouseId);
            whereClauses.push(`s.warehouse_id = $${params.length}`);
        }
        else if (req.user?.role === 'MANAGER' || req.user?.role === 'ACCOUNTANT') {
            params.push(req.user.warehouseId);
            whereClauses.push(`s.warehouse_id = $${params.length}`);
        }
        if (status === 'normal') {
            whereClauses.push('(s.physical_quantity - s.reserved_quantity) > p.min_stock_alert');
        }
        else if (status === 'low' || lowStock) {
            whereClauses.push('(s.physical_quantity - s.reserved_quantity) > 0 AND (s.physical_quantity - s.reserved_quantity) <= p.min_stock_alert');
        }
        else if (status === 'out') {
            whereClauses.push('(s.physical_quantity - s.reserved_quantity) <= 0');
        }
        if (search) {
            const p1 = params.length + 1;
            const p2 = params.length + 2;
            const p3 = params.length + 3;
            const p4 = params.length + 4;
            whereClauses.push(`(p.name ILIKE $${p1} OR p.reference ILIKE $${p2} OR p.brand ILIKE $${p3} OR w.name ILIKE $${p4})`);
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }
        if (whereClauses.length > 0) {
            sql += ' WHERE ' + whereClauses.join(' AND ');
        }
        sql += ' ORDER BY w.name ASC, p.name ASC';
        const result = await query(sql, params);
        const rows = result.rows;
        const columns = [
            { header: 'Dépôt', key: 'warehouse_name' },
            { header: 'Référence', key: 'product_reference' },
            { header: 'Désignation', key: 'product_name' },
            { header: 'Marque', key: 'brand' },
            { header: 'Colisage (Pcs/Carton)', key: 'box_size', format: (r) => (r.box_size ? String(r.box_size) : '—') },
            { header: 'Nombre de Cartons', format: (r) => (r.box_size > 0 ? String(Math.floor(r.physical_quantity / r.box_size)) : '—') },
            { header: 'Quantité Physique', key: 'physical_quantity' },
            { header: 'Quantité Réservée', key: 'reserved_quantity' },
            { header: 'Quantité Disponible', key: 'available_quantity' },
            { header: 'Seuil Alerte Min', key: 'min_stock_alert' },
            {
                header: 'Statut',
                format: (r) => r.available_quantity <= 0
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
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.get('/movements', authenticate, async (req, res) => {
    try {
        const requestedWarehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
        const warehouseId = enforceWarehouseScope(req.user, requestedWarehouseId);
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const type = req.query.type;
        const search = req.query.search?.trim();
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
        const offset = (page - 1) * limit;
        let baseFromWhere = `
      FROM stock_movements m
      JOIN warehouses w ON m.warehouse_id = w.id
      JOIN products p ON m.product_id = p.id
    `;
        const whereClauses = [];
        const params = [];
        if (warehouseId) {
            params.push(warehouseId);
            whereClauses.push(`m.warehouse_id = $${params.length}`);
        }
        if (type) {
            params.push(type);
            whereClauses.push(`m.movement_type = $${params.length}`);
        }
        if (startDate) {
            const formattedStart = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
            params.push(formattedStart);
            whereClauses.push(`m.created_at >= $${params.length}`);
        }
        if (endDate) {
            const formattedEnd = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
            params.push(formattedEnd);
            whereClauses.push(`m.created_at <= $${params.length}`);
        }
        if (search) {
            const p1 = params.length + 1;
            const p2 = params.length + 2;
            const p3 = params.length + 3;
            const p4 = params.length + 4;
            const p5 = params.length + 5;
            whereClauses.push(`(p.name ILIKE $${p1} OR p.reference ILIKE $${p2} OR w.name ILIKE $${p3} OR m.reference ILIKE $${p4} OR m.notes ILIKE $${p5})`);
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
        const limitParamIdx = selectParams.length - 1;
        const offsetParamIdx = selectParams.length;
        const selectQuery = `
      SELECT m.id, m.warehouse_id, w.name as warehouse_name,
             m.product_id, p.name as product_name, p.reference as product_reference,
             m.movement_type, m.quantity_change, m.reference, m.notes, m.created_at
      ${baseFromWhere}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `;
        const result = await query(selectQuery, selectParams);
        const rows = result.rows.map((m) => ({
            id: m.id,
            warehouseId: m.warehouse_id,
            warehouseName: m.warehouse_name,
            productId: m.product_id,
            productName: m.product_name,
            productReference: m.product_reference,
            movementType: m.movement_type,
            type: m.movement_type,
            quantityChange: Number(m.quantity_change),
            quantity: Number(m.quantity_change),
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
    }
    catch (err) {
        const isAccessDenied = err.message?.includes('Access denied');
        return sendError(res, err.message, isAccessDenied ? 403 : 500);
    }
});
router.post('/initial-receipt', authenticate, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
    const { warehouseId, productId, quantity, reference, notes } = req.body;
    if (!warehouseId || !productId || !quantity || quantity <= 0) {
        return sendError(res, 'warehouseId, productId, and positive quantity are required', 400);
    }
    try {
        const result = await runTransaction(async (client) => {
            const stockRes = await client.query('SELECT * FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE', [warehouseId, productId]);
            const stock = stockRes.rows[0];
            if (stock) {
                await client.query('UPDATE stock SET physical_quantity = physical_quantity + $1, updated_at = NOW() WHERE id = $2', [quantity, stock.id]);
            }
            else {
                await client.query('INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity) VALUES ($1, $2, $3, 0)', [warehouseId, productId, quantity]);
            }
            await client.query(`
        INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
        VALUES ($1, $2, 'INITIAL_STOCK', $3, $4, $5)
      `, [warehouseId, productId, quantity, reference || 'INIT-STOCK', notes || 'Initial stock receipt']);
            const updated = await client.query('SELECT * FROM stock WHERE warehouse_id = $1 AND product_id = $2', [warehouseId, productId]);
            return updated.rows[0];
        });
        await logAudit(req.user, 'INITIAL_STOCK_RECEIVED', 'STOCK', productId, `Received ${quantity} units into warehouse ID ${warehouseId}`, warehouseId);
        return sendSuccess(res, result, 'Stock received successfully');
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.post('/adjustments', authenticate, requireRole('ADMIN', 'MANAGER', 'ACCOUNTANT'), async (req, res) => {
    const { warehouseId, productId, quantity, reason, notes } = req.body;
    if (!warehouseId || !productId || quantity === undefined) {
        return sendError(res, 'warehouseId, productId, and quantity adjustment are required', 400);
    }
    try {
        const result = await runTransaction(async (client) => {
            const stockRes = await client.query('SELECT * FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE', [warehouseId, productId]);
            const stock = stockRes.rows[0];
            const currentQty = stock ? Number(stock.physical_quantity) : 0;
            const reservedQty = stock ? Number(stock.reserved_quantity) : 0;
            const newQty = currentQty + Number(quantity);
            if (newQty < reservedQty) {
                throw new Error(`Adjustment invalid: physical stock (${newQty}) cannot be less than reserved transfer stock (${reservedQty})`);
            }
            if (stock) {
                await client.query('UPDATE stock SET physical_quantity = $1, updated_at = NOW() WHERE id = $2', [newQty, stock.id]);
            }
            else {
                if (newQty < 0)
                    throw new Error('Initial stock quantity cannot be negative');
                await client.query('INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity) VALUES ($1, $2, $3, 0)', [warehouseId, productId, newQty]);
            }
            await client.query(`
        INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
        VALUES ($1, $2, 'ADJUSTMENT', $3, $4, $5)
      `, [warehouseId, productId, Number(quantity), reason || 'INVENTORY_AUDIT', notes || `Stock adjusted from ${currentQty} to ${newQty}`]);
            return { warehouseId, productId, previousQuantity: currentQty, newQuantity: newQty };
        });
        await logAudit(req.user, 'STOCK_ADJUSTED', 'STOCK', productId, `Adjusted stock by ${quantity} units (Reason: ${reason})`, warehouseId);
        return sendSuccess(res, result, 'Stock adjusted successfully');
    }
    catch (err) {
        return sendError(res, err.message, 400);
    }
});
export default router;
