/**
 * Test script for Facebook Ads API
 * Run: node test-ads-api.js
 * 
 * Make sure to set your environment variables or edit the values below
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Direct credentials for testing
// TOKEN PROVIDED BY USER
let accessToken = 'EAAShiW00WlQBQRnk39ikijZAQ4rMpczHtKas4GbWZA9rew5GqtETH8iVOmbBzKMdpa8BfbEYeYR7n1UObWKSrKrpZA4ArGqM660F5ZCKaSVfMo7EZC2Ag0ela3jkgdx3xqeZAEHjIGvi9Ysy743gCyaWj7vRP1to043gQKWF69mWSm4e8dQTdIO1vznu8dq23x5BGdV5DYpph6TO127bKQ';

// AD ACCOUNT ID - Will be fetched from the token's accessible accounts
let adAccountId = '';

// Check if we have the token
if (!accessToken) {
    console.log('\n❌ Missing access token!');
    process.exit(1);
}

console.log('\n🔍 Testing Facebook Ads API Connection...\n');
console.log('Ad Account ID:', adAccountId);
console.log('Access Token:', accessToken.substring(0, 20) + '...' + accessToken.substring(accessToken.length - 10));

// Test 1: Verify token
console.log('\n📋 Test 1: Verifying access token...');

const tokenCheckUrl = `https://graph.facebook.com/v24.0/me?access_token=${accessToken}`;

function makeRequest(url, testName) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        }).on('error', reject);
    });
}

async function runTests() {
    try {
        // Test 1: Token validation
        const meResult = await makeRequest(tokenCheckUrl, 'Token Validation');
        if (meResult.error) {
            console.log('❌ Token Error:', meResult.error.message);
            console.log('   Error Code:', meResult.error.code);
            console.log('   Error Type:', meResult.error.type);
            return;
        }
        console.log('✅ Token is valid!');
        console.log('   User ID:', meResult.id);
        console.log('   Name:', meResult.name);

        // Test 2: Check Ad Account access
        console.log('\n📋 Test 2: Checking Ad Account access...');
        const accountUrl = `https://graph.facebook.com/v24.0/act_${adAccountId}?fields=id,name,account_status,currency,timezone_name&access_token=${accessToken}`;

        const accountResult = await makeRequest(accountUrl, 'Account Access');
        if (accountResult.error) {
            console.log('❌ Ad Account Error:', accountResult.error.message);
            console.log('   Error Code:', accountResult.error.code);
            console.log('\n💡 Possible issues:');
            console.log('   - Wrong Ad Account ID');
            console.log('   - Token doesn\'t have ads_read permission');
            console.log('   - Token not associated with this Ad Account');
            return;
        }
        console.log('✅ Ad Account accessible!');
        console.log('   Account ID:', accountResult.id);
        console.log('   Name:', accountResult.name);
        console.log('   Status:', accountResult.account_status === 1 ? 'Active' : 'Inactive (' + accountResult.account_status + ')');
        console.log('   Currency:', accountResult.currency);
        console.log('   Timezone:', accountResult.timezone_name);

        // Test 3: Fetch ads
        console.log('\n📋 Test 3: Fetching ads...');
        const adsUrl = `https://graph.facebook.com/v24.0/act_${adAccountId}/ads?fields=id,name,status,effective_status&limit=5&access_token=${accessToken}`;

        const adsResult = await makeRequest(adsUrl, 'Fetch Ads');
        if (adsResult.error) {
            console.log('❌ Ads Fetch Error:', adsResult.error.message);
            console.log('   Error Code:', adsResult.error.code);
            return;
        }

        if (!adsResult.data || adsResult.data.length === 0) {
            console.log('⚠️  No ads found in this account.');
            console.log('   This is normal if you haven\'t created any ads yet.');
        } else {
            console.log(`✅ Found ${adsResult.data.length} ads!`);
            console.log('\n   Sample ads:');
            adsResult.data.forEach((ad, i) => {
                console.log(`   ${i + 1}. ${ad.name}`);
                console.log(`      ID: ${ad.id}`);
                console.log(`      Status: ${ad.effective_status}`);
            });
        }

        // Test 4: Fetch insights for first ad
        if (adsResult.data && adsResult.data.length > 0) {
            console.log('\n📋 Test 4: Fetching insights for first ad...');
            const firstAdId = adsResult.data[0].id;
            const insightsUrl = `https://graph.facebook.com/v24.0/${firstAdId}/insights?fields=impressions,clicks,ctr,spend&date_preset=lifetime&access_token=${accessToken}`;

            const insightsResult = await makeRequest(insightsUrl, 'Fetch Insights');
            if (insightsResult.error) {
                console.log('❌ Insights Error:', insightsResult.error.message);
            } else if (!insightsResult.data || insightsResult.data.length === 0) {
                console.log('⚠️  No insights data available yet for this ad.');
                console.log('   This is normal for new ads or ads with no impressions.');
            } else {
                const insights = insightsResult.data[0];
                console.log('✅ Insights retrieved!');
                console.log('   Impressions:', insights.impressions || 0);
                console.log('   Clicks:', insights.clicks || 0);
                console.log('   CTR:', insights.ctr || 0);
                console.log('   Spend: $' + (insights.spend || 0));
            }
        }

        console.log('\n✅ All tests completed successfully!\n');
        console.log('Your Facebook Ads API connection is working correctly.');
        console.log('If ads are not showing in the app, make sure the dev server is running: npm run dev\n');

    } catch (error) {
        console.log('\n❌ Test failed with error:', error.message);
    }
}

runTests();
