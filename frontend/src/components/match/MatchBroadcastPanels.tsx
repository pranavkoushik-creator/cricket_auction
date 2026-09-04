import React from 'react';
import { Activity, Flame, MapPin, Radio, Target, TrendingUp, Trophy, User } from 'lucide-react';
import { getPhotoUrl } from '../../utils/formatters';
import type {
  BattingCard,
  BowlingCard,
  FallOfWicket,
  InningsSummary,
  LiveMatchState,
  MatchFeedEntry,
  OverBall,
  OverGroup,
  TeamBrand
} from '../../types';

/**
 * Presentational building blocks for the live match broadcast.
 *
 * Styled as a TV scoreboard: angled team-coloured banners, framed player
 * portraits with a stat strip beneath, and an over-by-over ribbon. Both
 * LiveMatchBroadcastView (spectator) and LiveMatchScorerView (admin) compose
 * these, so the console mirrors exactly what is on air.
 */

// const AVATAR_FALLBACK = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80';

/**
 * Picks black or white text for a team-coloured surface. Franchise colours are
 * author-supplied and range from near-black to gold, so contrast cannot be
 * assumed. Uses the WCAG relative-luminance formula.
 */
function readableOn(hex: string): string {
  const clean = (hex || '#3b82f6').replace('#', '');
  if (clean.length !== 6) return '#ffffff';
  const channel = (h: string) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const l = 0.2126 * channel(clean.slice(0, 2)) + 0.7152 * channel(clean.slice(2, 4)) + 0.0722 * channel(clean.slice(4, 6));
  return l > 0.42 ? '#0B0F19' : '#ffffff';
}

const Crest: React.FC<{ team: TeamBrand; size?: string }> = ({ team, size = 'w-9 h-9' }) => (
  <div
    className={`${size} rounded-full border-2 flex items-center justify-center overflow-hidden shrink-0`}
    style={{ backgroundColor: team.primary_color, borderColor: team.secondary_color }}
  >
    {team.logo_url ? (
      <img src={team.logo_url} alt={team.short_name} className="w-full h-full object-cover" />
    ) : (
      <span className="font-black text-[10px]" style={{ color: readableOn(team.primary_color) }}>
        {team.short_name}
      </span>
    )}
  </div>
);

// ============================================================ header

