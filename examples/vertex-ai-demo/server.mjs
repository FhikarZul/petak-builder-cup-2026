import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

function config(env) {
  const project = env.GOOGLE_CLOUD_PROJECT;
  const location = env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const model = env.VERTEX_MODEL || 'gemini-2.5-flash';
  if (!project || !/^[a-z][a-z0-9-]{4,62}$/.test(project)) throw new Error('Set GOOGLE_CLOUD_PROJECT');
  if (!/^[a-z0-9-]+$/.test(location) || !/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Invalid Vertex configuration');
  return { project, location, model };
}

export function createHandler({ env = process.env, getAccessToken = async () => {
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const result = await client.getAccessToken();
  if (!result.token) throw new Error('Google credentials unavailable');
  return result.token;
}, fetcher = fetch } = {}) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200).end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (req.url !== '/generate' || req.method !== 'POST') {
      res.writeHead(404).end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    try {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 8192) {
          res.writeHead(413).end(JSON.stringify({ error: 'request_too_large' }));
          return;
        }
      }
      const input = JSON.parse(raw);
      if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2000) {
        res.writeHead(400).end(JSON.stringify({ error: 'invalid_text' }));
        return;
      }
      const { project, location, model } = config(env);
      const accessToken = await getAccessToken();
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
      const response = await fetcher(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: input.text }] }] }),
      });
      if (!response.ok) {
        res.writeHead(502).end(JSON.stringify({ error: 'vertex_request_failed' }));
        return;
      }
      const output = await response.json();
      const text = output.candidates?.[0]?.content?.parts
        ?.filter((part) => typeof part.text === 'string')
        .map((part) => part.text).join('') || '';
      res.writeHead(200).end(JSON.stringify({ text }));
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : 500;
      res.writeHead(status).end(JSON.stringify({ error: status === 400 ? 'invalid_json' : 'generation_failed' }));
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8080);
  createServer(createHandler()).listen(port, '0.0.0.0');
}
