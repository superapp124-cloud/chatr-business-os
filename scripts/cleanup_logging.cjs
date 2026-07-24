const fs = require('fs');
const path = require('path');

const DIRECTORIES_TO_SCAN = ['src'];

// We only replace exact matches to avoid breaking string literals
// This is a basic AST-lite replace. In production, jscodeshift is safer.
const replaceConsoleWithLogger = (filePath) => {
  const ext = path.extname(filePath);
  if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Don't replace if it's the Logger itself
  if (filePath.includes('Logger.ts')) return;

  // Replace console.log -> Logger.info
  content = content.replace(/console\.log\(/g, 'Logger.info(');
  // Replace console.error -> Logger.error
  content = content.replace(/console\.error\(/g, 'Logger.error(');
  // Replace console.warn -> Logger.warn
  content = content.replace(/console\.warn\(/g, 'Logger.warn(');
  // Replace console.debug -> Logger.debug
  content = content.replace(/console\.debug\(/g, 'Logger.debug(');

  if (content !== originalContent) {
    // Check if Logger import is present, if not, add it
    if (!content.includes('import { Logger } from')) {
      content = `import { Logger } from '@/runtime/Logger';\n` + content;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.info(`[Cleanup] Replaced logging in ${filePath}`);
  }
};

const walkSync = (dir, callback) => {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      walkSync(filepath, callback);
    } else if (stats.isFile()) {
      callback(filepath);
    }
  });
};

console.log('Starting Production Logging Cleanup...');
DIRECTORIES_TO_SCAN.forEach(dir => {
  walkSync(path.join(__dirname, '..', dir), replaceConsoleWithLogger);
});
console.log('Cleanup complete.');
