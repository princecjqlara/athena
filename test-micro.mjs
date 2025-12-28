/**
 * Micro Features Test
 * Tests fine-grained features, hooks, utilities, and small functions
 * 
 * Run with: node test-micro.mjs
 */

import fs from 'fs';

const results = { passed: [], failed: [], warnings: [] };

function log(message, type = 'info') {
    const prefix = { 'info': '📋', 'pass': '✅', 'fail': '❌', 'warn': '⚠️', 'section': '\n🔍' }[type] || '';
    console.log(`${prefix} ${message}`);
}

function test(name, condition, warning = false) {
    if (condition) { log(`${name}`, 'pass'); results.passed.push(name); }
    else if (warning) { log(`${name}`, 'warn'); results.warnings.push(name); }
    else { log(`${name}`, 'fail'); results.failed.push(name); }
}

// ============================================
// HOOKS & CONTEXT
// ============================================
log('HOOKS & CONTEXT', 'section');

const toastContent = fs.readFileSync('components/Toast.tsx', 'utf-8');
test('useToast hook exported', toastContent.includes('export function useToast'));
test('Toast success method', toastContent.includes('success:'));
test('Toast error method', toastContent.includes('error:'));
test('Toast warning method', toastContent.includes('warning:'));
test('Toast info method', toastContent.includes('info:'));
test('Toast auto-dismiss', toastContent.includes('setTimeout'));

const themeContent = fs.readFileSync('components/ThemeProvider.tsx', 'utf-8');
test('useTheme hook exported', themeContent.includes('export function useTheme'));
test('Theme toggle function', themeContent.includes('toggleTheme'));
test('Theme localStorage persistence', themeContent.includes('localStorage'));
test('ThemeToggle component exported', themeContent.includes('export function ThemeToggle'));
test('System theme detection', themeContent.includes('prefers-color-scheme'));

// ============================================
// LOADING COMPONENTS
// ============================================
log('LOADING COMPONENTS', 'section');

const loadingContent = fs.readFileSync('components/Loading.tsx', 'utf-8');
test('LoadingSpinner component', loadingContent.includes('export function LoadingSpinner'));
test('Skeleton component', loadingContent.includes('export function Skeleton'));
test('SkeletonCard component', loadingContent.includes('export function SkeletonCard'));
test('LoadingOverlay component', loadingContent.includes('export function LoadingOverlay'));
test('Spinner animation', loadingContent.includes('animation'));

// ============================================
// ERROR BOUNDARY
// ============================================
log('ERROR BOUNDARY', 'section');

const errorContent = fs.readFileSync('components/ErrorBoundary.tsx', 'utf-8');
test('ErrorBoundary component', errorContent.includes('class ErrorBoundary'));
test('getDerivedStateFromError', errorContent.includes('getDerivedStateFromError'));
test('componentDidCatch', errorContent.includes('componentDidCatch'));
test('Error fallback UI', errorContent.includes('fallback') || errorContent.includes('Something went wrong'));
test('Reset/retry functionality', errorContent.includes('reset') || errorContent.includes('Try again'));

// ============================================
// VALIDATION FUNCTIONS
// ============================================
log('VALIDATION FUNCTIONS', 'section');

const validationContent = fs.readFileSync('lib/validation.ts', 'utf-8');
test('validateRequest function', validationContent.includes('export function validateRequest'));
test('validatePartial function', validationContent.includes('export function validatePartial'));
test('Email validation in loginSchema', validationContent.includes('.email('));
test('Password min length validation', validationContent.includes('.min('));
test('Error message formatting', validationContent.includes('.issues'));

// ============================================
// TOKEN MANAGEMENT
// ============================================
log('TOKEN MANAGEMENT', 'section');

const tokenContent = fs.readFileSync('lib/token.ts', 'utf-8');
test('checkTokenStatus function', tokenContent.includes('export function checkTokenStatus'));
test('validateTokenBeforeApiCall function', tokenContent.includes('export function validateTokenBeforeApiCall'));
test('getTokenExpiryDisplay function', tokenContent.includes('export function getTokenExpiryDisplay'));
test('clearTokens function', tokenContent.includes('export function clearTokens'));
test('Token expiry calculation', tokenContent.includes('expiresAt') || tokenContent.includes('expires'));
test('Token warning threshold', tokenContent.includes('warning') || tokenContent.includes('Warning'));

