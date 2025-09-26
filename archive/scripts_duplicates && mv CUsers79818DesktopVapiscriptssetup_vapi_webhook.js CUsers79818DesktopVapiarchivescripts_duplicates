const AirtableClient = require('./api/airtable_client');
const fs = require('fs');
require('dotenv').config();

class ComprehensiveQCIAnalysis {
    constructor() {
        this.airtable = new AirtableClient();
        this.results = {
            overview: {},
            assistantBreakdown: {},
            errors: {},
            improvements: {},
            conversion: {},
            recommendations: {}
        };
    }

    async collectAllData() {
        console.log('🔄 Собираю все данные из Airtable...');

        const records = await this.airtable.getAllRecords(process.env.AIRTABLE_TABLE_ID);

        // Фильтруем только проанализированные звонки
        const analyzedCalls = records.filter(r =>
            r.fields['QCI Score'] &&
            r.fields['Transcript'] &&
            r.fields['Transcript'].length > 200
        );

        console.log(`✅ Найдено ${analyzedCalls.length} проанализированных звонков`);
        return analyzedCalls;
    }

    analyzeOverview(calls) {
        console.log('📊 Анализ общей статистики...');

        const scores = calls.map(c => c.fields['QCI Score']).filter(s => s);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

        // Распределение по классификации
        const classifications = {};
        calls.forEach(c => {
            const cls = c.fields['Call Class'] || 'unknown';
            classifications[cls] = (classifications[cls] || 0) + 1;
        });

        // Статус звонков
        const statuses = {};
        calls.forEach(c => {
            const status = c.fields['Status'] || 'unknown';
            statuses[status] = (statuses[status] || 0) + 1;
        });

        // Причины завершения
        const endReasons = {};
        calls.forEach(c => {
            const reason = c.fields['End Reason'] || 'unknown';
            endReasons[reason] = (endReasons[reason] || 0) + 1;
        });

        // Встречи запланированы
        const meetingsScheduled = calls.filter(c =>
            c.fields['Meeting Sched'] === true
        ).length;

        this.results.overview = {
            totalCalls: calls.length,
            averageQCI: Math.round(avgScore * 10) / 10,
            scoreDistribution: {
                excellent: scores.filter(s => s >= 80).length,
                good: scores.filter(s => s >= 60 && s < 80).length,
                average: scores.filter(s => s >= 40 && s < 60).length,
                poor: scores.filter(s => s < 40).length
            },
            classifications,
            statuses,
            endReasons,
            conversionRate: {
                meetingsScheduled,
                rate: Math.round((meetingsScheduled / calls.length) * 1000) / 10 + '%'
            }
        };
    }

    analyzeByAssistant(calls) {
        console.log('🤖 Анализ по ассистентам...');

        const assistantStats = {};

        calls.forEach(call => {
            const assistant = call.fields['Assistant Name'] || 'Unknown';

            if (!assistantStats[assistant]) {
                assistantStats[assistant] = {
                    name: assistant,
                    totalCalls: 0,
                    scores: [],
                    classifications: {},
                    meetingsScheduled: 0,
                    averageDuration: 0,
                    durations: [],
                    coachingTips: [],
                    commonIssues: [],
                    avgCost: 0,
                    costs: []
                };
            }

            const stats = assistantStats[assistant];
            stats.totalCalls++;

            // QCI скоры
            if (call.fields['QCI Score']) {
                stats.scores.push(call.fields['QCI Score']);
            }

            // Классификация
            const cls = call.fields['Call Class'] || 'unknown';
            stats.classifications[cls] = (stats.classifications[cls] || 0) + 1;

            // Встречи
            if (call.fields['Meeting Sched']) {
                stats.meetingsScheduled++;
            }

            // Длительность
            if (call.fields['Duration (seconds)']) {
                stats.durations.push(call.fields['Duration (seconds)']);
            }

            // Coaching tips
            if (call.fields['Coaching Tips']) {
                const tips = call.fields['Coaching Tips'].split('\n').filter(t => t.trim());
                stats.coachingTips.push(...tips);
            }

            // Стоимость
            if (call.fields['Cost']) {
                stats.costs.push(call.fields['Cost']);
            }
        });

        // Вычисляем агрегаты
        Object.values(assistantStats).forEach(stats => {
            stats.averageQCI = stats.scores.length > 0
                ? Math.round((stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length) * 10) / 10
                : 0;

            stats.averageDuration = stats.durations.length > 0
                ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
                : 0;

            stats.conversionRate = Math.round((stats.meetingsScheduled / stats.totalCalls) * 1000) / 10;

            stats.avgCost = stats.costs.length > 0
                ? Math.round((stats.costs.reduce((a, b) => a + b, 0) / stats.costs.length) * 100) / 100
                : 0;

            // Топ coaching tips
            const tipCounts = {};
            stats.coachingTips.forEach(tip => {
                const cleanTip = tip.trim().toLowerCase();
                tipCounts[cleanTip] = (tipCounts[cleanTip] || 0) + 1;
            });

            stats.topCoachingTips = Object.entries(tipCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([tip, count]) => ({ tip, count }));
        });

        this.results.assistantBreakdown = assistantStats;
    }

