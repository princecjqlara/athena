/**
 * Test NVIDIA API Key with GPT-OSS-120B
 * Run with: node test-nvidia-api.mjs
 */

import fs from 'fs';

// Read .env.local to get the API key
let apiKey = null;
try {
    const envContent = fs.readFileSync('.env.local', 'utf-8');
    const match = envContent.match(/NVIDIA_API_KEY=(.+)/);
    if (match) {
        apiKey = match[1].trim();
        console.log('✅ Found NVIDIA_API_KEY in .env.local');
        console.log(`   Key starts with: ${apiKey.substring(0, 15)}...`);
    }
} catch (e) {
    console.log('❌ Could not read .env.local:', e.message);
}

if (!apiKey) {
    console.log('❌ No NVIDIA_API_KEY found!');
    process.exit(1);
}

// Test the API
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

console.log('\n🧪 Testing NVIDIA API with openai/gpt-oss-120b...');

try {
    const response = await fetch(NVIDIA_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages: [
                { role: 'system', content: 'You are Athena AI, a helpful advertising expert assistant. Be concise.' },
                { role: 'user', content: 'Hello! Can you confirm you are working? Give me a one sentence response.' }
            ],
            temperature: 0.7,
            max_tokens: 100,
        }),
    });

    console.log(`📡 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ API Error Response:');
        console.log(errorText);

        if (response.status === 401) {
            console.log('\n🔑 The API key is INVALID or EXPIRED!');
        } else if (response.status === 404) {
            console.log('\n📁 Model not found - the model may not be available yet.');
        }
    } else {
        const result = await response.json();
        const content = result.choices?.[0]?.message?.content;

        console.log('\n✅ API Response SUCCESS!');
        console.log(`📝 AI Response: "${content}"`);
        console.log('\n🎉 NVIDIA API with GPT-OSS-120B is working correctly!');
        console.log('\n📋 Full response structure:');
        console.log(JSON.stringify(result, null, 2));
    }
} catch (error) {
    console.log('❌ Network/Fetch Error:', error.message);
    console.log('\n🌐 Check your internet connection.');
}
