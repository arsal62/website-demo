const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const fs = require('fs');
const serverless = require('serverless-http');

// Initialize Express app
const app = express();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Database setup for Netlify
const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    // Users table for admin authentication
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
        } else {
            console.log('Users table created successfully');
            
            // Create default admin user if not exists
            const defaultPassword = bcrypt.hashSync('admin123', 10);
            db.run(`INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)`, 
                ['admin', defaultPassword, 'admin@example.com'], (err) => {
                    if (err) {
                        console.error('Error creating admin user:', err);
                    } else {
                        console.log('Admin user created successfully');
                    }
                });
        }
    });

    // Resources table
    db.run(`CREATE TABLE IF NOT EXISTS resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        file_type TEXT,
        level TEXT NOT NULL,
        subject TEXT NOT NULL,
        paper TEXT NOT NULL,
        category TEXT NOT NULL,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        download_count INTEGER DEFAULT 0
    )`, (err) => {
        if (err) {
            console.error('Error creating resources table:', err);
        } else {
            console.log('Resources table created successfully');
        }
    });

    // Video resources table
    db.run(`CREATE TABLE IF NOT EXISTS video_resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        video_url TEXT NOT NULL,
        thumbnail_path TEXT,
        duration TEXT,
        level TEXT NOT NULL,
        subject TEXT NOT NULL,
        paper TEXT NOT NULL,
        category TEXT NOT NULL,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        view_count INTEGER DEFAULT 0
    )`, (err) => {
        if (err) {
            console.error('Error creating video_resources table:', err);
        } else {
            console.log('Video resources table created successfully');
        }
    });
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration for Netlify
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: '/tmp'
    }),
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Create uploads directories
const uploadsDir = path.join(__dirname, '../uploads');
const resourcesDir = path.join(uploadsDir, 'resources');
const videosDir = path.join(uploadsDir, 'videos');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

[uploadsDir, resourcesDir, videosDir, thumbnailsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = resourcesDir;
        
        if (file.fieldname === 'video') {
            uploadPath = videosDir;
        } else if (file.fieldname === 'thumbnail') {
            uploadPath = thumbnailsDir;
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/ogg'];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
    }
});

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

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    });
});

// Resource upload endpoint
app.post('/api/upload-resource', authenticateToken, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { title, description, level, subject, paper, category } = req.body;
        
        const resource = {
            title,
            description,
            file_path: req.file.path,
            file_size: req.file.size,
            file_type: req.file.mimetype,
            level,
            subject,
            paper,
            category
        };

        db.run(`INSERT INTO resources (title, description, file_path, file_size, file_type, level, subject, paper, category) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [resource.title, resource.description, resource.file_path, resource.file_size, resource.file_type, resource.level, resource.subject, resource.paper, resource.category],
            function(err) {
                if (err) {
                    console.error('Error inserting resource:', err);
                    return res.status(500).json({ error: 'Failed to save resource' });
                }
                
                res.json({ 
                    message: 'Resource uploaded successfully',
                    id: this.lastID,
                    resource: { ...resource, id: this.lastID }
                });
            }
        );
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Video upload endpoint
app.post('/api/upload-video', authenticateToken, upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), (req, res) => {
    try {
        if (!req.files.video) {
            return res.status(400).json({ error: 'No video uploaded' });
        }

        const { title, description, level, subject, paper, category, duration } = req.body;
        
        const video = {
            title,
            description,
            video_url: req.files.video[0].path,
            thumbnail_path: req.files.thumbnail ? req.files.thumbnail[0].path : null,
            duration,
            level,
            subject,
            paper,
            category
        };

        db.run(`INSERT INTO video_resources (title, description, video_url, thumbnail_path, duration, level, subject, paper, category) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [video.title, video.description, video.video_url, video.thumbnail_path, video.duration, video.level, video.subject, video.paper, video.category],
            function(err) {
                if (err) {
                    console.error('Error inserting video:', err);
                    return res.status(500).json({ error: 'Failed to save video' });
                }
                
                res.json({ 
                    message: 'Video uploaded successfully',
                    id: this.lastID,
                    video: { ...video, id: this.lastID }
                });
            }
        );
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Get resources endpoint
app.get('/api/resources', (req, res) => {
    const { page = 1, limit = 10, level, subject, paper, category } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM resources WHERE 1=1';
    let params = [];
    
    if (level) {
        query += ' AND level = ?';
        params.push(level);
    }
    if (subject) {
        query += ' AND subject = ?';
        params.push(subject);
    }
    if (paper) {
        query += ' AND paper = ?';
        params.push(paper);
    }
    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }
    
    query += ' ORDER BY upload_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    db.all(query, params, (err, resources) => {
        if (err) {
            console.error('Error fetching resources:', err);
            return res.status(500).json({ error: 'Failed to fetch resources' });
        }
        
        // Get total count
        db.get('SELECT COUNT(*) as total FROM resources', (err, result) => {
            if (err) {
                console.error('Error counting resources:', err);
                return res.status(500).json({ error: 'Failed to count resources' });
            }
            
            res.json({
                resources,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(result.total / limit),
                    hasNext: parseInt(page) < Math.ceil(result.total / limit),
                    hasPrev: parseInt(page) > 1
                }
            });
        });
    });
});

