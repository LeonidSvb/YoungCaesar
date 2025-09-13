const fs = require('fs');
require('dotenv').config();

class AssistantPromptsCollector {
    constructor() {
        this.apiKey = process.env.VAPI_API_KEY;
        this.baseUrl = 'https://api.vapi.ai';
    }

    async getAssistants() {
        console.log('🔍 Получаю список всех ассистентов...');

        try {
            const response = await fetch(`${this.baseUrl}/assistant`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const assistants = await response.json();
            console.log(`✅ Найдено ${assistants.length} ассистентов`);

            return assistants;
        } catch (error) {
            console.error('❌ Ошибка получения ассистентов:', error.message);
            return [];
        }
    }

    async getAssistantDetails(assistantId) {
        try {
            const response = await fetch(`${this.baseUrl}/assistant/${assistantId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`❌ Ошибка получения деталей ${assistantId}:`, error.message);
            return null;
        }
    }

    extractPromptInfo(assistant) {
        const info = {
            id: assistant.id,
            name: assistant.name,
            model: assistant.model?.model || 'unknown',
            systemMessage: assistant.model?.messages?.[0]?.content ||
                          assistant.model?.systemMessage ||
                          'No system message found',
            firstMessage: assistant.firstMessage || 'No first message',
            endCallMessage: assistant.endCallMessage || null,
            voice: assistant.voice?.provider || 'unknown',
            functions: assistant.model?.functions?.length || 0,
            serverUrl: assistant.serverUrl || null,
            createdAt: assistant.createdAt,
            updatedAt: assistant.updatedAt
        };

        return info;
    }

    async run() {
        console.log('🚀 ПОЛУЧЕНИЕ ПРОМПТОВ АССИСТЕНТОВ');
        console.log('=================================\n');

        try {
            const assistants = await this.getAssistants();

            if (assistants.length === 0) {
                console.log('❌ Не удалось получить ассистентов');
                return;
            }

            const assistantPrompts = [];

            console.log('📝 Извлекаю промпты и детали...');

            for (let i = 0; i < assistants.length; i++) {
                const assistant = assistants[i];
                console.log(`[${i + 1}/${assistants.length}] ${assistant.name}...`);

                // Получаем полные детали ассистента
                const details = await this.getAssistantDetails(assistant.id);

                if (details) {
                    const promptInfo = this.extractPromptInfo(details);
                    assistantPrompts.push(promptInfo);

                    console.log(`  ✅ ID: ${promptInfo.id}`);
                    console.log(`  📝 Model: ${promptInfo.model}`);
                    console.log(`  📏 Prompt length: ${promptInfo.systemMessage.length} chars`);
                    console.log(`  🔧 Functions: ${promptInfo.functions}`);
                } else {
                    console.log(`  ❌ Не удалось получить детали`);
                }

                // Небольшая пауза чтобы не перегружать API
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Сохраняем результаты
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `data/processed/assistant_prompts_${timestamp}.json`;

            // Создаём директорию если не существует
            if (!fs.existsSync('data/processed')) {
                fs.mkdirSync('data/processed', { recursive: true });
            }

            fs.writeFileSync(filename, JSON.stringify(assistantPrompts, null, 2));

            console.log('\n🎉 ЗАВЕРШЕНО!');
            console.log(`📁 Сохранено: ${filename}`);
            console.log(`📊 Собрано промптов: ${assistantPrompts.length}`);

            // Показать краткую статистику
            console.log('\n📈 СТАТИСТИКА ПРОМПТОВ:');
            assistantPrompts.forEach((ap, i) => {
                console.log(`${i + 1}. ${ap.name}:`);
                console.log(`   - Промпт: ${ap.systemMessage.length} символов`);
                console.log(`   - Модель: ${ap.model}`);
                console.log(`   - Функции: ${ap.functions}`);
            });

            return { success: true, filename, prompts: assistantPrompts };

        } catch (error) {
            console.error('❌ Критическая ошибка:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// Запуск если вызван напрямую
if (require.main === module) {
    const collector = new AssistantPromptsCollector();
    collector.run().catch(console.error);
}

module.exports = AssistantPromptsCollector;