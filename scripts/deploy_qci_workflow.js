const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.mcp' });

class N8NWorkflowDeployer {
    constructor() {
        this.baseUrl = process.env.N8N_API_URL;
        this.apiKey = process.env.N8N_API_KEY;
        
        if (!this.baseUrl || !this.apiKey) {
            throw new Error('N8N_API_URL и N8N_API_KEY должны быть установлены в .env.mcp');
        }
        
        console.log(`🚀 Подключаемся к N8N: ${this.baseUrl}`);
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const options = {
            method,
            headers: {
                'X-N8N-API-KEY': this.apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error(`❌ Ошибка запроса к ${endpoint}:`, error.message);
            throw error;
        }
    }

    async listWorkflows() {
        try {
            console.log('📋 Получаем список существующих workflows...');
            const workflows = await this.makeRequest('/workflows');
            return workflows.data || workflows;
        } catch (error) {
            console.error('❌ Не удалось получить список workflows:', error.message);
            return [];
        }
    }

    async deleteWorkflow(workflowId) {
        try {
            console.log(`🗑️ Удаляем workflow ${workflowId}...`);
            await this.makeRequest(`/workflows/${workflowId}`, 'DELETE');
            console.log(`✅ Workflow ${workflowId} удален`);
            return true;
        } catch (error) {
            console.error(`❌ Не удалось удалить workflow ${workflowId}:`, error.message);
            return false;
        }
    }

    async createWorkflow(workflowData) {
        try {
            console.log(`📥 Создаем новый workflow: ${workflowData.name}`);
            
            // Подготавливаем данные для создания (минимально необходимые поля)
            const createData = {
                name: workflowData.name,
                nodes: workflowData.nodes,
                connections: workflowData.connections,
                settings: {}
            };

            const result = await this.makeRequest('/workflows', 'POST', createData);
            console.log(`✅ Workflow создан с ID: ${result.id || result.data?.id}`);
            return result;
        } catch (error) {
            console.error('❌ Не удалось создать workflow:', error.message);
            throw error;
        }
    }

    async activateWorkflow(workflowId) {
        try {
            console.log(`⚡ Активируем workflow ${workflowId}...`);
            const result = await this.makeRequest(`/workflows/${workflowId}/activate`, 'POST');
            console.log(`✅ Workflow ${workflowId} активирован`);
            return result;
        } catch (error) {
            console.error(`❌ Не удалось активировать workflow ${workflowId}:`, error.message);
            return false;
        }
    }

    async setupCredentials() {
        try {
            console.log('🔑 Настраиваем credentials...');
            console.log('⚠️ Credentials требуют ручной настройки в UI n8n');
            console.log('📋 Необходимо создать:');
            console.log('   - VAPI API Key (HTTP Header Auth)');
            console.log('   - OpenAI API Key');  
            console.log('   - Airtable API Key');
            console.log('   - Webhook Basic Auth');
            return;
        } catch (error) {
            console.error('❌ Ошибка при настройке credentials:', error.message);
        }
    }

    async deployWorkflow(workflowPath) {
        try {
            console.log('🚀 Начинаем развертывание QCI Workflow...');
            
            // Загружаем файл workflow
            if (!fs.existsSync(workflowPath)) {
                throw new Error(`Файл workflow не найден: ${workflowPath}`);
            }
            
            const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
            console.log(`📄 Загружен workflow: ${workflowData.name}`);
            
            // Настраиваем credentials
            await this.setupCredentials();
            
            // Проверяем существующие workflows
            const existingWorkflows = await this.listWorkflows();
            const existingWorkflow = existingWorkflows.find(w => w.name === workflowData.name);
            
            if (existingWorkflow) {
                console.log(`⚠️ Workflow "${workflowData.name}" уже существует`);
                console.log('🔄 Удаляем старую версию...');
                await this.deleteWorkflow(existingWorkflow.id);
                
                // Небольшая пауза
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Создаем новый workflow
            const newWorkflow = await this.createWorkflow(workflowData);
            const workflowId = newWorkflow.id || newWorkflow.data?.id;
            
            if (!workflowId) {
                throw new Error('Не удалось получить ID созданного workflow');
            }
            
            // Активируем workflow
            await new Promise(resolve => setTimeout(resolve, 3000));
            await this.activateWorkflow(workflowId);
            
            console.log('\\n🎉 РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО!');
            console.log(`📋 Workflow ID: ${workflowId}`);
            console.log(`🔗 Webhook URL: ${this.baseUrl.replace('/api/v1', '')}/webhook/vapi-qci-enhanced`);
            console.log(`📊 Dashboard: ${this.baseUrl.replace('/api/v1', '')}/workflows/${workflowId}`);
            
            return {
                success: true,
                workflowId,
                webhookUrl: `${this.baseUrl.replace('/api/v1', '')}/webhook/vapi-qci-enhanced`
            };
            
        } catch (error) {
            console.error('❌ Ошибка при развертывании:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// CLI запуск
if (require.main === module) {
    const deployer = new N8NWorkflowDeployer();
    const workflowPath = path.join(__dirname, '..', 'n8n_workflows', 'Enhanced_QCI_Workflow.json');
    
    deployer.deployWorkflow(workflowPath)
        .then(result => {
            if (result.success) {
                console.log('\\n✅ Развертывание успешно завершено!');
                console.log(`🔗 Webhook URL для VAPI: ${result.webhookUrl}`);
                process.exit(0);
            } else {
                console.error('\\n❌ Развертывание не удалось:', result.error);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\\n💥 Критическая ошибка:', error.message);
            process.exit(1);
        });
}

module.exports = N8NWorkflowDeployer;