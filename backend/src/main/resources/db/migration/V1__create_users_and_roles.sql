-- V1: Create Users and Roles
CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
);

INSERT INTO roles (name, description) VALUES
('ADMIN', 'Full system administrator across all warehouses'),
('SUPER_MANAGER', 'High-level manager with cross-warehouse read access and operations'),
('MANAGER', 'Warehouse manager with local hub scope'),
('ACCOUNTANT', 'Financial accountant with local invoice and pricing view/edit access')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role_id BIGINT NOT NULL REFERENCES roles(id),
    warehouse_id BIGINT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_warehouse_id ON users(warehouse_id);
