import { PoolClient } from 'pg';
import { query, runTransaction } from '../db/database.js';

export interface CreateReservationParams {
  fulfillmentLineId: number;
  warehouseId: number;
  productId: number;
  quantity: number;
  ttlHours?: number;
}

/**
 * Creates an atomic stock reservation with row-level locking (SELECT FOR UPDATE).
 * Enforces anti-overselling and synchronizes stock.reserved_quantity.
 */
export async function createStockReservation(
  client: PoolClient,
  params: CreateReservationParams
): Promise<{ reservationId: number; expiresAt: string }> {
  const { fulfillmentLineId, warehouseId, productId, quantity, ttlHours = 120 } = params;

  if (quantity <= 0) {
    throw new Error('Quantity to reserve must be greater than 0');
  }

  // 1. Lock stock row for this warehouse and product
  const stockRes = await client.query(
    'SELECT id, physical_quantity, reserved_quantity FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
    [warehouseId, productId]
  );

  let stock = stockRes.rows[0];
  if (!stock) {
    // If no stock record exists, insert one with 0 physical
    const insertStockRes = await client.query(
      'INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity, updated_at) VALUES ($1, $2, 0, 0, NOW()) RETURNING id, physical_quantity, reserved_quantity',
      [warehouseId, productId]
    );
    stock = insertStockRes.rows[0];
  }

  const physical = Number(stock.physical_quantity || 0);
  const reserved = Number(stock.reserved_quantity || 0);
  const available = physical - reserved;

  if (available < quantity) {
    throw new Error(`Stock insuffisant pour la réservation au dépôt (ID ${warehouseId}). Disponible : ${available}, Demandé : ${quantity}`);
  }

  // 2. Increment reserved_quantity atomically
  await client.query(
    'UPDATE stock SET reserved_quantity = reserved_quantity + $1, updated_at = NOW() WHERE id = $2',
    [quantity, stock.id]
  );

  // 3. Insert reservation record with TTL (default 120 hours)
  const resInsert = await client.query(`
    INSERT INTO stock_reservations (
      fulfillment_line_id, warehouse_id, product_id, reserved_quantity, status, expires_at, created_at
    ) VALUES ($1, $2, $3, $4, 'ACTIVE', NOW() + ($5 || ' hours')::interval, NOW())
    RETURNING id, expires_at
  `, [fulfillmentLineId, warehouseId, productId, quantity, Math.max(1, ttlHours)]);

  return {
    reservationId: resInsert.rows[0].id,
    expiresAt: resInsert.rows[0].expires_at,
  };
}

/**
 * Releases an active stock reservation (due to cancellation or expiration).
 * Decrements stock.reserved_quantity atomically and updates status.
 */
export async function releaseStockReservation(
  client: PoolClient,
  reservationId: number,
  newStatus: 'CANCELLED' | 'EXPIRED' = 'CANCELLED'
): Promise<boolean> {
  const resQuery = await client.query(
    'SELECT id, warehouse_id, product_id, reserved_quantity, status FROM stock_reservations WHERE id = $1 FOR UPDATE',
    [reservationId]
  );

  const reservation = resQuery.rows[0];
  if (!reservation || reservation.status !== 'ACTIVE') {
    return false;
  }

  const qty = Number(reservation.reserved_quantity || 0);

  // Lock and decrement stock.reserved_quantity
  const stockRes = await client.query(
    'SELECT id, reserved_quantity FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
    [reservation.warehouse_id, reservation.product_id]
  );

  if (stockRes.rows[0]) {
    await client.query(
      'UPDATE stock SET reserved_quantity = GREATEST(0, reserved_quantity - $1), updated_at = NOW() WHERE id = $2',
      [qty, stockRes.rows[0].id]
    );
  }

  await client.query(
    'UPDATE stock_reservations SET status = $1, cancelled_at = NOW() WHERE id = $2',
    [newStatus, reservationId]
  );

  return true;
}

/**
 * Fulfills an active reservation when goods are physically handed to the customer.
 * Decrements both physical_quantity and reserved_quantity, and marks reservation FULFILLED.
 */
