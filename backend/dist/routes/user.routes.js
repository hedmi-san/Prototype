"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_js_1 = require("../db/database.js");
const response_js_1 = require("../common/response.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
router.get('/', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN'), (req, res) => {
    const query = `
    SELECT u.id, u.username, u.full_name, u.role_id, r.name as role_name,
           u.warehouse_id, w.name as warehouse_name, u.active, u.created_at, u.updated_at
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN warehouses w ON u.warehouse_id = w.id
    ORDER BY u.id ASC
  `;
    const users = database_js_1.db.prepare(query).all().map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        roleId: u.role_id,
        roleName: u.role_name,
        warehouseId: u.warehouse_id,
        warehouseName: u.warehouse_name,
        active: Boolean(u.active),
        createdAt: u.created_at,
        updatedAt: u.updated_at,
    }));
    return (0, response_js_1.sendSuccess)(res, users);
});
router.post('/', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN'), (req, res) => {
    const { username, password, fullName, roleName, warehouseId } = req.body;
    if (!username || !password || !fullName || !roleName) {
        return (0, response_js_1.sendError)(res, 'username, password, fullName, and roleName are required', 400);
    }
    const existing = database_js_1.db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        return (0, response_js_1.sendError)(res, `User with username '${username}' already exists`, 400);
    }
    const role = database_js_1.db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
    if (!role) {
        return (0, response_js_1.sendError)(res, `Invalid role: ${roleName}`, 400);
    }
    const salt = bcryptjs_1.default.genSaltSync(10);
    const passwordHash = bcryptjs_1.default.hashSync(password, salt);
    const stmt = database_js_1.db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role_id, warehouse_id, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
    const info = stmt.run(username, passwordHash, fullName, role.id, warehouseId || null);
    const newId = Number(info.lastInsertRowid);
    (0, auth_js_1.logAudit)(req.user, 'USER_CREATED', 'USER', newId, `Created user ${username} with role ${roleName}`);
    return (0, response_js_1.sendSuccess)(res, { id: newId, username, fullName, roleName, warehouseId: warehouseId || null, active: true }, 'User created successfully', 201);
});
exports.default = router;
