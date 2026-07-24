import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Folder as FolderIcon } from 'lucide-react';
import { useChatFolders } from '@/hooks/useChatFolders';
import { supabase } from '@/integrations/supabase/client';
import { AppleButton, AppleIconButton } from '@/components/ui/AppleButton';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function ChatFoldersSettings() {
 const navigate = useNavigate();
 const [userId, setUserId] = useState<string | undefined>();
 const { folders, createFolder, deleteFolder, loading } = useChatFolders(userId);
 const [newFolderName, setNewFolderName] = useState('');
 const [isCreating, setIsCreating] = useState(false);

 React.useEffect(() => {
 supabase.auth.getUser().then(({ data: { user } }) => {
 setUserId(user?.id);
 });
 }, []);

 const handleCreateFolder = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!newFolderName.trim()) return;
 
 setIsCreating(true);
 await createFolder(newFolderName.trim());
 setNewFolderName('');
 setIsCreating(false);
 };

 return (
 <div className="flex flex-col h-full bg-background animate-in fade-in slide-in-from-right-4 duration-300">
 {/* Header */}
 <div className="flex items-center p-4 border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-xl z-10">
 <AppleIconButton
 variant="ghost"
 icon={<ArrowLeft className="w-6 h-6" />}
 onClick={() => navigate('/settings')}
 />
 <h1 className="text-workspace ml-2 flex-1">Chat Folders</h1>
 </div>

 <div className="p-4 space-y-6 overflow-y-auto">
 <div className="text-center py-6 px-4">
 <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
 <FolderIcon className="w-8 h-8 text-primary" />
 </div>
 <h2 className="text-section font-bold mb-2">Organize your chats</h2>
 <p className="text-secondary text-muted-foreground">
 Create folders to group your chats, such as "Work" or "Family". They will appear as tabs at the top of your chat list.
 </p>
 </div>

 <Card className="p-4">
 <form onSubmit={handleCreateFolder} className="flex gap-2">
 <Input
 value={newFolderName}
 onChange={(e) => setNewFolderName(e.target.value)}
 placeholder="Folder name (e.g. Work)"
 className="flex-1"
 />
 <AppleButton 
 type="submit" 
 variant="primary" 
 disabled={isCreating || !newFolderName.trim()}
 icon={<Plus className="w-4 h-4" />}
 >
 Add
 </AppleButton>
 </form>
 </Card>

 <div>
 <h3 className="font-semibold text-secondary text-muted-foreground uppercase tracking-wider mb-3 px-1">
 Your Folders
 </h3>
 {loading ? (
 <div className="flex justify-center p-4">
 <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
 </div>
 ) : folders.length === 0 ? (
 <p className="text-secondary text-muted-foreground text-center p-4 bg-muted/30 rounded-xl">
 No folders yet. Create one above!
 </p>
 ) : (
 <div className="space-y-2">
 {folders.map(folder => (
 <Card key={folder.id} className="p-4 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="bg-primary/10 p-2 rounded-lg">
 <FolderIcon className="w-5 h-5 text-primary" />
 </div>
 <span className="font-medium">{folder.name}</span>
 </div>
 <AppleIconButton
 variant="ghost"
 className="text-destructive hover:bg-destructive/10"
 icon={<Trash2 className="w-5 h-5" />}
 onClick={() => {
 if (confirm(`Delete folder "${folder.name}"?`)) {
 deleteFolder(folder.id);
 }
 }}
 />
 </Card>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
