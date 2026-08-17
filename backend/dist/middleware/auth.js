"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.validateWarehouseScope = validateWarehouseScope;
exports.logAudit = logAudit;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const response_js_1 = require("../common/response.js");
const database_js_1 = require("../db/database.js");
const JWT_SECRET = process.env.JWT_SECRET || 'distributor-super-secret-jwt-key-for-auth-2026';
function generateToken(user) {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        warehouseId: user.warehouseId,
        warehouseName: user.warehouseName,
    }, JWT_SECRET, { expiresIn: '24h' });
}
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        (0, response_js_1.sendError)(res, 'Authentication required: No token provided', 401);
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        (0, response_js_1.sendError)(res, 'Invalid or expired token', 401);
        return;
    }
}
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            (0, response_js_1.sendError)(res, 'Unauthorized', 401);
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            (0, response_js_1.sendError)(res, `Access denied: requires one of [${allowedRoles.join(', ')}]`, 403);
            return;
        }
        next();
    };
}
function validateWarehouseScope(user, requestedWarehouseId) {
    if (!requestedWarehouseId)
        return;
    if (user.role === 'ADMIN' || user.role === 'SUPER_MANAGER')
        return;
    if (user.warehouseId !== requestedWarehouseId) {
        throw new Error(`Access denied: User belongs to warehouse ID ${user.warehouseId}, not ${requestedWarehouseId}`);
    }
}
function logAudit(user, action, entityType, entityId, description, warehouseId, oldValues, newValues) {
    try {
        const stmt = database_js_1.db.prepare(`
      INSERT INTO audit_logs (user_id, warehouse_id, action, entity_type, entity_id, old_values, new_values, description, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '127.0.0.1')
    `);
        stmt.run(user ? user.id : null, warehouseId !== undefined ? warehouseId : (user?.warehouseId || null), action, entityType, String(entityId), oldValues || null, newValues || null, description);
    }
    catch (err) {
        console.error('Failed to log audit event:', err);
    }
}
