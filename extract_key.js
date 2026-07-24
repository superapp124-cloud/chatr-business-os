const fs = require("fs");
const apk = fs.readFileSync("android/app/build/outputs/apk/debug/app-debug.apk", "utf8");
const match = apk.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g);
console.log([...new Set(match)]);
