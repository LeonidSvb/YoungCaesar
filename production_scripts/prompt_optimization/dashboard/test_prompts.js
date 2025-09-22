#!/usr/bin/env node
/**
 * INTEGRATION TEST - Verify Real Prompts in Dashboard
 * Tests that dashboard contains actual VAPI prompts, not mock data
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 TESTING: Real prompts in dashboard vs mock data\n');

// Read the dashboard file
const dashboardPath = path.join(__dirname, 'index-vercel.html');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

// Test patterns that should be in REAL prompts
const realPromptPatterns = [
    /You are \{\{bdr\}\}, a helpful voice assistant from Young Caesar/,
    /Your job is to quickly introduce yourself/,
    /SPEECH STYLE:/,
    /Keep answers short and natural/,
    /Don't call any external tools/
];

// Test patterns that should NOT be in real prompts (mock indicators)
const mockPatterns = [
    /You are Alex1, a professional sales assistant/,
    /You are BIESSE-MS assistant, specialized/,
    /You are QC Advisor, focused on quality/,
    /Mock data/i,
    /Placeholder/i,
    /Test prompt/i
];

let testsPassed = 0;
let testsFailed = 0;

console.log('📋 Testing for REAL prompt patterns...');
realPromptPatterns.forEach((pattern, i) => {
    if (pattern.test(dashboardContent)) {
        console.log(`✅ Test ${i+1}: Found real prompt pattern: ${pattern.source.substring(0, 50)}...`);
        testsPassed++;
    } else {
        console.log(`❌ Test ${i+1}: Missing real prompt pattern: ${pattern.source.substring(0, 50)}...`);
        testsFailed++;
    }
});

console.log('\n🚫 Testing for MOCK data patterns (should NOT exist)...');
mockPatterns.forEach((pattern, i) => {
    if (!pattern.test(dashboardContent)) {
        console.log(`✅ Test ${i+6}: No mock pattern found: ${pattern.source.substring(0, 50)}...`);
        testsPassed++;
    } else {
        console.log(`❌ Test ${i+6}: Found unwanted mock pattern: ${pattern.source.substring(0, 50)}...`);
        testsFailed++;
    }
});

// Test specific real prompt content
console.log('\n🔍 Testing specific real prompt content...');
const specificTests = [
    {
        name: 'Young Caesar branding',
        pattern: /Young Caesar/g,
        shouldExist: true
    },
    {
        name: 'Template variables {{bdr}}',
        pattern: /\{\{bdr\}\}/g,
        shouldExist: true
    },
    {
        name: 'Template variables {{keyword}}',
        pattern: /\{\{keyword\}\}/g,
        shouldExist: true
    },
    {
        name: 'Real optimization changes',
        pattern: /securing 5 new.*clients within the next month/,
        shouldExist: true
    },
    {
        name: 'Real success metrics',
        pattern: /increase their client base by 30% in just two months/,
        shouldExist: true
    }
];

specificTests.forEach((test, i) => {
    const matches = dashboardContent.match(test.pattern);
    const hasMatches = matches && matches.length > 0;

    if (hasMatches === test.shouldExist) {
        console.log(`✅ Test ${i+11}: ${test.name} - ${hasMatches ? `Found ${matches.length} matches` : 'Correctly absent'}`);
        testsPassed++;
    } else {
        console.log(`❌ Test ${i+11}: ${test.name} - ${test.shouldExist ? 'Expected but not found' : 'Found but should not exist'}`);
        testsFailed++;
    }
});

// Final results
console.log('\n' + '='.repeat(50));
console.log(`📊 TEST RESULTS:`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);

if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Dashboard contains real VAPI prompts.');
    console.log('✨ No mock data detected. Ready for production deployment.');
} else {
    console.log('\n⚠️  SOME TESTS FAILED! Dashboard may contain mock data.');
    console.log('🔧 Review and fix the failing tests before deployment.');
}

console.log('\n🚀 Next: Test in browser at http://localhost:8082/index-vercel.html');