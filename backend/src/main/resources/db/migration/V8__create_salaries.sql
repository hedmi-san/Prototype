-- V8: Create Salary Records
CREATE TABLE IF NOT EXISTS salary_records (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    period VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    base_salary NUMERIC(15, 2) NOT NULL CHECK (base_salary >= 0),
    bonus1 NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (bonus1 >= 0),
    bonus2 NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (bonus2 >= 0),
    total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount >= 0),
    payment_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PAID',
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_salaries_employee ON salary_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_salaries_warehouse ON salary_records(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_salaries_period ON salary_records(period);
