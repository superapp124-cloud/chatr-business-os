import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
 Users, 
 Search, 
 Building2, 
 MessageSquare, 
 Phone,
 Filter,
 MoreVertical,
 Briefcase,
 Megaphone
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export const WorkspaceCustomers: React.FC = () => {
 const [customers, setCustomers] = useState<any[]>([]);
 const [search, setSearch] = useState('');
 const [activeCustomer, setActiveCustomer] = useState<any | null>(null);

 useEffect(() => {
 fetchCustomers();
 }, []);

 const fetchCustomers = async () => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 // Get active workspace for user
 const { data: workspaces } = await supabase
 .from('workspaces')
 .select('id')
 .eq('owner_id', user.id)
 .limit(1);

 if (!workspaces || workspaces.length === 0) return;
 const workspaceId = workspaces[0].id;

 // Fetch customers joined with profiles
 const { data: customerRows, error } = await supabase
 .from('workspace_customers')
 .select('*, profiles!workspace_customers_profile_id_fkey(id, username, avatar_url)')
 .eq('workspace_id', workspaceId)
 .order('updated_at', { ascending: false });

 if (error) {
 console.error("Error fetching customers", error);
 return;
 }

 if (customerRows) {
 const formattedCustomers = customerRows.map(row => {
 const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
 return {
 id: row.id,
 profile_id: profile?.id,
 name: profile?.username || 'Unknown Customer',
 avatar_url: profile?.avatar_url,
 segment: row.segment || 'Lead',
 last_active: row.updated_at
 };
 });
 setCustomers(formattedCustomers);
 }
 };

 const CustomerDetailView = ({ customer }: { customer: any }) => (
 <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
 {/* Customer Header */}
 <div className="p-6 border-b border-border/50 bg-card/30 flex items-center justify-between">
 <div className="flex items-center gap-4">
 <Button variant="ghost" size="icon" onClick={() => setActiveCustomer(null)}>
 ←
 </Button>
 <Avatar className="w-14 h-14">
 <AvatarImage src={customer.avatar_url} />
 <AvatarFallback className="bg-blue-600 text-white text-section">
 {customer.name[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 <div>
 <h2 className="text-page font-bold">{customer.name} Workspace</h2>
 <div className="flex items-center gap-2 mt-1">
 <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">
 {customer.segment}
 </Badge>
 <span className="text-label text-slate-400">Last active 2 hrs ago</span>
 </div>
 </div>
 </div>
 <div className="flex gap-2">
 <Button variant="outline"><MessageSquare className="w-4 h-4 mr-2" /> Message</Button>
 <Button variant="outline"><Phone className="w-4 h-4 mr-2" /> Call</Button>
 <Button className="bg-blue-600 hover:bg-blue-700">New Deal</Button>
 </div>
 </div>

 <div className="flex-1 flex overflow-hidden">
 {/* Left Side: Overview & Timeline */}
 <div className="flex-1 border-r border-border/50 flex flex-col">
 <ScrollArea className="flex-1 p-6">
 <h3 className="text-secondary font-semibold text-slate-400 uppercase tracking-wider mb-4">Unified Timeline</h3>
 <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 dark:before:via-slate-700 before:to-transparent">
 {/* Timeline Items Mock */}
 <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
 <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-emerald-500 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
 <MessageSquare className="w-4 h-4" />
 </div>
 <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
 <div className="flex items-center justify-between space-x-2 mb-1">
 <div className="font-bold text-slate-900 dark:text-slate-100">Broadcast Reply</div>
 <time className="font-medium text-label text-slate-500">Just now</time>
 </div>
 <div className="text-slate-500 dark:text-slate-400 text-secondary">Customer replied to "Summer Sale Announcement".</div>
 </div>
 </div>
 
 <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
 <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
 <Megaphone className="w-4 h-4" />
 </div>
 <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
 <div className="flex items-center justify-between space-x-2 mb-1">
 <div className="font-bold text-slate-900 dark:text-slate-100">Broadcast Sent</div>
 <time className="font-medium text-label text-slate-500">2 hrs ago</time>
 </div>
 <div className="text-slate-500 dark:text-slate-400 text-secondary">Targeted segment: Leads.</div>
 </div>
 </div>
 </div>
 </ScrollArea>
 </div>

 {/* Right Side: Operational Widgets */}
 <div className="w-80 bg-card/30 flex flex-col p-4 space-y-6">
 <div>
 <h3 className="text-secondary font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
 <Briefcase className="w-4 h-4" /> Active Deals
 </h3>
 <div className="p-3 bg-background rounded-lg border border-border/50 cursor-pointer hover:border-slate-600 transition-colors">
 <div className="flex justify-between items-start mb-2">
 <p className="font-medium text-secondary">Enterprise License</p>
 <Badge variant="secondary" className="text-[10px]">Negotiation</Badge>
 </div>
 <p className="text-section font-bold text-emerald-400">$4,500</p>
 </div>
 </div>
 
 <div>
 <h3 className="text-secondary font-semibold text-slate-400 uppercase tracking-wider mb-3">AI Intelligence</h3>
 <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-lg">
 <p className="text-secondary text-blue-100/80 mb-3">
 <strong className="text-blue-400 block mb-1">Next Best Action</strong>
 High probability of closing (78%). Customer showed interest in Summer Sale.
 </p>
 <div className="space-y-2">
 <Button size="sm" variant="secondary" className="w-full justify-start">✓ Send Proposal</Button>
 <Button size="sm" variant="secondary" className="w-full justify-start">✓ Schedule Follow-up Call</Button>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );

 if (activeCustomer) {
 return <CustomerDetailView customer={activeCustomer} />;
 }

 return (
 <div className="flex-1 flex flex-col h-full bg-background p-6">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h2 className="text-page font-bold">Customer Workspaces</h2>
 <p className="text-secondary text-slate-400">Manage all entities and their unified history</p>
 </div>
 <div className="flex items-center gap-3">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input 
 placeholder="Search customers..." 
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="pl-9 w-64 bg-card/50"
 />
 </div>
 <Button variant="outline" size="icon"><Filter className="w-4 h-4" /></Button>
 <Button className="bg-blue-600 hover:bg-blue-700">Add Customer</Button>
 </div>
 </div>

 <div className="flex gap-2 mb-6">
 {['All', 'VIP', 'Leads', 'Pending Payments', 'Suppliers'].map(tag => (
 <Badge key={tag} variant="secondary" className="cursor-pointer hover:bg-slate-800 px-3 py-1 text-secondary">{tag}</Badge>
 ))}
 </div>

 <ScrollArea className="flex-1">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
 {customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(customer => (
 <div 
 key={customer.id} 
 onClick={() => setActiveCustomer(customer)}
 className="p-5 bg-card/50 border border-border/50 rounded-xl hover:bg-card hover:border-blue-500/30 transition-all cursor-pointer group"
 >
 <div className="flex justify-between items-start mb-4">
 <Avatar className="w-12 h-12">
 <AvatarImage src={customer.avatar_url} />
 <AvatarFallback className="bg-slate-800 text-slate-300">
 {customer.name[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 <Button variant="ghost" size="icon" className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity">
 <MoreVertical className="w-4 h-4" />
 </Button>
 </div>
 <h3 className="font-bold text-section text-slate-200 mb-1 truncate">{customer.name}</h3>
 <div className="flex items-center justify-between mt-3">
 <Badge variant="outline" className="text-label bg-slate-900/50">{customer.segment}</Badge>
 <span className="text-label text-slate-500">Updated today</span>
 </div>
 </div>
 ))}
 
 {customers.length === 0 && (
 <div className="col-span-full text-center py-20 bg-card/30 rounded-2xl border border-dashed border-border/50">
 <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
 <h3 className="text-section font-medium">No Customers Found</h3>
 <p className="text-slate-400 text-secondary max-w-md mx-auto mb-4">
 Your customer workspaces will appear here once you connect with users.
 </p>
 </div>
 )}
 </div>
 </ScrollArea>
 </div>
 );
};
