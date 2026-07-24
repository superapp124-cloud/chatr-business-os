import React from 'react';
import { Capacitor } from '@capacitor/core';
import { useSocketContext } from '@/contexts/SocketContext';

export function SocketStatusIndicator() {
 const { isConnected, connectionState, isEnabled } = useSocketContext();

 // Keep the native shell visually quiet.
 // Only show when Socket is ENABLED but NOT CONNECTED.
 if (Capacitor.isNativePlatform() || !isEnabled || isConnected) {
 return null;
 }

 const isReconnecting = connectionState === 'reconnecting';

 return (
 <div
 style={{
 position: 'fixed',
 top: 0,
 left: 0,
 right: 0,
 height: '28px',
 zIndex: 1000,
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 gap: '6px',
 fontSize: '12px',
 fontWeight: 600,
 background: '#FF8F00',
 color: '#fff',
 transition: 'all 0.3s ease-in-out',
 animation: 'slideDown 0.3s ease-out',
 }}
 >
 <span
 style={{
 width: 6,
 height: 6,
 borderRadius: '50%',
 background: '#fff',
 boxShadow: '0 0 4px #fff',
 opacity: 0.9,
 flexShrink: 0,
 animation: 'pulse 1s infinite',
 }}
 />
 Reconnecting...
 
 <style>{`
 @keyframes pulse {
 0% { transform: scale(1); opacity: 0.9; }
 50% { transform: scale(1.3); opacity: 0.5; }
 100% { transform: scale(1); opacity: 0.9; }
 }
 @keyframes slideDown {
 from { transform: translateY(-100%); }
 to { transform: translateY(0); }
 }
 `}</style>
 </div>
 );
}
