import bcrypt from 'bcryptjs';
import { db, runTransaction } from './database.js';
export function seedData() {
    const seedSalesIfEmpty = () => {
        const salesCount = db.prepare('SELECT COUNT(*) as count FROM sales').get().count;
        if (salesCount > 0)
            return;
        const insertSale = db.prepare(`
      INSERT INTO sales (id, invoice_number, warehouse_id, user_id, customer_name, customer_phone, total_amount, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)
    `);
        const insertItem = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);
        const now = new Date();
        const formatDate = (d, timeStr = '10:30:00') => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day} ${timeStr}`;
        };
        const todayStr = formatDate(now, '11:15:00');
        const yestDate = new Date(now);
        yestDate.setDate(now.getDate() - 1);
        const yestStr = formatDate(yestDate, '14:20:00');
        const threeDaysAgo = new Date(now);
        threeDaysAgo.setDate(now.getDate() - 3);
        const threeDaysStr = formatDate(threeDaysAgo, '09:45:00');
        const fiveDaysAgo = new Date(now);
        fiveDaysAgo.setDate(now.getDate() - 5);
        const fiveDaysStr = formatDate(fiveDaysAgo, '16:10:00');
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 18);
        const lastMonthStr = formatDate(lastMonthDate, '13:00:00');
        const lastMonthDate2 = new Date(now.getFullYear(), now.getMonth() - 1, 24);
        const lastMonthStr2 = formatDate(lastMonthDate2, '15:30:00');
        const lastYearDate = new Date(now.getFullYear() - 1, now.getMonth(), 18);
        const lastYearStr = formatDate(lastYearDate, '10:00:00');
        // Sale 1: Today (WH 1) - 56,000 DA
        insertSale.run(1, 'INV-20260818-01', 1, 2, 'SARL Bâtiment Pro Alger', '+213 550 12 34 56', 56000.0, todayStr, todayStr);
        insertItem.run(1, 1, 2, 28000.0, 56000.0);
        // Sale 2: Today (WH 3) - 36,500 DA
        insertSale.run(2, 'INV-20260818-02', 3, 4, 'Entreprise Travaux Constantine', '+213 553 99 88 77', 36500.0, todayStr, todayStr);
        insertItem.run(2, 3, 1, 36500.0, 36500.0);
        // Sale 3: Yesterday (WH 1) - 55,500 DA
        insertSale.run(3, 'INV-20260817-01', 1, 2, 'Quincaillerie Centrale El Harrach', '+213 551 23 45 67', 55500.0, yestStr, yestStr);
        insertItem.run(3, 4, 3, 18500.0, 55500.0);
        // Sale 4: Yesterday (WH 2) - 125,000 DA
        insertSale.run(4, 'INV-20260817-02', 2, 3, 'Chantier Ouest Oran', '+213 552 34 56 78', 125000.0, yestStr, yestStr);
        insertItem.run(4, 5, 1, 125000.0, 125000.0);
        // Sale 5: 3 Days Ago (WH 1) - 73,000 DA
        insertSale.run(5, 'INV-20260815-01', 1, 2, 'Atelier Outillage Rouiba', '+213 550 45 67 89', 73000.0, threeDaysStr, threeDaysStr);
        insertItem.run(5, 3, 2, 36500.0, 73000.0);
        // Sale 6: 5 Days Ago (WH 2) - 49,000 DA
        insertSale.run(6, 'INV-20260813-01', 2, 3, 'EURL BTPH Oran Centre', '+213 552 67 89 01', 49000.0, fiveDaysStr, fiveDaysStr);
        insertItem.run(6, 2, 2, 24500.0, 49000.0);
        // Sale 7: Last Month (WH 1) - 140,000 DA
        insertSale.run(7, 'INV-20260718-01', 1, 2, 'Coopérative Artisanat Alger', '+213 550 78 90 12', 140000.0, lastMonthStr, lastMonthStr);
        insertItem.run(7, 1, 5, 28000.0, 140000.0);
        // Sale 8: Last Month (WH 3) - 73,000 DA
        insertSale.run(8, 'INV-20260724-01', 3, 4, 'Mohamed Bennani (Constantine)', '+213 540 19 87 11', 73000.0, lastMonthStr2, lastMonthStr2);
        insertItem.run(8, 3, 2, 36500.0, 73000.0);
        // Sale 9: Last Year (WH 2) - 250,000 DA
        insertSale.run(9, 'INV-20250818-01', 2, 3, 'Société Générale de Travaux Oran', '+213 552 89 01 23', 250000.0, lastYearStr, lastYearStr);
        insertItem.run(9, 5, 2, 125000.0, 250000.0);
    };
    const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get().count;
    if (roleCount > 0) {
        seedSalesIfEmpty();
        return;
    }
    runTransaction(() => {
        // 1. Roles
        const insertRole = db.prepare('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)');
        insertRole.run(1, 'ADMIN', 'System Administrator');
        insertRole.run(2, 'SUPER_MANAGER', 'Regional Super Manager');
        insertRole.run(3, 'MANAGER', 'Warehouse Manager');
        insertRole.run(4, 'ACCOUNTANT', 'Warehouse Accountant');
        // 2. Warehouses
        const insertWarehouse = db.prepare('INSERT INTO warehouses (id, name, code, location, contact_number, active) VALUES (?, ?, ?, ?, ?, 1)');
        insertWarehouse.run(1, 'Algiers Central Hub', 'WH-ALG', 'Zone Industrielle Oued Smar, Alger', '+213 21 00 11 22');
        insertWarehouse.run(2, 'Oran West Distribution', 'WH-ORN', 'Zone Industrielle Es Sénia, Oran', '+213 41 22 33 44');
        insertWarehouse.run(3, 'Constantine East Hub', 'WH-CST', 'Zone Industrielle Didouche Mourad, Constantine', '+213 31 44 55 66');
        // 3. Demo Users (matches frontend quick login buttons)
        const salt = bcrypt.genSaltSync(10);
        const adminPass = bcrypt.hashSync('AdminPass123!', salt);
        const managerPass = bcrypt.hashSync('ManagerPass123!', salt);
        const superPass = bcrypt.hashSync('SuperPass123!', salt);
        const accountantPass = bcrypt.hashSync('AccountantPass123!', salt);
        const insertUser = db.prepare('INSERT INTO users (username, password_hash, full_name, role_id, warehouse_id, active) VALUES (?, ?, ?, ?, ?, 1)');
        insertUser.run('admin', adminPass, 'Administrator DZ', 1, null);
        insertUser.run('manager_algiers', managerPass, 'Amine Khelifi (Algiers)', 3, 1);
        insertUser.run('super_oran', superPass, 'Karim Benali (Oran)', 2, 2);
        insertUser.run('accountant_constantine', accountantPass, 'Samir Brahimi (Constantine)', 4, 3);
        insertUser.run('supermanager', superPass, 'Super Regional Inspector', 2, null);
        // 4. Products
        const insertProduct = db.prepare(`
      INSERT INTO products (id, reference, name, brand, category, description, purchase_price, sale_price, min_stock_alert, unit, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PIECE', 1)
    `);
        insertProduct.run(1, 'BOSCH-GBH-226', 'Rotary Hammer GBH 2-26 DRE Professional', 'Bosch', 'Power Tools', 'Heavy-duty SDS Plus rotary hammer 800W', 21500.0, 28000.0, 5);
        insertProduct.run(2, 'MAKITA-DGA-504', 'Cordless Angle Grinder DGA504Z 18V', 'Makita', 'Cordless Tools', 'Brushless 125mm cordless angle grinder', 18500.0, 24500.0, 4);
        insertProduct.run(3, 'DEWALT-DCD-796', 'Compact Hammer Drill DCD796P2', 'DeWalt', 'Cordless Tools', '18V XR Li-Ion brushless compact combi drill', 29000.0, 36500.0, 6);
        insertProduct.run(4, 'STANLEY-STMT-74311', 'Socket Set 1/2 + 1/4 (120 Pcs)', 'Stanley', 'Hand Tools', 'Professional mechanics chrome vanadium socket set', 14000.0, 18500.0, 8);
        insertProduct.run(5, 'HILTI-TE-50-AVR', 'Combihammer TE 50-AVR SDS Max', 'Hilti', 'Heavy Construction', 'Powerful SDS-max combihammer with AVR', 95000.0, 125000.0, 2);
        // 5. Initial Stock & Movements
        const insertStock = db.prepare('INSERT INTO stock (warehouse_id, product_id, physical_quantity, reserved_quantity) VALUES (?, ?, ?, 0)');
        const insertMovement = db.prepare(`
      INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity_change, reference, notes)
      VALUES (?, ?, 'INITIAL_STOCK', ?, 'INIT-FACTORY', 'Initial factory distribution')
    `);
        // Algiers Hub
        insertStock.run(1, 1, 25);
        insertMovement.run(1, 1, 25);
        insertStock.run(1, 2, 30);
        insertMovement.run(1, 2, 30);
        insertStock.run(1, 3, 15);
        insertMovement.run(1, 3, 15);
        insertStock.run(1, 4, 40);
        insertMovement.run(1, 4, 40);
        insertStock.run(1, 5, 8);
        insertMovement.run(1, 5, 8);
        // Oran Hub
        insertStock.run(2, 1, 12);
        insertMovement.run(2, 1, 12);
        insertStock.run(2, 2, 18);
        insertMovement.run(2, 2, 18);
        insertStock.run(2, 4, 20);
        insertMovement.run(2, 4, 20);
        // Constantine Hub
        insertStock.run(3, 1, 10);
        insertMovement.run(3, 1, 10);
        insertStock.run(3, 3, 12);
        insertMovement.run(3, 3, 12);
        // 6. Demo Employees
        const insertEmp = db.prepare('INSERT INTO employees (id, warehouse_id, full_name, national_id, phone, position, base_salary, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)');
        insertEmp.run(1, 1, 'Mourad Boualem', '1985160100223', '+213 550 11 22 33', 'Senior Logistics Coordinator', 65000.0);
        insertEmp.run(2, 1, 'Nadia Mansouri', '1992160100445', '+213 551 22 33 44', 'Inventory Clerk', 42000.0);
        insertEmp.run(3, 2, 'Rachid Belhadj', '1988310100556', '+213 552 33 44 55', 'Oran Warehouse Supervisor', 58000.0);
        insertEmp.run(4, 3, 'Tariq Zeroual', '1990250100778', '+213 553 44 55 66', 'Constantine Forklift Operator', 45000.0);
        // 7. Demo Expenses
        const insertExp = db.prepare('INSERT INTO expenses (warehouse_id, category, amount, description, expense_date) VALUES (?, ?, ?, ?, ?)');
        insertExp.run(1, 'Utilities', 18500.0, 'Electricity & HVAC bill for warehouse unit', '2026-08-01');
        insertExp.run(1, 'Packaging', 12000.0, 'Pallets and heavy industrial wrapping stretch', '2026-08-05');
        insertExp.run(2, 'Transportation', 25000.0, 'Regional courier freight costs', '2026-08-10');
        insertExp.run(3, 'Maintenance', 9500.0, 'Hydraulic lift inspection and fluid replacement', '2026-08-12');
        // 8. Demo Salaries
        const currentPeriod = new Date().toISOString().substring(0, 7);
        const insertSalary = db.prepare('INSERT INTO salaries (employee_id, warehouse_id, period, base_salary, bonus1, bonus2, total_amount, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        insertSalary.run(1, 1, currentPeriod, 65000.0, 5000.0, 0.0, 70000.0, '2026-08-01');
        insertSalary.run(2, 1, currentPeriod, 42000.0, 2000.0, 1000.0, 45000.0, '2026-08-01');
        insertSalary.run(3, 2, currentPeriod, 58000.0, 3000.0, 0.0, 61000.0, '2026-08-01');
        // 9. Initial Audit Log
        const insertAudit = db.prepare(`
      INSERT INTO audit_logs (user_id, warehouse_id, action, entity_type, entity_id, description)
      VALUES (1, NULL, 'SYSTEM_INIT', 'SYSTEM', '1', 'System seeded and initialized with demo catalog and accounts')
    `);
        insertAudit.run();
        // 10. Multi-Period Demo Sales (for instant historical analysis)
        const seedSalesIfEmpty = () => {
            const salesCount = db.prepare('SELECT COUNT(*) as count FROM sales').get().count;
            if (salesCount > 0)
                return;
            const insertSale = db.prepare(`
        INSERT INTO sales (id, invoice_number, warehouse_id, user_id, customer_name, customer_phone, total_amount, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)
      `);
            const insertItem = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `);
            const now = new Date();
            const formatDate = (d, timeStr = '10:30:00') => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day} ${timeStr}`;
            };
            const todayStr = formatDate(now, '11:15:00');
            const yestDate = new Date(now);
            yestDate.setDate(now.getDate() - 1);
            const yestStr = formatDate(yestDate, '14:20:00');
            const threeDaysAgo = new Date(now);
            threeDaysAgo.setDate(now.getDate() - 3);
            const threeDaysStr = formatDate(threeDaysAgo, '09:45:00');
            const fiveDaysAgo = new Date(now);
            fiveDaysAgo.setDate(now.getDate() - 5);
            const fiveDaysStr = formatDate(fiveDaysAgo, '16:10:00');
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 18);
            const lastMonthStr = formatDate(lastMonthDate, '13:00:00');
            const lastMonthDate2 = new Date(now.getFullYear(), now.getMonth() - 1, 24);
            const lastMonthStr2 = formatDate(lastMonthDate2, '15:30:00');
            const lastYearDate = new Date(now.getFullYear() - 1, now.getMonth(), 18);
            const lastYearStr = formatDate(lastYearDate, '10:00:00');
            // Sale 1: Today (WH 1) - 56,000 DA
            insertSale.run(1, 'INV-20260818-01', 1, 2, 'SARL Bâtiment Pro Alger', '+213 550 12 34 56', 56000.0, todayStr, todayStr);
            insertItem.run(1, 1, 2, 28000.0, 56000.0);
            // Sale 2: Today (WH 3) - 36,500 DA
            insertSale.run(2, 'INV-20260818-02', 3, 4, 'Entreprise Travaux Constantine', '+213 553 99 88 77', 36500.0, todayStr, todayStr);
            insertItem.run(2, 3, 1, 36500.0, 36500.0);
            // Sale 3: Yesterday (WH 1) - 55,500 DA
            insertSale.run(3, 'INV-20260817-01', 1, 2, 'Quincaillerie Centrale El Harrach', '+213 551 23 45 67', 55500.0, yestStr, yestStr);
            insertItem.run(3, 4, 3, 18500.0, 55500.0);
            // Sale 4: Yesterday (WH 2) - 125,000 DA
            insertSale.run(4, 'INV-20260817-02', 2, 3, 'Chantier Ouest Oran', '+213 552 34 56 78', 125000.0, yestStr, yestStr);
            insertItem.run(4, 5, 1, 125000.0, 125000.0);
            // Sale 5: 3 Days Ago (WH 1) - 73,000 DA
            insertSale.run(5, 'INV-20260815-01', 1, 2, 'Atelier Outillage Rouiba', '+213 550 45 67 89', 73000.0, threeDaysStr, threeDaysStr);
            insertItem.run(5, 3, 2, 36500.0, 73000.0);
            // Sale 6: 5 Days Ago (WH 2) - 49,000 DA
            insertSale.run(6, 'INV-20260813-01', 2, 3, 'EURL BTPH Oran Centre', '+213 552 67 89 01', 49000.0, fiveDaysStr, fiveDaysStr);
            insertItem.run(6, 2, 2, 24500.0, 49000.0);
            // Sale 7: Last Month (WH 1) - 140,000 DA
            insertSale.run(7, 'INV-20260718-01', 1, 2, 'Coopérative Artisanat Alger', '+213 550 78 90 12', 140000.0, lastMonthStr, lastMonthStr);
            insertItem.run(7, 1, 5, 28000.0, 140000.0);
            // Sale 8: Last Month (WH 3) - 73,000 DA
            insertSale.run(8, 'INV-20260724-01', 3, 4, 'Mohamed Bennani (Constantine)', '+213 540 19 87 11', 73000.0, lastMonthStr2, lastMonthStr2);
            insertItem.run(8, 3, 2, 36500.0, 73000.0);
            // Sale 9: Last Year (WH 2) - 250,000 DA
            insertSale.run(9, 'INV-20250818-01', 2, 3, 'Société Générale de Travaux Oran', '+213 552 89 01 23', 250000.0, lastYearStr, lastYearStr);
            insertItem.run(9, 5, 2, 125000.0, 250000.0);
        };
        seedSalesIfEmpty();
    });
}
