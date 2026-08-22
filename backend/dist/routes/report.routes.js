import { Router } from 'express';
import { query } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, validateWarehouseScope } from '../middleware/auth.js';
const router = Router();
function formatDateStr(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
router.get(['/dashboard', '/dashboard-metrics'], authenticate, async (req, res) => {
    try {
        const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
        if (warehouseId && req.user) {
            try {
                validateWarehouseScope(req.user, warehouseId);
            }
            catch (err) {
                return sendError(res, err.message, 403);
            }
        }
        const preset = req.query.preset || 'thisMonth';
        const customStart = req.query.startDate;
        const customEnd = req.query.endDate;
        const now = new Date();
        let startDate = '';
        let endDate = '';
        let priorStartDate = '';
        let priorEndDate = '';
        let periodLabel = 'Ce Mois-ci';
        let priorPeriodLabel = 'vs mois précédent';
        if (preset === 'today') {
            startDate = formatDateStr(now);
            endDate = formatDateStr(now);
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            priorStartDate = formatDateStr(yesterday);
            priorEndDate = formatDateStr(yesterday);
            periodLabel = "Aujourd'hui";
            priorPeriodLabel = 'vs hier';
        }
        else if (preset === 'yesterday') {
            const yest = new Date(now);
            yest.setDate(now.getDate() - 1);
            startDate = formatDateStr(yest);
            endDate = formatDateStr(yest);
            const dayBefore = new Date(now);
            dayBefore.setDate(now.getDate() - 2);
            priorStartDate = formatDateStr(dayBefore);
            priorEndDate = formatDateStr(dayBefore);
            periodLabel = 'Hier';
            priorPeriodLabel = 'vs avant-hier';
        }
        else if (preset === 'last7days') {
            const start = new Date(now);
            start.setDate(now.getDate() - 6);
            startDate = formatDateStr(start);
            endDate = formatDateStr(now);
            const pEnd = new Date(start);
            pEnd.setDate(start.getDate() - 1);
            const pStart = new Date(pEnd);
            pStart.setDate(pEnd.getDate() - 6);
            priorStartDate = formatDateStr(pStart);
            priorEndDate = formatDateStr(pEnd);
            periodLabel = '7 Derniers Jours';
            priorPeriodLabel = 'vs 7j précédents';
        }
        else if (preset === 'last30days') {
            const start = new Date(now);
            start.setDate(now.getDate() - 29);
            startDate = formatDateStr(start);
            endDate = formatDateStr(now);
            const pEnd = new Date(start);
            pEnd.setDate(start.getDate() - 1);
            const pStart = new Date(pEnd);
            pStart.setDate(pEnd.getDate() - 29);
            priorStartDate = formatDateStr(pStart);
            priorEndDate = formatDateStr(pEnd);
            periodLabel = '30 Derniers Jours';
            priorPeriodLabel = 'vs 30j précédents';
        }
        else if (preset === 'lastMonth') {
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            startDate = formatDateStr(lastMonthDate);
            endDate = formatDateStr(lastMonthEnd);
            const twoMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            const twoMonthsAgoEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
            priorStartDate = formatDateStr(twoMonthsAgoDate);
            priorEndDate = formatDateStr(twoMonthsAgoEnd);
            periodLabel = 'Mois Précédent';
            priorPeriodLabel = 'vs mois d\'avant';
        }
        else if (preset === 'thisYear') {
            const start = new Date(now.getFullYear(), 0, 1);
            startDate = formatDateStr(start);
            endDate = formatDateStr(now);
            const pStart = new Date(now.getFullYear() - 1, 0, 1);
            const pEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            priorStartDate = formatDateStr(pStart);
            priorEndDate = formatDateStr(pEnd);
            periodLabel = 'Année en cours';
            priorPeriodLabel = 'vs même période an dernier';
        }
        else if (preset === 'lastYear') {
            const start = new Date(now.getFullYear() - 1, 0, 1);
            const end = new Date(now.getFullYear() - 1, 11, 31);
            startDate = formatDateStr(start);
            endDate = formatDateStr(end);
            const pStart = new Date(now.getFullYear() - 2, 0, 1);
            const pEnd = new Date(now.getFullYear() - 2, 11, 31);
            priorStartDate = formatDateStr(pStart);
            priorEndDate = formatDateStr(pEnd);
            periodLabel = 'Année Précédente';
            priorPeriodLabel = 'vs 2 ans plus tôt';
        }
        else if (customStart && customEnd) {
            startDate = customStart;
            endDate = customEnd;
            const s = new Date(customStart);
            const e = new Date(customEnd);
            const diffTime = Math.abs(e.getTime() - s.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            const pEnd = new Date(s);
            pEnd.setDate(s.getDate() - 1);
            const pStart = new Date(pEnd);
            pStart.setDate(pEnd.getDate() - (diffDays - 1));
            priorStartDate = formatDateStr(pStart);
            priorEndDate = formatDateStr(pEnd);
            periodLabel = `Du ${startDate} au ${endDate}`;
            priorPeriodLabel = 'vs période précédente';
        }
        else {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate = formatDateStr(firstDay);
            endDate = formatDateStr(now);
            const lastMonthFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEquivalent = new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), 28));
            priorStartDate = formatDateStr(lastMonthFirst);
            priorEndDate = formatDateStr(lastMonthEquivalent);
            periodLabel = 'Ce Mois-ci';
            priorPeriodLabel = 'vs mois précédent';
        }
        // 1. Stock Valuation
        let stockQuery = `
      SELECT SUM(s.physical_quantity * p.purchase_price) as total_valuation,
             SUM(s.physical_quantity) as total_items,
             COUNT(DISTINCT s.product_id) as total_products
      FROM stock s
      JOIN products p ON s.product_id = p.id
    `;
        const stockParams = [];
        if (warehouseId) {
            stockParams.push(warehouseId);
            stockQuery += ` WHERE s.warehouse_id = $1`;
        }
        const stockRes = await query(stockQuery, stockParams);
        const stockStats = stockRes.rows[0];
        const totalStockValuation = Number(stockStats?.total_valuation || 0);
        const totalStockItems = Number(stockStats?.total_items || 0);
        // 2. Active Period Sales Query
        let periodSalesQuery = `
      SELECT SUM(total_amount) as total, COUNT(*) as count
      FROM sales
      WHERE status = 'COMPLETED' AND created_at::date >= $1::date AND created_at::date <= $2::date
    `;
        const periodSalesParams = [startDate, endDate];
        if (warehouseId) {
            periodSalesParams.push(warehouseId);
            periodSalesQuery += ` AND warehouse_id = $${periodSalesParams.length}`;
        }
        const periodSalesRes = await query(periodSalesQuery, periodSalesParams);
        const periodSalesStats = periodSalesRes.rows[0];
        const periodSales = Number(periodSalesStats?.total || 0);
        const periodOrders = Number(periodSalesStats?.count || 0);
        const periodAverageBasket = periodOrders > 0 ? Math.round((periodSales / periodOrders) * 100) / 100 : 0;
        // 3. Prior Period Sales Query
        let priorSalesQuery = `
      SELECT SUM(total_amount) as total, COUNT(*) as count
      FROM sales
      WHERE status = 'COMPLETED' AND created_at::date >= $1::date AND created_at::date <= $2::date
    `;
        const priorSalesParams = [priorStartDate, priorEndDate];
        if (warehouseId) {
            priorSalesParams.push(warehouseId);
            priorSalesQuery += ` AND warehouse_id = $${priorSalesParams.length}`;
        }
        const priorSalesRes = await query(priorSalesQuery, priorSalesParams);
        const priorSalesStats = priorSalesRes.rows[0];
        const priorSales = Number(priorSalesStats?.total || 0);
        const priorOrders = Number(priorSalesStats?.count || 0);
        const salesGrowthPercentage = priorSales > 0
            ? Math.round(((periodSales - priorSales) / priorSales) * 1000) / 10
            : (periodSales > 0 ? 100 : 0);
        const ordersGrowthPercentage = priorOrders > 0
            ? Math.round(((periodOrders - priorOrders) / priorOrders) * 1000) / 10
            : (periodOrders > 0 ? 100 : 0);
        // 4. Sales Today & Sales This Month
        const todayStr = formatDateStr(now);
        const currentMonthStr = now.toISOString().substring(0, 7);
        let salesTodayQuery = `SELECT SUM(total_amount) as total, COUNT(*) as count FROM sales WHERE status = 'COMPLETED' AND created_at::date = $1::date`;
        const salesTodayParams = [todayStr];
        if (warehouseId) {
            salesTodayParams.push(warehouseId);
            salesTodayQuery += ` AND warehouse_id = $${salesTodayParams.length}`;
        }
        const salesTodayRes = await query(salesTodayQuery, salesTodayParams);
        const totalSalesToday = Number(salesTodayRes.rows[0]?.total || 0);
        const totalOrdersToday = Number(salesTodayRes.rows[0]?.count || 0);
        let salesMonthQuery = `SELECT SUM(total_amount) as total, COUNT(*) as count FROM sales WHERE status = 'COMPLETED' AND TO_CHAR(created_at, 'YYYY-MM') = $1`;
        const salesMonthParams = [currentMonthStr];
        if (warehouseId) {
            salesMonthParams.push(warehouseId);
            salesMonthQuery += ` AND warehouse_id = $${salesMonthParams.length}`;
        }
        const salesMonthRes = await query(salesMonthQuery, salesMonthParams);
        const totalSalesThisMonth = Number(salesMonthRes.rows[0]?.total || 0);
        // 5. Period COGS, Expenses, Salaries & Net Profit
        let cogsQuery = `
      SELECT SUM(si.quantity * p.purchase_price) as cogs
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'COMPLETED' AND s.created_at::date >= $1::date AND s.created_at::date <= $2::date
    `;
        const cogsParams = [startDate, endDate];
        if (warehouseId) {
            cogsParams.push(warehouseId);
            cogsQuery += ` AND s.warehouse_id = $${cogsParams.length}`;
        }
        const cogsRes = await query(cogsQuery, cogsParams);
        const periodCogs = Number(cogsRes.rows[0]?.cogs || 0);
        const periodGrossProfit = periodSales - periodCogs;
        let expQuery = `SELECT SUM(amount) as total FROM expenses WHERE expense_date::date >= $1::date AND expense_date::date <= $2::date`;
        const expParams = [startDate, endDate];
        if (warehouseId) {
            expParams.push(warehouseId);
            expQuery += ` AND warehouse_id = $${expParams.length}`;
        }
        const expRes = await query(expQuery, expParams);
        const periodExpenses = Number(expRes.rows[0]?.total || 0);
        const startMonth = startDate.substring(0, 7);
        const endMonth = endDate.substring(0, 7);
        let salQuery = `SELECT SUM(total_amount) as total FROM salaries WHERE period >= $1 AND period <= $2`;
        const salParams = [startMonth, endMonth];
        if (warehouseId) {
            salParams.push(warehouseId);
            salQuery += ` AND warehouse_id = $${salParams.length}`;
        }
        const salRes = await query(salQuery, salParams);
        const periodSalaries = Number(salRes.rows[0]?.total || 0);
        const periodNetProfit = periodGrossProfit - periodExpenses - periodSalaries;
        // 6. Time Series Breakdown (salesTrend)
        const isMultiYear = (new Date(endDate).getFullYear() - new Date(startDate).getFullYear()) >= 1;
        const trendParams = [startDate, endDate];
        let trendQuery = '';
        if (isMultiYear || preset === 'lastYear' || preset === 'thisYear') {
            trendQuery = `
        SELECT TO_CHAR(created_at, 'YYYY-MM') as period_key,
               SUM(total_amount) as total_amount,
               COUNT(*) as orders_count
        FROM sales
        WHERE status = 'COMPLETED' AND created_at::date >= $1::date AND created_at::date <= $2::date
        ${warehouseId ? `AND warehouse_id = ${warehouseId}` : ''}
        GROUP BY period_key
        ORDER BY period_key ASC
      `;
        }
        else {
            trendQuery = `
        SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as period_key,
               SUM(total_amount) as total_amount,
               COUNT(*) as orders_count
        FROM sales
        WHERE status = 'COMPLETED' AND created_at::date >= $1::date AND created_at::date <= $2::date
        ${warehouseId ? `AND warehouse_id = ${warehouseId}` : ''}
        GROUP BY period_key
        ORDER BY period_key ASC
      `;
        }
        const trendRes = await query(trendQuery, trendParams);
        const salesTrend = trendRes.rows.map((r) => ({
            date: r.period_key,
            label: r.period_key,
            totalAmount: Number(r.total_amount || 0),
            ordersCount: Number(r.orders_count || 0),
        }));
        // 7. Low Stock Alerts & Out of Stock Alerts
        let outOfStockQuery = `
      SELECT COUNT(*) as count
      FROM stock s
      WHERE (s.physical_quantity - s.reserved_quantity) <= 0
    `;
        if (warehouseId)
            outOfStockQuery += ` AND s.warehouse_id = ${warehouseId}`;
        const outOfStockRes = await query(outOfStockQuery);
        const outOfStockCount = Number(outOfStockRes.rows[0]?.count || 0);
        let lowStockQuery = `
      SELECT COUNT(*) as count
      FROM stock s
      JOIN products p ON s.product_id = p.id
      WHERE (s.physical_quantity - s.reserved_quantity) > 0 
        AND (s.physical_quantity - s.reserved_quantity) <= p.min_stock_alert
    `;
        if (warehouseId)
            lowStockQuery += ` AND s.warehouse_id = ${warehouseId}`;
        const lowStockRes = await query(lowStockQuery);
        const lowStockCount = Number(lowStockRes.rows[0]?.count || 0);
        let pendingTransfersQuery = `SELECT COUNT(*) as count FROM transfers WHERE status = 'REQUESTED'`;
        if (warehouseId)
            pendingTransfersQuery += ` AND (source_warehouse_id = ${warehouseId} OR destination_warehouse_id = ${warehouseId})`;
        const pendingTransfersRes = await query(pendingTransfersQuery);
        const pendingTransfersCount = Number(pendingTransfersRes.rows[0]?.count || 0);
        // 8. Multi-Warehouse Comparison
        const warehousesRes = await query('SELECT id, name, code FROM warehouses WHERE active = TRUE ORDER BY id ASC');
        const warehouses = warehousesRes.rows;
        const warehouseBreakdown = await Promise.all(warehouses.map(async (wh) => {
            const valRes = await query(`
        SELECT SUM(s.physical_quantity * p.purchase_price) as val,
               COUNT(DISTINCT s.product_id) as count
        FROM stock s JOIN products p ON s.product_id = p.id
        WHERE s.warehouse_id = $1
      `, [wh.id]);
            const stockVal = Number(valRes.rows[0]?.val || 0);
            const prodCount = Number(valRes.rows[0]?.count || 0);
            const salesRes = await query(`
        SELECT SUM(total_amount) as sales
        FROM sales
        WHERE warehouse_id = $1 AND status = 'COMPLETED' AND created_at::date >= $2::date AND created_at::date <= $3::date
      `, [wh.id, startDate, endDate]);
            const wSales = Number(salesRes.rows[0]?.sales || 0);
            const expRes = await query(`
        SELECT SUM(amount) as exp
        FROM expenses
        WHERE warehouse_id = $1 AND expense_date::date >= $2::date AND expense_date::date <= $3::date
      `, [wh.id, startDate, endDate]);
            const wExpenses = Number(expRes.rows[0]?.exp || 0);
            const salRes = await query(`
        SELECT SUM(total_amount) as sal
        FROM salaries
        WHERE warehouse_id = $1 AND period >= $2 AND period <= $3
      `, [wh.id, startMonth, endMonth]);
            const wSalaries = Number(salRes.rows[0]?.sal || 0);
            return {
                warehouseId: wh.id,
                warehouseName: wh.name,
                warehouseCode: wh.code,
                stockValue: stockVal,
                stockValuation: stockVal,
                totalProductsCount: prodCount,
                monthlySales: wSales,
                periodSales: wSales,
                monthlyExpenses: wExpenses,
                monthlySalaries: wSalaries,
                estimatedProfit: wSales * 0.25 - wExpenses - wSalaries,
            };
        }));
        // Recent Movements & Sales
        const recentMovementsRes = await query(`
      SELECT m.id, m.warehouse_id, w.name as warehouse_name,
             m.product_id, p.name as product_name, p.reference as product_reference,
             m.movement_type, m.quantity_change, m.reference, m.created_at
      FROM stock_movements m
      JOIN warehouses w ON m.warehouse_id = w.id
      JOIN products p ON m.product_id = p.id
      ${warehouseId ? `WHERE m.warehouse_id = ${warehouseId}` : ''}
      ORDER BY m.created_at DESC, m.id DESC LIMIT 6
    `);
        const recentMovements = recentMovementsRes.rows.map((m) => ({
            id: m.id,
            warehouseId: m.warehouse_id,
            warehouseName: m.warehouse_name,
            productId: m.product_id,
            productName: m.product_name,
            productReference: m.product_reference,
            movementType: m.movement_type,
            type: m.movement_type,
            quantityChange: Number(m.quantity_change),
            quantity: Number(m.quantity_change),
            reference: m.reference,
            createdAt: m.created_at,
        }));
        const recentSalesRes = await query(`
      SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name,
             s.customer_name, s.total_amount, s.status, COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at
      FROM sales s
      JOIN warehouses w ON s.warehouse_id = w.id
      ${warehouseId ? `WHERE s.warehouse_id = ${warehouseId}` : ''}
      ORDER BY s.created_at DESC, s.id DESC LIMIT 6
    `);
        const recentSales = recentSalesRes.rows.map((s) => ({
            id: s.id,
            invoiceNumber: s.invoice_number,
            warehouseId: s.warehouse_id,
            warehouseName: s.warehouse_name,
            customerName: s.customer_name,
            totalAmount: Number(s.total_amount),
            status: s.status,
            saleDate: s.sale_date || s.created_at,
            createdAt: s.created_at,
        }));
        return sendSuccess(res, {
            preset,
            startDate,
            endDate,
            periodLabel,
            priorPeriodLabel,
            periodSales,
            periodOrders,
            periodAverageBasket,
            periodGrossProfit,
            periodExpenses,
            periodSalaries,
            periodNetProfit,
            priorSales,
            priorOrders,
            salesGrowthPercentage,
            ordersGrowthPercentage,
            salesTrend,
            totalStockValue: totalStockValuation,
            totalStockValuation,
            totalStockItems,
            salesToday: totalSalesToday,
            totalSalesToday,
            totalOrdersToday,
            salesThisMonth: totalSalesThisMonth,
            totalSalesThisMonth,
            totalRevenueThisMonth: totalSalesThisMonth,
            grossProfitThisMonth: periodGrossProfit,
            totalExpensesThisMonth: periodExpenses,
            totalSalariesThisMonth: periodSalaries,
            netProfitThisMonth: periodNetProfit,
            outOfStockCount,
            lowStockCount,
            pendingTransfersCount,
            warehouseComparisons: warehouseBreakdown,
            warehouseBreakdown,
            recentMovements,
            recentSales,
        });
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
// Stock Valuation Report
router.get('/stock-valuation', authenticate, async (req, res) => {
    try {
        const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
        let currentWarehouse = null;
        if (warehouseId) {
            const whRes = await query('SELECT name FROM warehouses WHERE id = $1', [warehouseId]);
            currentWarehouse = whRes.rows[0];
        }
        let sql = `
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
        const params = [];
        if (warehouseId) {
            params.push(warehouseId);
            sql += ' WHERE s.warehouse_id = $1';
        }
        sql += ' ORDER BY w.name ASC, p.name ASC';
        const result = await query(sql, params);
        const rows = result.rows.map((r) => ({
            id: r.id,
            warehouseId: r.warehouse_id,
            warehouseName: r.warehouse_name,
            productId: r.product_id,
            productReference: r.product_reference,
            productName: r.product_name,
            productBrand: r.brand,
            brand: r.brand,
            category: r.category,
            physicalQuantity: Number(r.physical_quantity),
            reservedQuantity: Number(r.reserved_quantity),
            availableQuantity: Number(r.available_quantity),
            purchasePrice: Number(r.current_purchase_price),
            productPurchasePrice: Number(r.current_purchase_price),
            salePrice: Number(r.current_sale_price),
            productSalePrice: Number(r.current_sale_price),
            totalValuation: Number(r.valuation_purchase),
            potentialRevenue: Number(r.valuation_sale),
            potentialMargin: Number(r.potential_margin),
        }));
        const totalValuation = rows.reduce((acc, r) => acc + r.totalValuation, 0);
        const totalPhysicalUnits = rows.reduce((acc, r) => acc + r.physicalQuantity, 0);
        const totalReservedUnits = rows.reduce((acc, r) => acc + r.reservedQuantity, 0);
        const totalAvailableUnits = rows.reduce((acc, r) => acc + r.availableQuantity, 0);
        const totalPotentialRevenue = rows.reduce((acc, r) => acc + r.potentialRevenue, 0);
        return sendSuccess(res, {
            warehouseId: warehouseId || null,
            warehouseName: currentWarehouse ? currentWarehouse.name : 'Tous les entrepôts (Global)',
            totalValuation,
            totalPhysicalUnits,
            totalReservedUnits,
            totalAvailableUnits,
            items: rows,
            summary: {
                totalValuation,
                totalPotentialRevenue,
                totalPhysicalItems: totalPhysicalUnits,
                totalDistinctProducts: rows.length,
            },
        });
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
// Sales Report
router.get('/sales', authenticate, async (req, res) => {
    try {
        const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
        const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
        const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
        let sql = `
      SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name,
             s.user_id, u.full_name as user_name, s.customer_name, s.customer_phone,
             s.total_amount, s.status, COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at
      FROM sales s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN users u ON s.user_id = u.id
      WHERE s.status = 'COMPLETED'
    `;
        const params = [];
        if (warehouseId) {
            params.push(warehouseId);
            sql += ` AND s.warehouse_id = $${params.length}`;
        }
        if (startDate) {
            params.push(startDate);
            sql += ` AND (COALESCE(s.sale_date, s.created_at))::date >= $${params.length}::date`;
        }
        if (endDate) {
            params.push(endDate);
            sql += ` AND (COALESCE(s.sale_date, s.created_at))::date <= $${params.length}::date`;
        }
        sql += ' ORDER BY COALESCE(s.sale_date, s.created_at) DESC, s.id DESC';
        const result = await query(sql, params);
        const sales = result.rows.map((s) => ({
            id: s.id,
            invoiceNumber: s.invoice_number,
            warehouseId: s.warehouse_id,
            warehouseName: s.warehouse_name,
            userId: s.user_id,
            userName: s.user_name,
            customerName: s.customer_name,
            customerPhone: s.customer_phone,
            totalAmount: Number(s.total_amount),
            status: s.status,
            saleDate: s.sale_date || s.created_at,
            createdAt: s.created_at,
        }));
        return sendSuccess(res, sales);
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
// Consolidated Financial Report
router.get('/financial', authenticate, async (req, res) => {
    try {
        const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
        const period = req.query.period ? String(req.query.period) : new Date().toISOString().substring(0, 7);
        let currentWarehouse = null;
        if (warehouseId) {
            const whRes = await query('SELECT name FROM warehouses WHERE id = $1', [warehouseId]);
            currentWarehouse = whRes.rows[0];
        }
        // Revenue & COGS
        let revQuery = `
      SELECT SUM(s.total_amount) as revenue,
             SUM(si.quantity * p.purchase_price) as cogs
      FROM sales s
      JOIN sale_items si ON s.id = si.sale_id
      JOIN products p ON si.product_id = p.id
      WHERE s.status = 'COMPLETED' AND TO_CHAR(s.created_at, 'YYYY-MM') = $1
    `;
        const revParams = [period];
        if (warehouseId) {
            revParams.push(warehouseId);
            revQuery += ` AND s.warehouse_id = $${revParams.length}`;
        }
        const revRes = await query(revQuery, revParams);
        const revStats = revRes.rows[0];
        const totalRevenue = Number(revStats?.revenue || 0);
        const totalCogs = Number(revStats?.cogs || 0);
        const grossProfit = totalRevenue - totalCogs;
        // Categorized Expenses
        let expQuery = `
      SELECT category, SUM(amount) as total
      FROM expenses
      WHERE TO_CHAR(expense_date, 'YYYY-MM') = $1
    `;
        const expParams = [period];
        if (warehouseId) {
            expParams.push(warehouseId);
            expQuery += ` AND warehouse_id = $${expParams.length}`;
        }
        expQuery += ' GROUP BY category';
        const expRes = await query(expQuery, expParams);
        const expenseCategories = expRes.rows.map((e) => ({
            category: e.category,
            total: Number(e.total),
        }));
        const totalExpenses = expenseCategories.reduce((sum, e) => sum + e.total, 0);
        const expensesByCategory = {};
        for (const exp of expenseCategories) {
            expensesByCategory[exp.category] = exp.total;
        }
        // Salaries
        let salQuery = `SELECT SUM(total_amount) as total FROM salaries WHERE period = $1`;
        const salParams = [period];
        if (warehouseId) {
            salParams.push(warehouseId);
            salQuery += ` AND warehouse_id = $${salParams.length}`;
        }
        const salRes = await query(salQuery, salParams);
        const totalSalaries = Number(salRes.rows[0]?.total || 0);
        const netProfit = grossProfit - totalExpenses - totalSalaries;
        const marginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
        return sendSuccess(res, {
            period,
            warehouseId: warehouseId || null,
            warehouseName: currentWarehouse ? currentWarehouse.name : 'Tous les entrepôts (Global)',
            totalRevenue,
            costOfGoodsSold: totalCogs,
            totalCostOfGoodsSold: totalCogs,
            grossProfit,
            totalExpenses,
            expensesByCategory,
            expenseBreakdown: expenseCategories,
            totalSalaries,
            netProfit,
            marginPercentage: Math.round(marginPercentage * 10) / 10,
        });
    }
    catch (err) {
        return sendError(res, err.message, 500);
    }
});
export default router;
