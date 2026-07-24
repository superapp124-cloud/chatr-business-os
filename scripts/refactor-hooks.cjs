const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  if (content.includes("from '@/core/os/GlobalIntentProvider'")) {
    content = content.replace(/import \{([^}]*?)useCHATROS([^}]*?)\} from '@\/core\/os\/GlobalIntentProvider';/g, "import { useCHATROS } from '@/core/os/hooks';");
    modified = true;
  }
  
  if (content.includes("from '@/components/ChatrOSProvider'")) {
    content = content.replace(/import \{([^}]*?)useChatrOS([^}]*?)\} from '@\/components\/ChatrOSProvider';/g, "import { useChatrOS } from '@/core/os/hooks';");
    modified = true;
  }
  
  if (content.includes("from '@/components/NativeAppProvider'")) {
    content = content.replace(/import \{([^}]*?)useNativeApp([^}]*?)\} from '@\/components\/NativeAppProvider';/g, "import { useNativeApp } from '@/core/os/hooks';");
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});
