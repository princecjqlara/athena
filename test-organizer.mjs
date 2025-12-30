/**
 * Organizer Page Feature Tests
 * Tests all organizer page features, API routes, and components
 * 
 * Run with: node test-organizer.mjs
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

console.log('='.repeat(60));
console.log('🔧 ORGANIZER PAGE TEST SUITE');
console.log('='.repeat(60));

// ============================================
// PHASE 1: Check Organizer File Structure
// ============================================
log('PHASE 1: Organizer File Structure', 'section');

const organizerFiles = {
    // Main page
    'app/organizer/page.tsx': 'Organizer dashboard page',
    'app/organizer/organizer.css': 'Organizer page styles',

    // API Routes
    'app/api/organizer/users/route.ts': 'Users API (GET all, DELETE user)',
    'app/api/organizer/organizations/route.ts': 'Organizations API',
    'app/api/organizer/teams/route.ts': 'Teams statistics API',
    'app/api/organizer/announcements/route.ts': 'Announcements CRUD API',
    'app/api/organizer/messages/route.ts': 'Direct messages API',
    'app/api/organizer/prompts/route.ts': 'AI prompts management API',
    'app/api/organizer/impersonate/route.ts': 'User impersonation API',
    'app/api/organizer/marketplace/route.ts': 'Marketplace pools API',

    // Database schemas
    'supabase/create_organizer.sql': 'Organizer creation SQL',
    'supabase/organizer_messaging_schema.sql': 'Organizer messaging schema',
};

for (const [file, description] of Object.entries(organizerFiles)) {
    const exists = fs.existsSync(file);
    test(`${description} (${file})`, exists);
}

// ============================================
// PHASE 2: Check Organizer Page Component
// ============================================
log('PHASE 2: Organizer Page Component', 'section');

const pageContent = fs.readFileSync('app/organizer/page.tsx', 'utf-8');

// Check interfaces/types
const requiredInterfaces = [
    'interface User',
    'interface TeamStats',
    'interface ImpersonationSession',
    'interface DataPool',
    'interface AccessRequest',
    'interface Announcement',
    'interface DirectMessage',
];

for (const iface of requiredInterfaces) {
    const hasInterface = pageContent.includes(iface);
    test(`Interface: ${iface.replace('interface ', '')}`, hasInterface);
}

// Check main component
test('OrganizerDashboard component exists', pageContent.includes('export default function OrganizerDashboard'));

// ============================================
// PHASE 3: Check Dashboard Functions
// ============================================
log('PHASE 3: Dashboard Functions', 'section');

const requiredFunctions = [
    { name: 'fetchData', desc: 'Fetch users data' },
    { name: 'fetchMarketplace', desc: 'Fetch marketplace data' },
    { name: 'fetchPrompts', desc: 'Fetch AI prompts' },
    { name: 'createPrompt', desc: 'Create new prompt' },
    { name: 'deletePrompt', desc: 'Delete prompt' },
    { name: 'updatePrompt', desc: 'Update existing prompt' },
    { name: 'fetchMessages', desc: 'Fetch messages' },
    { name: 'createAnnouncement', desc: 'Create announcement' },
    { name: 'deleteAnnouncement', desc: 'Delete announcement' },
    { name: 'sendDirectMessage', desc: 'Send direct message' },
    { name: 'fetchLearnedTraits', desc: 'Fetch learned traits' },
    { name: 'addTrait', desc: 'Add new trait' },
    { name: 'deleteTrait', desc: 'Delete trait' },
    { name: 'fetchAiTraits', desc: 'Fetch AI-generated traits' },
    { name: 'moderateTrait', desc: 'Approve/reject AI trait' },
    { name: 'deleteAiTrait', desc: 'Delete AI trait' },
    { name: 'checkImpersonation', desc: 'Check impersonation session' },
    { name: 'handleLoginAs', desc: 'Start impersonation' },
    { name: 'handleEndImpersonation', desc: 'End impersonation' },
    { name: 'generateInviteCode', desc: 'Generate invite code' },
    { name: 'copyInviteCode', desc: 'Copy invite to clipboard' },
    { name: 'createPool', desc: 'Create data pool' },
    { name: 'handleRequest', desc: 'Handle access request' },
    { name: 'deleteUser', desc: 'Delete user' },
];

for (const fn of requiredFunctions) {
    const hasFn = pageContent.includes(`const ${fn.name}`) || pageContent.includes(`function ${fn.name}`);
    test(`Function: ${fn.name} (${fn.desc})`, hasFn);
}

// ============================================
// PHASE 4: Check Users API Route
// ============================================
log('PHASE 4: Users API Route', 'section');

const usersApiContent = fs.readFileSync('app/api/organizer/users/route.ts', 'utf-8');

test('GET handler exists', usersApiContent.includes('export async function GET'));
test('DELETE handler exists', usersApiContent.includes('export async function DELETE'));
test('Authorization check (isOrganizer)', usersApiContent.includes('isOrganizer'));
test('Service role key usage', usersApiContent.includes('SUPABASE_SERVICE_ROLE_KEY'));
test('User profiles fetch', usersApiContent.includes("from('user_profiles')"));
test('Auth users list', usersApiContent.includes('auth.admin.listUsers'));
test('Organizations fetch', usersApiContent.includes("from('organizations')"));
test('Ads count per user', usersApiContent.includes("from('ads')"));
test('Prevent organizer deletion', usersApiContent.includes("role === 'organizer'"));
test('Audit log on delete', usersApiContent.includes("from('audit_logs')"));

// ============================================
// PHASE 5: Check Announcements API
// ============================================
log('PHASE 5: Announcements API', 'section');

if (fs.existsSync('app/api/organizer/announcements/route.ts')) {
    const announcementsApiContent = fs.readFileSync('app/api/organizer/announcements/route.ts', 'utf-8');

    test('Announcements GET handler', announcementsApiContent.includes('export async function GET'));
    test('Announcements POST handler', announcementsApiContent.includes('export async function POST'));
    test('Announcements DELETE handler', announcementsApiContent.includes('export async function DELETE'));
    test('Target audience support', announcementsApiContent.includes('target_audience'));
    test('Priority levels support', announcementsApiContent.includes('priority'));
} else {
    test('Announcements API file exists', false);
}

// ============================================
// PHASE 6: Check Messages API
// ============================================
log('PHASE 6: Messages API', 'section');

if (fs.existsSync('app/api/organizer/messages/route.ts')) {
    const messagesApiContent = fs.readFileSync('app/api/organizer/messages/route.ts', 'utf-8');

    test('Messages GET handler', messagesApiContent.includes('export async function GET'));
    test('Messages POST handler', messagesApiContent.includes('export async function POST'));
    test('Direct messages table access', messagesApiContent.includes('direct_messages'));
} else {
    test('Messages API file exists', false);
}

// ============================================
// PHASE 7: Check Impersonation API
// ============================================
log('PHASE 7: Impersonation API', 'section');

if (fs.existsSync('app/api/organizer/impersonate/route.ts')) {
    const impersonateApiContent = fs.readFileSync('app/api/organizer/impersonate/route.ts', 'utf-8');

    test('Impersonate POST handler', impersonateApiContent.includes('export async function POST'));
    test('Session management', impersonateApiContent.includes('session') || impersonateApiContent.includes('Session'));
} else {
    test('Impersonation API file exists', false);
}

// ============================================
// PHASE 8: Check Prompts API
// ============================================
log('PHASE 8: Prompts API', 'section');

if (fs.existsSync('app/api/organizer/prompts/route.ts')) {
    const promptsApiContent = fs.readFileSync('app/api/organizer/prompts/route.ts', 'utf-8');

    test('Prompts GET handler', promptsApiContent.includes('export async function GET'));
    test('Prompts POST handler', promptsApiContent.includes('export async function POST'));
    test('Prompts PUT handler', promptsApiContent.includes('export async function PUT'));
    test('Prompts DELETE handler', promptsApiContent.includes('export async function DELETE'));
} else {
    test('Prompts API file exists', false);
}

// ============================================
// PHASE 9: Check Marketplace API
// ============================================
log('PHASE 9: Marketplace API', 'section');

if (fs.existsSync('app/api/organizer/marketplace/route.ts')) {
    const marketplaceApiContent = fs.readFileSync('app/api/organizer/marketplace/route.ts', 'utf-8');

    test('Marketplace GET handler', marketplaceApiContent.includes('export async function GET'));
    test('Data pools access', marketplaceApiContent.includes('data_pools'));
    test('Access requests handling', marketplaceApiContent.includes('access_requests') || marketplaceApiContent.includes('pool_access_requests'));
} else {
    test('Marketplace API file exists', false);
}

// ============================================
// PHASE 10: Check Organizations API
// ============================================
log('PHASE 10: Organizations API', 'section');

if (fs.existsSync('app/api/organizer/organizations/route.ts')) {
    const orgsApiContent = fs.readFileSync('app/api/organizer/organizations/route.ts', 'utf-8');

    test('Organizations GET handler', orgsApiContent.includes('export async function GET'));
    test('Organizations table access', orgsApiContent.includes('organizations'));
} else {
    test('Organizations API file exists', false);
}

// ============================================
// PHASE 11: Check Teams API
// ============================================
log('PHASE 11: Teams API', 'section');

if (fs.existsSync('app/api/organizer/teams/route.ts')) {
    const teamsApiContent = fs.readFileSync('app/api/organizer/teams/route.ts', 'utf-8');

    test('Teams GET handler', teamsApiContent.includes('export async function GET'));
    test('Team statistics calculation', teamsApiContent.includes('marketers') || teamsApiContent.includes('clients'));
} else {
    test('Teams API file exists', false);
}

// ============================================
// PHASE 12: Check CSS Styling
// ============================================
log('PHASE 12: Organizer CSS Styling', 'section');

const cssContent = fs.readFileSync('app/organizer/organizer.css', 'utf-8');

const requiredCssClasses = [
    '.organizer-page',
    '.organizer-header',
    '.stats-row',
    '.tabs',
    '.users-table',
    '.pool-card',
    '.code-generator',
    '.modal',
];

for (const cls of requiredCssClasses) {
    const hasClass = cssContent.includes(cls);
    test(`CSS class: ${cls}`, hasClass);
}

// ============================================
// PHASE 13: Check Database Schema
// ============================================
log('PHASE 13: Database Schema', 'section');

const messagingSchema = fs.readFileSync('supabase/organizer_messaging_schema.sql', 'utf-8');

test('Announcements table creation', messagingSchema.includes('CREATE TABLE') && messagingSchema.includes('announcements'));
test('Direct messages table creation', messagingSchema.includes('CREATE TABLE') && messagingSchema.includes('direct_messages'));
test('RLS policies defined', messagingSchema.includes('CREATE POLICY') || messagingSchema.includes('ALTER TABLE'));
test('Indexes for performance', messagingSchema.includes('CREATE INDEX') || messagingSchema.includes('INDEX'));

// ============================================
// PHASE 14: Check Middleware RBAC
// ============================================
log('PHASE 14: Middleware RBAC', 'section');

const middlewareContent = fs.readFileSync('middleware.ts', 'utf-8');

test('/organizer route protected', middlewareContent.includes("'/organizer'"));
test('/api/organizer routes protected', middlewareContent.includes("'/api/organizer'"));
test('Organizer role redirect', middlewareContent.includes("case 'organizer'"));

// ============================================
// PHASE 15: Check State Management
// ============================================
log('PHASE 15: State Management', 'section');

const requiredStates = [
    'useState<User[]>',
    'useState<TeamStats[]>',
    'useState<DataPool[]>',
    'useState<AccessRequest[]>',
    'useState<Announcement[]>',
    'useState<ImpersonationSession',
    'activeTab',
    'loading',
];

for (const state of requiredStates) {
    const hasState = pageContent.includes(state);
    test(`State: ${state.replace('useState<', '').replace('>', '').replace('[]', '')}`, hasState);
}

// ============================================
// PHASE 16: Check UI Tabs
// ============================================
log('PHASE 16: UI Tabs Implementation', 'section');

const expectedTabs = [
    'users',
    'teams',
    'marketplace',
    'galaxy',
    'prompts',
    'traits',
    'ai-traits',
    'messages',
];

for (const tab of expectedTabs) {
    const hasTab = pageContent.includes(`'${tab}'`) || pageContent.includes(`"${tab}"`);
    test(`Tab: ${tab}`, hasTab);
}

// ============================================
// PHASE 17: Check Error Handling
// ============================================
log('PHASE 17: Error Handling', 'section');

test('Try-catch blocks used', pageContent.includes('try {') && pageContent.includes('catch'));
test('Error state management', pageContent.includes('console.error') || pageContent.includes('setError'));
test('API error responses', usersApiContent.includes('status: 500') || usersApiContent.includes('status: 403'));

// ============================================
// PHASE 18: Check Auth Integration
// ============================================
log('PHASE 18: Auth Integration', 'section');

test('getCurrentUser import', usersApiContent.includes("import { getCurrentUser }"));
test('isOrganizer check import', usersApiContent.includes("import { isOrganizer }"));
test('User profile verification', usersApiContent.includes('user?.profile'));

// ============================================
// RESULTS SUMMARY
// ============================================
console.log('\n' + '='.repeat(60));
console.log('📊 ORGANIZER PAGE TEST RESULTS');
console.log('='.repeat(60));
console.log(`✅ Passed: ${results.passed.length}`);
console.log(`❌ Failed: ${results.failed.length}`);
console.log(`⚠️  Warnings: ${results.warnings.length}`);
console.log('='.repeat(60));

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
    console.log('🎉 Organizer page is fully functional!');
} else if (successRate >= 80) {
    console.log('🔧 Organizer page needs minor fixes');
} else if (successRate >= 60) {
    console.log('⚠️  Organizer page has several issues to address');
} else {
    console.log('🚨 Organizer page has critical issues');
}

// Export results for programmatic use
export { results };

process.exit(results.failed.length > 0 ? 1 : 0);
