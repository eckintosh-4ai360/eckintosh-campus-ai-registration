import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import event from '../api/event.mjs';
import register from '../api/register.mjs';
import status from '../api/status.mjs';

const routes = {'/api/event': event, '/api/register': register, '/api/status': status};
const files = {'/': ['../index.html', 'text/html; charset=utf-8'], '/index.html': ['../index.html', 'text/html; charset=utf-8'], '/privacy.html': ['../privacy.html', 'text/html; charset=utf-8'], '/assets/app.js': ['../assets/app.js', 'text/javascript; charset=utf-8'], '/assets/style.css': ['../assets/style.css', 'text/css; charset=utf-8'], '/public/logo.png': ['../public/logo.png', 'image/png']};
const port = Number(process.env.PORT || 3000);
createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  const path = new URL(req.url, 'http://localhost').pathname;
  const handler = routes[path];
  if (handler) {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 12000) { res.writeHead(413).end(); return; }
    }
    req.body = raw || undefined;
    res.status = code => { res.statusCode = code; return res; };
    res.json = data => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(data)); };
    try { await handler(req, res); } catch { if (!res.writableEnded) res.status(500).json({error: 'Service unavailable.'}); }
    return;
  }
  const file = files[path];
  if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404).end('Not found'); return; }
  try {
    const data = await readFile(new URL(file[0], import.meta.url));
    res.writeHead(200, {'Content-Type': file[1]});
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500).end('Service unavailable'); }
}).listen(port, '127.0.0.1', () => console.log(`Local site running at http://localhost:${port}`));
