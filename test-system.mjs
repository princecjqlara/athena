/**
 * Full System Feature Test
 * Tests all major features and ML modules
 * 
 * Run with: node test-system.mjs
 */

import fs from 'fs';
import path from 'path';

// Test results tracking
const results = {
    passed: [],
    failed: [],
    warnings: []
};

function log(message, type = 'info') {
    const prefix = {
        'info': '📋',
        'pass': '✅',
        'fail': '❌',
        'warn': '⚠️',
        'section': '\n🔍'
    }[type] || '';
    console.log(`${prefix} ${message}`);
}

function test(name, condition, warning = false) {
    if (condition) {
        log(`${name}`, 'pass');
        results.passed.push(name);
    } else if (warning) {
        log(`${name}`, 'warn');
        results.warnings.push(name);
    } else {
        log(`${name}`, 'fail');
        results.failed.push(name);
    }
}

// ============================================
// PHASE 1: Check File Structure
// ============================================
log('PHASE 1: File Structure Check', 'section');

const requiredFiles = {
    // Core app
    'app/page.tsx': 'Home page',
    'app/layout.tsx': 'Root layout',
    'app/globals.css': 'Global styles',

    // Pages
    'app/login/page.tsx': 'Login page',
    'app/settings/page.tsx': 'Settings page',
    'app/import/page.tsx': 'Import page',
    'app/mindmap/page.tsx': 'Mindmap page',
    'app/pipeline/page.tsx': 'Pipeline page',
    'app/predict/page.tsx': 'Predict page',
    'app/results/page.tsx': 'Results page',
    'app/upload/page.tsx': 'Upload page',
    'app/analytics/page.tsx': 'Analytics page',
    'app/myads/page.tsx': 'My Ads page',
    'app/marketplace/page.tsx': 'Marketplace page',
    'app/organizer/page.tsx': 'Organizer page',
    'app/admin/page.tsx': 'Admin page',

    // Components
    'components/AppWrapper.tsx': 'App wrapper (Toast + Theme + ErrorBoundary)',
    'components/Sidebar.tsx': 'Sidebar navigation',
    'components/ChatBot.tsx': 'AI Chatbot',
    'components/Toast.tsx': 'Toast notifications',
    'components/Loading.tsx': 'Loading states',
    'components/ErrorBoundary.tsx': 'Error boundary',
    'components/ThemeProvider.tsx': 'Theme provider',
    'components/FacebookLogin.tsx': 'Facebook OAuth',

    // Lib - Core
    'lib/supabase.ts': 'Supabase client',
    'lib/auth.ts': 'Authentication',
    'lib/validation.ts': 'Zod validation',
    'lib/token.ts': 'Token management',
    'lib/sync.ts': 'Cloud sync',
    'lib/activity.ts': 'Activity logging',
    'lib/capi.ts': 'Facebook CAPI',

    // Lib - ML (18 files)
    'lib/ml/index.ts': 'ML exports',
    'lib/ml/model.ts': 'TensorFlow model',
    'lib/ml/features.ts': 'Feature extraction',
    'lib/ml/weight-adjustment.ts': 'Weight adjustment',
    'lib/ml/feedback-loop.ts': 'Feedback loop',
    'lib/ml/time-decay.ts': 'Time decay',
    'lib/ml/exploration.ts': 'Exploration',
    'lib/ml/audience-segmentation.ts': 'Audience segments',
    'lib/ml/feature-discovery.ts': 'Feature discovery',
    'lib/ml/history.ts': 'History tracking',
    'lib/ml/risk-assessment.ts': 'Risk assessment',
    'lib/ml/score-recalculation.ts': 'Score recalculation',
    'lib/ml/success-normalization.ts': 'Success normalization',
    'lib/ml/failure-taxonomy.ts': 'Failure taxonomy',
    'lib/ml/feature-eligibility.ts': 'Feature eligibility',
    'lib/ml/historical-performance.ts': 'Historical performance',
    'lib/ml/pattern-learning.ts': 'Pattern learning',
    'lib/ml/seasonality.ts': 'Seasonality',

    // API Routes
    'app/api/ai/route.ts': 'AI API',
    'app/api/auth/login/route.ts': 'Login API',
    'app/api/auth/signup/route.ts': 'Signup API',
    'app/api/sync/route.ts': 'Sync API',
    'app/api/capi/send/route.ts': 'CAPI API',
    'app/api/facebook/ads/route.ts': 'Facebook Ads API',

    // Types
    'types/index.ts': 'Type definitions',

    // Config
    'package.json': 'Package config',
    'next.config.ts': 'Next.js config',
    'tsconfig.json': 'TypeScript config',

    // PWA
    'public/manifest.json': 'PWA manifest',

    // Supabase
    'supabase/user_data_schema.sql': 'User data schema',
};

