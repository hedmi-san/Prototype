import { Router } from 'express';
import { query } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, AuthRequest, enforceWarehouseScope } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, requireRole('ADMIN', 'SUPER_MANAGER', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const requestedWarehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const warehouseId = enforceWarehouseScope(req.user, requestedWarehouseId);
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
      params.push(warehouseId);
      whereClauses.push(`a.warehouse_id = $${params.length}`);
    }

    if (action) {
      params.push(action);
      whereClauses.push(`a.action = $${params.length}`);
    }

    if (startDate) {
      const formattedStart = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
      params.push(formattedStart);
      whereClauses.push(`a.created_at >= $${params.length}`);
    }

    if (endDate) {
      const formattedEnd = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
      params.push(formattedEnd);
      whereClauses.push(`a.created_at <= $${params.length}`);
    }

    if (search) {
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      const p3 = params.length + 3;
      const p4 = params.length + 4;
      const p5 = params.length + 5;
      const p6 = params.length + 6;
      whereClauses.push(`(u.username ILIKE $${p1} OR u.full_name ILIKE $${p2} OR a.action ILIKE $${p3} OR a.entity_type ILIKE $${p4} OR a.description ILIKE $${p5} OR w.name ILIKE $${p6})`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
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
      SELECT a.id, a.user_id, u.username, u.full_name as user_full_name,
             a.warehouse_id, w.name as warehouse_name,
             a.action, a.entity_type, a.entity_id,
             a.old_values, a.new_values, a.description,
             a.ip_address, a.created_at
      ${baseFromWhere}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const result = await query(selectQuery, selectParams);
    const logs = result.rows.map((l: any) => ({
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
  } catch (err: any) {
    const isAccessDenied = err.message?.includes('Access denied');
    return sendError(res, err.message, isAccessDenied ? 403 : 500);
  }
});

export default router;
