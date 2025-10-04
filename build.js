const fs = require('fs');
const path = require('path');

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// Clean and create dist directories for extensions
const chromeDir = 'dist/chrome-extension';
const safariDir = 'dist/safari-extension';

if (fs.existsSync(chromeDir)) fs.rmSync(chromeDir, { recursive: true });
if (fs.existsSync(safariDir)) fs.rmSync(safariDir, { recursive: true });

fs.mkdirSync(chromeDir, { recursive: true });
fs.mkdirSync(safariDir, { recursive: true });

// Copy compiled JS files for Chrome
copyFile('dist/chrome/popup.js', path.join(chromeDir, 'popup.js'));
copyFile('dist/chrome/background.js', path.join(chromeDir, 'background.js'));
copyFile('dist/shared/query-lens.js', path.join(chromeDir, 'query-lens.js'));

// Copy assets for Chrome
copyFile('src/shared/popup.html', path.join(chromeDir, 'popup.html'));
copyFile('src/shared/styles.css', path.join(chromeDir, 'styles.css'));
copyFile('src/shared/icons/icon16.png', path.join(chromeDir, 'icon16.png'));
copyFile('src/shared/icons/icon48.png', path.join(chromeDir, 'icon48.png'));
copyFile('src/shared/icons/icon128.png', path.join(chromeDir, 'icon128.png'));

copyFile('src/shared/manifest.json', path.join(chromeDir, 'manifest.json'));

// Copy compiled JS files for Safari
copyFile('dist/safari/popup.js', path.join(safariDir, 'popup.js'));
copyFile('dist/safari/background.js', path.join(safariDir, 'background.js'));
copyFile('dist/shared/query-lens.js', path.join(safariDir, 'query-lens.js'));

// Copy assets for Safari
copyFile('src/shared/popup.html', path.join(safariDir, 'popup.html'));
copyFile('src/shared/styles.css', path.join(safariDir, 'styles.css'));
copyFile('src/shared/icons/icon16.png', path.join(safariDir, 'icon16.png'));
copyFile('src/shared/icons/icon48.png', path.join(safariDir, 'icon48.png'));
copyFile('src/shared/icons/icon128.png', path.join(safariDir, 'icon128.png'));

copyFile('src/shared/manifest.json', path.join(safariDir, 'manifest.json'));

// Clean up TypeScript compilation artifacts
if (fs.existsSync('dist/chrome')) fs.rmSync('dist/chrome', { recursive: true });
if (fs.existsSync('dist/safari')) fs.rmSync('dist/safari', { recursive: true });
if (fs.existsSync('dist/shared')) fs.rmSync('dist/shared', { recursive: true });

console.log('Build completed successfully!');
console.log('Chrome extension: dist/chrome-extension/');
console.log('Safari extension: dist/safari-extension/');
