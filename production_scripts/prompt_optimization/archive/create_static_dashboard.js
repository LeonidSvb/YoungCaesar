const fs = require('fs');
const path = require('path');

function createStaticPromptDashboard() {
    // Читаем шаблон дашборда
    const templatePath = path.join(__dirname, 'dashboard', 'prompt_optimization_dashboard_template.html');
    const correlationsPath = path.join(__dirname, 'results', 'prompt_performance_correlations_latest.json');
    const aggregatedPath = path.join(__dirname, 'results', 'assistant_aggregated_data_latest.json');

    if (!fs.existsSync(templatePath)) {
        console.log('❌ Template file not found');
        return;
    }

    let template = fs.readFileSync(templatePath, 'utf8');

    // Встраиваем данные корреляций
    if (fs.existsSync(correlationsPath)) {
        const correlationsData = fs.readFileSync(correlationsPath, 'utf8');
        template = template.replace(
            /fetch\('\.\/results\/prompt_performance_correlations_latest\.json'\)/g,
            `Promise.resolve({json: () => ${correlationsData}})`
        );
    }

    // Встраиваем агрегированные данные
    if (fs.existsSync(aggregatedPath)) {
        const aggregatedData = fs.readFileSync(aggregatedPath, 'utf8');
        template = template.replace(
            /fetch\('\.\/results\/assistant_aggregated_data_latest\.json'\)/g,
            `Promise.resolve({json: () => ${aggregatedData}})`
        );
    }

    // Создаём статичный дашборд
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const outputPath = path.join(__dirname, 'dashboard', `prompt_optimization_static_${timestamp}.html`);

    fs.writeFileSync(outputPath, template);

    console.log(`✅ Static prompt optimization dashboard created: dashboard/prompt_optimization_static_${timestamp}.html`);
    console.log(`🌐 GitHub Pages ready: Can be opened directly on GitHub`);

    return outputPath;
}

if (require.main === module) {
    createStaticPromptDashboard();
}

module.exports = createStaticPromptDashboard;