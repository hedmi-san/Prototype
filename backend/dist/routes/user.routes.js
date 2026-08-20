import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, requireRole('ADMIN'), (req, res) => {
    const query = `
    SELECT u.id, u.username, u.full_name, u.role_id, r.name as role_name,
           u.warehouse_id, w.name as warehouse_name, u.active, u.created_at, u.updated_at
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN warehouses w ON u.warehouse_id = w.id
    ORDER BY u.id ASC
  `;
    const users = db.prepare(query).all().map((u) => ({
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
});
router.post('/', authenticate, requireRole('ADMIN'), (req, res) => {
    const { username, password, fullName, roleName, warehouseId } = req.body;
    if (!username || !password || !fullName || !roleName) {
        return sendError(res, 'username, password, fullName, and roleName are required', 400);
    }
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        return sendError(res, `User with username '${username}' already exists`, 400);
    }
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
    if (!role) {
        return sendError(res, `Invalid role: ${roleName}`, 400);
    }
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const stmt = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role_id, warehouse_id, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
    const assignedWarehouseId = roleName === 'ADMIN' ? null : (warehouseId || null);
    const info = stmt.run(username, passwordHash, fullName, role.id, assignedWarehouseId);
    const newId = Number(info.lastInsertRowid);
    logAudit(req.user, 'USER_CREATED', 'USER', newId, `Created user ${username} with role ${roleName}`, assignedWarehouseId);
    return sendSuccess(res, { id: newId, username, fullName, roleName, role: roleName, warehouseId: assignedWarehouseId, active: true }, 'User created successfully', 201);
});
router.put('/:id', authenticate, requireRole('ADMIN'), (req, res) => {
    const targetId = Number(req.params.id);
    if (isNaN(targetId)) {
        return sendError(res, 'Identifiant utilisateur invalide', 400);
    }
    const existingUser = db.prepare(`
    SELECT u.*, r.name as role_name 
    FROM users u 
    JOIN roles r ON u.role_id = r.id 
    WHERE u.id = ?
  `).get(targetId);
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
        const roleRecord = db.prepare('SELECT id, name FROM roles WHERE name = ?').get(roleName);
        if (!roleRecord) {
            return sendError(res, `Rôle invalide: ${roleName}`, 400);
        }
        roleId = roleRecord.id;
        finalRoleName = roleRecord.name;
    }
    const newFullName = fullName !== undefined && fullName.trim() !== '' ? fullName.trim() : existingUser.full_name;
    const newWarehouseId = finalRoleName === 'ADMIN' ? null : (warehouseId !== undefined ? (warehouseId || null) : existingUser.warehouse_id);
    const newActive = active !== undefined ? (active ? 1 : 0) : existingUser.active;
    let passwordUpdateClause = '';
    const params = [newFullName, roleId, newWarehouseId, newActive];
    if (password && typeof password === 'string' && password.trim().length > 0) {
        if (password.trim().length < 4) {
            return sendError(res, 'Le mot de passe doit comporter au moins 4 caractères', 400);
        }
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password.trim(), salt);
        passwordUpdateClause = ', password_hash = ?';
        params.push(passwordHash);
    }
    params.push(targetId);
    db.prepare(`
    UPDATE users
    SET full_name = ?,
        role_id = ?,
        warehouse_id = ?,
        active = ?
        ${passwordUpdateClause},
        updated_at = datetime('now')
    WHERE id = ?
  `).run(...params);
    const updatedUser = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.role_id, r.name as role_name,
           u.warehouse_id, w.name as warehouse_name, u.active, u.created_at, u.updated_at
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN warehouses w ON u.warehouse_id = w.id
    WHERE u.id = ?
  `).get(targetId);
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
    logAudit(req.user, 'USER_UPDATED', 'USER', targetId, `Mis à jour le compte ${existingUser.username} (${finalRoleName})`, newWarehouseId, JSON.stringify({ fullName: existingUser.full_name, role: existingUser.role_name, warehouseId: existingUser.warehouse_id, active: existingUser.active }), JSON.stringify({ fullName: result.fullName, role: result.role, warehouseId: result.warehouseId, active: result.active }));
    return sendSuccess(res, result, 'Utilisateur mis à jour avec succès');
});
router.delete('/:id', authenticate, requireRole('ADMIN'), (req, res) => {
    const targetId = Number(req.params.id);
    if (isNaN(targetId)) {
        return sendError(res, 'Identifiant utilisateur invalide', 400);
    }
    const existingUser = db.prepare(`
    SELECT u.*, r.name as role_name 
    FROM users u 
    JOIN roles r ON u.role_id = r.id 
    WHERE u.id = ?
  `).get(targetId);
    if (!existingUser) {
        return sendError(res, 'Utilisateur non trouvé', 404);
    }
    // Safeguard: prevent deleting oneself
    if (req.user?.id === targetId) {
        return sendError(res, 'Vous ne pouvez pas supprimer votre propre compte administrateur', 400);
    }
    // Check transactional references in sales and transfers
    const salesCount = db.prepare('SELECT COUNT(*) as cnt FROM sales WHERE user_id = ?').get(targetId)?.cnt || 0;
    const transfersCount = db.prepare('SELECT COUNT(*) as cnt FROM transfers WHERE requested_by_user_id = ?').get(targetId)?.cnt || 0;
    if (salesCount > 0 || transfersCount > 0) {
        const reasons = [];
        if (salesCount > 0)
            reasons.push(`${salesCount} vente(s)`);
        if (transfersCount > 0)
            reasons.push(`${transfersCount} demande(s) de transfert`);
        return sendError(res, `Impossible de supprimer cet utilisateur car des enregistrements historiques lui sont associés (${reasons.join(', ')}). Veuillez plutôt désactiver son compte.`, 400);
    }
    // Safely unlink audit logs before deleting user
    db.prepare('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?').run(targetId);
    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    logAudit(req.user, 'USER_DELETED', 'USER', targetId, `Supprimé le compte utilisateur ${existingUser.username} (${existingUser.role_name})`, existingUser.warehouse_id);
    return sendSuccess(res, { id: targetId }, 'Compte utilisateur supprimé avec succès');
});
export default router;
