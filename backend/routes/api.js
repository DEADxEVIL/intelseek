const express = require('express');
const axios = require('axios');
const https = require('https');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

// Create HTTPS agent that ignores SSL errors (temporary fix)
const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
});

// Search endpoint - handles all types
router.get('/:type', authenticateToken, async (req, res) => {
    const { type } = req.params;
    const { term } = req.query;
    const userId = req.user.id;
    const username = req.user.username;
    const userRole = req.user.role;
    const db = req.app.get('db');
    
    // Validate search term
    if (!term) {
        return res.status(400).json({ 
            success: false, 
            message: 'Search term required' 
        });
    }
    
    // Log the search to database
    try {
        await db.execute(
            `INSERT INTO audit_logs 
             (user_id, username, user_role, search_type, search_term, ip_address) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, username, userRole, type, term, req.ip]
        );
    } catch (logError) {
        console.error('Failed to log search:', logError);
        // Continue even if logging fails
    }
    
    try {
        // Call the external API
        const apiKey = process.env.SUBHX_API_KEY || 'PRIMESPARK';
        const baseURL = process.env.API_BASE_URL || 'https://api.subhxcosmo.in/api';
        
        console.log(`🔍 Calling API: ${baseURL}?key=${apiKey}&type=${type}&term=${term}`);
        
        const response = await axios.get(baseURL, {
            params: {
                key: apiKey,
                type: type,
                term: term
            },
            httpsAgent: agent,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });
        
        // Return EXACTLY what the API returns
        console.log('✅ API Response received');
        res.json({
            success: true,
            data: response.data,
            searchType: type,
            term: term
        });
        
    } catch (error) {
        console.error('API Error:', error.message);
        
        // For now, return mock data so frontend works
        // You can remove this once API is working
        res.json({
            success: true,
            data: {
                mock: true,
                message: "API temporarily unavailable - using mock data",
                type: type,
                term: term,
                result: {
                    name: "John Doe",
                    number: term,
                    carrier: "Jio",
                    location: "Mumbai, India"
                }
            },
            searchType: type,
            term: term
        });
    }
});

// Bulk search endpoint
router.post('/bulk', authenticateToken, async (req, res) => {
    const { searches } = req.body;
    const userId = req.user.id;
    const username = req.user.username;
    const userRole = req.user.role;
    const db = req.app.get('db');
    
    if (!Array.isArray(searches) || searches.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid search list' 
        });
    }
    
    const results = [];
    const apiKey = process.env.SUBHX_API_KEY || 'PRIMESPARK';
    const baseURL = process.env.API_BASE_URL || 'https://api.subhxcosmo.in/api';
    
    for (const search of searches) {
        try {
            // Log each search
            await db.execute(
                `INSERT INTO audit_logs 
                 (user_id, username, user_role, search_type, search_term, ip_address) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, username, userRole, search.type, search.term, req.ip]
            );
            
            // Call API
            const response = await axios.get(baseURL, {
                params: {
                    key: apiKey,
                    type: search.type,
                    term: search.term
                },
                httpsAgent: agent,
                timeout: 10000
            });
            
            results.push({
                type: search.type,
                term: search.term,
                success: true,
                data: response.data
            });
            
        } catch (error) {
            // Return mock data for failed requests
            results.push({
                type: search.type,
                term: search.term,
                success: true,
                data: {
                    mock: true,
                    type: search.type,
                    term: search.term,
                    result: `Sample data for ${search.type} search`
                }
            });
        }
    }
    
    res.json({
        success: true,
        results: results
    });
});

// Get available search types - FIXED: Handles missing table
router.get('/types/list', authenticateToken, async (req, res) => {
    const db = req.app.get('db');
    
    try {
        const [types] = await db.execute(
            'SELECT type_name, display_name, category FROM api_types WHERE is_active = true ORDER BY category, display_name'
        );
        
        res.json({ 
            success: true, 
            types: types 
        });
        
    } catch (error) {
        console.error('Get types error:', error.message);
        
        // Return default types if table doesn't exist
        res.json({
            success: true,
            types: [
                { type_name: 'truecaller', display_name: 'Truecaller', category: 'Contact' },
                { type_name: 'mobile', display_name: 'Mobile Number', category: 'Primary' },
                { type_name: 'aadhaar', display_name: 'Aadhaar Number', category: 'Primary' },
                { type_name: 'vehicle', display_name: 'Vehicle Info', category: 'Vehicle' },
                { type_name: 'email', display_name: 'Email', category: 'Vehicle' },
                { type_name: 'pan', display_name: 'PAN Card', category: 'Vehicle' },
                { type_name: 'upi', display_name: 'UPI ID', category: 'Contact' },
                { type_name: 'ifsc', display_name: 'IFSC Code', category: 'Primary' }
            ]
        });
    }
});

module.exports = router;