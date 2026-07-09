import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';

const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

function resolvePath(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  const decoded = decodeURIComponent(url.pathname);
  const requested = normalize(join(root, decoded));

  if (!requested.startsWith(root)) return null;

  if (existsSync(requested)) {
    const stats = statSync(requested);
    if (stats.isDirectory()) {
      const indexFile = join(requested, 'index.html');
      if (existsSync(indexFile)) return indexFile;
    }
    if (stats.isFile()) return requested;
  }

  return join(root, 'index.html');
}

createServer((req, res) => {
  if (!req.url || req.method !== 'GET') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }

  const filePath = resolvePath(req.url);
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': types[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(filePath).pipe(res);
}).listen(port, host, () => {
  console.log(`Serving ${root} at http://${host}:${port}`);
});