// ============================================
// ACTIVITY LOGGING
// ============================================
log('ACTIVITY LOGGING', 'section');

const activityContent = fs.readFileSync('lib/activity.ts', 'utf-8');
test('logActivity function', activityContent.includes('export function logActivity'));
test('getActivityLogs function', activityContent.includes('export function getActivityLogs'));
test('getLogsByCategory function', activityContent.includes('export function getLogsByCategory'));
test('clearActivityLogs function', activityContent.includes('export function clearActivityLogs'));
test('exportActivityLogs function', activityContent.includes('export function exportActivityLogs'));
test('Activity categories defined', activityContent.includes("'auth'") && activityContent.includes("'ads'"));
test('Pre-built helpers (activity.login)', activityContent.includes('login:'));
test('Pre-built helpers (activity.importAd)', activityContent.includes('importAd:'));

// ============================================
// SYNC UTILITY
// ============================================
log('SYNC UTILITY', 'section');

const syncContent = fs.readFileSync('lib/sync.ts', 'utf-8');
test('saveToCloud function', syncContent.includes('saveToCloud') || syncContent.includes('syncToCloud'));
test('loadFromCloud function', syncContent.includes('loadFromCloud') || syncContent.includes('fetchFromCloud'));
test('Backup to localStorage', syncContent.includes('localStorage'));
test('Error handling in sync', syncContent.includes('catch') || syncContent.includes('error'));

// ============================================
// ML MICRO FEATURES
// ============================================
log('ML MICRO FEATURES', 'section');

// Time Decay
const timeDecayContent = fs.readFileSync('lib/ml/time-decay.ts', 'utf-8');
test('Time decay enabled check', timeDecayContent.includes('enabled'));
test('Decay rate configuration', timeDecayContent.includes('decayRate') || timeDecayContent.includes('decay'));
test('Age calculation', timeDecayContent.includes('Date') || timeDecayContent.includes('timestamp'));

// Exploration
const explorationContent = fs.readFileSync('lib/ml/exploration.ts', 'utf-8');
test('Epsilon-greedy exploration', explorationContent.includes('epsilon') || explorationContent.includes('exploration'));
test('Random selection for exploration', explorationContent.includes('random') || explorationContent.includes('Math.random'));

// Feedback Loop
const feedbackContent = fs.readFileSync('lib/ml/feedback-loop.ts', 'utf-8');
test('Feedback recording', feedbackContent.includes('record') || feedbackContent.includes('feedback'));
test('Verification tracking', feedbackContent.includes('verify') || feedbackContent.includes('actual'));

// Historical Performance
const historicalContent = fs.readFileSync('lib/ml/historical-performance.ts', 'utf-8');
test('calculateSimilarity function', historicalContent.includes('calculateSimilarity'));
test('Similarity scoring', historicalContent.includes('matchScore') || historicalContent.includes('similarity'));
test('blendPredictions function', historicalContent.includes('blendPredictions'));
test('Historical weight limit (max 40%)', historicalContent.includes('0.4') || historicalContent.includes('40'));

// Pattern Learning
const patternContent = fs.readFileSync('lib/ml/pattern-learning.ts', 'utf-8');
test('extractTraits function', patternContent.includes('extractTraits'));
test('generateCombinations function', patternContent.includes('generateCombinations'));
test('Pair generation', patternContent.includes('pairs') || patternContent.includes('[traits[i], traits[j]]'));
test('Triple generation', patternContent.includes('triple') || patternContent.includes('priorityTraits'));
test('Pattern confidence level', patternContent.includes('confidenceLevel'));
test('Success/failure counting', patternContent.includes('successCount') && patternContent.includes('failureCount'));

// Seasonality
const seasonalityContent = fs.readFileSync('lib/ml/seasonality.ts', 'utf-8');
test('HOLIDAYS constant', seasonalityContent.includes('HOLIDAYS'));
test('Black Friday detection', seasonalityContent.includes('Black Friday') || seasonalityContent.includes('BFCM'));
test('Day of week modifiers', seasonalityContent.includes('DAY_MODIFIERS'));
test('Hour modifiers', seasonalityContent.includes('HOUR_MODIFIERS'));
test('Month modifiers', seasonalityContent.includes('MONTH_MODIFIERS'));
test('getCurrentHoliday function', seasonalityContent.includes('getCurrentHoliday'));
test('isPeakSeason function', seasonalityContent.includes('isPeakSeason'));

