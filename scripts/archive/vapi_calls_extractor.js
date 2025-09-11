// 🎯 VAPI Call IDs Extractor - Adaptive call ID collection
// For use with Node.js locally

// ========== SETTINGS (CHANGE THESE VALUES) ==========
const VAPI_API_KEY = "186d494d-210e-4dcc-94cc-0620e1da56e0"; // 🔑 Insert your API key
const START_DATE = "2025-08-01"; // 📅 Start date
const END_DATE = "2025-09-03";   // 📅 End date
const MAX_CALLS_PER_REQUEST = 100; // Limit of calls per request
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
    console.log(`📞 Request: ${startTime} - ${endTime}, received: ${data.length} calls`);
    return data;
    
  } catch (error) {
    console.error(`❌ API Error: ${error.message}`);
    throw error;
  }
}

// 🔄 Recursive function to collect calls with adaptive time splitting
async function getCallsRecursive(startTime, endTime, depth = 0) {
  const indent = "  ".repeat(depth);
  console.log(`${indent}🔍 Checking period: ${startTime} - ${endTime}`);
  
  try {
    const calls = await getVapiCalls(startTime, endTime, MAX_CALLS_PER_REQUEST);
    
    if (calls.length < MAX_CALLS_PER_REQUEST) {
      // ✅ Few calls - process them
      const callsWithTranscript = calls.filter(call => 
        call.transcript && 
        call.transcript.length > 10 && 
        call.cost > 0.02
      );
      
      console.log(`${indent}✅ Period processed: ${calls.length} calls, ${callsWithTranscript.length} with transcript`);
      
      return callsWithTranscript.map(call => ({
        id: call.id,
        phone: call.customer?.number || 'N/A',
        cost: call.cost,
        duration: call.startedAt && call.endedAt ? 
          Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) : 0,
        createdAt: call.createdAt,
        hasTranscript: true
      }));
      
    } else {
      // 🔄 Too many calls - split period in half
      console.log(`${indent}⚡ Too many calls (${calls.length}), splitting period`);
      
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();
      const middleMs = startMs + (endMs - startMs) / 2;
      const middleTime = new Date(middleMs).toISOString();
      
      // Recursively process both parts
      const part1 = await getCallsRecursive(startTime, middleTime, depth + 1);
      const part2 = await getCallsRecursive(middleTime, endTime, depth + 1);
      
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

// 📊 Main processing function
async function processAllDates() {
  console.log(`🚀 Starting call collection from ${START_DATE} to ${END_DATE}`);
  
  const allResults = [];
  let currentDate = START_DATE;
  let dayCount = 0;
  
  while (currentDate < END_DATE) {
    dayCount++;
    const nextDate = addDays(currentDate, 1);
    
    console.log(`\n📅 === DAY ${dayCount}: ${currentDate} ===`);
    
    const dayStart = `${currentDate}T00:00:00Z`;
    const dayEnd = `${nextDate}T00:00:00Z`;
    
    try {
      const dayResults = await getCallsRecursive(dayStart, dayEnd);
      
      // 📁 Save day results
      const dayData = {
        date: currentDate,
        totalCalls: dayResults.length,
        calls: dayResults
      };
      
      allResults.push(dayData);
      
      console.log(`📋 Day ${currentDate}: ${dayResults.length} quality calls saved`);
      
      // Small pause between days to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Error processing day ${currentDate}: ${error.message}`);
    }
    
    currentDate = nextDate;
  }
  
  // 📊 Final statistics
  const totalCalls = allResults.reduce((sum, day) => sum + day.totalCalls, 0);
  console.log(`\n🎉 === SUMMARY ===`);
  console.log(`📊 Days processed: ${dayCount}`);
  console.log(`📞 Total quality calls: ${totalCalls}`);
  
  // 💾 Save all results to JSON file
  const outputFile = path.join(__dirname, `vapi_calls_${START_DATE}_to_${END_DATE}.json`);
  await fs.writeFile(outputFile, JSON.stringify(allResults, null, 2));
  console.log(`💾 Results saved to: ${outputFile}`);
  
  // Also save just IDs for easy access
  const allIds = allResults.flatMap(day => day.calls.map(call => call.id));
  const idsFile = path.join(__dirname, `vapi_call_ids_only.json`);
  await fs.writeFile(idsFile, JSON.stringify(allIds, null, 2));
  console.log(`📝 IDs only saved to: ${idsFile}`);
  
  return allResults;
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