import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { Calendar, RefreshCw, CheckCircle2, ArrowRight } from 'lucide-react';

export const LiveScorerConsoleView: React.FC = () => {
  const { currentTournamentId, token } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [matchDetails, setMatchDetails] = useState<any>(null);
  const [standings, setStandings] = useState<any[]>([]);

  const [currentInnings] = useState<number>(1);
  const [runsScored, setRunsScored] = useState<number>(0);
  const [wicketsFallen, setWicketsFallen] = useState<number>(0);
  const [oversBowled, setOversBowled] = useState<number>(0);
  const [ballsBowled, setBallsBowled] = useState<number>(0);

  const loadStandings = () => {
    if (!currentTournamentId || !token) return;
    apiRequest(`/matches/standings?tournamentId=${currentTournamentId}`)
      .then(setStandings)
      .catch(console.error);
  };

  const loadMatches = () => {
    if (!currentTournamentId || !token) return;
    apiRequest(`/matches?tournamentId=${currentTournamentId}`)
      .then(res => {
        setMatches(res);
        if (res.length > 0) {
          const defaultMatchId = selectedMatchId || res[0].id;
          setSelectedMatchId(defaultMatchId);
          loadMatchDetails(defaultMatchId);
        } else {
          setSelectedMatchId('');
          setMatchDetails(null);
        }
      })
      .catch(console.error);
  };

  const loadMatchDetails = (id: string) => {
    if (!id || !token) return;
    apiRequest(`/matches/${id}`)
      .then(res => {
        setMatchDetails(res);
        // Calculate runs from events
        if (res.events && res.events.length > 0) {
          let runs = 0;
          let wkts = 0;
          let balls = 0;
          res.events.forEach((ev: any) => {
            if (ev.payload?.runs) runs += ev.payload.runs;
            if (ev.payload?.isWicket) wkts += 1;
            // The API returns the raw column name (event_type); the POST body
            // that creates the event uses eventType. Only the read side matters here.
            if (ev.event_type === 'ball') balls += 1;
          });
          setRunsScored(runs);
          setWicketsFallen(wkts);
          setOversBowled(Math.floor(balls / 6));
          setBallsBowled(balls % 6);
        } else {
          setRunsScored(0);
          setWicketsFallen(0);
          setOversBowled(0);
          setBallsBowled(0);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (currentTournamentId && token) {
      loadMatches();
      loadStandings();
    }
  }, [currentTournamentId, token]);

  const handleGenerateFixtures = () => {
    if (!currentTournamentId || !token) return;
    apiRequest('/matches/generate', {
      method: 'POST',
      body: JSON.stringify({ tournamentId: currentTournamentId })
    })
      .then(() => {
        loadMatches();
        loadStandings();
      })
      .catch(console.error);
  };

  // const recordBall = (runs: number, isWicket: boolean = false, extraType?: string) => {
  //   if (!selectedMatchId || !token) return;

  //   apiRequest(`/matches/${selectedMatchId}/event`, {
  //     method: 'POST',
  //     body: JSON.stringify({
  //       innings: currentInnings,
  //       eventType: 'ball',
  //       payload: {
  //         runs,
  //         isWicket,
  //         extraType,
  //         timestamp: new Date().toISOString()
  //       }
  //     })
  //   })
  //     .then(() => loadMatchDetails(selectedMatchId))
  //     .catch(console.error);
  // };

  // const declareResult = (winnerId: string, summary: string) => {
  //   if (!selectedMatchId || !token) return;

  //   apiRequest(`/matches/${selectedMatchId}/complete`, {
  //     method: 'POST',
  //     body: JSON.stringify({
  //       winnerTeamId: winnerId,
  //       resultSummary: summary,
  //       homeScore: { runs: runsScored, overs: oversBowled + ballsBowled / 6 },
  //       awayScore: { runs: Math.max(0, runsScored - 10), overs: 20 }
  //     })
  //   })
  //     .then(() => {
  //       loadMatches();
  //       loadMatchDetails(selectedMatchId);
  //       loadStandings();
  //     })
  //     .catch(console.error);
  // };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-pink-500/30">
        <div className="flex items-center space-x-3">
          <img src="/sakha_logo.png" alt="Sakha Logo" className="h-10 sm:h-12 w-auto object-contain bg-white px-2.5 py-1 rounded-lg shadow-md shrink-0" />
          <div>
            <h2 className="text-xl font-extrabold text-white">SAKHA MATCH OFFICIAL SCORER CONSOLE</h2>
            <p className="text-xs text-gray-400">Record ball-by-ball scoring events &amp; trigger live NRR points table updates</p>
          </div>
        </div>

        {/* Match Selector */}
        {matches.length > 0 && (
          <select
            value={selectedMatchId}
            onChange={e => {
              setSelectedMatchId(e.target.value);
              loadMatchDetails(e.target.value);
            }}
            className="bg-gray-900 text-xs font-bold text-white border border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:border-pink-500"
          >
            {matches.map(m => (
              <option key={m.id} value={m.id}>
                Match #{m.match_number}: {m.home_team_short} vs {m.away_team_short} ({m.status.toUpperCase()})
              </option>
            ))}
          </select>
        )}
      </div>

      {matches.length === 0 ? (
        <div className="glass-panel p-10 rounded-2xl border border-gray-800 text-center space-y-4 max-w-2xl mx-auto">
          <Calendar className="w-16 h-16 text-pink-500 mx-auto opacity-70 animate-pulse" />
          <h3 className="text-lg font-bold text-white">No Match Fixtures Found</h3>
          <p className="text-sm text-gray-400">
            No matches have been scheduled for this tournament yet. You can automatically generate a round-robin fixture list based on the active franchises.
          </p>
          <button
            onClick={handleGenerateFixtures}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm shadow-lg shadow-pink-500/20 transition"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Auto-Generate Round Robin Fixtures</span>
          </button>
        </div>
      ) : (
        <div className="glass-panel p-10 rounded-2xl border border-emerald-500/40 text-center space-y-6 max-w-2xl mx-auto bg-emerald-900/10 mt-12 shadow-[0_0_30px_rgba(52,211,153,0.1)]">
          <CheckCircle2 className="w-20 h-20 text-emerald-400 mx-auto drop-shadow-[0_0_15px_rgba(52,211,153,0.4)]" />

          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white tracking-wide">
              Fixtures Have Been Generated Successfully
            </h3>
            <p className="text-emerald-200/70 font-medium">
              The tournament schedule and points table are fully initialized.
            </p>
          </div>

          <div className="pt-6 flex justify-center">
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-gray-900/80 border border-gray-700 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/0 via-pink-500/10 to-pink-500/0 -translate-x-full animate-[shimmer_2.5s_infinite]"></div>
              <ArrowRight className="w-5 h-5 text-pink-400" />
              <span className="text-gray-300 font-bold tracking-wide">
                Move to <span className="text-pink-400">Match Control Console</span> To Start The Matches
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
