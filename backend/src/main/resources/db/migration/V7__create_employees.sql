-- V7: Create Employees
CREATE TABLE IF NOT EXISTS employees (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    hire_date DATE NOT NULL,
    monthly_salary NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (monthly_salary >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employees_warehouse ON employees(warehouse_id);
