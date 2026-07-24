const fs = require('fs');
let lines = fs.readFileSync('src/components/chat/TrueVirtualMessageList.tsx', 'utf8').split(/\r?\n/);

let targetIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (messages.length === 0) {') && lines[i+1].includes('return (')) {
    targetIndex = i;
    break;
  }
}

if (targetIndex !== -1) {
  lines.splice(targetIndex, 3, 
    '  if (messages.length === 0) {',
    '    return (',
    '      <div className="flex-1 flex items-center justify-center p-8">',
    '        <p className="text-muted-foreground bg-background/80 px-4 py-2 rounded-full text-sm shadow-sm backdrop-blur-sm">',
    '          No messages yet. Send a message to start the conversation!',
    '        </p>',
    '      </div>',
    '    );',
    '  }'
  );
  fs.writeFileSync('src/components/chat/TrueVirtualMessageList.tsx', lines.join('\n'));
  console.log('Fixed syntax error in TrueVirtualMessageList.tsx using splice.');
} else {
  console.log('Could not find the target lines to splice.');
}
