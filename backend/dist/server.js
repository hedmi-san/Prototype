"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const schema_js_1 = require("./db/schema.js");
const seed_js_1 = require("./db/seed.js");
const auth_routes_js_1 = __importDefault(require("./routes/auth.routes.js"));
const warehouse_routes_js_1 = __importDefault(require("./routes/warehouse.routes.js"));
const product_routes_js_1 = __importDefault(require("./routes/product.routes.js"));
const inventory_routes_js_1 = __importDefault(require("./routes/inventory.routes.js"));
const sale_routes_js_1 = __importDefault(require("./routes/sale.routes.js"));
const transfer_routes_js_1 = __importDefault(require("./routes/transfer.routes.js"));
const expense_routes_js_1 = __importDefault(require("./routes/expense.routes.js"));
const employee_routes_js_1 = __importDefault(require("./routes/employee.routes.js"));
const salary_routes_js_1 = __importDefault(require("./routes/salary.routes.js"));
const report_routes_js_1 = __importDefault(require("./routes/report.routes.js"));
const audit_routes_js_1 = __importDefault(require("./routes/audit.routes.js"));
const user_routes_js_1 = __importDefault(require("./routes/user.routes.js"));
// 1. Initialize SQLite Database Schema & Seed Data
console.log('Initializing database schema...');
(0, schema_js_1.initSchema)();
(0, seed_js_1.seedData)();
console.log('Database initialized and seeded successfully.');
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json());
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
    res.json({ status: 'UP', service: 'distributor-management-node', timestamp: new Date().toISOString() });
});
// Mount Routes under both /api and without /api (universal matching)
app.use('/api/auth', auth_routes_js_1.default);
app.use('/auth', auth_routes_js_1.default);
app.use('/api/warehouses', warehouse_routes_js_1.default);
app.use('/warehouses', warehouse_routes_js_1.default);
app.use('/api/products', product_routes_js_1.default);
app.use('/products', product_routes_js_1.default);
app.use('/api/inventory', inventory_routes_js_1.default);
app.use('/inventory', inventory_routes_js_1.default);
app.use('/api/operations', inventory_routes_js_1.default);
app.use('/api/sales', sale_routes_js_1.default);
app.use('/sales', sale_routes_js_1.default);
app.use('/api/transfers', transfer_routes_js_1.default);
app.use('/transfers', transfer_routes_js_1.default);
app.use('/api/expenses', expense_routes_js_1.default);
app.use('/expenses', expense_routes_js_1.default);
app.use('/api/employees', employee_routes_js_1.default);
app.use('/employees', employee_routes_js_1.default);
app.use('/api/salaries', salary_routes_js_1.default);
app.use('/salaries', salary_routes_js_1.default);
app.use('/api/reports', report_routes_js_1.default);
app.use('/api/admin/reports', report_routes_js_1.default);
app.use('/reports', report_routes_js_1.default);
app.use('/api/audit-logs', audit_routes_js_1.default);
app.use('/api/admin/audit-logs', audit_routes_js_1.default);
app.use('/audit-logs', audit_routes_js_1.default);
app.use('/api/admin/users', user_routes_js_1.default);
app.use('/api/users', user_routes_js_1.default);
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
    res.status(500).json({
        success: false,
        message: err.message || 'Internal server error',
        error: err.message,
        timestamp: new Date().toISOString(),
    });
});
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Multi-Warehouse Node.js API Server running on port ${PORT}`);
    console.log(` Health check: http://localhost:${PORT}/actuator/health`);
    console.log(`=======================================================`);
});
