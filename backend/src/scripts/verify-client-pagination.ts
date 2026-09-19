import { query, ensureDatabaseExists } from '../db/database.js';
import { initSchema } from '../db/schema.js';
import clientRoutes from '../routes/client.routes.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { Response } from 'express';

function createMockContext(user: any, params: any = {}, queryParams: any = {}, body: any = {}) {
  let statusCode = 200;
  let responseData: any = null;

  const req = {
    user,
    params,
    query: queryParams,
    body,
  } as unknown as AuthRequest;

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
  } as unknown as Response;

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
}

function getRouteHandler(method: string, path: string) {
  const layer = (clientRoutes as any).stack.find(
    (l: any) => l.route && l.route.path === path && l.route.methods[method.toLowerCase()]
  );
  if (!layer) {
    throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
  }
  const routeStack = layer.route.stack;
  return routeStack[routeStack.length - 1].handle;
}

async function runVerification() {
  console.log('=== Verifying Client Pagination & Smart Loading ===');
  await ensureDatabaseExists();
  await initSchema();

  const adminUser = { id: 1, role: 'ADMIN', warehouse_id: 1 };

  // 1. Check Passager client exists
  const passagerRes = await query('SELECT * FROM clients WHERE is_default = TRUE LIMIT 1');
  if (passagerRes.rows.length === 0) {
    throw new Error('Default Passager client not found');
  }
  const passager = passagerRes.rows[0];
  console.log(`[PASS] Found default Passager client: ID=${passager.id}, Code=${passager.code}`);

  // 2. Check regular client exists
  const regularRes = await query('SELECT * FROM clients WHERE is_default = FALSE LIMIT 1');
  const regular = regularRes.rows[0] || passager;
  console.log(`[PASS] Found regular client: ID=${regular.id}, Code=${regular.code}`);

  // 3. Test GET /api/clients with skipKpis=true
  const getClientsHandler = getRouteHandler('get', '/');
  const listCtxSkip = createMockContext(adminUser, {}, { page: 1, limit: 10, skipKpis: 'true' });
  await getClientsHandler(listCtxSkip.req, listCtxSkip.res);
  const listSkipData = listCtxSkip.getData();

  if (listCtxSkip.getStatus() !== 200 || !listSkipData?.success) {
    throw new Error('Failed GET /api/clients with skipKpis=true');
  }
  if (listSkipData.data.kpis !== undefined) {
    throw new Error('Expected kpis to be undefined when skipKpis=true');
  }
  if (!listSkipData.data.pagination || listSkipData.data.pagination.limit !== 10) {
    throw new Error('Expected pagination with limit 10');
  }
  console.log('[PASS] GET /api/clients with skipKpis=true successfully skipped full-table KPI aggregation');

  // 4. Test GET /api/clients with skipKpis=false
  const listCtxKpis = createMockContext(adminUser, {}, { page: 1, limit: 10 });
  await getClientsHandler(listCtxKpis.req, listCtxKpis.res);
  const listKpisData = listCtxKpis.getData();
  if (!listKpisData?.data?.kpis || typeof listKpisData.data.kpis.totalClients !== 'number') {
    throw new Error('Expected kpis object when skipKpis=false');
  }
  console.log(`[PASS] GET /api/clients with full KPIs returned totalClients=${listKpisData.data.kpis.totalClients}`);

  // 5. Test Statement for Regular Client: Date defaults to Current Month
  const statementHandler = getRouteHandler('get', '/:id/statement');
  const regStatementCtx = createMockContext(adminUser, { id: String(regular.id) }, { page: 1, limit: 20 });
  await statementHandler(regStatementCtx.req, regStatementCtx.res);
  const regStmtData = regStatementCtx.getData();

  if (regStatementCtx.getStatus() !== 200 || !regStmtData?.success) {
    throw new Error('Failed GET /:id/statement for regular client');
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const expectedMonthStart = `${yyyy}-${mm}-01`;

  if (regular.id !== passager.id) {
    if (regStmtData.data.filter.startDate !== expectedMonthStart) {
      throw new Error(`Expected regular client startDate to default to ${expectedMonthStart}, got ${regStmtData.data.filter.startDate}`);
    }
    console.log(`[PASS] Regular client statement defaulted to current month: ${regStmtData.data.filter.startDate} to ${regStmtData.data.filter.endDate}`);
  }

  if (!regStmtData.data.pagination || regStmtData.data.pagination.limit !== 20) {
    throw new Error('Statement response missing pagination object');
  }
  console.log(`[PASS] Statement returned pagination metadata: total=${regStmtData.data.pagination.total}, totalPages=${regStmtData.data.pagination.totalPages}`);

  // 6. Test Statement for Passager Client: Date defaults to Today
  const passStatementCtx = createMockContext(adminUser, { id: String(passager.id) }, { page: 1, limit: 50 });
  await statementHandler(passStatementCtx.req, passStatementCtx.res);
  const passStmtData = passStatementCtx.getData();

  const dd = String(now.getDate()).padStart(2, '0');
  const expectedToday = `${yyyy}-${mm}-${dd}`;

  if (passStmtData.data.filter.startDate !== expectedToday || passStmtData.data.filter.endDate !== expectedToday) {
    throw new Error(`Expected Passager statement to default to today (${expectedToday}), got ${passStmtData.data.filter.startDate}`);
  }
  console.log(`[PASS] Passager client statement defaulted strictly to today: ${expectedToday}`);

  // 7. Test dynamic opening balance & warehouse-filtered running balance projection
  console.log('[TEST] Verifying dynamic opening balance and running balance projection under warehouse filters...');
  const testClientId = regular.id;
  const testWh1 = 1;
  const testWh2 = 2;
  const insertedTxIds: number[] = [];

  try {
    // Insert prior transaction for warehouse 1 (August)
    const tx1 = await query(
      `INSERT INTO client_transactions (client_id, warehouse_id, type, reference_type, debit, credit, running_balance, description, transaction_date, created_by)
       VALUES ($1, $2, 'SALE', 'INVOICE', 1000, 0, 1000, 'Test Prior WH1', '2026-08-15 10:00:00', $3) RETURNING id`,
      [testClientId, testWh1, adminUser.id]
    );
    insertedTxIds.push(tx1.rows[0].id);

    // Insert prior transaction for warehouse 2 (August)
    const tx2 = await query(
      `INSERT INTO client_transactions (client_id, warehouse_id, type, reference_type, debit, credit, running_balance, description, transaction_date, created_by)
       VALUES ($1, $2, 'SALE', 'INVOICE', 500, 0, 1500, 'Test Prior WH2', '2026-08-20 10:00:00', $3) RETURNING id`,
      [testClientId, testWh2, adminUser.id]
    );
    insertedTxIds.push(tx2.rows[0].id);

    // Insert current month transaction for warehouse 1 (September)
    const tx3 = await query(
      `INSERT INTO client_transactions (client_id, warehouse_id, type, reference_type, debit, credit, running_balance, description, transaction_date, created_by)
       VALUES ($1, $2, 'PAYMENT', 'PAYMENT', 0, 200, 1300, 'Test Current WH1', '2026-09-10 12:00:00', $3) RETURNING id`,
      [testClientId, testWh1, adminUser.id]
    );
    insertedTxIds.push(tx3.rows[0].id);

    // A. Query Statement for September with WH1 filter
    const stmtWh1Ctx = createMockContext(
      adminUser,
      { id: String(testClientId) },
      { startDate: '2026-09-01', endDate: '2026-09-30', warehouseId: String(testWh1), page: 1, limit: 10 }
    );
    await statementHandler(stmtWh1Ctx.req, stmtWh1Ctx.res);
    const stmtWh1Data = stmtWh1Ctx.getData();

    if (stmtWh1Ctx.getStatus() !== 200 || !stmtWh1Data?.success) {
      throw new Error(`Statement query failed with warehouseId filter: status=${stmtWh1Ctx.getStatus()}, data=${JSON.stringify(stmtWh1Data)}`);
    }
    // Expected opening balance for WH1 prior to Sept: 1000 - 0 = 1000
    if (Math.abs(stmtWh1Data.data.openingBalance - 1000) > 0.01) {
      throw new Error(`Expected WH1 opening balance 1000, got ${stmtWh1Data.data.openingBalance}`);
    }
    // Expected closing balance after tx3 (credit 200): 1000 - 200 = 800
    const tx3Row = stmtWh1Data.data.transactions.find((t: any) => t.id === tx3.rows[0].id);
    if (!tx3Row || Math.abs(tx3Row.runningBalance - 800) > 0.01) {
      throw new Error(`Expected projected running balance 800 for WH1, got ${tx3Row?.runningBalance}`);
    }
    console.log('[PASS] Dynamic opening balance and running balance projection correct with warehouseId=1 filter (opening: 1000, closing: 800)');

    // B. Query Statement for September across all warehouses
    const stmtAllCtx = createMockContext(
      adminUser,
      { id: String(testClientId) },
      { startDate: '2026-09-01', endDate: '2026-09-30', page: 1, limit: 10 }
    );
    await statementHandler(stmtAllCtx.req, stmtAllCtx.res);
    const stmtAllData = stmtAllCtx.getData();

    // Expected opening balance across all warehouses prior to Sept: 1000 + 500 = 1500
    if (Math.abs(stmtAllData.data.openingBalance - 1500) > 0.01) {
      throw new Error(`Expected global opening balance 1500, got ${stmtAllData.data.openingBalance}`);
    }
    const tx3GlobalRow = stmtAllData.data.transactions.find((t: any) => t.id === tx3.rows[0].id);
    if (!tx3GlobalRow || Math.abs(tx3GlobalRow.runningBalance - 1300) > 0.01) {
      throw new Error(`Expected global projected running balance 1300, got ${tx3GlobalRow?.runningBalance}`);
    }
    console.log('[PASS] Dynamic opening balance and running balance projection correct across all warehouses (opening: 1500, closing: 1300)');
  } finally {
    // Clean up temporary transactions
    if (insertedTxIds.length > 0) {
      await query(`DELETE FROM client_transactions WHERE id = ANY($1::int[])`, [insertedTxIds]);
      console.log(`[PASS] Cleaned up ${insertedTxIds.length} test transactions`);
    }
  }

  // 8. Test Invoices pagination
  const invoicesHandler = getRouteHandler('get', '/:id/invoices');
  const invCtx = createMockContext(adminUser, { id: String(regular.id) }, { page: 1, limit: 10 });
  await invoicesHandler(invCtx.req, invCtx.res);
  const invData = invCtx.getData();
  if (invCtx.getStatus() !== 200 || !invData?.data?.pagination) {
    throw new Error('Failed GET /:id/invoices with pagination');
  }
  console.log(`[PASS] Invoices endpoint returned paginated payload: total=${invData.data.pagination.total}`);

  // 9. Test Payments pagination
  const paymentsHandler = getRouteHandler('get', '/:id/payments');
  const payCtx = createMockContext(adminUser, { id: String(regular.id) }, { page: 1, limit: 10 });
  await paymentsHandler(payCtx.req, payCtx.res);
  const payData = payCtx.getData();
  if (payCtx.getStatus() !== 200 || !payData?.data?.pagination) {
    throw new Error('Failed GET /:id/payments with pagination');
  }
  console.log(`[PASS] Payments endpoint returned paginated payload: total=${payData.data.pagination.total}`);

  // 10. Test Combobox / Trigram Search
  const searchCtx = createMockContext(adminUser, {}, { search: 'Passager', limit: 5 });
  await getClientsHandler(searchCtx.req, searchCtx.res);
  const searchData = searchCtx.getData();
  if (searchCtx.getStatus() !== 200 || !searchData?.data?.items) {
    throw new Error('Search query on clients failed');
  }
  const hasPassager = searchData.data.items.some((c: any) => c.isDefault || c.name.toLowerCase().includes('passager') || c.name.toLowerCase().includes('comptoir'));
  if (!hasPassager) {
    throw new Error('Expected search for "Passager" to return Passager/Comptoir account');
  }
  console.log(`[PASS] Trigram / typeahead search returned matching accounts: count=${searchData.data.items.length}`);

  console.log('\n=== All Client Pagination & Smart Loading Verification Checks Passed Successfully! ===');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