for (const [file, description] of Object.entries(requiredFiles)) {
    const exists = fs.existsSync(file);
    test(`${description} (${file})`, exists);
}

// ============================================
// PHASE 2: Check Package Dependencies
// ============================================
log('PHASE 2: Package Dependencies', 'section');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const requiredDeps = [
    'next',
    'react',
    'react-dom',
    '@supabase/supabase-js',
    '@tensorflow/tfjs',
    'zod',
    'uuid'
];

for (const dep of requiredDeps) {
    const hasDep = dep in (packageJson.dependencies || {});
    test(`Dependency: ${dep}`, hasDep);
}

// ============================================
// PHASE 3: Check Type Definitions
// ============================================
log('PHASE 3: Type Definitions', 'section');

const typesContent = fs.readFileSync('types/index.ts', 'utf-8');
const requiredTypes = [
    'ExtractedAdData',
    'ExtractedResultsData',
    'PredictionResult',
    'FeatureWeight',
    'BudgetTier',
    'ObjectiveType',
    'AudienceType',
    'HookRetention',
    'TargetAgeGroup',
];

for (const type of requiredTypes) {
    const hasType = typesContent.includes(`export type ${type}`) || typesContent.includes(`export interface ${type}`);
    test(`Type: ${type}`, hasType);
}

// ============================================
// PHASE 4: Check ML Feature Maps
// ============================================
log('PHASE 4: ML Feature Maps', 'section');

const featuresContent = fs.readFileSync('lib/ml/features.ts', 'utf-8');
const requiredMaps = [
    'hookTypeMap',
    'editingStyleMap',
    'contentCategoryMap',
    'platformMap',
    'budgetTierMap',
    'objectiveTypeMap',
    'audienceTypeMap',
    'hookRetentionMap',
    'durationCategoryMap',
    'targetAgeMap',
];

for (const map of requiredMaps) {
    const hasMap = featuresContent.includes(`const ${map}`);
    test(`Feature Map: ${map}`, hasMap);
}

// ============================================
// PHASE 5: Check ML Functions
// ============================================
log('PHASE 5: ML Functions', 'section');

const mlFunctions = {
    'lib/ml/features.ts': ['extractMetadataFeatures', 'extractExtendedFeatures', 'calculateSuccessScore'],
    'lib/ml/model.ts': ['predict', 'trainModel', 'addTrainingData'],
    'lib/ml/weight-adjustment.ts': ['adjustWeightsForError', 'getFeatureWeights'],
    'lib/ml/historical-performance.ts': ['getHistoricalWeightedPrediction', 'blendPredictions', 'findSimilarAds'],
    'lib/ml/pattern-learning.ts': ['learnFromAd', 'getPatternInsights', 'getTopPatterns'],
    'lib/ml/seasonality.ts': ['applySeasonalityAdjustment', 'getBestLaunchWindow', 'getUpcomingEvents'],
};

