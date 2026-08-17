import { Router } from 'express';
import { db } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, validateWarehouseScope } from '../middleware/auth.js';
const router = Router();
// Dashboard Metrics (both /reports/dashboard and /admin/reports/dashboard-metrics)
router.get(['/dashboard', '/dashboard-metrics'], authenticate, (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    if (warehouseId && req.user) {
        try {
            validateWarehouseScope(req.user, warehouseId);
        }
        catch (err) {
            return sendError(res, err.message, 403);
        }
    }
    const today = new Date().toISOString().substring(0, 10);
    const currentMonth = new Date().toISOString().substring(0, 7);
    // 1. Stock Valuation (using current product purchase prices)
    let stockQuery = `
    SELECT SUM(s.physical_quantity * p.purchase_price) as total_valuation,
           SUM(s.physical_quantity) as total_items,
           COUNT(DISTINCT s.product_id) as total_products
    FROM stock s
    JOIN products p ON s.product_id = p.id
  `;
    if (warehouseId) {
        stockQuery += ` WHERE s.warehouse_id = ${warehouseId}`;
    }
    const stockStats = db.prepare(stockQuery).get();
    const totalStockValuation = stockStats?.total_valuation || 0;
    const totalStockItems = stockStats?.total_items || 0;
    // 2. Sales Today & Sales Month
    let salesTodayQuery = `
    SELECT SUM(total_amount) as total, COUNT(*) as count
    FROM sales
    WHERE status = 'COMPLETED' AND date(created_at) = date('now')
  `;
    if (warehouseId)
        salesTodayQuery += ` AND warehouse_id = ${warehouseId}`;
    const salesTodayStats = db.prepare(salesTodayQuery).get();
    const totalSalesToday = salesTodayStats?.total || 0;
    const totalOrdersToday = salesTodayStats?.count || 0;
    let salesMonthQuery = `
    SELECT SUM(total_amount) as total, COUNT(*) as count
    FROM sales
    WHERE status = 'COMPLETED' AND strftime('%Y-%m', created_at) = ?
  `;
    const salesMonthParams = [currentMonth];
    if (warehouseId) {
        salesMonthQuery += ` AND warehouse_id = ${warehouseId}`;
    }
    const salesMonthStats = db.prepare(salesMonthQuery).get(...salesMonthParams);
    const totalSalesThisMonth = salesMonthStats?.total || 0;
    // 3. Gross Margin / Cost of Goods Sold This Month
    let cogsQuery = `
    SELECT SUM(si.quantity * p.purchase_price) as cogs
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    WHERE s.status = 'COMPLETED' AND strftime('%Y-%m', s.created_at) = ?
  `;
    if (warehouseId)
        cogsQuery += ` AND s.warehouse_id = ${warehouseId}`;
    const cogsStats = db.prepare(cogsQuery).get(currentMonth);
    const cogsMonth = cogsStats?.cogs || 0;
    const grossProfitThisMonth = totalSalesThisMonth - cogsMonth;
    // 4. Expenses This Month
    let expQuery = `SELECT SUM(amount) as total FROM expenses WHERE strftime('%Y-%m', expense_date) = ?`;
    if (warehouseId)
        expQuery += ` AND warehouse_id = ${warehouseId}`;
    const expStats = db.prepare(expQuery).get(currentMonth);
    const totalExpensesThisMonth = expStats?.total || 0;
    // 5. Salaries This Month
    let salQuery = `SELECT SUM(total_amount) as total FROM salaries WHERE period = ?`;
    if (warehouseId)
        salQuery += ` AND warehouse_id = ${warehouseId}`;
    const salStats = db.prepare(salQuery).get(currentMonth);
    const totalSalariesThisMonth = salStats?.total || 0;
    // 6. Net Profit
    const netProfitThisMonth = grossProfitThisMonth - totalExpensesThisMonth - totalSalariesThisMonth;
    // 7. Low Stock Alerts & Pending Transfers
    let lowStockQuery = `
    SELECT COUNT(*) as count
    FROM stock s
    JOIN products p ON s.product_id = p.id
    WHERE (s.physical_quantity - s.reserved_quantity) <= p.min_stock_alert
  `;
    if (warehouseId)
        lowStockQuery += ` AND s.warehouse_id = ${warehouseId}`;
    const lowStockCount = db.prepare(lowStockQuery).get()?.count || 0;
    let pendingTransfersQuery = `SELECT COUNT(*) as count FROM transfers WHERE status = 'REQUESTED'`;
    if (warehouseId)
        pendingTransfersQuery += ` AND (source_warehouse_id = ${warehouseId} OR destination_warehouse_id = ${warehouseId})`;
    const pendingTransfersCount = db.prepare(pendingTransfersQuery).get()?.count || 0;
    // 8. Multi-Warehouse Comparison (for Admin/Super Manager overview)
    const warehouses = db.prepare('SELECT id, name, code FROM warehouses WHERE active = 1').all();
    const warehouseBreakdown = warehouses.map((wh) => {
        const wValuation = db.prepare(`
      SELECT SUM(s.physical_quantity * p.purchase_price) as val
      FROM stock s JOIN products p ON s.product_id = p.id
      WHERE s.warehouse_id = ?
    `).get(wh.id)?.val || 0;
        const wSales = db.prepare(`
      SELECT SUM(total_amount) as sales
      FROM sales
      WHERE warehouse_id = ? AND status = 'COMPLETED' AND strftime('%Y-%m', created_at) = ?
    `).get(wh.id, currentMonth)?.sales || 0;
        const wExpenses = db.prepare(`
      SELECT SUM(amount) as exp
      FROM expenses
      WHERE warehouse_id = ? AND strftime('%Y-%m', expense_date) = ?
    `).get(wh.id, currentMonth)?.exp || 0;
        const wSalaries = db.prepare(`
      SELECT SUM(total_amount) as sal
      FROM salaries
      WHERE warehouse_id = ? AND period = ?
    `).get(wh.id, currentMonth)?.sal || 0;
        return {
            warehouseId: wh.id,
            warehouseName: wh.name,
            warehouseCode: wh.code,
            stockValuation: wValuation,
            monthlySales: wSales,
            monthlyExpenses: wExpenses,
            monthlySalaries: wSalaries,
            estimatedProfit: wSales * 0.25 - wExpenses - wSalaries,
        };
    });
    // Recent Movements & Sales
    const recentMovements = db.prepare(`
    SELECT m.id, m.warehouse_id, w.name as warehouse_name,
           m.product_id, p.name as product_name, p.reference as product_reference,
           m.movement_type, m.quantity_change, m.reference, m.created_at
    FROM stock_movements m
    JOIN warehouses w ON m.warehouse_id = w.id
    JOIN products p ON m.product_id = p.id
    ${warehouseId ? `WHERE m.warehouse_id = ${warehouseId}` : ''}
    ORDER BY m.created_at DESC, m.id DESC LIMIT 6
  `).all().map((m) => ({
        id: m.id,
        warehouseId: m.warehouse_id,
        warehouseName: m.warehouse_name,
        productId: m.product_id,
        productName: m.product_name,
        productReference: m.product_reference,
        movementType: m.movement_type,
        quantityChange: m.quantity_change,
        reference: m.reference,
        createdAt: m.created_at,
    }));
    const recentSales = db.prepare(`
    SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name,
           s.customer_name, s.total_amount, s.status, s.created_at
    FROM sales s
    JOIN warehouses w ON s.warehouse_id = w.id
    ${warehouseId ? `WHERE s.warehouse_id = ${warehouseId}` : ''}
    ORDER BY s.created_at DESC, s.id DESC LIMIT 6
  `).all().map((s) => ({
        id: s.id,
        invoiceNumber: s.invoice_number,
        warehouseId: s.warehouse_id,
        warehouseName: s.warehouse_name,
        customerName: s.customer_name,
        totalAmount: s.total_amount,
        status: s.status,
        createdAt: s.created_at,
    }));
    return sendSuccess(res, {
        totalStockValuation,
        totalStockItems,
        totalSalesToday,
        totalOrdersToday,
        totalSalesThisMonth,
        grossProfitThisMonth,
        totalExpensesThisMonth,
        totalSalariesThisMonth,
        netProfitThisMonth,
        lowStockCount,
        pendingTransfersCount,
        warehouseBreakdown,
        recentMovements,
        recentSales,
    });
});
// Stock Valuation Report
router.get('/stock-valuation', authenticate, (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    let query = `
    SELECT s.id, s.warehouse_id, w.name as warehouse_name,
           s.product_id, p.reference as product_reference, p.name as product_name, p.brand, p.category,
           s.physical_quantity, s.reserved_quantity,
           (s.physical_quantity - s.reserved_quantity) as available_quantity,
           p.purchase_price as current_purchase_price,
           p.sale_price as current_sale_price,
           (s.physical_quantity * p.purchase_price) as valuation_purchase,
           (s.physical_quantity * p.sale_price) as valuation_sale,
           ((s.physical_quantity * p.sale_price) - (s.physical_quantity * p.purchase_price)) as potential_margin
    FROM stock s
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN products p ON s.product_id = p.id
  `;
    if (warehouseId)
        query += ` WHERE s.warehouse_id = ${warehouseId}`;
    query += ' ORDER BY w.name ASC, p.name ASC';
    const rows = db.prepare(query).all().map((r) => ({
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        productId: r.product_id,
        productReference: r.product_reference,
        productName: r.product_name,
        brand: r.brand,
        category: r.category,
        physicalQuantity: r.physical_quantity,
        reservedQuantity: r.reserved_quantity,
        availableQuantity: r.available_quantity,
        purchasePrice: r.current_purchase_price,
        salePrice: r.current_sale_price,
        totalValuation: r.valuation_purchase,
        potentialRevenue: r.valuation_sale,
        potentialMargin: r.potential_margin,
    }));
    const totalValuation = rows.reduce((acc, r) => acc + r.totalValuation, 0);
    const totalPotentialRevenue = rows.reduce((acc, r) => acc + r.potentialRevenue, 0);
    const totalPhysicalItems = rows.reduce((acc, r) => acc + r.physicalQuantity, 0);
    return sendSuccess(res, {
        items: rows,
        summary: {
            totalValuation,
            totalPotentialRevenue,
            totalPhysicalItems,
            totalDistinctProducts: rows.length,
        },
    });
});
// Sales Report
router.get('/sales', authenticate, (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
    let query = `
    SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name,
           s.user_id, u.full_name as user_name, s.customer_name, s.customer_phone,
           s.total_amount, s.status, s.created_at, s.updated_at
    FROM sales s
    JOIN warehouses w ON s.warehouse_id = w.id
    JOIN users u ON s.user_id = u.id
    WHERE s.status = 'COMPLETED'
  `;
    const params = [];
    if (warehouseId) {
        query += ' AND s.warehouse_id = ?';
        params.push(warehouseId);
    }
    if (startDate) {
        query += ' AND date(s.created_at) >= date(?)';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND date(s.created_at) <= date(?)';
        params.push(endDate);
    }
    query += ' ORDER BY s.created_at DESC';
    const sales = db.prepare(query).all(...params).map((s) => ({
        id: s.id,
        invoiceNumber: s.invoice_number,
        warehouseId: s.warehouse_id,
        warehouseName: s.warehouse_name,
        userId: s.user_id,
        userName: s.user_name,
        customerName: s.customer_name,
        customerPhone: s.customer_phone,
        totalAmount: s.total_amount,
        status: s.status,
        createdAt: s.created_at,
    }));
    return sendSuccess(res, sales);
});
// Consolidated Financial Report
router.get('/financial', authenticate, (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const period = req.query.period ? String(req.query.period) : new Date().toISOString().substring(0, 7);
    // Revenue & COGS
    let revQuery = `
    SELECT SUM(s.total_amount) as revenue,
           SUM(si.quantity * p.purchase_price) as cogs
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    JOIN products p ON si.product_id = p.id
    WHERE s.status = 'COMPLETED' AND strftime('%Y-%m', s.created_at) = ?
  `;
    if (warehouseId)
        revQuery += ` AND s.warehouse_id = ${warehouseId}`;
    const revStats = db.prepare(revQuery).get(period);
    const totalRevenue = revStats?.revenue || 0;
    const totalCogs = revStats?.cogs || 0;
    const grossProfit = totalRevenue - totalCogs;
    // Categorized Expenses
    let expQuery = `
    SELECT category, SUM(amount) as total
    FROM expenses
    WHERE strftime('%Y-%m', expense_date) = ?
  `;
    if (warehouseId)
        expQuery += ` AND warehouse_id = ${warehouseId}`;
    expQuery += ' GROUP BY category';
    const expenseCategories = db.prepare(expQuery).all(period);
    const totalExpenses = expenseCategories.reduce((sum, e) => sum + e.total, 0);
    // Salaries
    let salQuery = `SELECT SUM(total_amount) as total FROM salaries WHERE period = ?`;
    if (warehouseId)
        salQuery += ` AND warehouse_id = ${warehouseId}`;
    const totalSalaries = db.prepare(salQuery).get(period)?.total || 0;
    const netProfit = grossProfit - totalExpenses - totalSalaries;
    const marginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    return sendSuccess(res, {
        period,
        warehouseId: warehouseId || null,
        totalRevenue,
        totalCostOfGoodsSold: totalCogs,
        grossProfit,
        totalExpenses,
        expenseBreakdown: expenseCategories,
        totalSalaries,
        netProfit,
        marginPercentage: Math.round(marginPercentage * 10) / 10,
    });
});
export default router;
