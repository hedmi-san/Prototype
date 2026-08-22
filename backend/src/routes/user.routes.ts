import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, AuthRequest, logAudit } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const sql = `
      SELECT u.id, u.username, u.full_name, u.role_id, r.name as role_name,
             u.warehouse_id, w.name as warehouse_name, u.active, u.created_at, u.updated_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN warehouses w ON u.warehouse_id = w.id
      ORDER BY u.id ASC
    `;
    const result = await query(sql);
    const users = result.rows.map((u: any) => ({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      roleId: u.role_id,
      roleName: u.role_name,
      role: u.role_name,
      warehouseId: u.warehouse_id,
      warehouseName: u.warehouse_name,
      active: Boolean(u.active),
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    }));

    return sendSuccess(res, users);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.post('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { username, password, fullName, roleName, warehouseId } = req.body;
    if (!username || !password || !fullName || !roleName) {
      return sendError(res, 'username, password, fullName, and roleName are required', 400);
    }

    const existingRes = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingRes.rowCount && existingRes.rowCount > 0) {
      return sendError(res, `User with username '${username}' already exists`, 400);
    }

    const roleRes = await query('SELECT id FROM roles WHERE name = $1', [roleName]);
    const role = roleRes.rows[0];
    if (!role) {
      return sendError(res, `Invalid role: ${roleName}`, 400);
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const assignedWarehouseId = roleName === 'ADMIN' ? null : (warehouseId || null);

    const insertRes = await query(`
      INSERT INTO users (username, password_hash, full_name, role_id, warehouse_id, active)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      RETURNING id
    `, [username, passwordHash, fullName, role.id, assignedWarehouseId]);

    const newId = insertRes.rows[0].id;

    await logAudit(req.user, 'USER_CREATED', 'USER', newId, `Created user ${username} with role ${roleName}`, assignedWarehouseId);
    return sendSuccess(res, { id: newId, username, fullName, roleName, role: roleName, warehouseId: assignedWarehouseId, active: true }, 'User created successfully', 201);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.put('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const targetId = Number(req.params.id);
    if (isNaN(targetId)) {
      return sendError(res, 'Identifiant utilisateur invalide', 400);
    }

    const existingRes = await query(`
      SELECT u.*, r.name as role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = $1
    `, [targetId]);
    const existingUser = existingRes.rows[0];

    if (!existingUser) {
      return sendError(res, 'Utilisateur non trouvé', 404);
    }

    const { fullName, roleName, warehouseId, active, password } = req.body;

    // Safeguard: prevent modifying own role away from ADMIN or deactivating oneself
    if (req.user?.id === targetId) {
      if (roleName && roleName !== 'ADMIN') {
        return sendError(res, 'Vous ne pouvez pas modifier votre propre rôle administrateur', 400);
      }
      if (active !== undefined && !active) {
        return sendError(res, 'Vous ne pouvez pas désactiver votre propre compte administrateur', 400);
      }
    }

    let roleId = existingUser.role_id;
    let finalRoleName = existingUser.role_name;
    if (roleName) {
      const roleRecordRes = await query('SELECT id, name FROM roles WHERE name = $1', [roleName]);
      const roleRecord = roleRecordRes.rows[0];
      if (!roleRecord) {
        return sendError(res, `Rôle invalide: ${roleName}`, 400);
      }
      roleId = roleRecord.id;
      finalRoleName = roleRecord.name;
    }

    const newFullName = fullName !== undefined && fullName.trim() !== '' ? fullName.trim() : existingUser.full_name;
    const newWarehouseId = finalRoleName === 'ADMIN' ? null : (warehouseId !== undefined ? (warehouseId || null) : existingUser.warehouse_id);
    const newActive = active !== undefined ? Boolean(active) : Boolean(existingUser.active);

    const params: any[] = [newFullName, roleId, newWarehouseId, newActive];
    let passwordClause = '';

    if (password && typeof password === 'string' && password.trim().length > 0) {
      if (password.trim().length < 4) {
        return sendError(res, 'Le mot de passe doit comporter au moins 4 caractères', 400);
      }
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password.trim(), salt);
      params.push(passwordHash);
      passwordClause = `, password_hash = $${params.length}`;
    }

    params.push(targetId);
    const targetParamIdx = params.length;

    await query(`
      UPDATE users
      SET full_name = $1,
          role_id = $2,
          warehouse_id = $3,
          active = $4
          ${passwordClause},
          updated_at = NOW()
      WHERE id = $${targetParamIdx}
    `, params);

    const updatedRes = await query(`
      SELECT u.id, u.username, u.full_name, u.role_id, r.name as role_name,
             u.warehouse_id, w.name as warehouse_name, u.active, u.created_at, u.updated_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN warehouses w ON u.warehouse_id = w.id
      WHERE u.id = $1
    `, [targetId]);
    const updatedUser = updatedRes.rows[0];

    const result = {
      id: updatedUser.id,
      username: updatedUser.username,
      fullName: updatedUser.full_name,
      roleId: updatedUser.role_id,
      roleName: updatedUser.role_name,
      role: updatedUser.role_name,
      warehouseId: updatedUser.warehouse_id,
      warehouseName: updatedUser.warehouse_name,
      active: Boolean(updatedUser.active),
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at,
    };

    await logAudit(
      req.user,
      'USER_UPDATED',
      'USER',
      targetId,
      `Mis à jour le compte ${existingUser.username} (${finalRoleName})`,
      newWarehouseId,
      JSON.stringify({ fullName: existingUser.full_name, role: existingUser.role_name, warehouseId: existingUser.warehouse_id, active: existingUser.active }),
      JSON.stringify({ fullName: result.fullName, role: result.role, warehouseId: result.warehouseId, active: result.active })
    );

    return sendSuccess(res, result, 'Utilisateur mis à jour avec succès');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.delete('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const targetId = Number(req.params.id);
    if (isNaN(targetId)) {
      return sendError(res, 'Identifiant utilisateur invalide', 400);
    }

    const existingRes = await query(`
      SELECT u.*, r.name as role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = $1
    `, [targetId]);
    const existingUser = existingRes.rows[0];

    if (!existingUser) {
      return sendError(res, 'Utilisateur non trouvé', 404);
    }

    // Safeguard: prevent deleting oneself
    if (req.user?.id === targetId) {
      return sendError(res, 'Vous ne pouvez pas supprimer votre propre compte administrateur', 400);
    }

    // Check transactional references in sales and transfers
    const salesCountRes = await query('SELECT COUNT(*) as cnt FROM sales WHERE user_id = $1', [targetId]);
    const salesCount = Number(salesCountRes.rows[0].cnt || 0);

    const transfersCountRes = await query('SELECT COUNT(*) as cnt FROM transfers WHERE requested_by_user_id = $1', [targetId]);
    const transfersCount = Number(transfersCountRes.rows[0].cnt || 0);

    if (salesCount > 0 || transfersCount > 0) {
      const reasons: string[] = [];
      if (salesCount > 0) reasons.push(`${salesCount} vente(s)`);
      if (transfersCount > 0) reasons.push(`${transfersCount} demande(s) de transfert`);
      return sendError(
        res,
        `Impossible de supprimer cet utilisateur car des enregistrements historiques lui sont associés (${reasons.join(', ')}). Veuillez plutôt désactiver son compte.`,
        400
      );
    }

    // Safely unlink audit logs before deleting user
    await query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [targetId]);
    await query('DELETE FROM users WHERE id = $1', [targetId]);

    await logAudit(
      req.user,
      'USER_DELETED',
      'USER',
      targetId,
      `Supprimé le compte utilisateur ${existingUser.username} (${existingUser.role_name})`,
      existingUser.warehouse_id
    );

    return sendSuccess(res, { id: targetId }, 'Compte utilisateur supprimé avec succès');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
