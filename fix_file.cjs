const fs = require('fs');
const file = 'c:/Users/Arshid.Wani/chatrchat/src/hooks/useVirtualizedMessages.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove duplicate interface Message block if any
content = content.replace(/interface Message \{\s*id: string;[\s\S]*?is_starred\?: boolean;\s*\}/g, (match, offset, str) => {
    return offset === str.indexOf(match) ? match : '';
});

// Remove duplicate export const useVirtualizedMessages
content = content.replace(/export const useVirtualizedMessages = \(conversationId: string \| null, userId: string\) => \{\s*const \[messages, setMessages\] = useState<Message\[\]>\(\[\]\);/g, (match, offset, str) => {
    return offset === str.indexOf(match) ? match : '';
});

fs.writeFileSync(file, content);
console.log('Fixed');
