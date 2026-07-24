const fs = require('fs');
const file = 'c:/Users/Arshid.Wani/chatrchat/src/hooks/useVirtualizedMessages.tsx';

let content = fs.readFileSync(file, 'utf8');

// First, fix the imports
content = content.replace(/import \{ useState, useCallback, useRef, useEffect \} from 'react';\nimport \{ supabase \} from '@\/integrations\/supabase\/client';\nimport \{ useState, useCallback, useRef, useEffect \} from 'react';\nimport \{ supabase \} from '@\/integrations\/supabase\/client';/, 
  "import { useState, useCallback, useRef, useEffect } from 'react';\nimport { supabase } from '@/integrations/supabase/client';");

// Next, fix any remaining broken Message interfaces
const goodInterface = `interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type?: string | null;
  media_url?: string | null;
  media_attachments?: any;
  created_at: string;
  read_at?: string | null;
  status?: string | null;
  reactions?: any;
  is_starred?: boolean;
}`;

// The file might now have:
// import ...
// interface Message { ... }
// We can just wipe out everything between imports and MESSAGES_PER_PAGE and replace it with the good interface
const importEnd = content.indexOf('import { mergeRealtimeMessage');
const importEndLine = content.indexOf('\n', importEnd) + 1;
const messagesPerPage = content.indexOf('const MESSAGES_PER_PAGE');

const newContent = content.substring(0, importEndLine) + '\n' + goodInterface + '\n\n' + content.substring(messagesPerPage);

fs.writeFileSync(file, newContent);
console.log('Fixed syntax error');
