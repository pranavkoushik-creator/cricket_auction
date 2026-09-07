import React, { useEffect, useState } from 'react';
import { Radio, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMatchSocket } from '../context/SocketContext';
import { apiRequest } from '../utils/api';
import type { BroadcastMatchListItem, LiveMatchState } from '../types';
import {
  BallRibbon,
  BattingScorecard,
  BowlingScorecard,
  CreaseRail,
  MatchFooterRibbon,
  PriorInningsPanel,
  ScoreboardBand
} from '../components/match/MatchBroadcastPanels';

/**
 * Spectator-facing live match broadcast.
 *
 * Renders purely from the server-authoritative match:state frame. The initial
 * snapshot comes from REST (so a late joiner is never blank), and every
 * subsequent update arrives over the socket.
 *
 * Laid out to fit a single desktop viewport: on `lg` and wider the whole match
 * centre is pinned to the window height and each panel scrolls internally, so
 * the live statistics are never below the fold. Narrower than that it stacks
 * and the page scrolls normally, because none of this fits a phone at once.
 *
 * `publicMode` uses the unauthenticated endpoints so the view can also be shown
 * on the pre-login screen, exactly like the auction spectator ticker.
 */
export const LiveMatchBroadcastView: React.FC<{ publicMode?: boolean }> = ({ publicMode = false }) => {
  const { currentTournamentId, token } = useAuth();
  const { matchState, isConnected, joinMatch, leaveMatch, watchedMatchId } = useMatchSocket();

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

  if (!state) {
    return (
      <div className="glass-panel rounded-2xl border border-cricket-border/50 p-10 text-center">
        <p className="text-gray-400 font-bold text-sm">Loading broadcast…</p>
      </div>
    );
  }

  return (
    // Pinned to the viewport from xl up, where the three columns fit side by
    // side; 11rem covers the sticky navbar plus the main element's padding.
    // Anything that estimate is out by is absorbed by the scorecards, which
    // scroll inside their own panels rather than pushing the page taller. Below
    // xl the columns stack and the page scrolls, because they do not fit.
    <div className="flex flex-col gap-3 xl:h-[calc(100vh-11rem)] xl:min-h-[640px] xl:overflow-hidden">
      <ScoreboardBand state={state} isConnected={isConnected} />
      <BallRibbon state={state} />

      <div className="flex-1 min-h-0 grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)_minmax(0,25rem)]">
        <CreaseRail state={state} />

        <BattingScorecard batting={state.batting} innings={state.innings} />

        <div className="flex flex-col gap-4 min-h-0 lg:col-span-2 xl:col-span-1">
          <BowlingScorecard bowling={state.bowling} />
          <PriorInningsPanel state={state} />
        </div>
      </div>

      <MatchFooterRibbon state={state} />
    </div>
  );
};
