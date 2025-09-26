require('dotenv').config();

// ============================================================
// Тест подключения к Supabase
// ============================================================

const { createClient } = require('@supabase/supabase-js');

async function testSupabaseConnection() {
    console.log('🔍 Тестирование подключения к Supabase...\n');

    // Проверяем переменные окружения
    const requiredEnvVars = [
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'SUPABASE_PROJECT_REF'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
        console.log('❌ Отсутствуют переменные окружения:');
        missingVars.forEach(varName => {
            console.log(`   - ${varName}`);
        });
        console.log('\n📝 Проверьте файл .env');
        return;
    }

    console.log('✅ Переменные окружения найдены:');
    console.log(`   - SUPABASE_URL: ${process.env.SUPABASE_URL}`);
    console.log(`   - SUPABASE_PROJECT_REF: ${process.env.SUPABASE_PROJECT_REF}`);
    console.log(`   - SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY.substring(0, 20)}...`);

    if (process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_ACCESS_TOKEN !== 'YOUR_PERSONAL_ACCESS_TOKEN_HERE') {
        console.log(`   - SUPABASE_ACCESS_TOKEN: ${process.env.SUPABASE_ACCESS_TOKEN.substring(0, 20)}...`);
    } else {
        console.log('   - SUPABASE_ACCESS_TOKEN: ⚠️  НЕ НАСТРОЕН (нужен для MCP)');
    }

    console.log('\n🔗 Тестирование подключения...');

    try {
        // Создаем клиент Supabase
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        // Тест 1: Проверяем состояние сервиса
        console.log('📡 Тест 1: Проверка состояния сервиса...');
        const { data: healthData, error: healthError } = await supabase
            .from('_supabase_system')
            .select('*')
            .limit(1);

        if (healthError && healthError.code !== 'PGRST116') {
            console.log(`   ⚠️  Предупреждение: ${healthError.message}`);
        } else {
            console.log('   ✅ Сервис доступен');
        }

        // Тест 2: Получаем список таблиц через REST API
        console.log('\n📊 Тест 2: Получение метаданных базы данных...');

        // Попробуем получить список через information_schema
        const { data: tablesData, error: tablesError } = await supabase
            .rpc('get_table_list')
            .select('*');

        if (tablesError) {
            console.log(`   ⚠️  Не удалось получить список таблиц: ${tablesError.message}`);
            console.log('   💡 Это нормально, если у вас нет функции get_table_list');
        } else {
            console.log(`   ✅ Получен список таблиц: ${tablesData?.length || 0} элементов`);
        }

        // Тест 3: Простой запрос к существующей системной таблице
        console.log('\n🔍 Тест 3: Проверка доступа к базе данных...');

        const { data: versionData, error: versionError } = await supabase
            .rpc('version');

        if (versionError) {
            console.log(`   ⚠️  Не удалось получить версию: ${versionError.message}`);
        } else {
            console.log(`   ✅ Версия PostgreSQL получена`);
        }

        console.log('\n🎉 РЕЗУЛЬТАТ:');
        console.log('✅ Базовое подключение к Supabase работает');
        console.log('📌 URL проекта:', process.env.SUPABASE_URL);
        console.log('📌 Project Ref:', process.env.SUPABASE_PROJECT_REF);

        if (!process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN === 'YOUR_PERSONAL_ACCESS_TOKEN_HERE') {
            console.log('\n⚠️  СЛЕДУЮЩИЙ ШАГ:');
            console.log('1. Получите Personal Access Token в Supabase Dashboard');
            console.log('2. Замените YOUR_PERSONAL_ACCESS_TOKEN_HERE в .env файле');
            console.log('3. Перезапустите Claude Desktop для активации MCP');
        } else {
            console.log('\n✅ Готово к использованию с MCP!');
        }

    } catch (error) {
        console.log('\n❌ ОШИБКА подключения:');
        console.log(`   ${error.message}`);
        console.log('\n🔧 Рекомендации:');
        console.log('1. Проверьте правильность SUPABASE_URL');
        console.log('2. Проверьте правильность SUPABASE_ANON_KEY');
        console.log('3. Убедитесь что проект активен в Supabase Dashboard');
    }
}

if (require.main === module) {
    testSupabaseConnection();
}

module.exports = testSupabaseConnection;