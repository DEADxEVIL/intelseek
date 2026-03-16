-- ============================================
-- RAILWAY DATABASE SCHEMA
-- ============================================

USE railway;

-- 1. Create users table first
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('owner', 'admin') NOT NULL DEFAULT 'admin',
    created_by INT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- 2. Create audit_logs table (depends on users)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    username VARCHAR(50),
    user_role VARCHAR(50),
    search_type VARCHAR(50),
    search_term VARCHAR(255),
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Create api_config table
CREATE TABLE IF NOT EXISTS api_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value_encrypted TEXT,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Create api_types table
CREATE TABLE IF NOT EXISTS api_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Insert default API types
INSERT IGNORE INTO api_types (type_name, display_name, category) VALUES
('mobile', 'Mobile Number', 'Primary'),
('id_number', 'Aadhaar Number', 'Primary'),
('truecaller', 'Truecaller', 'Contact'),
('vehicle', 'Vehicle Info', 'Vehicle'),
('email', 'Email Address', 'Identity'),
('pan', 'PAN Card', 'Identity'),
('upi', 'UPI ID', 'Contact'),
('ifsc', 'IFSC Code', 'Primary');

-- 6. Insert default owner (with temporary hash)
INSERT IGNORE INTO users (username, password_hash, role) 
VALUES ('owner', 'temp_hash', 'owner');

-- 7. Insert default API key
INSERT IGNORE INTO api_config (config_key, config_value_encrypted) 
VALUES ('subhx_api_key', 'PRIMESPARK');

-- 8. Show results
SHOW TABLES;
SELECT '✅ SCHEMA IMPORT COMPLETED' as status;
SELECT COUNT(*) as user_count FROM users;
