/**
 * Test script specifically for Facebook Ads Insights API
 * Run: node test-insights.js
 */

const https = require('https');

// Your credentials
const accessToken = 'EAAShiW00WlQBQRnk39ikijZAQ4rMpczHtKas4GbWZA9rew5GqtETH8iVOmgBzKMdpa8BfbEYeYR7n1UObWKSrKrpZA4ArGqM660F5ZCKaSVfMo7EZC2Ag0ela3jkgdx3xqeZAEHjIGvi9Ysy743gCyaWj7vRP1to043gQKWF69mWSm4e8dQTdIO1vznu8dq23x5BGdV5DYpph6TO127bKQ';

// Sample Ad IDs from your screenshot
const sampleAdIds = [
    '120236907600030545',
    '120236907857880545',
    '120236907858690545',
    '120236907840560545'
];

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Invalid JSON: ' + data));
                }
            });
        }).on('error', reject);
    });
}

async function testInsights() {
    console.log('\\n🔍 Testing Facebook Ads Insights API...\\n');
    console.log('='.repeat(60));

    // First, check token permissions
    console.log('\\n📋 Step 1: Checking token permissions...');
    const debugUrl = `https://graph.facebook.com/v24.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`;

    try {
        const debugResult = await makeRequest(debugUrl);
        if (debugResult.data) {
            console.log('✅ Token is valid');
            console.log('   Scopes:', debugResult.data.scopes?.join(', ') || 'No scopes found');
            console.log('   App ID:', debugResult.data.app_id);
            console.log('   Expires:', debugResult.data.expires_at ? new Date(debugResult.data.expires_at * 1000).toISOString() : 'Never');

            // Check for required permissions
            const requiredScopes = ['ads_read', 'read_insights'];
            const missingScopes = requiredScopes.filter(scope =>
                !debugResult.data.scopes?.includes(scope)
            );

            if (missingScopes.length > 0) {
                console.log('\\n⚠️  MISSING PERMISSIONS:', missingScopes.join(', '));
                console.log('   You need these permissions to fetch ad insights!');
                console.log('   Go to developers.facebook.com and add these permissions to your token.');
            }
        } else if (debugResult.error) {
            console.log('❌ Token debug error:', debugResult.error.message);
        }
    } catch (err) {
        console.log('Error checking token:', err.message);
    }

    // Test fetching insights for each ad
    console.log('\\n📋 Step 2: Testing insights for each ad...');

    for (const adId of sampleAdIds) {
        console.log(`\\n--- Ad ID: ${adId} ---`);

        // Try different date presets
        const datePresets = ['lifetime', 'last_7d', 'last_30d', 'maximum'];

        for (const preset of datePresets) {
            try {
                const insightsUrl = `https://graph.facebook.com/v24.0/${adId}/insights?fields=impressions,reach,clicks,ctr,cpc,spend,actions&date_preset=${preset}&access_token=${accessToken}`;

                const result = await makeRequest(insightsUrl);

                if (result.error) {
                    console.log(`   ${preset}: ❌ Error - ${result.error.message}`);
                } else if (!result.data || result.data.length === 0) {
                    console.log(`   ${preset}: ⚠️  No data returned`);
                } else {
                    const insights = result.data[0];
                    console.log(`   ${preset}: ✅ Data found!`);
                    console.log(`      Impressions: ${insights.impressions || 0}`);
                    console.log(`      Clicks: ${insights.clicks || 0}`);
                    console.log(`      Spend: $${insights.spend || 0}`);
                    break; // Found data, no need to try other presets
                }
            } catch (err) {
                console.log(`   ${preset}: Error - ${err.message}`);
            }
        }
    }

    // Test fetching account-level insights
    console.log('\\n📋 Step 3: Testing account-level insights...');

    // First get the ad account ID from one of the ads
    try {
        const adUrl = `https://graph.facebook.com/v24.0/${sampleAdIds[0]}?fields=account_id&access_token=${accessToken}`;
        const adResult = await makeRequest(adUrl);

        if (adResult.account_id) {
            console.log(`   Ad Account ID: ${adResult.account_id}`);

            const accountInsightsUrl = `https://graph.facebook.com/v24.0/act_${adResult.account_id}/insights?fields=impressions,reach,clicks,spend&date_preset=last_30d&access_token=${accessToken}`;
            const accountInsights = await makeRequest(accountInsightsUrl);

            if (accountInsights.error) {
                console.log(`   ❌ Account insights error: ${accountInsights.error.message}`);
            } else if (!accountInsights.data || accountInsights.data.length === 0) {
                console.log(`   ⚠️  No account-level insights data`);
            } else {
                const data = accountInsights.data[0];
                console.log(`   ✅ Account insights found!`);
                console.log(`      Total Impressions: ${data.impressions || 0}`);
                console.log(`      Total Clicks: ${data.clicks || 0}`);
                console.log(`      Total Spend: $${data.spend || 0}`);
            }
        } else if (adResult.error) {
            console.log(`   ❌ Error getting ad account: ${adResult.error.message}`);
        }
    } catch (err) {
        console.log('   Error:', err.message);
    }

    console.log('\\n' + '='.repeat(60));
    console.log('\\n🔍 Possible reasons for 0 metrics:\\n');
    console.log('1. Ads are very new and haven\'t accumulated data yet');
    console.log('2. Ads have no delivery (not running/spending)');
    console.log('3. Token is missing ads_read or read_insights permission');
    console.log('4. Facebook hasn\'t processed the data yet (can take hours)');
    console.log('5. The ads are in a campaign that\'s paused or draft\\n');
}

testInsights().catch(console.error);
