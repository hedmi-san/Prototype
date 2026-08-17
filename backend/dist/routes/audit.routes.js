import { Router } from 'express';
import { db } from '../db/database.js';
import { sendSuccess } from '../common/response.js';
import { authenticate, requireRole } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, requireRole('ADMIN', 'SUPER_MANAGER', 'MANAGER'), (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    let query = `
    SELECT a.id, a.user_id, u.username, u.full_name as user_full_name,
           a.warehouse_id, w.name as warehouse_name,
           a.action, a.entity_type, a.entity_id,
           a.old_values, a.new_values, a.description,
           a.ip_address, a.created_at
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN warehouses w ON a.warehouse_id = w.id
  `;
    const params = [];
    if (warehouseId) {
        query += ' WHERE a.warehouse_id = ?';
        params.push(warehouseId);
    }
    else if (req.user?.role === 'MANAGER') {
        query += ' WHERE a.warehouse_id = ?';
        params.push(req.user.warehouseId);
    }
    query += ' ORDER BY a.created_at DESC, a.id DESC LIMIT 150';
    const logs = db.prepare(query).all(...params).map((l) => ({
        id: l.id,
        userId: l.user_id,
        username: l.username || 'SYSTEM',
        userFullName: l.user_full_name || 'System Automated',
        warehouseId: l.warehouse_id,
        warehouseName: l.warehouse_name,
        action: l.action,
        entityType: l.entity_type,
        entityId: l.entity_id,
        oldValues: l.old_values,
        newValues: l.new_values,
        description: l.description,
        ipAddress: l.ip_address,
        createdAt: l.created_at,
    }));
    return sendSuccess(res, logs);
});
export default router;
