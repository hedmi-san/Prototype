-- V4: Create Stocks and Stock Movements
CREATE TABLE IF NOT EXISTS stocks (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    physical_quantity INTEGER NOT NULL DEFAULT 0 CHECK (physical_quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_stock_warehouse_product UNIQUE (warehouse_id, product_id),
    CONSTRAINT chk_stock_available CHECK (physical_quantity >= reserved_quantity)
);

CREATE INDEX IF NOT EXISTS idx_stocks_warehouse_product ON stocks(warehouse_id, product_id);

CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL, -- INITIAL_STOCK, SALE, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT
    quantity_delta INTEGER NOT NULL,
    reference_id VARCHAR(100),
    notes TEXT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON stock_movements(created_at);
