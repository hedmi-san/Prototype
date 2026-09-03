import { Router } from 'express';
import { query } from '../db/database.js';
import { sendSuccess, sendError } from '../common/response.js';
import { authenticate, requireRole, AuthRequest, logAudit, validateWarehouseScope, enforceWarehouseScope } from '../middleware/auth.js';

const router = Router();

function formatDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 1. GET /employees - List employees with optional warehouse and status filters
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const requestedWarehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    const warehouseId = enforceWarehouseScope(req.user, requestedWarehouseId);
    const status = req.query.status as string | undefined;

    let sql = `
      SELECT e.id, e.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
             e.full_name, e.national_id, e.phone, e.position,
             e.base_salary, COALESCE(e.status, CASE WHEN e.active THEN 'ACTIVE' ELSE 'TERMINATED' END) as status,
             e.active, e.hire_date, e.created_at
      FROM employees e
      JOIN warehouses w ON e.warehouse_id = w.id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (warehouseId) {
      params.push(warehouseId);
      conditions.push(`e.warehouse_id = $${params.length}`);
    }

    if (status && status !== 'ALL') {
      params.push(status);
      conditions.push(`COALESCE(e.status, CASE WHEN e.active THEN 'ACTIVE' ELSE 'TERMINATED' END) = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY e.id ASC';

    const result = await query(sql, params);
    const employees = result.rows.map((e: any) => ({
      id: e.id,
      warehouseId: e.warehouse_id,
      warehouseName: e.warehouse_name,
      warehouseCode: e.warehouse_code,
      fullName: e.full_name,
      nationalId: e.national_id,
      phone: e.phone,
      position: e.position,
      baseSalary: Number(e.base_salary),
      status: e.status || (e.active ? 'ACTIVE' : 'TERMINATED'),
      active: e.status ? e.status === 'ACTIVE' : Boolean(e.active),
      hireDate: e.hire_date,
      createdAt: e.created_at,
    }));

    return sendSuccess(res, employees);
  } catch (err: any) {
    const isAccessDenied = err.message?.includes('Access denied');
    return sendError(res, err.message, isAccessDenied ? 403 : 500);
  }
});

