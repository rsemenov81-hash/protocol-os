// Tiny static file server (node:http) for the e2e run: serves one directory on 127.0.0.1 at a free
// port, no caching, no directory listings, no path escapes. Nothing outside node:* is needed.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
};

// Returns { url, port, close() }. `url` has no trailing slash.
export function startStaticServer(rootDir, { host = '127.0.0.1', port = 0, log = null } = {}) {
  const root = resolve(rootDir);
  const server = createServer((req, res) => {
    const end = (status, body = '') => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body); };
    if (req.method !== 'GET' && req.method !== 'HEAD') return end(405, 'method not allowed');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return end(400, 'bad request'); }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + sep)) return end(403, 'forbidden');
    let st;
    try { st = statSync(file); } catch { if (log) log(`404 ${pathname}`); return end(404, 'not found: ' + pathname); }
    if (st.isDirectory()) { res.writeHead(302, { Location: pathname + '/' }); return res.end(); }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).on('error', () => end(500, 'read error')).pipe(res);
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => {
      const { port: p } = server.address();
      ok({
        server,
        port: p,
        url: `http://${host}:${p}`,
        close: () => new Promise((done) => { server.close(() => done()); server.closeAllConnections?.(); }),
      });
    });
  });
}
