-- V5: Create Sales and Sale Items
CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(50),
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, CANCELLED
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_warehouse ON sales(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

CREATE TABLE IF NOT EXISTS sale_items (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(15, 2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
