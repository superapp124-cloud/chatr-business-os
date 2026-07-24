import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
 FileText, 
 Plus, 
 Search, 
 FileEdit,
 Trash2,
 Copy
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export const WorkspaceTemplates: React.FC = () => {
 const [isCreating, setIsCreating] = useState(false);
 const [templates, setTemplates] = useState<any[]>([
 { id: 1, name: 'Welcome Message', category: 'General', content: 'Hi {name},\n\nWelcome to our community! We are thrilled to have you here.' },
 { id: 2, name: 'Payment Reminder', category: 'Billing', content: 'Dear {name},\n\nThis is a friendly reminder that invoice {invoice_id} is due on {due_date}.' },
 { id: 3, name: 'Interview Invitation', category: 'Recruiting', content: 'Hi {name},\n\nWe would like to invite you for an interview on {date}.' }
 ]);
 const [search, setSearch] = useState('');

 if (isCreating) {
 return (
 <div className="flex-1 flex flex-col h-full bg-background p-6">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <Button variant="ghost" onClick={() => setIsCreating(false)}>← Back</Button>
 <h2 className="text-workspace font-bold">New Template</h2>
 </div>
 <Button className="bg-blue-600 hover:bg-blue-700">
 Save Template
 </Button>
 </div>

 <div className="max-w-3xl flex-1 flex flex-col gap-6">
 <div className="space-y-4 bg-card/50 p-6 rounded-2xl border border-border/50">
 <div>
 <label className="text-secondary font-medium text-slate-400 mb-1.5 block">Template Name</label>
 <Input 
 placeholder="e.g. Sales Follow-up" 
 className="bg-background/50 border-border/50"
 />
 </div>
 
 <div>
 <label className="text-secondary font-medium text-slate-400 mb-1.5 block">Category</label>
 <Input 
 placeholder="e.g. Sales, Billing, General" 
 className="bg-background/50 border-border/50"
 />
 </div>
 </div>

 <div className="flex-1 flex flex-col bg-card/50 p-6 rounded-2xl border border-border/50 relative">
 <label className="text-secondary font-medium text-slate-400 mb-3 block">Template Content</label>
 <Textarea 
 placeholder="Use {name} or {variable} to insert dynamic fields..."
 className="flex-1 resize-none bg-background/50 border-border/50 font-mono text-secondary"
 />
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="flex-1 flex flex-col h-full bg-background p-6">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="text-page font-bold">Templates</h2>
 <p className="text-secondary text-slate-400">Reusable content for broadcasts, chats, and AI.</p>
 </div>
 <div className="flex items-center gap-3">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input 
 placeholder="Search templates..." 
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="pl-9 w-64 bg-card/50"
 />
 </div>
 <Button onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-700">
 <Plus className="w-4 h-4 mr-2" /> New Template
 </Button>
 </div>
 </div>

 <ScrollArea className="flex-1">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
 {templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase())).map(template => (
 <div 
 key={template.id} 
 className="p-5 bg-card/50 border border-border/50 rounded-xl flex flex-col group relative"
 >
 <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80 hover:bg-blue-500 hover:text-white"><FileEdit className="w-4 h-4" /></Button>
 <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80 hover:bg-rose-500 hover:text-white"><Trash2 className="w-4 h-4" /></Button>
 </div>
 <Badge variant="outline" className="w-fit mb-3 bg-slate-900/50">{template.category}</Badge>
 <h3 className="font-bold text-section text-slate-200 mb-2">{template.name}</h3>
 <p className="text-secondary text-slate-400 flex-1 font-mono bg-background/50 p-3 rounded-lg border border-border/30 line-clamp-4">
 {template.content}
 </p>
 <div className="mt-4 flex justify-between items-center text-label text-slate-500">
 <span>Used 42 times</span>
 <Button variant="ghost" size="sm" className="h-6 px-2"><Copy className="w-3 h-3 mr-1" /> Copy</Button>
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>
 </div>
 );
};
