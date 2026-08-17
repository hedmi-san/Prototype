import bcrypt from 'bcryptjs';
import { db, runTransaction } from './database.js';
export function seedData() {
    const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get().count;
    if (roleCount > 0) {
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
    });
}