export const MatchHeaderBar: React.FC<{ state: LiveMatchState }> = ({ state }) => {
  const isLive = state.status === 'live';

  const Side: React.FC<{ team: TeamBrand; right?: boolean }> = ({ team, right }) => (
    <div className={`flex items-center gap-2.5 min-w-0 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <Crest team={team} size="w-11 h-11 sm:w-12 sm:h-12" />
      <div className="min-w-0">
        <p className="font-broadcast text-base sm:text-xl text-white leading-none truncate pr-2 py-0.5">{team.name}</p>
        <p className="text-[11px] text-gray-300 font-bold truncate leading-tight">{team.short_name}</p>
        {team.owner_name && (
          <p className={`text-[9px] text-gray-500 truncate flex items-center gap-1 ${right ? 'justify-end' : ''}`}>
            <User className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">{team.owner_name}</span>
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="glass-panel rounded-2xl border border-cricket-border/60 overflow-hidden">
      <div className="auction-banner-header px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="w-4 h-4 shrink-0" />
          <span className="font-black text-xs uppercase tracking-wider truncate">
            Match {state.match_number} · {state.stage}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold min-w-0">
          {state.venue && (
            <span className="hidden sm:flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{state.venue}</span>
            </span>
          )}
          {state.status !== 'upcoming' && (
            <span className="px-2 py-0.5 rounded-full bg-black/25 uppercase tracking-wide shrink-0">
              {state.overs_limit} overs
            </span>
          )}
        </div>
      </div>

      {/* Team colour wash behind the fixture line */}
      <div
        className="relative px-4 sm:px-5 py-4 flex items-center justify-between gap-3"
        style={{
          background: `linear-gradient(100deg, ${state.home_team.primary_color}40 0%, transparent 38%, transparent 62%, ${state.away_team.primary_color}40 100%)`
        }}
      >
        <Side team={state.home_team} />

        <div className="flex flex-col items-center shrink-0 px-2">
          {isLive ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/25 border border-red-500/60 text-red-300 text-[10px] font-black uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-gray-700/50 border border-gray-600/50 text-gray-300 text-[10px] font-black uppercase tracking-wider">
              {state.status}
            </span>
          )}
          <span className="font-broadcast text-pink-400 text-2xl mt-1 drop-shadow-[0_0_10px_rgba(244,114,182,0.5)]">VS</span>
        </div>

        <Side team={state.away_team} right />
      </div>

      {state.result_summary && (
        <div className="px-4 py-2.5 bg-emerald-600/20 border-t border-emerald-500/40 overflow-hidden">
          <div className="bc-ticker-track">
            {[0, 1].map(i => (
              <span key={i} className="font-broadcast text-emerald-300 text-sm px-6">
                🏆 {state.result_summary}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================ hero score

export const ScorePanel: React.FC<{ state: LiveMatchState }> = ({ state }) => {
  const innings = state.innings;

  if (!innings) {
    return (
      <div className="glass-card rounded-2xl border border-dashed border-cricket-border/60 p-10 text-center">
        <Radio className="w-9 h-9 text-gray-600 mx-auto mb-2" />
        <p className="text-gray-300 font-black text-sm uppercase tracking-wider">Innings has not started</p>
        <p className="text-gray-600 text-xs mt-1">The scorer will open the innings shortly.</p>
      </div>
    );
  }

  const team = innings.batting_team;
  const chasing = innings.target != null && innings.status === 'in_progress';
  const progress = Math.min(100, (innings.balls / (state.overs_limit * 6)) * 100);

  return (
    <div
      className="relative rounded-2xl border border-cricket-border/60 overflow-hidden"
      style={{ background: `linear-gradient(115deg, ${team.primary_color}55 0%, rgba(21,28,44,0.9) 45%, rgba(11,15,25,0.95) 100%)` }}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <Crest team={team} size="w-8 h-8" />
            <div className="min-w-0">
              <p className="font-broadcast text-sm text-white leading-none">{team.name}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mt-0.5">
                Innings {innings.innings_number} · v {innings.bowling_team.short_name}
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-[10px] font-black uppercase tracking-wider text-gray-300 shrink-0">
            {innings.status === 'completed' ? 'Innings closed' : 'Batting'}
          </span>
        </div>

        <div className="flex items-end gap-4 flex-wrap">
          <p className="font-broadcast text-6xl sm:text-7xl text-white leading-[0.9] tabular-nums drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]">
            {innings.runs}<span className="text-gray-500">/</span>{innings.wickets}
          </p>
          <div className="pb-2">
            <p className="font-broadcast text-xl text-gray-300 tabular-nums leading-none">
              {innings.overs}<span className="text-gray-600 text-sm"> / {state.overs_limit}.0</span>
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-500 mt-1">Overs</p>
          </div>
        </div>

        {/* Innings progress */}
        <div className="mt-4 h-1.5 rounded-full bg-black/40 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: team.primary_color }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-black">
          <span className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 tabular-nums">
            CRR {innings.run_rate.toFixed(2)}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-gray-700/50 text-gray-300 border border-gray-600/40 tabular-nums">
            EXTRAS {innings.extras}
          </span>
          {chasing && (
            <>
              <span className="px-2.5 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 tabular-nums">
                TARGET {innings.target}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 tabular-nums">
                RRR {state.required_run_rate?.toFixed(2)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================ player cards

const StatCell: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex-1 text-center px-1 min-w-0">
    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-gray-400 leading-none">{label}</p>
    <p className="font-broadcast text-[13px] text-white leading-tight tabular-nums truncate">{value}</p>
  </div>
);

const PlayerBroadcastCard: React.FC<{
  team: TeamBrand;
  role: string;
  name: string;
  photo: string | null;
  figure: React.ReactNode;
  stats: { label: string; value: string | number }[];
  highlight?: boolean;
  muted?: boolean;
}> = ({ team, role, name, photo, figure, stats, highlight, muted }) => {
  return (
    <div
      className={`bc-player-card rounded-2xl border overflow-hidden transition h-full flex flex-col min-h-[248px] ${highlight ? 'bc-striker-glow border-transparent' : 'border-cricket-border/60'
        } ${muted ? 'opacity-60' : ''}`}
      style={{ ['--bc-team' as string]: team.primary_color }}
    >
      {/* Angled role banner */}
      <div className="relative z-10 shrink-0 flex items-center justify-between gap-2 px-3 py-2">
        <Crest team={team} size="w-7 h-7" />
        <div className="bc-skew px-3 py-1 rounded" style={{ backgroundColor: team.secondary_color }}>
          <span className="block text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: readableOn(team.secondary_color) }}>
            {role}
          </span>
        </div>
      </div>

      {/* Portrait, identity and headline figure.
          The avatar is deliberately small: player photos are 200px wide, so
          stretching one across the full card width only makes it blurry. A
          contained circle stays sharp and frames any crop cleanly. */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-3 pt-2 pb-3">
        {highlight && (
          <span className="absolute top-0 right-3 px-1.5 py-0.5 rounded bg-cricket-gold text-black text-[8px] font-black uppercase tracking-wider shadow-lg">
            On strike
          </span>
        )}

        <div className="relative shrink-0">
          <span
            className="absolute -inset-2 rounded-full blur-lg opacity-40"
            style={{ backgroundColor: team.primary_color }}
            aria-hidden
          />
          <img
            src={getPhotoUrl(photo || undefined)}
            alt={name}
            loading="lazy"
            className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover object-[center_30%] border-[3px] shadow-xl"
            style={{
              borderColor: highlight ? '#FFB800' : team.secondary_color,
              filter: muted ? 'grayscale(0.7)' : undefined
            }}
          />
        </div>

        <p className="mt-3 w-full font-black text-white text-sm uppercase tracking-wide truncate" title={name}>
          {name}
        </p>
        <p className="font-broadcast text-3xl text-white leading-tight tabular-nums mt-0.5">{figure}</p>
      </div>

      {/* Stat strip, pinned to the foot so all three cards line up */}
      <div
        className="bc-stat-strip relative z-10 mt-auto flex items-stretch py-1.5"
        style={{ backgroundColor: `${team.primary_color}30` }}
      >
        {stats.map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <span className="w-px bg-white/15 my-1" />}
            <StatCell label={s.label} value={s.value} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const EmptySlotCard: React.FC<{ role: string; hint: string }> = ({ role, hint }) => (
  <div className="rounded-2xl border border-dashed border-cricket-border/60 bg-gray-900/30 h-full flex flex-col items-center justify-center py-10 px-3 text-center min-h-[248px]">
    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center mb-3">
      <User className="w-8 h-8 text-gray-600" />
    </div>
    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">{role}</p>
    <p className="text-xs font-bold text-gray-600 mt-0.5">{hint}</p>
  </div>
);

/** The three-up hero row: both batters at the crease plus the bowler on. */
export const BroadcastPlayerStrip: React.FC<{ state: LiveMatchState }> = ({ state }) => {
  const battingTeam = state.innings?.batting_team;
  const bowlingTeam = state.innings?.bowling_team;

  const batterCard = (batter: BattingCard | null, role: string) => {
    if (!batter || !battingTeam) return <EmptySlotCard role={role} hint="Awaiting batter" />;
    return (
      <PlayerBroadcastCard
        team={battingTeam}
        role={role}
        name={batter.name}
        photo={batter.photo_url}
        highlight={batter.is_striker}
        figure={<>{batter.runs} <span className="text-gray-400 text-xl">({batter.balls})</span></>}
        stats={[
          { label: '4s', value: batter.fours },
          { label: '6s', value: batter.sixes },
          { label: 'SR', value: batter.strike_rate.toFixed(2) }
        ]}
      />
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {batterCard(state.striker, 'Batsman')}
      {batterCard(state.non_striker, 'Batsman')}

      {state.current_bowler && bowlingTeam ? (
        <PlayerBroadcastCard
          team={bowlingTeam}
          role="Bowler"
          name={state.current_bowler.name}
          photo={state.current_bowler.photo_url}
          figure={
            <>
              {state.current_bowler.wickets}-{state.current_bowler.runs}{' '}
              <span className="text-gray-400 text-xl">({state.current_bowler.overs})</span>
            </>
          }
          stats={[
            { label: 'Ov', value: state.current_bowler.overs },
            { label: 'Md', value: state.current_bowler.maidens },
            { label: 'Econ', value: state.current_bowler.economy.toFixed(2) }
          ]}
        />
      ) : (
        <EmptySlotCard role="Bowler" hint="Awaiting next over" />
      )}
    </div>
  );
};

// ============================================================ over ribbon

const ballTone = (b: OverBall): string => {
  if (b.isWicket) return 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-600/30';
  if (b.extraType) return 'bg-purple-600 text-white border-purple-400';
  if (b.runs === 6) return 'bg-cricket-gold text-black border-yellow-300 shadow-lg shadow-yellow-500/30';
  if (b.runs === 4) return 'bg-blue-500 text-white border-blue-300 shadow-lg shadow-blue-500/25';
  if (b.runs === 0) return 'bg-gray-800 text-gray-400 border-gray-700';
  return 'bg-emerald-600 text-white border-emerald-400';
};

const BallChip: React.FC<{ ball: OverBall; animate?: boolean }> = ({ ball, animate }) => {
  const label = ball.label || '';
  const len = label.length;
  const textSize = len > 3 ? 'text-[10px]' : len === 3 ? 'text-xs' : 'text-sm';
  return (
    <span
      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black tracking-tighter leading-none shrink-0 tabular-nums px-0.5 text-center ${textSize} ${ballTone(ball)} ${animate ? 'bc-ball-pop' : ''}`}
    >
      {label}
    </span>
  );
};

