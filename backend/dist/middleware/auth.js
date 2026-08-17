import jwt from 'jsonwebtoken';
import { sendError } from '../common/response.js';
import { db } from '../db/database.js';
const JWT_SECRET = process.env.JWT_SECRET || 'distributor-super-secret-jwt-key-for-auth-2026';
export function generateToken(user) {
    return jwt.sign({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        warehouseId: user.warehouseId,
        warehouseName: user.warehouseName,
    }, JWT_SECRET, { expiresIn: '24h' });
}
export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        sendError(res, 'Authentication required: No token provided', 401);
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        sendError(res, 'Invalid or expired token', 401);
        return;
    }
}
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
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
export function validateWarehouseScope(user, requestedWarehouseId) {
    if (!requestedWarehouseId)
        return;
    if (user.role === 'ADMIN' || user.role === 'SUPER_MANAGER')
        return;
    if (user.warehouseId !== requestedWarehouseId) {
        throw new Error(`Access denied: User belongs to warehouse ID ${user.warehouseId}, not ${requestedWarehouseId}`);
    }
}
export function logAudit(user, action, entityType, entityId, description, warehouseId, oldValues, newValues) {
    try {
        const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, warehouse_id, action, entity_type, entity_id, old_values, new_values, description, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '127.0.0.1')
    `);
        stmt.run(user ? user.id : null, warehouseId !== undefined ? warehouseId : (user?.warehouseId || null), action, entityType, String(entityId), oldValues || null, newValues || null, description);
    }
    catch (err) {
        console.error('Failed to log audit event:', err);
    }
}
