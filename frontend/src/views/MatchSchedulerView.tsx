import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { Calendar, Trophy, RefreshCw, MapPin } from 'lucide-react';

export const MatchSchedulerView: React.FC = () => {
  const { currentTournamentId } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);

  const loadData = () => {
    apiRequest(`/matches?tournamentId=${currentTournamentId}`)
      .then(setMatches)
      .catch(console.error);

    apiRequest(`/matches/standings?tournamentId=${currentTournamentId}`)
      .then(setStandings)
      .catch(console.error);
  };

  useEffect(() => {
    loadData();
  }, [currentTournamentId]);

  const handleGenerateFixtures = () => {
    apiRequest('/matches/generate', {
      method: 'POST',
      body: JSON.stringify({ tournamentId: currentTournamentId })
    })
      .then(() => loadData())
      .catch(console.error);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-blue-500/30">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/40">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">MATCH FIXTURES & STANDINGS TABLE</h2>
            <p className="text-xs text-gray-400">Round Robin fixture scheduling & auto-calculated Points Table with NRR</p>
          </div>
        </div>

        <button
          onClick={handleGenerateFixtures}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Auto-Generate Round Robin Fixtures</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Match Fixtures List */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <Calendar className="w-5 h-5 text-blue-400" />
            <span>Tournament Match Schedule</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map(m => (
              <div key={m.id} className="glass-card p-4 rounded-xl border border-gray-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="font-semibold text-gray-300">Match #{m.match_number} · {m.stage}</span>
                  <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                    m.status === 'completed'
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

        {/* Right Col: Auto-Recalculated Points Table & NRR */}
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span>Points Table & NRR</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 uppercase font-semibold">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Team</th>
                  <th className="py-2 px-2 text-center">P</th>
                  <th className="py-2 px-2 text-center">W</th>
                  <th className="py-2 px-2 text-center">L</th>
                  <th className="py-2 px-2 text-center">Pts</th>
                  <th className="py-2 px-2 text-right">NRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {standings.map(row => (
                  <tr key={row.id} className="hover:bg-gray-900/40">
                    <td className="py-2.5 px-2 font-bold text-gray-400">{row.position}</td>
                    <td className="py-2.5 px-2 font-bold text-white flex items-center space-x-2">
                      <img src={row.franchise_logo} alt={row.franchise_name} className="w-5 h-5 rounded-full object-cover" />
                      <span>{row.franchise_short}</span>
                    </td>
                    <td className="py-2.5 px-2 text-center text-gray-300">{row.played}</td>
                    <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">{row.won}</td>
                    <td className="py-2.5 px-2 text-center text-red-400">{row.lost}</td>
                    <td className="py-2.5 px-2 text-center font-extrabold text-yellow-400">{row.points}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-cyan-300">{row.nrr > 0 ? `+${row.nrr}` : row.nrr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