export async function fulfillStockReservation(
  client: PoolClient,
  fulfillmentLineId: number
): Promise<{ warehouseId: number; productId: number; quantity: number }> {
  const resQuery = await client.query(
    'SELECT id, warehouse_id, product_id, reserved_quantity, status FROM stock_reservations WHERE fulfillment_line_id = $1 AND status = ' +
    "'ACTIVE' FOR UPDATE",
    [fulfillmentLineId]
  );

  const reservation = resQuery.rows[0];
  if (!reservation) {
    throw new Error(`No active stock reservation found for fulfillment line ID ${fulfillmentLineId}`);
  }

  const qty = Number(reservation.reserved_quantity);

  // Lock stock row and deduct both physical and reserved
  const stockRes = await client.query(
    'SELECT id, physical_quantity, reserved_quantity FROM stock WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE',
    [reservation.warehouse_id, reservation.product_id]
  );

  if (!stockRes.rows[0]) {
    throw new Error(`Stock record not found for warehouse ${reservation.warehouse_id} and product ${reservation.product_id}`);
  }

  await client.query(
    'UPDATE stock SET physical_quantity = GREATEST(0, physical_quantity - $1), reserved_quantity = GREATEST(0, reserved_quantity - $1), updated_at = NOW() WHERE id = $2',
    [qty, stockRes.rows[0].id]
  );

  await client.query(
    "UPDATE stock_reservations SET status = 'FULFILLED', fulfilled_at = NOW() WHERE id = $1",
    [reservation.id]
  );

  return {
    warehouseId: reservation.warehouse_id,
    productId: reservation.product_id,
    quantity: qty,
  };
}

/**
 * Reassigns an active reservation from one warehouse to another.
 * Atomically releases the old reservation and locks/reserves at the new warehouse.
 */
export async function reassignReservationWarehouse(
  client: PoolClient,
  fulfillmentLineId: number,
  newWarehouseId: number,
  ttlHours: number = 120
): Promise<{ newReservationId: number; expiresAt: string }> {
  // Find current active reservation
  const resQuery = await client.query(
    "SELECT id, warehouse_id, product_id, reserved_quantity FROM stock_reservations WHERE fulfillment_line_id = $1 AND status = 'ACTIVE' FOR UPDATE",
    [fulfillmentLineId]
  );

  const oldRes = resQuery.rows[0];
  if (!oldRes) {
    throw new Error(`No active reservation found for fulfillment line ID ${fulfillmentLineId}`);
  }

  const qty = Number(oldRes.reserved_quantity);
  const productId = oldRes.product_id;

  // Release old reservation
  await releaseStockReservation(client, oldRes.id, 'CANCELLED');

  // Create new reservation at new warehouse
  const newRes = await createStockReservation(client, {
    fulfillmentLineId,
    warehouseId: newWarehouseId,
    productId,
    quantity: qty,
    ttlHours,
  });

  return {
    newReservationId: newRes.reservationId,
    expiresAt: newRes.expiresAt,
  };
}

/**
 * Sweeps and auto-expires all overdue reservations (where status = 'ACTIVE' AND expires_at < NOW()).
 * Releases stock and sets fulfillment_lines to 'EXPIRED'.
 */
export async function checkAndExpireReservations(): Promise<number> {
  return await runTransaction(async (client) => {
    const overdueRes = await client.query(`
      SELECT r.id, r.fulfillment_line_id, r.warehouse_id, r.product_id, r.reserved_quantity
      FROM stock_reservations r
      WHERE r.status = 'ACTIVE' AND r.expires_at < NOW()
      FOR UPDATE
    `);

    let expiredCount = 0;
    for (const row of overdueRes.rows) {
      await releaseStockReservation(client, row.id, 'EXPIRED');

      if (row.fulfillment_line_id) {
        await client.query(`
          UPDATE sale_fulfillment_lines
          SET fulfillment_status = 'EXPIRED', updated_at = NOW()
          WHERE id = $1 AND fulfillment_status = 'PENDING_PICKUP'
        `, [row.fulfillment_line_id]);
      }
      expiredCount++;
    }

    return expiredCount;
  });
}
