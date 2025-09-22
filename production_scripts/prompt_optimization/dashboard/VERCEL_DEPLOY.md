# VAPI Prompt Optimization Dashboard - Vercel Deployment

## 🚀 Quick Deploy

1. **Build for production:**
   ```bash
   node build_vercel.js
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

3. **Done!** Your dashboard is live with all data embedded.

## 📁 Files for Deployment

- `index-vercel.html` - Production version with embedded data
- `vercel.json` - Vercel configuration
- `build_vercel.js` - Build script

## ✨ Features

### 🔧 Self-Contained
- All run data (231KB) embedded directly in HTML
- No external file dependencies
- Works offline once loaded

### 🎯 Auto-Loading
- Automatically loads latest run on page load
- Click any run in history to switch analytics
- Professional white theme
- Real assistant names (BIESSE-MS, QC Advisor, Alex1, etc.)

### 📊 Data Included
- **2025-09-22_11-24-53** - 11 assistants, 1069 calls (175KB)
- **2025-09-22_10-42-48** - 7 assistants, 1069 calls (51KB)
- **2025-09-22_14-30** - Analysis data (5KB)

## 🔄 Updating Data

When new runs are available:

1. Copy new run files to `data/runs/`
2. Update `data/manifest.json`
3. Run `node build_vercel.js`
4. Deploy: `vercel --prod`

## 🌐 Vercel Configuration

The `vercel.json` handles:
- Route all requests to index-vercel.html
- Cache for 24 hours
- Proper content-type headers

## 🎛️ Dashboard Features

### History Tab
- List of all runs with metadata
- Click to load run analytics
- Visual indicators for active run

### Analytics Tab
- Assistant selector with real names
- QCI breakdown by category
- Call statistics and performance
- Recommendations with priority levels

### Progress Tab
- Assistant-specific optimization timeline
- Visual progress charts
- Historical improvements

## 💻 Local Testing

```bash
# Test the Vercel build locally
npx http-server . -p 8080

# Open http://localhost:8080/index-vercel.html
```

## 🚨 Important Notes

- **No server required** - Pure static hosting
- **Fast loading** - All data pre-loaded
- **Mobile responsive** - Works on all devices
- **Professional styling** - Clean white theme

The dashboard will work perfectly on Vercel without any additional configuration!