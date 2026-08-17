-- V3: Create Products
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    reference VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    unit_purchase_price NUMERIC(15, 2) NOT NULL CHECK (unit_purchase_price >= 0),
    unit_sale_price NUMERIC(15, 2) NOT NULL CHECK (unit_sale_price >= 0),
    min_stock_alert INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_reference ON products(reference);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
