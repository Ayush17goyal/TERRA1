const axios = require('axios');
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
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 50
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

async function testOpenAI() {
  if (!keys.OpenAI) return { status: 'Missing Key' };
  try {
    const start = Date.now();
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 50
    }, {
      headers: {
        'Authorization': `Bearer ${keys.OpenAI}`,
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

async function testGemini() {
  if (!keys.Gemini) return { status: 'Missing Key' };
  try {
    const start = Date.now();
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keys.Gemini}`,
      {
        contents: [{ parts: [{ text: 'Say hello' }] }]
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return {
      status: 'Working',
      latency: Date.now() - start,
      response: res.data.candidates[0].content.parts[0].text.trim()
    };
  } catch (err) {
    return {
      status: 'Not Working',
      error: err.response ? `${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message
    };
  }
}

async function testDeepSeek() {
  if (!keys.DeepSeek) return { status: 'Missing Key' };
  try {
    const start = Date.now();
    const res = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 50
    }, {
      headers: {
        'Authorization': `Bearer ${keys.DeepSeek}`,
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

async function runAll() {
  console.log('Testing OpenRouter...');
  console.log('OpenRouter:', await testOpenRouter());
  
  console.log('Testing OpenAI...');
  console.log('OpenAI:', await testOpenAI());
  
  console.log('Testing Gemini...');
  console.log('Gemini:', await testGemini());
  
  console.log('Testing DeepSeek...');
  console.log('DeepSeek:', await testDeepSeek());
}

runAll();
