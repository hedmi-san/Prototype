import { PoolClient } from 'pg';
import { query } from '../db/database.js';
import { AppNotification, NotificationCounts, NotificationType } from '../types/index.js';

export interface CreateNotificationParams {
  warehouseId: number;
  actorUserId?: number | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Creates a notification record for a specific warehouse.
 * Supports transactional execution with an optional PoolClient.
 */
export async function createNotification(
  client: PoolClient | null,
  params: CreateNotificationParams
): Promise<AppNotification> {
  const {
    warehouseId,
    actorUserId = null,
    type,
    title,
    message,
    link = null,
    metadata = {},
  } = params;

  const sql = `
    INSERT INTO notifications (
      warehouse_id, actor_user_id, type, title, message, link, metadata, is_read, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())
    RETURNING *
  `;
  const values = [
    warehouseId,
    actorUserId,
    type,
    title,
    message,
    link,
    JSON.stringify(metadata),
  ];

  const res = client ? await client.query(sql, values) : await query(sql, values);
  return res.rows[0];
}

/**
 * Fetches paginated notifications for a warehouse.
 */
export async function getWarehouseNotifications(
  warehouseId: number,
  options: {
    unreadOnly?: boolean;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ items: AppNotification[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, Math.min(100, options.limit || 20));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = ['n.warehouse_id = $1'];
  const params: any[] = [warehouseId];

  if (options.unreadOnly) {
    whereClauses.push('n.is_read = FALSE');
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const countSql = `SELECT COUNT(*) as total FROM notifications n ${whereSql}`;
  const countRes = await query(countSql, params);
  const total = Number(countRes.rows[0]?.total || 0);

  const listSql = `
    SELECT 
      n.id,
      n.warehouse_id,
      w.name as warehouse_name,
      n.actor_user_id,
      u.full_name as actor_user_name,
      n.type,
      n.title,
      n.message,
      n.link,
      n.metadata,
      n.is_read,
      n.read_at,
      n.created_at
    FROM notifications n
    LEFT JOIN warehouses w ON n.warehouse_id = w.id
    LEFT JOIN users u ON n.actor_user_id = u.id
    ${whereSql}
    ORDER BY n.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const listRes = await query(listSql, [...params, limit, offset]);

  return {
    items: listRes.rows,
    total,
    page,
    limit,
  };
}

/**
 * Fetches operational badge counts for a given warehouse.
 */
export async function getWarehouseNotificationCounts(
  warehouseId: number
): Promise<NotificationCounts> {
  // 1. Unread notifications count
  const unreadRes = await query(
    'SELECT COUNT(*) as count FROM notifications WHERE warehouse_id = $1 AND is_read = FALSE',
    [warehouseId]
  );
  const unreadCount = Number(unreadRes.rows[0]?.count || 0);

  // 2. Pending transfers requiring action from this warehouse:
  // - Incoming requests to review & approve (source = this warehouse & status = 'REQUESTED')
  // - Approved requests dispatched to this warehouse awaiting receipt (destination = this warehouse & status = 'APPROVED')
  const transferRes = await query(
    `SELECT COUNT(*) as count FROM transfers 
     WHERE (source_warehouse_id = $1 AND status = 'REQUESTED')
        OR (destination_warehouse_id = $1 AND status = 'APPROVED')`,
    [warehouseId]
  );
  const pendingTransfersCount = Number(transferRes.rows[0]?.count || 0);

  // 3. Pending pickups to fulfill at this warehouse
  const pickupRes = await query(
    `SELECT COUNT(*) as count FROM sale_fulfillment_lines 
     WHERE fulfillment_warehouse_id = $1 AND fulfillment_status = 'PENDING_PICKUP'`,
    [warehouseId]
  );
  const pendingPickupsCount = Number(pickupRes.rows[0]?.count || 0);

  return {
    unreadCount,
    pendingTransfersCount,
    pendingPickupsCount,
  };
}

/**
 * Marks a notification as read within a specific warehouse scope.
 */
export async function markNotificationRead(
  id: number,
  warehouseId: number
): Promise<boolean> {
  if (!warehouseId || isNaN(warehouseId)) {
    return false;
  }
  const sql =
    'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1 AND warehouse_id = $2';
  const res = await query(sql, [id, warehouseId]);
  return (res.rowCount || 0) > 0;
}

/**
 * Marks all unread notifications as read for a warehouse.
 */
export async function markAllNotificationsRead(
  warehouseId: number
): Promise<number> {
  const res = await query(
    'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE warehouse_id = $1 AND is_read = FALSE',
    [warehouseId]
  );
  return res.rowCount || 0;
}
