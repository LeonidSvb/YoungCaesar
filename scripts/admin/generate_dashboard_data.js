const fs = require('fs');
const path = require('path');

// Читаем данные анализа и промптов
function generateDashboardData() {
    try {
        // Найти последние файлы
        const reportsDir = path.join(__dirname, '..', 'reports');
        const processedDir = path.join(__dirname, '..', 'data', 'processed');

        const analysisFiles = fs.readdirSync(reportsDir)
            .filter(f => f.startsWith('qci_comprehensive_analysis_'))
            .sort()
            .reverse();

        const promptFiles = fs.readdirSync(processedDir)
            .filter(f => f.startsWith('assistant_prompts_'))
            .sort()
            .reverse();

        if (analysisFiles.length === 0 || promptFiles.length === 0) {
            throw new Error('Required data files not found');
        }

        // Читаем данные
        const analysisData = JSON.parse(fs.readFileSync(path.join(reportsDir, analysisFiles[0]), 'utf8'));
        const promptsData = JSON.parse(fs.readFileSync(path.join(processedDir, promptFiles[0]), 'utf8'));

        console.log('✅ Данные загружены:');
        console.log(`   - Анализ: ${analysisFiles[0]}`);
        console.log(`   - Промпты: ${promptFiles[0]}`);

        // Создаем встроенный JavaScript с данными
        const dashboardData = {
            analysis: analysisData,
            prompts: promptsData,
            timestamp: new Date().toISOString()
        };

        return dashboardData;

    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error.message);
        return null;
    }
}

if (require.main === module) {
    const data = generateDashboardData();
    if (data) {
        const jsContent = `window.DASHBOARD_DATA = ${JSON.stringify(data, null, 2)};`;
        fs.writeFileSync(path.join(__dirname, '..', 'dashboards', 'dashboard_data.js'), jsContent);
        console.log('✅ dashboard_data.js создан');
    }
}

module.exports = generateDashboardData;