import { query } from './database.js';

export async function initSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(20) NOT NULL UNIQUE,
      location TEXT NOT NULL,
      contact_number VARCHAR(50),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      reference VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      brand VARCHAR(100) NOT NULL,
      category VARCHAR(100) DEFAULT 'Tools',
      description TEXT,
      purchase_price NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
      sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
      min_stock_alert INTEGER NOT NULL DEFAULT 5,
      unit VARCHAR(50) NOT NULL DEFAULT 'PIECE',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS stock (
      id SERIAL PRIMARY KEY,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      physical_quantity INTEGER NOT NULL DEFAULT 0 CHECK(physical_quantity >= 0),
      reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK(reserved_quantity >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(warehouse_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id SERIAL PRIMARY KEY,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      movement_type VARCHAR(50) NOT NULL,
      quantity_change INTEGER NOT NULL,
      reference VARCHAR(100) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS employees (
      id SERIAL PRIMARY KEY,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      full_name VARCHAR(100) NOT NULL,
      national_id VARCHAR(50) NOT NULL,
      phone VARCHAR(50),
      position VARCHAR(100) NOT NULL,
      base_salary NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR(50) NOT NULL UNIQUE,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
      customer_name VARCHAR(100) DEFAULT 'Standard Retail Customer',
      customer_phone VARCHAR(50),
      total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
      status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
      sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price NUMERIC(14, 2) NOT NULL,
      subtotal NUMERIC(14, 2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id SERIAL PRIMARY KEY,
      transfer_number VARCHAR(50) NOT NULL UNIQUE,
      source_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      destination_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      requested_by_user_id INTEGER NOT NULL REFERENCES users(id),
      status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transfer_items (
      id SERIAL PRIMARY KEY,
      transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      requested_quantity INTEGER NOT NULL CHECK(requested_quantity > 0),
      approved_quantity INTEGER NOT NULL DEFAULT 0 CHECK(approved_quantity >= 0)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      category VARCHAR(100) NOT NULL,
      amount NUMERIC(14, 2) NOT NULL,
      description TEXT,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS salaries (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      period VARCHAR(20) NOT NULL,
      base_salary NUMERIC(14, 2) NOT NULL,
      bonus1 NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
      bonus2 NUMERIC(14, 2) NOT NULL DEFAULT 0.0,
      total_amount NUMERIC(14, 2) NOT NULL,
      payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      old_values TEXT,
      new_values TEXT,
      description TEXT NOT NULL,
      ip_address VARCHAR(50),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Migrations for existing databases
  await query(`
    ALTER TABLE sales ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';
    UPDATE employees SET status = CASE WHEN active = FALSE THEN 'TERMINATED' ELSE 'ACTIVE' END WHERE status IS NULL OR status = '';
  `);

  // Performance composite indexes
  await query(`
    CREATE INDEX IF NOT EXISTS idx_sales_sale_date_wh ON sales(sale_date, warehouse_id);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at_wh ON sales(created_at, warehouse_id);
    CREATE INDEX IF NOT EXISTS idx_sales_employee_id ON sales(employee_id);
    CREATE INDEX IF NOT EXISTS idx_employees_status_wh ON employees(status, warehouse_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_created_wh ON stock_movements(created_at, warehouse_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_type_created ON stock_movements(movement_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_transfers_created_wh ON transfers(created_at, source_warehouse_id, destination_warehouse_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_status_created ON transfers(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer_id ON transfer_items(transfer_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_wh ON audit_logs(created_at, warehouse_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at);
    CREATE INDEX IF NOT EXISTS idx_stock_product_id ON stock(product_id);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
    CREATE INDEX IF NOT EXISTS idx_products_search ON products(reference, name, brand);
  `);
}
