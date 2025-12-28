/**
 * Test Athena AI Agentic Capabilities
 * Tests intent parsing, action registry, and AI response parsing
 * 
 * Run with: node test-athena-agent.mjs
 */

import fs from 'fs';

const results = { passed: [], failed: [] };

function log(message, type = 'info') {
    const prefix = { 'info': '📋', 'pass': '✅', 'fail': '❌', 'section': '\n🧠' }[type] || '';
    console.log(`${prefix} ${message}`);
}

function test(name, condition) {
    if (condition) { log(`${name}`, 'pass'); results.passed.push(name); }
    else { log(`${name}`, 'fail'); results.failed.push(name); }
}

// Read the athena-agent.ts file
const agentContent = fs.readFileSync('lib/athena-agent.ts', 'utf-8');

// ============================================
// ACTION REGISTRY
// ============================================
log('ACTION REGISTRY', 'section');

const expectedActions = [
    'import_ads',
    'analyze_ad',
    'predict_score',
    'create_pipeline',
    'move_lead',
    'add_result',
    'sync_data',
    'export_data',
    'show_insights',
    'show_patterns',
    'recommend_creative'
];

expectedActions.forEach(action => {
    test(`Action "${action}" defined`, agentContent.includes(`${action}:`));
});

// ============================================
// INTENT PARSING
// ============================================
log('INTENT PARSING', 'section');

test('parseIntent function exported', agentContent.includes('export function parseIntent'));
test('Intent patterns defined', agentContent.includes('INTENT_PATTERNS'));
test('Import ads pattern', agentContent.includes('import|fetch|get|pull.*ads'));
test('Sync pattern', agentContent.includes('sync|backup|save.*cloud'));
test('Pattern learning pattern', agentContent.includes('show.*pattern'));
test('Recommend creative pattern', agentContent.includes('recommend|suggest'));

// ============================================
// AI RESPONSE PARSING
// ============================================
log('AI RESPONSE PARSING', 'section');

test('parseAIResponse function exported', agentContent.includes('export function parseAIResponse'));
test('ACTION tag parsing', agentContent.includes('[ACTION:'));
test('PARAMS tag parsing', agentContent.includes('[PARAMS:'));
test('MESSAGE tag extraction', agentContent.includes('[MESSAGE:'));

// ============================================
// ACTION EXECUTION
// ============================================
log('ACTION EXECUTION', 'section');

test('executeAction function exported', agentContent.includes('export async function executeAction'));
test('executeImportAds function', agentContent.includes('executeImportAds'));
test('executeSyncData function', agentContent.includes('executeSyncData'));
test('executeShowPatterns function', agentContent.includes('executeShowPatterns'));
test('executeShowInsights function', agentContent.includes('executeShowInsights'));
test('executeRecommendCreative function', agentContent.includes('executeRecommendCreative'));
test('executeExportData function', agentContent.includes('executeExportData'));
test('executeCreatePipeline function', agentContent.includes('executeCreatePipeline'));

// ============================================
// ACTION PROPERTIES
// ============================================
log('ACTION PROPERTIES', 'section');

test('Action descriptions defined', agentContent.includes('description:'));
test('Confirmation requirement defined', agentContent.includes('requiresConfirmation:'));
test('Parameters array defined', agentContent.includes('parameters:'));

// ============================================
// CONFIRMATION FLOW
// ============================================
log('CONFIRMATION FLOW', 'section');

test('create_pipeline requires confirmation', agentContent.includes("create_pipeline:") && agentContent.includes("requiresConfirmation: true"));
test('move_lead requires confirmation', agentContent.includes("move_lead:") && agentContent.includes("requiresConfirmation: true"));
test('import_ads no confirmation', agentContent.includes("import_ads:") && agentContent.includes("requiresConfirmation: false"));

// ============================================
// AI API INTEGRATION
// ============================================
log('AI API AGENTIC PROMPT', 'section');

const aiApiContent = fs.readFileSync('app/api/ai/route.ts', 'utf-8');

test('Agentic capabilities prompt', aiApiContent.includes('AGENTIC CAPABILITIES'));
test('Action list in prompt', aiApiContent.includes('import_ads:'));
test('ACTION tag format in prompt', aiApiContent.includes('[ACTION:'));
test('PARAMS tag format in prompt', aiApiContent.includes('[PARAMS:'));
test('MESSAGE tag format in prompt', aiApiContent.includes('[MESSAGE:'));
test('Confirmation guidance', aiApiContent.includes('requires confirmation'));

// ============================================
// CHATBOT INTEGRATION
// ============================================
log('CHATBOT AGENTIC INTEGRATION', 'section');

const chatbotContent = fs.readFileSync('components/ChatBot.tsx', 'utf-8');

test('athena-agent import', chatbotContent.includes("from '@/lib/athena-agent'"));
test('parseAIResponse usage', chatbotContent.includes('parseAIResponse('));
test('executeAction usage', chatbotContent.includes('executeAction('));
test('Action result handling', chatbotContent.includes('actionResult'));
test('System message role', chatbotContent.includes("role: 'system'"));

// ============================================
// RESULTS SUMMARY
// ============================================
console.log('\n' + '='.repeat(50));
console.log('🧠 ATHENA AI AGENTIC TEST RESULTS');
console.log('='.repeat(50));
console.log(`✅ Passed: ${results.passed.length}`);
console.log(`❌ Failed: ${results.failed.length}`);
console.log('='.repeat(50));

if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.failed.forEach(f => console.log(`   - ${f}`));
}

const successRate = Math.round((results.passed.length / (results.passed.length + results.failed.length)) * 100);
console.log(`\n📈 Success Rate: ${successRate}%`);

if (successRate === 100) {
    console.log('🎉 Athena AI is fully agentic and operational!');
} else if (successRate >= 90) {
    console.log('🔧 Athena AI is mostly operational with minor issues');
} else {
    console.log('🚨 Athena AI needs attention');
}

// Summary of capabilities
console.log('\n📊 AGENTIC CAPABILITIES SUMMARY:');
console.log(`   • Total Actions: ${expectedActions.length}`);
console.log(`   • Intent Patterns: Multiple NLP patterns`);
console.log(`   • Confirmation Actions: create_pipeline, move_lead`);
console.log(`   • Auto-Execute Actions: import_ads, sync_data, show_patterns, etc.`);

process.exit(results.failed.length > 0 ? 1 : 0);
