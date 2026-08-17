"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_js_1 = require("../db/database.js");
const response_js_1 = require("../common/response.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
router.get('/', auth_js_1.authenticate, (req, res) => {
    const products = database_js_1.db.prepare('SELECT * FROM products ORDER BY id ASC').all().map((p) => ({
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
    return (0, response_js_1.sendSuccess)(res, products);
});
router.get('/:id', auth_js_1.authenticate, (req, res) => {
    const id = Number(req.params.id);
    const p = database_js_1.db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!p) {
        return (0, response_js_1.sendError)(res, `Product not found with id ${id}`, 404);
    }
    return (0, response_js_1.sendSuccess)(res, {
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
router.post('/', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN', 'MANAGER'), (req, res) => {
    const { reference, name, brand, category, description, purchasePrice, salePrice, minStockAlert, unit } = req.body;
    if (!reference || !name || !brand || purchasePrice === undefined || salePrice === undefined) {
        return (0, response_js_1.sendError)(res, 'Reference, name, brand, purchasePrice, and salePrice are required', 400);
    }
    const existing = database_js_1.db.prepare('SELECT id FROM products WHERE reference = ?').get(reference);
    if (existing) {
        return (0, response_js_1.sendError)(res, `Product with reference ${reference} already exists`, 400);
    }
    const stmt = database_js_1.db.prepare(`
    INSERT INTO products (reference, name, brand, category, description, purchase_price, sale_price, min_stock_alert, unit, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
    const info = stmt.run(reference, name, brand, category || 'Tools', description || '', Number(purchasePrice), Number(salePrice), minStockAlert !== undefined ? Number(minStockAlert) : 5, unit || 'PIECE');
    const newId = Number(info.lastInsertRowid);
    const p = database_js_1.db.prepare('SELECT * FROM products WHERE id = ?').get(newId);
    (0, auth_js_1.logAudit)(req.user, 'PRODUCT_CREATED', 'PRODUCT', newId, `Created product ${name} (${reference})`);
    return (0, response_js_1.sendSuccess)(res, {
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
router.put('/:id', auth_js_1.authenticate, (0, auth_js_1.requireRole)('ADMIN', 'MANAGER', 'ACCOUNTANT'), (req, res) => {
    const id = Number(req.params.id);
    const { name, brand, category, description, purchasePrice, salePrice, minStockAlert, unit, active } = req.body;
    const current = database_js_1.db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!current) {
        return (0, response_js_1.sendError)(res, `Product not found with id ${id}`, 404);
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
    database_js_1.db.prepare(`
    UPDATE products
    SET name = ?, brand = ?, category = ?, description = ?, purchase_price = ?, sale_price = ?,
        min_stock_alert = ?, unit = ?, active = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(updatedName, updatedBrand, updatedCategory, updatedDesc, updatedPurchase, updatedSale, updatedAlert, updatedUnit, updatedActive, id);
    const p = database_js_1.db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    (0, auth_js_1.logAudit)(req.user, 'PRODUCT_UPDATED', 'PRODUCT', id, `Updated product ${updatedName} (Purchase: ${updatedPurchase} DZD, Sale: ${updatedSale} DZD)`);
    return (0, response_js_1.sendSuccess)(res, {
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
exports.default = router;
