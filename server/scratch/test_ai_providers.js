const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const keys = {
  OpenRouter: process.env.OPENROUTER_API_KEY,
  Gemini: process.env.GEMINI_API_KEY,
  OpenAI: process.env.OPENAI_API_KEY,
  DeepSeek: process.env.DEEPSEEK_API_KEY
};

async function testOpenRouter() {
  if (!keys.OpenRouter) return { status: 'Missing Key' };
  try {
    const start = Date.now();
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100
    }, {
      headers: {
        'Authorization': `Bearer ${keys.OpenRouter}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    return {
      status: 'Working',
      latency: Date.now() - start,
      response: res.data.choices[0].message.content.trim()
    };
  } catch (err) {
    return {
      status: 'Not Working',
      error: err.response ? `${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message
    };
  }
}

async function runTests() {
  console.log('Testing OpenRouter with max_tokens limit...');
  const result = await testOpenRouter();
  console.log('OpenRouter Status:', result.status);
  if (result.status === 'Working') {
    console.log(`Latency:  ${result.latency}ms`);
    console.log(`Response: ${result.response}`);
  } else {
    console.log(`Error:    ${result.error}`);
  }
}

runTests();
