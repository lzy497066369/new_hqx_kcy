const assert = require('node:assert/strict');
const { OpenAiCompatibleProvider } = require('../dist/modules/ai/providers/openai-compatible.provider');

const originalFetch = global.fetch;
const env = { ...process.env };
const input = { messages: [{ role: 'user', content: 'synthetic test' }], responseFormat: 'json_object' };
let calls = [];
const json = (content = 'ok', model = undefined) => new Response(JSON.stringify({ choices: [{ message: { content } }], model }));
const stream = (...lines) => new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/event-stream' } });
const chunk = (text) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`;
const mock = (fn) => {
  calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, ...JSON.parse(options.body), headers: options.headers });
    return fn(calls.length, options);
  };
};
async function main() {
  delete process.env.AI_MODEL;
  delete process.env.AI_MODELS;
  delete process.env.AI_BASE_URL;
  process.env.AI_API_KEY = 'synthetic-test-key-not-a-secret';
  process.env.AI_TIMEOUT_MS = '100';
  mock((i) => i < 3 ? new Response('upstream secret must not escape', { status: i === 1 ? 429 : 503 }) : json('success'));
  assert.equal((await new OpenAiCompatibleProvider().chat(input)).model, 'gpt-5.6-sol');
  assert.deepEqual(calls.map((call) => call.model), ['gpt-6-astra', 'gpt-6-sol', 'gpt-5.6-sol']);
  assert.equal(calls[0].url, 'https://api.psydo.top/v1/chat/completions');
  assert.equal(calls[0].headers.Authorization, `Bearer ${process.env.AI_API_KEY}`);
  assert.equal(calls[0].headers['api-key'], undefined);
  assert.deepEqual(calls[0].response_format, { type: 'json_object' });
  assert.equal(calls[0].thinking, undefined, 'Do not send legacy vendor parameters by default');
  for (const status of [400, 401, 403, 404, 422]) {
    mock(() => new Response('private-provider-error', { status }));
    await assert.rejects(() => new OpenAiCompatibleProvider().chat(input), (e) => !e.message.includes('private-provider-error') && e.message.includes(String(status)));
    assert.equal(calls.length, 1, `HTTP ${status} does not blindly retry`);
  }
  mock((i) => i === 1 ? new Response('{"error":{"code":"model_not_found"}}', { status: 404 }) : json());
  await new OpenAiCompatibleProvider().chat(input);
  assert.equal(calls.length, 2);
  mock((i) => { if (i === 1) throw new TypeError('fetch failed'); return json(); });
  await new OpenAiCompatibleProvider().chat(input);
  assert.equal(calls.length, 2);
  mock((i, options) => i === 1 ? new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))) : json());
  await new OpenAiCompatibleProvider().chat(input);
  assert.equal(calls.length, 2);
  mock((i) => i === 1 ? json('') : json('result', 'reported-model'));
  assert.equal((await new OpenAiCompatibleProvider().chat(input)).model, 'reported-model');
  mock(() => json());
  process.env.AI_BASE_URL = 'https://api.psydo.top/';
  process.env.AI_MODEL = 'custom-primary';
  process.env.AI_MODELS = 'custom-primary, custom-backup,custom-backup';
  await new OpenAiCompatibleProvider().chat({ ...input, model: 'vision-model' });
  assert.equal(calls[0].model, 'vision-model');
  assert.equal(calls[0].url, 'https://api.psydo.top/v1/chat/completions');
  delete process.env.AI_MODEL;
  delete process.env.AI_MODELS;
  mock((i) => i === 1 ? new Response('busy', { status: 503 }) : stream(chunk('hello'), chunk(' world'), 'data: [DONE]'));
  const pieces = [];
  const result = await new OpenAiCompatibleProvider().stream(input, (part) => { if (part.content) pieces.push(part.content); });
  assert.equal(result.content, 'hello world');
  assert.deepEqual(pieces, ['hello', ' world']);
  assert.equal(calls.length, 2);
  mock(() => stream(chunk('partial'), 'data: {"error":{"message":"sensitive"}}'));
  const partial = [];
  await assert.rejects(() => new OpenAiCompatibleProvider().stream(input, (part) => { partial.push(part.content); }), /stream failed/);
  assert.equal(calls.length, 1, 'Never retry a partially emitted stream');
  assert.deepEqual(partial, ['partial']);
  mock(() => stream(chunk('truncated')));
  await assert.rejects(() => new OpenAiCompatibleProvider().stream(input, () => {}), /ended unexpectedly/);
  assert.equal(calls.length, 1);
  mock(() => stream(chunk('data'), 'data: [DONE]'));
  await assert.rejects(() => new OpenAiCompatibleProvider().stream(input, () => { throw new Error('consumer failure'); }));
  assert.equal(calls.length, 1);
  delete process.env.AI_API_KEY;
  mock(() => json());
  await assert.rejects(() => new OpenAiCompatibleProvider().chat(input), /AI_API_KEY/);
  assert.equal(calls.length, 0);
  console.log('AI provider: primary/fallback, authentication, error redaction, timeout and stream safety passed');
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch;
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
  Object.assign(process.env, env);
});
