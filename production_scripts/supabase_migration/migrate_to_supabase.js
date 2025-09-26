require('dotenv').config({ path: '../../.env' });

// ============================================================
// VAPI to Supabase Migration Script
// Мигрирует все данные из JSON файлов в Supabase
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
    // Пути к данным
    INPUT_FILES: {
        VAPI_CALLS: '../vapi_collection/results/2025-09-17T09-51-00_vapi_calls_2025-01-01_to_2025-09-17_cost-0.03.json',
        QCI_ANALYSES: '../qci_analysis/results/qci_full_calls_with_assistants_latest.json',
        PROMPT_OPTIMIZATIONS: '../prompt_optimization/results/recommendations_2025-09-22T11-24-53.json'
    },

    // Настройки батчей
    BATCH_SIZE: 100,

    // Режим сухого прогона (не записывает в БД)
    DRY_RUN: false,

    // Очистить таблицы перед импортом
    CLEAR_EXISTING_DATA: false
};

class SupabaseMigrator {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        this.stats = {
            organizations: { created: 0, skipped: 0 },
            assistants: { created: 0, skipped: 0 },
            phone_numbers: { created: 0, skipped: 0 },
            calls: { created: 0, skipped: 0, errors: 0 },
            qci_analyses: { created: 0, skipped: 0, errors: 0 },
            prompt_optimizations: { created: 0, skipped: 0, errors: 0 }
        };

