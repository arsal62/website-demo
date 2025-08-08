const express = require('express');
const multer = require('multer');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
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

// Database setup - Railway compatible with lowdb
const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'db.json');
const adapter = new FileSync(dbPath);
const db = low(adapter);

// Set default data structure
db.defaults({
    users: [],
    resources: [],
    video_resources: []
}).write();

// Create uploads directory if it doesn't exist
const uploadsDir = process.env.UPLOAD_PATH || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize database with default admin user
try {
    const users = db.get('users').value();
    if (users.length === 0) {
        const defaultPassword = bcrypt.hashSync('admin123', 10);
        db.get('users').push({
            id: 1,
            username: 'admin',
            password: defaultPassword,
            email: 'admin@example.com',
            created_at: new Date().toISOString()
        }).write();
        console.log('Default admin user created');
    } else {
        console.log('Admin user already exists');
    }
    console.log('Database initialized successfully');
} catch (err) {
    console.error('Error initializing database:', err);
}

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

// Root endpoint for Railway health check
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Dr. Kamran Website API is running',
        timestamp: new Date().toISOString()
    });
});

// Simple test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Test endpoint working',
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    try {
        const user = db.get('users').find({ username }).value();

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
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
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get resources with pagination
app.get('/api/resources', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        const { level, subject, paper, category } = req.query;
        let resources = db.get('resources').value();
        
        // Apply filters
        if (level) {
            resources = resources.filter(r => r.level === level);
        }
        if (subject) {
            resources = resources.filter(r => r.subject === subject);
        }
        if (paper) {
            resources = resources.filter(r => r.paper === paper);
        }
        if (category) {
            resources = resources.filter(r => r.category === category);
        }

        // Sort by upload date
        resources.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));

        const total = resources.length;
        const totalPages = Math.ceil(total / limit);
        const paginatedResources = resources.slice(offset, offset + limit);

        res.json({
            resources: paginatedResources,
            pagination: {
                current: page,
                total: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                totalItems: total
            }
        });
    } catch (err) {
        console.error('Get resources error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get videos with pagination
app.get('/api/videos', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        const { level, subject, paper, category } = req.query;
        let videos = db.get('video_resources').value();
        
        // Apply filters
        if (level) {
            videos = videos.filter(v => v.level === level);
        }
        if (subject) {
            videos = videos.filter(v => v.subject === subject);
        }
        if (paper) {
            videos = videos.filter(v => v.paper === paper);
        }
        if (category) {
            videos = videos.filter(v => v.category === category);
        }

        // Sort by upload date
        videos.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));

        const total = videos.length;
        const totalPages = Math.ceil(total / limit);
        const paginatedVideos = videos.slice(offset, offset + limit);

        res.json({
            videos: paginatedVideos,
            pagination: {
                current: page,
                total: totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                totalItems: total
            }
        });
    } catch (err) {
        console.error('Get videos error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Upload resource
app.post('/api/upload-resource', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const { title, description, level, subject, paper, category } = req.body;

        const newResource = {
            id: Date.now(),
            title,
            description,
            filename: req.file.filename,
            original_filename: req.file.originalname,
            file_size: req.file.size,
            level,
            subject,
            paper,
            category,
            upload_date: new Date().toISOString(),
            download_count: 0
        };

        db.get('resources').push(newResource).write();

        res.json({
            message: 'Resource uploaded successfully',
            id: newResource.id
        });
    } catch (err) {
        console.error('Upload resource error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Upload video
app.post('/api/upload-video', authenticateToken, upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), (req, res) => {
    if (!req.files.video) {
        return res.status(400).json({ error: 'No video uploaded' });
    }

    try {
        const { title, description, duration, level, subject, paper, category } = req.body;
        const videoFile = req.files.video[0];
        const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;

        const newVideo = {
            id: Date.now(),
            title,
            description,
            filename: videoFile.filename,
            original_filename: videoFile.originalname,
            thumbnail_filename: thumbnailFile ? thumbnailFile.filename : null,
            duration,
            file_size: videoFile.size,
            level,
            subject,
            paper,
            category,
            upload_date: new Date().toISOString(),
            view_count: 0
        };

        db.get('video_resources').push(newVideo).write();

        res.json({
            message: 'Video uploaded successfully',
            id: newVideo.id
        });
    } catch (err) {
        console.error('Upload video error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Download resource
app.get('/api/download/:id', (req, res) => {
    try {
        const { id } = req.params;

        const resource = db.get('resources').find({ id: parseInt(id) }).value();

        if (!resource) {
            return res.status(404).json({ error: 'Resource not found' });
        }

        const filePath = path.join(uploadsDir, resource.filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Increment download count
        db.get('resources')
            .find({ id: parseInt(id) })
            .assign({ download_count: resource.download_count + 1 })
            .write();

        res.download(filePath, resource.original_filename);
    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Stream video
app.get('/api/stream/:id', (req, res) => {
    try {
        const { id } = req.params;

        const video = db.get('video_resources').find({ id: parseInt(id) }).value();

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const filePath = path.join(uploadsDir, video.filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Increment view count
        db.get('video_resources')
            .find({ id: parseInt(id) })
            .assign({ view_count: video.view_count + 1 })
            .write();

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
    } catch (err) {
        console.error('Stream error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete resource
app.delete('/api/resource/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        const resource = db.get('resources').find({ id: parseInt(id) }).value();

        if (!resource) {
            return res.status(404).json({ error: 'Resource not found' });
        }

        const filePath = path.join(uploadsDir, resource.filename);
        
        // Delete file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete from database
        db.get('resources').remove({ id: parseInt(id) }).write();

        res.json({ message: 'Resource deleted successfully' });
    } catch (err) {
        console.error('Delete resource error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Delete video
app.delete('/api/video/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        const video = db.get('video_resources').find({ id: parseInt(id) }).value();

        if (!video) {
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
        db.get('video_resources').remove({ id: parseInt(id) }).write();

        res.json({ message: 'Video deleted successfully' });
    } catch (err) {
        console.error('Delete video error:', err);
        res.status(500).json({ error: 'Database error' });
    }
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Root endpoint: http://localhost:${PORT}/`);
}); 