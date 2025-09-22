const https = require('https');
const { URLSearchParams } = require('url');

/**
 * Скрипт для тестирования QCI Webhook в n8n
 * Отправляет тестовые данные VAPI call для проверки workflow
 */

class QCIWebhookTester {
    constructor() {
        this.webhookUrl = 'https://eliteautomations.youngcaesar.digital/webhook/vapi-qci-enhanced';
        this.username = 'vapi_user';
        this.password = 'vapi_webhook_2025';
    }

    // Генерирует тестовые данные VAPI call
    generateTestCallData() {
        return {
            "call": {
                "id": `test_call_${Date.now()}`,
                "assistantId": "test_assistant_001",
                "customer": {
                    "number": "+1234567890"
                },
                "startedAt": "2025-01-11T20:00:00.000Z",
                "endedAt": "2025-01-11T20:05:30.000Z",
                "duration": 330,
                "cost": 0.85,
                "status": "ended",
                "endedReason": "customer-ended-call",
                "transcript": `Assistant: Hi, this is John from TechSolutions. I'm calling about the industrial equipment upgrade we discussed. Do you have a few minutes to chat?

Customer: Oh yes, hi John. I've been waiting for your call. We're definitely interested in learning more.

Assistant: Excellent! I wanted to follow up on our previous conversation about your current manufacturing equipment. You mentioned you're experiencing some efficiency issues with your current setup. Can you tell me more about what specific challenges you're facing?

Customer: Yes, absolutely. Our current machines are about 8 years old and we're seeing decreased output, especially during peak production times. We're looking at about 20% less efficiency than we had three years ago.

Assistant: That's definitely a significant impact on your operations. When you say 20% less efficiency, how does that translate into your daily production numbers? Are we talking about units per hour or overall daily output?

Customer: Well, we used to produce about 500 units per day consistently, but now we're averaging around 400 units. During our busy season, this really hurts our ability to meet customer demand.

Assistant: I understand how frustrating that must be, especially when you have customers counting on you. Our latest Model X-2500 series could definitely address those efficiency issues. These machines are specifically designed for high-volume production and our clients typically see 35-40% improvement in output within the first month. Would you be interested in scheduling a demo to see how this could work for your specific production line?

Customer: That sounds very promising. What kind of investment are we looking at for something like that?

Assistant: Great question. The investment varies based on your specific configuration needs, but I'd love to have one of our engineers come out and do a proper assessment first. That way we can give you an accurate quote and ROI projection. Are you available next Tuesday or Wednesday for a 30-minute site visit?

Customer: Let me check my calendar... Tuesday afternoon would work well. What time were you thinking?

Assistant: Perfect! How about 2 PM on Tuesday? I'll bring our senior engineer Mike who specializes in your industry. He'll be able to give you specific recommendations and we can discuss financing options as well.

Customer: Sounds good. I'll make sure our production manager is available too. Should I prepare anything specific for the meeting?

Assistant: That's perfect that your production manager will be there. If you could have your current production logs from the last 6 months ready, that would be very helpful for Mike's assessment. Also, any maintenance records would give us great insight into what you're currently dealing with.

Customer: Absolutely, I can have all of that ready. This sounds like exactly what we need.

Assistant: Excellent! I'm really excited about this opportunity to help you get back to peak efficiency. I'll send you a calendar invite with all the details and my direct contact information. Is there anything else you'd like to know before our meeting on Tuesday?

Customer: No, I think we've covered everything. I'm looking forward to seeing what you can do for us.

Assistant: Perfect! Thanks so much for your time today, and I'll see you Tuesday at 2 PM. Have a great rest of your day!

Customer: Thank you, you too. See you Tuesday.`
            },
            "event": "call-ended",
            "timestamp": new Date().toISOString()
        };
    }

    // Отправляет POST запрос на webhook
    async sendWebhookRequest(data) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(data);
            const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
            