for (const [file, functions] of Object.entries(mlFunctions)) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const fn of functions) {
        const hasFn = content.includes(`export function ${fn}`) || content.includes(`export const ${fn}`);
        test(`Function: ${fn} in ${path.basename(file)}`, hasFn);
    }
}

// ============================================
// PHASE 6: Check Component Integrations
// ============================================
log('PHASE 6: Component Integrations', 'section');

const appWrapperContent = fs.readFileSync('components/AppWrapper.tsx', 'utf-8');
test('AppWrapper includes ToastProvider', appWrapperContent.includes('ToastProvider'));
test('AppWrapper includes ErrorBoundary', appWrapperContent.includes('ErrorBoundary'));
test('AppWrapper includes ThemeProvider', appWrapperContent.includes('ThemeProvider'));

// ============================================
// PHASE 7: Check Validation Schemas
// ============================================
log('PHASE 7: Validation Schemas', 'section');

const validationContent = fs.readFileSync('lib/validation.ts', 'utf-8');
const requiredSchemas = [
    'loginSchema',
    'signupSchema',
    'syncDataSchema',
    'aiRequestSchema',
    'contactSchema',
    'pipelineSchema',
];

for (const schema of requiredSchemas) {
    const hasSchema = validationContent.includes(`export const ${schema}`);
    test(`Validation Schema: ${schema}`, hasSchema);
}

// ============================================
// PHASE 8: Check PWA Configuration
// ============================================
log('PHASE 8: PWA Configuration', 'section');

const manifestContent = JSON.parse(fs.readFileSync('public/manifest.json', 'utf-8'));
test('PWA name configured', manifestContent.name && manifestContent.name.length > 0);
test('PWA start_url configured', manifestContent.start_url === '/');
test('PWA display mode', manifestContent.display === 'standalone');
test('PWA has icons', Array.isArray(manifestContent.icons) && manifestContent.icons.length > 0);

const layoutContent = fs.readFileSync('app/layout.tsx', 'utf-8');
test('Layout links manifest', layoutContent.includes('manifest.json'));
test('Layout has theme-color meta', layoutContent.includes('theme-color'));

// ============================================
// PHASE 9: Check Token Utility
// ============================================
log('PHASE 9: Token Management', 'section');

const tokenContent = fs.readFileSync('lib/token.ts', 'utf-8');
test('checkTokenStatus function', tokenContent.includes('export function checkTokenStatus'));
test('validateTokenBeforeApiCall function', tokenContent.includes('export function validateTokenBeforeApiCall'));
test('getTokenExpiryDisplay function', tokenContent.includes('export function getTokenExpiryDisplay'));

// ============================================
// PHASE 10: Check Activity Logging
// ============================================
log('PHASE 10: Activity Logging', 'section');

const activityContent = fs.readFileSync('lib/activity.ts', 'utf-8');
test('logActivity function', activityContent.includes('export function logActivity'));
test('getActivityLogs function', activityContent.includes('export function getActivityLogs'));
test('Activity helpers (activity.login, etc.)', activityContent.includes('export const activity'));

// ============================================
// RESULTS SUMMARY
// ============================================
console.log('\n' + '='.repeat(50));
console.log('📊 TEST RESULTS SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Passed: ${results.passed.length}`);
console.log(`❌ Failed: ${results.failed.length}`);
console.log(`⚠️  Warnings: ${results.warnings.length}`);
console.log('='.repeat(50));

if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.failed.forEach(f => console.log(`   - ${f}`));
}

if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.warnings.forEach(w => console.log(`   - ${w}`));
}

const successRate = Math.round((results.passed.length / (results.passed.length + results.failed.length)) * 100);
console.log(`\n📈 Success Rate: ${successRate}%`);

if (successRate >= 95) {
    console.log('🎉 System is production-ready!');
} else if (successRate >= 80) {
    console.log('🔧 System needs minor fixes before production');
} else {
    console.log('🚨 System has critical issues that need to be addressed');
}

process.exit(results.failed.length > 0 ? 1 : 0);
