const https = require('https');
const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5NjkyNTdiOC05NTMzLTQzNDItYmU1Mi04MGNmMGNjZGFmODciLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU3MzMyNTg0fQ.gUdv2Gw6wFQs7t8NjBtAWOZosARyQVVgpfZWkvsAEt4';
const BASE_URL = 'https://eliteautomations.youngcaesar.digital/api/v1';
const WORKFLOW_ID = '6hpElxvumVmUzomY';

async function activateWorkflow() {
    try {
        console.log('🔧 Активирую QCI workflow...');
        
        // Сначала получаем текущие данные workflow
        const getResponse = await fetch(`${BASE_URL}/workflows/${WORKFLOW_ID}`, {
            method: 'GET',
            headers: {
                'X-N8N-API-KEY': API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!getResponse.ok) {
            throw new Error(`Failed to get workflow: ${getResponse.status} ${getResponse.statusText}`);
        }

        const workflow = await getResponse.json();
        console.log('📄 Текущий статус workflow:', workflow.active ? 'Активен' : 'Неактивен');

        if (workflow.active) {
            console.log('✅ Workflow уже активен!');
            return;
        }

        // Обновляем workflow как активный
        workflow.active = true;
        
        const updateResponse = await fetch(`${BASE_URL}/workflows/${WORKFLOW_ID}`, {
            method: 'PUT',
            headers: {
                'X-N8N-API-KEY': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(workflow)
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to activate workflow: ${updateResponse.status} ${errorText}`);
        }

        const result = await updateResponse.json();
        console.log('✅ Workflow активирован успешно!');
        console.log('🔗 Webhook URL:', 'https://eliteautomations.youngcaesar.digital/webhook/vapi-qci-enhanced');
        console.log('📊 Workflow ID:', result.id);
        console.log('🟢 Статус:', result.active ? 'АКТИВЕН' : 'НЕАКТИВЕН');

    } catch (error) {
        console.error('❌ Ошибка активации workflow:', error.message);
        process.exit(1);
    }
}

activateWorkflow();