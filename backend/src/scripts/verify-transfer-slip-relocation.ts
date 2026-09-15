import { query, ensureDatabaseExists } from '../db/database.js';
import { initSchema } from '../db/schema.js';
import transferRoutes from '../routes/transfer.routes.js';
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
  const layer = (transferRoutes as any).stack.find(
    (l: any) => l.route && l.route.path === path && l.route.methods[method.toLowerCase()]
  );
  if (!layer) {
    throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
  }
  const routeStack = layer.route.stack;
  return routeStack[routeStack.length - 1].handle;
}

async function runVerification() {
  console.log('=== Verifying Transfer Slip and Relocation Workflow ===');
  await ensureDatabaseExists();
  await initSchema();

  // 1. Fetch available warehouses and product
  const whRes = await query('SELECT id, name, code, active FROM warehouses WHERE active = true ORDER BY id LIMIT 2');
  if (whRes.rows.length < 2) {
    throw new Error('At least 2 active warehouses required for testing');
  }
  const sourceWh = whRes.rows[0];
  const destWh = whRes.rows[1];
  console.log(`Source Warehouse: ${sourceWh.name} (ID: ${sourceWh.id})`);
  console.log(`Destination Warehouse: ${destWh.name} (ID: ${destWh.id})`);

  const prodRes = await query('SELECT id, name, reference FROM products ORDER BY id LIMIT 1');
  if (prodRes.rows.length === 0) {
    throw new Error('At least 1 product required for testing');
  }
  const product = prodRes.rows[0];
  console.log(`Test Product: ${product.name} (ID: ${product.id}, Ref: ${product.reference})`);

  // Ensure stock exists at source warehouse
  const stockCheck = await query('SELECT * FROM stock WHERE warehouse_id = $1 AND product_id = $2', [sourceWh.id, product.id]);
  if (stockCheck.rows.length === 0 || Number(stockCheck.rows[0].physical_quantity) < 10) {
    await query(`
      INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity)
      VALUES ($1, $2, 100, 0)
      ON CONFLICT (warehouse_id, product_id)
      DO UPDATE SET physical_quantity = GREATEST(stock.physical_quantity, 100)
    `, [sourceWh.id, product.id]);
  }

  const adminUser = { id: 1, role: 'ADMIN', full_name: 'Admin Test' };
  const destUser = { id: 2, role: 'MANAGER', warehouseId: destWh.id, full_name: 'Dest Manager' };
  const sourceUser = { id: 3, role: 'MANAGER', warehouseId: sourceWh.id, full_name: 'Source Manager' };

  // 2. Test Bulk Relocation
  console.log('\n--- Test 1: Bulk Relocation (Pre-Approved with Destination Arrival Confirmation Only) ---');
  const bulkRelocHandler = getRouteHandler('post', '/bulk-relocation');
  const relocCtx = createMockContext(adminUser, {}, {}, {
    sourceWarehouseId: sourceWh.id,
    distributions: [
      {
        destinationWarehouseId: destWh.id,
        items: [{ productId: product.id, quantity: 5 }],
      },
    ],
    notes: 'Test Automated Relocation',
  });

  await bulkRelocHandler(relocCtx.req, relocCtx.res);
  const relocStatus = relocCtx.getStatus();
  const relocData = relocCtx.getData();

  console.log(`Bulk Relocation HTTP Status: ${relocStatus}`);
  if (relocStatus !== 201 || !relocData.success) {
    throw new Error(`Bulk relocation failed: ${JSON.stringify(relocData)}`);
  }

  const createdTransfer = relocData.data.transfers[0];
  console.log(`Created Transfer Number: ${createdTransfer.transferNumber}`);
  console.log(`Created Transfer Status: ${createdTransfer.status} (Expected: APPROVED)`);
  if (createdTransfer.status !== 'APPROVED') {
    throw new Error(`Expected status APPROVED, got ${createdTransfer.status}`);
  }

  // Verify item manifest on created transfer
  const relocItem = createdTransfer.items[0];
  console.log(`Item in response: Ref="${relocItem.productReference}", Name="${relocItem.productName}", ApprovedQty=${relocItem.approvedQuantity}`);
  if (relocItem.approvedQuantity !== 5) {
    throw new Error(`Expected approvedQuantity 5, got ${relocItem.approvedQuantity}`);
  }

  // Verify destination notification
  const notifRes = await query(
    'SELECT * FROM notifications WHERE warehouse_id = $1 AND type = $2 ORDER BY id DESC LIMIT 1',
    [destWh.id, 'TRANSFER_APPROVED']
  );
  console.log(`Destination notification received: ${notifRes.rows.length > 0 ? 'YES' : 'NO'}`);
  if (notifRes.rows.length === 0) {
    throw new Error('Expected TRANSFER_APPROVED notification for destination warehouse');
  }

  // 3. Confirm Arrival of Relocation Transfer
  console.log('\n--- Test 2: Destination Confirms Arrival of Relocated Stock ---');
  const confirmHandler = getRouteHandler('post', '/:id/confirm');
  const confirmCtx = createMockContext(destUser, { id: String(createdTransfer.id) });

  await confirmHandler(confirmCtx.req, confirmCtx.res);
  const confirmStatus = confirmCtx.getStatus();
  const confirmData = confirmCtx.getData();
  console.log(`Confirm HTTP Status: ${confirmStatus}`);
  if (confirmStatus !== 200 || !confirmData.success) {
    throw new Error(`Confirm failed: ${JSON.stringify(confirmData)}`);
  }
  console.log(`Transfer Confirmed Status: ${confirmData.data.status} (Expected: CONFIRMED)`);

  // 4. Test Standard Transfer Workflow
  console.log('\n--- Test 3: Standard Transfer Workflow (REQUESTED -> APPROVED -> CONFIRMED) ---');
  const createTransferHandler = getRouteHandler('post', '/');
  const createCtx = createMockContext(destUser, {}, {}, {
    sourceWarehouseId: sourceWh.id,
    destinationWarehouseId: destWh.id,
    notes: 'Standard transfer test',
    items: [{ productId: product.id, requestedQuantity: 3 }],
  });

  await createTransferHandler(createCtx.req, createCtx.res);
  const createStatus = createCtx.getStatus();
  const createData = createCtx.getData();
  console.log(`Standard transfer creation status: ${createStatus}, Transfer ID: ${createData.data.id}`);

  // Source approves
  const approveHandler = getRouteHandler('post', '/:id/approve');
  const approveCtx = createMockContext(sourceUser, { id: String(createData.data.id) }, {}, {
    items: [{ productId: product.id, approvedQuantity: 3 }],
  });

  await approveHandler(approveCtx.req, approveCtx.res);
  const approveStatus = approveCtx.getStatus();
  const approveData = approveCtx.getData();
  console.log(`Standard transfer approval status: ${approveStatus}, Status: ${approveData.data.status} (Expected: APPROVED)`);

  // Verify transfer details endpoint returns approved_quantity
  const getTransferHandler = getRouteHandler('get', '/:id');
  const getCtx = createMockContext(adminUser, { id: String(createData.data.id) });
  await getTransferHandler(getCtx.req, getCtx.res);
  const fetchedTransfer = getCtx.getData().data;
  console.log(`Fetched transfer items: Ref=${fetchedTransfer.items[0].productReference}, ApprovedQty=${fetchedTransfer.items[0].approvedQuantity}`);
  if (fetchedTransfer.items[0].approvedQuantity !== 3) {
    throw new Error(`Expected approvedQuantity 3, got ${fetchedTransfer.items[0].approvedQuantity}`);
  }

  // Dest confirms arrival
  const stdConfirmCtx = createMockContext(destUser, { id: String(createData.data.id) });
  await confirmHandler(stdConfirmCtx.req, stdConfirmCtx.res);
  console.log(`Standard transfer confirmation status: ${stdConfirmCtx.getStatus()}`);

  console.log('\n=== ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