    analyzeCommonIssues(calls) {
        console.log('🔍 Анализ частых проблем...');

        const allTips = [];
        calls.forEach(call => {
            if (call.fields['Coaching Tips']) {
                const tips = call.fields['Coaching Tips'].split('\n').filter(t => t.trim());
                allTips.push(...tips.map(t => t.trim().toLowerCase()));
            }
        });

        // Подсчёт частоты
        const tipCounts = {};
        allTips.forEach(tip => {
            tipCounts[tip] = (tipCounts[tip] || 0) + 1;
        });

        const sortedTips = Object.entries(tipCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 15);

        this.results.errors = {
            totalIssues: allTips.length,
            uniqueIssues: Object.keys(tipCounts).length,
            mostCommon: sortedTips.map(([tip, count]) => ({
                issue: tip,
                frequency: count,
                percentage: Math.round((count / allTips.length) * 1000) / 10
            }))
        };
    }

    generateRecommendations() {
        console.log('💡 Генерация рекомендаций...');

        const recommendations = {};

        // Для каждого ассистента
        Object.values(this.results.assistantBreakdown).forEach(assistant => {
            const recs = [];

            // Низкий QCI
            if (assistant.averageQCI < 50) {
                recs.push({
                    priority: 'high',
                    type: 'qci_improvement',
                    message: `Критически низкий QCI (${assistant.averageQCI}). Необходимо срочное улучшение промпта.`
                });
            }

            // Низкая конверсия
            if (assistant.conversionRate < 10) {
                recs.push({
                    priority: 'high',
                    type: 'conversion',
                    message: `Низкая конверсия встреч (${assistant.conversionRate}%). Улучшить технику закрытия.`
                });
            }

            // Частые проблемы
            if (assistant.topCoachingTips.length > 0) {
                recs.push({
                    priority: 'medium',
                    type: 'coaching',
                    message: `Топ проблема: "${assistant.topCoachingTips[0].tip}" (${assistant.topCoachingTips[0].count} раз)`
                });
            }

            recommendations[assistant.name] = recs;
        });

        this.results.recommendations = recommendations;
    }

    async saveResults() {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `reports/qci_comprehensive_analysis_${timestamp}.json`;

        // Создаём директорию если не существует
        if (!fs.existsSync('reports')) {
            fs.mkdirSync('reports', { recursive: true });
        }

        fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
        console.log(`✅ Результаты сохранены: ${filename}`);

        return filename;
    }

    displaySummary() {
        console.log('\n🎉 КРАТКАЯ СВОДКА АНАЛИЗА:');
        console.log('===============================');

        const overview = this.results.overview;
        console.log(`📞 Всего звонков: ${overview.totalCalls}`);
        console.log(`📊 Средний QCI: ${overview.averageQCI}`);
        console.log(`🎯 Конверсия встреч: ${overview.conversionRate.rate}`);

        console.log('\n🏆 ТОП АССИСТЕНТЫ ПО QCI:');
        const topAssistants = Object.values(this.results.assistantBreakdown)
            .sort((a, b) => b.averageQCI - a.averageQCI)
            .slice(0, 5);

        topAssistants.forEach((assistant, i) => {
            console.log(`${i + 1}. ${assistant.name}: QCI ${assistant.averageQCI} (${assistant.totalCalls} звонков)`);
        });

        console.log('\n🔥 ЧАСТЫЕ ПРОБЛЕМЫ:');
        this.results.errors.mostCommon.slice(0, 5).forEach((issue, i) => {
            console.log(`${i + 1}. ${issue.issue} (${issue.percentage}%)`);
        });
    }

    async run() {
        console.log('🚀 ЗАПУСК КОМПЛЕКСНОГО QCI АНАЛИЗА\n');

        try {
            const calls = await this.collectAllData();

            this.analyzeOverview(calls);
            this.analyzeByAssistant(calls);
            this.analyzeCommonIssues(calls);
            this.generateRecommendations();

            const filename = await this.saveResults();
            this.displaySummary();

            return { success: true, filename, results: this.results };

        } catch (error) {
            console.error('❌ Ошибка анализа:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// Запуск если вызван напрямую
if (require.main === module) {
    const analyzer = new ComprehensiveQCIAnalysis();
    analyzer.run().catch(console.error);
}

module.exports = ComprehensiveQCIAnalysis;