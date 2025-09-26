// ============================================================
// API ENDPOINT FOR VAPI SYNC
// Usage: POST /api/sync with optional parameters
// ============================================================

const { VapiSupabaseSync } = require('../../production_scripts/vapi_sync/vapi_to_supabase_sync');

// Enable CORS for all origins (adjust for production)
const cors = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }
    return false;
};

module.exports = async function handler(req, res) {
    // Handle CORS
    if (cors(req, res)) return;

    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed',
            message: 'Use POST to trigger sync'
        });
    }

    try {
        // Parse request body for sync options
        const {
            startDate,
            endDate,
            includeAllCalls = true,
            forceFullSync = false,
            minCost = 0
        } = req.body || {};

        // Configure sync options
        const syncOptions = {};

        if (startDate || endDate) {
            syncOptions.DATE_RANGE = {
                START_DATE: startDate || '2025-01-01',
                END_DATE: endDate || new Date().toISOString().split('T')[0]
            };
        }

        if (forceFullSync !== undefined) {
            syncOptions.SYNC = {
                INCREMENTAL: !forceFullSync,
                FORCE_FULL: forceFullSync,
                INCLUDE_ALL_CALLS: includeAllCalls,
                MIN_COST: minCost
            };
        }

        // Override verbose for API (less logging)
        syncOptions.OUTPUT = {
            VERBOSE: false,
            LOG_PROGRESS: true,
            SAVE_RESULTS: false
        };

        console.log('🚀 API Sync started with options:', syncOptions);

        // Run sync
        const sync = new VapiSupabaseSync(syncOptions);
        const results = await sync.run();

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Sync completed successfully',
            data: results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ API Sync error:', error);

        // Return error response
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Sync failed',
            timestamp: new Date().toISOString()
        });
    }
};

// ============================================================
// DEVELOPMENT SERVER (for testing)
// ============================================================

if (require.main === module) {
    const http = require('http');
    const url = require('url');

    const server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);

        if (parsedUrl.pathname === '/api/sync') {
            // Parse JSON body
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    req.body = body ? JSON.parse(body) : {};
                } catch (e) {
                    req.body = {};
                }
                handler(req, res);
            });
        } else {
            // Health check endpoint
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                service: 'VAPI Sync API',
                status: 'healthy',
                endpoints: {
                    sync: 'POST /api/sync',
                    health: 'GET /'
                },
                timestamp: new Date().toISOString()
            }));
        }
    });

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`🚀 VAPI Sync API running on http://localhost:${PORT}`);
        console.log(`📝 Test with: curl -X POST http://localhost:${PORT}/api/sync`);
    });
}