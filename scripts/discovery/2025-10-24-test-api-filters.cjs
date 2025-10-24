const BASE_URL = 'http://localhost:3009';

async function testAPI() {
  console.log('\n=== TESTING API WITH FILTERS ===\n');

  const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const dateTo = new Date().toISOString();

  // Test 1: Metrics without filter
  console.log('1. Metrics for 30 days (all assistants):');
  const metrics1 = await fetch(`${BASE_URL}/api/dashboard/metrics?date_from=${dateFrom}&date_to=${dateTo}`);
  const m1 = await metrics1.json();
  console.log(`   Total Calls: ${m1.totalCalls}`);
  console.log(`   Quality Calls: ${m1.qualityCalls}`);
  console.log(`   With Tools: ${m1.withTools}`);
  console.log(`   Avg QCI: ${m1.avgQCI}`);

  // Test 2: Chart for 30 days
  console.log('\n2. Chart for 30 days (all assistants):');
  const chart1 = await fetch(`${BASE_URL}/api/dashboard/chart?date_from=${dateFrom}&date_to=${dateTo}&granularity=day`);
  const c1 = await chart1.json();
  console.log(`   Data Points: ${c1.length}`);
  if (c1.length > 0) {
    console.log(`   First point: ${c1[0].date} - ${c1[0].total_calls} calls`);
    console.log(`   Last point: ${c1[c1.length - 1].date} - ${c1[c1.length - 1].total_calls} calls`);
    const totalFromChart = c1.reduce((sum, p) => sum + p.total_calls, 0);
    console.log(`   Total from chart: ${totalFromChart}`);
    console.log(`   Expected from metrics: ${m1.totalCalls}`);
    if (totalFromChart !== m1.totalCalls) {
      console.log(`   ⚠️  MISMATCH! Chart total (${totalFromChart}) != Metrics total (${m1.totalCalls})`);
    }
  }

  // Test 3: Get assistants list
  console.log('\n3. Getting assistants list:');
  const assistantsResp = await fetch(`${BASE_URL}/api/dashboard/assistants?date_from=${dateFrom}&date_to=${dateTo}`);
  const assistants = await assistantsResp.json();
  console.log(`   Found assistants: ${assistants.length}`);
  assistants.forEach(asst => {
    console.log(`   - ${asst.name}: ${asst.total} calls (${asst.quality} quality)`);
  });

  // Test 4: Different time periods for chart
  console.log('\n4. Chart for different periods:');

  const date7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const chart7d = await fetch(`${BASE_URL}/api/dashboard/chart?date_from=${date7d}&date_to=${dateTo}&granularity=day`);
  const c7d = await chart7d.json();
  console.log(`   7 days: ${c7d.length} points (expected: 8)`);

  const date90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const chart90d = await fetch(`${BASE_URL}/api/dashboard/chart?date_from=${date90d}&date_to=${dateTo}&granularity=day`);
  const c90d = await chart90d.json();
  console.log(`   90 days: ${c90d.length} points (expected: 91)`);

  const dateAll = '2019-12-31T16:00:00.000Z';
  const chartAll = await fetch(`${BASE_URL}/api/dashboard/chart?date_from=${dateAll}&date_to=${dateTo}&granularity=day`);
  const cAll = await chartAll.json();
  console.log(`   All time: ${cAll.length} points (should be < 200)`);

  // Test 5: Проверка суммы звонков за весь период
  console.log('\n5. Total calls verification:');
  const metricsAll = await fetch(`${BASE_URL}/api/dashboard/metrics?date_from=${dateAll}&date_to=${dateTo}`);
  const mAll = await metricsAll.json();
  console.log(`   Metrics says: ${mAll.totalCalls} total calls`);

  const totalFromChartAll = cAll.reduce((sum, p) => sum + p.total_calls, 0);
  console.log(`   Chart says: ${totalFromChartAll} total calls`);

  if (totalFromChartAll !== mAll.totalCalls) {
    console.log(`   ⚠️  MISMATCH for All period!`);
  }

  console.log('\n=== TESTS COMPLETED ===\n');
}

testAPI().catch(console.error);
