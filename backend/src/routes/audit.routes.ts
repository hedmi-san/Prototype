import { Router } from 'express';
import { db } from '../db/database.js';
import { sendSuccess } from '../common/response.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, requireRole('ADMIN', 'SUPER_MANAGER', 'MANAGER'), (req: AuthRequest, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const action = req.query.action as string | undefined;
  const search = (req.query.search as string | undefined)?.trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
  const offset = (page - 1) * limit;

  let baseFromWhere = `
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN warehouses w ON a.warehouse_id = w.id
  `;

  const params: any[] = [];
  const whereClauses: string[] = [];

  if (warehouseId) {
    whereClauses.push('a.warehouse_id = ?');
    params.push(warehouseId);
  } else if (req.user?.role === 'MANAGER') {
    whereClauses.push('a.warehouse_id = ?');
    params.push(req.user.warehouseId);
  }

  if (action) {
    whereClauses.push('a.action = ?');
    params.push(action);
  }

  if (startDate) {
    const formattedStart = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
    whereClauses.push('a.created_at >= ?');
    params.push(formattedStart);
  }

  if (endDate) {
    const formattedEnd = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
    whereClauses.push('a.created_at <= ?');
    params.push(formattedEnd);
  }

  if (search) {
    whereClauses.push('(u.username LIKE ? OR u.full_name LIKE ? OR a.action LIKE ? OR a.entity_type LIKE ? OR a.description LIKE ? OR w.name LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (whereClauses.length > 0) {
    baseFromWhere += ' WHERE ' + whereClauses.join(' AND ');
  }

  const countQuery = `SELECT COUNT(*) as count ${baseFromWhere}`;
  const total = (db.prepare(countQuery).get(...params) as any)?.count || 0;

  const selectQuery = `
    SELECT a.id, a.user_id, u.username, u.full_name as user_full_name,
           a.warehouse_id, w.name as warehouse_name,
           a.action, a.entity_type, a.entity_id,
           a.old_values, a.new_values, a.description,
           a.ip_address, a.created_at
    ${baseFromWhere}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT ? OFFSET ?
  `;

  const logs = db.prepare(selectQuery).all(...params, limit, offset).map((l: any) => ({
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

  const totalPages = Math.ceil(total / limit) || 1;

  return sendSuccess(res, {
    items: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
});

export default router;
