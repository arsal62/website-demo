const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('.'));

// Session configuration
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './'
    }),
    secret: process.env.JWT_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Database setup - Railway compatible
const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Create uploads directory if it doesn't exist
const uploadsDir = process.env.UPLOAD_PATH || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize database tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
        } else {
            // Create default admin user if not exists
            const defaultPassword = bcrypt.hashSync('admin123', 10);
            db.run(`INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)`,
                ['admin', defaultPassword, 'admin@example.com'],
                (err) => {
                    if (err) {
                        console.error('Error creating default admin:', err);
                    } else {
                        console.log('Default admin user created/verified');
                    }
                });
        }
    });

    // Resources table
    db.run(`CREATE TABLE IF NOT EXISTS resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_size INTEGER,
        level TEXT NOT NULL,
        subject TEXT NOT NULL,
        paper TEXT NOT NULL,
        category TEXT NOT NULL,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        download_count INTEGER DEFAULT 0
    )`, (err) => {
        if (err) console.error('Error creating resources table:', err);
    });

    // Video resources table
    db.run(`CREATE TABLE IF NOT EXISTS video_resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        thumbnail_filename TEXT,
        duration TEXT,
        file_size INTEGER,
        level TEXT NOT NULL,
        subject TEXT NOT NULL,
        paper TEXT NOT NULL,
        category TEXT NOT NULL,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        view_count INTEGER DEFAULT 0
    )`, (err) => {
        if (err) console.error('Error creating video_resources table:', err);
    });
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Authentication middleware
const authenticateToken = (req, res, next) => {
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
};

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err || !isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                }
            });
        });
    });
});

// Get resources with pagination
app.get('/api/resources', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const { level, subject, paper, category } = req.query;
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (level) {
        whereClause += ' AND level = ?';
        params.push(level);
    }
    if (subject) {
        whereClause += ' AND subject = ?';
        params.push(subject);
    }
    if (paper) {
        whereClause += ' AND paper = ?';
        params.push(paper);
    }
    if (category) {
        whereClause += ' AND category = ?';
        params.push(category);
    }

    // Get total count
    db.get(`SELECT COUNT(*) as total FROM resources ${whereClause}`, params, (err, countResult) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        const total = countResult.total;
        const totalPages = Math.ceil(total / limit);

        // Get resources
        db.all(`SELECT * FROM resources ${whereClause} ORDER BY upload_date DESC LIMIT ? OFFSET ?`, 
            [...params, limit, offset], (err, resources) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({
                resources,
                pagination: {
                    current: page,
                    total: totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1,
                    totalItems: total
                }
            });
        });
    });
});

// Get videos with pagination
app.get('/api/videos', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const { level, subject, paper, category } = req.query;
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (level) {
        whereClause += ' AND level = ?';
        params.push(level);
    }
    if (subject) {
        whereClause += ' AND subject = ?';
        params.push(subject);
    }
    if (paper) {
        whereClause += ' AND paper = ?';
        params.push(paper);
    }
    if (category) {
        whereClause += ' AND category = ?';
        params.push(category);
    }

    // Get total count
    db.get(`SELECT COUNT(*) as total FROM video_resources ${whereClause}`, params, (err, countResult) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        const total = countResult.total;
        const totalPages = Math.ceil(total / limit);

        // Get videos
        db.all(`SELECT * FROM video_resources ${whereClause} ORDER BY upload_date DESC LIMIT ? OFFSET ?`, 
            [...params, limit, offset], (err, videos) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({
                videos,
                pagination: {
                    current: page,
                    total: totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1,
                    totalItems: total
                }
            });
        });
    });
});

// Upload resource
app.post('/api/upload-resource', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description, level, subject, paper, category } = req.body;

    db.run(`INSERT INTO resources (title, description, filename, original_filename, file_size, level, subject, paper, category) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description, req.file.filename, req.file.originalname, req.file.size, level, subject, paper, category],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({
                message: 'Resource uploaded successfully',
                id: this.lastID
            });
        });
});

// Upload video
app.post('/api/upload-video', authenticateToken, upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), (req, res) => {
    if (!req.files.video) {
        return res.status(400).json({ error: 'No video uploaded' });
    }

    const { title, description, duration, level, subject, paper, category } = req.body;
    const videoFile = req.files.video[0];
    const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;

    db.run(`INSERT INTO video_resources (title, description, filename, original_filename, thumbnail_filename, duration, file_size, level, subject, paper, category) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description, videoFile.filename, videoFile.originalname, thumbnailFile ? thumbnailFile.filename : null, 
         duration, videoFile.size, level, subject, paper, category],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({
                message: 'Video uploaded successfully',
                id: this.lastID
            });
        });
});

// Download resource
app.get('/api/download/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM resources WHERE id = ?', [id], (err, resource) => {
        if (err || !resource) {
            return res.status(404).json({ error: 'Resource not found' });
        }

        const filePath = path.join(uploadsDir, resource.filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Increment download count
        db.run('UPDATE resources SET download_count = download_count + 1 WHERE id = ?', [id]);

        res.download(filePath, resource.original_filename);
    });
});

// Stream video
app.get('/api/stream/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM video_resources WHERE id = ?', [id], (err, video) => {
        if (err || !video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const filePath = path.join(uploadsDir, video.filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Increment view count
        db.run('UPDATE video_resources SET view_count = view_count + 1 WHERE id = ?', [id]);

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
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

// Delete resource
app.delete('/api/resource/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM resources WHERE id = ?', [id], (err, resource) => {
        if (err || !resource) {
            return res.status(404).json({ error: 'Resource not found' });
        }

        const filePath = path.join(uploadsDir, resource.filename);
        
        // Delete file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete from database
        db.run('DELETE FROM resources WHERE id = ?', [id], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ message: 'Resource deleted successfully' });
        });
    });
});

// Delete video
app.delete('/api/video/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM video_resources WHERE id = ?', [id], (err, video) => {
        if (err || !video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const videoPath = path.join(uploadsDir, video.filename);
        const thumbnailPath = video.thumbnail_filename ? path.join(uploadsDir, video.thumbnail_filename) : null;
        
        // Delete files
        if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
        }
        if (thumbnailPath && fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
        }

        // Delete from database
        db.run('DELETE FROM video_resources WHERE id = ?', [id], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            res.json({ message: 'Video deleted successfully' });
        });
    });
});

// Contact form endpoint
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;

    // Configure email transporter (you'll need to set up your email credentials)
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'your-email@example.com', // Change this to your email
        subject: `Contact Form Message from ${name}`,
        text: `
            Name: ${name}
            Email: ${email}
            Message: ${message}
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Email error:', error);
            return res.status(500).json({ error: 'Failed to send email' });
        }
        res.json({ message: 'Message sent successfully' });
    });
});

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
}); 