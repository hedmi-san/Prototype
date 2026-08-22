import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserContext, RoleName } from '../types/index.js';
import { sendError } from '../common/response.js';
import { query } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'distributor-super-secret-jwt-key-for-auth-2026';

export interface AuthRequest extends Request {
  user?: UserContext;
}

export function generateToken(user: UserContext): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      warehouseId: user.warehouseId,
      warehouseName: user.warehouseName,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authentication required: No token provided', 401);
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserContext;
    req.user = decoded;
    next();
  } catch (err) {
    sendError(res, 'Invalid or expired token', 401);
    return;
  }
}

export function requireRole(...allowedRoles: RoleName[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      sendError(res, `Access denied: requires one of [${allowedRoles.join(', ')}]`, 403);
      return;
    }
    next();
  };
}

export function validateWarehouseScope(user: UserContext, requestedWarehouseId?: number): void {
  if (!requestedWarehouseId) return;
  if (user.role === 'ADMIN' || user.role === 'SUPER_MANAGER') return;
  if (user.warehouseId !== requestedWarehouseId) {
    throw new Error(`Access denied: User belongs to warehouse ID ${user.warehouseId}, not ${requestedWarehouseId}`);
  }
}

export async function logAudit(
  user: UserContext | undefined,
  action: string,
  entityType: string,
  entityId: string | number,
  description: string,
  warehouseId?: number | null,
  oldValues?: string | null,
  newValues?: string | null
): Promise<void> {
  try {
    await query(`
      INSERT INTO audit_logs (user_id, warehouse_id, action, entity_type, entity_id, old_values, new_values, description, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '127.0.0.1')
    `, [
      user ? user.id : null,
      warehouseId !== undefined ? warehouseId : (user?.warehouseId || null),
      action,
      entityType,
      String(entityId),
      oldValues || null,
      newValues || null,
      description,
    ]);
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}
