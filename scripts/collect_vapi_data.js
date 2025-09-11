const VapiClient = require('./api/vapi_client');
const DataUtils = require('./utils/data_utils');
const Logger = require('./utils/logger');

const logger = new Logger('vapi_collection.log');

async function collectVapiData(startDate, endDate) {
    try {
        logger.info(`Starting VAPI data collection: ${startDate} to ${endDate}`);
        
        const vapiClient = new VapiClient();
        
        // Collect all calls
        const allCalls = await vapiClient.getAllCalls(`${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`);
        
        if (allCalls.length === 0) {
            logger.warning('No calls found in the specified date range');
            return;
        }

        // Generate analytics for each day
        const dailyAnalytics = {};
        let currentDate = startDate;
        
        while (currentDate <= endDate) {
            const dayStart = `${currentDate}T00:00:00.000Z`;
            const dayEnd = `${currentDate}T23:59:59.999Z`;
            
            const dayCalls = allCalls.filter(call => {
                const callDate = new Date(call.createdAt);
                return callDate >= new Date(dayStart) && callDate <= new Date(dayEnd);
            });
            
            if (dayCalls.length > 0) {
                dailyAnalytics[currentDate] = vapiClient.analyzeCallsForDay(dayCalls, currentDate);
            }
            
            currentDate = DataUtils.addDays(currentDate, 1);
        }

        // Save collected data
        const timestamp = DataUtils.generateTimestamp();
        
        await DataUtils.saveJsonData(allCalls, `vapi_raw_calls_${timestamp}.json`, 'data/raw');
        await DataUtils.saveJsonData(dailyAnalytics, `vapi_analytics_report_${timestamp}.json`, 'data/raw');
        
        // Collect and save assistant information
        try {
            const assistants = await vapiClient.getAssistants();
            const assistantMapping = {};
            assistants.forEach(assistant => {
                assistantMapping[assistant.id] = {
                    name: assistant.name,
                    model: assistant.model,
                    voice: assistant.voice
                };
            });
            
            await DataUtils.saveJsonData(assistantMapping, 'assistant_mapping.json', 'data/processed');
        } catch (error) {
            logger.error('Failed to collect assistant data', error);
        }

        // Summary
        const totalCalls = allCalls.length;
        const totalCost = allCalls.reduce((sum, call) => sum + (call.cost || 0), 0);
        const withTranscripts = allCalls.filter(call => call.transcript && call.transcript !== 'N/A').length;
        
        logger.success(`Data collection completed!`);
        logger.info(`Total calls: ${totalCalls}`);
        logger.info(`Calls with transcripts: ${withTranscripts} (${Math.round(withTranscripts/totalCalls*100)}%)`);
        logger.info(`Total cost: $${totalCost.toFixed(2)}`);
        
        return {
            calls: allCalls,
            analytics: dailyAnalytics,
            summary: {
                totalCalls,
                totalCost,
                withTranscripts,
                dateRange: { startDate, endDate }
            }
        };

    } catch (error) {
        logger.error('VAPI data collection failed', error);
        throw error;
    }
}

// Command line usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node collect_vapi_data.js <start-date> <end-date>');
        console.log('Example: node collect_vapi_data.js 2025-09-01 2025-09-10');
        process.exit(1);
    }
    
    const [startDate, endDate] = args;
    collectVapiData(startDate, endDate)
        .then(() => {
            console.log('✅ Collection completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Collection failed:', error.message);
            process.exit(1);
        });
}

module.exports = collectVapiData;