-- ============================================
-- COMPLETE DATABASE FIX SCRIPT
-- Run this to fix all table structure issues
-- ============================================

-- First, make sure we're using the correct database
USE intelseek_db;

-- ============================================
-- 1. FIX AUDIT_LOGS TABLE
-- ============================================

-- Modify audit_logs table to accept longer user_role values
ALTER TABLE audit_logs MODIFY COLUMN user_role VARCHAR(50);

-- Add index for better performance if not exists
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_search_type ON audit_logs(search_type);

-- ============================================
-- 2. CREATE API_TYPES TABLE (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS api_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type_name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. INSERT DEFAULT API TYPES
-- ============================================

-- Clear existing data (optional - comment out if you want to keep existing)
-- DELETE FROM api_types;

-- Insert all API types from your requirements
INSERT INTO api_types (type_name, display_name, category, is_active) VALUES
-- Primary Identifiers
('mobile', 'Mobile Number', 'Primary', true),
('id_number', 'Aadhaar Number', 'Primary', true),
('pak_num', 'Pakistan Number', 'Primary', true),
('ifsc', 'IFSC Code', 'Primary', true),
('cinc', 'CINC Number', 'Primary', true),

-- Vehicle Related
('vehicle', 'Vehicle Info', 'Vehicle', true),
('vehicle_num', 'Vehicle Number', 'Vehicle', true),

-- Identity Documents
('email', 'Email Address', 'Identity', true),
('pan', 'PAN Card', 'Identity', true),
('id_family', 'Family ID', 'Identity', true),
('fampay', 'FamPay', 'Identity', true),

-- Contact & Communication
('truecaller', 'Truecaller', 'Contact', true),
('upi', 'UPI ID', 'Contact', true),
('sms', 'SMS Bomber', 'Contact', true),

-- Advanced Search Types
('samagra', 'Samagra ID', 'Advanced', true),
('upi_bomber', 'UPI Bomber', 'Advanced', true),
('bomber', 'Bomber', 'Advanced', true),
('tg', 'Telegram', 'Advanced', true),
('num2upi', 'Number to UPI', 'Advanced', true),
('leak', 'Leak Data', 'Advanced', true),
('a2p', 'A2P', 'Advanced', true)

ON DUPLICATE KEY UPDATE 
    display_name = VALUES(display_name),
    category = VALUES(category),
    is_active = VALUES(is_active);

-- ============================================
-- 4. ENSURE API_CONFIG TABLE EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS api_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value_encrypted TEXT,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert default API key if not exists
INSERT INTO api_config (config_key, config_value_encrypted) 
VALUES ('subhx_api_key', 'PRIMESPARK')
ON DUPLICATE KEY UPDATE config_key = config_key;

-- ============================================
-- 5. FIX USERS TABLE CONSTRAINTS
-- ============================================

-- Ensure created_by foreign key is properly set
ALTER TABLE users DROP FOREIGN KEY IF EXISTS users_ibfk_1;
ALTER TABLE users ADD CONSTRAINT users_ibfk_1 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- 6. CREATE OR UPDATE DEVELOPER ACCOUNT
-- ============================================

-- Insert developer account if it doesn't exist
-- Note: The password hash will be created by the application
-- This just creates the user record
INSERT IGNORE INTO users (username, password_hash, role, is_active) 
VALUES ('the_BR_king', 'PLACEHOLDER_HASH_WILL_BE_UPDATED_BY_APP', 'owner', true);

-- ============================================
-- 7. VERIFY ALL TABLES
-- ============================================

-- Show all tables
SHOW TABLES;

-- Show structure of each table
DESCRIBE users;
DESCRIBE audit_logs;
DESCRIBE api_types;
DESCRIBE api_config;

-- Show counts
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'api_types', COUNT(*) FROM api_types
UNION ALL
SELECT 'api_config', COUNT(*) FROM api_config;

-- ============================================
-- 8. SAMPLE DATA FOR TESTING (Optional)
-- ============================================

-- Add a sample admin for testing (password will be set by app)
INSERT IGNORE INTO users (username, password_hash, role, is_active) 
VALUES ('test_admin', 'PLACEHOLDER', 'admin', true);

-- Add a sample audit log entry
INSERT IGNORE INTO audit_logs (user_id, username, user_role, search_type, search_term, ip_address) 
SELECT id, username, role, 'test', 'sample search', '127.0.0.1' 
FROM users WHERE username = 'owner' LIMIT 1;

-- ============================================
-- 9. GRANT PROPER PERMISSIONS (if needed)
-- ============================================

-- Grant all privileges to root user (adjust as needed)
GRANT ALL PRIVILEGES ON intelseek_db.* TO 'root'@'localhost';
FLUSH PRIVILEGES;

-- ============================================
-- 10. FINAL VERIFICATION QUERY
-- ============================================

SELECT '✅ DATABASE FIX COMPLETED SUCCESSFULLY' as status;
SELECT NOW() as fix_applied_time;