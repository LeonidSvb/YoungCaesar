const https = require('https');
require('dotenv').config();

/**
 * Скрипт для настройки webhook URL в VAPI
 * Автоматически настраивает endpoint для QCI анализа
 */

class VAPIWebhookManager {
    constructor() {
        this.apiKey = process.env.VAPI_API_KEY;
        this.baseUrl = 'api.vapi.ai';
        this.webhookUrl = 'https://eliteautomations.youngcaesar.digital/webhook/vapi-qci-enhanced';
        
        if (!this.apiKey) {
            throw new Error('VAPI_API_KEY не найден в .env файле');
        }
        
        console.log(`🔑 VAPI API Key: ${this.apiKey.substring(0, 8)}...`);
        console.log(`🔗 Webhook URL: ${this.webhookUrl}`);
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: endpoint,
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                const postData = JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(postData);
            }

            const req = https.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const parsedData = responseData ? JSON.parse(responseData) : {};
                        resolve({
                            statusCode: res.statusCode,
                            data: parsedData,
                            headers: res.headers
                        });
                    } catch (error) {
                        resolve({
                            statusCode: res.statusCode,
                            data: responseData,
                            headers: res.headers
                        });
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }

    // Получает список всех assistants
    async getAssistants() {
        try {
            console.log('📋 Получаем список assistants...');
            const response = await this.makeRequest('/assistant');
            
            if (response.statusCode === 200) {
                const assistants = Array.isArray(response.data) ? response.data : [];
                console.log(`✅ Найдено ${assistants.length} assistants`);
                return assistants;
            } else {
                console.error(`❌ Ошибка получения assistants: ${response.statusCode}`);
                return [];
            }
        } catch (error) {
            console.error('❌ Ошибка при получении assistants:', error.message);
            return [];
        }
    }

    // Обновляет webhook URL для assistant
    async updateAssistantWebhook(assistantId, webhookUrl) {
        try {
            console.log(`🔄 Обновляем webhook для assistant ${assistantId}...`);
            
            // Получаем текущую конфигурацию assistant
            const getResponse = await this.makeRequest(`/assistant/${assistantId}`);
            
            if (getResponse.statusCode !== 200) {
                console.error(`❌ Не удалось получить данные assistant ${assistantId}`);
                return false;
            }
            
            const currentConfig = getResponse.data;
            
            // Фильтруем только допустимые поля для PATCH запроса
            const allowedFields = ['name', 'transcriber', 'model', 'voice', 'firstMessage', 'systemMessage', 'functions', 'serverUrl', 'serverUrlSecret', 'endCallPhrases', 'recordingEnabled'];
            
            const updatedConfig = allowedFields.reduce((config, field) => {
                if (currentConfig[field] !== undefined) {
                    config[field] = currentConfig[field];
                }
                return config;
            }, {});
            
            // Обновляем serverUrl в конфигурации
            updatedConfig.serverUrl = webhookUrl;
            updatedConfig.serverUrlSecret = 'vapi-webhook-secret-2025';
            
            // Отправляем обновленную конфигурацию
            const updateResponse = await this.makeRequest(`/assistant/${assistantId}`, 'PATCH', updatedConfig);
            
            if (updateResponse.statusCode === 200) {
                console.log(`✅ Webhook обновлен для assistant ${assistantId}`);
                return true;
            } else {
                console.error(`❌ Не удалось обновить webhook для assistant ${assistantId}: ${updateResponse.statusCode}`);
                console.error('Response:', updateResponse.data);
                return false;
            }
            
        } catch (error) {
            console.error(`❌ Ошибка при обновлении assistant ${assistantId}:`, error.message);
            return false;
        }
    }

    // Настраивает webhook для всех assistants
    async setupWebhookForAllAssistants() {
        try {
            console.log('🚀 Начинаем настройку webhook для всех assistants...');
            
            const assistants = await this.getAssistants();
            
            if (assistants.length === 0) {
                console.log('⚠️ Не найдено ни одного assistant для настройки');
                return { success: false, message: 'No assistants found' };
            }
            
            let successCount = 0;
            let failCount = 0;
            
            for (const assistant of assistants) {
                console.log(`\\n👤 Обрабатываем assistant: ${assistant.name || assistant.id}`);
                console.log(`   ID: ${assistant.id}`);
                console.log(`   Current serverUrl: ${assistant.serverUrl || 'не задан'}`);
                
                const success = await this.updateAssistantWebhook(assistant.id, this.webhookUrl);
                
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
                
                // Пауза между запросами
                if (assistants.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            console.log('\\n📊 РЕЗУЛЬТАТЫ:');
            console.log(`✅ Успешно обновлено: ${successCount}`);
            console.log(`❌ Ошибок: ${failCount}`);
            console.log(`📈 Процент успеха: ${((successCount / assistants.length) * 100).toFixed(1)}%`);
            
            return {
                success: successCount > 0,
                total: assistants.length,
                successful: successCount,
                failed: failCount,
                webhookUrl: this.webhookUrl
            };
            
        } catch (error) {
            console.error('💥 Критическая ошибка:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Проверяет статус webhook для assistant
    async checkWebhookStatus(assistantId) {
        try {
            const response = await this.makeRequest(`/assistant/${assistantId}`);
            
            if (response.statusCode === 200) {
                const assistant = response.data;
                return {
                    id: assistant.id,
                    name: assistant.name || 'Unnamed',
                    serverUrl: assistant.serverUrl || 'не задан',
                    isConfigured: assistant.serverUrl === this.webhookUrl
                };
            } else {
                return null;
            }
        } catch (error) {
            console.error(`Ошибка проверки assistant ${assistantId}:`, error.message);
            return null;
        }
    }

    // Проверяет статус webhook для всех assistants
    async checkAllWebhookStatuses() {
        try {
            console.log('🔍 Проверяем статус webhook для всех assistants...');
            
            const assistants = await this.getAssistants();
            
            if (assistants.length === 0) {
                console.log('⚠️ Не найдено ни одного assistant');
                return [];
            }
            
            const statuses = [];
            
            for (const assistant of assistants) {
                const status = await this.checkWebhookStatus(assistant.id);
                if (status) {
                    statuses.push(status);
                }
            }
            
            console.log('\\n📋 СТАТУС WEBHOOK:');
            console.log('='.repeat(80));
            console.log('| ID                     | Name              | Webhook Configured |');
            console.log('='.repeat(80));
            
            statuses.forEach(status => {
                const id = status.id.substring(0, 20).padEnd(20);
                const name = (status.name || 'Unnamed').substring(0, 15).padEnd(15);
                const configured = status.isConfigured ? '✅ YES' : '❌ NO';
                console.log(`| ${id} | ${name} | ${configured.padEnd(15)} |`);
            });
            
            console.log('='.repeat(80));
            
            const configured = statuses.filter(s => s.isConfigured).length;
            console.log(`\\n📊 Итого: ${configured}/${statuses.length} assistants настроены правильно`);
            
            return statuses;
            
        } catch (error) {
            console.error('❌ Ошибка при проверке статусов:', error.message);
            return [];
        }
    }
}

// CLI Commands
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'setup';
    
    const manager = new VAPIWebhookManager();
    
    switch (command) {
        case 'setup':
            console.log('🔧 Настраиваем webhook для всех assistants...');
            manager.setupWebhookForAllAssistants()
                .then(result => {
                    if (result.success) {
                        console.log('\\n🎉 НАСТРОЙКА ЗАВЕРШЕНА УСПЕШНО!');
                        console.log(`🔗 Webhook URL: ${result.webhookUrl}`);
                        process.exit(0);
                    } else {
                        console.error('\\n❌ Настройка завершена с ошибками');
                        process.exit(1);
                    }
                })
                .catch(error => {
                    console.error('💥 Критическая ошибка:', error.message);
                    process.exit(1);
                });
            break;
            
        case 'check':
            console.log('🔍 Проверяем статус webhook...');
            manager.checkAllWebhookStatuses()
                .then(() => process.exit(0))
                .catch(() => process.exit(1));
            break;
            
        case 'list':
            console.log('📋 Получаем список assistants...');
            manager.getAssistants()
                .then(assistants => {
                    if (assistants.length > 0) {
                        console.log('\\n👥 СПИСОК ASSISTANTS:');
                        assistants.forEach((assistant, index) => {
                            console.log(`${index + 1}. ${assistant.name || 'Unnamed'} (${assistant.id})`);
                            console.log(`   serverUrl: ${assistant.serverUrl || 'не задан'}`);
                        });
                    }
                    process.exit(0);
                })
                .catch(() => process.exit(1));
            break;
            
        default:
            console.log('🔧 VAPI Webhook Manager');
            console.log('Usage:');
            console.log('  node setup_vapi_webhook.js setup    - Настроить webhook для всех assistants');
            console.log('  node setup_vapi_webhook.js check    - Проверить статус webhook');
            console.log('  node setup_vapi_webhook.js list     - Показать список assistants');
            console.log('');
            console.log('Webhook URL: https://eliteautomations.youngcaesar.digital/webhook/vapi-qci-enhanced');
            process.exit(0);
    }
}

module.exports = VAPIWebhookManager;