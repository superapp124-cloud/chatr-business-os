import React, { useState } from 'react';
import { Terminal, Key, Webhook, BookOpen, ExternalLink, ShieldCheck, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useDeveloperHub } from '@/hooks/useDeveloperHub';
import { toast } from 'sonner';

export default function DeveloperHub() {
 const { apiKeys, webhooks, isLoading, generateApiKey, createWebhook } = useDeveloperHub();
 const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);

 const handleGenerateKey = async () => {
 const rawKey = await generateApiKey('Production API Key');
 if (rawKey) {
 setNewKeyRaw(rawKey);
 }
 };

 const handleCreateWebhook = async () => {
 await createWebhook('New Integration', 'https://api.yourdomain.com/webhooks/chatr', ['customer.created', 'invoice.paid']);
 };

 const copyToClipboard = (text: string) => {
 navigator.clipboard.writeText(text);
 toast.success('Copied to clipboard');
 };

 return (
 <div className="h-full bg-gray-50 dark:bg-[#0B0F19] overflow-y-auto">
 <div className="max-w-7xl mx-auto px-6 py-8">
 <div className="flex items-center justify-between mb-8">
 <div>
 <h1 className="text-display text-gray-900 dark:text-white flex items-center gap-3">
 <Terminal className="h-8 w-8 text-primary" />
 Developer Hub
 </h1>
 <p className="text-gray-500 dark:text-white/60 mt-2">
 API Keys, Webhooks, and SDKs for building custom integrations.
 </p>
 </div>
 <Button className="bg-primary hover:bg-primary/90 text-white">
 <BookOpen className="w-4 h-4 mr-2" />
 Read Documentation
 </Button>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 {/* API Keys */}
 <Card className="dark:bg-black/20 border-gray-200 dark:border-white/10">
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Key className="w-5 h-5 text-amber-500" />
 API Keys
 </CardTitle>
 <CardDescription>Generate keys to authenticate your API requests.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {newKeyRaw && (
 <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl mb-4">
 <p className="text-secondary font-semibold text-emerald-800 dark:text-emerald-400 mb-2">Save this key now! It will not be shown again.</p>
 <div className="flex items-center gap-2">
 <Input readOnly value={newKeyRaw} className="font-mono bg-white dark:bg-black/40" />
 <Button variant="outline" onClick={() => copyToClipboard(newKeyRaw)}>Copy</Button>
 </div>
 </div>
 )}

 {isLoading ? (
 <div className="text-secondary text-gray-500 text-center py-4">Loading keys...</div>
 ) : apiKeys.length === 0 ? (
 <div className="text-secondary text-gray-500 text-center py-4">No API keys generated yet.</div>
 ) : (
 apiKeys.map((key) => (
 <div key={key.id} className="p-4 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 flex items-center justify-between">
 <div>
 <div className="font-semibold text-gray-900 dark:text-white">{key.name}</div>
 <div className="text-secondary text-gray-500 font-mono mt-1">pk_live_************************</div>
 </div>
 <div className="flex gap-2">
 <Badge variant="outline" className="border-emerald-500 text-emerald-500 bg-emerald-500/10">Active</Badge>
 <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">Revoke</Button>
 </div>
 </div>
 ))
 )}
 <Button onClick={handleGenerateKey} variant="outline" className="w-full border-dashed">
 <Plus className="w-4 h-4 mr-2" /> Generate New Key
 </Button>
 </CardContent>
 </Card>

 {/* Webhooks */}
 <Card className="dark:bg-black/20 border-gray-200 dark:border-white/10">
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Webhook className="w-5 h-5 text-blue-500" />
 Webhooks
 </CardTitle>
 <CardDescription>Listen for real-time events on the Event Bus.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {isLoading ? (
 <div className="text-secondary text-gray-500 text-center py-4">Loading webhooks...</div>
 ) : webhooks.length === 0 ? (
 <div className="text-secondary text-gray-500 text-center py-4">No webhooks configured yet.</div>
 ) : (
 webhooks.map((webhook) => (
 <div key={webhook.id} className="p-4 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
 <div className="flex items-center justify-between mb-2">
 <div className="font-semibold text-gray-900 dark:text-white">{webhook.name}</div>
 <Badge variant="outline" className={webhook.is_active ? "border-emerald-500 text-emerald-500 bg-emerald-500/10" : "border-gray-500 text-gray-500 bg-gray-500/10"}>
 {webhook.is_active ? 'Active' : 'Disabled'}
 </Badge>
 </div>
 <div className="text-secondary text-gray-500 dark:text-white/60 mb-2 truncate">
 {webhook.endpoint_url}
 </div>
 <div className="flex gap-2 mt-3 flex-wrap">
 {webhook.events.map((evt, idx) => (
 <Badge key={idx} variant="secondary" className="bg-gray-200 dark:bg-white/10">{evt}</Badge>
 ))}
 </div>
 </div>
 ))
 )}
 <Button onClick={handleCreateWebhook} variant="outline" className="w-full border-dashed">
 <Plus className="w-4 h-4 mr-2" /> Add Endpoint
 </Button>
 </CardContent>
 </Card>
 </div>
 </div>
 </div>
 );
}
