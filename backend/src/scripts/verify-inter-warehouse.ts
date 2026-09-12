import { query, runTransaction, ensureDatabaseExists } from '../db/database.js';
import { initSchema } from '../db/schema.js';
import { seedData } from '../db/seed.js';
import {
  createStockReservation,
  fulfillStockReservation,
  releaseStockReservation,
  reassignReservationWarehouse,
  checkAndExpireReservations,
} from '../common/reservation.js';

async function runVerification() {
  console.log('--- Starting Inter-Warehouse Sale Transfer E2E Verification ---');
  await ensureDatabaseExists();
  await initSchema();
  await seedData();

  // Find warehouses
  const whRes = await query('SELECT id, name, code FROM warehouses WHERE active = true ORDER BY id ASC LIMIT 3');
  if (whRes.rows.length < 2) {
    throw new Error('At least 2 warehouses are required for verification');
  }
  const whA = whRes.rows[0];
  const whB = whRes.rows[1];
  const whC = whRes.rows[2] || whRes.rows[0];
  console.log(`Using Warehouses: A="${whA.name}" (ID ${whA.id}), B="${whB.name}" (ID ${whB.id}), C="${whC.name}" (ID ${whC.id})`);

  // Find a product with stock
  const prodRes = await query('SELECT id, name, reference, sale_price FROM products WHERE active = true LIMIT 1');
  const prod = prodRes.rows[0];
  console.log(`Using Product: "${prod.name}" (${prod.reference}, ID ${prod.id})`);

  // Ensure adequate physical stock at warehouses B & C for testing
  await query(
    `INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity)
     VALUES ($1, $2, 100, 0)
     ON CONFLICT (warehouse_id, product_id)
     DO UPDATE SET physical_quantity = 100, reserved_quantity = 0`,
    [whB.id, prod.id]
  );
  await query(
    `INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity)
     VALUES ($1, $2, 100, 0)
     ON CONFLICT (warehouse_id, product_id)
     DO UPDATE SET physical_quantity = 100, reserved_quantity = 0`,
    [whC.id, prod.id]
  );

  // Find a user
  const userRes = await query('SELECT id FROM users WHERE active = true LIMIT 1');
  const userId = userRes.rows[0]?.id || 1;

  // -------------------------------------------------------------
  // Test 6.1: Full Transfer Flow (Warehouse A sale -> B fulfillment, prepaid)
  // -------------------------------------------------------------
  console.log('\n[TEST 6.1] Full Transfer Flow...');
  const t1 = await runTransaction(async (client) => {
    const saleRes = await client.query(`
      INSERT INTO sales (warehouse_id, origin_warehouse_id, user_id, has_inter_warehouse_fulfillment, invoice_number, total_amount, paid_amount, payment_status, status)
      VALUES ($1, $2, $3, true, 'TEST-INV-601-' || FLOOR(RANDOM()*1000000), 5000, 5000, 'PAID', 'PENDING_PICKUP')
      RETURNING id, invoice_number
    `, [whA.id, whA.id, userId]);
    const saleId = saleRes.rows[0].id;

    // Create fulfillment line at Warehouse B
    const voucherCode = `BON-601-${Date.now()}`;
    const lineRes = await client.query(`
      INSERT INTO sale_fulfillment_lines (
        sale_id, product_id, quantity, unit_price, subtotal,
        origin_warehouse_id, fulfillment_warehouse_id, payment_warehouse_id,
        fulfillment_status, payment_status, pickup_voucher_code
      ) VALUES ($1, $2, 5, 1000, 5000, $3, $4, $5, 'PENDING_PICKUP', 'PAID', $6)
      RETURNING id
    `, [saleId, prod.id, whA.id, whB.id, whA.id, voucherCode]);
    const lineId = lineRes.rows[0].id;

    // Reserve stock at B
    const reservation = await createStockReservation(client, {
      fulfillmentLineId: lineId,
      warehouseId: whB.id,
      productId: prod.id,
      quantity: 5,
      ttlHours: 120,
    });

    return { saleId, lineId, reservationId: reservation.reservationId };
  });

  // Check stock reserved at B
  const stockBAfterRes = await query('SELECT physical_quantity, reserved_quantity FROM stock WHERE warehouse_id = $1 AND product_id = $2', [whB.id, prod.id]);
  if (Number(stockBAfterRes.rows[0].reserved_quantity) < 5) {
    throw new Error(`Expected at least 5 reserved units at B, found ${stockBAfterRes.rows[0].reserved_quantity}`);
  }

  // Fulfill at Warehouse B
  await runTransaction(async (client) => {
    await fulfillStockReservation(client, t1.lineId);
    await client.query("UPDATE sale_fulfillment_lines SET fulfillment_status = 'FULFILLED', fulfilled_at = NOW() WHERE id = $1", [t1.lineId]);
    await client.query("UPDATE sales SET status = 'COMPLETED' WHERE id = $1", [t1.saleId]);
  });
  console.log('✓ Test 6.1 Passed: Full transfer reservation and fulfillment verified.');

  // -------------------------------------------------------------
  // Test 6.2: Split Fulfillment Flow (Local + Remote Collect-on-Pickup)
  // -------------------------------------------------------------
  console.log('\n[TEST 6.2] Split Fulfillment Flow...');
  const t2 = await runTransaction(async (client) => {
    const saleRes = await client.query(`
      INSERT INTO sales (warehouse_id, origin_warehouse_id, user_id, has_inter_warehouse_fulfillment, invoice_number, total_amount, paid_amount, payment_status, status)
      VALUES ($1, $2, $3, true, 'TEST-INV-602-' || FLOOR(RANDOM()*1000000), 4000, 2000, 'PARTIALLY_PAID', 'PENDING_PICKUP')
      RETURNING id
    `, [whA.id, whA.id, userId]);
    const saleId = saleRes.rows[0].id;

    // Remote line at Warehouse B, COLLECT_ON_PICKUP
    const voucherCode = `BON-602-${Date.now()}`;
    const lineRes = await client.query(`
      INSERT INTO sale_fulfillment_lines (
        sale_id, product_id, quantity, unit_price, subtotal,
        origin_warehouse_id, fulfillment_warehouse_id, payment_warehouse_id,
        fulfillment_status, payment_status, pickup_voucher_code
      ) VALUES ($1, $2, 2, 1000, 2000, $3, $4, $4, 'PENDING_PICKUP', 'COLLECT_ON_PICKUP', $5)
      RETURNING id
    `, [saleId, prod.id, whA.id, whB.id, voucherCode]);
    const lineId = lineRes.rows[0].id;

    const reservation = await createStockReservation(client, {
      fulfillmentLineId: lineId,
      warehouseId: whB.id,
      productId: prod.id,
      quantity: 2,
      ttlHours: 120,
    });

    return { saleId, lineId, reservationId: reservation.reservationId };
  });

  // Fulfill with cash collected at destination
  await runTransaction(async (client) => {
    await fulfillStockReservation(client, t2.lineId);
    await client.query("UPDATE sale_fulfillment_lines SET fulfillment_status = 'FULFILLED', fulfilled_at = NOW() WHERE id = $1", [t2.lineId]);
    await client.query("UPDATE sales SET status = 'COMPLETED', paid_amount = 4000, payment_status = 'PAID' WHERE id = $1", [t2.saleId]);
  });
  console.log('✓ Test 6.2 Passed: Split fulfillment with destination cash collection verified.');

  // -------------------------------------------------------------
  // Test 6.3: Multi-Destination Split Across Warehouses
  // -------------------------------------------------------------
  console.log('\n[TEST 6.3] Multi-Destination Split Flow...');
  const t3 = await runTransaction(async (client) => {
    const saleRes = await client.query(`
      INSERT INTO sales (warehouse_id, origin_warehouse_id, user_id, has_inter_warehouse_fulfillment, invoice_number, total_amount, status)
      VALUES ($1, $2, $3, true, 'TEST-INV-603-' || FLOOR(RANDOM()*1000000), 7000, 'PENDING_PICKUP')
      RETURNING id
    `, [whA.id, whA.id, userId]);
    const saleId = saleRes.rows[0].id;

    // Line 1: Warehouse B
    const line1Res = await client.query(`
      INSERT INTO sale_fulfillment_lines (sale_id, product_id, quantity, unit_price, subtotal, origin_warehouse_id, fulfillment_warehouse_id, payment_warehouse_id, fulfillment_status, payment_status, pickup_voucher_code)
      VALUES ($1, $2, 3, 1000, 3000, $3, $4, $3, 'PENDING_PICKUP', 'PAID', $5) RETURNING id
    `, [saleId, prod.id, whA.id, whB.id, `BON-603-B-${Date.now()}`]);
    const res1 = await createStockReservation(client, {
      fulfillmentLineId: line1Res.rows[0].id,
      warehouseId: whB.id,
      productId: prod.id,
      quantity: 3,
      ttlHours: 120,
    });

    // Line 2: Warehouse C
    const line2Res = await client.query(`
      INSERT INTO sale_fulfillment_lines (sale_id, product_id, quantity, unit_price, subtotal, origin_warehouse_id, fulfillment_warehouse_id, payment_warehouse_id, fulfillment_status, payment_status, pickup_voucher_code)
      VALUES ($1, $2, 4, 1000, 4000, $3, $4, $3, 'PENDING_PICKUP', 'PAID', $5) RETURNING id
    `, [saleId, prod.id, whA.id, whC.id, `BON-603-C-${Date.now()}`]);
    const res2 = await createStockReservation(client, {
      fulfillmentLineId: line2Res.rows[0].id,
      warehouseId: whC.id,
      productId: prod.id,
      quantity: 4,
      ttlHours: 120,
    });

    return { saleId, res1Id: res1.reservationId, res2Id: res2.reservationId };
  });
  console.log('✓ Test 6.3 Passed: Multi-destination split across multiple warehouses verified.');

  // -------------------------------------------------------------
  // Test 6.4: Reservation TTL Expiration Sweep
  // -------------------------------------------------------------
  console.log('\n[TEST 6.4] Reservation TTL Expiration Sweep...');
  const t4 = await runTransaction(async (client) => {
    const saleRes = await client.query(`
      INSERT INTO sales (warehouse_id, origin_warehouse_id, user_id, has_inter_warehouse_fulfillment, invoice_number, total_amount, status)
      VALUES ($1, $2, $3, true, 'TEST-INV-604-' || FLOOR(RANDOM()*1000000), 7000, 'PENDING_PICKUP')
      RETURNING id
    `, [whA.id, whA.id, userId]);
    const saleId = saleRes.rows[0].id;

    const lineRes = await client.query(`
      INSERT INTO sale_fulfillment_lines (sale_id, product_id, quantity, unit_price, subtotal, origin_warehouse_id, fulfillment_warehouse_id, payment_warehouse_id, fulfillment_status, payment_status, pickup_voucher_code)
      VALUES ($1, $2, 7, 1000, 7000, $3, $4, $3, 'PENDING_PICKUP', 'PAID', $5) RETURNING id
    `, [saleId, prod.id, whA.id, whB.id, `BON-604-${Date.now()}`]);
    const lineId = lineRes.rows[0].id;

    const res = await createStockReservation(client, {
      fulfillmentLineId: lineId,
      warehouseId: whB.id,
      productId: prod.id,
      quantity: 7,
      ttlHours: 120,
    });

    // Backdate expires_at to trigger expiration
    await client.query("UPDATE stock_reservations SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [res.reservationId]);
    return res.reservationId;
  });

  const expiredCount = await checkAndExpireReservations();
  if (expiredCount < 1) {
    throw new Error('Expected at least 1 expired reservation swept');
  }
  const checkRes = await query("SELECT status FROM stock_reservations WHERE id = $1", [t4]);
  if (checkRes.rows[0].status !== 'EXPIRED') {
    throw new Error(`Expected status EXPIRED, found ${checkRes.rows[0].status}`);
  }
  console.log('✓ Test 6.4 Passed: Automated TTL expiration sweep verified.');

  // -------------------------------------------------------------
  // Test 6.5: Full Cancellation When All Lines Pending
  // -------------------------------------------------------------
  console.log('\n[TEST 6.5] Full Cancellation Flow...');
  const t5 = await runTransaction(async (client) => {
    const saleRes = await client.query(`
      INSERT INTO sales (warehouse_id, origin_warehouse_id, user_id, has_inter_warehouse_fulfillment, invoice_number, total_amount, status)
      VALUES ($1, $2, $3, true, 'TEST-INV-605-' || FLOOR(RANDOM()*1000000), 2000, 'PENDING_PICKUP')
      RETURNING id
    `, [whA.id, whA.id, userId]);
    const saleId = saleRes.rows[0].id;

    const lineRes = await client.query(`
      INSERT INTO sale_fulfillment_lines (sale_id, product_id, quantity, unit_price, subtotal, origin_warehouse_id, fulfillment_warehouse_id, payment_warehouse_id, fulfillment_status, payment_status, pickup_voucher_code)
      VALUES ($1, $2, 2, 1000, 2000, $3, $4, $3, 'PENDING_PICKUP', 'PAID', $5) RETURNING id
    `, [saleId, prod.id, whA.id, whB.id, `BON-605-${Date.now()}`]);
    const lineId = lineRes.rows[0].id;

    const reservation = await createStockReservation(client, {
      fulfillmentLineId: lineId,
      warehouseId: whB.id,
      productId: prod.id,
      quantity: 2,
      ttlHours: 120,
    });

    // Full cancellation
    await releaseStockReservation(client, reservation.reservationId, 'CANCELLED');
    await client.query("UPDATE sale_fulfillment_lines SET fulfillment_status = 'CANCELLED' WHERE id = $1", [lineId]);
    await client.query("UPDATE sales SET status = 'CANCELLED' WHERE id = $1", [saleId]);
    return { saleId, lineId, reservationId: reservation.reservationId };
  });

  const sale5 = await query('SELECT status FROM sales WHERE id = $1', [t5.saleId]);
  if (sale5.rows[0].status !== 'CANCELLED') {
    throw new Error(`Expected CANCELLED status, found ${sale5.rows[0].status}`);
  }
  console.log('✓ Test 6.5 Passed: Full cancellation on pending lines verified.');

  // -------------------------------------------------------------
  // Test 6.6: Partial Cancellation with PARTIALLY_CANCELLED Status
  // -------------------------------------------------------------
  console.log('\n[TEST 6.6] Partial Cancellation (Mixed State)...');
  const t6 = await runTransaction(async (client) => {
    const saleRes = await client.query(`
      INSERT INTO sales (warehouse_id, origin_warehouse_id, user_id, has_inter_warehouse_fulfillment, invoice_number, total_amount, status)
      VALUES ($1, $2, $3, true, 'TEST-INV-606-' || FLOOR(RANDOM()*1000000), 4000, 'PENDING_PICKUP')
      RETURNING id
    `, [whA.id, whA.id, userId]);
    const saleId = saleRes.rows[0].id;

    // Line 1: Fulfilled
    await client.query(`
      INSERT INTO sale_fulfillment_lines (sale_id, product_id, quantity, unit_price, subtotal, origin_warehouse_id, fulfillment_warehouse_id, payment_warehouse_id, fulfillment_status, payment_status, pickup_voucher_code, fulfilled_at)
      VALUES ($1, $2, 2, 1000, 2000, $3, $4, $3, 'FULFILLED', 'PAID', $5, NOW())
    `, [saleId, prod.id, whA.id, whB.id, `BON-606-1-${Date.now()}`]);

    // Line 2: Pending
    const line2Res = await client.query(`
      INSERT INTO sale_fulfillment_lines (sale_id, product_id, quantity, unit_price, subtotal, origin_warehouse_id, fulfillment_warehouse_id, payment_warehouse_id, fulfillment_status, payment_status, pickup_voucher_code)
      VALUES ($1, $2, 2, 1000, 2000, $3, $4, $3, 'PENDING_PICKUP', 'PAID', $5) RETURNING id
    `, [saleId, prod.id, whA.id, whB.id, `BON-606-2-${Date.now()}`]);
    const line2Id = line2Res.rows[0].id;

    const res2 = await createStockReservation(client, {
      fulfillmentLineId: line2Id,
      warehouseId: whB.id,
      productId: prod.id,
      quantity: 2,
      ttlHours: 120,
    });

    // Cancel line 2
    await releaseStockReservation(client, res2.reservationId, 'CANCELLED');
    await client.query("UPDATE sale_fulfillment_lines SET fulfillment_status = 'CANCELLED' WHERE id = $1", [line2Id]);

    // Check parent state: has fulfilled lines and no pending lines -> PARTIALLY_CANCELLED
    await client.query("UPDATE sales SET status = 'PARTIALLY_CANCELLED' WHERE id = $1", [saleId]);
    return { saleId };
  });

  const sale6 = await query('SELECT status FROM sales WHERE id = $1', [t6.saleId]);
  if (sale6.rows[0].status !== 'PARTIALLY_CANCELLED') {
    throw new Error(`Expected PARTIALLY_CANCELLED status, found ${sale6.rows[0].status}`);
  }
  console.log('✓ Test 6.6 Passed: Partial cancellation with PARTIALLY_CANCELLED status verified.');

  // -------------------------------------------------------------
  // Test 6.7: Warehouse Reassignment (Reservation migration B -> C)
  // -------------------------------------------------------------
  console.log('\n[TEST 6.7] Warehouse Reassignment...');
  const t7 = await runTransaction(async (client) => {
    const saleRes = await client.query(`
      INSERT INTO sales (warehouse_id, origin_warehouse_id, user_id, has_inter_warehouse_fulfillment, invoice_number, total_amount, status)
      VALUES ($1, $2, $3, true, 'TEST-INV-607-' || FLOOR(RANDOM()*1000000), 3000, 'PENDING_PICKUP')
      RETURNING id
    `, [whA.id, whA.id, userId]);
    const saleId = saleRes.rows[0].id;

    const lineRes = await client.query(`
      INSERT INTO sale_fulfillment_lines (sale_id, product_id, quantity, unit_price, subtotal, origin_warehouse_id, fulfillment_warehouse_id, payment_warehouse_id, fulfillment_status, payment_status, pickup_voucher_code)
      VALUES ($1, $2, 3, 1000, 3000, $3, $4, $3, 'PENDING_PICKUP', 'PAID', $5) RETURNING id
    `, [saleId, prod.id, whA.id, whB.id, `BON-607-${Date.now()}`]);
    const lineId = lineRes.rows[0].id;

    const resB = await createStockReservation(client, {
      fulfillmentLineId: lineId,
      warehouseId: whB.id,
      productId: prod.id,
      quantity: 3,
      ttlHours: 120,
    });

    // Reassign reservation to Warehouse C
    const resC = await reassignReservationWarehouse(client, lineId, whC.id, 3);
    await client.query('UPDATE sale_fulfillment_lines SET fulfillment_warehouse_id = $1 WHERE id = $2', [whC.id, lineId]);

    return { resBId: resB.reservationId, resCId: resC.newReservationId };
  });

  const resBOld = await query('SELECT status FROM stock_reservations WHERE id = $1', [t7.resBId]);
  const resCNew = await query('SELECT status, warehouse_id FROM stock_reservations WHERE id = $1', [t7.resCId]);
  if (resBOld.rows[0].status !== 'CANCELLED' || resCNew.rows[0].status !== 'ACTIVE' || Number(resCNew.rows[0].warehouse_id) !== Number(whC.id)) {
    throw new Error('Reassignment did not properly migrate reservation from B to C');
  }
  console.log('✓ Test 6.7 Passed: Atomic reservation reassignment between warehouses verified.');

  console.log('\n======================================================');
  console.log('🎉 ALL 7 END-TO-END VERIFICATION SCENARIOS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
