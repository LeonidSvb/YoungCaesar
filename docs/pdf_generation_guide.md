# PDF Generation Guide

## Method 1: Playwright Automation (Recommended)

### Setup:
```bash
npm install playwright
npx playwright install chromium
```

### Script: `scripts/html_to_pdf.js`
```javascript
const { chromium } = require('playwright');
const path = require('path');

async function convertHtmlToPdf() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const htmlFiles = [
    'dashboards/vapi_dashboard.html',
    'dashboards/client-report-sep3-2025.html', 
    'dashboards/client-report-sep3-2025-bg.html'
  ];

  for (const htmlFile of htmlFiles) {
    const filePath = path.resolve(__dirname, '..', htmlFile);
    const outputPath = filePath.replace('.html', '.pdf');

    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.pdf({
      path: outputPath,
      format: 'A4',
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      printBackground: true, // Critical for CSS styles
      preferCSSPageSize: false
    });
  }

  await browser.close();
}
```

### Usage:
```bash
node scripts/html_to_pdf.js
```

## Method 2: Browser Print (Manual)

### Chrome/Edge Steps:
1. Open HTML file in browser
2. `Ctrl+P` → Print
3. **Destination:** Save as PDF
4. **More settings:**
   - Paper size: A4
   - Margins: Minimum 
   - **Graphics:** ✅ (important!)
   - **Background graphics:** ✅ (critical for styles!)
5. Save

## Method 3: Command Line Tools

### wkhtmltopdf:
```bash
wkhtmltopdf --enable-local-file-access dashboard.html output.pdf
```

### Puppeteer:
```javascript
const puppeteer = require('puppeteer');
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`);
await page.pdf({ path: 'output.pdf', format: 'A4', printBackground: true });
```

## Best Practices

1. **Always enable background graphics** for CSS styles
2. **Wait for dynamic content** to load (2-3 seconds)
3. **Use A4 format** for professional documents
4. **Set minimal margins** for full content visibility
5. **Test with different browsers** for consistency

## Troubleshooting

- **Missing styles:** Enable "Background graphics"
- **Cut-off content:** Adjust margins and page size
- **Poor quality:** Use higher DPI settings
- **Charts not rendering:** Add wait time for JavaScript execution