const { createServer } = require('./server.cjs');
const port = process.env.PORT || 3000;
createServer().listen(/^\d+$/.test(String(port)) ? Number(port) : port, '0.0.0.0', () => {
  console.log('Admin website started');
});
