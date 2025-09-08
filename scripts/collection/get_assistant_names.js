require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function getAssistantNames() {
    try {
        console.log('🤖 Fetching assistant information from VAPI...');
        
        const response = await axios.get('https://api.vapi.ai/assistant', {
            headers: {
                'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const assistants = response.data;
        console.log(`📋 Found ${assistants.length} assistants`);

        // Create a mapping of assistant ID to assistant name
        const assistantMap = {};
        assistants.forEach(assistant => {
            assistantMap[assistant.id] = {
                name: assistant.name || 'Unnamed Assistant',
                model: assistant.model?.model || 'Unknown',
                voice: assistant.voice?.voiceId || 'Unknown'
            };
            console.log(`  - ${assistant.id}: ${assistant.name || 'Unnamed'}`);
        });

        // Save the mapping
        const outputPath = path.join(__dirname, '../../data/processed/assistant_mapping.json');
        fs.writeFileSync(outputPath, JSON.stringify(assistantMap, null, 2));
        
        console.log(`✅ Assistant mapping saved to: ${outputPath}`);
        return assistantMap;
        
    } catch (error) {
        console.error('❌ Failed to fetch assistants:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        return {};
    }
}

// Run if called directly
if (require.main === module) {
    getAssistantNames();
}

module.exports = getAssistantNames;