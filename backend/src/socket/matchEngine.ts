import { Server, Socket } from 'socket.io';
import {
  getLiveMatchState,
  startInnings,
  recordBall,
  setNewBatter,
  setBowler,
  swapStrike,
  replaceBatter,
  completeInnings,
  completeMatchNow,
  undoLastBall,
  resetMatch,
  type BallInput,
  type LiveMatchState
} from '../services/liveMatchService';

/**
 * Realtime match broadcast engine.
 *
 * Mirrors socket/auctionEngine.ts: one room per subject, server-authoritative
 * state, and a `<domain>:state` / `<domain>:event` / `<domain>:error` event
 * vocabulary. All mutations delegate to liveMatchService so the REST routes and
 * the socket handlers share one rule implementation.
 *
 * Handshake authentication is registered by setupAuctionSocket(), which runs
 * first in server.ts and attaches `socket.user`. This module deliberately does
 * not add a second io.use() middleware.
 */

let ioRef: Server | null = null;

export const matchRoom = (matchId: string) => `match_${matchId}`;

/**
 * Broadcasts the authoritative state for a match. Safe to call from REST
 * handlers -- it is a no-op until the socket engine has been initialised.
 */
export function emitMatchState(matchId: string, state?: LiveMatchState) {
  if (!ioRef) return;
  const payload = state || getLiveMatchState(matchId);

  ioRef.to(matchRoom(matchId)).emit('match:state', payload);
  ioRef.to(matchRoom(matchId)).emit('match:summary', {
    match_id: payload.match_id,
    current_innings: payload.current_innings,
    innings: payload.innings,
    all_innings: payload.all_innings,
    runs_required: payload.runs_required,
    balls_remaining: payload.balls_remaining,
    required_run_rate: payload.required_run_rate
  });
  ioRef.to(matchRoom(matchId)).emit('match:status', {
    match_id: payload.match_id,
    status: payload.status,
    result_summary: payload.result_summary,
    winner_team_id: payload.winner_team_id
  });
}

/** Pushes a single commentary line to the room's activity feed. */
export function emitMatchEvent(matchId: string, type: string, message: string) {
  if (!ioRef) return;
  ioRef.to(matchRoom(matchId)).emit('match:event', {
    match_id: matchId,
    type,
    message,
    timestamp: new Date().toISOString()
  });
}

/** Broadcasts state plus the newest commentary line from the event log. */
export function broadcastMatch(matchId: string, state: LiveMatchState, fallbackType = 'update') {
  emitMatchState(matchId, state);
  const latest = state.recent_events[0];
  if (latest) emitMatchEvent(matchId, fallbackType, latest.label);
}

export function setupMatchSocket(io: Server) {
  ioRef = io;

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user || { role: 'Spectator', name: 'Public Spectator' };

    /** Scorer-only guard, mirroring requireRole() in the auction engine. */
    const requireScorer = (): boolean => {
      if (user.role !== 'Super Admin') {
        socket.emit('match:error', {
          message: `403 Forbidden: scoring requires the Super Admin role. Your role: '${user.role || 'Guest'}'.`
        });
        return false;
      }
      return true;
    };

    /** Runs a mutation, broadcasts the new state, and reports failures to the caller only. */
    const mutate = (matchId: string, fn: () => LiveMatchState, eventType: string) => {
      if (!requireScorer()) return;
      if (!matchId) {
        socket.emit('match:error', { message: 'matchId is required.' });
        return;
      }
      try {
        const state = fn();
        broadcastMatch(matchId, state, eventType);
      } catch (err: any) {
        console.warn(`[MatchEngine] ${eventType} failed for ${matchId}: ${err.message}`);
        socket.emit('match:error', { message: err.message });
      }
    };

    socket.on('join:match', ({ matchId }: { matchId: string }) => {
      if (!matchId) return;
      socket.join(matchRoom(matchId));
      try {
        socket.emit('match:state', getLiveMatchState(matchId));
      } catch (err: any) {
        socket.emit('match:error', { message: err.message });
      }
    });

    socket.on('leave:match', ({ matchId }: { matchId: string }) => {
      if (matchId) socket.leave(matchRoom(matchId));
    });

    socket.on('scorer:start_innings', (p: {
      matchId: string; battingTeamId: string; strikerId: string; nonStrikerId: string; bowlerId: string;
      oversLimit?: number;
    }) => mutate(p?.matchId, () => startInnings(p.matchId, p), 'innings_start'));

    socket.on('scorer:record_ball', (p: { matchId: string } & BallInput) =>
      mutate(p?.matchId, () => recordBall(p.matchId, p), 'ball'));

    socket.on('scorer:new_batter', (p: { matchId: string; playerId: string }) =>
      mutate(p?.matchId, () => setNewBatter(p.matchId, p.playerId), 'new_batter'));

    socket.on('scorer:set_bowler', (p: { matchId: string; playerId: string }) =>
      mutate(p?.matchId, () => setBowler(p.matchId, p.playerId), 'bowler_change'));

    socket.on('scorer:swap_strike', (p: { matchId: string }) =>
      mutate(p?.matchId, () => swapStrike(p.matchId), 'strike_swap'));

    socket.on('scorer:replace_batter', (p: { matchId: string; outgoingId: string; incomingId: string }) =>
      mutate(p?.matchId, () => replaceBatter(p.matchId, p.outgoingId, p.incomingId), 'batter_replaced'));

    socket.on('scorer:undo_ball', (p: { matchId: string }) =>
      mutate(p?.matchId, () => undoLastBall(p.matchId), 'undo'));

    socket.on('scorer:complete_innings', (p: { matchId: string }) =>
      mutate(p?.matchId, () => completeInnings(p.matchId), 'innings_complete'));

    socket.on('scorer:complete_match', (p: { matchId: string }) =>
      mutate(p?.matchId, () => completeMatchNow(p.matchId), 'match_complete'));

    socket.on('scorer:reset_match', (p: { matchId: string }) =>
      mutate(p?.matchId, () => resetMatch(p.matchId), 'match_reset'));
  });

  console.log('[MatchEngine] Live match broadcast engine ready.');
}
