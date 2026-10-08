const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'app.js', 'style.css', 'logo.jpeg', 'reset.html', 'reset.js', 'certificates.js', 'vendor/qrcode.js', 'vendor/qrcode-LICENSE.txt']) {
  fs.mkdirSync(path.dirname(path.join(output,file)),{recursive:true});
  fs.mkdirSync(path.dirname(path.join(root,'admin-android/android/assets',file)),{recursive:true});
  fs.copyFileSync(path.join(root, file), path.join(output, file));
  fs.copyFileSync(path.join(root, file), path.join(root, 'admin-android/android/assets', file));
}
console.log('Admin website built in dist/');
