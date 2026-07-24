import React from 'react';

interface Contact {
 name?: string;
 username?: string;
 avatar_url?: string;
}

interface ContactAvatarProps {
 contact?: Contact;
 size?: number;
 className?: string;
}

export function ContactAvatar({ contact, size = 36, className = '' }: ContactAvatarProps) {
 const nameToUse = contact?.name || contact?.username || '';
 const hasAvatar = !!contact?.avatar_url;

 if (hasAvatar) {
 return (
 <img 
 src={contact.avatar_url} 
 alt={nameToUse || 'Contact'} 
 style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
 className={className}
 />
 );
 }

 const initials = nameToUse 
 ? nameToUse.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
 : '?';
 
 const colors = ['#EDE8FF', '#E0F7F4', '#FAEEDA', '#FCEBEB'];
 const textColors = ['#6C63FF', '#00BFA5', '#FF8F00', '#E53935'];
 const idx = nameToUse ? nameToUse.charCodeAt(0) % 4 : 0;

 return (
 <div 
 style={{
 width: size, height: size, borderRadius: '50%',
 background: colors[idx], color: textColors[idx],
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: size * 0.35, fontWeight: 700, flexShrink: 0
 }}
 className={className}
 >
 {initials}
 </div>
 );
}
