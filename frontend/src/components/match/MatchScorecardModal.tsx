import React, { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import type { MatchScorecard } from '../../types';
import { ConsoleModal } from './ConsoleModal';

/**
 * The stored record of a single match: both innings in full, exactly as the
 * engine recorded them. This is the archive an auction can be priced against.
 */
export const MatchScorecardModal: React.FC<{
  isOpen: boolean;
  matchId: string | null;
  onClose: () => void;
}> = ({ isOpen, matchId, onClose }) => {
  const [card, setCard] = useState<MatchScorecard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !matchId) return;
    setCard(null);
    setError(null);
    apiRequest(`/stats/matches/${matchId}`)
      .then(setCard)
      .catch(err => setError(err.message));
  }, [isOpen, matchId]);

  const m = card?.match;

  return (
    <ConsoleModal
      isOpen={isOpen}
      onClose={onClose}
      title={m ? `Match ${m.match_number} · ${m.home_team.short_name} v ${m.away_team.short_name}` : 'Scorecard'}
      subtitle={m ? (m.result_summary || `${m.stage}${m.venue ? ` · ${m.venue}` : ''}`) : undefined}
      icon={<ScrollText className="w-4 h-4 shrink-0" />}
      wide
    >
      {error && <p className="text-xs font-bold text-red-400">{error}</p>}
      {!card && !error && <p className="text-xs text-gray-500 font-semibold text-center py-8">Loading scorecard…</p>}

      {card && card.innings.length === 0 && (
        <p className="text-xs text-gray-600 font-semibold text-center py-8">
          No innings were recorded for this match.
        </p>
      )}

      <div className="space-y-5">
        {card?.innings.map(inn => (
          <div key={inn.innings_number} className="rounded-xl border border-cricket-border/50 overflow-hidden">
            <div
              className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
              style={{ background: `linear-gradient(100deg, ${inn.batting_team.primary_color}40 0%, transparent 70%)` }}
            >
              <div className="min-w-0">
                <p className="font-broadcast text-sm text-white truncate">{inn.batting_team.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Innings {inn.innings_number} · v {inn.bowling_team.short_name}
                  {inn.target != null && <> · target {inn.target}</>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-broadcast text-xl text-white tabular-nums leading-none">
                  {inn.runs}/{inn.wickets}
                </p>
                <p className="text-[10px] text-gray-400 font-bold tabular-nums">
                  {inn.overs} ov · RR {inn.run_rate.toFixed(2)} · Extras {inn.extras}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead>
                  <tr className="text-[9px] uppercase text-gray-500 border-y border-cricket-border/40 bg-gray-900/30">
                    <th className="text-left py-2 px-3 font-black">Batter</th>
                    <th className="text-right py-2 px-2 font-black">R</th>
                    <th className="text-right py-2 px-2 font-black">B</th>
                    <th className="text-right py-2 px-2 font-black">4s</th>
                    <th className="text-right py-2 px-2 font-black">6s</th>
                    <th className="text-right py-2 px-3 font-black">SR</th>
                  </tr>
                </thead>
                <tbody>
                  {inn.batting.filter(b => b.status !== 'did_not_bat').map(b => (
                    <tr key={b.player_id} className="border-b border-cricket-border/20 last:border-0">
                      <td className="py-2 px-3">
                        <p className={`font-bold truncate ${b.status === 'out' ? 'text-gray-400' : 'text-white'}`}>{b.name}</p>
                        <p className="text-[9px] text-gray-500 font-semibold">
                          {b.status === 'out'
                            ? `${(b.dismissal_type || 'out').replace('_', ' ')}${b.dismissal_bowler_name ? ` b ${b.dismissal_bowler_name}` : ''}`
                            : b.status === 'batting' ? 'batting' : 'not out'}
                        </p>
                      </td>
                      <td className="text-right py-2 px-2 font-black text-white tabular-nums">{b.runs}</td>
                      <td className="text-right py-2 px-2 text-gray-400 tabular-nums">{b.balls}</td>
                      <td className="text-right py-2 px-2 text-gray-400 tabular-nums">{b.fours}</td>
                      <td className="text-right py-2 px-2 text-gray-400 tabular-nums">{b.sixes}</td>
                      <td className="text-right py-2 px-3 text-gray-400 tabular-nums">{b.strike_rate.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {inn.fall_of_wickets.length > 0 && (
              <div className="px-3 py-2 border-t border-cricket-border/30 flex flex-wrap gap-1.5">
                {inn.fall_of_wickets.map(w => (
                  <span key={w.player_id} className="activity-event-pill px-2 py-0.5 rounded text-[10px] font-bold text-gray-300 tabular-nums">
                    <span className="text-red-400">{w.score}-{w.order}</span> {w.name} ({w.overs})
                  </span>
                ))}
              </div>
            )}

            <div className="overflow-x-auto border-t border-cricket-border/40">
              <table className="w-full text-xs min-w-[440px]">
                <thead>
                  <tr className="text-[9px] uppercase text-gray-500 border-b border-cricket-border/40 bg-gray-900/30">
                    <th className="text-left py-2 px-3 font-black">Bowler</th>
                    <th className="text-right py-2 px-2 font-black">O</th>
                    <th className="text-right py-2 px-2 font-black">M</th>
                    <th className="text-right py-2 px-2 font-black">R</th>
                    <th className="text-right py-2 px-2 font-black">W</th>
                    <th className="text-right py-2 px-3 font-black">Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {inn.bowling.map(b => (
                    <tr key={b.player_id} className="border-b border-cricket-border/20 last:border-0">
                      <td className="py-2 px-3 font-bold text-white truncate">{b.name}</td>
                      <td className="text-right py-2 px-2 text-gray-300 tabular-nums">{b.overs}</td>
                      <td className="text-right py-2 px-2 text-gray-400 tabular-nums">{b.maidens}</td>
                      <td className="text-right py-2 px-2 text-gray-400 tabular-nums">{b.runs}</td>
                      <td className="text-right py-2 px-2 font-black text-white tabular-nums">{b.wickets}</td>
                      <td className="text-right py-2 px-3 text-gray-400 tabular-nums">{b.economy.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </ConsoleModal>
  );
};
