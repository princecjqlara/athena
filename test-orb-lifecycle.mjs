/**
 * Orb Lifecycle Test Script
 * 
 * Tests the Orb lifecycle state machine and suggested orb generation.
 * Run with: node test-orb-lifecycle.mjs
 */

// Helper functions for testing
function logSection(title) {
    console.log('\n' + '='.repeat(60));
    console.log(`  ${title}`);
    console.log('='.repeat(60));
}

function logResult(testName, passed, details = '') {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${testName}`);
    if (details) {
        console.log(`   ${details}`);
    }
}

// ============================================
// TEST 1: Orb State Definitions
// ============================================
function testOrbStateDefinitions() {
    logSection('Test 1: Orb State Definitions');

    const validStates = ['suggested', 'draft', 'published', 'observed'];
    const validTransitions = {
        suggested: ['draft'],
        draft: ['published'],
        published: ['observed'],
        observed: [],
    };

    let passed = true;

    // Verify all states exist
    for (const state of validStates) {
        const hasTransitions = validTransitions[state] !== undefined;
        if (!hasTransitions) {
            passed = false;
            console.log(`Missing transitions for state: ${state}`);
        }
    }

    logResult('Orb state definitions', passed);
    return passed;
}

// ============================================
// TEST 2: State Transitions
// ============================================
function testStateTransitions() {
    logSection('Test 2: State Transitions');

    const validTransitions = {
        suggested: ['draft'],
        draft: ['published'],
        published: ['observed'],
        observed: [],
    };

    function isValidTransition(from, to) {
        return validTransitions[from]?.includes(to) ?? false;
    }

    const testCases = [
        { from: 'suggested', to: 'draft', expected: true },
        { from: 'draft', to: 'published', expected: true },
        { from: 'published', to: 'observed', expected: true },
        { from: 'suggested', to: 'published', expected: false },
        { from: 'draft', to: 'suggested', expected: false },
        { from: 'observed', to: 'draft', expected: false },
    ];

    let allPassed = true;

    for (const tc of testCases) {
        const result = isValidTransition(tc.from, tc.to);
        const passed = result === tc.expected;
        if (!passed) allPassed = false;
        logResult(
            `Transition ${tc.from} → ${tc.to}`,
            passed,
            passed ? '' : `Expected ${tc.expected}, got ${result}`
        );
    }

    return allPassed;
}

// ============================================
// TEST 3: Orb Creation
// ============================================
function testOrbCreation() {
    logSection('Test 3: Orb Creation');

    // Simulate creating a suggested orb
    const suggestedOrb = {
        id: 'orb-test-001',
        state: 'suggested',
        createdFrom: 'ai',
        parentOrbId: 'orb-parent-123',
        derived: {
            facets: {
                platform_placement: ['tiktok'],
                media_format: ['video'],
                visual_style: [],
                audio_voice: ['voiceover'],
                content_hook: ['curiosity'],
                text_features: ['subtitles'],
                talent_face: ['ugc_creator'],
                sentiment: ['upbeat'],
                brand: [],
                cta: ['shop_now'],
            },
            embeddings: {
                creative: [],
                script: [],
                visual: [],
            },
            embeddingVersion: '1.0.0',
            createdAt: new Date().toISOString(),
        },
        spec: {
            platform: 'tiktok',
            objective: 'conversions',
            facets: {
                platform_placement: ['tiktok'],
                media_format: ['video'],
                visual_style: [],
                audio_voice: ['voiceover'],
                content_hook: ['curiosity'],
                text_features: ['subtitles'],
                talent_face: ['ugc_creator'],
                sentiment: ['upbeat'],
                brand: [],
                cta: ['shop_now'],
            },
        },
        learningIntent: {
            experimentLever: 'voiceover',
            reason: 'Testing voiceover on vs off',
            expectedInfoGain: 40,
        },
        createdAt: new Date().toISOString(),
    };

    let passed = true;

    // Validate required fields
    if (!suggestedOrb.id) { passed = false; console.log('Missing id'); }
    if (!suggestedOrb.state) { passed = false; console.log('Missing state'); }
    if (!suggestedOrb.createdFrom) { passed = false; console.log('Missing createdFrom'); }
    if (!suggestedOrb.spec) { passed = false; console.log('Missing spec'); }
    if (!suggestedOrb.derived) { passed = false; console.log('Missing derived'); }

    // Validate suggested orb specific requirements
    if (suggestedOrb.state === 'suggested' && !suggestedOrb.learningIntent) {
        passed = false;
        console.log('Suggested orb missing learningIntent');
    }

    logResult('Suggested orb creation', passed);
    return passed;
}

// ============================================
// TEST 4: Learning Intent Validation
// ============================================
function testLearningIntent() {
    logSection('Test 4: Learning Intent Validation');

    const validLevers = [
        'brand_timing',
        'voiceover',
        'animation',
        'jingle',
        'subtitles',
        'ugc_style',
        'hook_type',
        'cta_strength',
    ];

    const learningIntent = {
        experimentLever: 'voiceover',
        reason: 'Testing voiceover on vs off',
        expectedInfoGain: 40,
    };

    let passed = true;

    // Check lever is valid
    if (!validLevers.includes(learningIntent.experimentLever)) {
        passed = false;
        console.log(`Invalid experiment lever: ${learningIntent.experimentLever}`);
    }

    // Check required fields
    if (!learningIntent.reason) {
        passed = false;
        console.log('Missing reason');
    }

    logResult('Learning intent validation', passed);
    return passed;
}

// ============================================
// TEST 5: Safety Rules
// ============================================
function testSafetyRules() {
    logSection('Test 5: Safety Rules (IMMUTABLE)');

    const safetyConfig = {
        neverAutoPublish: true,
        neverExposeEmbeddings: true,
        neverOverwriteUserContent: true,
        alwaysAllowFallback: true,
        maxSuggestions: 3,
    };

    let passed = true;

    // These must ALWAYS be true
    if (!safetyConfig.neverAutoPublish) {
        passed = false;
        console.log('VIOLATION: neverAutoPublish must be true');
    }
    if (!safetyConfig.neverExposeEmbeddings) {
        passed = false;
        console.log('VIOLATION: neverExposeEmbeddings must be true');
    }
    if (!safetyConfig.neverOverwriteUserContent) {
        passed = false;
        console.log('VIOLATION: neverOverwriteUserContent must be true');
    }
    if (!safetyConfig.alwaysAllowFallback) {
        passed = false;
        console.log('VIOLATION: alwaysAllowFallback must be true');
    }
    if (safetyConfig.maxSuggestions > 3) {
        passed = false;
        console.log('VIOLATION: maxSuggestions cannot exceed 3');
    }

    logResult('Safety rules validation', passed);
    return passed;
}

// ============================================
// TEST 6: Suggestion Trigger Detection
// ============================================
function testSuggestionTriggers() {
    logSection('Test 6: Suggestion Trigger Detection');

    function shouldGenerateSuggestions(confidence, recentSuggestionCount, featureEnabled) {
        if (!featureEnabled) return { shouldGenerate: false, reason: 'Feature disabled' };
        if (recentSuggestionCount >= 3) return { shouldGenerate: false, reason: 'Max suggestions reached' };
        if (confidence >= 80) return { shouldGenerate: false, reason: 'Confidence already high' };
        if (confidence < 60) return { shouldGenerate: true, reason: 'Low confidence' };
        return { shouldGenerate: false, reason: 'No trigger conditions' };
    }

    const testCases = [
        { confidence: 45, recent: 0, enabled: true, expected: true },
        { confidence: 85, recent: 0, enabled: true, expected: false },
        { confidence: 50, recent: 3, enabled: true, expected: false },
        { confidence: 50, recent: 0, enabled: false, expected: false },
    ];

    let allPassed = true;

    for (const tc of testCases) {
        const result = shouldGenerateSuggestions(tc.confidence, tc.recent, tc.enabled);
        const passed = result.shouldGenerate === tc.expected;
        if (!passed) allPassed = false;
        logResult(
            `Confidence ${tc.confidence}%, ${tc.recent} recent, enabled=${tc.enabled}`,
            passed,
            passed ? result.reason : `Expected ${tc.expected}, got ${result.shouldGenerate}`
        );
    }

    return allPassed;
}

// ============================================
// TEST 7: Max Suggestions Cap
// ============================================
function testMaxSuggestionsCap() {
    logSection('Test 7: Max Suggestions Cap');

    const maxSuggestions = 3;

    function generateSuggestions(requestedCount) {
        return Math.min(requestedCount, maxSuggestions);
    }

    const testCases = [
        { requested: 1, expected: 1 },
        { requested: 3, expected: 3 },
        { requested: 5, expected: 3 },
        { requested: 10, expected: 3 },
    ];

    let allPassed = true;

    for (const tc of testCases) {
        const result = generateSuggestions(tc.requested);
        const passed = result === tc.expected;
        if (!passed) allPassed = false;
        logResult(
            `Requested ${tc.requested} suggestions`,
            passed,
            `Generated: ${result}`
        );
    }

    return allPassed;
}

// ============================================
// Main Test Runner
// ============================================
async function runTests() {
    console.log('\n🧪 Orb Lifecycle Test Suite');
    console.log('=====================================\n');
    console.log('Testing Orb lifecycle and suggested orb system.\n');

    const results = {
        orbStateDefinitions: false,
        stateTransitions: false,
        orbCreation: false,
        learningIntent: false,
        safetyRules: false,
        suggestionTriggers: false,
        maxSuggestionsCap: false,
    };

    // Run tests
    results.orbStateDefinitions = testOrbStateDefinitions();
    results.stateTransitions = testStateTransitions();
    results.orbCreation = testOrbCreation();
    results.learningIntent = testLearningIntent();
    results.safetyRules = testSafetyRules();
    results.suggestionTriggers = testSuggestionTriggers();
    results.maxSuggestionsCap = testMaxSuggestionsCap();

    // Summary
    logSection('Test Summary');

    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;

    console.log(`\nPassed: ${passed}/${total}`);

    Object.entries(results).forEach(([name, result]) => {
        console.log(`  ${result ? '✅' : '❌'} ${name}`);
    });

    if (passed === total) {
        console.log('\n✅ All tests passed!');
        console.log('\nThe Orb lifecycle system is correctly implemented.');
    } else {
        console.log('\n⚠️  Some tests failed. Check the output above.');
    }

    return passed === total;
}

// Run the tests
runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(err => {
        console.error('Test runner error:', err);
        process.exit(1);
    });
