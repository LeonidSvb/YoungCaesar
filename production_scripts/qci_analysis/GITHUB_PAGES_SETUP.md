# GitHub Pages Setup for QCI Dashboard

## Problem
GitHub Pages cannot load JSON files via fetch() due to CORS restrictions.

## Solution Options

### 1. Static Dashboard (Recommended)
**Use the generated static dashboard that embeds data directly:**

```bash
# Generate static dashboard (automatically done after QCI analysis)
node create_static_dashboard.js
```

**File created:** `dashboard/qci_static_dashboard_YYYY-MM-DDTHH-mm-ss.html`

**GitHub Pages URL:**
```
https://leonidsvb.github.io/YoungCaesar/production_scripts/qci_analysis/dashboard/qci_static_dashboard_[timestamp].html
```

### 2. Enable GitHub Pages
1. Go to repository Settings
2. Scroll to "Pages" section
3. Select "Deploy from a branch"
4. Choose "main" branch and "/ (root)" folder
5. Save

### 3. Access Dashboard
After GitHub Pages is enabled, access via:
```
https://leonidsvb.github.io/YoungCaesar/production_scripts/qci_analysis/dashboard/qci_static_dashboard_[latest].html
```

## Alternative: Deploy to Vercel

### Option A: Quick Deploy
1. Fork repository to your GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Deploy

**Dashboard URL:** `https://your-project.vercel.app/production_scripts/qci_analysis/dashboard/qci_dashboard_template.html`

### Option B: Vercel CLI
```bash
npm i -g vercel
cd C:\Users\79818\Desktop\Vapi
vercel
```

## Files Generated

### Interactive Dashboard (needs server)
- `qci_dashboard_template.html` - Template with fetch()
- `qci_dashboard_[timestamp].html` - Timestamped copies

### Static Dashboard (GitHub Pages ready)
- `qci_static_dashboard_[timestamp].html` - Self-contained with embedded data

## Usage

### Local Development
```bash
# Start server
node ../../simple_server.js

# View interactive dashboard
http://localhost:8080/production_scripts/qci_analysis/dashboard/qci_dashboard_template.html
```

### Production (GitHub Pages)
- Use static dashboard files
- No server needed
- Works directly on GitHub Pages

### Production (Vercel)
- Both static and interactive work
- Automatic HTTPS
- Custom domain support

## Automation

The QCI analyzer now automatically:
1. ✅ Creates `latest.json` for interactive dashboard
2. ✅ Generates timestamped interactive dashboard
3. ✅ Creates static dashboard for GitHub Pages
4. ✅ Provides URLs for both local and GitHub access

## Recommendation

**For sharing with clients:** Use GitHub Pages with static dashboard
**For development:** Use local server with interactive dashboard
**For production with custom domain:** Use Vercel