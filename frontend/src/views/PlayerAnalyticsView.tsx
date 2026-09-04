import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Flame, History, Search, Shield, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMatchSocket } from '../context/SocketContext';
import { apiRequest } from '../utils/api';
import type { MatchHistoryRow, PlayerAnalytics, PlayerLeaderboardRow } from '../types';
import { StatTile } from '../components/match/MatchBroadcastPanels';
import { MatchScorecardModal } from '../components/match/MatchScorecardModal';
import { getPhotoUrl } from '../utils/formatters';

type Tab = 'overall' | 'innings' | 'history';
type SortKey = 'runs' | 'wickets' | 'name';

const fmt = (n: number | null, dp = 2) => (n == null ? '—' : n.toFixed(dp));

/**
 * Player analytics and match history.
 *
 * Every figure is derived server-side from the innings rows the match engine
 * writes, so the numbers here are the same ones the scorecards show. A
 * `stats:updated` socket signal fires whenever any fixture in the tournament is
 * scored, and this view refetches on it — so it tracks a live match ball by ball.
 */
export const PlayerAnalyticsView: React.FC = () => {
  const { currentTournamentId, token } = useAuth();
  const { statsVersion, joinStats, leaveStats } = useMatchSocket();

  const [players, setPlayers] = useState<PlayerLeaderboardRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [analytics, setAnalytics] = useState<PlayerAnalytics | null>(null);
  const [history, setHistory] = useState<MatchHistoryRow[]>([]);
  const [scorecardId, setScorecardId] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('overall');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('runs');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentTournamentId) joinStats(currentTournamentId);
    return () => leaveStats();
  }, [currentTournamentId]);

  // statsVersion bumps on every scored ball in this tournament.
  useEffect(() => {
    if (!currentTournamentId || !token) return;
    apiRequest(`/stats/players?tournamentId=${currentTournamentId}`)
      .then((res: PlayerLeaderboardRow[]) => {
        setPlayers(res);
        setSelectedId(prev => (res.some(p => p.id === prev) ? prev : (res[0]?.id ?? '')));
        setError(null);
      })
      .catch(err => setError(err.message));

    apiRequest(`/stats/matches?tournamentId=${currentTournamentId}`)
      .then(setHistory)
      .catch(() => { /* history is secondary; the player list drives the page */ });
  }, [currentTournamentId, token, statsVersion]);

  useEffect(() => {
    if (!selectedId || !currentTournamentId) return;
    apiRequest(`/stats/players/${selectedId}?tournamentId=${currentTournamentId}`)
      .then(setAnalytics)
      .catch(err => setError(err.message));
  }, [selectedId, currentTournamentId, statsVersion]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? players.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.franchise_short || '').toLowerCase().includes(q) ||
        (p.role || '').toLowerCase().includes(q))
      : players;

    return [...rows].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'wickets') return b.wickets - a.wickets || b.runs - a.runs;
      return b.runs - a.runs || b.wickets - a.wickets;
    });
  }, [players, query, sort]);

  const p = analytics?.player;
  const bat = analytics?.batting;
  const bowl = analytics?.bowling;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-broadcast text-xl text-white">SAKHA PLAYER ANALYTICS</h2>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live figures
        </span>
      </div>

      {error && <p className="text-xs font-bold text-red-400">{error}</p>}

      <div className="grid lg:grid-cols-4 gap-4">
        {/* ---------------- Player picker ---------------- */}
        <div className="lg:col-span-1 glass-card rounded-xl border border-cricket-border/50 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-cricket-border/50 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search player, team, role"
                className="w-full bg-cricket-card text-xs text-gray-200 border border-cricket-border rounded-lg pl-8 pr-2.5 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { k: 'runs', l: 'Runs' },
                { k: 'wickets', l: 'Wickets' },
                { k: 'name', l: 'A–Z' }
              ] as { k: SortKey; l: string }[]).map(o => (
                <button
                  key={o.k}
                  onClick={() => setSort(o.k)}
                  className={`py-1.5 rounded-lg text-[10px] font-black border transition ${sort === o.k
                    ? 'bg-blue-600/25 text-blue-300 border-blue-500/40'
                    : 'bg-gray-900/50 text-gray-400 border-cricket-border/50 hover:text-gray-200'
                    }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[560px] overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-xs text-gray-600 font-semibold text-center py-6">No players match</p>
            )}
            {filtered.map(row => {
              const active = row.id === selectedId;
              return (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-cricket-border/20 last:border-0 text-left transition ${active ? 'bg-blue-600/15' : 'hover:bg-gray-800/40'
                    }`}
                >
                  <img
                    src={getPhotoUrl(row.photo_url || undefined)}
                    alt={row.name}
                    className="w-8 h-8 rounded-full object-cover object-[center_30%] border-2 shrink-0"
                    style={{ borderColor: row.franchise_color || '#2A354D' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${active ? 'text-blue-300' : 'text-white'}`}>
                      {row.name}
                    </p>
                    <p className="text-[10px] text-gray-500 font-semibold truncate">
                      {row.franchise_short || 'Unsold'}{row.role ? ` · ${row.role}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-black text-white tabular-nums">{row.runs}</p>
                    <p className="text-[9px] text-gray-500 font-bold tabular-nums">{row.wickets} wkt</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------------- Detail ---------------- */}
        <div className="lg:col-span-3 space-y-4">
          {!analytics || !p || !bat || !bowl ? (
            <div className="glass-panel rounded-2xl border border-cricket-border/50 p-10 text-center">
              <BarChart3 className="w-9 h-9 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-300 font-bold">Select a player</p>
            </div>
          ) : (
            <>
              {/* Identity */}
              <div
                className="rounded-2xl border p-5 relative overflow-hidden"
                style={{
                  backgroundColor: p.franchise?.primary_color ? `${p.franchise.primary_color}15` : '#1e293b',
                  borderColor: p.franchise?.primary_color ? `${p.franchise.primary_color}40` : '#334155'
                }}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <img
                    src={getPhotoUrl(p.photo_url || undefined)}
                    alt={p.name}
                    className="w-20 h-20 rounded-full object-cover object-[center_30%] border-4 shadow-xl shrink-0"
                    style={{ borderColor: p.franchise?.secondary_color || '#2A354D' }}
                  />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-broadcast text-2xl text-white leading-none">{p.name}</h3>
                    {Boolean(p.is_captain) && (
                      <span className="px-1.5 py-0.5 rounded bg-cricket-gold text-black text-[9px] font-black uppercase flex items-center gap-1">
                        <Star className="w-2.5 h-2.5" /> Captain
                      </span>
                    )}
                    {Boolean(p.is_foreign) && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[9px] font-black uppercase">
                        Overseas
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-gray-300 mt-1 flex items-center gap-1.5">
                    <Shield className="w-3 h-3" />
                    {p.franchise?.name || 'Unsold'}
                    {p.role && <span className="text-gray-500">· {p.role}</span>}
                    <span className="text-gray-500">· {p.group_name}</span>
                  </p>
                  <p className="text-[10px] text-gray-500 font-semibold mt-0.5 tabular-nums">
                    Base ₹{p.base_price.toLocaleString()}
                    {p.sold_price != null && <> · Sold ₹{p.sold_price.toLocaleString()}</>}
                  </p>
                </div>
              </div>
            </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-900/60 border border-cricket-border/50 w-fit">
                {([
                  { k: 'overall', l: 'Overall', i: BarChart3 },
                  { k: 'innings', l: 'Innings by Innings', i: Activity },
                  { k: 'history', l: 'Match History', i: History }
                ] as { k: Tab; l: string; i: typeof BarChart3 }[]).map(o => {
                  const Icon = o.i;
                  return (
                    <button
                      key={o.k}
                      onClick={() => setTab(o.k)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${tab === o.k
                        ? 'bg-blue-600/25 text-blue-300 border border-blue-500/40'
                        : 'text-gray-400 hover:text-gray-200'
                        }`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {o.l}
                    </button>
                  );
                })}
              </div>

              {/* ---- Overall ---- */}
              {tab === 'overall' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 mb-2 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-cricket-gold" /> Batting
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                      <StatTile label="Matches" value={bat.matches} />
                      <StatTile label="Innings" value={bat.innings} />
                      <StatTile label="Runs" value={bat.runs} tone="gold" />
                      <StatTile label="Average" value={fmt(bat.average)} hint={`${bat.not_outs} not out`} tone="blue" />
                      <StatTile label="Strike Rate" value={bat.strike_rate.toFixed(2)} tone="green" />
                      <StatTile
                        label="Highest"
                        value={`${bat.highest_score}${bat.highest_not_out ? '*' : ''}`}
                        hint={`${bat.fifties}x50 ${bat.hundreds}x100`}
                      />
                      <StatTile label="Balls Faced" value={bat.balls} />
                      <StatTile label="Fours" value={bat.fours} />
                      <StatTile label="Sixes" value={bat.sixes} />
                      <StatTile label="Fifties" value={bat.fifties} />
                      <StatTile label="Hundreds" value={bat.hundreds} />
                      <StatTile label="Ducks" value={bat.ducks} tone="red" />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 mb-2 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-red-400" /> Bowling
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                      <StatTile label="Innings" value={bowl.innings} />
                      <StatTile label="Overs" value={bowl.overs} />
                      <StatTile label="Wickets" value={bowl.wickets} tone="gold" />
                      <StatTile label="Economy" value={bowl.economy.toFixed(2)} tone="green" />
                      <StatTile label="Average" value={fmt(bowl.average)} tone="blue" />
                      <StatTile label="Strike Rate" value={fmt(bowl.strike_rate, 1)} />
                      <StatTile label="Runs Conceded" value={bowl.runs} />
                      <StatTile label="Maidens" value={bowl.maidens} />
                      <StatTile
                        label="Best"
                        value={bowl.best_wickets > 0 || bowl.innings > 0 ? `${bowl.best_wickets}/${bowl.best_runs}` : '—'}
                      />
                      <StatTile label="3-fers" value={bowl.three_wicket_hauls} />
                      <StatTile label="5-fers" value={bowl.five_wicket_hauls} tone="red" />
                    </div>
                  </div>

                  {(analytics.recent_batting.length > 0 || analytics.recent_bowling.length > 0) && (
                    <div className="glass-card rounded-xl border border-cricket-border/50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 mb-2.5">Recent Form</p>
                      <div className="flex flex-wrap gap-2">
                        {analytics.recent_batting.map((r, i) => (
                          <span key={`b${i}`} className="activity-event-pill px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-300 tabular-nums">
                            {r.runs}{r.not_out ? '*' : ''} <span className="text-gray-500">({r.balls}) v {r.opponent_short}</span>
                          </span>
                        ))}
                        {analytics.recent_bowling.map((r, i) => (
                          <span key={`w${i}`} className="activity-event-pill px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-200 tabular-nums">
                            {r.wickets}/{r.runs} <span className="text-gray-500">({r.overs}) v {r.opponent_short}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ---- Innings by innings ---- */}
              {tab === 'innings' && (
                <div className="space-y-4">
                  <InningsTable
                    title="Batting — every innings"
                    icon={<Activity className="w-3.5 h-3.5 text-cricket-gold" />}
                    empty="This player has not batted yet"
                    headers={['Match', 'Opponent', 'Runs', 'Balls', '4s', '6s', 'SR', 'Dismissal']}
                    rows={analytics.batting_innings.map(r => [
                      `#${r.match_number}${r.match_status === 'live' ? ' ·live' : ''}`,
                      r.opponent_short,
                      `${r.runs}${r.not_out ? '*' : ''}`,
                      r.balls,
                      r.fours,
                      r.sixes,
                      r.strike_rate.toFixed(1),
                      r.status === 'out'
                        ? `${(r.dismissal_type || 'out').replace('_', ' ')}${r.dismissal_bowler_name ? ` b ${r.dismissal_bowler_name}` : ''}`
                        : r.status === 'batting' ? 'batting' : 'not out'
                    ])}
                  />
                  <InningsTable
                    title="Bowling — every spell"
                    icon={<Flame className="w-3.5 h-3.5 text-red-400" />}
                    empty="This player has not bowled yet"
                    headers={['Match', 'Opponent', 'Overs', 'Maidens', 'Runs', 'Wickets', 'Econ']}
                    rows={analytics.bowling_innings.map(r => [
                      `#${r.match_number}${r.match_status === 'live' ? ' ·live' : ''}`,
                      r.opponent_short,
                      r.overs,
                      r.maidens,
                      r.runs,
                      r.wickets,
                      r.economy.toFixed(2)
                    ])}
                  />
                </div>
              )}

              {/* ---- Match history ---- */}
              {tab === 'history' && (
                <div className="glass-card rounded-xl border border-cricket-border/50 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-cricket-border/50 flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-blue-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">
                      Stored Match Records ({history.length})
                    </p>
                  </div>
                  {history.length === 0 && (
                    <p className="text-xs text-gray-600 font-semibold text-center py-8">
                      No matches have been played yet
                    </p>
                  )}
                  {history.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setScorecardId(m.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-cricket-border/20 last:border-0 hover:bg-gray-800/40 transition text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-black text-gray-500 text-xs tabular-nums w-8 shrink-0">#{m.match_number}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {m.home_team_short} v {m.away_team_short}
                          </p>
                          <p className="text-[10px] text-gray-500 font-semibold truncate">
                            {m.result_summary || `${m.stage}${m.venue ? ` · ${m.venue}` : ''}`}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase shrink-0 ${m.status === 'live'
                        ? 'bg-red-600/20 text-red-300 border-red-500/40'
                        : 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                        {m.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <MatchScorecardModal
        isOpen={Boolean(scorecardId)}
        matchId={scorecardId}
        onClose={() => setScorecardId(null)}
      />
    </div>
  );
};

const InningsTable: React.FC<{
  title: string;
  icon: React.ReactNode;
  empty: string;
  headers: string[];
  rows: (string | number)[][];
}> = ({ title, icon, empty, headers, rows }) => (
  <div className="glass-card rounded-xl border border-cricket-border/50 overflow-hidden">
    <div className="px-4 py-2.5 border-b border-cricket-border/50 flex items-center gap-2">
      {icon}
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">{title}</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[560px]">
        <thead>
          <tr className="text-[9px] uppercase text-gray-500 border-b border-cricket-border/40">
            {headers.map((h, i) => (
              <th key={h} className={`py-2 px-3 font-black ${i === 0 || i === 1 || i === headers.length - 1 ? 'text-left' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} className="py-5 text-center text-gray-600 font-semibold">{empty}</td></tr>
          )}
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-cricket-border/20 last:border-0">
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className={`py-2 px-3 tabular-nums ${ci === 0 || ci === 1 || ci === r.length - 1 ? 'text-left' : 'text-right'} ${ci === 2 ? 'font-black text-white' : 'text-gray-300'}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
