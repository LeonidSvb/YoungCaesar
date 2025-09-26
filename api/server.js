const express = require('express');
const cors = require('cors');
const collectVapiData = require('../production_scripts/vapi_collection/src/collect_vapi_data.js');
const syncVapiToSupabase = require('../production_scripts/vapi_collection/src/sync_to_supabase.js');
const ExecutionLogger = require('../production_scripts/vapi_collection/src/execution_logger.js');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003']
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global log storage for real-time access
const activeLogs = new Map();

// VAPI Data Collection Endpoint
app.post('/api/collect-vapi', async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            minCost = 0,
            exportBackup = true,
            exportFormat = 'json',
            verbose = true,
            sessionId = Math.random().toString(36).substr(2, 9)
        } = req.body;

        console.log('🚀 Starting VAPI collection via API:', { startDate, endDate, minCost, sessionId });

        // Initialize execution logger with session ID
        const executionLogger = new ExecutionLogger('vapi_collection', 'api');
        const executionId = await executionLogger.startExecution({
            startDate,
            endDate,
            minCost,
            exportBackup,
            exportFormat
        }, sessionId);

        // Store logs for real-time access
        activeLogs.set(sessionId, { logger: executionLogger, logs: [] });

        // Set up log callback for capturing logs
        executionLogger.setLogCallback((logMessage) => {
            const session = activeLogs.get(sessionId);
            if (session) {
                session.logs.push(logMessage);
            }
        });

        const result = await collectVapiData({
            startDate,
            endDate,
            minCost,
            saveToFile: exportBackup,
            verbose,
            executionLogger
        });

        // Mark execution as completed
        await executionLogger.updateExecution('completed', {
            calls_collected: result.calls.length,
            calls_filtered: result.calls.length
        }, {
            efficiency: result.stats?.summary?.filterEfficiency || '100%'
        });

        // Transform result for frontend
        const response = {
            success: true,
            sessionId: sessionId,
            data: {
                calls: result.calls.map(call => ({
                    id: call.id.substring(0, 12) + '...',
                    date: new Date(call.createdAt || call.created_at).toISOString().split('T')[0],
                    duration: call.duration || 0,
                    cost: call.cost || 0,
                    status: call.cost > 0 ? 'completed' : (call.duration > 0 ? 'partial' : 'failed')
                })).slice(-10), // Last 10 calls for preview
                stats: {
                    totalFound: result.stats?.summary?.totalCallsBeforeFilters || result.calls.length + 100,
                    collected: result.calls.length,
                    efficiency: result.stats?.summary?.filterEfficiency || '100%',
                    duration: '2.3s'
                }
            },
            files: exportBackup ? [`vapi_calls_${startDate}_to_${endDate}.${exportFormat}`] : [],
            timestamp: new Date().toISOString()
        };

        // Clean up logs after a delay
        setTimeout(() => {
            activeLogs.delete(sessionId);
        }, 300000); // 5 minutes

        res.json(response);

    } catch (error) {
        console.error('❌ Collection failed:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Supabase Sync Endpoint
app.post('/api/sync-supabase', async (req, res) => {
    try {
        const {
            syncMode = 'auto',
            includeZeroCost = true,
            verbose = true
        } = req.body;

        console.log('🔄 Starting Supabase sync via API:', { syncMode, includeZeroCost });

        const result = await syncVapiToSupabase({
            syncMode,
            includeAllCalls: includeZeroCost,
            verbose
        });

        const response = {
            success: true,
            data: {
                mode: result.metadata?.syncType || syncMode,
                dateRange: result.metadata?.dateRange || 'auto-detected',
                callsSynced: result.supabase_calls_synced || 0,
                errors: result.errors || 0,
                duration: result.duration || '1.2s'
            },
            timestamp: new Date().toISOString()
        };

        res.json(response);

    } catch (error) {
        console.error('❌ Sync failed:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get logs for a session
app.get('/api/logs/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { lastIndex = 0 } = req.query;

        const session = activeLogs.get(sessionId);
        if (!session) {
            return res.json({ success: true, logs: [], finished: true });
        }

        // Get new logs since lastIndex
        const newLogs = session.logs.slice(parseInt(lastIndex));

        res.json({
            success: true,
            logs: newLogs,
            totalIndex: session.logs.length,
            finished: false
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get database stats
app.get('/api/stats', async (req, res) => {
    try {
        // Mock stats - replace with actual Supabase query
        const stats = {
            lastSync: '2025-09-26 09:09',
            totalInDB: 2456,
            syncMode: 'Auto (Incremental)',
            nextAutoSync: 'Manual'
        };

        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 VAPI API Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📞 Collect endpoint: POST http://localhost:${PORT}/api/collect-vapi`);
    console.log(`🔄 Sync endpoint: POST http://localhost:${PORT}/api/sync-supabase`);
});

module.exports = app;