const OverRow: React.FC<{ title: string; balls: OverBall[]; runs: number; accent?: boolean; live?: boolean }> = ({
  title, balls, runs, accent, live
}) => (
  <div className={`flex items-center gap-3 px-3 py-2 rounded-xl ${accent ? 'bg-cricket-gold/10 border border-cricket-gold/30' : 'bg-gray-900/40 border border-cricket-border/30'}`}>
    <span className={`text-[10px] font-black uppercase tracking-[0.12em] w-20 shrink-0 ${accent ? 'text-cricket-gold' : 'text-gray-500'}`}>
      {title}
    </span>
    <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
      {balls.length === 0
        ? <span className="text-xs text-gray-600 font-bold">New over about to begin</span>
        : balls.map((b, i) => <BallChip key={i} ball={b} animate={live && i === balls.length - 1} />)}
    </div>
    {balls.length > 0 && (
      <span className="font-broadcast text-sm text-white tabular-nums shrink-0 px-2 py-0.5 rounded-lg bg-black/40 border border-white/10">
        = {runs}
      </span>
    )}
  </div>
);

export const OverTimeline: React.FC<{ state: LiveMatchState }> = ({ state }) => {
  // Tolerate a state frame from before recent_overs existed rather than crashing
  // the whole broadcast on a stale cached payload.
  const thisOver = state.this_over ?? [];
  const recentOvers = state.recent_overs ?? [];
  const thisOverRuns = thisOver.reduce((sum, b) => sum + b.runs, 0);

  return (
    <div className="glass-card rounded-2xl border border-cricket-border/50 p-3 space-y-2">
      <OverRow title="This Over" balls={thisOver} runs={thisOverRuns} accent live />
      {recentOvers.map((o: OverGroup) => (
        <OverRow key={o.over_number} title={`Over ${o.over_number}`} balls={o.balls} runs={o.runs} />
      ))}
      {recentOvers.length === 0 && thisOver.length === 0 && (
        <p className="text-xs text-gray-600 font-bold text-center py-2">Over-by-over will appear once play begins</p>
      )}
    </div>
  );
};

