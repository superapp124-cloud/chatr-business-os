const fs = require('fs');
const file = 'src/components/calling/UnifiedCallScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `      <div 
        className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center overflow-hidden"
        style={{ 
          transform: 'translateZ(0)',
          opacity: remoteVideoActive ? 0 : 1,
          transition: 'opacity 0.3s ease',
          zIndex: 0,
        }}
      >
        {/* Ambient Blurred Background from Avatar */}
        {contactAvatar && (
          <div 
            className="absolute inset-0 w-full h-full scale-125 pointer-events-none"
            style={{ 
              backgroundImage: \`url(\${contactAvatar})\`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(50px) brightness(0.35) saturate(1.3)',
              transform: 'translateZ(0)',
            }} 
          />
        )}
        
        {/* Fallback gradient overlay to preserve contrast for text/buttons */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/90 pointer-events-none" />`;

const regex = /<div\s+className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center"\s+style=\{\{\s+transform: 'translateZ\(0\)',\s+opacity: remoteVideoActive \? 0 : 1,\s+transition: 'opacity 0\.3s ease',\s+zIndex: 0,\s+\}\}\s+>/;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully replaced');
} else {
  console.log('Target not found');
}
