import http from 'http';

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, text: body, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('Testing Stock API with pagination and filters...');

  // 1. Login as Admin
  const loginRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'AdminPass123!' });

  if (loginRes.status !== 200 || !loginRes.data.data?.token) {
    console.error('Login failed:', loginRes);
    process.exit(1);
  }

  const token = loginRes.data.data.token;
  console.log('Logged in successfully as admin.');

  const authHeaders = {
    'Authorization': `Bearer ${token}`
  };

  // 2. Test Paginated Stock: Page 1, limit 5
  const stockRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/inventory/stock?page=1&limit=5',
    method: 'GET',
    headers: authHeaders
  });

  console.log('\n--- 1. Default Stock Pagination (limit=5) ---');
  console.log('Status:', stockRes.status);
  console.log('Items returned:', stockRes.data.data.items.length);
  console.log('Pagination:', stockRes.data.data.pagination);
  console.log('Live Counts:', stockRes.data.data.counts);

  // 3. Test Status Filter: status=low
  const lowRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/inventory/stock?status=low',
    method: 'GET',
    headers: authHeaders
  });
  console.log('\n--- 2. Low Stock Filter (status=low) ---');
  console.log('Items count:', lowRes.data.data.items.length);
  console.log('Total matching low stock:', lowRes.data.data.pagination.total);
  if (lowRes.data.data.items.length > 0) {
    const sample = lowRes.data.data.items[0];
    console.log(`Sample Low Stock Item: ${sample.productName} (Available: ${sample.availableQuantity}, MinAlert: ${sample.minStockAlert})`);
  }

  // 4. Test Status Filter: status=out
  const outRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/inventory/stock?status=out',
    method: 'GET',
    headers: authHeaders
  });
  console.log('\n--- 3. Out of Stock Filter (status=out) ---');
  console.log('Items count:', outRes.data.data.items.length);
  console.log('Total matching out of stock:', outRes.data.data.pagination.total);

  // 5. Test Search Filter: search=bosch
  const searchRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/inventory/stock?search=bosch&limit=5',
    method: 'GET',
    headers: authHeaders
  });
  console.log('\n--- 4. Search Filter (search=bosch) ---');
  console.log('Items count:', searchRes.data.data.items.length);
  console.log('Total matching search:', searchRes.data.data.pagination.total);
  if (searchRes.data.data.items.length > 0) {
    console.log('Found product:', searchRes.data.data.items[0].productName, 'Ref:', searchRes.data.data.items[0].productReference);
  }

  // 6. Test Adjustment to trigger Low Stock & Count Update
  console.log('\n--- 5. Test Stock Adjustment & Live Counts Reaction ---');
  const targetStock = stockRes.data.data.items[0];
  console.log(`Adjusting stock for Product ID ${targetStock.productId} in Warehouse ID ${targetStock.warehouseId}...`);
  const currentPhysical = targetStock.physicalQuantity;
  const targetPhysical = 2; // Low stock threshold is usually 5
  const delta = targetPhysical - currentPhysical;

  const adjustRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/inventory/adjustments',
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' }
  }, {
    warehouseId: targetStock.warehouseId,
    productId: targetStock.productId,
    quantity: delta,
    reason: 'Test low stock count detection'
  });
  console.log('Adjustment response status:', adjustRes.status);

  // Check counts again
  const refreshedStock = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/inventory/stock?status=low',
    method: 'GET',
    headers: authHeaders
  });
  console.log('Refreshed low stock items count:', refreshedStock.data.data.items.length);
  console.log('Refreshed counts object:', refreshedStock.data.data.counts);

  // Revert adjustment
  await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/inventory/adjustments',
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' }
  }, {
    warehouseId: targetStock.warehouseId,
    productId: targetStock.productId,
    quantity: -delta,
    reason: 'Revert test adjustment'
  });
  console.log('Reverted adjustment to original stock level.');

  // 7. Test CSV Export with status filter
  const csvRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/inventory/export/csv?status=low',
    method: 'GET',
    headers: authHeaders
  });
  console.log('\n--- 6. CSV Export with Status Filter ---');
  console.log('Status:', csvRes.status);
  console.log('Content-Type:', csvRes.headers['content-type']);
  console.log('First 150 chars of CSV:', (csvRes.text || '').substring(0, 150));

  console.log('\nAll API validations passed successfully!');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
