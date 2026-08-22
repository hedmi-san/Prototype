import { Router } from 'express';
import { query } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { generateCsv, sendCsv } from '../common/csv.js';
import { authenticate, requireRole, logAudit } from '../middleware/auth.js';
const router = Router();
router.get('/', authenticate, async (req, res) => {
    try {
        const result = await query('SELECT * FROM products ORDER BY id ASC');
        const products = result.rows.map((p) => ({
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
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.get('/export/csv', authenticate, async (req, res) => {
    try {
        const search = req.query.search?.trim();
        const category = req.query.category?.trim();
        let sql = 'SELECT * FROM products';
        const whereClauses = [];
        const params = [];
        if (search) {
            const p1 = params.length + 1;
            const p2 = params.length + 2;
            const p3 = params.length + 3;
            const p4 = params.length + 4;
            whereClauses.push(`(reference ILIKE $${p1} OR name ILIKE $${p2} OR brand ILIKE $${p3} OR category ILIKE $${p4})`);
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }
        if (category) {
            params.push(category);
            whereClauses.push(`category = $${params.length}`);
        }
        if (whereClauses.length > 0) {
            sql += ' WHERE ' + whereClauses.join(' AND ');
        }
        sql += ' ORDER BY id ASC';
        const result = await query(sql, params);
        const products = result.rows;
        const columns = [
            { header: 'ID', key: 'id' },
            { header: 'Référence', key: 'reference' },
            { header: 'Désignation', key: 'name' },
            { header: 'Marque', key: 'brand' },
            { header: 'Catégorie', key: 'category' },
            { header: 'Prix Achat (DZD)', key: 'purchase_price' },
            { header: 'Prix Vente (DZD)', key: 'sale_price' },
            { header: 'Stock Min Alerte', key: 'min_stock_alert' },
            { header: 'Unité', key: 'unit' },
            { header: 'Actif', format: (p) => (p.active ? 'Oui' : 'Non') },
            { header: 'Date Création', key: 'created_at' },
        ];
        const csv = generateCsv(columns, products);
        const dateStr = new Date().toISOString().split('T')[0];
        return sendCsv(res, `produits_${dateStr}.csv`, csv);
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.get('/:id', authenticate, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const result = await query('SELECT * FROM products WHERE id = $1', [id]);
        const p = result.rows[0];
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
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
    try {
        const { reference, name, brand, category, description, purchasePrice, salePrice, minStockAlert, unit } = req.body;
        if (!reference || !name || !brand || purchasePrice === undefined || salePrice === undefined) {
            return sendError(res, 'Reference, name, brand, purchasePrice, and salePrice are required', 400);
        }
        const existing = await query('SELECT id FROM products WHERE reference = $1', [reference]);
        if (existing.rowCount && existing.rowCount > 0) {
            return sendError(res, `Product with reference ${reference} already exists`, 400);
        }
        const insertRes = await query(`
      INSERT INTO products (reference, name, brand, category, description, purchase_price, sale_price, min_stock_alert, unit, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
      RETURNING *
    `, [
            reference,
            name,
            brand,
            category || 'Tools',
            description || '',
            Number(purchasePrice),
            Number(salePrice),
            minStockAlert !== undefined ? Number(minStockAlert) : 5,
            unit || 'PIECE',
        ]);
        const p = insertRes.rows[0];
        await logAudit(req.user, 'PRODUCT_CREATED', 'PRODUCT', p.id, `Created product ${name} (${reference})`);
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
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
router.put('/:id', authenticate, requireRole('ADMIN', 'MANAGER', 'ACCOUNTANT'), async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, brand, category, description, purchasePrice, salePrice, minStockAlert, unit, active } = req.body;
        const currentRes = await query('SELECT * FROM products WHERE id = $1', [id]);
        const current = currentRes.rows[0];
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
        const updatedActive = active !== undefined ? Boolean(active) : Boolean(current.active);
        const updateRes = await query(`
      UPDATE products
      SET name = $1, brand = $2, category = $3, description = $4, purchase_price = $5, sale_price = $6,
          min_stock_alert = $7, unit = $8, active = $9, updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `, [updatedName, updatedBrand, updatedCategory, updatedDesc, updatedPurchase, updatedSale, updatedAlert, updatedUnit, updatedActive, id]);
        const p = updateRes.rows[0];
        await logAudit(req.user, 'PRODUCT_UPDATED', 'PRODUCT', id, `Updated product ${updatedName} (Purchase: ${updatedPurchase} DZD, Sale: ${updatedSale} DZD)`);
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
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
export default router;
