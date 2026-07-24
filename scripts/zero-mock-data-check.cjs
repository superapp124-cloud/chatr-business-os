/**
 * CHATR Core — Genesis Law #12 Enforcer
 * 
 * Verifies that production code does not reference mock data.
 * Run automatically in CI/CD before builds.
 */

const fs = require('fs');
const path = require('path');

const FORBIDDEN_WORDS = [
  '/mock/',
  '/fixtures/',
  '/fake/',
  '/sample/',
  '/demo/',
  '/seed/',
  '/placeholder/',
  '/lorem/',
  '/test-data/',
];

const ALLOWED_DIRECTORIES = [
  'electron/chatr-core/modules',
  'electron/chatr-core/kernel',
  'src/core',
];

function scanDirectory(dir) {
  let hasError = false;
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        hasError = scanDirectory(fullPath) || hasError;
      }
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.cjs') || fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      for (const word of FORBIDDEN_WORDS) {
        if (content.includes(word)) {
          // If the mock word is found, check if it's protected by CHATR_DEV_MOCK_MODE
          if (!content.includes('CHATR_DEV_MOCK_MODE')) {
            console.error(`❌ VIOLATION (Zero Mock Data Law): ${fullPath} contains forbidden word "${word}" without a development mock mode check.`);
            hasError = true;
          }
        }
      }
    }
  }
  
  return hasError;
}

let hasError = false;
for (const dir of ALLOWED_DIRECTORIES) {
  const targetDir = path.join(process.cwd(), dir);
  if (fs.existsSync(targetDir)) {
    hasError = scanDirectory(targetDir) || hasError;
  }
}

if (hasError) {
  console.error('\n🚨 Build failed: Zero Mock Data principle violation.');
  process.exit(1);
} else {
  console.log('✅ Zero Mock Data check passed.');
  process.exit(0);
}
