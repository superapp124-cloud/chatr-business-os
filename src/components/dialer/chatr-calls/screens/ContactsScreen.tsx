import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, UserPlus, RefreshCw, Phone, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { syncContacts } from '@/utils/contactSync';
import '../calls.css';

interface DeviceContact {
 id: string;
 name: string;
 phone: string;
 avatar?: string;
 isOnChatr: boolean;
 chatrUserId?: string;
 isOnline?: boolean;
}

function readNativeContacts(limit = 500): DeviceContact[] {
 if (!window.ChatrNativeRuntime?.getDeviceContacts) return [];

 try {
 const raw = window.ChatrNativeRuntime.getDeviceContacts(limit);
 const contacts = JSON.parse(raw || '[]');
 if (!Array.isArray(contacts)) return [];

 return contacts.map((contact: any) => ({
 id: contact.id || contact.normalized_number || contact.contact_phone,
 name: contact.contact_name || contact.displayName || 'Unknown',
 phone: contact.normalized_number || contact.contact_phone || contact.phone_number || '',
 avatar: contact.photo_uri || undefined,
 isOnChatr: false,
 isOnline: false,
 }));
 } catch (error) {
 console.warn('[ContactsScreen] Native contacts unavailable:', error);
 return [];
 }
}

const ContactsScreen: React.FC = () => {
 const navigate = useNavigate();
 const [contacts, setContacts] = useState<DeviceContact[]>([]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);

 const loadContacts = useCallback(async (isRefresh = false) => {
 try {
 if (isRefresh) setRefreshing(true);
 else setLoading(true);

 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 setCurrentUserId(user.id);

 // Load synced contacts from DB
 const { data: dbContacts, error } = await supabase
 .from('contacts')
 .select(`
 id,
 contact_name,
 contact_phone,
 contact_user_id,
 is_registered,
 profiles:contact_user_id (
 id,
 username,
 avatar_url,
 is_online
 )
 `)
 .eq('user_id', user.id)
 .order('contact_name');

 if (error) throw error;

 const mapped: DeviceContact[] = (dbContacts || []).map((c: any) => ({
 id: c.id,
 name: c.profiles?.username || c.contact_name || 'Unknown',
 phone: c.contact_phone || '',
 avatar: c.profiles?.avatar_url,
 isOnChatr: !!c.is_registered,
 chatrUserId: c.contact_user_id,
 isOnline: c.profiles?.is_online,
 }));

 setContacts(mapped.length > 0 ? mapped : readNativeContacts());
 } catch (err) {
 console.error('[ContactsScreen] Error:', err);
 const nativeContacts = readNativeContacts();
 setContacts(nativeContacts);
 if (nativeContacts.length === 0) toast.error('Could not load contacts');
 } finally {
 setLoading(false);
 setRefreshing(false);
 }
 }, []);

 useEffect(() => {
 loadContacts();
 }, [loadContacts]);

 const handleSyncContacts = useCallback(async () => {
 try {
 setRefreshing(true);
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 if (!Capacitor.isNativePlatform()) {
 toast.info('Contact sync is available in the mobile app');
 await loadContacts(true);
 return;
 }

 window.ChatrNativeRuntime?.requestContactsPermission?.();
 const count = await syncContacts(user.id);
 window.dispatchEvent(new CustomEvent('chatr:contacts-synced', { detail: { count } }));
 toast.success(`Synced ${count} contacts`);
 await loadContacts(true);
 } catch (error: any) {
 console.error('[ContactsScreen] Sync error:', error);
 const nativeContacts = readNativeContacts();
 if (nativeContacts.length > 0) {
 setContacts(nativeContacts);
 toast.success(`Loaded ${nativeContacts.length} device contacts`);
 } else {
 toast.error(error?.message || 'Could not sync contacts');
 }
 } finally {
 setRefreshing(false);
 }
 }, [loadContacts]);

 const filtered = useMemo(() => {
 const q = searchQuery.toLowerCase().trim();
 if (!q) return contacts;
 return contacts.filter(
 c => c.name.toLowerCase().includes(q) || c.phone.includes(q)
 );
 }, [contacts, searchQuery]);

 // Group contacts alphabetically
 const grouped = useMemo(() => {
 const groups: Record<string, DeviceContact[]> = {};
 filtered.forEach(c => {
 const letter = c.name[0]?.toUpperCase() || '#';
 const key = /[A-Z]/.test(letter) ? letter : '#';
 if (!groups[key]) groups[key] = [];
 groups[key].push(c);
 });
 return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
 }, [filtered]);

 const handleCallContact = async (contact: DeviceContact) => {
 if (!contact.chatrUserId) {
 toast.info(`${contact.name} is not on Chatr yet`);
 return;
 }
 // Navigate to calls with the contact pre-selected
 navigate('/calls', { state: { callUserId: contact.chatrUserId, callName: contact.name } });
 };

 const handleMessageContact = async (contact: DeviceContact) => {
 if (!contact.chatrUserId) {
 toast.info(`${contact.name} is not on Chatr yet`);
 return;
 }
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { data: convId } = await supabase.rpc('create_direct_conversation', {
 other_user_id: contact.chatrUserId
 });
 if (convId) navigate(`/chat/${convId}`);
 } catch {
 toast.error('Could not open chat');
 }
 };

 const getInitials = (name: string) =>
 name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

 return (
 <div className="screen-container">
 {/* Header */}
 <div className="flex justify-between items-center mt-10 mb-2 px-4">
 <span className="text-[var(--dialer-text-secondary)] text-secondary font-medium">
 {contacts.length} contacts
 </span>
 <button
 className="text-[var(--dialer-primary)]"
 onClick={() => navigate('/contacts')}
 >
 <UserPlus size={22} />
 </button>
 </div>

 <h1 className="large-title px-4">Contacts</h1>

 {/* Search */}
 <div className="search-bar mx-4 mb-4">
 <Search size={18} className="text-zinc-500" />
 <input
 type="text"
 placeholder="Search contacts"
 className="search-input"
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 />
 {refreshing && <RefreshCw size={16} className="text-zinc-500 animate-spin ml-2" />}
 </div>

 {/* Refresh button */}
 <button
 className="flex items-center gap-2 text-[var(--dialer-primary)] text-button mx-4 mb-4 active:opacity-70 transition-opacity"
 onClick={handleSyncContacts}
 disabled={refreshing}
 >
 <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
 Sync contacts
 </button>

 {loading ? (
 <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
 <RefreshCw className="animate-spin mb-3" size={28} />
 <p className="text-secondary">Loading contacts...</p>
 </div>
 ) : grouped.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-24 text-zinc-500 px-8 text-center">
 <div className="w-16 h-16 rounded-full bg-zinc-800/60 flex items-center justify-center mb-4">
 <UserPlus size={28} className="text-zinc-500" />
 </div>
 <p className="text-body font-semibold text-zinc-300 mb-1">No contacts yet</p>
 <p className="text-secondary text-zinc-500">
 {searchQuery ? 'No contacts match your search.' : 'Sync your phone contacts to see who\'s on Chatr.'}
 </p>
 {!searchQuery && (
 <button
 className="mt-4 px-5 py-2.5 rounded-xl text-button font-semibold text-white"
 style={{ background: 'var(--dialer-primary)' }}
 onClick={handleSyncContacts}
 >
 Sync Now
 </button>
 )}
 </div>
 ) : (
 <div className="contacts-list pb-24">
 {grouped.map(([letter, group]) => (
 <div key={letter}>
 {/* Section header */}
 <div className="px-4 py-1">
 <span
 className="text-label font-bold tracking-widest"
 style={{ color: 'var(--dialer-primary)' }}
 >
 {letter}
 </span>
 </div>
 {group.map(contact => (
 <div
 key={contact.id}
 className="flex items-center gap-3 px-4 py-3 active:bg-white/5 transition-colors touch-manipulation"
 style={{ borderBottom: '0.5px solid var(--dialer-border)' }}
 >
 {/* Avatar */}
 <div className="relative flex-shrink-0">
 {contact.avatar ? (
 <img
 src={contact.avatar}
 alt={contact.name}
 className="w-11 h-11 rounded-full object-cover"
 />
 ) : (
 <div
 className="w-11 h-11 rounded-full flex items-center justify-center text-secondary font-bold text-white"
 style={{
 background: contact.isOnChatr
 ? 'var(--dialer-primary)'
 : 'rgba(82,82,91,0.6)'
 }}
 >
 {getInitials(contact.name)}
 </div>
 )}
 {contact.isOnline && (
 <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-[var(--dialer-bg)]" />
 )}
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-[var(--dialer-text)] truncate">
 {contact.name}
 </p>
 <p className="text-secondary text-[var(--dialer-text-secondary)] truncate">
 {contact.isOnChatr ? (
 <span style={{ color: 'var(--dialer-primary)' }}>On Chatr</span>
 ) : (
 contact.phone
 )}
 </p>
 </div>

 {/* Actions */}
 {contact.isOnChatr && (
 <div className="flex items-center gap-1">
 <button
 className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
 style={{ background: 'rgba(255,255,255,0.06)' }}
 onClick={() => handleMessageContact(contact)}
 >
 <MessageCircle size={16} style={{ color: 'var(--dialer-primary)' }} />
 </button>
 <button
 className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
 style={{ background: 'rgba(255,255,255,0.06)' }}
 onClick={() => handleCallContact(contact)}
 >
 <Phone size={16} style={{ color: 'var(--dialer-primary)' }} />
 </button>
 </div>
 )}
 </div>
 ))}
 </div>
 ))}
 </div>
 )}
 </div>
 );
};

export default ContactsScreen;
