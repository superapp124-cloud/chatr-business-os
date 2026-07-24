import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bot, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export const BotIntegration = () => {
 const [webhookUrl, setWebhookUrl] = useState('');
 const [apiKey, setApiKey] = useState('chatr_live_xxxxxxxxxxxxxxxxxxxx');

 const handleSave = () => {
 toast.success('Webhook URL updated successfully');
 };

 const handleRegenerate = () => {
 setApiKey('chatr_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
 toast.success('API Key regenerated');
 };

 const copyToClipboard = (text: string) => {
 navigator.clipboard.writeText(text);
 toast.success('Copied to clipboard');
 };

 return (
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Bot className="w-5 h-5 text-primary" />
 Bot API Integration
 </CardTitle>
 <CardDescription>
 Build AI agents and bots using Chatr's webhooks.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <label className="text-secondary font-medium">Webhook URL</label>
 <div className="flex gap-2">
 <Input 
 placeholder="https://your-server.com/webhook" 
 value={webhookUrl}
 onChange={(e) => setWebhookUrl(e.target.value)}
 />
 <Button onClick={handleSave}>Save</Button>
 </div>
 <p className="text-label text-muted-foreground">
 We'll send POST requests here when messages are received.
 </p>
 </div>

 <div className="space-y-2 pt-4">
 <label className="text-secondary font-medium">API Key</label>
 <div className="flex gap-2">
 <Input value={apiKey} readOnly type="password" />
 <Button variant="outline" size="icon" onClick={() => copyToClipboard(apiKey)}>
 <Copy className="w-4 h-4" />
 </Button>
 <Button variant="outline" size="icon" onClick={handleRegenerate}>
 <RefreshCw className="w-4 h-4" />
 </Button>
 </div>
 <p className="text-label text-muted-foreground">
 Use this token to authenticate your bot's responses.
 </p>
 </div>
 </CardContent>
 </Card>
 );
};
