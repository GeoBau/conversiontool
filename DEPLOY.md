# Deployment Guide for Portfolio Conversion Tool

## Server Requirements

- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn package manager
- 500 MB disk space (for catalogs and images)

## Installation Steps

### 1. Extract the ZIP file
```bash
unzip portfolio-conversion-tool.zip
cd portfolio-conversion-tool
```

### 2. Install Backend Dependencies
```bash
cd api
pip install flask flask-cors openpyxl pillow
cd ..
```

### 3. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

### 4. Build Frontend for Production
```bash
cd frontend
npm run build
cd ..
```

## Running the Application

### Option A: Development Mode (Testing)

**Terminal 1 - Backend:**
```bash
cd api
python app.py
```
Backend will run on: http://localhost:5000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend will run on: http://localhost:5173

### Option B: Production Mode

**1. Start Backend:**
```bash
cd api
python app.py
```
Backend runs on: http://localhost:5000

**2. Serve Frontend Build:**

Using Python's built-in server:
```bash
cd frontend/dist
python -m http.server 8080
```

Or use nginx/Apache to serve the `frontend/dist` folder.

**3. Configure API URL:**
If frontend and backend are on different hosts, set the environment variable:
```bash
export VITE_API_URL=http://your-backend-server:5000/api
```

## File Structure

```
portfolio-conversion-tool/
├── api/                      # Backend Flask application
│   ├── app.py               # Main Flask server
│   └── requirements.txt     # Python dependencies
├── frontend/                # React frontend
│   ├── src/                # Source code
│   ├── public/             # Static assets
│   ├── package.json        # Node dependencies
│   └── vite.config.ts      # Build configuration
├── ALVARIS_CATALOG/        # Alvaris catalog data
│   ├── alvaris-a.csv
│   ├── alvaris-a-images/
│   ├── alvaris-b.csv
│   └── alvaris-b-images/
├── ASK_CATALOG/            # ASK catalog data
│   ├── ASK-bosch.csv
│   ├── ASK-bosch-images/
│   ├── ASK-item.csv
│   └── ASK-item-images/
├── Portfolio_Syskomp_pA.csv  # Main data file
├── DEPLOY.md               # This file
└── deploy.bat              # Windows deployment script
```

## Troubleshooting

### Backend Issues
- Check Python version: `python --version` (should be 3.8+)
- Verify all dependencies installed: `pip list | grep -E "flask|openpyxl|pillow"`
- Check if Portfolio_Syskomp_pA.csv exists in root directory

### Frontend Issues
- Check Node version: `node --version` (should be 16+)
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`

### CORS Issues
If frontend and backend are on different domains:
- Backend automatically has CORS enabled in app.py
- Ensure VITE_API_URL environment variable is set correctly

## Production Deployment Notes

### Using Nginx (Recommended for Production)

1. Build frontend: `cd frontend && npm run build`
2. Copy `frontend/dist/*` to nginx web root (e.g., `/var/www/html`)
3. Configure nginx to proxy `/api` requests to Flask backend:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Using Vercel (Cloud Deployment)

The project includes `vercel.json` configuration:
```bash
vercel deploy
```

## Backup Recommendations

- Backup `Portfolio_Syskomp_pA.csv` regularly
- Automatic backups are created in `backups/` folder when saving changes
- Keep catalog files (ALVARIS_CATALOG, ASK_CATALOG) backed up

## Support

For issues, check:
1. Browser console for frontend errors (F12)
2. Backend terminal for Flask errors
3. Ensure all catalog CSV files have proper encoding (UTF-8)
