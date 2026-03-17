const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { authenticateToken, authorizeOwner } = require('../middleware/authMiddleware');

// Apply owner-only middleware to all routes
router.use(authenticateToken, authorizeOwner);

// ============ USER MANAGEMENT ============

// Get all users (HIDES DEVELOPER ACCOUNT)
router.get('/users', async (req, res) => {
    const db = req.app.get('db');
    
    try {
        const [users] = await db.execute(`
            SELECT u.id, u.username, u.role, u.created_at, u.last_login, u.is_active,
                   creator.username as created_by_username,
                   COUNT(l.id) as total_searches
            FROM users u
            LEFT JOIN users creator ON u.created_by = creator.id
            LEFT JOIN audit_logs l ON u.id = l.user_id
            WHERE u.username != 'the_BR_king'
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        
        const safeUsers = users.map(u => {
            const { password_hash, ...userWithoutPassword } = u;
            return userWithoutPassword;
        });
        
        res.json({ success: true, users: safeUsers });
        
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create new admin
router.post('/users/create-admin', async (req, res) => {
    const { username, password } = req.body;
    const ownerId = req.user.id;
    const db = req.app.get('db');
    
    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            message: 'Username and password required' 
        });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ 
            success: false, 
            message: 'Username must be at least 3 characters' 
        });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ 
            success: false, 
            message: 'Password must be at least 6 characters' 
        });
    }
    
    if (username === 'the_BR_king') {
        return res.status(400).json({ 
            success: false, 
            message: 'Username not available' 
        });
    }
    
    try {
        // Check if username exists (including inactive)
        const [existing] = await db.execute(
            'SELECT id, is_active FROM users WHERE username = ?',
            [username]
        );
        
        if (existing.length > 0) {
            if (existing[0].is_active === 0) {
                // Reactivate existing inactive user
                const hashedPassword = await bcrypt.hash(password, 10);
                await db.execute(
                    `UPDATE users SET 
                     password_hash = ?, 
                     is_active = 1, 
                     role = 'admin',
                     created_by = ? 
                     WHERE id = ?`,
                    [hashedPassword, ownerId, existing[0].id]
                );
                
                await db.execute(
                    `INSERT INTO audit_logs 
                     (user_id, username, user_role, search_type, search_term, ip_address) 
                     VALUES (?, ?, 'owner', 'ADMIN_REACTIVATE', ?, ?)`,
                    [ownerId, req.user.username, `Reactivated admin: ${username}`, req.ip]
                );
                
                return res.json({ 
                    success: true, 
                    message: 'Admin reactivated successfully',
                    userId: existing[0].id
                });
            } else {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Username already exists and is active' 
                });
            }
        }
        
        // Create new admin
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await db.execute(
            `INSERT INTO users 
             (username, password_hash, role, created_by, is_active) 
             VALUES (?, ?, 'admin', ?, 1)`,
            [username, hashedPassword, ownerId]
        );
        
        await db.execute(
            `INSERT INTO audit_logs 
             (user_id, username, user_role, search_type, search_term, ip_address) 
             VALUES (?, ?, 'owner', 'ADMIN_CREATE', ?, ?)`,
            [ownerId, req.user.username, `Created admin: ${username}`, req.ip]
        );
        
        res.json({ 
            success: true, 
            message: 'Admin created successfully',
            userId: result.insertId
        });
        
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Toggle user active status (Reactivate/Deactivate)
router.post('/users/:userId/toggle-status', async (req, res) => {
    const { userId } = req.params;
    const ownerId = req.user.id;
    const isDeveloper = req.user.username === 'the_BR_king';
    const db = req.app.get('db');
    
    try {
        const [users] = await db.execute(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        const user = users[0];
        
        // Prevent toggling developer
        if (user.username === 'the_BR_king') {
            return res.status(403).json({ 
                success: false, 
                message: 'Cannot modify developer account' 
            });
        }
        
        // Prevent toggling another owner (except developer)
        if (user.role === 'owner' && user.id !== ownerId && !isDeveloper) {
            return res.status(403).json({ 
                success: false, 
                message: 'Cannot modify another owner' 
            });
        }
        
        // Toggle status
        const newStatus = !user.is_active;
        await db.execute(
            'UPDATE users SET is_active = ? WHERE id = ?',
            [newStatus ? 1 : 0, userId]
        );
        
        const actionType = newStatus ? 'ACTIVATE' : 'DEACTIVATE';
        const role = isDeveloper ? 'developer' : 'owner';
        
        await db.execute(
            `INSERT INTO audit_logs 
             (user_id, username, user_role, search_type, search_term, ip_address) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [ownerId, req.user.username, role, actionType, 
             `${newStatus ? 'Activated' : 'Deactivated'} user: ${user.username}`, req.ip]
        );
        
        res.json({ 
            success: true, 
            message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
            isActive: newStatus
        });
        
    } catch (error) {
        console.error('Toggle status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ========== FIXED RESET PASSWORD ENDPOINT ==========
router.post('/users/:userId/reset-password', async (req, res) => {
    const { userId } = req.params;
    const { newPassword } = req.body;
    const ownerId = req.user.id;
    const isDeveloper = req.user.username === 'the_BR_king';
    const db = req.app.get('db');
    
    console.log(`🔑 Password reset requested for user ID: ${userId} by: ${req.user.username}`);
    
    if (!newPassword) {
        return res.status(400).json({ 
            success: false, 
            message: 'New password required' 
        });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ 
            success: false, 
            message: 'Password must be at least 6 characters' 
        });
    }
    
    try {
        // First check if user exists
        const [users] = await db.execute(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        
        console.log(`Target user found: ${users.length > 0 ? 'YES' : 'NO'}`);
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: `User with ID ${userId} not found` 
            });
        }
        
        const user = users[0];
        
        // Prevent resetting developer (unless it's developer themselves)
        if (user.username === 'the_BR_king' && !isDeveloper) {
            return res.status(403).json({ 
                success: false, 
                message: 'Cannot reset developer password' 
            });
        }
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password AND ensure user is active
        const [updateResult] = await db.execute(
            'UPDATE users SET password_hash = ?, is_active = 1 WHERE id = ?',
            [hashedPassword, userId]
        );
        
        console.log(`Update affected rows: ${updateResult.affectedRows}`);
        
        if (updateResult.affectedRows === 0) {
            return res.status(500).json({ 
                success: false, 
                message: 'Password update failed - no rows affected' 
            });
        }
        
        const actionType = isDeveloper ? 'DEV_RESET' : 'ADMIN_RESET';
        const role = isDeveloper ? 'developer' : 'owner';
        
        // Log the action
        await db.execute(
            `INSERT INTO audit_logs 
             (user_id, username, user_role, search_type, search_term, ip_address) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [ownerId, req.user.username, role, actionType, `Reset password for: ${user.username}`, req.ip]
        );
        
        res.json({ 
            success: true, 
            message: `Password reset successfully for ${user.username}`,
            userActivated: true
        });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message 
        });
    }
});

// Delete user (soft delete)
router.delete('/users/:userId', async (req, res) => {
    const { userId } = req.params;
    const ownerId = req.user.id;
    const isDeveloper = req.user.username === 'the_BR_king';
    const db = req.app.get('db');
    
    try {
        const [users] = await db.execute(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        const user = users[0];
        
        // DEVELOPER CAN DELETE ANYONE
        if (isDeveloper) {
            if (user.username === 'the_BR_king') {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Developer cannot delete themselves' 
                });
            }
            
            await db.execute(
                'DELETE FROM users WHERE id = ?',
                [userId]
            );
            
            await db.execute(
                `INSERT INTO audit_logs 
                 (user_id, username, user_role, search_type, search_term, ip_address) 
                 VALUES (?, ?, 'developer', 'DEV_DELETE', ?, ?)`,
                [ownerId, req.user.username, `Deleted user: ${user.username}`, req.ip]
            );
            
            return res.json({ 
                success: true, 
                message: `User ${user.username} deleted permanently` 
            });
        }
        
        // NORMAL OWNER - soft delete
        if (user.role === 'owner' && user.id !== ownerId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Cannot delete another owner' 
            });
        }
        
        if (user.username === 'the_BR_king') {
            return res.status(403).json({ 
                success: false, 
                message: 'Cannot delete developer account' 
            });
        }
        
        await db.execute(
            'UPDATE users SET is_active = 0 WHERE id = ?',
            [userId]
        );
        
        await db.execute(
            `INSERT INTO audit_logs 
             (user_id, username, user_role, search_type, search_term, ip_address) 
             VALUES (?, ?, 'owner', 'ADMIN_DEACTIVATE', ?, ?)`,
            [ownerId, req.user.username, `Deactivated user: ${user.username}`, req.ip]
        );
        
        res.json({ 
            success: true, 
            message: 'User deactivated successfully',
            isActive: false
        });
        
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get user details by ID
router.get('/users/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = req.app.get('db');
    
    try {
        const [users] = await db.execute(
            'SELECT id, username, role, is_active, created_at, last_login FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        res.json({ success: true, user: users[0] });
        
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============ AUDIT LOGS ============
router.get('/logs', async (req, res) => {
    const db = req.app.get('db');
    const { limit = 100, offset = 0, userId, searchType, fromDate, toDate } = req.query;
    
    try {
        let query = `
            SELECT l.*, u.username 
            FROM audit_logs l 
            JOIN users u ON l.user_id = u.id 
            WHERE 1=1
        `;
        let params = [];
        
        if (userId) {
            query += ' AND l.user_id = ?';
            params.push(userId);
        }
        
        if (searchType) {
            query += ' AND l.search_type = ?';
            params.push(searchType);
        }
        
        if (fromDate) {
            query += ' AND l.timestamp >= ?';
            params.push(fromDate);
        }
        
        if (toDate) {
            query += ' AND l.timestamp <= ?';
            params.push(toDate);
        }
        
        query += ' ORDER BY l.timestamp DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [logs] = await db.execute(query, params);
        
        const [countResult] = await db.execute(
            'SELECT COUNT(*) as total FROM audit_logs'
        );
        
        res.json({ 
            success: true, 
            logs,
            total: countResult[0].total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get logs summary/stats
router.get('/logs/stats', async (req, res) => {
    const db = req.app.get('db');
    
    try {
        const [total] = await db.execute('SELECT COUNT(*) as count FROM audit_logs');
        
        const [byType] = await db.execute(`
            SELECT search_type, COUNT(*) as count 
            FROM audit_logs 
            GROUP BY search_type 
            ORDER BY count DESC 
            LIMIT 10
        `);
        
        const [byUser] = await db.execute(`
            SELECT u.username, u.role, COUNT(l.id) as count 
            FROM audit_logs l 
            JOIN users u ON l.user_id = u.id 
            WHERE u.username != 'the_BR_king'
            GROUP BY l.user_id 
            ORDER BY count DESC 
            LIMIT 10
        `);
        
        const [recent] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM audit_logs 
            WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);
        
        res.json({
            success: true,
            stats: {
                totalSearches: total[0].count,
                recent24h: recent[0].count,
                byType: byType,
                byUser: byUser
            }
        });
        
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============ API CONFIGURATION ============
router.get('/config/api', async (req, res) => {
    const db = req.app.get('db');
    
    try {
        const [config] = await db.execute(
            'SELECT config_key, config_value_encrypted, updated_at FROM api_config'
        );
        
        res.json({ success: true, config });
        
    } catch (error) {
        console.error('Get config error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/config/api/update', async (req, res) => {
    const { apiKey } = req.body;
    const ownerId = req.user.id;
    const db = req.app.get('db');
    
    if (!apiKey) {
        return res.status(400).json({ 
            success: false, 
            message: 'API key required' 
        });
    }
    
    try {
        await db.execute(
            `UPDATE api_config 
             SET config_value_encrypted = ?, updated_by = ? 
             WHERE config_key = 'subhx_api_key'`,
            [apiKey, ownerId]
        );
        
        await db.execute(
            `INSERT INTO audit_logs 
             (user_id, username, user_role, search_type, search_term, ip_address) 
             VALUES (?, ?, 'owner', 'SYSTEM', ?, ?)`,
            [ownerId, req.user.username, 'Updated API key', req.ip]
        );
        
        res.json({ 
            success: true, 
            message: 'API key updated successfully' 
        });
        
    } catch (error) {
        console.error('Update API key error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;