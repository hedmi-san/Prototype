import { Router, Response } from 'express';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import {
  getWarehouseNotifications,
  getWarehouseNotificationCounts,
  markNotificationRead,
  markAllNotificationsRead,
} from '../common/notifications.js';

const router = Router();

function mapNotificationRow(n: any) {
  return {
    id: n.id,
    warehouseId: n.warehouse_id,
    warehouseName: n.warehouse_name,
    actorUserId: n.actor_user_id,
    actorUserName: n.actor_user_name,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    metadata: typeof n.metadata === 'string' ? JSON.parse(n.metadata) : (n.metadata || {}),
    isRead: Boolean(n.is_read),
    readAt: n.read_at,
    createdAt: n.created_at,
  };
}

/**
 * Resolves the effective target warehouseId based on user role and scoping rules.
 * - Admin: returns null (no notifications)
 * - Super Manager: returns warehouseId from query or body if provided, or user.warehouseId
 * - Staff: strictly user.warehouseId
 */
function resolveTargetWarehouseId(req: AuthRequest): number | null {
  const user = req.user;
  if (!user) return null;
  if (user.role === 'ADMIN') {
    return null;
  }
  if (user.role === 'SUPER_MANAGER') {
    const rawWh =
      req.query.warehouseId !== undefined && req.query.warehouseId !== ''
        ? req.query.warehouseId
        : req.body?.warehouseId;
    const parsed = rawWh != null ? Number(rawWh) : null;
    if (parsed && !isNaN(parsed)) {
      return parsed;
    }
    return user.warehouseId || null;
  }
  return user.warehouseId || null;
}

/**
 * GET /api/notifications
 * Lists notifications with pagination and unread filtering.
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const warehouseId = resolveTargetWarehouseId(req);
    if (!warehouseId) {
      return sendSuccess(res, {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      });
    }

    const unreadOnly = req.query.unreadOnly === 'true';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));

    const result = await getWarehouseNotifications(warehouseId, {
      unreadOnly,
      page,
      limit,
    });

    return sendSuccess(res, {
      items: result.items.map(mapNotificationRow),
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

/**
 * GET /api/notifications/counts
 * Returns unread count, pending transfers count, and pending pickups count for active warehouse.
 */
router.get('/counts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const warehouseId = resolveTargetWarehouseId(req);
    if (!warehouseId) {
      return sendSuccess(res, {
        unreadCount: 0,
        pendingTransfersCount: 0,
        pendingPickupsCount: 0,
      });
    }

    const counts = await getWarehouseNotificationCounts(warehouseId);
    return sendSuccess(res, counts);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a single notification as read.
 */
router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role === 'ADMIN') {
      return sendError(res, 'Admins cannot modify warehouse notifications', 403);
    }

    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return sendError(res, 'Invalid notification ID', 400);
    }

    const warehouseId = resolveTargetWarehouseId(req);
    if (!warehouseId) {
      return sendSuccess(res, { success: false });
    }

    const updated = await markNotificationRead(id, warehouseId);
    return sendSuccess(res, { success: updated });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

/**
 * POST /api/notifications/read-all
 * Marks all unread notifications as read for active warehouse.
 */
router.post('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role === 'ADMIN') {
      return sendError(res, 'Admins cannot modify warehouse notifications', 403);
    }

    const warehouseId = resolveTargetWarehouseId(req);
    if (!warehouseId) {
      return sendSuccess(res, { count: 0 });
    }

    const count = await markAllNotificationsRead(warehouseId);
    return sendSuccess(res, { count });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
