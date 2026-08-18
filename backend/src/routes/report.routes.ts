import { Router } from 'express';
import { db } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, AuthRequest, validateWarehouseScope } from '../middleware/auth.js';

const router = Router();

// Helper to format Date as YYYY-MM-DD in UTC/local
function formatDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Dashboard Metrics (both /reports/dashboard and /admin/reports/dashboard-metrics)
router.get(['/dashboard', '/dashboard-metrics'], authenticate, (req: AuthRequest, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
  if (warehouseId && req.user) {
    try {
      validateWarehouseScope(req.user, warehouseId);
    } catch (err: any) {
      return sendError(res, err.message, 403);
    }
  }

  const preset = (req.query.preset as string) || 'thisMonth';
  const customStart = req.query.startDate as string | undefined;
  const customEnd = req.query.endDate as string | undefined;

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
  } else if (preset === 'yesterday') {
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
  } else if (preset === 'last7days') {
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
  } else if (preset === 'last30days') {
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
  } else if (preset === 'lastMonth') {
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
  } else if (preset === 'thisYear') {
    const start = new Date(now.getFullYear(), 0, 1);
    startDate = formatDateStr(start);
    endDate = formatDateStr(now);
    const pStart = new Date(now.getFullYear() - 1, 0, 1);
    const pEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    priorStartDate = formatDateStr(pStart);
    priorEndDate = formatDateStr(pEnd);
    periodLabel = 'Année en cours';
    priorPeriodLabel = 'vs même période an dernier';
  } else if (preset === 'lastYear') {
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
  } else if (customStart && customEnd) {
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
  } else {
    // Default: thisMonth
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

  // 1. Stock Valuation (Physical inventory valuation at current purchase prices)
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
  const stockStats = db.prepare(stockQuery).get() as any;
  const totalStockValuation = stockStats?.total_valuation || 0;
  const totalStockItems = stockStats?.total_items || 0;

  // 2. Active Period Sales Query
  let periodSalesQuery = `
    SELECT SUM(total_amount) as total, COUNT(*) as count
    FROM sales
    WHERE status = 'COMPLETED' AND date(created_at) >= date(?) AND date(created_at) <= date(?)
  `;
  const periodSalesParams: any[] = [startDate, endDate];
  if (warehouseId) {
    periodSalesQuery += ' AND warehouse_id = ?';
    periodSalesParams.push(warehouseId);
  }
  const periodSalesStats = db.prepare(periodSalesQuery).get(...periodSalesParams) as any;
  const periodSales = periodSalesStats?.total || 0;
  const periodOrders = periodSalesStats?.count || 0;
  const periodAverageBasket = periodOrders > 0 ? Math.round((periodSales / periodOrders) * 100) / 100 : 0;

  // 3. Prior Period Sales Query (for comparison delta)
  let priorSalesQuery = `
    SELECT SUM(total_amount) as total, COUNT(*) as count
    FROM sales
    WHERE status = 'COMPLETED' AND date(created_at) >= date(?) AND date(created_at) <= date(?)
  `;
  const priorSalesParams: any[] = [priorStartDate, priorEndDate];
  if (warehouseId) {
    priorSalesQuery += ' AND warehouse_id = ?';
    priorSalesParams.push(warehouseId);
  }
  const priorSalesStats = db.prepare(priorSalesQuery).get(...priorSalesParams) as any;
  const priorSales = priorSalesStats?.total || 0;
  const priorOrders = priorSalesStats?.count || 0;

  const salesGrowthPercentage = priorSales > 0
    ? Math.round(((periodSales - priorSales) / priorSales) * 1000) / 10
    : (periodSales > 0 ? 100 : 0);

  const ordersGrowthPercentage = priorOrders > 0
    ? Math.round(((periodOrders - priorOrders) / priorOrders) * 1000) / 10
    : (periodOrders > 0 ? 100 : 0);

  // 4. Sales Today & Sales This Month (for standard KPI cards)
  const todayStr = formatDateStr(now);
  const currentMonthStr = now.toISOString().substring(0, 7);

  let salesTodayQuery = `SELECT SUM(total_amount) as total, COUNT(*) as count FROM sales WHERE status = 'COMPLETED' AND date(created_at) = date(?)`;
  const salesTodayParams: any[] = [todayStr];
  if (warehouseId) {
    salesTodayQuery += ' AND warehouse_id = ?';
    salesTodayParams.push(warehouseId);
  }
  const salesTodayStats = db.prepare(salesTodayQuery).get(...salesTodayParams) as any;
  const totalSalesToday = salesTodayStats?.total || 0;
  const totalOrdersToday = salesTodayStats?.count || 0;

  let salesMonthQuery = `SELECT SUM(total_amount) as total, COUNT(*) as count FROM sales WHERE status = 'COMPLETED' AND strftime('%Y-%m', created_at) = ?`;
  const salesMonthParams: any[] = [currentMonthStr];
  if (warehouseId) {
    salesMonthQuery += ' AND warehouse_id = ?';
    salesMonthParams.push(warehouseId);
  }
  const salesMonthStats = db.prepare(salesMonthQuery).get(...salesMonthParams) as any;
  const totalSalesThisMonth = salesMonthStats?.total || 0;

  // 5. Period COGS, Expenses, Salaries & Net Profit
  let cogsQuery = `
    SELECT SUM(si.quantity * p.purchase_price) as cogs
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN products p ON si.product_id = p.id
    WHERE s.status = 'COMPLETED' AND date(s.created_at) >= date(?) AND date(s.created_at) <= date(?)
  `;
  const cogsParams: any[] = [startDate, endDate];
  if (warehouseId) {
    cogsQuery += ' AND s.warehouse_id = ?';
    cogsParams.push(warehouseId);
  }
  const cogsStats = db.prepare(cogsQuery).get(...cogsParams) as any;
  const periodCogs = cogsStats?.cogs || 0;
  const periodGrossProfit = periodSales - periodCogs;

  let expQuery = `SELECT SUM(amount) as total FROM expenses WHERE date(expense_date) >= date(?) AND date(expense_date) <= date(?)`;
  const expParams: any[] = [startDate, endDate];
  if (warehouseId) {
    expQuery += ' AND warehouse_id = ?';
    expParams.push(warehouseId);
  }
  const expStats = db.prepare(expQuery).get(...expParams) as any;
  const periodExpenses = expStats?.total || 0;

  // Month-based salaries matching the period
  let salQuery = `SELECT SUM(total_amount) as total FROM salaries WHERE period >= ? AND period <= ?`;
  const startMonth = startDate.substring(0, 7);
  const endMonth = endDate.substring(0, 7);
  const salParams: any[] = [startMonth, endMonth];
  if (warehouseId) {
    salQuery += ' AND warehouse_id = ?';
    salParams.push(warehouseId);
  }
  const salStats = db.prepare(salQuery).get(...salParams) as any;
  const periodSalaries = salStats?.total || 0;

  const periodNetProfit = periodGrossProfit - periodExpenses - periodSalaries;

  // 6. Time Series Breakdown (salesTrend)
  const isMultiYear = (new Date(endDate).getFullYear() - new Date(startDate).getFullYear()) >= 1;
  let trendQuery = '';
  const trendParams: any[] = [startDate, endDate];

  if (isMultiYear || preset === 'lastYear' || preset === 'thisYear') {
    // Group by month
    trendQuery = `
      SELECT strftime('%Y-%m', created_at) as period_key,
             SUM(total_amount) as total_amount,
             COUNT(*) as orders_count
      FROM sales
      WHERE status = 'COMPLETED' AND date(created_at) >= date(?) AND date(created_at) <= date(?)
      ${warehouseId ? `AND warehouse_id = ${warehouseId}` : ''}
      GROUP BY period_key
      ORDER BY period_key ASC
    `;
  } else {
    // Group by day
    trendQuery = `
      SELECT date(created_at) as period_key,
             SUM(total_amount) as total_amount,
             COUNT(*) as orders_count
      FROM sales
      WHERE status = 'COMPLETED' AND date(created_at) >= date(?) AND date(created_at) <= date(?)
      ${warehouseId ? `AND warehouse_id = ${warehouseId}` : ''}
      GROUP BY period_key
      ORDER BY period_key ASC
    `;
  }

  const trendRows = db.prepare(trendQuery).all(...trendParams) as any[];
  const salesTrend = trendRows.map((r: any) => ({
    date: r.period_key,
    label: r.period_key,
    totalAmount: r.total_amount || 0,
    ordersCount: r.orders_count || 0,
  }));

  // 7. Low Stock Alerts & Out of Stock Alerts
  let outOfStockQuery = `
    SELECT COUNT(*) as count
    FROM stock s
    WHERE (s.physical_quantity - s.reserved_quantity) <= 0
  `;
  if (warehouseId) outOfStockQuery += ` AND s.warehouse_id = ${warehouseId}`;
  const outOfStockCount = (db.prepare(outOfStockQuery).get() as any)?.count || 0;

  let lowStockQuery = `
    SELECT COUNT(*) as count
    FROM stock s
    JOIN products p ON s.product_id = p.id
    WHERE (s.physical_quantity - s.reserved_quantity) > 0 
      AND (s.physical_quantity - s.reserved_quantity) <= p.min_stock_alert
  `;
  if (warehouseId) lowStockQuery += ` AND s.warehouse_id = ${warehouseId}`;
  const lowStockCount = (db.prepare(lowStockQuery).get() as any)?.count || 0;

  let pendingTransfersQuery = `SELECT COUNT(*) as count FROM transfers WHERE status = 'REQUESTED'`;
  if (warehouseId) pendingTransfersQuery += ` AND (source_warehouse_id = ${warehouseId} OR destination_warehouse_id = ${warehouseId})`;
  const pendingTransfersCount = (db.prepare(pendingTransfersQuery).get() as any)?.count || 0;

  // 8. Multi-Warehouse Comparison
  const warehouses = db.prepare('SELECT id, name, code FROM warehouses WHERE active = 1').all() as any[];
  const warehouseBreakdown = warehouses.map((wh) => {
    const wValuation = (db.prepare(`
      SELECT SUM(s.physical_quantity * p.purchase_price) as val,
             COUNT(DISTINCT s.product_id) as count
      FROM stock s JOIN products p ON s.product_id = p.id
      WHERE s.warehouse_id = ?
    `).get(wh.id) as any);
    const stockVal = wValuation?.val || 0;
    const prodCount = wValuation?.count || 0;

    const wSales = (db.prepare(`
      SELECT SUM(total_amount) as sales
      FROM sales
      WHERE warehouse_id = ? AND status = 'COMPLETED' AND date(created_at) >= date(?) AND date(created_at) <= date(?)
    `).get(wh.id, startDate, endDate) as any)?.sales || 0;

    const wExpenses = (db.prepare(`
      SELECT SUM(amount) as exp
      FROM expenses
      WHERE warehouse_id = ? AND date(expense_date) >= date(?) AND date(expense_date) <= date(?)
    `).get(wh.id, startDate, endDate) as any)?.exp || 0;

    const wSalaries = (db.prepare(`
      SELECT SUM(total_amount) as sal
      FROM salaries
      WHERE warehouse_id = ? AND period >= ? AND period <= ?
    `).get(wh.id, startMonth, endMonth) as any)?.sal || 0;

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
  `).all().map((m: any) => ({
    id: m.id,
    warehouseId: m.warehouse_id,
    warehouseName: m.warehouse_name,
    productId: m.product_id,
    productName: m.product_name,
    productReference: m.product_reference,
    movementType: m.movement_type,
    type: m.movement_type,
    quantityChange: m.quantity_change,
    quantity: m.quantity_change,
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
  `).all().map((s: any) => ({
    id: s.id,
    invoiceNumber: s.invoice_number,
    warehouseId: s.warehouse_id,
    warehouseName: s.warehouse_name,
    customerName: s.customer_name,
    totalAmount: s.total_amount,
    status: s.status,
    saleDate: s.created_at,
    createdAt: s.created_at,
  }));

  return sendSuccess(res, {
    preset,
    startDate,
    endDate,
    periodLabel,
    priorPeriodLabel,
    // Period metrics
    periodSales,
    periodOrders,
    periodAverageBasket,
    periodGrossProfit,
    periodExpenses,
    periodSalaries,
    periodNetProfit,
    // Comparisons
    priorSales,
    priorOrders,
    salesGrowthPercentage,
    ordersGrowthPercentage,
    // Sales Trend chart data
    salesTrend,
    // Base/Standard metrics
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
});

// Stock Valuation Report
router.get('/stock-valuation', authenticate, (req: AuthRequest, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
  const currentWarehouse = warehouseId ? db.prepare('SELECT name FROM warehouses WHERE id = ?').get(warehouseId) as any : null;

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
  if (warehouseId) query += ` WHERE s.warehouse_id = ${warehouseId}`;
  query += ' ORDER BY w.name ASC, p.name ASC';

  const rows = db.prepare(query).all().map((r: any) => ({
    id: r.id,
    warehouseId: r.warehouse_id,
    warehouseName: r.warehouse_name,
    productId: r.product_id,
    productReference: r.product_reference,
    productName: r.product_name,
    productBrand: r.brand,
    brand: r.brand,
    category: r.category,
    physicalQuantity: r.physical_quantity,
    reservedQuantity: r.reserved_quantity,
    availableQuantity: r.available_quantity,
    purchasePrice: r.current_purchase_price,
    productPurchasePrice: r.current_purchase_price,
    salePrice: r.current_sale_price,
    productSalePrice: r.current_sale_price,
    totalValuation: r.valuation_purchase,
    potentialRevenue: r.valuation_sale,
    potentialMargin: r.potential_margin,
  }));

  const totalValuation = rows.reduce((acc: number, r: any) => acc + r.totalValuation, 0);
  const totalPhysicalUnits = rows.reduce((acc: number, r: any) => acc + r.physicalQuantity, 0);
  const totalReservedUnits = rows.reduce((acc: number, r: any) => acc + r.reservedQuantity, 0);
  const totalAvailableUnits = rows.reduce((acc: number, r: any) => acc + r.availableQuantity, 0);
  const totalPotentialRevenue = rows.reduce((acc: number, r: any) => acc + r.potentialRevenue, 0);

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
});

// Sales Report
router.get('/sales', authenticate, (req: AuthRequest, res) => {
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
  const params: any[] = [];
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

  const sales = db.prepare(query).all(...params).map((s: any) => ({
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
    saleDate: s.created_at,
    createdAt: s.created_at,
  }));

  return sendSuccess(res, sales);
});

// Consolidated Financial Report
router.get('/financial', authenticate, (req: AuthRequest, res) => {
  const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
  const period = req.query.period ? String(req.query.period) : new Date().toISOString().substring(0, 7);
  const currentWarehouse = warehouseId ? db.prepare('SELECT name FROM warehouses WHERE id = ?').get(warehouseId) as any : null;

  // Revenue & COGS
  let revQuery = `
    SELECT SUM(s.total_amount) as revenue,
           SUM(si.quantity * p.purchase_price) as cogs
    FROM sales s
    JOIN sale_items si ON s.id = si.sale_id
    JOIN products p ON si.product_id = p.id
    WHERE s.status = 'COMPLETED' AND strftime('%Y-%m', s.created_at) = ?
  `;
  if (warehouseId) revQuery += ` AND s.warehouse_id = ${warehouseId}`;
  const revStats = db.prepare(revQuery).get(period) as any;
  const totalRevenue = revStats?.revenue || 0;
  const totalCogs = revStats?.cogs || 0;
  const grossProfit = totalRevenue - totalCogs;

  // Categorized Expenses
  let expQuery = `
    SELECT category, SUM(amount) as total
    FROM expenses
    WHERE strftime('%Y-%m', expense_date) = ?
  `;
  if (warehouseId) expQuery += ` AND warehouse_id = ${warehouseId}`;
  expQuery += ' GROUP BY category';
  const expenseCategories = db.prepare(expQuery).all(period) as any[];
  const totalExpenses = expenseCategories.reduce((sum, e) => sum + e.total, 0);

  const expensesByCategory: Record<string, number> = {};
  for (const exp of expenseCategories) {
    expensesByCategory[exp.category] = exp.total;
  }

  // Salaries
  let salQuery = `SELECT SUM(total_amount) as total FROM salaries WHERE period = ?`;
  if (warehouseId) salQuery += ` AND warehouse_id = ${warehouseId}`;
  const totalSalaries = (db.prepare(salQuery).get(period) as any)?.total || 0;

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
});

export default router;
