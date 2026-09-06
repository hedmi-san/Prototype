import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
app.set('trust proxy', 1);
// CORS configuration supporting production Render deployments, custom env domains, and local dev
const rawCorsOrigins = process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || '';
const customAllowedOrigins = rawCorsOrigins.split(',').map((o) => o.trim()).filter(Boolean);
const defaultAllowedOrigins = [
    'https://distributor-frontend.onrender.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4173',
];
const allAllowedOrigins = Array.from(new Set([...customAllowedOrigins, ...defaultAllowedOrigins]));
const corsOptions = {
    origin: (origin, callback) => {
        // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
        if (!origin) {
            return callback(null, true);
        }
        // Direct match against known/configured origins
        if (allAllowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // Dynamic pattern matching for all Render app subdomains (e.g. *.onrender.com)
        if (/^https:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(origin)) {
            return callback(null, true);
        }
        // Dynamic pattern matching for local development on any port
        if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }
        // Dynamic pattern matching for Vercel or Netlify preview deployments
        if (/^https:\/\/[a-zA-Z0-9-]+\.(vercel\.app|netlify\.app)$/.test(origin)) {
            return callback(null, true);
        }
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Disposition'],
};
// Mount CORS before other middlewares to handle preflight OPTIONS immediately
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
}));
app.use(express.json({ limit: '10mb' }));
// Request logger
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
});
// Health Checks
app.get(['/actuator/health', '/api/health', '/health'], (req, res) => {
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
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString(),
    });
});
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    const isProduction = process.env.NODE_ENV === 'production';
    const statusCode = Number(err.status) || 500;
    res.status(statusCode).json({
        success: false,
        message: isProduction ? (statusCode === 500 ? 'Internal server error' : err.message) : (err.message || 'Internal server error'),
        error: isProduction ? undefined : err.message,
        timestamp: new Date().toISOString(),
    });
});
async function startServer() {
    try {
        // Validate JWT Secret configuration
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret && process.env.NODE_ENV === 'production') {
            console.error('FATAL ERROR: JWT_SECRET environment variable is required in production.');
            process.exit(1);
        }
        const hasDbUrl = Boolean(process.env.DATABASE_URL || process.env.INTERNAL_DATABASE_URL || process.env.POSTGRES_URL);
        if (hasDbUrl) {
            console.log('Connecting to PostgreSQL using connection URL (DATABASE_URL)...');
        }
        else {
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
    }
    catch (err) {
        console.error('Fatal error starting server:', err);
        process.exit(1);
    }
}
startServer();
