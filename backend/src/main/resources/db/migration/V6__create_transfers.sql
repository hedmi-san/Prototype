-- V6: Create Transfers and Transfer Items
CREATE TABLE IF NOT EXISTS transfers (
    id BIGSERIAL PRIMARY KEY,
    reference_number VARCHAR(100) NOT NULL UNIQUE,
    source_warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    destination_warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED', -- REQUESTED, APPROVED, CONFIRMED, DECLINED, CANCELLED
    notes TEXT,
    created_by BIGINT REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    confirmed_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_transfers_different_warehouses CHECK (source_warehouse_id <> destination_warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_source ON transfers(source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfers_dest ON transfers(destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);

CREATE TABLE IF NOT EXISTS transfer_items (
    id BIGSERIAL PRIMARY KEY,
    transfer_id BIGINT NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
    approved_quantity INTEGER CHECK (approved_quantity >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_product ON transfer_items(product_id);
