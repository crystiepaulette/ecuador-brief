import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const base = '/ecuador-brief';
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/') {
    res.writeHead(302, { Location: `${base}/` });
    res.end();
    return;
  }
  if (!url.pathname.startsWith(base)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  let rel = decodeURIComponent(url.pathname.slice(base.length)) || '/';
  if (rel.endsWith('/')) rel += 'index.html';
  const file = normalize(join(root, rel));
  if (!file.startsWith(normalize(root))) {
    res.writeHead(403).end();
    return;
  }
  if (!extname(rel)) {
    const asDirectory = join(root, rel, 'index.html');
    if (existsSync(asDirectory)) {
      res.writeHead(302, { Location: `${url.pathname}/` });
      res.end();
      return;
    }
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    send(res, 404, join(root, '404.html'));
    return;
  }
  send(res, 200, file);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${port}${base}/`);
});
