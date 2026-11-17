import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const region = process.argv[2];
if (region && region !== 'cn' && region !== 'intl') throw new Error('Usage: pnpm preview [cn|intl]');
const root = path.resolve(region ? `dist/${region}` : 'out');
const port = Number(process.env.PORT || 3000);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.opus': 'audio/ogg', '.mp3': 'audio/mpeg' };
http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + path.sep)) throw Error('Invalid path');
    const info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      const index = path.join(file, 'index.html');
      if ((await stat(index).catch(() => null))?.isFile()) {
        if (!url.pathname.endsWith('/')) {
          res.writeHead(308, { Location: `${url.pathname}/${url.search}` });
          return res.end();
        }
        file = index;
      } else file += '.html';
    }
    else if (!info && !path.extname(file)) file += '.html';
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    const fallback = await readFile(path.join(root, '404.html')).catch(() => null);
    res.writeHead(404, { 'Content-Type': fallback ? types['.html'] : types['.txt'] });
    res.end(fallback ?? 'Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`LibreCosta static preview: http://127.0.0.1:${port}`));
