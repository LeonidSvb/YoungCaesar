// ============================================================
// CRON JOB SETUP FOR VAPI SYNC
// Автоматическая синхронизация VAPI → Supabase
// ============================================================

const cron = require('node-cron');
const { VapiSupabaseSync } = require('../vapi_sync/vapi_to_supabase_sync');

// ============================================================
// CRON CONFIGURATION
// ============================================================

const CRON_CONFIG = {
    // Расписания (cron format: minute hour day month weekday)
    SCHEDULES: {
        // Каждые 30 минут в рабочее время (9-18 по будням)
        FREQUENT: '*/30 9-18 * * 1-5',

        // Каждые 2 часа круглосуточно
        REGULAR: '0 */2 * * *',

        // Раз в день в 6 утра
        DAILY: '0 6 * * *',

        // Каждые 15 минут (для тестирования)
        TEST: '*/15 * * * *'
    },

    // Настройки синхронизации для cron
    SYNC_OPTIONS: {
        // Всегда инкрементальная синхронизация для cron
        SYNC: {
            INCREMENTAL: true,
            FORCE_FULL: false,
            INCLUDE_ALL_CALLS: true,
            MIN_COST: 0
        },

        // Минимальное логирование для cron
        OUTPUT: {
            VERBOSE: false,
            LOG_PROGRESS: true,
            SAVE_RESULTS: true
        },

        // Более консервативные настройки для автоматических запусков
        PROCESSING: {
            BATCH_SIZE: 25,
            CONCURRENT_REQUESTS: 5,
            RETRY_ATTEMPTS: 3
        }
    }
};

// ============================================================
// CRON TASKS
// ============================================================