// 2. GET /employees/:id - Get single employee details
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const result = await query(`
      SELECT e.id, e.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
             w.location as warehouse_location, w.contact_number as warehouse_phone,
             e.full_name, e.national_id, e.phone, e.position,
             e.base_salary, COALESCE(e.status, CASE WHEN e.active THEN 'ACTIVE' ELSE 'TERMINATED' END) as status,
             e.active, e.hire_date, e.created_at
      FROM employees e
      JOIN warehouses w ON e.warehouse_id = w.id
      WHERE e.id = $1
    `, [id]);

    const e = result.rows[0];
    if (!e) {
      return sendError(res, `Employee not found with id ${id}`, 404);
    }

    if (req.user) {
      try {
        validateWarehouseScope(req.user, e.warehouse_id);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    return sendSuccess(res, {
      id: e.id,
      warehouseId: e.warehouse_id,
      warehouseName: e.warehouse_name,
      warehouseCode: e.warehouse_code,
      warehouseLocation: e.warehouse_location,
      warehousePhone: e.warehouse_phone,
      fullName: e.full_name,
      nationalId: e.national_id,
      phone: e.phone,
      position: e.position,
      baseSalary: Number(e.base_salary),
      status: e.status || (e.active ? 'ACTIVE' : 'TERMINATED'),
      active: e.status ? e.status === 'ACTIVE' : Boolean(e.active),
      hireDate: e.hire_date,
      createdAt: e.created_at,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// 3. GET /employees/:id/performance - Aggregated performance metrics
router.get('/:id/performance', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const empRes = await query('SELECT id, warehouse_id, full_name, base_salary FROM employees WHERE id = $1', [id]);
    const emp = empRes.rows[0];
    if (!emp) return sendError(res, `Employee not found with id ${id}`, 404);

    if (req.user) {
      try {
        validateWarehouseScope(req.user, emp.warehouse_id);
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

    if (preset === 'today') {
      startDate = formatDateStr(now);
      endDate = formatDateStr(now);
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      priorStartDate = formatDateStr(yesterday);
      priorEndDate = formatDateStr(yesterday);
      periodLabel = "Aujourd'hui";
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
    } else if (preset === 'thisYear') {
      const start = new Date(now.getFullYear(), 0, 1);
      startDate = formatDateStr(start);
      endDate = formatDateStr(now);
      const pStart = new Date(now.getFullYear() - 1, 0, 1);
      const pEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      priorStartDate = formatDateStr(pStart);
      priorEndDate = formatDateStr(pEnd);
      periodLabel = 'Année en cours';
    } else if (preset === 'lastYear') {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31);
      startDate = formatDateStr(start);
      endDate = formatDateStr(end);
      const pStart = new Date(now.getFullYear() - 2, 0, 1);
      const pEnd = new Date(now.getFullYear() - 2, 11, 31);
      priorStartDate = formatDateStr(pStart);
      priorEndDate = formatDateStr(pEnd);
      periodLabel = 'Année Dernière';
    } else if (customStart && customEnd) {
      startDate = customStart;
      endDate = customEnd;
      const s = new Date(startDate);
      const e = new Date(endDate);
      const durationMs = e.getTime() - s.getTime();
      const pEnd = new Date(s.getTime() - 86400000);
      const pStart = new Date(pEnd.getTime() - durationMs);
      priorStartDate = formatDateStr(pStart);
      priorEndDate = formatDateStr(pEnd);
      periodLabel = `${startDate} au ${endDate}`;
    } else {
      // thisMonth (default)
      const thisMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = formatDateStr(thisMonthDate);
      endDate = formatDateStr(now);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      priorStartDate = formatDateStr(lastMonthDate);
      priorEndDate = formatDateStr(lastMonthEnd);
      periodLabel = 'Ce Mois-ci';
    }

    const startTs = `${startDate} 00:00:00`;
    const endTs = `${endDate} 23:59:59`;
    const priorStartTs = `${priorStartDate} 00:00:00`;
    const priorEndTs = `${priorEndDate} 23:59:59`;

    // 1. Current period sales & revenue & units
    const currentSalesRes = await query(`
      SELECT 
        COUNT(DISTINCT s.id) as sales_count,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(si.quantity), 0) as total_units_sold
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.employee_id = $1
        AND s.status = 'COMPLETED'
        AND COALESCE(s.sale_date, s.created_at) >= $2
        AND COALESCE(s.sale_date, s.created_at) <= $3
    `, [id, startTs, endTs]);

    const salesCount = Number(currentSalesRes.rows[0]?.sales_count || 0);
    const totalRevenue = Number(currentSalesRes.rows[0]?.total_revenue || 0);
    const totalUnitsSold = Number(currentSalesRes.rows[0]?.total_units_sold || 0);
    const averageBasket = salesCount > 0 ? totalRevenue / salesCount : 0;

    // 2. Prior period metrics for comparison
    const priorSalesRes = await query(`
      SELECT 
        COUNT(DISTINCT s.id) as sales_count,
        COALESCE(SUM(s.total_amount), 0) as total_revenue
      FROM sales s
      WHERE s.employee_id = $1
        AND s.status = 'COMPLETED'
        AND COALESCE(s.sale_date, s.created_at) >= $2
        AND COALESCE(s.sale_date, s.created_at) <= $3
    `, [id, priorStartTs, priorEndTs]);

    const priorSalesCount = Number(priorSalesRes.rows[0]?.sales_count || 0);
    const priorTotalRevenue = Number(priorSalesRes.rows[0]?.total_revenue || 0);

    const salesGrowthPct = priorSalesCount > 0 
      ? Number((((salesCount - priorSalesCount) / priorSalesCount) * 100).toFixed(1)) 
      : (salesCount > 0 ? 100 : 0);

    const revenueGrowthPct = priorTotalRevenue > 0 
      ? Number((((totalRevenue - priorTotalRevenue) / priorTotalRevenue) * 100).toFixed(1)) 
      : (totalRevenue > 0 ? 100 : 0);

    // 3. Top products sold by this employee in the period
    const topProductsRes = await query(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.reference as product_reference,
        p.brand as product_brand,
        SUM(si.quantity) as quantity_sold,
        SUM(si.subtotal) as total_amount
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.employee_id = $1
        AND s.status = 'COMPLETED'
        AND COALESCE(s.sale_date, s.created_at) >= $2
        AND COALESCE(s.sale_date, s.created_at) <= $3
      GROUP BY p.id, p.name, p.reference, p.brand
      ORDER BY quantity_sold DESC, total_amount DESC
      LIMIT 5
    `, [id, startTs, endTs]);

    const topProducts = topProductsRes.rows.map((row: any) => ({
      productId: row.product_id,
      productName: row.product_name,
      productReference: row.product_reference,
      productBrand: row.product_brand,
      quantitySold: Number(row.quantity_sold),
      totalAmount: Number(row.total_amount),
    }));

    // 4. Compensation summary across all time & latest salary record
    const compRes = await query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as lifetime_paid,
        COUNT(id) as total_payouts
      FROM salaries
      WHERE employee_id = $1
    `, [id]);

    const lifetimePaid = Number(compRes.rows[0]?.lifetime_paid || 0);
    const totalPayouts = Number(compRes.rows[0]?.total_payouts || 0);

    return sendSuccess(res, {
      employeeId: id,
      employeeName: emp.full_name,
      currentBaseSalary: Number(emp.base_salary),
      period: {
        preset,
        startDate,
        endDate,
        periodLabel,
      },
      metrics: {
        salesCount,
        totalRevenue,
        totalUnitsSold,
        averageBasket,
        priorSalesCount,
        priorTotalRevenue,
        salesGrowthPct,
        revenueGrowthPct,
        lifetimePaid,
        totalPayouts,
      },
      topProducts,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// 4. GET /employees/:id/sales - Paginated sales for this employee
router.get('/:id/sales', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const empCheck = await query('SELECT id, warehouse_id FROM employees WHERE id = $1', [id]);
    const emp = empCheck.rows[0];
    if (!emp) return sendError(res, `Employee not found with id ${id}`, 404);

    if (req.user) {
      try {
        validateWarehouseScope(req.user, emp.warehouse_id);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const search = (req.query.search as string | undefined)?.trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let baseFromWhere = `
      FROM sales s
      JOIN warehouses w ON s.warehouse_id = w.id
      JOIN users u ON s.user_id = u.id
      WHERE s.employee_id = $1
    `;
    const params: any[] = [id];

    if (startDate) {
      const formattedStart = startDate.length === 10 ? `${startDate} 00:00:00` : startDate;
      params.push(formattedStart);
      baseFromWhere += ` AND COALESCE(s.sale_date, s.created_at) >= $${params.length}`;
    }

    if (endDate) {
      const formattedEnd = endDate.length === 10 ? `${endDate} 23:59:59` : endDate;
      params.push(formattedEnd);
      baseFromWhere += ` AND COALESCE(s.sale_date, s.created_at) <= $${params.length}`;
    }

    if (search) {
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      const p3 = params.length + 3;
      baseFromWhere += ` AND (s.invoice_number ILIKE $${p1} OR s.customer_name ILIKE $${p2} OR s.customer_phone ILIKE $${p3})`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const countQuery = `SELECT COUNT(*) as count ${baseFromWhere}`;
    const countRes = await query(countQuery, params);
    const total = Number(countRes.rows[0]?.count || 0);

    const selectParams = [...params, limit, offset];
    const limitIdx = selectParams.length - 1;
    const offsetIdx = selectParams.length;

    const selectQuery = `
      SELECT s.id, s.invoice_number, s.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
             s.user_id, u.full_name as user_name, s.customer_name, s.customer_phone,
             s.total_amount, s.status, COALESCE(s.sale_date, s.created_at) as sale_date, s.created_at
      ${baseFromWhere}
      ORDER BY COALESCE(s.sale_date, s.created_at) DESC, s.id DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const salesRes = await query(selectQuery, selectParams);
    const salesRows = salesRes.rows;

    const saleIds = salesRows.map((s) => s.id);
    const itemsBySaleId: Record<number, any[]> = {};

    if (saleIds.length > 0) {
      const itemsRes = await query(`
        SELECT si.id, si.sale_id, si.product_id, p.name as product_name, p.reference as product_reference,
               si.quantity, si.unit_price, si.subtotal
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ANY($1::int[])
      `, [saleIds]);

      for (const item of itemsRes.rows) {
        if (!itemsBySaleId[item.sale_id]) {
          itemsBySaleId[item.sale_id] = [];
        }
        itemsBySaleId[item.sale_id].push({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name,
          productReference: item.product_reference,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          subtotal: Number(item.subtotal),
        });
      }
    }

    const items = salesRows.map((s: any) => ({
      id: s.id,
      invoiceNumber: s.invoice_number,
      warehouseId: s.warehouse_id,
      warehouseName: s.warehouse_name,
      warehouseCode: s.warehouse_code,
      userId: s.user_id,
      userName: s.user_name,
      customerName: s.customer_name,
      customerPhone: s.customer_phone,
      totalAmount: Number(s.total_amount),
      saleDate: s.sale_date,
      status: s.status,
      createdAt: s.created_at,
      items: itemsBySaleId[s.id] || [],
    }));

    return sendSuccess(res, {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// 5. GET /employees/:id/salaries - Salary records snapshot history for this employee
router.get('/:id/salaries', authenticate, requireRole('ADMIN', 'SUPER_MANAGER', 'MANAGER', 'ACCOUNTANT'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const empCheck = await query('SELECT id, warehouse_id FROM employees WHERE id = $1', [id]);
    const emp = empCheck.rows[0];
    if (!emp) return sendError(res, `Employee not found with id ${id}`, 404);

    if (req.user) {
      try {
        validateWarehouseScope(req.user, emp.warehouse_id);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    const sql = `
      SELECT s.id, s.employee_id, e.full_name as employee_name, e.position as employee_position,
             s.warehouse_id, w.name as warehouse_name, w.code as warehouse_code,
             s.period, s.base_salary, s.bonus1, s.bonus2, s.total_amount,
             s.payment_date, s.created_at
      FROM salaries s
      JOIN employees e ON s.employee_id = e.id
      JOIN warehouses w ON s.warehouse_id = w.id
      WHERE s.employee_id = $1
      ORDER BY s.period DESC, s.payment_date DESC
    `;

    const result = await query(sql, [id]);
    const salaries = result.rows.map((s: any) => ({
      id: s.id,
      employeeId: s.employee_id,
      employeeName: s.employee_name,
      employeePosition: s.employee_position,
      warehouseId: s.warehouse_id,
      warehouseName: s.warehouse_name,
      warehouseCode: s.warehouse_code,
      period: s.period,
      baseSalary: Number(s.base_salary),
      bonus1: Number(s.bonus1),
      bonus2: Number(s.bonus2),
      totalAmount: Number(s.total_amount),
      paymentDate: s.payment_date,
      createdAt: s.created_at,
    }));

    return sendSuccess(res, salaries);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// 6. POST /employees - Register new employee
router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const { warehouseId, fullName, nationalId, phone, position, baseSalary, hireDate, status } = req.body;
    const targetWarehouseId = warehouseId || req.user?.warehouseId;
    if (!targetWarehouseId || !fullName || !nationalId || !position || baseSalary === undefined) {
      return sendError(res, 'warehouseId, fullName, nationalId, position, and baseSalary are required', 400);
    }

    if (req.user) {
      try {
        validateWarehouseScope(req.user, targetWarehouseId);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    const employeeStatus = status || 'ACTIVE';
    const isActive = employeeStatus === 'ACTIVE';

    const insertRes = await query(`
      INSERT INTO employees (warehouse_id, full_name, national_id, phone, position, base_salary, status, active, hire_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      targetWarehouseId,
      fullName.trim(),
      nationalId.trim(),
      phone ? phone.trim() : '',
      position.trim(),
      Number(baseSalary),
      employeeStatus,
      isActive,
      hireDate || new Date().toISOString().substring(0, 10),
    ]);

    const employee = insertRes.rows[0];
    await logAudit(req.user, 'EMPLOYEE_CREATED', 'EMPLOYEE', employee.id, `Registered employee ${fullName} (${position}) with base salary ${baseSalary} DA`, targetWarehouseId);
    
    return sendSuccess(res, {
      id: employee.id,
      warehouseId: employee.warehouse_id,
      fullName: employee.full_name,
      nationalId: employee.national_id,
      phone: employee.phone,
      position: employee.position,
      baseSalary: Number(employee.base_salary),
      status: employee.status,
      active: employee.active,
      hireDate: employee.hire_date,
      createdAt: employee.created_at,
    }, 'Employee registered successfully', 201);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// 7. PUT /employees/:id - Update employee details & status
router.put('/:id', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { warehouseId, fullName, nationalId, phone, position, baseSalary, hireDate, status, active } = req.body;

    const currentRes = await query('SELECT * FROM employees WHERE id = $1', [id]);
    const current = currentRes.rows[0];
    if (!current) return sendError(res, `Employee not found with id ${id}`, 404);

    if (req.user) {
      try {
        validateWarehouseScope(req.user, current.warehouse_id);
      } catch (err: any) {
        return sendError(res, err.message, 403);
      }
    }

    const updatedWarehouseId = warehouseId ? Number(warehouseId) : current.warehouse_id;
    const updatedName = (fullName !== undefined ? fullName : current.full_name).trim();
    const updatedNatId = (nationalId !== undefined ? nationalId : current.national_id).trim();
    const updatedPhone = phone !== undefined ? phone.trim() : current.phone;
    const updatedPos = (position !== undefined ? position : current.position).trim();
    const updatedSalary = baseSalary !== undefined ? Number(baseSalary) : Number(current.base_salary);
    const updatedHireDate = hireDate || current.hire_date;

    let updatedStatus = current.status || (current.active ? 'ACTIVE' : 'TERMINATED');
    if (status !== undefined) {
      updatedStatus = status;
    } else if (active !== undefined) {
      updatedStatus = active ? 'ACTIVE' : 'TERMINATED';
    }
    const updatedActive = updatedStatus === 'ACTIVE';

    const updateRes = await query(`
      UPDATE employees
      SET warehouse_id = $1, full_name = $2, national_id = $3, phone = $4,
          position = $5, base_salary = $6, status = $7, active = $8, hire_date = $9
      WHERE id = $10
      RETURNING *
    `, [
      updatedWarehouseId,
      updatedName,
      updatedNatId,
      updatedPhone,
      updatedPos,
      updatedSalary,
      updatedStatus,
      updatedActive,
      updatedHireDate,
      id,
    ]);

    const updated = updateRes.rows[0];
    await logAudit(
      req.user,
      'EMPLOYEE_UPDATED',
      'EMPLOYEE',
      id,
      `Updated employee ${updatedName} (status: ${updatedStatus}, salary: ${updatedSalary} DA)`,
      updatedWarehouseId
    );

    return sendSuccess(res, {
      id: updated.id,
      warehouseId: updated.warehouse_id,
      fullName: updated.full_name,
      nationalId: updated.national_id,
      phone: updated.phone,
      position: updated.position,
      baseSalary: Number(updated.base_salary),
      status: updated.status,
      active: updated.active,
      hireDate: updated.hire_date,
      createdAt: updated.created_at,
    }, 'Employee updated successfully');
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

export default router;
