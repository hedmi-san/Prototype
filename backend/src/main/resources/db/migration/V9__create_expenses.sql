-- V9: Create Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    category VARCHAR(50) NOT NULL, -- ELECTRICITY, WATER, RENT, FUEL, MAINTENANCE, OTHER
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    expense_date DATE NOT NULL,
    description TEXT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_warehouse ON expenses(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
