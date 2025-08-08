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

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// JWT Secret
const JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';

// Database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
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

// Session configuration
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './'
    }),
    secret: 'your-session-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
const videoUploadsDir = path.join(__dirname, 'uploads', 'videos');
const resourceUploadsDir = path.join(__dirname, 'uploads', 'resources');
const thumbnailsDir = path.join(__dirname, 'uploads', 'thumbnails');

[uploadsDir, videoUploadsDir, resourceUploadsDir, thumbnailsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'video') {
            cb(null, videoUploadsDir);
        } else if (file.fieldname === 'thumbnail') {
            cb(null, thumbnailsDir);
        } else {
            cb(null, resourceUploadsDir);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: function (req, file, cb) {
        // Allow specific file types
        const allowedTypes = {
            'resource': ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt'],
            'video': ['.mp4', '.avi', '.mov', '.wmv', '.flv'],
            'thumbnail': ['.jpg', '.jpeg', '.png', '.gif']
        };
        
        const fieldType = file.fieldname;
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes[fieldType] && allowedTypes[fieldType].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type for ${fieldType}. Allowed types: ${allowedTypes[fieldType].join(', ')}`));
        }
    }
});

// Authentication middleware
function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1] || req.session.token;
    
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ message: 'Invalid token.' });
    }
}

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        req.session.token = token;
        
        res.json({ 
            message: 'Login successful',
            token: token,
            user: { id: user.id, username: user.username, email: user.email }
        });
    });
});

// Admin logout endpoint
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logout successful' });
});

// Upload resource endpoint
app.post('/api/admin/upload-resource', authenticateToken, upload.single('resource'), (req, res) => {
    try {
        const { title, description, level, subject, paper, category } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        const filePath = req.file.path;
        const fileSize = req.file.size;
        const fileType = path.extname(req.file.originalname);
        
        const sql = `INSERT INTO resources (title, description, file_path, file_size, file_type, level, subject, paper, category) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(sql, [title, description, filePath, fileSize, fileType, level, subject, paper, category], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error saving resource to database' });
            }
            
            res.json({ 
                message: 'Resource uploaded successfully',
                resourceId: this.lastID
            });
        });
        
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Upload video resource endpoint
app.post('/api/admin/upload-video', authenticateToken, upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), (req, res) => {
    try {
        const { title, description, level, subject, paper, category, duration } = req.body;
        
        if (!req.files.video) {
            return res.status(400).json({ message: 'No video file uploaded' });
        }
        
        const videoPath = req.files.video[0].path;
        const thumbnailPath = req.files.thumbnail ? req.files.thumbnail[0].path : null;
        
        const sql = `INSERT INTO video_resources (title, description, video_url, thumbnail_path, duration, level, subject, paper, category) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        db.run(sql, [title, description, videoPath, thumbnailPath, duration, level, subject, paper, category], function(err) {
            if (err) {
                return res.status(500).json({ message: 'Error saving video to database' });
            }
            
            res.json({ 
                message: 'Video uploaded successfully',
                videoId: this.lastID
            });
        });
        
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all resources endpoint
app.get('/api/resources', (req, res) => {
    const { level, subject, paper, category, page = 1, limit = 10 } = req.query;
    
    let sql = 'SELECT * FROM resources WHERE 1=1';
    let params = [];
    
    if (level) {
        sql += ' AND level = ?';
        params.push(level);
    }
    if (subject) {
        sql += ' AND subject = ?';
        params.push(subject);
    }
    if (paper) {
        sql += ' AND paper = ?';
        params.push(paper);
    }
    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    
    sql += ' ORDER BY upload_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    db.all(sql, params, (err, resources) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        
        // Get total count for pagination
        let countSql = 'SELECT COUNT(*) as total FROM resources WHERE 1=1';
        let countParams = [];
        
        if (level) {
            countSql += ' AND level = ?';
            countParams.push(level);
        }
        if (subject) {
            countSql += ' AND subject = ?';
            countParams.push(subject);
        }
        if (paper) {
            countSql += ' AND paper = ?';
            countParams.push(paper);
        }
        if (category) {
            countSql += ' AND category = ?';
            countParams.push(category);
        }
        
        db.get(countSql, countParams, (err, countResult) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            
            res.json({
                resources: resources,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(countResult.total / parseInt(limit)),
                    totalItems: countResult.total,
                    itemsPerPage: parseInt(limit)
                }
            });
        });
    });
});

// Get all video resources endpoint
app.get('/api/video-resources', (req, res) => {
    const { level, subject, paper, category, page = 1, limit = 10 } = req.query;
    
    let sql = 'SELECT * FROM video_resources WHERE 1=1';
    let params = [];
    
    if (level) {
        sql += ' AND level = ?';
        params.push(level);
    }
    if (subject) {
        sql += ' AND subject = ?';
        params.push(subject);
    }
    if (paper) {
        sql += ' AND paper = ?';
        params.push(paper);
    }
    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    
    sql += ' ORDER BY upload_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    db.all(sql, params, (err, videos) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        
        // Get total count for pagination
        let countSql = 'SELECT COUNT(*) as total FROM video_resources WHERE 1=1';
        let countParams = [];
        
        if (level) {
            countSql += ' AND level = ?';
            countParams.push(level);
        }
        if (subject) {
            countSql += ' AND subject = ?';
            countParams.push(subject);
        }
        if (paper) {
            countSql += ' AND paper = ?';
            countParams.push(paper);
        }
        if (category) {
            countSql += ' AND category = ?';
            countParams.push(category);
        }
        
        db.get(countSql, countParams, (err, countResult) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            
            res.json({
                videos: videos,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(countResult.total / parseInt(limit)),
                    totalItems: countResult.total,
                    itemsPerPage: parseInt(limit)
                }
            });
        });
    });
});

// Download resource endpoint
app.get('/api/resources/:id/download', (req, res) => {
    const resourceId = req.params.id;
    
    db.get('SELECT * FROM resources WHERE id = ?', [resourceId], (err, resource) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        
        if (!resource) {
            return res.status(404).json({ message: 'Resource not found' });
        }
        
        // Update download count
        db.run('UPDATE resources SET download_count = download_count + 1 WHERE id = ?', [resourceId]);
        
        // Send file
        res.download(resource.file_path, path.basename(resource.file_path));
    });
});

// Serve video files
app.get('/api/videos/:id', (req, res) => {
    const videoId = req.params.id;
    
    db.get('SELECT * FROM video_resources WHERE id = ?', [videoId], (err, video) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        
        if (!video) {
            return res.status(404).json({ message: 'Video not found' });
        }
        
        // Update view count
        db.run('UPDATE video_resources SET view_count = view_count + 1 WHERE id = ?', [videoId]);
        
        // Send video file
        res.sendFile(video.video_url);
    });
});

// Delete resource endpoint (admin only)
app.delete('/api/admin/resources/:id', authenticateToken, (req, res) => {
    const resourceId = req.params.id;
    
    db.get('SELECT * FROM resources WHERE id = ?', [resourceId], (err, resource) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        
        if (!resource) {
            return res.status(404).json({ message: 'Resource not found' });
        }
        
        // Delete file from filesystem
        fs.unlink(resource.file_path, (err) => {
            if (err && err.code !== 'ENOENT') {
                console.error('Error deleting file:', err);
            }
            
            // Delete from database
            db.run('DELETE FROM resources WHERE id = ?', [resourceId], (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Error deleting resource' });
                }
                
                res.json({ message: 'Resource deleted successfully' });
            });
        });
    });
});

// Delete video resource endpoint (admin only)
app.delete('/api/admin/videos/:id', authenticateToken, (req, res) => {
    const videoId = req.params.id;
    
    db.get('SELECT * FROM video_resources WHERE id = ?', [videoId], (err, video) => {
        if (err) {
            return res.status(500).json({ message: 'Database error' });
        }
        
        if (!video) {
            return res.status(404).json({ message: 'Video not found' });
        }
        
        // Delete files from filesystem
        const deletePromises = [];
        
        if (video.video_url) {
            deletePromises.push(new Promise((resolve) => {
                fs.unlink(video.video_url, (err) => {
                    if (err && err.code !== 'ENOENT') {
                        console.error('Error deleting video file:', err);
                    }
                    resolve();
                });
            }));
        }
        
        if (video.thumbnail_path) {
            deletePromises.push(new Promise((resolve) => {
                fs.unlink(video.thumbnail_path, (err) => {
                    if (err && err.code !== 'ENOENT') {
                        console.error('Error deleting thumbnail file:', err);
                    }
                    resolve();
                });
            }));
        }
        
        Promise.all(deletePromises).then(() => {
            // Delete from database
            db.run('DELETE FROM video_resources WHERE id = ?', [videoId], (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Error deleting video' });
                }
                
                res.json({ message: 'Video deleted successfully' });
            });
        });
    });
});

// Create email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'arsalkamran62@gmail.com',
        pass: 'ldwl moqr dtzi mnxj'
    },
    tls: {
        rejectUnauthorized: false
    }
});

// API endpoint for contact form
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        
        console.log('Received form submission:', { name, email });
        
        if (!name || !email || !message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide name, email, and message' 
            });
        }
        
        const mailOptions = {
            from: `"Contact Form" <arsalkamran62@gmail.com>`,
            to: 'arsalkamran62@gmail.com',
            replyTo: email,
            subject: `New Contact Form Submission from ${name}`,
            text: `
                Name: ${name}
                Email: ${email}
                
                Message:
                ${message}
            `,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 5px;">
                    <h2 style="color: #3498db;">New Contact Form Submission</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                    <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
                        <h3 style="margin-top: 0;">Message:</h3>
                        <p style="white-space: pre-line;">${message}</p>
                    </div>
                </div>
            `
        };
        
        console.log('Attempting to send email...');
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.response);
        
        res.status(200).json({ 
            success: true, 
            message: 'Your message has been sent successfully!' 
        });
        
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send message. Please try again later.' 
        });
    }
});

// Handle root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Admin panel available at: http://localhost:${PORT}/admin.html`);
    console.log(`Default admin credentials: username: admin, password: admin123`);
}); 