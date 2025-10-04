const fs = require('fs');
const path = require('path');

/**
 * Copy a file from a source path to a destination path, creating parent directories if required.
 * @param {string} src - The source file path.
 * @param {string} dest - The destination file path; parent directories will be created if they do not exist.
 */
 function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source file not found: ${src}`);
  }
   fs.mkdirSync(path.dirname(dest), { recursive: true });
   fs.copyFileSync(src, dest);
 }
try {
function copyForBrowser(targetDir, browser) {
  const mappings = [
    ['dist/shared/popup.js', 'popup.js'],
    [`dist/${browser}/background.js`, 'background.js'],
    ['dist/shared/query-lens.js', 'query-lens.js'],
    ['dist/shared/popup-init.js', 'popup-init.js'],
    ['src/shared/popup.html', 'popup.html'],
    ['src/shared/styles.css', 'styles.css'],
    ...(browser === 'safari' ? [['src/safari/styles.css', 'browser-styles.css']] : []),
    ['src/shared/icons/icon16.png', 'icon16.png'],
    ['src/shared/icons/icon48.png', 'icon48.png'],
    ['src/shared/icons/icon128.png', 'icon128.png'],
    [`src/${browser}/manifest.json`, 'manifest.json']
  ];
  
  // Add Chrome-specific DevTools files
  if (browser === 'chrome') {
    mappings.push(
      [`dist/${browser}/devtools.js`, 'devtools.js'],
      [`dist/${browser}/devtools-content.js`, 'devtools-content.js'],
      [`src/${browser}/devtools.html`, 'devtools.html'],
      [`src/${browser}/devtools-content.html`, 'devtools-content.html']
    );
  }
  
  mappings.forEach(([src, dest]) => copyFile(src, path.join(targetDir, dest)));
}

// Clean and create dist directories for extensions
const chromeDir = 'dist/chrome-extension';
const safariDir = 'dist/safari-extension';

if (fs.existsSync(chromeDir)) fs.rmSync(chromeDir, { recursive: true });
if (fs.existsSync(safariDir)) fs.rmSync(safariDir, { recursive: true });

fs.mkdirSync(chromeDir, { recursive: true });
fs.mkdirSync(safariDir, { recursive: true });

// Verify TypeScript outputs exist
const requiredDirs = ['dist/chrome', 'dist/safari', 'dist/shared'];
for (const dir of requiredDirs) {
  if (!fs.existsSync(dir)) {
    throw new Error(`TypeScript compilation output not found: ${dir}. Run 'npm run build:ts' first.`);
  }
}

copyForBrowser(chromeDir, 'chrome');
copyForBrowser(safariDir, 'safari');

// Clean up TypeScript compilation artifacts
if (fs.existsSync('dist/chrome')) fs.rmSync('dist/chrome', { recursive: true });
if (fs.existsSync('dist/safari')) fs.rmSync('dist/safari', { recursive: true });
if (fs.existsSync('dist/shared')) fs.rmSync('dist/shared', { recursive: true });

console.log('Build completed successfully!');
console.log('Chrome extension: dist/chrome-extension/');
console.log('Safari extension: dist/safari-extension/');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}