const https = require('https');
require('dotenv').config();

// n8n API configuration
const N8N_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5NjkyNTdiOC05NTMzLTQzNDItYmU1Mi04MGNmMGNjZGFmODciLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU3MzMyNTg0fQ.gUdv2Gw6wFQs7t8NjBtAWOZosARyQVVgpfZWkvsAEt4';
const N8N_BASE_URL = 'https://eliteautomations.youngcaesar.digital';

async function debugN8nAPI() {
    return new Promise((resolve, reject) => {
        const url = `${N8N_BASE_URL}/api/v1/workflows`;
        console.log('Testing URL:', url);
        
        const options = {
            headers: {
                'Authorization': `Bearer ${N8N_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'n8n-workflow-collector'
            }
        };

        console.log('Request headers:', options.headers);

        const req = https.get(url, options, (res) => {
            console.log('Response status:', res.statusCode);
            console.log('Response headers:', res.headers);
            
            let data = '';
            
            res.on('data', chunk => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('Raw response data:', data);
                
                try {
                    const jsonData = JSON.parse(data);
                    console.log('Parsed JSON:', JSON.stringify(jsonData, null, 2));
                    resolve(jsonData);
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    console.log('Raw data that failed to parse:', data);
                    reject(error);
                }
            });
        });
        
        req.on('error', (error) => {
            console.error('Request error:', error);
            reject(error);
        });
        
        req.setTimeout(10000, () => {
            console.error('Request timeout');
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// Test different endpoints
async function testEndpoints() {
    const endpoints = [
        'workflows',
        'workflows?active=true',
        'workflows?limit=100',
        'me',
        'settings'
    ];
    
    for (const endpoint of endpoints) {
        console.log(`\n=== Testing endpoint: ${endpoint} ===`);
        try {
            await new Promise((resolve, reject) => {
                const url = `${N8N_BASE_URL}/api/v1/${endpoint}`;
                
                const options = {
                    headers: {
                        'Authorization': `Bearer ${N8N_TOKEN}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                };

                https.get(url, options, (res) => {
                    console.log(`Status: ${res.statusCode}`);
                    
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        console.log(`Response: ${data.substring(0, 200)}${data.length > 200 ? '...' : ''}`);
                        resolve();
                    });
                }).on('error', (error) => {
                    console.error(`Error: ${error.message}`);
                    resolve();
                });
            });
        } catch (error) {
            console.error(`Failed to test ${endpoint}:`, error.message);
        }
    }
}

if (require.main === module) {
    console.log('Starting n8n API debug...');
    testEndpoints()
        .then(() => {
            console.log('\nDebug completed');
        })
        .catch(error => {
            console.error('Debug failed:', error);
        });
}