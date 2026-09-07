import React, { useEffect, useState } from 'react';
import { Radio, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMatchSocket } from '../context/SocketContext';
import { apiRequest } from '../utils/api';
import type { BroadcastMatchListItem, LiveMatchState } from '../types';
import {
  BattingScorecard,
  BowlingScorecard,
  BroadcastPlayerStrip,
  CommentaryFeed,
  FallOfWicketsPanel,
  InningsSummaryPanel,
  MatchHeaderBar,
  // MatchPickerBar,
  MatchStatGrid,
  OverTimeline,
  ScorePanel,
  TargetBanner
} from '../components/match/MatchBroadcastPanels';

/**
 * Spectator-facing live match broadcast.
 *
 * Renders purely from the server-authoritative match:state frame. The initial
 * snapshot comes from REST (so a late joiner is never blank), and every
 * subsequent update arrives over the socket.
 *
 * `publicMode` uses the unauthenticated endpoints so the view can also be shown
 * on the pre-login screen, exactly like the auction spectator ticker.
 */
export const LiveMatchBroadcastView: React.FC<{ publicMode?: boolean }> = ({ publicMode = false }) => {
  const { currentTournamentId, token } = useAuth();
  const { matchState, matchFeed, isConnected, joinMatch, leaveMatch, watchedMatchId } = useMatchSocket();

  const [matches, setMatches] = useState<BroadcastMatchListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [snapshot, setSnapshot] = useState<LiveMatchState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The fixture list is public either way; only the state endpoint differs, so
  // an unauthenticated viewer never hits a route that would 401.
  const listEndpoint = '/matches/public/live';
  const stateEndpoint = (id: string) => (publicMode ? `/matches/public/live/${id}` : `/matches/${id}/live`);

  // Load the fixture list, preferring whichever match is live.
  useEffect(() => {
    if (!currentTournamentId) return;
    if (!publicMode && !token) return;

    apiRequest(`${listEndpoint}?tournamentId=${currentTournamentId}`)
      .then((res: BroadcastMatchListItem[]) => {
        setMatches(res);
        if (res.length > 0) {
          setSelectedId(prev => (prev && res.some(m => m.id === prev) ? prev : res[0].id));
        } else {
          setSelectedId('');
        }
      })
      .catch(err => setError(err.message));
  }, [currentTournamentId, token, publicMode]);

  // Fetch the opening snapshot, then hand over to the socket room.
  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;
    apiRequest(stateEndpoint(selectedId))
      .then((res: LiveMatchState) => {
        if (!cancelled) {
          setSnapshot(res);
          setError(null);
        }
      })
      .catch(err => !cancelled && setError(err.message));

    joinMatch(selectedId);
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => () => leaveMatch(), []);

  // Socket frames win; the REST snapshot only covers the gap before the room joins.
  const state = watchedMatchId === selectedId && matchState ? matchState : snapshot;

  if (error && !state) {
    return (
      <div className="glass-panel rounded-2xl border border-cricket-border/50 p-10 text-center">
        <WifiOff className="w-9 h-9 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-300 font-bold">Unable to load the match broadcast</p>
        <p className="text-gray-500 text-xs mt-1">{error}</p>
      </div>
    );
  }

  if (matches.length === 0 && !state) {
    return (
      <div className="glass-panel rounded-2xl border border-cricket-border/50 p-10 text-center">
        <Radio className="w-9 h-9 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-300 font-bold">No fixtures scheduled yet</p>
        <p className="text-gray-500 text-xs mt-1">
          Generate fixtures from the Live Match Scorer console to start a broadcast.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="font-broadcast text-xl text-white">SAKHA LIVE MATCH CENTRE</h2>
          <span
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${isConnected
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
              : 'bg-red-500/15 text-red-300 border-red-500/40'
              }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isConnected ? 'LIVE' : 'Reconnecting'}
          </span>
        </div>
      </div>


      {!state ? (
        <div className="glass-panel rounded-2xl border border-cricket-border/50 p-10 text-center">
          <p className="text-gray-400 font-bold text-sm">Loading broadcast…</p>
        </div>
      ) : (
        <>
          <MatchHeaderBar state={state} />
          <TargetBanner state={state} />

          <div className="grid lg:grid-cols-3 gap-4">
            {/* Left / main broadcast column */}
            <div className="lg:col-span-2 space-y-4">
              <ScorePanel state={state} />
              <BroadcastPlayerStrip state={state} />
              <OverTimeline state={state} />
              <MatchStatGrid state={state} />
              <FallOfWicketsPanel wickets={state.fall_of_wickets} />

              <div className="grid xl:grid-cols-2 gap-4">
                <BattingScorecard batting={state.batting} />
                <BowlingScorecard bowling={state.bowling} />
              </div>
            </div>

            {/* Right rail */}
            <div className="space-y-4">
              <InningsSummaryPanel innings={state.all_innings} oversLimit={state.overs_limit} />
              <CommentaryFeed feed={matchFeed} fallback={state.recent_events} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
