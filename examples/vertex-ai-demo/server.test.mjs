import { Readable } from 'node:stream';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from './server.mjs';

let calls = 0;
const handler = createHandler({
  env: { GOOGLE_CLOUD_PROJECT: 'public-demo-project', GOOGLE_CLOUD_LOCATION: 'us-central1', VERTEX_MODEL: 'gemini-2.5-flash' },
  getAccessToken: async () => 'test-token',
  fetcher: async (url, init) => {
    calls++;
    assert.match(url, /aiplatform.googleapis.com/);
    assert.equal(JSON.parse(init.body).contents[0].parts[0].text, 'Hello');
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Hi' }] } }] });
  },
});

async function request(method, url, body = '') {
  const req = Readable.from([body]);
  req.method = method;
  req.url = url;
  const res = {
    status: 200,
    body: '',
    setHeader() {},
    writeHead(status) { this.status = status; return this; },
    end(value) { this.body = value; return this; },
  };
  await handler(req, res);
  return { status: res.status, body: JSON.parse(res.body) };
}

test('health and a minimal Vertex request', async () => {
  assert.deepEqual(await request('GET', '/health'), { status: 200, body: { status: 'ok' } });
  assert.deepEqual(await request('POST', '/generate', JSON.stringify({ text: 'Hello' })), { status: 200, body: { text: 'Hi' } });
  assert.equal(calls, 1);
});

test('rejects invalid input before making a Vertex request', async () => {
  assert.deepEqual(await request('POST', '/generate', JSON.stringify({ text: '' })), { status: 400, body: { error: 'invalid_text' } });
  assert.equal(calls, 1);
});
