# Upload Functionality Testing Guide

## How to Test Upload Functionality

### 1. Start the Backend Server
```bash
cd "C:\Users\Arsal Kamran\Desktop\papa web 2"
node server.js
```
Server will run on http://localhost:3001

### 2. Test the System

#### Option A: Use the Test Page
1. Open `test-upload.html` in your browser
2. Follow the 4-step testing process:
   - Step 1: Test server health
   - Step 2: Login (username: `admin`, password: `admin123`)
   - Step 3: Upload a test file
   - Step 4: Verify resources display

#### Option B: Use the Admin Panel
1. Open `admin.html` in your browser
2. Login with credentials:
   - Username: `admin`
   - Password: `admin123`
3. Use the "Upload Study Resource" section to upload files
4. Fill in all required fields:
   - Title
   - Level (O Level/A Level)
   - Subject (English)
   - Paper (Paper 1/Paper 2)
   - Category (Reading/Writing/Listening/Speaking/Past Papers/Worksheets)
   - File (PDF, DOC, DOCX, TXT)
   - Description (optional)

### 3. Verify Student Access
1. Open `resources-api.html` in your browser
2. Navigate through the level > subject > paper > category hierarchy
3. Verify uploaded resources appear and can be downloaded

## Current Upload Configuration

### File Storage
- Files are stored in the `./uploads/` directory
- Resources go to `./uploads/` (directly)
- Videos go to `./uploads/` (directly)
- Thumbnails go to `./uploads/thumbnails/`

### Database
- Resources are stored in SQLite database (`database.sqlite`)
- Tables: `resources` and `video_resources`
- Tracks metadata, download counts, and upload dates

### API Endpoints
- **Upload Resource:** `POST /api/upload-resource` (requires authentication)
- **Upload Video:** `POST /api/upload-video` (requires authentication)
- **Get Resources:** `GET /api/resources?level=X&subject=Y&paper=Z&category=W`
- **Download Resource:** `GET /api/download/:id`
- **Stream Video:** `GET /api/stream/:id`

### File Access for Students
- Direct file access: `http://localhost:3001/uploads/filename`
- Tracked downloads via API: `http://localhost:3001/api/download/:id`
- Video streaming: `http://localhost:3001/api/stream/:id`

## Troubleshooting

### Common Issues:
1. **Server not starting:** Check if port 3001 is available
2. **Upload failing:** Ensure you're logged in and token is valid
3. **Files not accessible:** Check uploads directory permissions
4. **Database errors:** Ensure SQLite database is writable

### File Size Limits:
- Maximum file size: 100MB (configured in server.js line 124-127)

### Supported File Types:
- **Resources:** PDF, DOC, DOCX, TXT
- **Videos:** All video formats
- **Thumbnails:** All image formats

## Security Notes
- Authentication required for uploads
- JWT tokens expire after 24 hours
- Default admin credentials should be changed in production
- File uploads are validated by type and size