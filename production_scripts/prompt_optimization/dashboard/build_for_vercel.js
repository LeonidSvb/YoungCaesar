#!/usr/bin/env node
/**
 * Build script for Vercel deployment
 * Embeds all run data directly into HTML for static hosting
 */

const fs = require('fs');
const path = require('path');

// Read the HTML template
const htmlPath = path.join(__dirname, 'index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Read all run data files
const runsDir = path.join(__dirname, 'data', 'runs');
const runFiles = fs.readdirSync(runsDir).filter(f => f.endsWith('.json'));

console.log(`Building Vercel version with ${runFiles.length} embedded runs...`);

// Build the embedded data object
const embeddedData = {};
runFiles.forEach(file => {
    const runId = file.replace('.json', '');
    const filePath = path.join(runsDir, file);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        embeddedData[runId] = data;
        console.log(`✅ Embedded run: ${runId}`);
    } catch (error) {
        console.error(`❌ Failed to load ${file}: ${error.message}`);
    }
});

// Find the location where allRunData is defined
const dataMarker = '                    // REAL analysis data\n                    this.allRunData = {';
const endMarker = '};';

// Find the start position
const startIndex = htmlContent.indexOf(dataMarker);
if (startIndex === -1) {
    console.error('Could not find data marker in HTML!');
    process.exit(1);
}

// Find the end of the allRunData object
let bracketCount = 0;
let inObject = false;
let endIndex = -1;

for (let i = startIndex + dataMarker.length; i < htmlContent.length; i++) {
    const char = htmlContent[i];

    if (char === '{') {
        bracketCount++;
        inObject = true;
    } else if (char === '}') {
        bracketCount--;
        if (inObject && bracketCount === -1) {
            endIndex = i;
            break;
        }
    }
}

if (endIndex === -1) {
    console.error('Could not find end of allRunData object!');
    process.exit(1);
}

// Build the new embedded data string
const embeddedDataString = Object.entries(embeddedData).map(([runId, data]) => {
    // Minimize the JSON by removing unnecessary whitespace
    const minifiedData = JSON.stringify(data);
    return `                        "${runId}": ${minifiedData}`;
}).join(',\n');

// Replace the allRunData content
const newDataSection = `                    // REAL analysis data
                    this.allRunData = {
${embeddedDataString}
                    }`;

// Construct the new HTML
const newHtml = htmlContent.substring(0, startIndex) +
                 newDataSection +
                 htmlContent.substring(endIndex);

// Write the production version
const outputPath = path.join(__dirname, 'index-vercel.html');
fs.writeFileSync(outputPath, newHtml);

console.log(`\n✨ Vercel build complete!`);
console.log(`📦 Embedded ${Object.keys(embeddedData).length} runs`);
console.log(`📄 Output: index-vercel.html`);
console.log(`\nTo deploy to Vercel:`);
console.log(`1. Rename index-vercel.html to index.html`);
console.log(`2. Deploy the dashboard folder to Vercel`);
console.log(`3. All data will be pre-loaded, no file fetching needed!`);