class VapiSyncCron {
    constructor() {
        this.isRunning = false;
        this.lastRun = null;
        this.stats = {
            totalRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            lastError: null
        };
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [CRON-${level.toUpperCase()}] ${message}`;

        console.log(logMessage);

        // В production можно добавить запись в файл или external logging
        // fs.appendFileSync('/var/log/vapi-sync-cron.log', logMessage + '\n');
    }

    async runSync() {
        if (this.isRunning) {
            this.log('Sync already running, skipping...', 'warn');
            return;
        }

        this.isRunning = true;
        this.stats.totalRuns++;

        try {
            this.log('Starting automated VAPI sync...');

            const sync = new VapiSupabaseSync(CRON_CONFIG.SYNC_OPTIONS);
            const results = await sync.run();

            this.stats.successfulRuns++;
            this.lastRun = new Date();

            this.log(`Sync completed successfully: ${results.stats.supabase_calls_synced} calls synced`);

            // Уведомления о важных событиях
            if (results.stats.supabase_calls_synced > 100) {
                this.log(`🚨 Large sync detected: ${results.stats.supabase_calls_synced} calls`, 'warn');
            }

            if (results.stats.errors > 0) {
                this.log(`⚠️ Sync completed with ${results.stats.errors} errors`, 'warn');
            }

            return results;

        } catch (error) {
            this.stats.failedRuns++;
            this.stats.lastError = error.message;

            this.log(`Sync failed: ${error.message}`, 'error');

            // В production можно добавить уведомления (email, Slack, etc.)
            await this.notifyError(error);

            throw error;

        } finally {
            this.isRunning = false;
        }
    }

    async notifyError(error) {
        // Placeholder for error notifications
        // Можно интегрировать с:
        // - Email уведомления
        // - Slack webhooks
        // - SMS alerts
        // - Error tracking сервисы (Sentry, etc.)

        this.log('Error notification sent (placeholder)', 'info');
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun,
            stats: this.stats,
            uptime: process.uptime()
        };
    }

    // Запуск всех cron задач
    start(schedule = 'REGULAR') {
        const cronExpression = CRON_CONFIG.SCHEDULES[schedule];

        if (!cronExpression) {
            throw new Error(`Unknown schedule: ${schedule}. Available: ${Object.keys(CRON_CONFIG.SCHEDULES).join(', ')}`);
        }

        this.log(`Starting cron with schedule: ${schedule} (${cronExpression})`);

        // Основная задача синхронизации
        const syncTask = cron.schedule(cronExpression, async () => {
            await this.runSync();
        }, {
            scheduled: false, // Не запускаем автоматически
            timezone: 'Europe/Moscow' // Укажите ваш часовой пояс
        });

        // Задача статуса каждые 5 минут
        const statusTask = cron.schedule('*/5 * * * *', () => {
            const status = this.getStatus();
            this.log(`Status check - Running: ${status.isRunning}, Total runs: ${status.stats.totalRuns}`);
        }, {
            scheduled: false,
            timezone: 'Europe/Moscow'
        });

        // Запускаем задачи
        syncTask.start();
        statusTask.start();

        this.log('Cron jobs started successfully');

        // Graceful shutdown
        process.on('SIGINT', () => {
            this.log('Shutting down cron jobs...');
            syncTask.destroy();
            statusTask.destroy();
            process.exit(0);
        });

        return { syncTask, statusTask };
    }
}

// ============================================================
// CLI INTERFACE
// ============================================================

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'start';
    const schedule = args[1] || 'REGULAR';

    const cronManager = new VapiSyncCron();

    switch (command) {
        case 'start':
            console.log('🕐 Starting VAPI sync cron jobs...');
            cronManager.start(schedule);
            break;

        case 'test':
            console.log('🧪 Running single sync test...');
            try {
                const results = await cronManager.runSync();
                console.log('✅ Test successful:', results);
                process.exit(0);
            } catch (error) {
                console.error('❌ Test failed:', error.message);
                process.exit(1);
            }
            break;

        case 'status':
            const status = cronManager.getStatus();
            console.log('📊 Cron status:', JSON.stringify(status, null, 2));
            process.exit(0);
            break;

        case 'help':
        default:
            console.log(`
🕐 VAPI Sync Cron Manager

Usage: node setup_vapi_sync_cron.js <command> [schedule]

Commands:
  start [schedule]  - Start cron jobs (default: REGULAR)
  test             - Run single sync test
  status           - Show current status
  help             - Show this help

Schedules:
  FREQUENT         - Every 30 minutes (9-18, weekdays)
  REGULAR          - Every 2 hours (24/7)
  DAILY            - Once daily at 6 AM
  TEST             - Every 15 minutes (for testing)

Examples:
  node setup_vapi_sync_cron.js start DAILY
  node setup_vapi_sync_cron.js test
  node setup_vapi_sync_cron.js status
            `);
            process.exit(0);
    }
}

// ============================================================
// PACKAGE.JSON SCRIPTS
// ============================================================

/*
Добавьте в package.json:

"scripts": {
  "sync:start": "node production_scripts/cron/setup_vapi_sync_cron.js start REGULAR",
  "sync:daily": "node production_scripts/cron/setup_vapi_sync_cron.js start DAILY",
  "sync:test": "node production_scripts/cron/setup_vapi_sync_cron.js test",
  "sync:status": "node production_scripts/cron/setup_vapi_sync_cron.js status"
}
*/

// ============================================================
// SYSTEMD SERVICE (для Linux серверов)
// ============================================================

/*
Создайте файл: /etc/systemd/system/vapi-sync.service

[Unit]
Description=VAPI to Supabase Sync Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/your/project
ExecStart=/usr/bin/node production_scripts/cron/setup_vapi_sync_cron.js start REGULAR
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

Затем:
sudo systemctl enable vapi-sync.service
sudo systemctl start vapi-sync.service
sudo systemctl status vapi-sync.service
*/

// ============================================================
// MODULE EXPORT & EXECUTION
// ============================================================

if (require.main === module) {
    main();
}

module.exports = { VapiSyncCron, CRON_CONFIG };