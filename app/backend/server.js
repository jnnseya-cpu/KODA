// KODA — application server. Zero npm dependencies: node:http + node:sqlite.
// Serves: /app/* + /v1/* API (routes.js), the SPA (public/), the public site
// (public/site/*, generated at boot), and the PWA assets.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

require('./lib/db');            // init schema
require('./seed');              // idempotent demo seed
require('../frontend/build-site'); // generate public site pages at boot

const registerRoutes = require('./routes');

const PORT = process.env.PORT || 4600;
const PUBLIC = path.join(__dirname, '..', 'frontend');
const SHARED = path.join(__dirname, '..', 'shared');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};

// ---- tiny router ----
const routes = [];
const method = (m) => (p, h) => routes.push({ m, p: pattern(p), h });
const router = { get: method('GET'), post: method('POST'), put: method('PUT'), delete: method('DELETE') };
function pattern(p) {
  const keys = [];
  const re = new RegExp('^' + p.replace(/:[^/]+/g, (s) => { keys.push(s.slice(1)); return '([^/]+)'; }) + '$');
  return { re, keys };
}
registerRoutes(router);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const send = (code, body, headers = {}) => {
    const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...headers });
    res.end(data);
  };

  if (req.method === 'OPTIONS') {
    return send(204, '', { 'access-control-allow-methods': 'GET,POST,PUT,DELETE', 'access-control-allow-headers': 'authorization,content-type,x-api-key' });
  }

  // API routes
  const match = routes.find(r => r.m === req.method && r.p.re.test(url.pathname));
  if (match) {
    let body = {};
    if (req.method !== 'GET') {
      const chunks = [];
      for await (const c of req) { chunks.push(c); if (Buffer.concat(chunks).length > 2e6) return send(413, { error: 'payload_too_large' }); }
      try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}; }
      catch { return send(400, { error: 'invalid_json' }); }
    }
    const m = url.pathname.match(match.p.re);
    const params = Object.fromEntries(match.p.keys.map((k, i) => [k, m[i + 1]]));
    try {
      const out = await match.h({ params, body, query: Object.fromEntries(url.searchParams), headers: req.headers });
      if (Array.isArray(out) && typeof out[0] === 'number') return send(out[0], out[1]);
      return send(200, out ?? { ok: true });
    } catch (e) {
      console.error('route error', url.pathname, e);
      return send(500, { error: 'internal', request_id: Date.now().toString(36) });
    }
  }

  // shared modules served to the browser (UMD)
  if (url.pathname.startsWith('/shared/')) {
    const sp = path.join(SHARED, path.normalize(url.pathname.slice(8)).replace(/^([.][.][/\\])+/, ''));
    if (sp.startsWith(SHARED) && fs.existsSync(sp) && fs.statSync(sp).isFile())
      return send(200, fs.readFileSync(sp), { 'content-type': 'text/javascript' });
  }
  // static files (SPA + site + PWA)
  let file = url.pathname === '/' ? '/site/index.html' : url.pathname;
  if (file === '/app' || file.startsWith('/app/')) file = '/app.html'; // SPA catch-all
  const fp = path.join(PUBLIC, path.normalize(file).replace(/^([.][.][/\\])+/, ''));
  if (fp.startsWith(PUBLIC) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
    return send(200, fs.readFileSync(fp), { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  }
  // pretty URLs for site pages: /about → /site/about.html
  const page = path.join(PUBLIC, 'site', path.normalize(file).replace(/^\/|\/$/g, '') + '.html');
  if (page.startsWith(PUBLIC) && fs.existsSync(page)) {
    return send(200, fs.readFileSync(page), { 'content-type': 'text/html; charset=utf-8' });
  }
  send(404, { error: 'not_found', path: url.pathname });
});

server.listen(PORT, () => {
  console.log(`\n  KODA platform running:`);
  console.log(`  → Public site    http://localhost:${PORT}/`);
  console.log(`  → App (SPA/PWA)  http://localhost:${PORT}/app`);
  console.log(`  → API            http://localhost:${PORT}/v1/ping`);
  console.log(`  → Demo login     demo@koda.africa / koda-demo   ·   Admin: admin@koda.africa / koda-admin\n`);
});
