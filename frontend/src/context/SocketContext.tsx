import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ActiveAuctionState } from '../types';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  auctionState: ActiveAuctionState | null;
  eventsLog: { type: string; message: string; timestamp: string }[];
  bidError: string | null;
  placeBid: (franchiseId: string, amount: number) => void;
  operatorStartLot: (lotId: string) => void;
  operatorMarkSold: () => void;
  operatorMarkUnsold: () => void;
  operatorTogglePause: () => void;
  operatorRollbackSale: (lotId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTournamentId } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [auctionState, setAuctionState] = useState<ActiveAuctionState | null>(null);
  const [eventsLog, setEventsLog] = useState<{ type: string; message: string; timestamp: string }[]>([]);
  const [bidError, setBidError] = useState<string | null>(null);

  // Create socket once on mount
  useEffect(() => {
    const s = io('http://localhost:4000', {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      console.log('[Socket] Connected:', s.id);
      setIsConnected(true);
    });

    s.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    s.on('auction:state', (state: ActiveAuctionState) => {
      console.log('[Socket] Received auction:state', state);
      setAuctionState(state);
    });

    s.on('auction:timer', ({ timer }: { timer: number }) => {
      setAuctionState(prev => prev ? { ...prev, timer } : null);
    });

    s.on('auction:event', (ev: { type: string; message: string }) => {
      setEventsLog(prev => [
        { ...ev, timestamp: new Date().toLocaleTimeString() },
        ...prev.slice(0, 49) // Keep last 50 events
      ]);
    });

    s.on('auction:error', ({ message }: { message: string }) => {
      setBidError(message);
      setTimeout(() => setBidError(null), 5000);
    });

    s.on('bid:rejected', ({ reason }: { reason: string }) => {
      setBidError(reason);
      setTimeout(() => setBidError(null), 4000);
    });

    s.on('bid:accepted', () => {
      setBidError(null);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []); // Create socket ONCE

  // Re-join auction room whenever the tournament changes or socket connects
  useEffect(() => {
    const s = socketRef.current;
    if (!s || !currentTournamentId) return;

    const joinRoom = () => {
      console.log('[Socket] Joining auction room for tournament:', currentTournamentId);
      s.emit('join:auction', { tournamentId: currentTournamentId });
    };

    if (s.connected) {
      joinRoom();
    }

    // Also re-join whenever the socket reconnects
    s.on('connect', joinRoom);

    return () => {
      s.off('connect', joinRoom);
    };
  }, [currentTournamentId, isConnected]);

  const placeBid = (franchiseId: string, amount: number) => {
    if (socketRef.current?.connected) {
      console.log('[Socket] Placing bid:', { franchiseId, amount });
      socketRef.current.emit('bid:place', { franchiseId, bidAmount: amount });
    } else {
      console.warn('[Socket] Not connected — cannot place bid');
    }
  };

  const operatorStartLot = (lotId: string) => {
    if (socketRef.current?.connected) {
      console.log('[Socket] Starting lot:', lotId);
      socketRef.current.emit('operator:start_lot', { lotId });
    } else {
      console.warn('[Socket] Not connected — cannot start lot');
    }
  };

  const operatorMarkSold = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('operator:mark_sold');
    }
  };

  const operatorMarkUnsold = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('operator:mark_unsold');
    }
  };

  const operatorTogglePause = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('operator:toggle_pause');
    }
  };

  const operatorRollbackSale = (lotId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('operator:rollback_sale', { lotId });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        auctionState,
        eventsLog,
        bidError,
        placeBid,
        operatorStartLot,
        operatorMarkSold,
        operatorMarkUnsold,
        operatorTogglePause,
        operatorRollbackSale
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useAuctionSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useAuctionSocket must be used within SocketProvider');
  return context;
};
