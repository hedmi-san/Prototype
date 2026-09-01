import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ensureDatabaseExists } from './db/database.js';
import { initSchema } from './db/schema.js';
import { seedData } from './db/seed.js';

import authRoutes from './routes/auth.routes.js';
import warehouseRoutes from './routes/warehouse.routes.js';
import productRoutes from './routes/product.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import saleRoutes from './routes/sale.routes.js';
import clientRoutes from './routes/client.routes.js';
import clientPaymentRoutes from './routes/client-payment.routes.js';
import transferRoutes from './routes/transfer.routes.js';
import expenseRoutes from './routes/expense.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import salaryRoutes from './routes/salary.routes.js';
import reportRoutes from './routes/report.routes.js';
import auditRoutes from './routes/audit.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();
const PORT = Number(process.env.PORT) || 10000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// Health Checks
app.get(['/actuator/health', '/api/health', '/health'], (req: Request, res: Response) => {
  res.json({ status: 'UP', service: 'distributor-management-node', database: 'PostgreSQL', timestamp: new Date().toISOString() });
});

// Mount Routes under both /api and without /api (universal matching)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/warehouses', warehouseRoutes);
app.use('/warehouses', warehouseRoutes);

app.use('/api/products', productRoutes);
app.use('/products', productRoutes);

app.use('/api/clients', clientRoutes);
app.use('/clients', clientRoutes);

app.use('/api/client-payments', clientPaymentRoutes);
app.use('/client-payments', clientPaymentRoutes);

app.use('/api/inventory', inventoryRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/api/operations', inventoryRoutes);
app.use('/operations', inventoryRoutes);

app.use('/api/sales', saleRoutes);
app.use('/sales', saleRoutes);

app.use('/api/transfers', transferRoutes);
app.use('/transfers', transferRoutes);

app.use('/api/expenses', expenseRoutes);
app.use('/expenses', expenseRoutes);

app.use('/api/employees', employeeRoutes);
app.use('/employees', employeeRoutes);

app.use('/api/salaries', salaryRoutes);
app.use('/salaries', salaryRoutes);

app.use('/api/reports', reportRoutes);
app.use('/api/admin/reports', reportRoutes);
app.use('/reports', reportRoutes);
app.use('/admin/reports', reportRoutes);

app.use('/api/audit-logs', auditRoutes);
app.use('/api/admin/audit-logs', auditRoutes);
app.use('/audit-logs', auditRoutes);
app.use('/admin/audit-logs', auditRoutes);

app.use('/api/admin/users', userRoutes);
app.use('/api/users', userRoutes);
app.use('/admin/users', userRoutes);
app.use('/users', userRoutes);

// 404 Fallback
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: err.message,
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  try {
    const hasDbUrl = Boolean(process.env.DATABASE_URL || process.env.INTERNAL_DATABASE_URL || process.env.POSTGRES_URL);
    if (hasDbUrl) {
      console.log('Connecting to PostgreSQL using connection URL (DATABASE_URL)...');
    } else {
      console.log(`Connecting to PostgreSQL via fallback host: ${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'distributor_db'}...`);
    }

    await ensureDatabaseExists();
    console.log('Initializing database schema & composite indexes...');
    await initSchema();
    console.log('Seeding demo accounts and initial stock...');
    await seedData();
    console.log('Database initialized and seeded successfully.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(` Multi-Warehouse Node.js API Server (PostgreSQL) running on port ${PORT}`);
      console.log(` Health check: /actuator/health`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

startServer();
