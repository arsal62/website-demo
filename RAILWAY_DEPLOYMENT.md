# 🚀 Railway Deployment Guide

## Overview
This guide will help you deploy your Node.js backend to Railway, which will connect your admin panel to your frontend so students can see uploaded resources.

## 🎯 What We're Deploying
- **Backend API** with full functionality
- **Database** for storing resources and videos
- **File storage** for uploaded files
- **Admin authentication** system

## 📋 Prerequisites
1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Your code should be on GitHub
3. **Domain**: Your existing domain `olevelenglishguidance.com`

## 🚀 Step-by-Step Deployment

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Sign up with GitHub
4. Authorize Railway to access your repositories

### Step 2: Deploy Your Backend
1. **Select Repository**: Choose your GitHub repository
2. **Railway will automatically detect** it's a Node.js project
3. **Deploy**: Click "Deploy Now"

### Step 3: Configure Environment Variables
In your Railway project dashboard, add these environment variables:

```bash
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this
PORT=3000
```

### Step 4: Get Your Railway URL
After deployment, Railway will give you a URL like:
```
https://your-project-name.railway.app
```

### Step 5: Update Admin Panel
Once you have your Railway URL, update the admin panel:

1. **Edit `admin.html`**
2. **Find this line**:
   ```javascript
   const API_BASE_URL = window.location.hostname === 'localhost' 
       ? 'http://localhost:3001' 
       : 'https://your-railway-backend-url.railway.app';
   ```
3. **Replace** `'https://your-railway-backend-url.railway.app'` with your actual Railway URL

### Step 6: Update Frontend Pages
Update your frontend pages to use the Railway backend:

1. **Edit `resources-api.html`**
2. **Find the API_BASE_URL** and update it to your Railway URL
3. **Edit `videos-api.html`**
4. **Find the API_BASE_URL** and update it to your Railway URL

### Step 7: Test Your System
1. **Visit**: `https://olevelenglishguidance.com/admin.html`
2. **Login**: Use `admin` / `admin123`
3. **Upload**: Try uploading a test resource
4. **Check**: Visit `https://olevelenglishguidance.com/resources-api.html` to see if it appears

## 🔧 Configuration Details

### Database
- Railway automatically provides a PostgreSQL database
- Your SQLite database will be migrated automatically
- No additional setup needed

### File Storage
- Files are stored on Railway's persistent storage
- No additional configuration needed
- Files persist between deployments

### Environment Variables
```bash
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this
PORT=3000
```

## 🌐 Domain Configuration (Optional)

### Custom Domain Setup
1. **In Railway Dashboard**: Go to Settings → Domains
2. **Add Custom Domain**: Enter `api.olevelenglishguidance.com`
3. **Update DNS**: Add CNAME record pointing to your Railway URL
4. **Update Admin Panel**: Use the custom domain instead of Railway URL

## 📊 Monitoring & Logs

### View Logs
- **Railway Dashboard**: Go to your project → Deployments
- **Real-time logs**: Click on any deployment to see logs
- **Error tracking**: Monitor for any deployment issues

### Health Check
Your API includes a health check endpoint:
```
https://your-railway-url.railway.app/api/health
```

## 🔒 Security Considerations

### JWT Secret
- **Change the default JWT secret** in environment variables
- **Use a strong, random string**
- **Keep it secret** - don't commit it to GitHub

### Admin Credentials
- **Default**: `admin` / `admin123`
- **Change these** after first login
- **Add more admin users** through the database

## 🚨 Troubleshooting

### Common Issues

#### 1. Deployment Fails
- **Check logs** in Railway dashboard
- **Verify** all dependencies are in `package.json`
- **Ensure** `server.js` is the main file

#### 2. API Not Responding
- **Check Railway URL** is correct
- **Verify** environment variables are set
- **Test** health check endpoint

#### 3. File Uploads Not Working
- **Check** file size limits (100MB max)
- **Verify** upload directory permissions
- **Monitor** Railway logs for errors

#### 4. Database Issues
- **Check** Railway database connection
- **Verify** tables are created
- **Monitor** database logs

### Getting Help
1. **Railway Documentation**: [docs.railway.app](https://docs.railway.app)
2. **Railway Discord**: Join their community
3. **Check Logs**: Always check Railway logs first

## 🎉 Success Checklist

- [ ] Railway project created and deployed
- [ ] Environment variables configured
- [ ] Admin panel updated with Railway URL
- [ ] Frontend pages updated with Railway URL
- [ ] Admin login working
- [ ] Resource upload working
- [ ] Video upload working
- [ ] Students can see uploaded content
- [ ] Health check endpoint responding

## 🔄 Updates & Maintenance

### Updating Your Backend
1. **Push changes** to GitHub
2. **Railway automatically** redeploys
3. **Monitor** deployment logs
4. **Test** functionality after deployment

### Scaling
- **Railway automatically** scales based on traffic
- **No manual configuration** needed
- **Monitor** usage in Railway dashboard

## 💰 Cost Considerations

### Railway Pricing
- **Free Tier**: $5 credit monthly
- **Pay-as-you-go**: After free tier
- **Typical cost**: $5-20/month for small projects

### Cost Optimization
- **Monitor usage** in Railway dashboard
- **Optimize** file uploads (compress videos)
- **Clean up** unused files regularly

---

## 🎯 Next Steps

1. **Deploy to Railway** following this guide
2. **Test all functionality**
3. **Update your students** about the new system
4. **Monitor** usage and performance
5. **Consider** adding more features

Your students will now be able to see all resources and videos you upload through the admin panel! 🎉
