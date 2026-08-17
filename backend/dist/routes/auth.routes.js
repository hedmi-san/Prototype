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
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return (0, response_js_1.sendError)(res, 'Username and password are required', 400);
    }
    const query = `
    SELECT u.id, u.username, u.password_hash, u.full_name, u.role_id, r.name as role_name,
           u.warehouse_id, w.name as warehouse_name, u.active
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN warehouses w ON u.warehouse_id = w.id
    WHERE u.username = ?
  `;
    const user = database_js_1.db.prepare(query).get(username);
    if (!user || !user.active) {
        return (0, response_js_1.sendError)(res, 'Invalid username or password', 401);
    }
    const isPasswordValid = bcryptjs_1.default.compareSync(password, user.password_hash);
    if (!isPasswordValid) {
        return (0, response_js_1.sendError)(res, 'Invalid username or password', 401);
    }
    const userContext = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role_name,
        warehouseId: user.warehouse_id,
        warehouseName: user.warehouse_name,
    };
    const token = (0, auth_js_1.generateToken)(userContext);
    (0, auth_js_1.logAudit)(userContext, 'LOGIN', 'USER', user.id, 'User logged in successfully', user.warehouse_id);
    return (0, response_js_1.sendSuccess)(res, {
        token,
        type: 'Bearer',
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role_name,
        warehouseId: user.warehouse_id,
        warehouseName: user.warehouse_name,
    }, 'Authentication successful');
});
router.get('/me', auth_js_1.authenticate, (req, res) => {
    if (!req.user) {
        return (0, response_js_1.sendError)(res, 'Unauthorized', 401);
    }
    return (0, response_js_1.sendSuccess)(res, req.user);
});
exports.default = router;