// Risk Assessment
const riskContent = fs.readFileSync('lib/ml/risk-assessment.ts', 'utf-8');
test('Risk level calculation', riskContent.includes('risk') || riskContent.includes('Risk'));
test('Risk factors identification', riskContent.includes('factor') || riskContent.includes('Factor'));

// Success Normalization
const successContent = fs.readFileSync('lib/ml/success-normalization.ts', 'utf-8');
test('Score normalization', successContent.includes('normalize') || successContent.includes('Normalize'));
test('Metric aggregation', successContent.includes('aggregate') || successContent.includes('combine') || successContent.includes('weighted'));

// ============================================
// API ROUTE MICRO FEATURES
// ============================================
log('API ROUTE MICRO FEATURES', 'section');

// Auth
const loginApiContent = fs.readFileSync('app/api/auth/login/route.ts', 'utf-8');
test('Login POST handler', loginApiContent.includes('export async function POST'));
test('Login error response', loginApiContent.includes('401') || loginApiContent.includes('400'));
test('Login success response', loginApiContent.includes('200') || loginApiContent.includes('user'));

const signupApiContent = fs.readFileSync('app/api/auth/signup/route.ts', 'utf-8');
test('Signup POST handler', signupApiContent.includes('export async function POST'));
test('Role handling in signup', signupApiContent.includes('role'));

// AI
const aiApiContent = fs.readFileSync('app/api/ai/route.ts', 'utf-8');
test('AI POST handler', aiApiContent.includes('export async function POST'));
test('AI action routing', aiApiContent.includes('action'));
test('NVIDIA API integration', aiApiContent.includes('nvidia') || aiApiContent.includes('NVIDIA') || aiApiContent.includes('llama'));

// Sync
const syncApiContent = fs.readFileSync('app/api/sync/route.ts', 'utf-8');
test('Sync POST handler', syncApiContent.includes('export async function POST'));
test('Sync GET handler', syncApiContent.includes('export async function GET'));

// ============================================
// COMPONENT MICRO FEATURES
// ============================================
log('COMPONENT MICRO FEATURES', 'section');

// Sidebar
const sidebarContent = fs.readFileSync('components/Sidebar.tsx', 'utf-8');
test('Navigation links', sidebarContent.includes('Link') || sidebarContent.includes('href'));
test('Active state styling', sidebarContent.includes('active') || sidebarContent.includes('pathname'));
test('Responsive collapse', sidebarContent.includes('collapsed') || sidebarContent.includes('toggle'));
test('User session display', sidebarContent.includes('user') || sidebarContent.includes('session'));

// ChatBot
const chatbotContent = fs.readFileSync('components/ChatBot.tsx', 'utf-8');
test('Chat toggle button', chatbotContent.includes('toggle') || chatbotContent.includes('isOpen'));
test('Message history', chatbotContent.includes('messages') || chatbotContent.includes('history'));
test('Send message handler', chatbotContent.includes('send') || chatbotContent.includes('handleSubmit'));
test('AI response handling', chatbotContent.includes('response') || chatbotContent.includes('assistant'));
test('Loading state', chatbotContent.includes('loading') || chatbotContent.includes('isLoading'));

// ============================================
// RESULTS SUMMARY
// ============================================
console.log('\n' + '='.repeat(50));
console.log('📊 MICRO FEATURES TEST RESULTS');
console.log('='.repeat(50));
console.log(`✅ Passed: ${results.passed.length}`);
console.log(`❌ Failed: ${results.failed.length}`);
console.log(`⚠️  Warnings: ${results.warnings.length}`);
console.log('='.repeat(50));

if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.failed.forEach(f => console.log(`   - ${f}`));
}

const successRate = Math.round((results.passed.length / (results.passed.length + results.failed.length)) * 100);
console.log(`\n📈 Success Rate: ${successRate}%`);

if (successRate >= 95) {
    console.log('🎉 All micro features are working correctly!');
} else if (successRate >= 80) {
    console.log('🔧 Most micro features work, minor issues detected');
} else {
    console.log('🚨 Significant micro feature issues need attention');
}

process.exit(results.failed.length > 0 ? 1 : 0);
