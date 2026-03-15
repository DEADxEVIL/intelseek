const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

// All admin routes require authentication
router.use(authenticateToken);

// ============ PROFILE MANAGEMENT ============

// Get own profile
router.get('/profile', async (req, res) => {
    const db = req.app.get('db');
    const userId = req.user.id;
    
    try {
        const [users] = await db.execute(
            `SELECT id, username, role, created_at, last_login, is_active 
             FROM users WHERE id = ?`,
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        res.json({ success: true, profile: users[0] });
        
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Change own password
router.post('/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const db = req.app.get('db');
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
            success: false, 
            message: 'Current password and new password required' 
        });
    }
    
    try {
        // Get user with password
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
        
        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Current password is incorrect' 
            });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        await db.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [hashedPassword, userId]
        );
        
        // Log the action
        await db.execute(
            `INSERT INTO audit_logs 
             (user_id, username, user_role, search_type, search_term, ip_address) 
             VALUES (?, ?, ?, 'PROFILE', ?, ?)`,
            [userId, req.user.username, 'admin', 'Password changed', req.ip]
        );
        
        res.json({ 
            success: true, 
            message: 'Password changed successfully' 
        });
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============ OWN AUDIT LOGS ============

// View ONLY own logs
router.get('/my-logs', async (req, res) => {
    const db = req.app.get('db');
    const userId = req.user.id;
    const { limit = 50, offset = 0, searchType, fromDate, toDate } = req.query;
    
    try {
        let query = `
            SELECT * FROM audit_logs 
            WHERE user_id = ?
        `;
        let params = [userId];
        
        if (searchType) {
            query += ' AND search_type = ?';
            params.push(searchType);
        }
        
        if (fromDate) {
            query += ' AND timestamp >= ?';
            params.push(fromDate);
        }
        
        if (toDate) {
            query += ' AND timestamp <= ?';
            params.push(toDate);
        }
        
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [logs] = await db.execute(query, params);
        
        // Get total count for pagination
        const [countResult] = await db.execute(
            'SELECT COUNT(*) as total FROM audit_logs WHERE user_id = ?',
            [userId]
        );
        
        res.json({ 
            success: true, 
            logs,
            total: countResult[0].total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
    } catch (error) {
        console.error('Get my logs error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get stats for own searches
router.get('/my-stats', async (req, res) => {
    const db = req.app.get('db');
    const userId = req.user.id;
    
    try {
        // Total searches
        const [total] = await db.execute(
            'SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ?',
            [userId]
        );
        
        // Searches by type
        const [byType] = await db.execute(`
            SELECT search_type, COUNT(*) as count 
            FROM audit_logs 
            WHERE user_id = ?
            GROUP BY search_type 
            ORDER BY count DESC 
            LIMIT 10
        `, [userId]);
        
        // Recent activity (last 24h)
        const [recent] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM audit_logs 
            WHERE user_id = ? AND timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `, [userId]);
        
        // Most searched terms
        const [topTerms] = await db.execute(`
            SELECT search_term, COUNT(*) as count 
            FROM audit_logs 
            WHERE user_id = ? AND search_term IS NOT NULL
            GROUP BY search_term 
            ORDER BY count DESC 
            LIMIT 5
        `, [userId]);
        
        res.json({
            success: true,
            stats: {
                totalSearches: total[0].count,
                recent24h: recent[0].count,
                byType: byType,
                topTerms: topTerms
            }
        });
        
    } catch (error) {
        console.error('Get my stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get available API types for search
router.get('/api-types', async (req, res) => {
    const db = req.app.get('db');
    
    try {
        const [types] = await db.execute(
            'SELECT type_name, display_name, category FROM api_types WHERE is_active = true ORDER BY category, display_name'
        );
        
        res.json({ success: true, types });
        
    } catch (error) {
        console.error('Get API types error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;