const fs = require('fs');
const path = require('path');

function createStaticDashboard() {
    // Читаем шаблон дашборда
    const templatePath = path.join(__dirname, 'dashboard', 'qci_dashboard_template.html');
    const dataPath = path.join(__dirname, 'results', 'qci_full_calls_with_assistants_latest.json');

    if (!fs.existsSync(templatePath) || !fs.existsSync(dataPath)) {
        console.log('❌ Template or data file not found');
        return;
    }

    let template = fs.readFileSync(templatePath, 'utf8');
    const data = fs.readFileSync(dataPath, 'utf8');

    // Заменяем fetch() на встроенные данные
    const fetchReplacement = `
                // Static data embedded for GitHub Pages compatibility
                analysisData = ${data};
                processData();`;

    template = template.replace(
        /\/\/ Auto-detect latest QCI results file[\s\S]*?} catch \(error\) {[\s\S]*?loadSampleData\(\);\s*}/,
        fetchReplacement
    );

    // Создаём статичный дашборд
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const outputPath = path.join(__dirname, 'dashboard', `qci_static_dashboard_${timestamp}.html`);

    fs.writeFileSync(outputPath, template);

    console.log(`✅ Static dashboard created: dashboard/qci_static_dashboard_${timestamp}.html`);
    console.log(`🌐 GitHub Pages ready: Can be opened directly on GitHub`);

    return outputPath;
}

if (require.main === module) {
    createStaticDashboard();
}

module.exports = createStaticDashboard;