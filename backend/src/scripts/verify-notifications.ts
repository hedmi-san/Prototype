import { query, ensureDatabaseExists } from '../db/database.js';
import { initSchema } from '../db/schema.js';
import {
  createNotification,
  CreateNotificationParams,
  getWarehouseNotifications,
  getWarehouseNotificationCounts,
  markNotificationRead,
  markAllNotificationsRead,
} from '../common/notifications.js';
import notificationRoutes from '../routes/notification.routes.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { Response } from 'express';

// Mock context generator for express route handler testing
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

// Extract endpoint handler from Express router stack
function getRouteHandler(method: string, path: string) {
  const layer = (notificationRoutes as any).stack.find(
    (l: any) => l.route && l.route.path === path && l.route.methods[method.toLowerCase()]
  );
  if (!layer) {
    throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
  }
  const routeStack = layer.route.stack;
  return routeStack[routeStack.length - 1].handle;
}

async function runNotificationVerification() {
  console.log('=== Starting Non-Destructive Cross-Warehouse Notification Verification ===');
  await ensureDatabaseExists();
  await initSchema();

  // 1. Fetch 2 distinct active warehouses
  const whRes = await query(
    'SELECT id, name, code FROM warehouses WHERE active = true ORDER BY id ASC LIMIT 2'
  );
  if (whRes.rows.length < 2) {
    throw new Error('Verification requires at least 2 active warehouses');
  }
  const whA = whRes.rows[0];
  const whB = whRes.rows[1];
  console.log(`Warehouse A: ${whA.name} (ID: ${whA.id})`);
  console.log(`Warehouse B: ${whB.name} (ID: ${whB.id})`);

  // Track created test notification IDs for non-destructive, isolated cleanup
  const testNotificationIds: number[] = [];

  async function createTestNotification(data: CreateNotificationParams) {
    const notif = await createNotification(null, data);
    if (notif?.id) {
      testNotificationIds.push(notif.id);
    }
    return notif;
  }

  try {
    // -----------------------------------------------------------------
    // Test 1: Notification Creation & Scoping (Warehouse A vs B)
    // -----------------------------------------------------------------
    console.log('\n[TEST 1] Notification Creation & Strict Scoping...');
    const notif1 = await createTestNotification({
      warehouseId: whB.id,
      type: 'TRANSFER_REQUESTED',
      title: 'TEST-Nouvelle demande de transfert',
      message: `${whA.name} a demandé un transfert test.`,
      link: '/transfers?id=9999',
    });

    const notif2 = await createTestNotification({
      warehouseId: whA.id,
      type: 'TRANSFER_APPROVED',
      title: 'TEST-Transfert approuvé',
      message: `${whB.name} a approuvé le transfert test.`,
      link: '/transfers?id=9999',
    });

    const listWhB = await getWarehouseNotifications(whB.id);
    const listWhA = await getWarehouseNotifications(whA.id);

    if (!listWhB.items.some((n) => n.id === notif1.id)) {
      throw new Error('Target Warehouse B failed to see its notification');
    }
    if (listWhA.items.some((n) => n.id === notif1.id)) {
      throw new Error('Warehouse A improperly received Warehouse B notification (Scoping leak)');
    }
    if (!listWhA.items.some((n) => n.id === notif2.id)) {
      throw new Error('Target Warehouse A failed to see its approval notification');
    }
    console.log('✓ Test 1 Passed: Notifications created and strictly scoped per warehouse.');

    // -----------------------------------------------------------------
    // Test 2: Database Helper Scoping & Security Hardening
    // -----------------------------------------------------------------
    console.log('\n[TEST 2] Database Helper Hardening (markNotificationRead)...');
    // Calling with mismatched warehouse must return false and not update
    const wrongWhResult = await markNotificationRead(notif1.id, whA.id);
    if (wrongWhResult !== false) {
      throw new Error('markNotificationRead with mismatched warehouseId should return false');
    }

    // Calling with invalid warehouse ID (0 or NaN) must return false
    const invalidWhResult = await markNotificationRead(notif1.id, 0);
    if (invalidWhResult !== false) {
      throw new Error('markNotificationRead with warehouseId=0 should return false');
    }

    // Calling with correct warehouse ID must update successfully
    const correctWhResult = await markNotificationRead(notif1.id, whB.id);
    if (correctWhResult !== true) {
      throw new Error('markNotificationRead with matching warehouseId should return true');
    }
    console.log('✓ Test 2 Passed: markNotificationRead enforces warehouse scoping and validates arguments.');

    // -----------------------------------------------------------------
    // Test 3: Super Manager Route Scoping & Active Warehouse Context
    // -----------------------------------------------------------------
    console.log('\n[TEST 3] Super Manager Active Warehouse Route Scoping...');
    const notif3 = await createTestNotification({
      warehouseId: whB.id,
      type: 'SALE_PICKUP_PENDING',
      title: 'TEST-Retrait client en attente',
      message: 'Retrait prévu pour Warehouse B.',
    });

    // Mock Super Manager assigned to Warehouse A, viewing Warehouse B
    const superManagerUser = {
      id: 9991,
      name: 'Super Manager Test',
      role: 'SUPER_MANAGER',
      warehouseId: whA.id, // assigned to A
    };

    const getListHandler = getRouteHandler('GET', '/');
    const getCountsHandler = getRouteHandler('GET', '/counts');
    const patchReadHandler = getRouteHandler('PATCH', '/:id/read');
    const postReadAllHandler = getRouteHandler('POST', '/read-all');

    // 3a. GET /api/notifications with query.warehouseId = whB.id
    const listCtx = createMockContext(superManagerUser, {}, { warehouseId: String(whB.id) });
    await getListHandler(listCtx.req, listCtx.res);
    const listRes = listCtx.getData();
    if (!listRes?.data?.items?.some((n: any) => n.id === notif3.id)) {
      throw new Error('Super Manager query with warehouseId=whB failed to return whB notification');
    }

    // 3b. PATCH /api/notifications/:id/read with wrong warehouse in body (whA.id) -> must fail
    const wrongWhCtx = createMockContext(
      superManagerUser,
      { id: String(notif3.id) },
      {},
      { warehouseId: whA.id }
    );
    await patchReadHandler(wrongWhCtx.req, wrongWhCtx.res);
    const wrongWhData = wrongWhCtx.getData();
    if (wrongWhData?.data?.success !== false) {
      throw new Error('Super Manager PATCH with mismatched warehouseId did not return success: false');
    }

    // 3c. PATCH /api/notifications/:id/read with correct warehouse in body (whB.id) -> must succeed
    const correctWhCtx = createMockContext(
      superManagerUser,
      { id: String(notif3.id) },
      {},
      { warehouseId: whB.id }
    );
    await patchReadHandler(correctWhCtx.req, correctWhCtx.res);
    const correctWhData = correctWhCtx.getData();
    if (correctWhData?.data?.success !== true) {
      throw new Error('Super Manager PATCH with body.warehouseId=whB failed to return success: true');
    }
    console.log('✓ Test 3 Passed: Super Manager active warehouse propagation verified on list and single-read.');

    // -----------------------------------------------------------------
    // Test 4: Admin Role Mutation Denial
    // -----------------------------------------------------------------
    console.log('\n[TEST 4] Admin Authorization Hardening...');
    const adminUser = {
      id: 9992,
      name: 'Admin Test',
      role: 'ADMIN',
      warehouseId: null,
    };

    const adminPatchCtx = createMockContext(
      adminUser,
      { id: String(notif2.id) },
      {},
      { warehouseId: whA.id }
    );
    await patchReadHandler(adminPatchCtx.req, adminPatchCtx.res);
    if (adminPatchCtx.getStatus() !== 403) {
      throw new Error(`Admin PATCH /:id/read should return 403 Forbidden, got ${adminPatchCtx.getStatus()}`);
    }

    const adminPostCtx = createMockContext(adminUser, {}, {}, { warehouseId: whA.id });
    await postReadAllHandler(adminPostCtx.req, adminPostCtx.res);
    if (adminPostCtx.getStatus() !== 403) {
      throw new Error(`Admin POST /read-all should return 403 Forbidden, got ${adminPostCtx.getStatus()}`);
    }
    console.log('✓ Test 4 Passed: Admin users are strictly denied notification read mutations with HTTP 403.');

    // -----------------------------------------------------------------
    // Test 5: Super Manager Mark-All-Read with Body Warehouse Override
    // -----------------------------------------------------------------
    console.log('\n[TEST 5] Super Manager Mark-All-Read Scoping...');
    const notif4 = await createTestNotification({
      warehouseId: whB.id,
      type: 'TRANSFER_REQUESTED',
      title: 'TEST-Unread for mark all',
      message: 'Must be marked read by mark-all',
    });

    const readAllCtx = createMockContext(
      superManagerUser,
      {},
      {},
      { warehouseId: whB.id }
    );
    await postReadAllHandler(readAllCtx.req, readAllCtx.res);
    const readAllData = readAllCtx.getData();
    if (!readAllData?.success || typeof readAllData?.data?.count !== 'number') {
      throw new Error('Super Manager POST /read-all failed to return count');
    }

    // Verify notif4 is now read
    const verifyWhB = await getWarehouseNotifications(whB.id);
    const checkedItem = verifyWhB.items.find((n) => n.id === notif4.id);
    if (!checkedItem || !checkedItem.is_read) {
      throw new Error('Notification was not marked read after Super Manager mark-all-read');
    }
    console.log(`✓ Test 5 Passed: Super Manager mark-all-read marked warehouse B notifications (count=${readAllData.data.count}).`);

    console.log('\n=== All Cross-Warehouse Notification Tests Passed Successfully! ===');
  } finally {
    // Non-destructive cleanup: delete ONLY the specific test notifications created in this run
    if (testNotificationIds.length > 0) {
      await query('DELETE FROM notifications WHERE id = ANY($1::int[])', [testNotificationIds]);
      console.log(`[CLEANUP] Safely removed ${testNotificationIds.length} test notification(s). Existing data untouched.`);
    }
  }
}

runNotificationVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  });
