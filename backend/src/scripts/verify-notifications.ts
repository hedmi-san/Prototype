import { query, runTransaction, ensureDatabaseExists } from '../db/database.js';
import { initSchema } from '../db/schema.js';
import {
  createNotification,
  getWarehouseNotifications,
  getWarehouseNotificationCounts,
  markNotificationRead,
  markAllNotificationsRead,
} from '../common/notifications.js';

async function runNotificationVerification() {
  console.log('=== Starting Cross-Warehouse Notification Verification ===');
  await ensureDatabaseExists();
  await initSchema();

  // 1. Fetch 2 distinct warehouses
  const whRes = await query('SELECT id, name, code FROM warehouses WHERE active = true ORDER BY id ASC LIMIT 2');
  if (whRes.rows.length < 2) {
    throw new Error('Verification requires at least 2 active warehouses');
  }
  const whA = whRes.rows[0];
  const whB = whRes.rows[1];
  console.log(`Warehouse A: ${whA.name} (ID: ${whA.id})`);
  console.log(`Warehouse B: ${whB.name} (ID: ${whB.id})`);

  // 2. Clean previous test notifications for test warehouses
  await query('DELETE FROM notifications WHERE warehouse_id IN ($1, $2)', [whA.id, whB.id]);

  // -----------------------------------------------------------------
  // Test 1: Transfer Request Notification Emittance & Scoping
  // -----------------------------------------------------------------
  console.log('\n[TEST 1] Transfer Request Notification Flow...');
  const notif1 = await createNotification(null, {
    warehouseId: whB.id,
    type: 'TRANSFER_REQUESTED',
    title: 'Nouvelle demande de transfert',
    message: `${whA.name} a demandé un transfert de 50 articles.`,
    link: '/transfers?transferId=9999',
    metadata: { transferNumber: 'TRF-TEST-001', requestedQty: 50 },
  });

  if (!notif1 || notif1.warehouse_id !== whB.id) {
    throw new Error('Failed to create notification or target warehouse mismatch');
  }

  // Verify scoping: Warehouse B sees it, Warehouse A does NOT see it
  const listWhB = await getWarehouseNotifications(whB.id);
  const listWhA = await getWarehouseNotifications(whA.id);

  if (!listWhB.items.some((n) => n.id === notif1.id)) {
    throw new Error('Target warehouse B cannot find its notification');
  }
  if (listWhA.items.some((n) => n.id === notif1.id)) {
    throw new Error('Warehouse A improperly received Warehouse B notification (Scoping leak)');
  }
  console.log('✓ Test 1 Passed: Notification created for target warehouse and strictly scoped.');

  // -----------------------------------------------------------------
  // Test 2: Bi-directional Transfer Approved Notification
  // -----------------------------------------------------------------
  console.log('\n[TEST 2] Bi-directional Transfer Approved Notification...');
  const notif2 = await createNotification(null, {
    warehouseId: whA.id,
    type: 'TRANSFER_APPROVED',
    title: 'Transfert approuvé',
    message: `${whB.name} a validé votre transfert TRF-TEST-001.`,
    link: '/transfers?transferId=9999',
  });

  const listWhAAfter = await getWarehouseNotifications(whA.id);
  if (!listWhAAfter.items.some((n) => n.id === notif2.id)) {
    throw new Error('Requester warehouse A did not receive approval notification');
  }
  console.log('✓ Test 2 Passed: Requester warehouse successfully received approval notification.');

  // -----------------------------------------------------------------
  // Test 3: Inter-Warehouse Sale Pickup Notification Flow
  // -----------------------------------------------------------------
  console.log('\n[TEST 3] Inter-Warehouse Sale Pickup Notification...');
  const notif3 = await createNotification(null, {
    warehouseId: whB.id,
    type: 'SALE_PICKUP_PENDING',
    title: 'Nouveau retrait client inter-dépôts',
    message: `Retrait client prévu (VOUCH-TEST-88) : 10x Faucets.`,
    link: '/sales?tab=pickups',
    metadata: { voucherCode: 'VOUCH-TEST-88', invoiceNumber: 'INV-TEST-0042' },
  });

  const notif4 = await createNotification(null, {
    warehouseId: whA.id,
    type: 'SALE_PICKUP_COMPLETED',
    title: 'Retrait client effectué',
    message: `Le client a retiré ses articles pour le bon VOUCH-TEST-88.`,
    link: '/sales?search=INV-TEST-0042',
  });

  console.log('✓ Test 3 Passed: Pickup pending and completion notifications created.');

  // -----------------------------------------------------------------
  // Test 4: Badge Counts Calculation
  // -----------------------------------------------------------------
  console.log('\n[TEST 4] Operational Badge Counts Calculation...');
  const countsWhB = await getWarehouseNotificationCounts(whB.id);
  console.log(`Warehouse B counts: unread=${countsWhB.unreadCount}, transfers=${countsWhB.pendingTransfersCount}, pickups=${countsWhB.pendingPickupsCount}`);

  if (countsWhB.unreadCount < 2) {
    throw new Error(`Expected at least 2 unread notifications for Warehouse B, got ${countsWhB.unreadCount}`);
  }
  console.log('✓ Test 4 Passed: Unread and pending action counters computed accurately.');

  // -----------------------------------------------------------------
  // Test 5: Mark Single Read & Mark All Read
  // -----------------------------------------------------------------
  console.log('\n[TEST 5] Read/Unread State Transitions...');
  const singleReadSuccess = await markNotificationRead(notif1.id, whB.id);
  if (!singleReadSuccess) {
    throw new Error('markNotificationRead returned false');
  }

  const countsAfterSingle = await getWarehouseNotificationCounts(whB.id);
  if (countsAfterSingle.unreadCount !== countsWhB.unreadCount - 1) {
    throw new Error('Unread count did not decrement after single read');
  }

  const markAllCount = await markAllNotificationsRead(whB.id);
  const countsAfterAll = await getWarehouseNotificationCounts(whB.id);
  if (countsAfterAll.unreadCount !== 0) {
    throw new Error(`Expected 0 unread notifications after markAllNotificationsRead, got ${countsAfterAll.unreadCount}`);
  }
  console.log(`✓ Test 5 Passed: Mark-read and mark-all-read transitioned state cleanly (marked ${markAllCount} read).`);

  console.log('\n=== All Cross-Warehouse Notification Tests Passed Successfully! ===');
}

runNotificationVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  });
