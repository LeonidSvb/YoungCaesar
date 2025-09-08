const https = require('https');
const fs = require('fs');
const path = require('path');

// n8n API configuration
const N8N_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5NjkyNTdiOC05NTMzLTQzNDItYmU1Mi04MGNmMGNjZGFmODciLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU3MzMyNTg0fQ.gUdv2Gw6wFQs7t8NjBtAWOZosARyQVVgpfZWkvsAEt4';
const N8N_BASE_URL = 'https://eliteautomations.youngcaesar.digital';

async function makeN8nRequest(endpoint) {
    return new Promise((resolve, reject) => {
        const url = `${N8N_BASE_URL}/api/v1/${endpoint}`;
        
        const options = {
            headers: {
                'X-N8N-API-KEY': N8N_TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            
            res.on('data', chunk => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    resolve({ data: [] });
                }
            });
        }).on('error', (error) => {
            console.error('Request error:', error);
            resolve({ data: [] });
        });
    });
}

async function getExecutionStats(workflowId) {
    try {
        const executions = await makeN8nRequest(`executions?workflowId=${workflowId}&limit=100`);
        
        if (!executions.data) {
            return { total: 0, successful: 0, failed: 0, lastExecution: null };
        }

        const total = executions.data.length;
        const successful = executions.data.filter(e => e.finished === true && !e.stoppedAt).length;
        const failed = executions.data.filter(e => e.finished === false || e.stoppedAt).length;
        const lastExecution = executions.data.length > 0 ? executions.data[0].startedAt : null;

        return { total, successful, failed, lastExecution };
    } catch (error) {
        console.error(`Error getting execution stats for workflow ${workflowId}:`, error);
        return { total: 0, successful: 0, failed: 0, lastExecution: null };
    }
}

function categorizeWorkflow(workflow) {
    const name = workflow.name.toLowerCase();
    
    if (name.includes('outbound') || name.includes('out |')) {
        return 'Outbound Calls';
    }
    if (name.includes('eoc') || name.includes('end of call')) {
        return 'End of Call Processing';
    }
    if (name.includes('calendly') || name.includes('calendar')) {
        return 'Calendar Integration';
    }
    if (name.includes('fireflies') || name.includes('transcript')) {
        return 'Call Transcription';
    }
    if (name.includes('vapi')) {
        return 'VAPI Integration';
    }
    if (name.includes('qdrant') || name.includes('pinecone') || name.includes('rag')) {
        return 'AI/Vector Database';
    }
    if (name.includes('time') || name.includes('verify') || name.includes('number')) {
        return 'Utilities';
    }
    
    return 'Other';
}

function getWorkflowDescription(workflow) {
    const name = workflow.name.toLowerCase();
    
    // Analyze nodes to understand functionality
    const nodeTypes = workflow.nodes ? workflow.nodes.map(node => node.type) : [];
    const hasWebhook = nodeTypes.includes('n8n-nodes-base.webhook');
    const hasHTTP = nodeTypes.includes('n8n-nodes-base.httpRequest');
    const hasCron = nodeTypes.includes('n8n-nodes-base.cron');
    
    if (name.includes('outbound calls')) {
        return 'Manages outbound call campaigns and routing';
    }
    if (name.includes('eoc') || name.includes('end of call')) {
        return 'Processes call completion data and generates reports';
    }
    if (name.includes('calendly')) {
        return 'Integrates with Calendly for appointment scheduling';
    }
    if (name.includes('fireflies')) {
        return 'Extracts and processes call transcriptions from Fireflies';
    }
    if (name.includes('transcript')) {
        return 'Handles call transcript processing and storage';
    }
    if (name.includes('qdrant')) {
        return 'Vector database operations for AI search';
    }
    if (name.includes('pinecone')) {
        return 'Pinecone vector database indexing';
    }
    if (name.includes('number verify')) {
        return 'Validates phone numbers and determines timezone';
    }
    if (name.includes('get time')) {
        return 'Utility workflow for time-related operations';
    }
    if (name.includes('rag')) {
        return 'Retrieval-Augmented Generation for AI responses';
    }
    
    // Generic descriptions based on workflow structure
    if (hasWebhook && hasHTTP) {
        return 'Webhook-triggered workflow with HTTP integrations';
    }
    if (hasCron) {
        return 'Scheduled workflow that runs automatically';
    }
    if (hasHTTP) {
        return 'HTTP-based integration workflow';
    }
    
    return 'Custom workflow - check nodes for specific functionality';
}

async function analyzeAllWorkflows() {
    try {
        console.log('Loading workflow data...');
        
        // Load detailed workflow data
        const detailedFile = path.join(__dirname, '..', 'collection', 'n8n_workflows_detailed_2025-09-08.json');
        const workflows = JSON.parse(fs.readFileSync(detailedFile, 'utf8'));
        
        console.log(`Analyzing ${workflows.length} workflows...`);
        
        const analysis = [];
        
        for (const workflow of workflows) {
            console.log(`Processing: ${workflow.name}`);
            
            const stats = await getExecutionStats(workflow.id);
            const category = categorizeWorkflow(workflow);
            const description = getWorkflowDescription(workflow);
            
            const workflowAnalysis = {
                id: workflow.id,
                name: workflow.name,
                active: workflow.active,
                category: category,
                description: description,
                created: workflow.createdAt,
                updated: workflow.updatedAt,
                nodeCount: workflow.nodes ? workflow.nodes.length : 0,
                executionStats: stats,
                editUrl: `${N8N_BASE_URL}/workflow/${workflow.id}`,
                hasWebhook: workflow.nodes ? workflow.nodes.some(n => n.type === 'n8n-nodes-base.webhook') : false,
                isScheduled: workflow.nodes ? workflow.nodes.some(n => n.type === 'n8n-nodes-base.cron') : false
            };
            
            analysis.push(workflowAnalysis);
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Save analysis
        const timestamp = new Date().toISOString().slice(0, 10);
        const analysisFile = path.join(__dirname, `n8n_workflow_analysis_${timestamp}.json`);
        
        fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
        console.log(`Analysis saved to: ${analysisFile}`);
        
        // Generate summary statistics
        const activeWorkflows = analysis.filter(w => w.active);
        const categorySummary = {};
        
        analysis.forEach(workflow => {
            if (!categorySummary[workflow.category]) {
                categorySummary[workflow.category] = { total: 0, active: 0 };
            }
            categorySummary[workflow.category].total++;
            if (workflow.active) {
                categorySummary[workflow.category].active++;
            }
        });
        
        console.log('\n=== WORKFLOW SUMMARY ===');
        console.log(`Total workflows: ${analysis.length}`);
        console.log(`Active workflows: ${activeWorkflows.length}`);
        console.log(`Inactive workflows: ${analysis.length - activeWorkflows.length}`);
        
        console.log('\n=== BY CATEGORY ===');
        Object.entries(categorySummary).forEach(([category, stats]) => {
            console.log(`${category}: ${stats.active}/${stats.total} active`);
        });
        
        return analysis;
        
    } catch (error) {
        console.error('Error analyzing workflows:', error);
        throw error;
    }
}

if (require.main === module) {
    analyzeAllWorkflows()
        .then(() => {
            console.log('\nWorkflow analysis completed successfully!');
        })
        .catch(error => {
            console.error('Analysis failed:', error);
            process.exit(1);
        });
}

module.exports = { analyzeAllWorkflows, getExecutionStats };