        this.cache = {
            organizations: new Map(),
            assistants: new Map(),
            phone_numbers: new Map()
        };
    }

    async testConnection() {
        console.log('🔗 Тестирование подключения к Supabase...');

        try {
            const { data, error } = await this.supabase.from('organizations').select('count').limit(1);
            if (error) throw error;

            console.log('✅ Подключение к Supabase успешно');
            return true;
        } catch (error) {
            console.error('❌ Ошибка подключения:', error.message);
            return false;
        }
    }

    async clearExistingData() {
        if (!CONFIG.CLEAR_EXISTING_DATA) return;

        console.log('🗑️ Очистка существующих данных...');

        const tables = [
            'call_participants',
            'prompt_optimizations',
            'qci_analyses',
            'calls',
            'prompts',
            'phone_numbers',
            'assistants',
            'organizations'
        ];

        for (const table of tables) {
            if (!CONFIG.DRY_RUN) {
                const { error } = await this.supabase.from(table).delete().gte('created_at', '1900-01-01');
                if (error) {
                    console.warn(`⚠️ Ошибка очистки ${table}:`, error.message);
                } else {
                    console.log(`🗑️ Очищена таблица: ${table}`);
                }
            } else {
                console.log(`🗑️ [DRY RUN] Очистка таблицы: ${table}`);
            }
        }
    }

    async loadJsonFile(filePath) {
        const fullPath = path.resolve(__dirname, filePath);
        if (!fs.existsSync(fullPath)) {
            console.warn(`⚠️ Файл не найден: ${fullPath}`);
            return null;
        }

        try {
            const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            console.log(`📁 Загружен файл: ${path.basename(filePath)}`);
            return data;
        } catch (error) {
            console.error(`❌ Ошибка чтения файла ${filePath}:`, error.message);
            return null;
        }
    }

    async createOrganization(orgId, orgName = 'Default Organization') {
        if (this.cache.organizations.has(orgId)) {
            return this.cache.organizations.get(orgId);
        }

        const organizationData = {
            vapi_org_id: orgId,
            name: orgName,
            is_active: true
        };

        if (CONFIG.DRY_RUN) {
            console.log(`🏢 [DRY RUN] Создание организации: ${orgName}`);
            const fakeId = `org-${Date.now()}`;
            this.cache.organizations.set(orgId, fakeId);
            this.stats.organizations.created++;
            return fakeId;
        }

        try {
            const { data, error } = await this.supabase
                .from('organizations')
                .upsert(organizationData, {
                    onConflict: 'vapi_org_id',
                    ignoreDuplicates: false
                })
                .select()
                .single();

            if (error) throw error;

            this.cache.organizations.set(orgId, data.id);
            this.stats.organizations.created++;
            console.log(`🏢 Создана организация: ${orgName}`);
            return data.id;
        } catch (error) {
            console.error(`❌ Ошибка создания организации:`, error.message);
            this.stats.organizations.skipped++;
            return null;
        }
    }

    async createAssistant(assistantId, organizationId, name = `Assistant ${assistantId.substring(0, 8)}`) {
        if (this.cache.assistants.has(assistantId)) {
            return this.cache.assistants.get(assistantId);
        }

        const assistantData = {
            vapi_assistant_id: assistantId,
            organization_id: organizationId,
            name: name,
            is_active: true,
            configuration: {}
        };

        if (CONFIG.DRY_RUN) {
            console.log(`🤖 [DRY RUN] Создание ассистента: ${name}`);
            const fakeId = `assistant-${Date.now()}`;
            this.cache.assistants.set(assistantId, fakeId);
            this.stats.assistants.created++;
            return fakeId;
        }

        try {
            const { data, error } = await this.supabase
                .from('assistants')
                .upsert(assistantData, {
                    onConflict: 'vapi_assistant_id',
                    ignoreDuplicates: false
                })
                .select()
                .single();

            if (error) throw error;

            this.cache.assistants.set(assistantId, data.id);
            this.stats.assistants.created++;
            console.log(`🤖 Создан ассистент: ${name}`);
            return data.id;
        } catch (error) {
            console.error(`❌ Ошибка создания ассистента:`, error.message);
            this.stats.assistants.skipped++;
            return null;
        }
    }

    async createPhoneNumber(phoneNumberId, organizationId, phoneNumber) {
        if (this.cache.phone_numbers.has(phoneNumberId)) {
            return this.cache.phone_numbers.get(phoneNumberId);
        }

        const phoneData = {
            vapi_phone_id: phoneNumberId,
            organization_id: organizationId,
            phone_number: phoneNumber,
            is_active: true
        };

        if (CONFIG.DRY_RUN) {
            console.log(`📞 [DRY RUN] Создание номера: ${phoneNumber}`);
            const fakeId = `phone-${Date.now()}`;
            this.cache.phone_numbers.set(phoneNumberId, fakeId);
            this.stats.phone_numbers.created++;
            return fakeId;
        }

        try {
            const { data, error } = await this.supabase
                .from('phone_numbers')
                .upsert(phoneData, {
                    onConflict: 'vapi_phone_id',
                    ignoreDuplicates: false
                })
                .select()
                .single();

            if (error) throw error;

            this.cache.phone_numbers.set(phoneNumberId, data.id);
            this.stats.phone_numbers.created++;
            return data.id;
        } catch (error) {
            console.error(`❌ Ошибка создания номера:`, error.message);
            this.stats.phone_numbers.skipped++;
            return null;
        }
    }

    async migrateCalls(callsData) {
        console.log(`\n📞 Начало миграции ${callsData.length} звонков...`);

        for (let i = 0; i < callsData.length; i += CONFIG.BATCH_SIZE) {
            const batch = callsData.slice(i, Math.min(i + CONFIG.BATCH_SIZE, callsData.length));
            await this.procesCallsBatch(batch, i + 1);

            // Пауза между батчами
            if (i + CONFIG.BATCH_SIZE < callsData.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async procesCallsBatch(callsBatch, batchStart) {
        console.log(`📦 Обработка батча звонков ${batchStart}-${batchStart + callsBatch.length - 1}...`);

        const callsToInsert = [];

        for (const call of callsBatch) {
            try {
                // Создаем организацию если её нет
                const organizationId = await this.createOrganization(call.orgId);
                if (!organizationId) continue;

                // Создаем ассистента если его нет
                const assistantId = await this.createAssistant(call.assistantId, organizationId);
                if (!assistantId) continue;

                // Создаем телефонный номер если есть
                let phoneNumberId = null;
                if (call.phoneNumberId) {
                    const customerPhone = call.customer?.number || 'unknown';
                    phoneNumberId = await this.createPhoneNumber(call.phoneNumberId, organizationId, customerPhone);
                }

                const callData = {
                    vapi_call_id: call.id,
                    assistant_id: assistantId,
                    phone_number_id: phoneNumberId,
                    organization_id: organizationId,
                    call_type: call.type || 'outbound',
                    status: call.status || 'ended',
                    ended_reason: call.endedReason,
                    started_at: call.startedAt,
                    ended_at: call.endedAt,
                    transcript: call.transcript,
                    summary: call.summary,
                    recording_url: call.recordingUrl,
                    customer_number: call.customer?.number,
                    customer_info: call.customer || {},
                    cost: call.cost,
                    raw_data: call
                };

                callsToInsert.push(callData);

            } catch (error) {
                console.error(`❌ Ошибка обработки звонка ${call.id}:`, error.message);
                this.stats.calls.errors++;
            }
        }

        // Вставляем батч
        if (callsToInsert.length > 0 && !CONFIG.DRY_RUN) {
            try {
                const { data, error } = await this.supabase
                    .from('calls')
                    .upsert(callsToInsert, {
                        onConflict: 'vapi_call_id',
                        ignoreDuplicates: true
                    })
                    .select('id');

                if (error) throw error;

                this.stats.calls.created += data?.length || callsToInsert.length;
                console.log(`✅ Вставлено ${data?.length || callsToInsert.length} звонков`);

            } catch (error) {
                console.error(`❌ Ошибка вставки батча звонков:`, error.message);
                this.stats.calls.errors += callsToInsert.length;
            }
        } else if (CONFIG.DRY_RUN) {
            console.log(`✅ [DRY RUN] Обработано ${callsToInsert.length} звонков`);
            this.stats.calls.created += callsToInsert.length;
        }
    }

    async migrateQciAnalyses(qciData) {
        if (!qciData?.results) {
            console.log('⚠️ QCI данные не найдены');
            return;
        }

        console.log(`\n📊 Начало миграции ${qciData.results.length} QCI анализов...`);

        for (let i = 0; i < qciData.results.length; i += CONFIG.BATCH_SIZE) {
            const batch = qciData.results.slice(i, Math.min(i + CONFIG.BATCH_SIZE, qciData.results.length));
            await this.processQciBatch(batch, i + 1);

            if (i + CONFIG.BATCH_SIZE < qciData.results.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async processQciBatch(qciBatch, batchStart) {
        console.log(`📦 Обработка батча QCI ${batchStart}-${batchStart + qciBatch.length - 1}...`);

        if (CONFIG.DRY_RUN) {
            console.log(`✅ [DRY RUN] Обработано ${qciBatch.length} QCI анализов`);
            this.stats.qci_analyses.created += qciBatch.length;
            return;
        }

        const qciToInsert = qciBatch.map(qci => ({
            call_id: `(SELECT id FROM calls WHERE vapi_call_id = '${qci.call_id}')`,
            assistant_id: `(SELECT id FROM assistants WHERE vapi_assistant_id = '${qci.assistant_id}')`,
            qci_total_score: qci.qci_total,
            dynamics_score: qci.dynamics,
            objections_score: qci.objections,
            brand_score: qci.brand,
            outcome_score: qci.outcome,
            status: qci.status,
            evidence: qci.ai_analysis?.evidence || {},
            coaching_tips: qci.ai_analysis?.coaching_tips || [],
            ai_model: 'gpt-4o-mini',
            analysis_cost: qci.cost,
            tokens_used: qci.tokens,
            analyzed_at: qci.timestamp,
            raw_analysis: qci.ai_analysis
        }));

        // Для QCI используем raw SQL из-за подзапросов
        const values = qciToInsert.map(qci =>
            `(${qci.call_id}, ${qci.assistant_id}, ${qci.qci_total_score}, ${qci.dynamics_score}, ${qci.objections_score}, ${qci.brand_score}, ${qci.outcome_score}, '${qci.status}', '${JSON.stringify(qci.evidence).replace(/'/g, "''")}', ARRAY['${qci.coaching_tips.join("', '")}'], '${qci.ai_model}', ${qci.analysis_cost}, ${qci.tokens_used}, '${qci.analyzed_at}', '${JSON.stringify(qci.raw_analysis).replace(/'/g, "''")}')`
        ).join(',');

        const sql = `
            INSERT INTO qci_analyses (call_id, assistant_id, qci_total_score, dynamics_score, objections_score, brand_score, outcome_score, status, evidence, coaching_tips, ai_model, analysis_cost, tokens_used, analyzed_at, raw_analysis)
            VALUES ${values}
            ON CONFLICT (call_id) DO NOTHING;
        `;

        try {
            const { error } = await this.supabase.rpc('exec_sql', { sql });
            if (error) throw error;

            this.stats.qci_analyses.created += qciBatch.length;
            console.log(`✅ Вставлено ${qciBatch.length} QCI анализов`);

        } catch (error) {
            console.error(`❌ Ошибка вставки QCI анализов:`, error.message);
            this.stats.qci_analyses.errors += qciBatch.length;
        }
    }

    async run() {
        console.log('🚀 Начало миграции данных VAPI в Supabase\n');

        // Тестируем подключение
        const connected = await this.testConnection();
        if (!connected) return;

        // Очищаем данные если нужно
        await this.clearExistingData();

        // Загружаем данные
        const callsData = await this.loadJsonFile(CONFIG.INPUT_FILES.VAPI_CALLS);
        const qciData = await this.loadJsonFile(CONFIG.INPUT_FILES.QCI_ANALYSES);

        if (!callsData) {
            console.error('❌ Не удалось загрузить данные звонков');
            return;
        }

        // Мигрируем звонки
        await this.migrateCalls(callsData);

        // Мигрируем QCI анализы
        if (qciData) {
            await this.migrateQciAnalyses(qciData);
        }

        // Выводим статистику
        this.printStats();
    }

    printStats() {
        console.log('\n🎉 МИГРАЦИЯ ЗАВЕРШЕНА');
        console.log('═══════════════════════════════════════');

        Object.entries(this.stats).forEach(([table, stats]) => {
            const total = stats.created + stats.skipped + (stats.errors || 0);
            if (total > 0) {
                console.log(`📊 ${table}:`);
                console.log(`   Создано: ${stats.created}`);
                if (stats.skipped > 0) console.log(`   Пропущено: ${stats.skipped}`);
                if (stats.errors > 0) console.log(`   Ошибки: ${stats.errors}`);
            }
        });

        console.log('\n🎯 Следующие шаги:');
        console.log('1. Проверьте данные в Supabase Dashboard');
        console.log('2. Обновите материализованные представления:');
        console.log('   SELECT refresh_analytics_views();');
        console.log('3. Проверьте аналитические запросы');
    }
}

// ============================================================
// ЗАПУСК МИГРАЦИИ
// ============================================================

async function main() {
    const migrator = new SupabaseMigrator();
    await migrator.run();
}

if (require.main === module) {
    main();
}

module.exports = SupabaseMigrator;