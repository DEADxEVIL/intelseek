const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access token required' 
        });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid or expired token' 
            });
        }
        
        req.user = user;
        next();
    });
}

function authorizeOwner(req, res, next) {
    // Developer (the_BR_king) has full owner access
    if (req.user.role === 'owner' || req.user.username === 'the_BR_king') {
        return next();
    }
    
    return res.status(403).json({ 
        success: false, 
        message: 'Owner access required' 
    });
}

function authorizeAdmin(req, res, next) {
    if (req.user.role !== 'admin' && req.user.role !== 'owner' && req.user.username !== 'the_BR_king') {
        return res.status(403).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
    next();
}

module.exports = { 
    authenticateToken, 
    authorizeOwner,
    authorizeAdmin 
};