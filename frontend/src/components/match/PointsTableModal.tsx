import React, { useEffect, useState } from 'react';
import { RefreshCw, Trophy } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import type { PointsTableEntry } from '../../types';
import { ConsoleModal } from './ConsoleModal';

/**
 * Standings for the current tournament, read from the same points_table the
 * match engine maintains. Refetched whenever it is opened so it reflects the
 * result of whatever was just scored.
 */
export const PointsTableModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
}> = ({ isOpen, onClose, tournamentId }) => {
  const [rows, setRows] = useState<PointsTableEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!tournamentId) return;
    setLoading(true);
    apiRequest(`/matches/standings?tournamentId=${tournamentId}`)
      .then((res: PointsTableEntry[]) => { setRows(res); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isOpen) load(); }, [isOpen, tournamentId]);

  const played = rows.reduce((n, r) => n + r.played, 0);

  return (
    <ConsoleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Points Table"
      subtitle={played === 0 ? 'No matches completed yet' : `${played / 2 | 0} match${played / 2 === 1 ? '' : 'es'} counted`}
      icon={<Trophy className="w-4 h-4 shrink-0" />}
      wide
    >
      <div className="flex justify-end mb-3">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-700/70 text-gray-300 border border-cricket-border/60 text-[11px] font-bold transition disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <p className="text-xs font-bold text-red-400 mb-3">{error}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-cricket-border/50">
        <table className="w-full text-xs min-w-[560px]">
          <thead>
            <tr className="text-[9px] uppercase text-gray-500 border-b border-cricket-border/50 bg-gray-900/40">
              <th className="text-left py-2.5 px-3 font-black">#</th>
              <th className="text-left py-2.5 px-2 font-black">Team</th>
              <th className="text-right py-2.5 px-2 font-black">P</th>
              <th className="text-right py-2.5 px-2 font-black">W</th>
              <th className="text-right py-2.5 px-2 font-black">L</th>
              <th className="text-right py-2.5 px-2 font-black">Pts</th>
              <th className="text-right py-2.5 px-3 font-black">NRR</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr><td colSpan={7} className="py-6 text-center text-gray-600 font-semibold">No standings yet</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-cricket-border/20 last:border-0">
                <td className="py-2.5 px-3 font-black text-gray-500 tabular-nums">{r.position || i + 1}</td>
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 overflow-hidden"
                      style={{ backgroundColor: r.primary_color }}
                    >
                      {r.franchise_logo
                        ? <img src={r.franchise_logo} alt={r.franchise_short} className="w-full h-full object-cover" />
                        : r.franchise_short}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{r.franchise_name}</p>
                      <p className="text-[9px] text-gray-500 font-semibold">{r.franchise_short}</p>
                    </div>
                  </div>
                </td>
                <td className="text-right py-2.5 px-2 text-gray-300 tabular-nums">{r.played}</td>
                <td className="text-right py-2.5 px-2 text-emerald-400 font-bold tabular-nums">{r.won}</td>
                <td className="text-right py-2.5 px-2 text-red-400 tabular-nums">{r.lost}</td>
                <td className="text-right py-2.5 px-2 font-black text-cricket-gold tabular-nums">{r.points}</td>
                <td className={`text-right py-2.5 px-3 font-bold tabular-nums ${Number(r.nrr) > 0 ? 'text-emerald-400' : Number(r.nrr) < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {Number(r.nrr) > 0 ? '+' : ''}{Number(r.nrr).toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-gray-500 font-semibold mt-3">
        Two points per win. Net run rate is runs scored per over minus runs conceded per over,
        with a side bowled out charged the full quota.
      </p>
    </ConsoleModal>
  );
};
