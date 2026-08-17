import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { generateToken, authenticate, AuthRequest, logAudit } from '../middleware/auth.js';
import { UserContext, RoleName } from '../types/index.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return sendError(res, 'Username and password are required', 400);
  }

  const query = `
    SELECT u.id, u.username, u.password_hash, u.full_name, u.role_id, r.name as role_name,
           u.warehouse_id, w.name as warehouse_name, u.active
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN warehouses w ON u.warehouse_id = w.id
    WHERE u.username = ?
  `;

  const user = db.prepare(query).get(username) as any;
  if (!user || !user.active) {
    return sendError(res, 'Invalid username or password', 401);
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    return sendError(res, 'Invalid username or password', 401);
  }

  const userContext: UserContext = {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role_name as RoleName,
    warehouseId: user.warehouse_id,
    warehouseName: user.warehouse_name,
  };

  const token = generateToken(userContext);
  logAudit(userContext, 'LOGIN', 'USER', user.id, 'User logged in successfully', user.warehouse_id);

  return sendSuccess(res, {
    token,
    type: 'Bearer',
    id: user.id,
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role_name,
    warehouseId: user.warehouse_id,
    warehouseName: user.warehouse_name,
  }, 'Authentication successful');
});

router.get('/me', authenticate, (req: AuthRequest, res) => {
  if (!req.user) {
    return sendError(res, 'Unauthorized', 401);
  }
  return sendSuccess(res, req.user);
});

export default router;