// ============================================================ stat tiles

export const StatTile: React.FC<{
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'gold' | 'green' | 'blue' | 'red';
}> = ({ label, value, hint, tone = 'default' }) => {
  const tones: Record<string, string> = {
    default: 'text-white border-cricket-border/50',
    gold: 'text-cricket-gold border-yellow-500/30',
    green: 'text-emerald-400 border-emerald-500/30',
    blue: 'text-blue-400 border-blue-500/30',
    red: 'text-red-400 border-red-500/30'
  };

  return (
    <div className={`glass-card rounded-xl border p-3 ${tones[tone]}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">{label}</p>
      <p className="font-broadcast text-xl mt-0.5 tabular-nums leading-tight">{value}</p>
      {hint && <p className="text-[10px] text-gray-500 font-semibold mt-0.5 truncate">{hint}</p>}
    </div>
  );
};

export const MatchStatGrid: React.FC<{ state: LiveMatchState }> = ({ state }) => {
  const innings = state.innings;
  const bowler = state.current_bowler;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatTile label="Run Rate" value={innings ? innings.run_rate.toFixed(2) : '—'} hint="Current" tone="blue" />
      <StatTile
        label="Required Rate"
        value={state.required_run_rate != null ? state.required_run_rate.toFixed(2) : '—'}
        hint={state.balls_remaining != null ? `${state.balls_remaining} balls left` : 'First innings'}
        tone="green"
      />
      <StatTile
        label="Target"
        value={innings?.target ?? '—'}
        hint={state.runs_required != null ? `${state.runs_required} to win` : 'Setting total'}
        tone="gold"
      />
      <StatTile
        label="Bowler Econ"
        value={bowler ? bowler.economy.toFixed(2) : '—'}
        hint={bowler ? bowler.name : 'Awaiting bowler'}
        tone="red"
      />
    </div>
  );
};

// ============================================================ scorecards

export const BattingScorecard: React.FC<{ batting: BattingCard[] }> = ({ batting }) => {
  const shown = batting.filter(b => b.status !== 'did_not_bat');

  return (
    <div className="glass-card rounded-xl border border-cricket-border/50 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-cricket-border/50 flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-cricket-gold" />
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">Batting</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[420px]">
          <thead>
            <tr className="text-[9px] uppercase text-gray-500 border-b border-cricket-border/40">
              <th className="text-left py-2 px-3 font-black">Batter</th>
              <th className="text-right py-2 px-2 font-black">R</th>
              <th className="text-right py-2 px-2 font-black">B</th>
              <th className="text-right py-2 px-2 font-black">4s</th>
              <th className="text-right py-2 px-2 font-black">6s</th>
              <th className="text-right py-2 px-3 font-black">SR</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-gray-600 font-semibold">No batters yet</td></tr>
            )}
            {shown.map(b => (
              <tr key={b.player_id} className="border-b border-cricket-border/20 last:border-0">
                <td className="py-2 px-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold truncate ${b.status === 'out' ? 'text-gray-500' : 'text-white'}`}>
                      {b.name}
                    </span>
                    {b.is_striker && <span className="text-cricket-gold text-[10px] font-black shrink-0">*</span>}
                  </div>
                  <span className="text-[9px] text-gray-500 font-semibold">
                    {b.status === 'out'
                      ? `${(b.dismissal_type || 'out').replace('_', ' ')}${b.dismissal_bowler_name ? ` b ${b.dismissal_bowler_name}` : ''}`
                      : b.status === 'not_out' ? 'not out' : 'batting'}
                  </span>
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
    </div>
  );
};

