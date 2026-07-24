import React, { useState } from 'react';
import { Users, Shield, ShieldCheck, Mail, Building, MapPin, Search, Plus, Key, Clock, UserCog, Filter, Lock } from 'lucide-react';
import styles from './MarketplaceLayout.module.css';

export const UserManagement: React.FC = () => {
 const [activeTab, setActiveTab] = useState('Directory');
 const [searchQuery, setSearchQuery] = useState('');

 const TABS = ['Directory', 'Teams', 'Departments', 'Permission Matrix', 'Groups'];

 const MOCK_USERS = [
 { id: '1', name: 'Sarah Jenkins', email: 'sarah.j@acmehealth.org', role: 'Administrator', department: 'IT', team: 'Platform Ops', mfa: true, aiAccess: true, lastLogin: '2 mins ago' },
 { id: '2', name: 'Dr. Robert Chen', email: 'r.chen@acmehealth.org', role: 'User', department: 'Cardiology', team: 'Clinical', mfa: true, aiAccess: false, lastLogin: '1 hour ago' },
 { id: '3', name: 'Amanda Smith', email: 'a.smith@acmehealth.org', role: 'Developer', department: 'Engineering', team: 'Integrations', mfa: false, aiAccess: true, lastLogin: '4 hours ago' },
 { id: '4', name: 'James Wilson', email: 'j.wilson@acmehealth.org', role: 'Auditor', department: 'Compliance', team: 'Risk', mfa: true, aiAccess: false, lastLogin: '1 day ago' },
 { id: '5', name: 'Elena Rodriguez', email: 'e.rodriguez@acmehealth.org', role: 'User', department: 'HR', team: 'Recruiting', mfa: true, aiAccess: true, lastLogin: '2 days ago' },
 ];

 const filteredUsers = MOCK_USERS.filter(u => 
 u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
 u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
 u.department.toLowerCase().includes(searchQuery.toLowerCase())
 );

 return (
 <div className={styles.page}>
 <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
 <div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
 <Users size={28} style={{ color: '#8b5cf6' }} />
 <h1 style={{ margin: 0 }}>Identity & Access</h1>
 </div>
 <p>Manage users, roles, teams, and enterprise security policies.</p>
 </div>
 <button className={styles.button} style={{ background: '#8b5cf6', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
 <Plus size={16} /> Invite User
 </button>
 </header>

 {/* Tabs */}
 <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem', overflowX: 'auto' }}>
 {TABS.map(tab => (
 <button
 key={tab}
 onClick={() => setActiveTab(tab)}
 style={{
 background: 'none',
 border: 'none',
 color: activeTab === tab ? '#8b5cf6' : '#94a3b8',
 padding: '0.5rem 0',
 fontSize: '1rem',
 fontWeight: activeTab === tab ? 'bold' : 'normal',
 borderBottom: activeTab === tab ? '2px solid #8b5cf6' : '2px solid transparent',
 cursor: 'pointer',
 whiteSpace: 'nowrap',
 transition: 'all 0.2s'
 }}
 >
 {tab}
 </button>
 ))}
 </div>

 {activeTab === 'Directory' && (
 <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
 {/* Toolbar */}
 <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
 <div className={styles.glassCard} style={{ flex: 1, padding: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
 <Search size={18} color="#64748b" style={{ marginLeft: '0.5rem' }} />
 <input
 type="text"
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 placeholder="Search by name, email, or department..."
 style={{
 background: 'transparent',
 border: 'none',
 color: 'white',
 width: '100%',
 outline: 'none',
 fontSize: '0.95rem'
 }}
 />
 </div>
 <button className={styles.glassCard} style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e2e8f0', cursor: 'pointer' }}>
 <Filter size={16} /> Filters
 </button>
 </div>

 {/* Data Table */}
 <div className={styles.glassCard} style={{ overflowX: 'auto', padding: 0 }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
 <thead>
 <tr style={{ background: 'rgba(15,23,42,0.6)', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
 <th style={{ padding: '1rem' }}>User</th>
 <th style={{ padding: '1rem' }}>Role</th>
 <th style={{ padding: '1rem' }}>Department & Team</th>
 <th style={{ padding: '1rem', textAlign: 'center' }}>MFA Status</th>
 <th style={{ padding: '1rem', textAlign: 'center' }}>AI Exec Access</th>
 <th style={{ padding: '1rem' }}>Last Login</th>
 <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
 </tr>
 </thead>
 <tbody>
 {filteredUsers.map((user, idx) => (
 <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s', cursor: 'pointer' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
 <td style={{ padding: '1rem' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
 <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
 {user.name.charAt(0)}
 </div>
 <div>
 <div style={{ fontWeight: '500', color: 'white' }}>{user.name}</div>
 <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{user.email}</div>
 </div>
 </div>
 </td>
 <td style={{ padding: '1rem' }}>
 <span style={{ 
 background: user.role === 'Administrator' ? 'rgba(139,92,246,0.2)' : 'rgba(148,163,184,0.1)', 
 color: user.role === 'Administrator' ? '#c4b5fd' : '#e2e8f0', 
 padding: '0.2rem 0.6rem', 
 borderRadius: '12px', 
 fontSize: '0.8rem' 
 }}>
 {user.role}
 </span>
 </td>
 <td style={{ padding: '1rem' }}>
 <div style={{ color: '#e2e8f0' }}>{user.department}</div>
 <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{user.team}</div>
 </td>
 <td style={{ padding: '1rem', textAlign: 'center' }}>
 {user.mfa ? <ShieldCheck size={18} color="#10b981" style={{ margin: '0 auto' }} /> : <Shield size={18} color="#ef4444" style={{ margin: '0 auto' }} />}
 </td>
 <td style={{ padding: '1rem', textAlign: 'center' }}>
 {user.aiAccess ? <span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>✓</span> : <span style={{ color: '#64748b' }}>-</span>}
 </td>
 <td style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
 <Clock size={14} /> {user.lastLogin}
 </div>
 </td>
 <td style={{ padding: '1rem', textAlign: 'right' }}>
 <button style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><UserCog size={18} /></button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 {filteredUsers.length === 0 && (
 <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
 No users found matching "{searchQuery}"
 </div>
 )}
 </div>
 </div>
 )}

 {activeTab !== 'Directory' && (
 <div style={{ animation: 'fadeIn 0.4s ease-out', padding: '4rem', textAlign: 'center', color: '#64748b' }}>
 <Lock size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
 <h3>{activeTab} Settings</h3>
 <p>This module is locked by your organization administrator.</p>
 </div>
 )}
 </div>
 );
};
