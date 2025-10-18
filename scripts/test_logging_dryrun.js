#!/usr/bin/env node
/**
 * Dry-run test для проверки системы логирования
 * Industry best practice: тестируем логирование без реальных изменений в БД
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createLogger } = require('../production_scripts/shared/logger');

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');

const logger = createLogger('logging-test');

async function simulateProductionWorkflow() {
    logger.info('=== Запуск теста системы логирования ===', {
        dryRun: DRY_RUN,
        timestamp: new Date().toISOString()
    });

    // Имитация работы production скрипта
    const steps = [
        { name: 'Инициализация', duration: 100 },
        { name: 'Подключение к API', duration: 200 },
        { name: 'Загрузка данных', duration: 300 },
        { name: 'Обработка', duration: 150 },
        { name: 'Синхронизация', duration: 250 }
    ];

    for (const step of steps) {
        logger.info(`Шаг: ${step.name}`, {
            step: step.name,
            dryRun: DRY_RUN,
            estimatedDuration: step.duration
        });

        // Имитация работы
        await new Promise(resolve => setTimeout(resolve, step.duration));

        if (DRY_RUN) {
            logger.info(`[DRY-RUN] ${step.name} - пропущен`, {
                step: step.name,
                skipped: true
            });
        } else {
            logger.info(`${step.name} - завершен`, {
                step: step.name,
                completed: true
            });
        }
    }

    // Тест предупреждений
    logger.warn('Тестовое предупреждение', {
        type: 'test',
        severity: 'low',
        dryRun: DRY_RUN
    });

    // Тест обработки ошибок (имитация)
    try {
        if (!DRY_RUN) {
            // В реальном режиме имитируем ошибку
            throw new Error('Тестовая ошибка для проверки логирования');
        } else {
            logger.info('[DRY-RUN] Пропуск операции которая может вызвать ошибку', {
                operation: 'risky-operation',
                skipped: true
            });
        }
    } catch (error) {
        logger.error('Поймана тестовая ошибка', error);
    }

    // Финальная статистика
    const stats = {
        totalSteps: steps.length,
        completedSteps: DRY_RUN ? 0 : steps.length,
        skippedSteps: DRY_RUN ? steps.length : 0,
        warnings: 1,
        errors: DRY_RUN ? 0 : 1,
        dryRun: DRY_RUN
    };

    logger.info('=== Тест завершен ===', stats);

    // Вывод инструкций
    console.log('\n' + '='.repeat(60));
    console.log('✅ Тест системы логирования завершен');
    console.log('='.repeat(60));
    console.log(`\nРежим: ${DRY_RUN ? 'DRY-RUN (без изменений)' : 'PRODUCTION (реальные операции)'}`);
    console.log('\nПроверьте созданные логи:');
    console.log(`  📄 Все логи:     logs/${new Date().toISOString().split('T')[0]}.log`);
    console.log(`  ❌ Только ошибки: logs/errors/${new Date().toISOString().split('T')[0]}.log`);
    console.log('\nКоманды для просмотра:');
    console.log(`  cat logs/${new Date().toISOString().split('T')[0]}.log`);
    console.log(`  grep '"level":"ERROR"' logs/${new Date().toISOString().split('T')[0]}.log`);
    console.log(`  grep '"level":"WARN"' logs/${new Date().toISOString().split('T')[0]}.log`);
    console.log('\nДля запуска в разных режимах:');
    console.log('  npm run test:logging           # Dry-run режим');
    console.log('  npm run test:logging:real      # Реальный режим');
    console.log('='.repeat(60) + '\n');
}

// Запуск
simulateProductionWorkflow()
    .then(() => process.exit(0))
    .catch((error) => {
        logger.error('Критическая ошибка теста', error);
        process.exit(1);
    });
