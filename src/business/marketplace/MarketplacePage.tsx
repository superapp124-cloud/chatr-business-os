import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Download, Star, Loader2, CheckCircle, Package, Globe, Building } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Listing {
 id: string;
 name: string;
 description: string;
 asset_type: string;
 author: string;
 downloads: number;
 avg_rating: number;
 version: string;
 listing_type: 'internal' | 'public';
}

export default function Marketplace() {
 const [listings, setListings] = useState<Listing[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const [installingId, setInstallingId] = useState<string | null>(null);

 useEffect(() => {
 fetchListings();
 }, []);

 const fetchListings = async () => {
 try {
 // Fetch both public and internal approved listings
 const { data, error } = await supabase
 .from('marketplace_listings')
 .select('*')
 .eq('status', 'listed')
 .order('downloads', { ascending: false });

 if (error) throw error;
 setListings((data || []) as Listing[]);
 } catch (err) {
 console.error('Error fetching marketplace:', err);
 } finally {
 setLoading(false);
 }
 };

 const handleInstall = async (listingId: string) => {
 setInstallingId(listingId);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error('Not authenticated');

 // Install it to marketplace_installs in 'quarantined' state pending admin approval
 // In a real app, we'd need the tenant_id, but we'll mock it or omit it for this demo
 const { error } = await supabase
 .from('marketplace_installs')
 .insert({
 listing_id: listingId,
 installed_by: user.id,
 tenant_id: user.id, // Fallback for demo
 version: '1.0.0', // Should grab from listing
 status: 'quarantined' // Phase 5 Governance requirement
 });

 if (error && error.code !== '23505') throw error; // Ignore unique constraint if already installed
 
 alert('Plugin installed and quarantined. Pending Admin approval.');
 } catch (err: any) {
 console.error('Install failed:', err.message);
 alert('Failed to install plugin: ' + err.message);
 } finally {
 setInstallingId(null);
 }
 };

 const getIconForType = (type: string) => {
 switch (type) {
 case 'plugin': return <Package className="w-4 h-4" />;
 case 'connector': return <Globe className="w-4 h-4" />;
 default: return <Package className="w-4 h-4" />;
 }
 };

 const filteredListings = listings.filter(l => 
 l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
 l.description?.toLowerCase().includes(searchQuery.toLowerCase())
 );

 return (
 <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
 <div className="max-w-7xl mx-auto space-y-6">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div>
 <h1 className="text-page font-bold tracking-tight">Marketplace</h1>
 <p className="text-secondary text-slate-400 mt-1">Discover and install plugins, connectors, and workflow templates.</p>
 </div>
 <div className="relative w-full md:w-72">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
 <Input 
 placeholder="Search assets..." 
 className="pl-9 bg-slate-900 border-slate-800 text-slate-200 w-full"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 </div>

 <Tabs defaultValue="all" className="w-full">
 <TabsList className="bg-slate-900 border border-slate-800">
 <TabsTrigger value="all">All Assets</TabsTrigger>
 <TabsTrigger value="internal" className="flex items-center gap-2">
 <Building className="w-3.5 h-3.5" />
 Internal Org
 </TabsTrigger>
 <TabsTrigger value="public" className="flex items-center gap-2">
 <Globe className="w-3.5 h-3.5" />
 Public Community
 </TabsTrigger>
 </TabsList>

 <TabsContent value="all" className="mt-6">
 {loading ? (
 <div className="flex h-64 items-center justify-center">
 <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
 </div>
 ) : filteredListings.length === 0 ? (
 <div className="text-center py-20 bg-slate-900/40 rounded-xl border border-slate-800 border-dashed">
 <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
 <h3 className="text-section font-medium text-slate-300">No assets found</h3>
 <p className="text-slate-500 text-secondary mt-1">Try adjusting your search criteria</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
 {filteredListings.map(listing => (
 <Card key={listing.id} className="bg-slate-900/60 border-slate-800 flex flex-col">
 <CardHeader className="pb-3">
 <div className="flex justify-between items-start mb-2">
 <div className={`p-2 rounded-lg ${listing.listing_type === 'internal' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
 {getIconForType(listing.asset_type)}
 </div>
 <Badge variant="outline" className="bg-slate-800 border-slate-700 text-slate-300 font-normal">
 {listing.asset_type}
 </Badge>
 </div>
 <CardTitle className="text-body line-clamp-1">{listing.name}</CardTitle>
 <CardDescription className="text-label line-clamp-1">by {listing.author}</CardDescription>
 </CardHeader>
 <CardContent className="flex-grow">
 <p className="text-secondary text-slate-400 line-clamp-3">{listing.description}</p>
 </CardContent>
 <CardFooter className="flex items-center justify-between border-t border-slate-800 pt-4 pb-4">
 <div className="flex items-center gap-3 text-label text-slate-500">
 <div className="flex items-center gap-1">
 <Download className="w-3.5 h-3.5" />
 {listing.downloads}
 </div>
 <div className="flex items-center gap-1">
 <Star className="w-3.5 h-3.5 text-amber-400" />
 {listing.avg_rating.toFixed(1)}
 </div>
 </div>
 <Button 
 size="sm" 
 variant="secondary"
 className="bg-slate-800 hover:bg-slate-700 text-slate-200"
 disabled={installingId === listing.id}
 onClick={() => handleInstall(listing.id)}
 >
 {installingId === listing.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : 'Install'}
 </Button>
 </CardFooter>
 </Card>
 ))}
 </div>
 )}
 </TabsContent>
 
 {/* Implement Internal and Public tabs similarly in a real app, just filtering the listings array */}
 <TabsContent value="internal" className="mt-6">
 <div className="text-center py-20 text-slate-500">Filtered Internal view</div>
 </TabsContent>
 
 <TabsContent value="public" className="mt-6">
 <div className="text-center py-20 text-slate-500">Filtered Public view</div>
 </TabsContent>
 </Tabs>
 </div>
 </div>
 );
}
