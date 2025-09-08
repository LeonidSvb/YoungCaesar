const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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
                    reject(error);
                }
            });
        }).on('error', (error) => {
            console.error('Request error:', error);
            reject(error);
        });
    });
}

async function getAllWorkflows() {
    try {
        console.log('Getting all workflows from n8n...');
        
        // Get all workflows
        const workflows = await makeN8nRequest('workflows');
        console.log(`Found ${workflows.data ? workflows.data.length : 0} workflows`);
        
        // Save raw workflows data
        const timestamp = new Date().toISOString().slice(0, 10);
        const outputFile = path.join(__dirname, `n8n_workflows_${timestamp}.json`);
        
        fs.writeFileSync(outputFile, JSON.stringify(workflows, null, 2));
        console.log(`Workflows saved to: ${outputFile}`);
        
        // Display workflow summary
        if (workflows.data) {
            console.log('\nWorkflow Summary:');
            console.log('================');
            
            workflows.data.forEach((workflow, index) => {
                console.log(`${index + 1}. ${workflow.name || 'Unnamed'}`);
                console.log(`   ID: ${workflow.id}`);
                console.log(`   Active: ${workflow.active || false}`);
                console.log(`   Created: ${workflow.createdAt || 'Unknown'}`);
                console.log(`   Updated: ${workflow.updatedAt || 'Unknown'}`);
                console.log('');
            });
        }
        
        return workflows;
        
    } catch (error) {
        console.error('Error getting workflows:', error);
        throw error;
    }
}

async function getWorkflowDetails(workflowId) {
    try {
        console.log(`Getting details for workflow ${workflowId}...`);
        const workflow = await makeN8nRequest(`workflows/${workflowId}`);
        return workflow;
    } catch (error) {
        console.error(`Error getting workflow ${workflowId}:`, error);
        throw error;
    }
}

async function getAllWorkflowsWithDetails() {
    try {
        const workflows = await getAllWorkflows();
        
        if (!workflows.data) {
            console.log('No workflows found');
            return;
        }
        
        console.log('\nGetting detailed information for each workflow...');
        const detailedWorkflows = [];
        
        for (const workflow of workflows.data) {
            try {
                const details = await getWorkflowDetails(workflow.id);
                detailedWorkflows.push(details);
                console.log(`✓ Got details for: ${workflow.name || workflow.id}`);
                
                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.log(`✗ Failed to get details for: ${workflow.name || workflow.id}`);
            }
        }
        
        // Save detailed workflows
        const timestamp = new Date().toISOString().slice(0, 10);
        const detailedFile = path.join(__dirname, `n8n_workflows_detailed_${timestamp}.json`);
        
        fs.writeFileSync(detailedFile, JSON.stringify(detailedWorkflows, null, 2));
        console.log(`\nDetailed workflows saved to: ${detailedFile}`);
        
        return detailedWorkflows;
        
    } catch (error) {
        console.error('Error getting detailed workflows:', error);
        throw error;
    }
}

// Run the collection
if (require.main === module) {
    getAllWorkflowsWithDetails()
        .then(() => {
            console.log('n8n workflow collection completed successfully!');
        })
        .catch(error => {
            console.error('Collection failed:', error);
            process.exit(1);
        });
}

module.exports = {
    getAllWorkflows,
    getWorkflowDetails,
    getAllWorkflowsWithDetails
};