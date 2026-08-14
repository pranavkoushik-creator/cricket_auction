import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { Activity, Flame, Calendar, Trophy, RefreshCw, MapPin } from 'lucide-react';

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
            if (ev.eventType === 'ball') balls += 1;
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

  const recordBall = (runs: number, isWicket: boolean = false, extraType?: string) => {
    if (!selectedMatchId || !token) return;

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
    if (!selectedMatchId || !token) return;

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
        loadStandings();
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
        <>
          {matchDetails && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Scoreboard & Buttons */}
              <div className="lg:col-span-2 space-y-6">
                {/* Scorecard Banner */}
                <div className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-4 text-center relative overflow-hidden">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3 text-xs">
                    <span className="text-gray-400 font-semibold">{matchDetails.stage} · Match #{matchDetails.match_number}</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase ${matchDetails.status === 'live' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-gray-800 text-gray-300'
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
                          className={`py-3.5 rounded-xl font-black text-base border transition ${runs === 4 || runs === 6
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
                        <span className={`px-2 py-0.5 rounded font-extrabold text-xs ${ev.payload?.isWicket ? 'bg-red-500 text-white' : 'bg-gray-800 text-yellow-400'
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

          {/* Tournament Fixtures & Points Table Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
            {/* Left 2 Cols: Match Fixtures List */}
            <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-pink-400" />
                  <span>Tournament Match Schedule</span>
                </h3>
                <button
                  onClick={handleGenerateFixtures}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-[10px] border border-gray-700 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate Schedule</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                {matches.map(m => (
                  <div key={m.id} className="glass-card p-4 rounded-xl border border-gray-800 space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="font-semibold text-gray-300">Match #{m.match_number} · {m.stage}</span>
                      <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${m.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : m.status === 'live'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse'
                            : 'bg-gray-800 text-gray-400'
                        }`}>
                        {m.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="text-center space-y-1">
                        <img src={m.home_team_logo} alt={m.home_team_name} className="w-10 h-10 mx-auto rounded-full object-cover border border-gray-700" />
                        <p className="font-bold text-white text-xs">{m.home_team_short}</p>
                      </div>
                      <span className="font-black text-gray-500 text-sm">VS</span>
                      <div className="text-center space-y-1">
                        <img src={m.away_team_logo} alt={m.away_team_name} className="w-10 h-10 mx-auto rounded-full object-cover border border-gray-700" />
                        <p className="font-bold text-white text-xs">{m.away_team_short}</p>
                      </div>
                    </div>

                    <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-gray-800">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-500" />
                        <span>{m.venue}</span>
                      </span>
                      <span>{new Date(m.scheduled_time).toLocaleDateString()}</span>
                    </div>

                    {m.result_summary && (
                      <div className="p-2 bg-emerald-950/60 border border-emerald-500/30 rounded-lg text-emerald-300 font-semibold text-[11px]">
                        Result: {m.result_summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Col: Standings Table */}
            <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span>Points Table &amp; NRR</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 uppercase font-semibold">
                      <th className="py-2 px-1">#</th>
                      <th className="py-2 px-1">Team</th>
                      <th className="py-2 px-1 text-center">P</th>
                      <th className="py-2 px-1 text-center">W</th>
                      <th className="py-2 px-1 text-center">L</th>
                      <th className="py-2 px-1 text-center">Pts</th>
                      <th className="py-2 px-1 text-right">NRR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {standings.map(row => (
                      <tr key={row.id} className="hover:bg-gray-900/40">
                        <td className="py-2.5 px-1 font-bold text-gray-400">{row.position}</td>
                        <td className="py-2.5 px-1 font-bold text-white flex items-center space-x-1.5">
                          <img src={row.franchise_logo} alt={row.franchise_name} className="w-4 h-4 rounded-full object-cover" />
                          <span>{row.franchise_short}</span>
                        </td>
                        <td className="py-2.5 px-1 text-center text-gray-300">{row.played}</td>
                        <td className="py-2.5 px-1 text-center text-emerald-400 font-bold">{row.won}</td>
                        <td className="py-2.5 px-1 text-center text-red-400">{row.lost}</td>
                        <td className="py-2.5 px-1 text-center font-extrabold text-yellow-400">{row.points}</td>
                        <td className="py-2.5 px-1 text-right font-mono text-cyan-300">{row.nrr > 0 ? `+${row.nrr}` : row.nrr}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
