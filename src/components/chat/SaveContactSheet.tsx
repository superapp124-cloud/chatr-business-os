import React, { useState } from 'react';

interface SaveContactSheetProps {
 contact: any;
 onSave: (updatedContact: any) => void;
 onClose: () => void;
}

export function formatPhone(raw: string | undefined | null) {
 if (!raw) return 'Unknown Number';
 const digits = raw.replace(/\D/g, '');
 if (!digits) return 'Unknown Number';
 if (digits.length === 12 && digits.startsWith('91')) {
 return '+' + digits.slice(0, 2) + ' ' + digits.slice(2, 7) + ' ' + digits.slice(7);
 }
 if (digits.length === 10) {
 return '+91 ' + digits.slice(0, 5) + ' ' + digits.slice(5);
 }
 return '+' + digits;
}

export function SaveContactSheet({ contact, onSave, onClose }: SaveContactSheetProps) {
 const [firstName, setFirstName] = useState('');
 const [lastName, setLastName] = useState('');

 const handleSave = () => {
 if (!firstName.trim()) return;
 onSave({
 ...contact,
 contact_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
 username: `${firstName.trim()} ${lastName.trim()}`.trim(),
 savedAt: Date.now()
 });
 onClose();
 };

 return (
 <>
 <div 
 onClick={(e) => { e.stopPropagation(); onClose(); }} 
 style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} 
 />
 <div 
 onClick={(e) => e.stopPropagation()} 
 style={{
 position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
 background: 'white', borderRadius: '20px 20px 0 0',
 padding: '20px 20px 36px',
 animation: 'slideUp 0.25s ease'
 }}
 >
 <div style={{ width: 36, height: 4, background: '#EEEEF4', borderRadius: 2, margin: '0 auto 20px' }} />
 
 <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1A1A2E', margin: '0 0 4px' }}>Save Contact</h3>
 <p style={{ fontSize: 13, color: '#9898B3', margin: '0 0 20px' }}>
 {formatPhone(contact.other_user?.phone_number || contact.contact_phone || contact.phone)}
 </p>

 <input
 value={firstName}
 onChange={e => setFirstName(e.target.value)}
 placeholder="First name"
 style={{
 width: '100%', padding: '12px 16px', fontSize: 14,
 border: '1px solid #EEEEF4', borderRadius: 12,
 outline: 'none', marginBottom: 10, fontFamily: 'inherit',
 color: '#1A1A2E'
 }}
 />
 <input
 value={lastName}
 onChange={e => setLastName(e.target.value)}
 placeholder="Last name (optional)"
 style={{
 width: '100%', padding: '12px 16px', fontSize: 14,
 border: '1px solid #EEEEF4', borderRadius: 12,
 outline: 'none', marginBottom: 20, fontFamily: 'inherit',
 color: '#1A1A2E'
 }}
 />

 <button onClick={handleSave} style={{
 width: '100%', padding: '14px', fontSize: 15, fontWeight: 600,
 background: firstName.trim() ? '#6C63FF' : '#EEEEF4',
 color: firstName.trim() ? 'white' : '#9898B3',
 border: 'none', borderRadius: 14, cursor: 'pointer',
 transition: 'background 0.2s, color 0.2s'
 }}>
 Save to Contacts
 </button>
 
 <style>{`
 @keyframes slideUp {
 from { transform: translateY(100%); }
 to { transform: translateY(0); }
 }
 `}</style>
 </div>
 </>
 );
}
