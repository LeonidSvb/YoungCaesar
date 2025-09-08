// 🎯 VAPI ALL Calls Collector - Gets ALL calls without filtering
// Then generates analytics report

// ========== SETTINGS (CHANGE THESE VALUES) ==========
const VAPI_API_KEY = "186d494d-210e-4dcc-94cc-0620e1da56e0";
const START_DATE = "2025-09-02"; 
const END_DATE = "2025-09-09";   
const MAX_CALLS_PER_REQUEST = 100;
// =====================================================

const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

// 🌐 Function to request VAPI API
async function getVapiCalls(startTime, endTime, limit = 100) {
  try {
    const params = new URLSearchParams({
      createdAtGe: startTime,
      createdAtLt: endTime,
      limit: limit.toString()
    });
    
    const url = `https://api.vapi.ai/call?${params}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`📞 Request: ${startTime.substring(0,19)} - ${endTime.substring(0,19)}, received: ${data.length} calls`);
    return data;
    
  } catch (error) {
    console.error(`❌ API Error: ${error.message}`);
    throw error;
  }
}

// 🔄 Recursive function to collect ALL calls with adaptive time splitting
async function getAllCallsRecursive(startTime, endTime, depth = 0) {
  const indent = "  ".repeat(depth);
  
  try {
    const calls = await getVapiCalls(startTime, endTime, MAX_CALLS_PER_REQUEST);
    
    if (calls.length < MAX_CALLS_PER_REQUEST) {
      // ✅ Got all calls in this period - return ALL of them
      console.log(`${indent}✅ Got ${calls.length} calls`);
      return calls;
      
    } else {
      // 🔄 Too many calls - split period in half
      console.log(`${indent}⚡ Splitting period (100 calls limit reached)`);
      
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();
      const middleMs = startMs + (endMs - startMs) / 2;
      const middleTime = new Date(middleMs).toISOString();
      
      // Recursively get ALL calls from both parts
      const part1 = await getAllCallsRecursive(startTime, middleTime, depth + 1);
      const part2 = await getAllCallsRecursive(middleTime, endTime, depth + 1);
      
      return [...part1, ...part2];
    }
    
  } catch (error) {
    console.error(`${indent}❌ Error in period ${startTime} - ${endTime}: ${error.message}`);
    return [];
  }
}

// 📅 Function to add days to date
function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// 📊 Function to analyze calls
function analyzeCallsForDay(calls, date) {
  const stats = {
    date: date,
    totalCalls: calls.length,
    withTranscript: 0,
    withoutTranscript: 0,
    successfulCalls: 0,
    failedCalls: 0,
    duration30Plus: 0,
    duration60Plus: 0,
    duration120Plus: 0,
    totalCost: 0,
    avgDuration: 0,
    avgCost: 0,
    byStatus: {},
    byEndReason: {}
  };
  
  let totalDuration = 0;
  
  calls.forEach(call => {
    // Transcript analysis
    if (call.transcript && call.transcript.length > 10) {
      stats.withTranscript++;
    } else {
      stats.withoutTranscript++;
    }
    
    // Status analysis
    if (call.status === 'ended' || call.status === 'completed') {
      stats.successfulCalls++;
    } else {
      stats.failedCalls++;
    }
    
    // Duration analysis
    const duration = call.startedAt && call.endedAt ? 
      Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) : 0;
    
    if (duration >= 30) stats.duration30Plus++;
    if (duration >= 60) stats.duration60Plus++;
    if (duration >= 120) stats.duration120Plus++;
    
    totalDuration += duration;
    
    // Cost analysis
    stats.totalCost += call.cost || 0;
    
    // Group by status
    const status = call.status || 'unknown';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    
    // Group by end reason
    const endReason = call.endedReason || 'unknown';
    stats.byEndReason[endReason] = (stats.byEndReason[endReason] || 0) + 1;
  });
  
  // Calculate averages
  if (calls.length > 0) {
    stats.avgDuration = Math.round(totalDuration / calls.length);
    stats.avgCost = Math.round((stats.totalCost / calls.length) * 100) / 100;
  }
  
  return stats;
}

// 📊 Main processing function
async function processAllDates() {
  console.log(`\n🚀 Starting COMPLETE call collection from ${START_DATE} to ${END_DATE}`);
  console.log(`📌 Getting ALL calls (no filtering)\n`);
  
  const allRawData = [];
  const dailyStats = [];
  let currentDate = START_DATE;
  let dayCount = 0;
  let grandTotal = 0;
  
  while (currentDate < END_DATE) {
    dayCount++;
    const nextDate = addDays(currentDate, 1);
    
    console.log(`\n📅 === DAY ${dayCount}: ${currentDate} ===`);
    
    const dayStart = `${currentDate}T00:00:00Z`;
    const dayEnd = `${nextDate}T00:00:00Z`;
    
    try {
      // Get ALL calls for this day
      const dayCalls = await getAllCallsRecursive(dayStart, dayEnd);
      
      // Analyze the calls
      const dayAnalytics = analyzeCallsForDay(dayCalls, currentDate);
      dailyStats.push(dayAnalytics);
      
      // Save raw data
      allRawData.push({
        date: currentDate,
        calls: dayCalls
      });
      
      grandTotal += dayCalls.length;
      
      // Print day summary
      console.log(`\n📊 Day ${currentDate} Summary:`);
      console.log(`  Total calls: ${dayAnalytics.totalCalls}`);
      console.log(`  With transcript: ${dayAnalytics.withTranscript}`);
      console.log(`  Successful: ${dayAnalytics.successfulCalls}`);
      console.log(`  30+ seconds: ${dayAnalytics.duration30Plus}`);
      console.log(`  60+ seconds: ${dayAnalytics.duration60Plus}`);
      console.log(`  Total cost: $${dayAnalytics.totalCost.toFixed(2)}`);
      
      // Small pause between days
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Error processing day ${currentDate}: ${error.message}`);
    }
    
    currentDate = nextDate;
  }
  
  // 📊 Generate final report
  const report = {
    summary: {
      dateRange: `${START_DATE} to ${END_DATE}`,
      totalDays: dayCount,
      totalCalls: grandTotal,
      totalWithTranscript: dailyStats.reduce((sum, day) => sum + day.withTranscript, 0),
      totalSuccessful: dailyStats.reduce((sum, day) => sum + day.successfulCalls, 0),
      total30SecPlus: dailyStats.reduce((sum, day) => sum + day.duration30Plus, 0),
      total60SecPlus: dailyStats.reduce((sum, day) => sum + day.duration60Plus, 0),
      totalCost: dailyStats.reduce((sum, day) => sum + day.totalCost, 0)
    },
    dailyStats: dailyStats
  };
  
  console.log(`\n\n🎉 === FINAL SUMMARY ===`);
  console.log(`📊 Total days processed: ${report.summary.totalDays}`);
  console.log(`📞 TOTAL CALLS: ${report.summary.totalCalls}`);
  console.log(`📝 With transcript: ${report.summary.totalWithTranscript}`);
  console.log(`✅ Successful: ${report.summary.totalSuccessful}`);
  console.log(`⏱️ 30+ seconds: ${report.summary.total30SecPlus}`);
  console.log(`⏱️ 60+ seconds: ${report.summary.total60SecPlus}`);
  console.log(`💰 Total cost: $${report.summary.totalCost.toFixed(2)}`);
  
  // 💾 Save all files
  const timestamp = new Date().toISOString().split('T')[0];
  
  // 1. Raw data (ALL calls)
  const rawDataFile = path.join(__dirname, `vapi_raw_calls_${timestamp}.json`);
  await fs.writeFile(rawDataFile, JSON.stringify(allRawData, null, 2));
  console.log(`\n💾 Raw data saved to: ${rawDataFile}`);
  
  // 2. Analytics report
  const reportFile = path.join(__dirname, `vapi_analytics_report_${timestamp}.json`);
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
  console.log(`📊 Analytics report saved to: ${reportFile}`);
  
  // 3. CSV report for Excel
  const csvContent = generateCSV(dailyStats);
  const csvFile = path.join(__dirname, `vapi_daily_stats_${timestamp}.csv`);
  await fs.writeFile(csvFile, csvContent);
  console.log(`📈 CSV report saved to: ${csvFile}`);
  
  // 4. All call IDs
  const allIds = allRawData.flatMap(day => day.calls.map(call => call.id));
  const idsFile = path.join(__dirname, `vapi_all_call_ids_${timestamp}.json`);
  await fs.writeFile(idsFile, JSON.stringify(allIds, null, 2));
  console.log(`📝 All IDs saved to: ${idsFile}`);
  
  return { rawData: allRawData, report: report };
}

// 📊 Generate CSV for Excel
function generateCSV(dailyStats) {
  const headers = [
    'Date',
    'Total Calls',
    'With Transcript',
    'Without Transcript', 
    'Successful',
    'Failed',
    '30+ sec',
    '60+ sec',
    '120+ sec',
    'Avg Duration (sec)',
    'Total Cost ($)',
    'Avg Cost ($)'
  ].join(',');
  
  const rows = dailyStats.map(day => [
    day.date,
    day.totalCalls,
    day.withTranscript,
    day.withoutTranscript,
    day.successfulCalls,
    day.failedCalls,
    day.duration30Plus,
    day.duration60Plus,
    day.duration120Plus,
    day.avgDuration,
    day.totalCost.toFixed(2),
    day.avgCost.toFixed(2)
  ].join(','));
  
  return [headers, ...rows].join('\n');
}

// 🚀 EXECUTION
(async () => {
  try {
    await processAllDates();
    console.log('\n✅ Script completed successfully!');
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
})();