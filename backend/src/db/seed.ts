import bcrypt from 'bcryptjs';
import { query, runTransaction } from './database.js';

export async function seedData(): Promise<void> {
  const seedSalesIfEmpty = async (client: any) => {
    const salesRes = await client.query('SELECT COUNT(*) as count FROM sales');
    const salesCount = Number(salesRes.rows[0].count);
    if (salesCount > 0) return;

    const now = new Date();
    const formatDate = (d: Date, timeStr = '10:30:00') => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day} ${timeStr}`;
    };

    const todayStr = formatDate(now, '11:15:00');
    const yestDate = new Date(now); yestDate.setDate(now.getDate() - 1);
    const yestStr = formatDate(yestDate, '14:20:00');
    const threeDaysAgo = new Date(now); threeDaysAgo.setDate(now.getDate() - 3);
    const threeDaysStr = formatDate(threeDaysAgo, '09:45:00');
    const fiveDaysAgo = new Date(now); fiveDaysAgo.setDate(now.getDate() - 5);
    const fiveDaysStr = formatDate(fiveDaysAgo, '16:10:00');
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 18);
    const lastMonthStr = formatDate(lastMonthDate, '13:00:00');
    const lastMonthDate2 = new Date(now.getFullYear(), now.getMonth() - 1, 24);
    const lastMonthStr2 = formatDate(lastMonthDate2, '15:30:00');
    const lastYearDate = new Date(now.getFullYear() - 1, now.getMonth(), 18);
    const lastYearStr = formatDate(lastYearDate, '10:00:00');

    const salesToInsert = [
      { id: 1, inv: 'INV-20260818-01', wh: 1, u: 2, clientId: 2, c: 'SARL Bâtiment Pro Alger', p: '+213 550 12 34 56', total: 56000.0, paid: 0.0, payStatus: 'UNPAID', dt: todayStr, item: { prod: 1, qty: 2, price: 28000.0, sub: 56000.0 } },
      { id: 2, inv: 'INV-20260818-02', wh: 3, u: 4, clientId: 3, c: 'Entreprise Travaux Constantine', p: '+213 553 99 88 77', total: 36500.0, paid: 36500.0, payStatus: 'PAID', dt: todayStr, item: { prod: 3, qty: 1, price: 36500.0, sub: 36500.0 } },
      { id: 3, inv: 'INV-20260817-01', wh: 1, u: 2, clientId: 4, c: 'Quincaillerie Centrale El Harrach', p: '+213 551 23 45 67', total: 55500.0, paid: 55500.0, payStatus: 'PAID', dt: yestStr, item: { prod: 4, qty: 3, price: 18500.0, sub: 55500.0 } },
      { id: 4, inv: 'INV-20260817-02', wh: 2, u: 3, clientId: 5, c: 'Chantier Ouest Oran', p: '+213 552 34 56 78', total: 125000.0, paid: 0.0, payStatus: 'UNPAID', dt: yestStr, item: { prod: 5, qty: 1, price: 125000.0, sub: 125000.0 } },
      { id: 5, inv: 'INV-20260815-01', wh: 1, u: 2, clientId: 1, c: 'Atelier Outillage Rouiba', p: '+213 550 45 67 89', total: 73000.0, paid: 73000.0, payStatus: 'PAID', dt: threeDaysStr, item: { prod: 3, qty: 2, price: 36500.0, sub: 73000.0 } },
      { id: 6, inv: 'INV-20260813-01', wh: 2, u: 3, clientId: 1, c: 'EURL BTPH Oran Centre', p: '+213 552 67 89 01', total: 49000.0, paid: 49000.0, payStatus: 'PAID', dt: fiveDaysStr, item: { prod: 2, qty: 2, price: 24500.0, sub: 49000.0 } },
      { id: 7, inv: 'INV-20260718-01', wh: 1, u: 2, clientId: 1, c: 'Coopérative Artisanat Alger', p: '+213 550 78 90 12', total: 140000.0, paid: 140000.0, payStatus: 'PAID', dt: lastMonthStr, item: { prod: 1, qty: 5, price: 28000.0, sub: 140000.0 } },
      { id: 8, inv: 'INV-20260724-01', wh: 3, u: 4, clientId: 1, c: 'Mohamed Bennani (Constantine)', p: '+213 540 19 87 11', total: 73000.0, paid: 73000.0, payStatus: 'PAID', dt: lastMonthStr2, item: { prod: 3, qty: 2, price: 36500.0, sub: 73000.0 } },
      { id: 9, inv: 'INV-20250818-01', wh: 2, u: 3, clientId: 1, c: 'Société Générale de Travaux Oran', p: '+213 552 89 01 23', total: 250000.0, paid: 250000.0, payStatus: 'PAID', dt: lastYearStr, item: { prod: 5, qty: 2, price: 125000.0, sub: 250000.0 } },
    ];

    for (const s of salesToInsert) {
      const inserted = await client.query(`
        INSERT INTO sales (invoice_number, warehouse_id, user_id, client_id, customer_name, customer_phone, total_amount, paid_amount, payment_status, status, sale_date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'COMPLETED', $10, $11, $12)
        RETURNING id
      `, [s.inv, s.wh, s.u, s.clientId, s.c, s.p, s.total, s.paid, s.payStatus, s.dt, s.dt, s.dt]);

      const saleId = inserted.rows[0].id;
      await client.query(`
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
        VALUES ($1, $2, $3, $4, $5)
      `, [saleId, s.item.prod, s.item.qty, s.item.price, s.item.sub]);

      // If registered client and not default walk-in, record initial ledger invoice entry
      if (s.clientId && s.clientId > 1) {
        await client.query(`
          INSERT INTO client_transactions (client_id, warehouse_id, type, reference_type, reference_id, debit, credit, running_balance, description, transaction_date, created_by, created_at)
          VALUES ($1, $2, 'INVOICE', 'SALES_INVOICE', $3, $4, 0, $4, $5, $6, $7, $6)
        `, [s.clientId, s.wh, saleId, s.total, `Vente outillage ${s.inv}`, s.dt, s.u]);

        if (s.paid > 0) {
          const payRes = await client.query(`
            INSERT INTO client_payments (payment_number, client_id, warehouse_id, amount, payment_method, payment_date, notes, created_by, created_at)
            VALUES ($1, $2, $3, $4, 'CASH', $5, $6, $7, $5)
            RETURNING id
          `, [`PAY-${s.inv.replace('INV-', '')}`, s.clientId, s.wh, s.paid, s.dt, `Paiement comptant ${s.inv}`, s.u]);
          const payId = payRes.rows[0].id;

          const transRes = await client.query(`
            INSERT INTO client_transactions (client_id, warehouse_id, type, reference_type, reference_id, debit, credit, running_balance, description, transaction_date, created_by, created_at)
            VALUES ($1, $2, 'PAYMENT', 'CLIENT_PAYMENT', $3, 0, $4, 0, $5, $6, $7, $6)
            RETURNING id
          `, [s.clientId, s.wh, payId, s.paid, `Règlement vente ${s.inv}`, s.dt, s.u]);
          const transId = transRes.rows[0].id;

          await client.query('UPDATE client_payments SET transaction_id = $1 WHERE id = $2', [transId, payId]);

          await client.query(`
            INSERT INTO payment_allocations (payment_id, sale_id, allocated_amount)
            VALUES ($1, $2, $3)
          `, [payId, saleId, s.paid]);
        }
      }
    }
  };

  const seedClientsIfEmpty = async (client: any) => {
    // Ensure default client exists and is marked as default
    await client.query(`
      INSERT INTO clients (code, name, phone, email, address, is_default, opening_balance, current_balance, active)
      VALUES ('CLT-COMPTOIR', 'Client Passager', 'N/A', '', 'Comptoir Vente Directe', TRUE, 0.0, 0.0, TRUE)
      ON CONFLICT (code) DO UPDATE SET is_default = TRUE;
    `);

    const clientsRes = await client.query('SELECT COUNT(*) as count FROM clients WHERE is_default = FALSE');
    const clientsCount = Number(clientsRes.rows[0].count);
    if (clientsCount > 0) return;

    const demoClients = [
      { code: 'CLT-0001', name: 'SARL Bâtiment Pro Alger', phone: '0550 12 34 56', email: 'contact@batiment-pro.dz', address: 'Alger', openingBalance: 0.0, currentBalance: 56000.0 },
      { code: 'CLT-0002', name: 'Entreprise Travaux Constantine', phone: '0553 99 88 77', email: 'direction@travaux-cst.dz', address: 'Zone Industrielle Didouche, Constantine', openingBalance: 100000.0, currentBalance: 86500.0 },
      { code: 'CLT-0003', name: 'Quincaillerie Centrale El Harrach', phone: '0551 23 45 67', email: 'quinc.harrach@gmail.com', address: 'El Harrach', openingBalance: 0.0, currentBalance: 0.0 },
      { code: 'CLT-0004', name: 'Chantier Ouest Oran', phone: '0552 34 56 78', email: 'appro@chantier-ouest.dz', address: 'Zone Industrielle Es Sénia, Oran', openingBalance: 50000.0, currentBalance: 175000.0 },
    ];

    for (const cl of demoClients) {
      await client.query(`
        INSERT INTO clients (code, name, phone, email, address, is_default, opening_balance, current_balance, active)
        VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7, TRUE)
        ON CONFLICT (code) DO NOTHING
      `, [cl.code, cl.name, cl.phone, cl.email, cl.address, cl.openingBalance, cl.currentBalance]);
    }
  };

  const roleRes = await query('SELECT COUNT(*) as count FROM roles');
  const roleCount = Number(roleRes.rows[0].count);
  if (roleCount > 0) {
    await runTransaction(async (client) => {
      await seedClientsIfEmpty(client);
      await seedSalesIfEmpty(client);
    });
    return;
  }

  await runTransaction(async (client) => {
    // 1. Roles
    await client.query(`
      INSERT INTO roles (id, name, description) VALUES
      (1, 'ADMIN', 'System Administrator'),
      (2, 'SUPER_MANAGER', 'Regional Super Manager'),
      (3, 'MANAGER', 'Warehouse Manager'),
      (4, 'ACCOUNTANT', 'Warehouse Accountant')
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query("SELECT setval(pg_get_serial_sequence('roles', 'id'), (SELECT COALESCE(MAX(id), 1) FROM roles))");

    // 2. Warehouses
    await client.query(`
      INSERT INTO warehouses (id, name, code, location, contact_number, active) VALUES
      (1, 'Algiers Central Hub', 'WH-ALG', 'Zone Industrielle Oued Smar, Alger', '+213 21 00 11 22', TRUE),
      (2, 'Oran West Distribution', 'WH-ORN', 'Zone Industrielle Es Sénia, Oran', '+213 41 22 33 44', TRUE),
      (3, 'Constantine East Hub', 'WH-CST', 'Zone Industrielle Didouche Mourad, Constantine', '+213 31 44 55 66', TRUE)
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query("SELECT setval(pg_get_serial_sequence('warehouses', 'id'), (SELECT COALESCE(MAX(id), 1) FROM warehouses))");

    // 3. Demo Users
    const salt = bcrypt.genSaltSync(10);
    const adminPass = bcrypt.hashSync('AdminPass123!', salt);
    const managerPass = bcrypt.hashSync('ManagerPass123!', salt);
    const superPass = bcrypt.hashSync('SuperPass123!', salt);
    const accountantPass = bcrypt.hashSync('AccountantPass123!', salt);

    await client.query(`
      INSERT INTO users (id, username, password_hash, full_name, role_id, warehouse_id, active) VALUES
      (1, 'admin', $1, 'Administrator DZ', 1, NULL, TRUE),
      (2, 'manager_algiers', $2, 'Amine Khelifi (Algiers)', 3, 1, TRUE),
      (3, 'super_oran', $3, 'Karim Benali (Oran)', 2, 2, TRUE),
      (4, 'accountant_constantine', $4, 'Samir Brahimi (Constantine)', 4, 3, TRUE),
      (5, 'supermanager', $5, 'Super Regional Inspector', 2, NULL, TRUE)
      ON CONFLICT (id) DO NOTHING
    `, [adminPass, managerPass, superPass, accountantPass, superPass]);
    await client.query("SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 1) FROM users))");

    // 4. Products
    await client.query(`
      INSERT INTO products (id, reference, name, brand, description, purchase_price, sale_price, min_stock_alert, unit, box_size, active) VALUES
      (1, 'BOSCH-GBH-226', 'Rotary Hammer GBH 2-26 DRE Professional', 'Bosch', 'Heavy-duty SDS Plus rotary hammer 800W', 21500.0, 28000.0, 5, 'PIECE', 6, TRUE),
      (2, 'MAKITA-DGA-504', 'Cordless Angle Grinder DGA504Z 18V', 'Makita', 'Brushless 125mm cordless angle grinder', 18500.0, 24500.0, 4, 'PIECE', 8, TRUE),
      (3, 'DEWALT-DCD-796', 'Compact Hammer Drill DCD796P2', 'DeWalt', '18V XR Li-Ion brushless compact combi drill', 29000.0, 36500.0, 6, 'PIECE', 4, TRUE),
      (4, 'STANLEY-STMT-74311', 'Socket Set 1/2 + 1/4 (120 Pcs)', 'Stanley', 'Professional mechanics chrome vanadium socket set', 14000.0, 18500.0, 8, 'PIECE', 10, TRUE),
      (5, 'HILTI-TE-50-AVR', 'Combihammer TE 50-AVR SDS Max', 'Hilti', 'Powerful SDS-max combihammer with AVR', 95000.0, 125000.0, 2, 'PIECE', 0, TRUE)
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query("SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT COALESCE(MAX(id), 1) FROM products))");

    // 5. Initial Stock & Movements
    const stockItems = [
      // Algiers Hub
      { wh: 1, prod: 1, qty: 25 },
      { wh: 1, prod: 2, qty: 30 },
      { wh: 1, prod: 3, qty: 15 },
      { wh: 1, prod: 4, qty: 40 },
      { wh: 1, prod: 5, qty: 8 },
      // Oran Hub
      { wh: 2, prod: 1, qty: 12 },
      { wh: 2, prod: 2, qty: 18 },
      { wh: 2, prod: 4, qty: 20 },
      // Constantine Hub
      { wh: 3, prod: 1, qty: 10 },
      { wh: 3, prod: 3, qty: 12 },
    ];

    for (const item of stockItems) {
      await client.query(`
        INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity)
        VALUES ($1, $2, $3, 0)
        ON CONFLICT (warehouse_id, product_id) DO UPDATE SET physical_quantity = EXCLUDED.physical_quantity
      `, [item.wh, item.prod, item.qty]);

      await client.query(`
        INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
        VALUES ($1, $2, 'INITIAL_STOCK', $3, 'INIT-FACTORY', 'Initial factory distribution')
      `, [item.wh, item.prod, item.qty]);
    }

    // 6. Demo Employees
    await client.query(`
      INSERT INTO employees (id, warehouse_id, full_name, national_id, phone, position, base_salary, active) VALUES
      (1, 1, 'Mourad Boualem', '1985160100223', '+213 550 11 22 33', 'Senior Logistics Coordinator', 65000.0, TRUE),
      (2, 1, 'Nadia Mansouri', '1992160100445', '+213 551 22 33 44', 'Inventory Clerk', 42000.0, TRUE),
      (3, 2, 'Rachid Belhadj', '1988310100556', '+213 552 33 44 55', 'Oran Warehouse Supervisor', 58000.0, TRUE),
      (4, 3, 'Tariq Zeroual', '1990250100778', '+213 553 44 55 66', 'Constantine Forklift Operator', 45000.0, TRUE)
      ON CONFLICT (id) DO NOTHING
    `);
    await client.query("SELECT setval(pg_get_serial_sequence('employees', 'id'), (SELECT COALESCE(MAX(id), 1) FROM employees))");

    // 7. Demo Expenses
    await client.query(`
      INSERT INTO expenses (warehouse_id, category, amount, description, expense_date) VALUES
      (1, 'Utilities', 18500.0, 'Electricity & HVAC bill for warehouse unit', '2026-08-01'),
      (1, 'Packaging', 12000.0, 'Pallets and heavy industrial wrapping stretch', '2026-08-05'),
      (2, 'Transportation', 25000.0, 'Regional courier freight costs', '2026-08-10'),
      (3, 'Maintenance', 9500.0, 'Hydraulic lift inspection and fluid replacement', '2026-08-12')
    `);

    // 8. Demo Salaries
    const currentPeriod = new Date().toISOString().substring(0, 7);
    await client.query(`
      INSERT INTO salaries (employee_id, warehouse_id, period, base_salary, bonus1, bonus2, total_amount, payment_date) VALUES
      (1, 1, $1, 65000.0, 5000.0, 0.0, 70000.0, '2026-08-01'),
      (2, 1, $1, 42000.0, 2000.0, 1000.0, 45000.0, '2026-08-01'),
      (3, 2, $1, 58000.0, 3000.0, 0.0, 61000.0, '2026-08-01')
    `, [currentPeriod]);

    // 10. Demo Clients and Initial Financial Ledgers
    const clientsToSeed = [
      { id: 1, code: 'CLT-COMPTOIR', name: 'Client Passager', phone: 'N/A', email: '', address: 'Comptoir Vente Directe', isDefault: true, openingBalance: 0.0, currentBalance: 0.0 },
      { id: 2, code: 'CLT-0001', name: 'SARL Bâtiment Pro Alger', phone: '0550 12 34 56', email: 'contact@batiment-pro.dz', address: 'Alger', isDefault: false, openingBalance: 0.0, currentBalance: 56000.0 },
      { id: 3, code: 'CLT-0002', name: 'Entreprise Travaux Constantine', phone: '0553 99 88 77', email: 'direction@travaux-cst.dz', address: 'Zone Industrielle Didouche, Constantine', isDefault: false, openingBalance: 100000.0, currentBalance: 86500.0 },
      { id: 4, code: 'CLT-0003', name: 'Quincaillerie Centrale El Harrach', phone: '0551 23 45 67', email: 'quinc.harrach@gmail.com', address: 'El Harrach', isDefault: false, openingBalance: 0.0, currentBalance: 0.0 },
      { id: 5, code: 'CLT-0004', name: 'Chantier Ouest Oran', phone: '0552 34 56 78', email: 'appro@chantier-ouest.dz', address: 'Zone Industrielle Es Sénia, Oran', isDefault: false, openingBalance: 50000.0, currentBalance: 175000.0 },
    ];

    for (const cl of clientsToSeed) {
      await client.query(`
        INSERT INTO clients (id, code, name, phone, email, address, is_default, opening_balance, current_balance, active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          is_default = EXCLUDED.is_default,
          opening_balance = EXCLUDED.opening_balance,
          current_balance = EXCLUDED.current_balance
      `, [cl.id, cl.code, cl.name, cl.phone, cl.email, cl.address, cl.isDefault, cl.openingBalance, cl.currentBalance]);
    }
    await client.query("SELECT setval(pg_get_serial_sequence('clients', 'id'), (SELECT COALESCE(MAX(id), 1) FROM clients))");

    // 11. Multi-Period Demo Sales
    await seedSalesIfEmpty(client);
  });
}