            const options = {
                hostname: 'eliteautomations.youngcaesar.digital',
                port: 443,
                path: '/webhook/vapi-qci-enhanced',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'Authorization': `Basic ${auth}`,
                    'User-Agent': 'VAPI-Test-Client/1.0'
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = {
                            statusCode: res.statusCode,
                            headers: res.headers,
                            body: responseData
                        };
                        resolve(response);
                    } catch (error) {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            body: responseData
                        });
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.setTimeout(30000); // 30 секунд timeout
            req.write(postData);
            req.end();
        });
    }

    // Основная функция тестирования
    async runTest(testName = 'default') {
        try {
            console.log(`🧪 Запуск теста QCI Webhook: ${testName}`);
            console.log(`🔗 URL: ${this.webhookUrl}`);
            console.log(`👤 Auth: ${this.username}:${this.password}`);
            
            const testData = this.generateTestCallData();
            console.log(`📊 Тестовые данные:`);
            console.log(`   - Call ID: ${testData.call.id}`);
            console.log(`   - Duration: ${testData.call.duration}s`);
            console.log(`   - Cost: $${testData.call.cost}`);
            console.log(`   - Transcript length: ${testData.call.transcript.length} chars`);
            
            console.log('\n🚀 Отправляем webhook запрос...');
            const startTime = Date.now();
            
            const response = await this.sendWebhookRequest(testData);
            const duration = Date.now() - startTime;
            
            console.log(`\n📬 Получен ответ (${duration}ms):`);
            console.log(`   Status: ${response.statusCode}`);
            console.log(`   Headers:`, response.headers);
            
            if (response.body) {
                try {
                    const responseBody = JSON.parse(response.body);
                    console.log(`   Response Body:`);
                    console.log(JSON.stringify(responseBody, null, 2));
                    
                    if (responseBody.success) {
                        console.log('\n✅ ТЕСТ УСПЕШНО ПРОЙДЕН!');
                        console.log(`📊 QCI Score: ${responseBody.qciScore || 'N/A'}`);
                        console.log(`🎯 Classification: ${responseBody.classification || 'N/A'}`);
                        
                        if (responseBody.breakdown) {
                            console.log(`📈 Breakdown:`);
                            console.log(`   - Approach Quality: ${responseBody.breakdown.approach_quality}/25`);
                            console.log(`   - Engagement Level: ${responseBody.breakdown.engagement_level}/25`);
                            console.log(`   - Information Gathering: ${responseBody.breakdown.information_gathering}/25`);
                            console.log(`   - Call Outcome: ${responseBody.breakdown.call_outcome}/25`);
                        }
                        
                        return { success: true, response: responseBody };
                    } else {
                        console.log('\n❌ ТЕСТ НЕ ПРОЙДЕН');
                        console.log(`❌ Ошибка: ${responseBody.error || 'Unknown error'}`);
                        return { success: false, error: responseBody.error };
                    }
                } catch (parseError) {
                    console.log(`   Raw Body: ${response.body}`);
                    console.log('\n⚠️ Не удалось распарсить JSON ответ');
                    return { success: false, error: 'Invalid JSON response', rawResponse: response.body };
                }
            } else {
                console.log('\n⚠️ Пустой ответ от сервера');
                return { success: false, error: 'Empty response' };
            }
            
        } catch (error) {
            console.error('\n💥 КРИТИЧЕСКАЯ ОШИБКА:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Запускает несколько тестов подряд
    async runMultipleTests(count = 3) {
        console.log(`🎯 Запуск ${count} тестов подряд...`);
        const results = [];
        
        for (let i = 1; i <= count; i++) {
            console.log(`\n${'='.repeat(50)}`);
            console.log(`ТЕСТ ${i}/${count}`);
            console.log('='.repeat(50));
            
            const result = await this.runTest(`test-${i}`);
            results.push(result);
            
            if (i < count) {
                console.log('\n⏳ Пауза между тестами (5 секунд)...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        
        // Результаты
        console.log('\n' + '='.repeat(60));
        console.log('ИТОГОВЫЕ РЕЗУЛЬТАТЫ');
        console.log('='.repeat(60));
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`✅ Успешно: ${successful}/${count}`);
        console.log(`❌ Неудачно: ${failed}/${count}`);
        console.log(`📊 Процент успеха: ${((successful/count) * 100).toFixed(1)}%`);
        
        return results;
    }
}

// CLI Запуск
if (require.main === module) {
    const tester = new QCIWebhookTester();
    const args = process.argv.slice(2);
    const command = args[0] || 'single';
    
    switch (command) {
        case 'single':
            tester.runTest('manual-test')
                .then(() => process.exit(0))
                .catch(() => process.exit(1));
            break;
            
        case 'multiple':
            const count = parseInt(args[1]) || 3;
            tester.runMultipleTests(count)
                .then(() => process.exit(0))
                .catch(() => process.exit(1));
            break;
            
        default:
            console.log('🧪 QCI Webhook Tester');
            console.log('Usage:');
            console.log('  node test_qci_webhook.js single          - Один тест');
            console.log('  node test_qci_webhook.js multiple [N]    - Несколько тестов (по умолчанию 3)');
            console.log('');
            console.log('Examples:');
            console.log('  node test_qci_webhook.js single');
            console.log('  node test_qci_webhook.js multiple 5');
            process.exit(0);
    }
}

module.exports = QCIWebhookTester;