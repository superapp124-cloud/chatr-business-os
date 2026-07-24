'use strict';
// Test: Headless execution
// If it runs to this point without window/document, it passes.
console.log('Running strictly headless context execution...');
require('./test_functional.cjs');
