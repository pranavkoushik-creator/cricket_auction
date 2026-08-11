import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { Activity, Flame } from 'lucide-react';

export const LiveScorerConsoleView: React.FC = () => {
  const { currentTournamentId } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [matchDetails, setMatchDetails] = useState<any>(null);

  const [currentInnings] = useState<number>(1);
  const [runsScored, setRunsScored] = useState<number>(0);
  const [wicketsFallen, setWicketsFallen] = useState<number>(0);
  const [oversBowled, setOversBowled] = useState<number>(0);
  const [ballsBowled, setBallsBowled] = useState<number>(0);

  const loadMatches = () => {
    apiRequest(`/matches?tournamentId=${currentTournamentId}`)
      .then(res => {
        setMatches(res);
        if (res.length > 0 && !selectedMatchId) {
          setSelectedMatchId(res[0].id);
          loadMatchDetails(res[0].id);
        }
      })
      .catch(console.error);
  };

  const loadMatchDetails = (id: string) => {
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
            if (ev.eventType === 'ball') balls += 1;
          });
          setRunsScored(runs);
          setWicketsFallen(wkts);
          setOversBowled(Math.floor(balls / 6));
          setBallsBowled(balls % 6);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadMatches();
  }, [currentTournamentId]);

  const recordBall = (runs: number, isWicket: boolean = false, extraType?: string) => {
    if (!selectedMatchId) return;

    apiRequest(`/matches/${selectedMatchId}/event`, {
      method: 'POST',
      body: JSON.stringify({
        innings: currentInnings,
        eventType: 'ball',
        payload: {
          runs,
          isWicket,
          extraType,
          timestamp: new Date().toISOString()
        }
      })
    })
      .then(() => loadMatchDetails(selectedMatchId))
      .catch(console.error);
  };

  const declareResult = (winnerId: string, summary: string) => {
    if (!selectedMatchId) return;

    apiRequest(`/matches/${selectedMatchId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        winnerTeamId: winnerId,
        resultSummary: summary,
        homeScore: { runs: runsScored, overs: oversBowled + ballsBowled / 6 },
        awayScore: { runs: Math.max(0, runsScored - 10), overs: 20 }
      })
    })
      .then(() => {
        loadMatches();
        loadMatchDetails(selectedMatchId);
      })
      .catch(console.error);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-pink-500/30">
        <div className="flex items-center space-x-3">
          <img src="/sakha_logo.png" alt="Sakha Logo" className="h-10 sm:h-12 w-auto object-contain bg-white px-2.5 py-1 rounded-lg shadow-md shrink-0" />
          <div>
            <h2 className="text-xl font-extrabold text-white">SAKHA MATCH OFFICIAL SCORER CONSOLE</h2>
            <p className="text-xs text-gray-400">Record ball-by-ball scoring events & trigger live NRR points table updates</p>
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

      {matchDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Scoreboard & Buttons */}
          <div className="lg:col-span-2 space-y-6">
            {/* Scorecard Banner */}
            <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-4 text-center relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3 text-xs">
                <span className="text-gray-400 font-semibold">{matchDetails.stage} · Match #{matchDetails.match_number}</span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  matchDetails.status === 'live' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-gray-800 text-gray-300'
                }`}>
                  Status: {matchDetails.status}
                </span>
              </div>

              {/* Team vs Team Header */}
              <div className="flex items-center justify-center space-x-6 py-2">
                <div className="text-center space-y-1">
                  <img src={matchDetails.home_team_logo} alt={matchDetails.home_team_name} className="w-12 h-12 mx-auto rounded-full object-cover border border-gray-700" />
                  <p className="font-extrabold text-white text-sm">{matchDetails.home_team_short}</p>
                </div>

                <div className="text-2xl font-black text-pink-400">VS</div>

                <div className="text-center space-y-1">
                  <img src={matchDetails.away_team_logo} alt={matchDetails.away_team_name} className="w-12 h-12 mx-auto rounded-full object-cover border border-gray-700" />
                  <p className="font-extrabold text-white text-sm">{matchDetails.away_team_short}</p>
                </div>
              </div>

              {/* Big Score Display */}
              <div className="glass-card p-4 rounded-xl border border-gray-800 max-w-sm mx-auto">
                <p className="text-[11px] text-gray-400 font-semibold uppercase">Innings {currentInnings} Score</p>
                <p className="text-4xl font-black text-white">{runsScored} / {wicketsFallen}</p>
                <p className="text-xs text-gray-400 font-semibold">Overs: {oversBowled}.{ballsBowled} / 20.0</p>
              </div>

              {matchDetails.result_summary && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 font-bold text-xs">
                  🏆 Result: {matchDetails.result_summary}
                </div>
              )}
            </div>

            {/* Quick Scoring Buttons Console */}
            {matchDetails.status !== 'completed' && (
              <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-4">
                <h4 className="text-sm font-bold text-white uppercase text-center tracking-wider">Fast Score Entry Controls</h4>

                <div className="grid grid-cols-4 gap-3">
                  {[0, 1, 2, 3, 4, 6].map(runs => (
                    <button
                      key={runs}
                      onClick={() => recordBall(runs)}
                      className={`py-3.5 rounded-xl font-black text-base border transition ${
                        runs === 4 || runs === 6
                          ? 'bg-yellow-500 hover:bg-yellow-400 text-black border-yellow-400 shadow-lg shadow-yellow-500/20'
                          : 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700'
                      }`}
                    >
                      {runs === 0 ? 'DOT' : `+${runs} RUNS`}
                    </button>
                  ))}
                  <button
                    onClick={() => recordBall(0, true)}
                    className="col-span-2 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm border border-red-500 shadow-lg shadow-red-600/30 transition"
                  >
                    WICKET!
                  </button>
                </div>

                {/* Result Declaration Controls */}
                <div className="pt-4 border-t border-gray-800 space-y-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase text-center">Declare Final Match Winner</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => declareResult(matchDetails.home_team_id, `${matchDetails.home_team_name} won by ${20 - runsScored} runs`)}
                      className="py-2.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-bold text-xs border border-emerald-500/40"
                    >
                      Declare {matchDetails.home_team_short} Winner
                    </button>
                    <button
                      onClick={() => declareResult(matchDetails.away_team_id, `${matchDetails.away_team_name} won by 6 wickets`)}
                      className="py-2.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-bold text-xs border border-emerald-500/40"
                    >
                      Declare {matchDetails.away_team_short} Winner
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Col: Ball-by-ball Commentary Feed */}
          <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
              <Flame className="w-4 h-4 text-yellow-400" />
              <span>Ball-by-Ball Live Event Stream</span>
            </h4>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {matchDetails.events && matchDetails.events.length > 0 ? (
                matchDetails.events.map((ev: any) => (
                  <div key={ev.id} className="glass-card p-3 rounded-xl border border-gray-800 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">Ball #{ev.event_number}</span>
                      <p className="text-[11px] text-gray-400">{ev.payload?.isWicket ? 'WICKET!' : `Runs scored: ${ev.payload?.runs}`}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded font-extrabold text-xs ${
                      ev.payload?.isWicket ? 'bg-red-500 text-white' : 'bg-gray-800 text-yellow-400'
                    }`}>
                      {ev.payload?.isWicket ? 'W' : ev.payload?.runs}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 text-center py-10">No ball events recorded for this match yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
