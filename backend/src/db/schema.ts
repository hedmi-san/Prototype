import { db } from './database.js';

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      location TEXT NOT NULL,
      contact_number TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      warehouse_id INTEGER REFERENCES warehouses(id),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      category TEXT DEFAULT 'Tools',
      description TEXT,
      purchase_price REAL NOT NULL DEFAULT 0.0,
      sale_price REAL NOT NULL DEFAULT 0.0,
      min_stock_alert INTEGER NOT NULL DEFAULT 5,
      unit TEXT NOT NULL DEFAULT 'PIECE',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      physical_quantity INTEGER NOT NULL DEFAULT 0 CHECK(physical_quantity >= 0),
      reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK(reserved_quantity >= 0),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(warehouse_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      movement_type TEXT NOT NULL,
      quantity_change INTEGER NOT NULL,
      reference TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      customer_name TEXT DEFAULT 'Standard Retail Customer',
      customer_phone TEXT,
      total_amount REAL NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_number TEXT NOT NULL UNIQUE,
      source_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      destination_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      requested_by_user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'REQUESTED',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      approved_at TEXT,
      confirmed_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transfer_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      requested_quantity INTEGER NOT NULL CHECK(requested_quantity > 0),
      approved_quantity INTEGER NOT NULL DEFAULT 0 CHECK(approved_quantity >= 0)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      expense_date TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      full_name TEXT NOT NULL,
      national_id TEXT NOT NULL,
      phone TEXT,
      position TEXT NOT NULL,
      base_salary REAL NOT NULL DEFAULT 0.0,
      active INTEGER NOT NULL DEFAULT 1,
      hire_date TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS salaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      period TEXT NOT NULL,
      base_salary REAL NOT NULL,
      bonus1 REAL NOT NULL DEFAULT 0.0,
      bonus2 REAL NOT NULL DEFAULT 0.0,
      total_amount REAL NOT NULL,
      payment_date TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      warehouse_id INTEGER REFERENCES warehouses(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      description TEXT NOT NULL,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations for existing databases
  try {
    db.exec('ALTER TABLE transfers ADD COLUMN approved_at TEXT;');
  } catch {}
  try {
    db.exec('ALTER TABLE transfers ADD COLUMN confirmed_at TEXT;');
  } catch {}
}
