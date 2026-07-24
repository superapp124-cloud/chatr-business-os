/**
 * SocketContext.tsx — React Context for the SocketService Singleton
 *
 * Provides:
 * - Connection state (connected / reconnecting / disconnected)
 * - `socket` (the SocketService instance)
 * - Auto-connects when user is authenticated
 * - Auto-disconnects on logout
 *
 * Usage:
 * const { isConnected, connectionState, socket } = useSocketContext();
 *
 * This context sits OUTSIDE CallProvider so all child components share
 * the same singleton socket connection.
 */

import React, {
 createContext,
 useContext,
 useEffect,
 useState,
 useCallback,
 type ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { socketService, type ConnectionState } from '@/services/socketService';

// ─── Context types ─────────────────────────────────────────────────────────

interface SocketContextValue {
 /** Whether Socket.IO is currently connected */
 isConnected: boolean;
 /** Detailed connection state */
 connectionState: ConnectionState;
 /** Whether the Socket.IO feature flag is enabled */
 isEnabled: boolean;
 /** The underlying SocketService instance */
 socket: typeof socketService;
}

// ─── Context ───────────────────────────────────────────────────────────────

const SocketContext = createContext<SocketContextValue>({
 isConnected: false,
 connectionState: 'disconnected',
 isEnabled: false,
 socket: socketService,
});

// ─── Provider ──────────────────────────────────────────────────────────────

interface SocketProviderProps {
 children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
 const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

 // Sync connection state from the service
 useEffect(() => {
 const unsubscribe = socketService.onStateChange(setConnectionState);
 // Sync initial state
 setConnectionState(socketService.state);
 return unsubscribe;
 }, []);

 // Connect / disconnect based on Supabase auth session
 useEffect(() => {
 if (!socketService.isEnabled) return;

 let isMounted = true;

 const initSocket = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (!isMounted) return;

 if (session?.access_token && session.user?.id) {
 socketService.connect(session.access_token, session.user.id);
 }
 };

 initSocket();

 // Listen for auth changes
 const { data: { subscription } } = supabase.auth.onAuthStateChange(
 async (event, session) => {
 if (!isMounted) return;

 if (event === 'SIGNED_IN' && session?.access_token && session.user?.id) {
 socketService.connect(session.access_token, session.user.id);
 } else if (event === 'SIGNED_OUT') {
 socketService.disconnect();
 } else if (event === 'TOKEN_REFRESHED' && session?.access_token && session.user?.id) {
 // Re-connect with the new token
 socketService.disconnect();
 setTimeout(() => {
 socketService.connect(session.access_token!, session.user!.id);
 }, 100);
 }
 }
 );

 return () => {
 isMounted = false;
 subscription.unsubscribe();
 };
 }, []);

 const value: SocketContextValue = {
 isConnected: connectionState === 'connected',
 connectionState,
 isEnabled: socketService.isEnabled,
 socket: socketService,
 };

 return (
 <SocketContext.Provider value={value}>
 {children}
 </SocketContext.Provider>
 );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useSocketContext(): SocketContextValue {
 return useContext(SocketContext);
}
