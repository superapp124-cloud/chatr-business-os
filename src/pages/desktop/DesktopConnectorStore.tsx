import React, { useState, useEffect } from 'react';
import { Search, Filter, Star, Download, Sparkles, Building, Stethoscope, Briefcase, Boxes, ShieldCheck, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface ConnectorManifest {
 id: string;
 name: string;
 category: string;
 certification: 'VERIFIED' | 'COMMUNITY' | 'ENTERPRISE';
 version: string;
 downloads: number;
}

export default function DesktopConnectorStore() {
 const [searchQuery, setSearchQuery] = useState('');
 const [connectors, setConnectors] = useState<ConnectorManifest[]>([]);
 const [loading, setLoading] = useState(true);
 const [installing, setInstalling] = useState<Record<string, boolean>>({});
 const [installed, setInstalled] = useState<Record<string, boolean>>({});

 useEffect(() => {
 fetchCatalog();
 }, []);

 const fetchCatalog = async () => {
 setLoading(true);
 const api = (window as any).electronAPI;
 if (api && api.invoke) {
 const catalog = await api.invoke('marketplace:get-catalog');
 setConnectors(catalog || []);
 } else {
 // Fallback mock
 setConnectors([
 { id: 'irctc', name: 'IRCTC', category: 'Travel', certification: 'VERIFIED', version: '1.2.0', downloads: 145000 },
 { id: 'zomato', name: 'Zomato', category: 'Food', certification: 'VERIFIED', version: '2.0.1', downloads: 890000 },
 { id: 'practo', name: 'Practo', category: 'Healthcare', certification: 'COMMUNITY', version: '1.0.5', downloads: 34000 },
 { id: 'uidai', name: 'UIDAI', category: 'Government', certification: 'ENTERPRISE', version: '3.1.0', downloads: 5000000 },
 ]);
 }
 setLoading(false);
 };

 const handleInstall = async (id: string) => {
 setInstalling(prev => ({ ...prev, [id]: true }));
 const api = (window as any).electronAPI;
 if (api && api.invoke) {
 await api.invoke('marketplace:install', { manifest: { id } });
 } else {
 await new Promise(resolve => setTimeout(resolve, 1500)); // mock
 }
 setInstalling(prev => ({ ...prev, [id]: false }));
 setInstalled(prev => ({ ...prev, [id]: true }));
 };

 const getCategoryIcon = (category: string) => {
 switch(category) {
 case 'Travel': return <Briefcase className="w-8 h-8 text-blue-500" />;
 case 'Government': return <Building className="w-8 h-8 text-slate-700" />;
 case 'Healthcare': return <Stethoscope className="w-8 h-8 text-red-500" />;
 default: return <Boxes className="w-8 h-8 text-[#5c22ff]" />;
 }
 };

 const getCertificationBadge = (cert: string) => {
 switch(cert) {
 case 'VERIFIED': return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><ShieldCheck className="w-3 h-3 mr-1"/> Verified</Badge>;
 case 'ENTERPRISE': return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20"><Building className="w-3 h-3 mr-1"/> Enterprise</Badge>;
 case 'COMMUNITY': return <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20">Community</Badge>;
 default: return null;
 }
 };

 return (
 <div className="flex flex-col h-full bg-background text-foreground overflow-y-auto">
 <div className="p-8">
 <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
 <div>
 <h1 className="text-display tracking-tight mb-2">Connector Store</h1>
 <p className="text-muted-foreground">Enhance CHATR OS with declarative integrations.</p>
 </div>
 
 <div className="flex items-center gap-3 w-full sm:w-auto">
 <div className="relative flex-1 sm:w-64">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input
 placeholder="Search connectors..."
 className="pl-9 bg-card border-border"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 <Button variant="outline" className="border-border">
 <Filter className="w-4 h-4 mr-2" /> Filter
 </Button>
 </div>
 </div>

 {loading ? (
 <div className="flex items-center justify-center py-20">
 <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
 {connectors.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(connector => (
 <Card key={connector.id} className="p-6 bg-card border-border hover:border-primary/50 transition-all flex flex-col h-full">
 <div className="flex items-start justify-between mb-4">
 <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border flex items-center justify-center shadow-inner">
 {getCategoryIcon(connector.category)}
 </div>
 {getCertificationBadge(connector.certification)}
 </div>
 
 <h3 className="font-semibold text-section mb-1">{connector.name}</h3>
 <p className="text-secondary text-muted-foreground mb-4">Version {connector.version}</p>
 
 <div className="flex items-center gap-4 text-secondary text-muted-foreground mb-6">
 <div className="flex items-center gap-1">
 <Download className="w-4 h-4" />
 <span>{(connector.downloads / 1000).toFixed(1)}k</span>
 </div>
 <div className="flex items-center gap-1">
 <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
 <span>4.8</span>
 </div>
 </div>
 
 <div className="mt-auto pt-4 border-t border-border">
 {installed[connector.id] ? (
 <Button variant="secondary" className="w-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" disabled>
 <CheckCircle className="w-4 h-4 mr-2" /> Installed
 </Button>
 ) : (
 <Button 
 className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" 
 onClick={() => handleInstall(connector.id)}
 disabled={installing[connector.id]}
 >
 {installing[connector.id] ? 'Installing...' : 'Install'}
 </Button>
 )}
 </div>
 </Card>
 ))}
 </div>
 )}
 </div>
 </div>
 );
}
