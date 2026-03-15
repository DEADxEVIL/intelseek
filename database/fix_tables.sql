-- ============================================
-- COMPLETE DATABASE FIX SCRIPT
-- ============================================

USE intelseek_db;

-- ============================================
-- 1. FIX AUDIT_LOGS TABLE
-- ============================================
ALTER TABLE audit_logs MODIFY COLUMN user_role VARCHAR(50);

-- Safely drop indexes using stored procedure
DROP PROCEDURE IF EXISTS DropIndexIfExists;
DELIMITER intelseek_db
CREATE PROCEDURE DropIndexIfExists(IN tblName VARCHAR(64), IN idxName VARCHAR(64))
BEGIN
    IF EXISTS (SELECT * FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = tblName AND index_name = idxName) THEN
        SET @s = CONCAT('DROP INDEX ', idxName, ' ON ', tblName);
        PREPARE stmt FROM @s;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
ENDintelseek_db
DELIMITER ;

-- Drop existing indexes
CALL DropIndexIfExists('audit_logs', 'idx_audit_logs_user_id');
CALL DropIndexIfExists('audit_logs', 'idx_audit_logs_timestamp');
CALL DropIndexIfExists('audit_logs', 'idx_audit_logs_search_type');

-- Create new indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_search_type ON audit_logs(search_type);

-- Drop the procedure
DROP PROCEDURE DropIndexIfExists;

-- ============================================
-- 2. CREATE API_TYPES TABLE
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
INSERT INTO api_types (type_name, display_name, category, is_active) VALUES
('mobile', 'Mobile Number', 'Primary', true),
('id_number', 'Aadhaar Number', 'Primary', true),
('pak_num', 'Pakistan Number', 'Primary', true),
('ifsc', 'IFSC Code', 'Primary', true),
('cinc', 'CINC Number', 'Primary', true),
('vehicle', 'Vehicle Info', 'Vehicle', true),
('vehicle_num', 'Vehicle Number', 'Vehicle', true),
('email', 'Email Address', 'Identity', true),
('pan', 'PAN Card', 'Identity', true),
('id_family', 'Family ID', 'Identity', true),
('fampay', 'FamPay', 'Identity', true),
('truecaller', 'Truecaller', 'Contact', true),
('upi', 'UPI ID', 'Contact', true),
('sms', 'SMS Bomber', 'Contact', true),
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO api_config (config_key, config_value_encrypted) 
VALUES ('subhx_api_key', 'PRIMESPARK')
ON DUPLICATE KEY UPDATE config_key = config_key;

-- Add foreign key constraint separately
ALTER TABLE api_config 
ADD CONSTRAINT fk_api_config_updated_by 
FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- 5. VERIFY ALL TABLES
-- ============================================
SHOW TABLES;

SELECT '✅ DATABASE FIX COMPLETED SUCCESSFULLY' as status;
