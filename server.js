'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { OfficeWatcher } = require('./lib/watcher');

const PORT = Number(process.env.PORT) || 4780;
const PUBLIC = path.join(__dirname, 'public');
const THREE_ROOT = path.dirname(path.dirname(require.resolve('three')));
const THREE_FILES = new Set([
  'build/three.module.js',
  'build/three.core.js',
  'examples/jsm/controls/OrbitControls.js',
  'examples/jsm/geometries/RoundedBoxGeometry.js',
]);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); }
  catch { res.writeHead(400).end('bad request'); return; }
  let file;
  if (urlPath.startsWith('/vendor/three/')) {
    const relativePath = urlPath.slice('/vendor/three/'.length);
    if (!THREE_FILES.has(relativePath)) { res.writeHead(404).end('not found'); return; }
    file = path.join(THREE_ROOT, relativePath);
  } else {
    file = path.resolve(PUBLIC, `.${urlPath === '/' ? '/index.html' : urlPath}`);
  }
  if (!urlPath.startsWith('/vendor/three/') && !file.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws' });
const watcher = new OfficeWatcher();

function broadcast(snapshot) {
  const msg = JSON.stringify(snapshot);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

watcher.on('change', broadcast);
wss.on('connection', (ws) => {
  ws.send(JSON.stringify(watcher.snapshot()));
});

watcher.start();
server.listen(PORT, () => {
  console.log(`🏢 Copilot Virtual Office → http://localhost:${PORT}`);
});
