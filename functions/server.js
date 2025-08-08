const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const serverless = require('serverless-http');

// Initialize Express app
const app = express();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// JWT Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

// API Routes
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Simple admin authentication
    if (username === 'admin' && password === 'admin123') {
        const token = jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ 
            token, 
            user: { id: 1, username: 'admin', email: 'admin@example.com' } 
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Get resources endpoint (mock data for now)
app.get('/api/resources', (req, res) => {
    const mockResources = [
        {
            id: 1,
            title: "Sample Resource",
            description: "This is a sample resource",
            level: "O Level",
            subject: "English",
            paper: "Paper 1",
            category: "Reading",
            upload_date: new Date().toISOString(),
            download_count: 0
        }
    ];
    
    res.json({
        resources: mockResources,
        pagination: {
            current: 1,
            total: 1,
            hasNext: false,
            hasPrev: false
        }
    });
});

// Get videos endpoint (mock data for now)
app.get('/api/videos', (req, res) => {
    const mockVideos = [
        {
            id: 1,
            title: "Sample Video",
            description: "This is a sample video",
            level: "O Level",
            subject: "English",
            paper: "Paper 1",
            category: "Speaking",
            upload_date: new Date().toISOString(),
            view_count: 0
        }
    ];
    
    res.json({
        videos: mockVideos,
        pagination: {
            current: 1,
            total: 1,
            hasNext: false,
            hasPrev: false
        }
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Export for Netlify Functions
module.exports.handler = serverless(app);
