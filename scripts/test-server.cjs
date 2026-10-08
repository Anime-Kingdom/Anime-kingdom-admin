const assert = require('node:assert/strict');
const { createServer } = require('../server.cjs');
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const route of ['/', '/index.html', '/app.js?v=2', '/style.css', '/healthz', '/verify.html', '/verification.js', '/verification.css', '/certificates.js', '/vendor/qrcode.js']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      assert.ok((await response.text()).length > 0);
    }
    for (const route of ['/package.json', '/admin-android/setup.sql', '/.env', '/constructor']) {
      assert.equal((await fetch(base + route)).status, 404, route);
    }
    const head = await fetch(base, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    console.log('PASS: production assets, health check, HEAD and private-file protection.');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
