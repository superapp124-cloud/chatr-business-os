const fs = require('fs');

const overviewPath = 'C:\\Users\\Arshid.Wani\\.gemini\\antigravity\\brain\\5cf48059-4668-43e8-a5d0-4dd4d6d5867d\\.system_generated\\logs\\overview.txt';
if (!fs.existsSync(overviewPath)) {
  console.error('overview.txt not found');
  process.exit(1);
}

const content = fs.readFileSync(overviewPath, 'utf8');
const lines = content.split('\n');

let logcatText = '';
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('PROCESS STARTED (15879)')) {
    try {
      const data = JSON.parse(line);
      logcatText = data.content || '';
      console.log(`Found logcat at line ${i + 1}`);
      break;
    } catch (e) {
      logcatText = line;
    }
  }
}

if (!logcatText) {
  console.log('Could not find logcat in overview.txt');
  process.exit(1);
}

// Split on both actual newlines and escaped newlines '\\n'
const logLines = logcatText.split(/\\n|\n/);
console.log(`Total log lines: ${logLines.length}`);

const warningsAndErrors = [];
const timingLogs = [];
const webrtcLogs = [];

for (const line of logLines) {
  const lineLower = line.toLowerCase();
  
  // Capture timeline
  if (line.includes('IncomingCallActivity') || line.includes('ChatrConnection') || line.includes('Capacitor') || line.includes('React mount') || line.includes('reported ready') || line.includes('nativeCallAction')) {
    timingLogs.push(line);
  }
  
  // Capture WebRTC specific logs
  if (lineLower.includes('webrtc') || lineLower.includes('ice') || lineLower.includes('peerconnection') || lineLower.includes('sdp') || lineLower.includes('turn') || lineLower.includes('stun')) {
    webrtcLogs.push(line);
  }
  
  // Capture errors or warnings
  if (line.includes(' E ') || line.includes(' W ') || lineLower.includes('fail') || lineLower.includes('error') || lineLower.includes('warn') || lineLower.includes('exception')) {
    // Exclude hidden method access warnings
    if (!line.includes('Accessing hidden method') && !line.includes('Accessing hidden field')) {
      warningsAndErrors.push(line);
    }
  }
}

console.log('\n--- TIMING LOGS ---');
timingLogs.slice(0, 100).forEach(l => console.log(l));

console.log('\n--- WEBRTC LOGS ---');
webrtcLogs.slice(0, 100).forEach(l => console.log(l));

console.log('\n--- WARNINGS & ERRORS ---');
warningsAndErrors.slice(0, 100).forEach(l => console.log(l));
