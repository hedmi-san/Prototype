-- V2: Create Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    address VARCHAR(255),
    phone VARCHAR(50),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial 3 regional warehouses
INSERT INTO warehouses (name, code, address, phone, active) VALUES
('Algiers Central Hub', 'WH-ALG', 'Zone Industrielle Oued Smar, Alger', '+213 21 00 11 22', TRUE),
('Oran West Distribution', 'WH-ORN', 'Zone Industrielle Es Sénia, Oran', '+213 41 22 33 44', TRUE),
('Constantine East Hub', 'WH-CST', 'Zone Industrielle Didouche Mourad, Constantine', '+213 31 44 55 66', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Add foreign key constraint to users table now that warehouses exists
ALTER TABLE users 
ADD CONSTRAINT fk_users_warehouse 
FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL;
