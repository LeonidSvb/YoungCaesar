#!/usr/bin/env node
/**
 * Build script for Vercel deployment
 * Creates a self-contained HTML with all data embedded
 */

const fs = require('fs');
const path = require('path');

// Read the HTML template
const htmlPath = path.join(__dirname, 'index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Read all run data files
const runsDir = path.join(__dirname, 'data', 'runs');
const runFiles = fs.readdirSync(runsDir).filter(f => f.endsWith('.json'));

console.log(`\n🚀 Building Vercel version with ${runFiles.length} embedded runs...\n`);

// Build the embedded data object
const embeddedData = {};
let totalSize = 0;

runFiles.forEach(file => {
    const runId = file.replace('.json', '');
    const filePath = path.join(runsDir, file);
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        embeddedData[runId] = data;
        totalSize += fileContent.length;
        console.log(`✅ Embedded run: ${runId} (${Math.round(fileContent.length/1024)}KB)`);
    } catch (error) {
        console.error(`❌ Failed to load ${file}: ${error.message}`);
    }
});

// Create a standalone script that will be injected
const embeddedDataScript = `
    <script>
        // EMBEDDED DATA FOR VERCEL DEPLOYMENT
        window.VAPI_EMBEDDED_RUNS = ${JSON.stringify(embeddedData, null, 2)};
        console.log('Loaded ${Object.keys(embeddedData).length} embedded runs (${Math.round(totalSize/1024)}KB total)');
    </script>
`;

// Find where to inject the script (before the main script tag)
let mainScriptIndex = htmlContent.indexOf('function vapiDashboard()');
if (mainScriptIndex === -1) {
    console.error('Could not find main script tag!');
    process.exit(1);
}
// Find the <script> tag before the function
mainScriptIndex = htmlContent.lastIndexOf('<script>', mainScriptIndex);

// Insert the embedded data script
const newHtml = htmlContent.slice(0, mainScriptIndex) +
                embeddedDataScript + '\n    ' +
                htmlContent.slice(mainScriptIndex);

// Also modify the loadRun function to use embedded data first
const modifiedHtml = newHtml.replace(
    'async loadRun(runId) {',
    `async loadRun(runId) {
                    // Check for embedded data first (Vercel deployment)
                    if (window.VAPI_EMBEDDED_RUNS && window.VAPI_EMBEDDED_RUNS[runId]) {
                        console.log('Using embedded data for run:', runId);
                        this.processRunData(window.VAPI_EMBEDDED_RUNS[runId]);
                        this.activeTab = 'analytics';
                        this.selectedAssistantId = '';
                        this.selectedAssistant = null;
                        return;
                    }`
);

// Also update the init to load embedded runs
const finalHtml = modifiedHtml.replace(
    'async init() {',
    `async init() {
                    // Load embedded runs if available (Vercel deployment)
                    if (window.VAPI_EMBEDDED_RUNS) {
                        console.log('Using embedded runs for Vercel deployment');
                        const runs = Object.keys(window.VAPI_EMBEDDED_RUNS).map(runId => {
                            const data = window.VAPI_EMBEDDED_RUNS[runId];
                            return {
                                id: runId,
                                timestamp: data.metadata?.generated_at || new Date().toISOString(),
                                assistants: data.metadata?.assistants_processed || 0,
                                totalCalls: Object.values(data.recommendations || {}).reduce((sum, r) =>
                                    sum + (r.current_performance?.total_calls || 0), 0),
                                avgQCI: 0,
                                status: 'completed',
                                duration: parseFloat(data.metadata?.processing_time || '0'),
                                cost: parseFloat(data.metadata?.total_cost || '0')
                            };
                        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                        this.runs = runs;
                        if (runs.length > 0) {
                            await this.loadRun(runs[0].id);
                        }
                        return;
                    }`
);

// Write the production version
const outputPath = path.join(__dirname, 'index-vercel.html');
fs.writeFileSync(outputPath, finalHtml);

console.log(`\n✨ Vercel build complete!`);
console.log(`📦 Embedded ${Object.keys(embeddedData).length} runs (${Math.round(totalSize/1024)}KB total)`);
console.log(`📄 Output: index-vercel.html`);
console.log(`\n📌 Next steps for Vercel deployment:`);
console.log(`1. Test locally: open index-vercel.html in browser`);
console.log(`2. Deploy to Vercel: vercel --prod`);
console.log(`3. All data is embedded - no file fetching needed!`);
console.log(`\n💡 The dashboard will work offline once loaded!`);