const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const mysql = require('mysql2/promise');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const ownerRoutes = require('./routes/owner');
const adminRoutes = require('./routes/admin');

// Import middleware
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));

// CORS configuration - Allow both local and production frontends
app.use(cors({
    origin: [
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'http://localhost:3000',
        'https://intelseek.onrender.com',
        'https://intelseek-backend.onrender.com'
    ],
    credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting
app.use('/api/auth/', authLimiter);
app.use('/api/', apiLimiter);

// Database connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'intelseek_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

// Add SSL for production (Railway MySQL requires SSL)
if (process.env.NODE_ENV === 'production') {
    dbConfig.ssl = {
        rejectUnauthorized: false
    };
    console.log('🔒 SSL enabled for production database connection');
}

// Create database connection pool
const pool = mysql.createPool(dbConfig);

// Make db available to routes
app.set('db', pool);

// Test database connection with retry logic
async function testDbConnection(retries = 5, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = await pool.getConnection();
            console.log('✅ Database connected successfully');
            console.log(`📊 Connected to: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
            connection.release();
            return true;
        } catch (error) {
            console.error(`❌ Database connection attempt ${i + 1}/${retries} failed:`, error.message);
            if (i < retries - 1) {
                console.log(`⏳ Retrying in ${delay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    console.error('❌ All database connection attempts failed');
    console.log('⚠️  Continuing without database - some features may not work');
    return false;
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/search', apiRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/admin', adminRoutes);

// Serve static files from frontend (project root)
app.use(express.static(path.join(__dirname, '..')));

// Catch-all route to serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    await testDbConnection();
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing database connections...');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing database connections...');
    await pool.end();
    process.exit(0);
});

module.exports = app;