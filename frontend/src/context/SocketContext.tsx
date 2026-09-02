import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ActiveAuctionState,
  BallInputPayload,
  LiveMatchState,
  MatchFeedEntry
} from '../types';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  auctionState: ActiveAuctionState | null;
  eventsLog: { type: string; message: string; timestamp: string; amount?: number; increment?: number }[];
  bidError: string | null;
  placeBid: (franchiseId: string, amount: number) => void;
  operatorStartLot: (lotId: string) => void;
  operatorMarkSold: () => void;
  operatorMarkUnsold: () => void;
  operatorTogglePause: () => void;
  operatorToggleTimer: () => void;
  operatorUpdateTimerSeconds: (seconds: number, timerEnabled?: boolean) => Promise<void>;   // ← add
  operatorRollbackSale: (lotId: string) => void;

  // --- Live match broadcast (shares this same socket connection) ---
  matchState: LiveMatchState | null;
  matchFeed: MatchFeedEntry[];
  matchError: string | null;
  watchedMatchId: string | null;
  joinMatch: (matchId: string) => void;
  leaveMatch: () => void;
  scorerStartInnings: (p: { battingTeamId: string; strikerId: string; nonStrikerId: string; bowlerId: string; oversLimit?: number }) => void;
  scorerRecordBall: (p: BallInputPayload) => void;
  scorerNewBatter: (playerId: string) => void;
  scorerSetBowler: (playerId: string) => void;
  scorerSwapStrike: () => void;
  scorerReplaceBatter: (outgoingId: string, incomingId: string) => void;
  scorerReplaceBowler: (outgoingId: string, incomingId: string, transferFigures: boolean) => void;
  scorerUndoBall: () => void;
  scorerCompleteInnings: () => void;
  scorerCompleteMatch: () => void;
  scorerResetMatch: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTournamentId, token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [auctionState, setAuctionState] = useState<ActiveAuctionState | null>(null);
  const [eventsLog, setEventsLog] = useState<{ type: string; message: string; timestamp: string; amount?: number; increment?: number }[]>([]);
  const [bidError, setBidError] = useState<string | null>(null);

  const [matchState, setMatchState] = useState<LiveMatchState | null>(null);
  const [matchFeed, setMatchFeed] = useState<MatchFeedEntry[]>([]);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [watchedMatchId, setWatchedMatchId] = useState<string | null>(null);
  // Kept in a ref so the reconnect handler always re-joins the current room.
  const watchedMatchRef = useRef<string | null>(null);

  // Create or reconnect socket whenever auth token changes (e.g. on login/logout)
  useEffect(() => {
    const socketHost = typeof window !== 'undefined' && window.location.hostname ? `http://${window.location.hostname}:4000` : 'http://localhost:4000';
    const currentToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    console.log('[Socket] Connecting to auction engine at:', socketHost, 'with token present:', Boolean(currentToken));
    
    const s = io(socketHost, {
      auth: { token: currentToken },
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

    // --- Live match broadcast listeners (same connection as the auction) ---

    s.on('match:state', (state: LiveMatchState) => {
      setMatchState(state);
    });

    s.on('match:event', (ev: { type: string; message: string; timestamp: string }) => {
      setMatchFeed(prev => [
        { type: ev.type, message: ev.message, timestamp: new Date(ev.timestamp).toLocaleTimeString() },
        ...prev.slice(0, 49)
      ]);
    });

    // match:summary and match:status carry a subset of match:state; merge them so
    // a dropped state frame still leaves the scoreboard current.
    s.on('match:summary', (summary: Partial<LiveMatchState>) => {
      setMatchState(prev => (prev ? { ...prev, ...summary } : prev));
    });

    s.on('match:status', (status: Partial<LiveMatchState>) => {
      setMatchState(prev => (prev ? { ...prev, ...status } : prev));
    });

    s.on('match:error', ({ message }: { message: string }) => {
      setMatchError(message);
      setTimeout(() => setMatchError(null), 5000);
    });

    // Re-join the match room after any reconnect so the scoreboard resumes.
    const rejoinMatch = () => {
      if (watchedMatchRef.current) {
        s.emit('join:match', { matchId: watchedMatchRef.current });
      }
    };
    s.on('connect', rejoinMatch);

    return () => {
      s.off('connect', rejoinMatch);
      s.disconnect();
      socketRef.current = null;
    };
  }, [token]);

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

  const operatorToggleTimer = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('operator:toggle_timer');
    }
  };

  const operatorUpdateTimerSeconds = (seconds: number, timerEnabled?: boolean): Promise<void> => {
    return new Promise((resolve, reject) => {
      const s = socketRef.current;
      if (!s?.connected || !currentTournamentId) {
        return reject(new Error('Not connected.'));
      }

      const cleanup = () => {
        s.off('auction:timer_seconds_updated', onUpdated);
        s.off('auction:error', onError);
      };
      const onUpdated = () => {
        cleanup();
        resolve();
      };
      const onError = ({ message }: { message: string }) => {
        cleanup();
        reject(new Error(message));
      };

      s.once('auction:timer_seconds_updated', onUpdated);
      s.once('auction:error', onError);
      s.emit('operator:update_timer_seconds', { tournamentId: currentTournamentId, seconds, timerEnabled });
    });
  };

  const operatorRollbackSale = (lotId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('operator:rollback_sale', { lotId });
    }
  };

  // ---------------------------------------------------------------- match room

  const joinMatch = (matchId: string) => {
    if (!matchId || watchedMatchRef.current === matchId) return;

    const s = socketRef.current;
    if (watchedMatchRef.current && s?.connected) {
      s.emit('leave:match', { matchId: watchedMatchRef.current });
    }

    watchedMatchRef.current = matchId;
    setWatchedMatchId(matchId);
    setMatchState(null);
    setMatchFeed([]);

    if (s?.connected) s.emit('join:match', { matchId });
  };

  const leaveMatch = () => {
    const s = socketRef.current;
    if (watchedMatchRef.current && s?.connected) {
      s.emit('leave:match', { matchId: watchedMatchRef.current });
    }
    watchedMatchRef.current = null;
    setWatchedMatchId(null);
    setMatchState(null);
    setMatchFeed([]);
  };

  /**
   * Scorer commands are fire-and-forget: the server validates, mutates and then
   * broadcasts match:state to the room, so the console re-renders from the same
   * authoritative frame every spectator receives.
   */
  const emitScorer = (event: string, payload: Record<string, unknown> = {}) => {
    const s = socketRef.current;
    const matchId = watchedMatchRef.current;
    if (!s?.connected || !matchId) {
      setMatchError('Not connected to the match broadcast.');
      setTimeout(() => setMatchError(null), 4000);
      return;
    }
    s.emit(event, { matchId, ...payload });
  };

  const scorerStartInnings = (p: { battingTeamId: string; strikerId: string; nonStrikerId: string; bowlerId: string; oversLimit?: number }) =>
    emitScorer('scorer:start_innings', p);
  const scorerRecordBall = (p: BallInputPayload) => emitScorer('scorer:record_ball', { ...p });
  const scorerNewBatter = (playerId: string) => emitScorer('scorer:new_batter', { playerId });
  const scorerSetBowler = (playerId: string) => emitScorer('scorer:set_bowler', { playerId });
  const scorerSwapStrike = () => emitScorer('scorer:swap_strike');
  const scorerReplaceBatter = (outgoingId: string, incomingId: string) =>
    emitScorer('scorer:replace_batter', { outgoingId, incomingId });
  const scorerReplaceBowler = (outgoingId: string, incomingId: string, transferFigures: boolean) =>
    emitScorer('scorer:replace_bowler', { outgoingId, incomingId, transferFigures });
  const scorerUndoBall = () => emitScorer('scorer:undo_ball');
  const scorerCompleteInnings = () => emitScorer('scorer:complete_innings');
  const scorerCompleteMatch = () => emitScorer('scorer:complete_match');
  const scorerResetMatch = () => emitScorer('scorer:reset_match');

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
        operatorToggleTimer,
        operatorUpdateTimerSeconds,   // ← add
        operatorRollbackSale,

        matchState,
        matchFeed,
        matchError,
        watchedMatchId,
        joinMatch,
        leaveMatch,
        scorerStartInnings,
        scorerRecordBall,
        scorerNewBatter,
        scorerSetBowler,
        scorerSwapStrike,
        scorerReplaceBatter,
        scorerReplaceBowler,
        scorerUndoBall,
        scorerCompleteInnings,
        scorerCompleteMatch,
        scorerResetMatch
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

/** Same provider, named for match-broadcast consumers. */
export const useMatchSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useMatchSocket must be used within SocketProvider');
  return context;
};
