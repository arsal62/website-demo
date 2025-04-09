const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

// Create email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'arsalkamran62@gmail.com', // Your Gmail address
        pass: 'ldwl moqr dtzi mnxj' // Your app password
    },
    tls: {
        rejectUnauthorized: false // Accept self-signed certificates
    }
});

// API endpoint for contact form
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        
        console.log('Received form submission:', { name, email });
        
        // Validate input
        if (!name || !email || !message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide name, email, and message' 
            });
        }
        
        // Email options
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
        
        // Send email
        console.log('Attempting to send email...');
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.response);
        
        // Send success response
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
}); 