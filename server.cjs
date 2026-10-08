const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Serve only public UI assets, never SQL, source archives or credentials.
const files = {
  '/certificates.js': ['certificates.js','text/javascript; charset=utf-8'],
  '/vendor/qrcode.js': ['vendor/qrcode.js','text/javascript; charset=utf-8'],
  '/reset.html': ['reset.html', 'text/html; charset=utf-8'],
  '/reset.js': ['reset.js', 'text/javascript; charset=utf-8'],
  '/logo.jpeg': ['logo.jpeg', 'image/jpeg'],
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8']
};
function createServer() {
  return http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; }
    catch { res.writeHead(400).end(); return; }
    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end(req.method === 'HEAD' ? undefined : 'ok');
      return;
    }
    const asset = Object.hasOwn(files, pathname) ? files[pathname] : null;
    if (!asset) { res.writeHead(404).end(); return; }
    fs.readFile(path.join(__dirname, asset[0]), (error, data) => {
      if (error) { res.writeHead(500).end('Unable to load website'); return; }
      res.writeHead(200, {
        'Content-Type': asset[1],
        'Content-Length': data.length,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}
if (require.main === module) {
  const port = process.env.PORT || 3000;
  createServer().listen(/^\d+$/.test(String(port)) ? Number(port) : port, '0.0.0.0', () => {
    console.log('Admin website listening on hosting port ' + port);
  });
}
module.exports = { createServer };