export const BowlingScorecard: React.FC<{ bowling: BowlingCard[] }> = ({ bowling }) => (
  <div className="glass-card rounded-xl border border-cricket-border/50 overflow-hidden">
    <div className="px-4 py-2.5 border-b border-cricket-border/50 flex items-center gap-2">
      <Flame className="w-3.5 h-3.5 text-red-400" />
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">Bowling</p>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[380px]">
        <thead>
          <tr className="text-[9px] uppercase text-gray-500 border-b border-cricket-border/40">
            <th className="text-left py-2 px-3 font-black">Bowler</th>
            <th className="text-right py-2 px-2 font-black">O</th>
            <th className="text-right py-2 px-2 font-black">M</th>
            <th className="text-right py-2 px-2 font-black">R</th>
            <th className="text-right py-2 px-2 font-black">W</th>
            <th className="text-right py-2 px-3 font-black">Econ</th>
          </tr>
        </thead>
        <tbody>
          {bowling.length === 0 && (
            <tr><td colSpan={6} className="py-4 text-center text-gray-600 font-semibold">No bowlers yet</td></tr>
          )}
          {bowling.map(b => (
            <tr key={b.player_id} className="border-b border-cricket-border/20 last:border-0">
              <td className="py-2 px-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white truncate">{b.name}</span>
                  {b.is_current && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                </div>
              </td>
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
);

// ============================================================ fow + feed

export const FallOfWicketsPanel: React.FC<{ wickets: FallOfWicket[] }> = ({ wickets }) => (
  <div className="glass-card rounded-xl border border-cricket-border/50 p-4">
    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500 mb-2.5">Fall of Wickets</p>
    {wickets.length === 0 ? (
      <p className="text-xs text-gray-600 font-semibold">No wickets have fallen</p>
    ) : (
      <div className="flex flex-wrap gap-2">
        {wickets.map(w => (
          <span
            key={w.player_id}
            className="activity-event-pill px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-300 tabular-nums"
          >
            <span className="text-red-400">{w.score}-{w.order}</span>
            <span className="text-gray-500 mx-1">·</span>
            {w.name}
            <span className="text-gray-600 ml-1">({w.overs})</span>
          </span>
        ))}
      </div>
    )}
  </div>
);

export const CommentaryFeed: React.FC<{
  feed: MatchFeedEntry[];
  fallback: LiveMatchState['recent_events'];
}> = ({ feed, fallback }) => {
  // The socket feed only holds what arrived this session; fall back to the
  // server's persisted log so a late joiner still sees recent history.
  const entries: MatchFeedEntry[] = feed.length > 0
    ? feed
    : fallback.map(e => ({
      type: 'log',
      message: e.label,
      timestamp: new Date(e.timestamp.replace(' ', 'T') + 'Z').toLocaleTimeString()
    }));

  return (
    <div className="glass-card rounded-xl border border-cricket-border/50 overflow-hidden flex flex-col">
      <div className="px-4 py-2.5 border-b border-cricket-border/50 flex items-center gap-2">
        <Radio className="w-3.5 h-3.5 text-emerald-400" />
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">Live Commentary</p>
      </div>
      <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
        {entries.length === 0 && (
          <p className="text-xs text-gray-600 font-semibold text-center py-6">Commentary will appear here</p>
        )}
        {entries.map((e, i) => {
          const isWicket = /WICKET/i.test(e.message);
          const isBoundary = /FOUR|SIX/i.test(e.message);
          return (
            <div
              key={i}
              className={`px-3 py-2 rounded-lg text-xs font-semibold ${isWicket
                ? 'activity-unsold-card text-red-200'
                : isBoundary
                  ? 'activity-sold-card text-emerald-200'
                  : 'activity-event-pill text-gray-300'
                }`}
            >
              <p className="leading-snug">{e.message}</p>
              <p className="text-[9px] text-gray-500 mt-0.5">{e.timestamp}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================ innings summary

export const InningsSummaryPanel: React.FC<{ innings: InningsSummary[]; oversLimit: number }> = ({ innings, oversLimit }) => {
  if (innings.length === 0) return null;

  return (
    <div className="glass-card rounded-xl border border-cricket-border/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">Innings Summary</p>
      </div>
      <div className="space-y-2">
        {innings.map(i => (
          <div
            key={i.innings_number}
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-gray-900/40 border border-cricket-border/30"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Crest team={i.batting_team} size="w-8 h-8" />
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-white truncate">{i.batting_team.name}</p>
                <p className="text-[10px] text-gray-500 font-semibold">
                  Innings {i.innings_number} · {i.status === 'completed' ? 'Completed' : 'In progress'}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-broadcast text-lg text-white leading-none tabular-nums">
                {i.runs}/{i.wickets}
              </p>
              <p className="text-[10px] text-gray-500 font-bold tabular-nums">
                {i.overs}/{oversLimit}.0 · RR {i.run_rate.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================ misc

export const MatchPickerBar: React.FC<{
  matches: { id: string; match_number: number; status: string; home_team_short: string; away_team_short: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}> = ({ matches, selectedId, onSelect }) => (
  <div className="flex items-center gap-2 overflow-x-auto pb-1">
    {matches.map(m => {
      const active = m.id === selectedId;
      return (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition shrink-0 ${active
            ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
            : 'bg-gray-900/40 text-gray-400 border-cricket-border/40 hover:text-gray-200'
            }`}
        >
          <span className="flex items-center gap-1.5">
            {m.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
            #{m.match_number} {m.home_team_short} v {m.away_team_short}
          </span>
        </button>
      );
    })}
  </div>
);

export const TargetBanner: React.FC<{ state: LiveMatchState }> = ({ state }) => {
  if (state.runs_required == null || state.balls_remaining == null || state.status !== 'live') return null;

  return (
    <div className="rounded-xl border border-yellow-500/40 bg-gradient-to-r from-yellow-500/20 via-yellow-500/5 to-transparent px-4 py-3 flex items-center gap-3">
      <Target className="w-5 h-5 text-cricket-gold shrink-0" />
      <p className="font-broadcast text-base text-white">
        NEED <span className="text-cricket-gold tabular-nums">{state.runs_required}</span> FROM{' '}
        <span className="text-cricket-gold tabular-nums">{state.balls_remaining}</span> BALLS
        <span className="text-gray-400 font-bold ml-2 text-xs not-italic">
          RRR {state.required_run_rate?.toFixed(2)}
        </span>
      </p>
    </div>
  );
};
