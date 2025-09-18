#!/usr/bin/env node
/**
 * DASHBOARD GENERATOR - Static HTML Dashboard Creator
 *
 * PURPOSE: Creates static HTML dashboards from recommendation data
 * USAGE: node src/dashboard_generator.js
 * INPUT: ../results/recommendations_latest.json
 * OUTPUT: ../dashboard/optimization_dashboard_TIMESTAMP.html
 *
 * AUTHOR: VAPI Team
 * CREATED: 2025-09-17
 * VERSION: 2.0.0 (see ../history.txt)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../../shared/logger');

const logger = createLogger('DASHBOARD');

// CONFIGURATION
const CONFIG = {
    INPUT: {
        RECOMMENDATIONS_DATA: '../results/recommendations_latest.json'
    },
    OUTPUT: {
        DIR: '../dashboard',
        FILE_PREFIX: 'optimization_dashboard'
    },
    OPTIONS: {
        INCLUDE_RAW_DATA: false,
        ENABLE_PROMPT_TOGGLE: true
    }
};

class DashboardGenerator {
    constructor() {
        this.recommendationsData = {};
        this.stats = {
            startTime: Date.now(),
            dashboardsGenerated: 0
        };
    }

    async loadRecommendationData() {
        logger.info('Loading recommendation data...');

        const dataPath = path.resolve(__dirname, CONFIG.INPUT.RECOMMENDATIONS_DATA);
        if (!fs.existsSync(dataPath)) {
            throw new Error(`Recommendation data not found: ${dataPath}`);
        }

        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        this.recommendationsData = data;

        logger.success(`Loaded recommendations for ${Object.keys(data.recommendations || {}).length} assistants`);
        return this.recommendationsData;
    }

    generateDashboardHTML() {
        logger.info('Generating HTML dashboard...');

        const { metadata, executive_summary, recommendations } = this.recommendationsData;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VAPI Prompt Optimization Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }

        .header {
            background: white;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .header h1 {
            color: #2d3748;
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }

        .summary-card {
            background: #f7fafc;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
        }

        .summary-number {
            font-size: 2rem;
            font-weight: 700;
            color: #48bb78;
        }

        .summary-label {
            color: #4a5568;
            margin-top: 5px;
        }

        .assistants-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .assistant-card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .assistant-name {
            font-size: 1.2rem;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 15px;
        }

        .qci-score {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .current-qci {
            font-size: 1.5rem;
            font-weight: 700;
            color: #e53e3e;
        }

        .target-qci {
            font-size: 1.5rem;
            font-weight: 700;
            color: #48bb78;
        }

        .recommendations-list {
            margin-top: 15px;
        }

        .recommendation-item {
            background: #f7fafc;
            border-left: 4px solid #48bb78;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 5px;
        }

        .recommendation-title {
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 5px;
        }

        .recommendation-impact {
            font-size: 0.9rem;
            color: #48bb78;
            font-weight: 600;
        }

        .priority-high { border-left-color: #e53e3e; }
        .priority-medium { border-left-color: #ed8936; }
        .priority-low { border-left-color: #4299e1; }

        .quick-wins {
            background: #c6f6d5;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
        }

        .quick-wins h3 {
            color: #22543d;
            margin-bottom: 15px;
        }

        .quick-win-item {
            background: white;
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>VAPI Prompt Optimization Dashboard</h1>
            <p>Generated: ${metadata?.generated_at ? new Date(metadata.generated_at).toLocaleString() : 'Unknown'}</p>

            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-number">${metadata?.assistants_processed || 0}</div>
                    <div class="summary-label">Assistants Analyzed</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${metadata?.target_improvement || 'N/A'}</div>
                    <div class="summary-label">Target Improvement</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">$${metadata?.total_cost || '0.00'}</div>
                    <div class="summary-label">Analysis Cost</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${executive_summary?.overview?.quick_wins_available || 0}</div>
                    <div class="summary-label">Quick Wins Available</div>
                </div>
            </div>
        </div>

        <!-- Quick Wins Section -->
        ${executive_summary?.quick_wins ? `
        <div class="quick-wins">
            <h3>🚀 Quick Wins - Implement First</h3>
            ${executive_summary.quick_wins.map(win => `
                <div class="quick-win-item">
                    <strong>${win.assistant}:</strong> ${win.action}
                    <span style="float: right; color: #48bb78; font-weight: 600;">${win.impact}</span>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- Assistants Grid -->
        <div class="assistants-grid">
            ${Object.values(recommendations || {}).map(assistant => this.generateAssistantCard(assistant)).join('')}
        </div>
    </div>
</body>
</html>`;

        return html;
    }

    generateAssistantCard(assistant) {
        const currentQCI = assistant.current_performance?.avg_qci || 0;
        const recommendations = assistant.recommendations?.priority_recommendations || [];
        const executiveSummary = assistant.recommendations?.executive_summary || {};

        return `
        <div class="assistant-card">
            <div class="assistant-name">${assistant.assistant_name}</div>

            <div class="qci-score">
                <div>
                    <div class="current-qci">${currentQCI.toFixed(1)}</div>
                    <div style="font-size: 0.8rem; color: #4a5568;">Current QCI</div>
                </div>
                <div style="font-size: 1.5rem; color: #4a5568;">→</div>
                <div>
                    <div class="target-qci">${executiveSummary.target_qci || (currentQCI + 15).toFixed(1)}</div>
                    <div style="font-size: 0.8rem; color: #4a5568;">Target QCI</div>
                </div>
            </div>

            <div class="recommendations-list">
                <h4 style="margin-bottom: 10px; color: #2d3748;">Priority Recommendations:</h4>
                ${recommendations.slice(0, 3).map(rec => `
                    <div class="recommendation-item priority-${rec.priority?.toLowerCase() || 'medium'}">
                        <div class="recommendation-title">${rec.title || 'Optimization Needed'}</div>
                        <div class="recommendation-impact">${rec.expected_impact || 'Impact TBD'}</div>
                    </div>
                `).join('')}
            </div>

            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 0.9rem; color: #4a5568;">
                <strong>Calls:</strong> ${assistant.current_performance?.total_calls || 0} |
                <strong>Success Rate:</strong> ${(assistant.current_performance?.success_rate || 0).toFixed(1)}%
            </div>
        </div>`;
    }

    async generateStaticDashboard() {
        const html = this.generateDashboardHTML();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const outputFile = `${CONFIG.OUTPUT.FILE_PREFIX}_${timestamp}.html`;
        const outputPath = path.resolve(__dirname, CONFIG.OUTPUT.DIR, outputFile);

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, html);
        this.stats.dashboardsGenerated++;

        logger.success(`📊 Static dashboard created: ${outputFile}`);
        return outputPath;
    }

    async generateReport() {
        logger.success('Dashboard generation complete!');
        logger.info(`📊 Dashboards generated: ${this.stats.dashboardsGenerated}`);
        logger.timing(((Date.now() - this.stats.startTime) / 1000).toFixed(1), 'seconds');

        return {
            dashboards_generated: this.stats.dashboardsGenerated,
            processing_time: ((Date.now() - this.stats.startTime) / 1000).toFixed(1) + 's'
        };
    }
}

// MAIN EXECUTION
async function main() {
    try {
        const generator = new DashboardGenerator();

        await generator.loadRecommendationData();
        await generator.generateStaticDashboard();

        return await generator.generateReport();
    } catch (error) {
        logger.error(`Dashboard generation failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = DashboardGenerator;