import { Router } from 'express';
import { query, runTransaction } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { generateCsv, sendCsv, CsvColumn } from '../common/csv.js';
import { authenticate, requireRole, AuthRequest, logAudit } from '../middleware/auth.js';

const router = Router();

router.get('/brands', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      "SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND TRIM(brand) != '' ORDER BY brand ASC"
    );
    const brands = result.rows.map((r: any) => r.brand);
    return sendSuccess(res, brands);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const isAll = req.query.all === 'true' || req.query.all === '1';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const search = (req.query.search as string | undefined)?.trim();
    const brand = (req.query.brand as string | undefined)?.trim();
    const idsParam = (req.query.ids as string | undefined)?.trim();
    const sortBy = (req.query.sortBy as string | undefined)?.trim();
    const sortOrder = (req.query.sortOrder as string | undefined)?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const whereClauses: string[] = [];
    const params: any[] = [];
    let hasExplicitIds = false;
    let parsedIds: number[] = [];

    if (idsParam) {
      parsedIds = idsParam
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id) && id > 0);

      if (parsedIds.length > 0) {
        hasExplicitIds = true;
        params.push(parsedIds);
        whereClauses.push(`id = ANY($${params.length}::int[])`);
      }
    }

    if (!hasExplicitIds) {
      if (search) {
        const p1 = params.length + 1;
        const p2 = params.length + 2;
        const p3 = params.length + 3;
        whereClauses.push(`(reference ILIKE $${p1} OR name ILIKE $${p2} OR brand ILIKE $${p3})`);
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      if (brand && brand !== 'all') {
        params.push(brand);
        whereClauses.push(`brand = $${params.length}`);
      }
    }

    const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

    // If 'all' is explicitly requested (e.g. for internal combobox lookups)
    if (isAll) {
      const allSql = `SELECT * FROM products ${whereSql} ORDER BY name ASC, id ASC`;
      const result = await query(allSql, params);
      const products = result.rows.map((p: any) => ({
        id: p.id,
        reference: p.reference,
        name: p.name,
        brand: p.brand,
        description: p.description,
        purchasePrice: Number(p.purchase_price),
        salePrice: Number(p.sale_price),
        minStockAlert: p.min_stock_alert,
        unit: p.unit,
        boxSize: Number(p.box_size || 0),
        tva: Number(p.tva !== undefined && p.tva !== null ? p.tva : 19),
        active: Boolean(p.active),
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));
      return sendSuccess(res, products);
    }

    // Paginated flow
    const countSql = `SELECT COUNT(*) as count FROM products ${whereSql}`;
    const countRes = await query(countSql, params);
    const total = Number(countRes.rows[0]?.count || 0);
    const effectiveLimit = hasExplicitIds && !req.query.limit
      ? Math.max(limit, parsedIds.length)
      : limit;
    const effectiveOffset = (page - 1) * effectiveLimit;
    const totalPages = Math.ceil(total / effectiveLimit) || 1;

    // Sorting column mapping
    let orderColumn = 'id';
    if (sortBy === 'name') orderColumn = 'name';
    else if (sortBy === 'salePrice') orderColumn = 'sale_price';
    else if (sortBy === 'purchasePrice') orderColumn = 'purchase_price';
    else if (sortBy === 'reference') orderColumn = 'reference';
    else if (sortBy === 'brand') orderColumn = 'brand';
    else if (sortBy === 'createdAt') orderColumn = 'created_at';

    const orderSql = `ORDER BY ${orderColumn} ${sortOrder}, id ASC`;

    const selectParams = [...params, effectiveLimit, effectiveOffset];
    const limitParamIdx = selectParams.length - 1;
    const offsetParamIdx = selectParams.length;

    const selectSql = `
      SELECT * FROM products
      ${whereSql}
      ${orderSql}
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `;

    const result = await query(selectSql, selectParams);
    const items = result.rows.map((p: any) => ({
      id: p.id,
      reference: p.reference,
      name: p.name,
      brand: p.brand,
      description: p.description,
      purchasePrice: Number(p.purchase_price),
      salePrice: Number(p.sale_price),
      minStockAlert: p.min_stock_alert,
      unit: p.unit,
      boxSize: Number(p.box_size || 0),
      tva: Number(p.tva !== undefined && p.tva !== null ? p.tva : 19),
      active: Boolean(p.active),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return sendSuccess(res, {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.get('/export/csv', authenticate, async (req: AuthRequest, res) => {
  try {
    const search = (req.query.search as string | undefined)?.trim();
    const brand = (req.query.brand as string | undefined)?.trim();
    const idsParam = (req.query.ids as string | undefined)?.trim();

    let sql = 'SELECT * FROM products';
    const whereClauses: string[] = [];
    const params: any[] = [];
    let hasExplicitIds = false;

    if (idsParam) {
      const parsedIds = idsParam
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id) && id > 0);

      if (parsedIds.length > 0) {
        hasExplicitIds = true;
        params.push(parsedIds);
        whereClauses.push(`id = ANY($${params.length}::int[])`);
      }
    }

    if (!hasExplicitIds) {
      if (search) {
        const p1 = params.length + 1;
        const p2 = params.length + 2;
        const p3 = params.length + 3;
        whereClauses.push(`(reference ILIKE $${p1} OR name ILIKE $${p2} OR brand ILIKE $${p3})`);
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      if (brand && brand !== 'all') {
        params.push(brand);
        whereClauses.push(`brand = $${params.length}`);
      }
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' ORDER BY name ASC, id ASC';

    const result = await query(sql, params);
    const products = result.rows;

    const columns: CsvColumn[] = [
      { header: 'ID', key: 'id' },
      { header: 'Référence', key: 'reference' },
      { header: 'Désignation', key: 'name' },
      { header: 'Marque', key: 'brand' },
      { header: 'Prix Achat (DZD)', key: 'purchase_price' },
      { header: 'Prix Vente (DZD)', key: 'sale_price' },
      { header: 'Stock Min Alerte', key: 'min_stock_alert' },
      { header: 'Unité', key: 'unit' },
      { header: 'Colisage (Pcs/Carton)', key: 'box_size', format: (p) => (p.box_size ? String(p.box_size) : '—') },
      { header: 'TVA (%)', key: 'tva', format: (p) => (p.tva !== undefined && p.tva !== null ? `${p.tva}%` : '19%') },
      { header: 'Actif', format: (p) => (p.active ? 'Oui' : 'Non') },
      { header: 'Date Création', key: 'created_at' },
    ];

    const csv = generateCsv(columns, products);
    const dateStr = new Date().toISOString().split('T')[0];
    return sendCsv(res, `produits_${dateStr}.csv`, csv);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
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
      description: p.description,
      purchasePrice: Number(p.purchase_price),
      salePrice: Number(p.sale_price),
      minStockAlert: p.min_stock_alert,
      unit: p.unit,
      boxSize: Number(p.box_size || 0),
      tva: Number(p.tva !== undefined && p.tva !== null ? p.tva : 19),
      active: Boolean(p.active),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const { reference, name, brand, description, purchasePrice, salePrice, minStockAlert, unit, boxSize, tva } = req.body;
    if (!reference || !name || purchasePrice === undefined || salePrice === undefined) {
      return sendError(res, 'Reference, name, purchasePrice, and salePrice are required', 400);
    }

    const validBrand = (typeof brand === 'string' && brand.trim()) ? brand.trim() : 'WEHAND';

    const existing = await query('SELECT id FROM products WHERE reference = $1', [reference]);
    if (existing.rowCount && existing.rowCount > 0) {
      return sendError(res, `Product with reference ${reference} already exists`, 400);
    }

    const validBoxSize = Math.max(0, Number(boxSize) || 0);
    const validMinStockAlert = minStockAlert !== undefined ? Math.max(0, parseInt(minStockAlert, 10) || 0) : 1;
    const validTva = tva !== undefined ? Math.max(0, Number(tva) || 0) : 19.0;

    const insertRes = await query(`
      INSERT INTO products (reference, name, brand, description, purchase_price, sale_price, min_stock_alert, unit, box_size, tva, active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
      RETURNING *
    `, [
      reference,
      name,
      validBrand,
      description || '',
      Number(purchasePrice),
      Number(salePrice),
      validMinStockAlert,
      unit || 'PIECE',
      validBoxSize,
      validTva,
    ]);

    const p = insertRes.rows[0];
    await logAudit(req.user, 'PRODUCT_CREATED', 'PRODUCT', p.id, `Created product ${name} (${reference})`);

    return sendSuccess(res, {
      id: p.id,
      reference: p.reference,
      name: p.name,
      brand: p.brand,
      description: p.description,
      purchasePrice: Number(p.purchase_price),
      salePrice: Number(p.sale_price),
      minStockAlert: p.min_stock_alert,
      unit: p.unit,
      boxSize: Number(p.box_size || 0),
      tva: Number(p.tva),
      active: Boolean(p.active),
    }, 'Product created successfully', 201);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.patch('/:id/price', authenticate, requireRole('ADMIN', 'MANAGER', 'ACCOUNTANT'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { purchasePrice, salePrice } = req.body;

    const currentRes = await query('SELECT * FROM products WHERE id = $1', [id]);
    const current = currentRes.rows[0];
    if (!current) {
      return sendError(res, `Product not found with id ${id}`, 404);
    }

    const updatedPurchase = purchasePrice !== undefined ? Number(purchasePrice) : current.purchase_price;
    const updatedSale = salePrice !== undefined ? Number(salePrice) : current.sale_price;

    const updateRes = await query(`
      UPDATE products
      SET purchase_price = $1, sale_price = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [updatedPurchase, updatedSale, id]);

    const p = updateRes.rows[0];
    await logAudit(req.user, 'PRODUCT_PRICE_UPDATED', 'PRODUCT', id, `Updated prices for ${current.name} (Purchase: ${updatedPurchase} DZD, Sale: ${updatedSale} DZD)`);

    return sendSuccess(res, {
      id: p.id,
      reference: p.reference,
      name: p.name,
      brand: p.brand,
      description: p.description,
      purchasePrice: Number(p.purchase_price),
      salePrice: Number(p.sale_price),
      minStockAlert: p.min_stock_alert,
      unit: p.unit,
      active: Boolean(p.active),
    }, 'Product prices updated successfully');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.put('/:id', authenticate, requireRole('ADMIN', 'MANAGER', 'ACCOUNTANT'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { name, brand, description, purchasePrice, salePrice, minStockAlert, unit, boxSize, tva, active } = req.body;

    const currentRes = await query('SELECT * FROM products WHERE id = $1', [id]);
    const current = currentRes.rows[0];
    if (!current) {
      return sendError(res, `Product not found with id ${id}`, 404);
    }

    const updatedName = name !== undefined ? name : current.name;
    const updatedBrand = brand !== undefined ? ((typeof brand === 'string' && brand.trim()) ? brand.trim() : current.brand) : current.brand;
    const updatedDesc = description !== undefined ? description : current.description;
    const updatedPurchase = purchasePrice !== undefined ? Number(purchasePrice) : current.purchase_price;
    const updatedSale = salePrice !== undefined ? Number(salePrice) : current.sale_price;
    const updatedAlert = minStockAlert !== undefined ? Math.max(0, parseInt(minStockAlert, 10) || 0) : current.min_stock_alert;
    const updatedUnit = unit !== undefined ? unit : current.unit;
    const updatedBoxSize = boxSize !== undefined ? Math.max(0, Number(boxSize) || 0) : current.box_size;
    const updatedTva = tva !== undefined ? Math.max(0, Number(tva) || 0) : Number(current.tva !== undefined && current.tva !== null ? current.tva : 19);
    const updatedActive = active !== undefined ? Boolean(active) : Boolean(current.active);

    const updateRes = await query(`
      UPDATE products
      SET name = $1, brand = $2, description = $3, purchase_price = $4, sale_price = $5,
          min_stock_alert = $6, unit = $7, box_size = $8, tva = $9, active = $10, updated_at = NOW()
      WHERE id = $11
      RETURNING *
    `, [updatedName, updatedBrand, updatedDesc, updatedPurchase, updatedSale, updatedAlert, updatedUnit, updatedBoxSize, updatedTva, updatedActive, id]);

    const p = updateRes.rows[0];
    await logAudit(req.user, 'PRODUCT_UPDATED', 'PRODUCT', id, `Updated product ${updatedName} (Purchase: ${updatedPurchase} DZD, Sale: ${updatedSale} DZD)`);

    return sendSuccess(res, {
      id: p.id,
      reference: p.reference,
      name: p.name,
      brand: p.brand,
      description: p.description,
      purchasePrice: Number(p.purchase_price),
      salePrice: Number(p.sale_price),
      minStockAlert: p.min_stock_alert,
      unit: p.unit,
      boxSize: Number(p.box_size || 0),
      tva: Number(p.tva),
      active: Boolean(p.active),
    }, 'Product updated successfully');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

router.post('/import-batch', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const rawWarehouseId = req.body.warehouseId;
    let targetWarehouseId = Number(rawWarehouseId);

    // Strict warehouse scoping: Managers can ONLY import to their assigned warehouse
    if (req.user?.role === 'MANAGER') {
      if (!req.user.warehouseId) {
        return sendError(res, 'Manager has no assigned warehouse', 403);
      }
      targetWarehouseId = Number(req.user.warehouseId);
    }

    if (!targetWarehouseId || isNaN(targetWarehouseId) || targetWarehouseId <= 0) {
      return sendError(res, 'A valid target warehouseId is required', 400);
    }

    // Verify warehouse exists
    const whRes = await query('SELECT id, name, code, active FROM warehouses WHERE id = $1', [targetWarehouseId]);
    const warehouse = whRes.rows[0];
    if (!warehouse) {
      return sendError(res, `Warehouse not found with id ${targetWarehouseId}`, 404);
    }
    if (!warehouse.active) {
      return sendError(res, `Warehouse "${warehouse.name}" is inactive`, 400);
    }

    const items = req.body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, 'items array is required and must not be empty', 400);
    }

    if (items.length > 2500) {
      return sendError(res, 'Batch exceeds maximum allowed size of 2,500 items per request', 400);
    }

    // Clean and sanitize incoming items, deduplicating by code (last row wins)
    const sanitizedMap = new Map<string, {
      reference: string;
      name: string;
      brand: string;
      purchasePrice: number;
      salePrice: number;
      tva: number;
      boxSize: number;
      minStockAlert: number;
      stock: number;
    }>();

    for (const item of items) {
      const ref = String(item.code || item.reference || '').trim().toUpperCase();
      if (!ref) continue;

      const name = String(item.name || item.designation || '').trim() || `Produit ${ref}`;
      const brand = String(item.brand || '').trim() || 'WEHAND';

      // Parse stock safely: if text (like 'TOURNEVIS'), NaN, or negative, clamp to 0
      let stock = 0;
      if (item.stock !== undefined && item.stock !== null && item.stock !== '') {
        const parsed = typeof item.stock === 'number'
          ? item.stock
          : parseFloat(String(item.stock).replace(',', '.'));
        if (!isNaN(parsed) && parsed > 0) {
          stock = Math.floor(parsed);
        }
      }

      // Parse prices
      let purchasePrice = 0.0;
      if (item.purchasePrice !== undefined && item.purchasePrice !== null && item.purchasePrice !== '') {
        const parsed = typeof item.purchasePrice === 'number'
          ? item.purchasePrice
          : parseFloat(String(item.purchasePrice).replace(',', '.'));
        if (!isNaN(parsed) && parsed >= 0) purchasePrice = Number(parsed.toFixed(2));
      }

      let salePrice = 0.0;
      if (item.salePrice !== undefined && item.salePrice !== null && item.salePrice !== '') {
        const parsed = typeof item.salePrice === 'number'
          ? item.salePrice
          : parseFloat(String(item.salePrice).replace(',', '.'));
        if (!isNaN(parsed) && parsed >= 0) salePrice = Number(parsed.toFixed(2));
      }

      let tva = 19.0;
      if (item.tva !== undefined && item.tva !== null && item.tva !== '') {
        const parsed = typeof item.tva === 'number'
          ? item.tva
          : parseFloat(String(item.tva).replace(',', '.'));
        if (!isNaN(parsed) && parsed >= 0) tva = Number(parsed.toFixed(2));
      }

      let boxSize = 0;
      if (item.boxSize !== undefined && item.boxSize !== null && item.boxSize !== '') {
        const parsed = typeof item.boxSize === 'number'
          ? item.boxSize
          : parseInt(String(item.boxSize), 10);
        if (!isNaN(parsed) && parsed >= 0) boxSize = parsed;
      }

      let minStockAlert = 1;
      if (item.minStockAlert !== undefined && item.minStockAlert !== null && item.minStockAlert !== '') {
        const parsed = typeof item.minStockAlert === 'number'
          ? item.minStockAlert
          : parseInt(String(item.minStockAlert), 10);
        if (!isNaN(parsed) && parsed >= 0) minStockAlert = parsed;
      }

      sanitizedMap.set(ref, {
        reference: ref,
        name,
        brand,
        purchasePrice,
        salePrice,
        tva,
        boxSize,
        minStockAlert,
        stock,
      });
    }

    const cleanItems = Array.from(sanitizedMap.values());
    if (cleanItems.length === 0) {
      return sendError(res, 'No valid items with non-empty reference code found in batch', 400);
    }

    // Execute batch within a single atomic PostgreSQL transaction
    const result = await runTransaction(async (client) => {
      // Step 1: Bulk insert new products (ON CONFLICT DO NOTHING preserves master catalog for existing products)
      const refs = cleanItems.map((i) => i.reference);
      const names = cleanItems.map((i) => i.name);
      const brands = cleanItems.map((i) => i.brand);
      const descriptions = cleanItems.map(() => '');
      const purchases = cleanItems.map((i) => i.purchasePrice);
      const sales = cleanItems.map((i) => i.salePrice);
      const alerts = cleanItems.map((i) => i.minStockAlert);
      const units = cleanItems.map(() => 'PIECE');
      const boxSizes = cleanItems.map((i) => i.boxSize);
      const tvas = cleanItems.map((i) => i.tva);
      const actives = cleanItems.map(() => true);

      const insertProductsSql = `
        INSERT INTO products (reference, name, brand, description, purchase_price, sale_price, min_stock_alert, unit, box_size, tva, active)
        SELECT * FROM UNNEST(
          $1::varchar[],
          $2::varchar[],
          $3::varchar[],
          $4::text[],
          $5::numeric[],
          $6::numeric[],
          $7::int[],
          $8::varchar[],
          $9::int[],
          $10::numeric[],
          $11::boolean[]
        )
        ON CONFLICT (reference) DO NOTHING
        RETURNING id, reference
      `;

      const insertProductsRes = await client.query(insertProductsSql, [
        refs, names, brands, descriptions, purchases, sales, alerts, units, boxSizes, tvas, actives
      ]);
      const newlyCreatedCount = insertProductsRes.rowCount || 0;

      // Step 2: Query product IDs and previous stock levels for the target warehouse
      const lookupSql = `
        SELECT p.id, p.reference, COALESCE(s.physical_quantity, 0) as current_qty
        FROM products p
        LEFT JOIN stock s ON s.product_id = p.id AND s.warehouse_id = $1
        WHERE p.reference = ANY($2::varchar[])
      `;
      const lookupRes = await client.query(lookupSql, [targetWarehouseId, refs]);
      const productLookup = new Map<string, { id: number; currentQty: number }>();
      for (const row of lookupRes.rows) {
        productLookup.set(row.reference, {
          id: Number(row.id),
          currentQty: Number(row.current_qty),
        });
      }

      // Prepare bulk stock upsert arrays
      const stockProductIds: number[] = [];
      const stockQuantities: number[] = [];
      const movementProductIds: number[] = [];
      const movementQtyChanges: number[] = [];

      for (const item of cleanItems) {
        const info = productLookup.get(item.reference);
        if (!info) continue;

        stockProductIds.push(info.id);
        stockQuantities.push(item.stock);

        // Record stock movement if there is incoming physical stock or a delta
        const qtyDiff = item.stock - info.currentQty;
        if (item.stock > 0 || qtyDiff !== 0) {
          movementProductIds.push(info.id);
          movementQtyChanges.push(item.stock > 0 && info.currentQty === 0 ? item.stock : qtyDiff);
        }
      }

      // Step 3: Bulk upsert stock records for the warehouse
      if (stockProductIds.length > 0) {
        const upsertStockSql = `
          INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity, updated_at)
          SELECT $1, u.product_id, u.qty, 0, NOW()
          FROM UNNEST($2::int[], $3::int[]) AS u(product_id, qty)
          ON CONFLICT (warehouse_id, product_id)
          DO UPDATE SET
            physical_quantity = EXCLUDED.physical_quantity,
            updated_at = NOW()
        `;
        await client.query(upsertStockSql, [targetWarehouseId, stockProductIds, stockQuantities]);
      }

      // Step 4: Bulk insert stock movements for audit traceability
      if (movementProductIds.length > 0) {
        const insertMovementsSql = `
          INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes, created_at)
          SELECT $1, u.product_id, 'INITIAL_STOCK', u.qty_diff, 'IMPORT-EXCEL', 'Import initial stock depuis Excel', NOW()
          FROM UNNEST($2::int[], $3::int[]) AS u(product_id, qty_diff)
          WHERE u.qty_diff != 0
        `;
        await client.query(insertMovementsSql, [targetWarehouseId, movementProductIds, movementQtyChanges]);
      }

      return {
        processed: cleanItems.length,
        created: newlyCreatedCount,
        existing: cleanItems.length - newlyCreatedCount,
        stockUpdated: stockProductIds.length,
      };
    });

    await logAudit(
      req.user,
      'EXCEL_IMPORT_BATCH',
      'STOCK',
      String(targetWarehouseId),
      `Imported batch of ${result.processed} items into ${warehouse.name} (${result.created} created, ${result.existing} matched existing)`
    );

    return sendSuccess(res, {
      ...result,
      warehouseId: targetWarehouseId,
      warehouseName: warehouse.name,
    }, 'Batch imported successfully');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
