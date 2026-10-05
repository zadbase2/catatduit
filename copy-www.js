const fs = require('fs');
const path = require('path');

const root = __dirname;
const www = path.join(root, 'www');

if (!fs.existsSync(www)) {
  fs.mkdirSync(www, { recursive: true });
}

function copyRecursive(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy web assets
fs.copyFileSync(path.join(root, 'index.html'), path.join(www, 'index.html'));
copyRecursive(path.join(root, 'css'), path.join(www, 'css'));
copyRecursive(path.join(root, 'js'), path.join(www, 'js'));

if (fs.existsSync(path.join(root, 'manifest.json'))) {
  fs.copyFileSync(path.join(root, 'manifest.json'), path.join(www, 'manifest.json'));
}

console.log('✅ Web assets successfully copied to www/ for Capacitor!');
