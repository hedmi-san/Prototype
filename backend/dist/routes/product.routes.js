import { Router } from 'express';
import { db } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, (req, res) => {
    const products = db.prepare('SELECT * FROM products ORDER BY id ASC').all().map((p) => ({
        id: p.id,
        reference: p.reference,
        name: p.name,
        brand: p.brand,
        category: p.category,
        description: p.description,
        purchasePrice: p.purchase_price,
        salePrice: p.sale_price,
        minStockAlert: p.min_stock_alert,
        unit: p.unit,
        active: Boolean(p.active),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
    }));
    return sendSuccess(res, products);
});
router.get('/:id', authenticate, (req, res) => {
    const id = Number(req.params.id);
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!p) {
        return sendError(res, `Product not found with id ${id}`, 404);
    }
    return sendSuccess(res, {
        id: p.id,
        reference: p.reference,
        name: p.name,
        brand: p.brand,
        category: p.category,
        description: p.description,
        purchasePrice: p.purchase_price,
        salePrice: p.sale_price,
        minStockAlert: p.min_stock_alert,
        unit: p.unit,
        active: Boolean(p.active),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
    });
});
router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), (req, res) => {
    const { reference, name, brand, category, description, purchasePrice, salePrice, minStockAlert, unit } = req.body;
    if (!reference || !name || !brand || purchasePrice === undefined || salePrice === undefined) {
        return sendError(res, 'Reference, name, brand, purchasePrice, and salePrice are required', 400);
    }
    const existing = db.prepare('SELECT id FROM products WHERE reference = ?').get(reference);
    if (existing) {
        return sendError(res, `Product with reference ${reference} already exists`, 400);
    }
    const stmt = db.prepare(`
    INSERT INTO products (reference, name, brand, category, description, purchase_price, sale_price, min_stock_alert, unit, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
    const info = stmt.run(reference, name, brand, category || 'Tools', description || '', Number(purchasePrice), Number(salePrice), minStockAlert !== undefined ? Number(minStockAlert) : 5, unit || 'PIECE');
    const newId = Number(info.lastInsertRowid);
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(newId);
    logAudit(req.user, 'PRODUCT_CREATED', 'PRODUCT', newId, `Created product ${name} (${reference})`);
    return sendSuccess(res, {
        id: p.id,
        reference: p.reference,
        name: p.name,
        brand: p.brand,
        category: p.category,
        description: p.description,
        purchasePrice: p.purchase_price,
        salePrice: p.sale_price,
        minStockAlert: p.min_stock_alert,
        unit: p.unit,
        active: Boolean(p.active),
    }, 'Product created successfully', 201);
});
router.put('/:id', authenticate, requireRole('ADMIN', 'MANAGER', 'ACCOUNTANT'), (req, res) => {
    const id = Number(req.params.id);
    const { name, brand, category, description, purchasePrice, salePrice, minStockAlert, unit, active } = req.body;
    const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!current) {
        return sendError(res, `Product not found with id ${id}`, 404);
    }
    const updatedName = name !== undefined ? name : current.name;
    const updatedBrand = brand !== undefined ? brand : current.brand;
    const updatedCategory = category !== undefined ? category : current.category;
    const updatedDesc = description !== undefined ? description : current.description;
    const updatedPurchase = purchasePrice !== undefined ? Number(purchasePrice) : current.purchase_price;
    const updatedSale = salePrice !== undefined ? Number(salePrice) : current.sale_price;
    const updatedAlert = minStockAlert !== undefined ? Number(minStockAlert) : current.min_stock_alert;
    const updatedUnit = unit !== undefined ? unit : current.unit;
    const updatedActive = active !== undefined ? (active ? 1 : 0) : current.active;
    db.prepare(`
    UPDATE products
    SET name = ?, brand = ?, category = ?, description = ?, purchase_price = ?, sale_price = ?,
        min_stock_alert = ?, unit = ?, active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(updatedName, updatedBrand, updatedCategory, updatedDesc, updatedPurchase, updatedSale, updatedAlert, updatedUnit, updatedActive, id);
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    logAudit(req.user, 'PRODUCT_UPDATED', 'PRODUCT', id, `Updated product ${updatedName} (Purchase: ${updatedPurchase} DZD, Sale: ${updatedSale} DZD)`);
    return sendSuccess(res, {
        id: p.id,
        reference: p.reference,
        name: p.name,
        brand: p.brand,
        category: p.category,
        description: p.description,
        purchasePrice: p.purchase_price,
        salePrice: p.sale_price,
        minStockAlert: p.min_stock_alert,
        unit: p.unit,
        active: Boolean(p.active),
    }, 'Product updated successfully');
});
export default router;
