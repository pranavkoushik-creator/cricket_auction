import React, { useEffect, useState } from 'react';
import { ScrollText, Trophy, Star, Crosshair } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import type { MatchScorecard } from '../../types';
import { ConsoleModal } from './ConsoleModal';

const formatDismissal = (b: any) => {
  if (b.dismissal_type === 'run_out') return b.dismissal_fielder_name ? `run out by ${b.dismissal_fielder_name}` : 'run out';
  if (b.dismissal_type === 'caught') return `c ${b.dismissal_fielder_name || 'sub'} b ${b.dismissal_bowler_name || 'unknown'}`;
  if (b.dismissal_type === 'stumped') return `st ${b.dismissal_fielder_name || 'sub'} b ${b.dismissal_bowler_name || 'unknown'}`;
  if (b.dismissal_type === 'lbw') return `lbw b ${b.dismissal_bowler_name || 'unknown'}`;
  if (b.dismissal_type === 'bowled') return `b ${b.dismissal_bowler_name || 'unknown'}`;
  if (b.dismissal_type === 'hit_wicket') return `hit wicket b ${b.dismissal_bowler_name || 'unknown'}`;
  return `${(b.dismissal_type || 'out').replace('_', ' ')}${b.dismissal_bowler_name ? ` b ${b.dismissal_bowler_name}` : ''}`;
};

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

      {card && card.innings.length > 0 && (
        (() => {
          const allBatters = card.innings.flatMap(inn => inn.batting.filter(b => b.status !== 'did_not_bat' && typeof b.runs === 'number'));
          const allBowlers = card.innings.flatMap(inn => inn.bowling.filter(b => typeof b.wickets === 'number'));

          const bestBatter = allBatters.length > 0 ? allBatters.reduce((best, curr) => {
            if (curr.runs > best.runs) return curr;
            if (curr.runs === best.runs && curr.strike_rate > best.strike_rate) return curr;
            return best;
          }, allBatters[0]) : null;

          const bestBowler = allBowlers.length > 0 ? allBowlers.reduce((best, curr) => {
            if (curr.wickets > best.wickets) return curr;
            if (curr.wickets === best.wickets && curr.economy < best.economy) return curr;
            return best;
          }, allBowlers[0]) : null;

          // Man of the Match calculation (Winning team only)
          const allPlayers = new Map<string, { id: string; name: string; runs: number; wickets: number; isWinner: boolean }>();
          card.innings.forEach(inn => {
            const battingIsWinner = inn.batting_team.name === card.match.winner_name;
            const bowlingIsWinner = inn.bowling_team.name === card.match.winner_name;

            inn.batting.filter(b => b.status !== 'did_not_bat').forEach(b => {
              if (!allPlayers.has(b.player_id)) allPlayers.set(b.player_id, { id: b.player_id, name: b.name, runs: 0, wickets: 0, isWinner: battingIsWinner });
              allPlayers.get(b.player_id)!.runs += b.runs;
            });

            inn.bowling.forEach(b => {
              if (!allPlayers.has(b.player_id)) allPlayers.set(b.player_id, { id: b.player_id, name: b.name, runs: 0, wickets: 0, isWinner: bowlingIsWinner });
              allPlayers.get(b.player_id)!.wickets += b.wickets;
            });
          });

          const eligibleMoM = Array.from(allPlayers.values()).filter(p => p.isWinner);
          const momPlayer = eligibleMoM.length > 0 ? eligibleMoM.reduce((best, curr) => {
            const currScore = curr.runs + (curr.wickets * 25);
            const bestScore = best.runs + (best.wickets * 25);
            return currScore > bestScore ? curr : best;
          }, eligibleMoM[0]) : null;

          if (!bestBatter && !bestBowler && !momPlayer) return null;

          return (
            <div className="mb-6 space-y-4">
              {momPlayer && (
                <div className="glass-panel rounded-xl border border-blue-500/30 p-4 flex items-center gap-5 relative overflow-hidden group w-full">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 -translate-x-full group-hover:animate-[shimmer_2s_infinite]"></div>
                  <div className="p-4 bg-blue-500/15 rounded-full border border-blue-500/40 shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                    <Star className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase font-black text-blue-400 tracking-widest drop-shadow-md">Player of the Match</p>
                    <p className="font-broadcast text-2xl text-white truncate leading-tight mt-0.5">{momPlayer.name}</p>
                    <p className="text-sm text-blue-300 font-bold mt-1">
                      {momPlayer.runs} <span className="text-gray-400 text-xs font-semibold">runs</span>
                      <span className="text-gray-500 mx-2">·</span>
                      {momPlayer.wickets} <span className="text-gray-400 text-xs font-semibold">wkts</span>
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bestBatter && (
                  <div className="glass-panel rounded-xl border border-yellow-500/20 p-4 flex items-center gap-4 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 -translate-x-full group-hover:animate-[shimmer_2s_infinite]"></div>
                    <div className="p-3 bg-yellow-500/10 rounded-full border border-yellow-500/30 shrink-0">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase font-bold text-yellow-500/70 tracking-wider">Best Batsman</p>
                      <p className="font-broadcast text-lg text-white truncate leading-tight">{bestBatter.name}</p>
                      <p className="text-xs text-yellow-400 font-bold mt-0.5">
                        {bestBatter.runs} <span className="text-gray-400 text-[11px] font-semibold">({bestBatter.balls})</span>
                        <span className="text-gray-500 mx-1.5">·</span>
                        <span className="text-gray-400 text-[11px]">SR {bestBatter.strike_rate.toFixed(1)}</span>
                      </p>
                    </div>
                  </div>
                )}
                {bestBowler && (
                  <div className="glass-panel rounded-xl border border-emerald-500/20 p-4 flex items-center gap-4 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 -translate-x-full group-hover:animate-[shimmer_2s_infinite]"></div>
                    <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/30 shrink-0">
                      <Crosshair className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase font-bold text-emerald-500/70 tracking-wider">Best Bowler</p>
                      <p className="font-broadcast text-lg text-white truncate leading-tight">{bestBowler.name}</p>
                      <p className="text-xs text-emerald-400 font-bold mt-0.5">
                        {bestBowler.wickets} <span className="text-gray-400 text-[11px] font-semibold">wkts</span>
                        <span className="text-gray-500 mx-1.5">·</span>
                        <span className="text-gray-400 text-[11px]">Econ {bestBowler.economy.toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()
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
                            ? formatDismissal(b)
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
