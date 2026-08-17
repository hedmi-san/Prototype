import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, AuthRequest, logAudit } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, requireRole('ADMIN'), (req: AuthRequest, res) => {
  const query = `
    SELECT u.id, u.username, u.full_name, u.role_id, r.name as role_name,
           u.warehouse_id, w.name as warehouse_name, u.active, u.created_at, u.updated_at
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN warehouses w ON u.warehouse_id = w.id
    ORDER BY u.id ASC
  `;
  const users = db.prepare(query).all().map((u: any) => ({
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

  return sendSuccess(res, users);
});

router.post('/', authenticate, requireRole('ADMIN'), (req: AuthRequest, res) => {
  const { username, password, fullName, roleName, warehouseId } = req.body;
  if (!username || !password || !fullName || !roleName) {
    return sendError(res, 'username, password, fullName, and roleName are required', 400);
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return sendError(res, `User with username '${username}' already exists`, 400);
  }

  const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName) as any;
  if (!role) {
    return sendError(res, `Invalid role: ${roleName}`, 400);
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const stmt = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role_id, warehouse_id, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  const info = stmt.run(username, passwordHash, fullName, role.id, warehouseId || null);
  const newId = Number(info.lastInsertRowid);

  logAudit(req.user, 'USER_CREATED', 'USER', newId, `Created user ${username} with role ${roleName}`);
  return sendSuccess(res, { id: newId, username, fullName, roleName, warehouseId: warehouseId || null, active: true }, 'User created successfully', 201);
});

export default router;
