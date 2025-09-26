const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function convertHtmlToPdf() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // HTML files to convert
  const htmlFiles = [
    'dashboards/vapi_dashboard.html',
    'dashboards/client-report-sep3-2025.html', 
    'dashboards/client-report-sep3-2025-bg.html'
  ];

  for (const htmlFile of htmlFiles) {
    const filePath = path.resolve(__dirname, '..', htmlFile);
    const outputPath = filePath.replace('.html', '.pdf');

    console.log(`Converting ${htmlFile} to PDF...`);
    
    // Load HTML file
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle' });
    
    // Wait for any dynamic content
    await page.waitForTimeout(2000);
    
    // Generate PDF with proper settings
    await page.pdf({
      path: outputPath,
      format: 'A4',
      margin: {
        top: '20px',
        right: '20px', 
        bottom: '20px',
        left: '20px'
      },
      printBackground: true, // Critical for CSS styles
      preferCSSPageSize: false
    });

    console.log(`✓ Created: ${outputPath}`);
  }

  await browser.close();
  console.log('\n🎉 All PDF files created successfully!');
}

convertHtmlToPdf().catch(console.error);