// Get videos endpoint
app.get('/api/videos', (req, res) => {
    const { page = 1, limit = 10, level, subject, paper, category } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM video_resources WHERE 1=1';
    let params = [];
    
    if (level) {
        query += ' AND level = ?';
        params.push(level);
    }
    if (subject) {
        query += ' AND subject = ?';
        params.push(subject);
    }
    if (paper) {
        query += ' AND paper = ?';
        params.push(paper);
    }
    if (category) {
        query += ' AND category = ?';
        params.push(category);
    }
    
    query += ' ORDER BY upload_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    db.all(query, params, (err, videos) => {
        if (err) {
            console.error('Error fetching videos:', err);
            return res.status(500).json({ error: 'Failed to fetch videos' });
        }
        
        // Get total count
        db.get('SELECT COUNT(*) as total FROM video_resources', (err, result) => {
            if (err) {
                console.error('Error counting videos:', err);
                return res.status(500).json({ error: 'Failed to count videos' });
            }
            
            res.json({
                videos,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(result.total / limit),
                    hasNext: parseInt(page) < Math.ceil(result.total / limit),
                    hasPrev: parseInt(page) > 1
                }
            });
        });
    });
});

// Download/stream resource endpoint
app.get('/api/download/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM resources WHERE id = ?', [id], (err, resource) => {
        if (err || !resource) {
            return res.status(404).json({ error: 'Resource not found' });
        }
        
        // Increment download count
        db.run('UPDATE resources SET download_count = download_count + 1 WHERE id = ?', [id]);
        
        // Stream the file
        const filePath = path.resolve(resource.file_path);
        res.download(filePath, resource.title + path.extname(resource.file_path));
    });
});

// Stream video endpoint
app.get('/api/stream/:id', (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM video_resources WHERE id = ?', [id], (err, video) => {
        if (err || !video) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        // Increment view count
        db.run('UPDATE video_resources SET view_count = view_count + 1 WHERE id = ?', [id]);
        
        // Stream the video
        const filePath = path.resolve(video.video_url);
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;
        
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
            const chunksize = (end-start) + 1;
            const file = fs.createReadStream(filePath, {start, end});
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(200, head);
            fs.createReadStream(filePath).pipe(res);
        }
    });
});

// Delete resource endpoint
app.delete('/api/resource/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM resources WHERE id = ?', [id], (err, resource) => {
        if (err || !resource) {
            return res.status(404).json({ error: 'Resource not found' });
        }
        
        // Delete file
        try {
            fs.unlinkSync(resource.file_path);
        } catch (error) {
            console.error('Error deleting file:', error);
        }
        
        // Delete from database
        db.run('DELETE FROM resources WHERE id = ?', [id], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to delete resource' });
            }
            res.json({ message: 'Resource deleted successfully' });
        });
    });
});

// Delete video endpoint
app.delete('/api/video/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT * FROM video_resources WHERE id = ?', [id], (err, video) => {
        if (err || !video) {
            return res.status(404).json({ error: 'Video not found' });
        }
        
        // Delete files
        try {
            fs.unlinkSync(video.video_url);
            if (video.thumbnail_path) {
                fs.unlinkSync(video.thumbnail_path);
            }
        } catch (error) {
            console.error('Error deleting files:', error);
        }
        
        // Delete from database
        db.run('DELETE FROM video_resources WHERE id = ?', [id], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to delete video' });
            }
            res.json({ message: 'Video deleted successfully' });
        });
    });
});

// Contact form endpoint
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;
    
    // Configure nodemailer (you'll need to set up your email credentials)
    const transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    
    const mailOptions = {
        from: email,
        to: 'your-email@example.com', // Change this to your email
        subject: `Contact from ${name}`,
        text: message,
        html: `<h3>Contact Form Submission</h3><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong> ${message}</p>`
    };
    
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Email error:', error);
            return res.status(500).json({ error: 'Failed to send email' });
        }
        res.json({ message: 'Email sent successfully' });
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Export for Netlify Functions
module.exports.handler = serverless(app);
