import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, PlayCircle, Radio, Repeat, RotateCcw, Settings2, Undo2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMatchSocket } from '../context/SocketContext';
import { apiRequest } from '../utils/api';
import type {
  BroadcastMatchListItem,
  DismissalType,
  ExtraType,
  LiveMatchState,
  MatchSquads,
  MatchSquadPlayer
} from '../types';
import {
  BattingScorecard,
  BowlingScorecard,
  BroadcastPlayerStrip,
  CommentaryFeed,
  FallOfWicketsPanel,
  InningsSummaryPanel,
  MatchHeaderBar,
  MatchPickerBar,
  MatchStatGrid,
  OverTimeline,
  ScorePanel,
  TargetBanner
} from '../components/match/MatchBroadcastPanels';

const DISMISSALS: { value: DismissalType; label: string }[] = [
  { value: 'bowled', label: 'Bowled' },
  { value: 'caught', label: 'Caught' },
  { value: 'lbw', label: 'LBW' },
  { value: 'run_out', label: 'Run out' },
  { value: 'stumped', label: 'Stumped' },
  { value: 'hit_wicket', label: 'Hit wicket' }
];

const EXTRAS: { value: ExtraType; label: string }[] = [
  { value: 'wide', label: 'Wide' },
  { value: 'no_ball', label: 'No ball' },
  { value: 'bye', label: 'Bye' },
  { value: 'leg_bye', label: 'Leg bye' }
];

const Select: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, options, placeholder = 'Select…', disabled }) => (
  <label className="block">
    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">{label}</span>
    <select
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      className="mt-1 w-full bg-cricket-card text-xs text-gray-200 border border-cricket-border rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 disabled:opacity-40"
    >
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </label>
);

/**
 * Admin / scorer console.
 *
 * Every control emits a socket command; the server validates it, mutates the
 * authoritative state and broadcasts match:state back. The console re-renders
 * from that same frame, so what the scorer sees is exactly what is on air.
 */
export const LiveMatchScorerView: React.FC = () => {
  const { currentTournamentId, token } = useAuth();
  const {
    matchState, matchFeed, matchError, isConnected, watchedMatchId,
    joinMatch, leaveMatch,
    scorerStartInnings, scorerRecordBall, scorerNewBatter, scorerSetBowler,
    scorerSwapStrike, scorerReplaceBatter, scorerReplaceBowler, scorerUndoBall,
    scorerCompleteInnings, scorerCompleteMatch, scorerResetMatch
  } = useMatchSocket();

  const [matches, setMatches] = useState<BroadcastMatchListItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [snapshot, setSnapshot] = useState<LiveMatchState | null>(null);
  const [squads, setSquads] = useState<MatchSquads | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Innings-opening form
  const [battingTeamId, setBattingTeamId] = useState('');
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [openingBowlerId, setOpeningBowlerId] = useState('');
  const [oversLimit, setOversLimit] = useState<string>('20');

  // Ball-entry modifiers
  const [extraType, setExtraType] = useState<ExtraType | ''>('');
  const [dismissalType, setDismissalType] = useState<DismissalType>('bowled');
  // Run-out detail: runs banked before the dismissal, who was short, and whether
  // the batsmen had crossed on the run that was not completed.
  const [runOutRuns, setRunOutRuns] = useState(0);
  const [runOutBatterId, setRunOutBatterId] = useState('');
  const [runOutCrossed, setRunOutCrossed] = useState(false);
  const [replaceOutgoing, setReplaceOutgoing] = useState('');
  const [replaceIncoming, setReplaceIncoming] = useState('');
  const [bowlerOutgoing, setBowlerOutgoing] = useState('');
  const [bowlerIncoming, setBowlerIncoming] = useState('');
  const [transferSpell, setTransferSpell] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!currentTournamentId || !token) return;
    apiRequest(`/matches/public/live?tournamentId=${currentTournamentId}`)
      .then((res: BroadcastMatchListItem[]) => {
        setMatches(res);
        if (res.length > 0) setSelectedId(prev => (prev && res.some(m => m.id === prev) ? prev : res[0].id));
      })
      .catch(err => setNotice(err.message));
  }, [currentTournamentId, token]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    Promise.all([
      apiRequest(`/matches/${selectedId}/live`),
      apiRequest(`/matches/${selectedId}/squads`)
    ])
      .then(([live, sq]) => {
        if (cancelled) return;
        setSnapshot(live);
        setSquads(sq);
        setBattingTeamId(prev => prev || live.home_team.id);
        setOversLimit(String(live.overs_limit));
      })
      .catch(err => !cancelled && setNotice(err.message));

    joinMatch(selectedId);
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => () => leaveMatch(), []);

  const state = watchedMatchId === selectedId && matchState ? matchState : snapshot;

  // Squad lists for the pickers, derived from whichever side is batting.
  const { battingSquad, bowlingSquad } = useMemo(() => {
    if (!squads || !state) return { battingSquad: [] as MatchSquadPlayer[], bowlingSquad: [] as MatchSquadPlayer[] };
    const battingId = state.innings?.batting_team.id || battingTeamId;
    const isHomeBatting = battingId === squads.home.team.id;
    return {
      battingSquad: isHomeBatting ? squads.home.players : squads.away.players,
      bowlingSquad: isHomeBatting ? squads.away.players : squads.home.players
    };
  }, [squads, state, battingTeamId]);

  const opts = (players: MatchSquadPlayer[]) => players.map(p => ({ value: p.id, label: p.name }));

  const inningsLive = state?.innings?.status === 'in_progress';
  const isFirstInnings = (state?.all_innings.length ?? 0) === 0;
  const oversValid = /^\d+$/.test(oversLimit) && Number(oversLimit) >= 1 && Number(oversLimit) <= 50;
  const needsBatter = Boolean(inningsLive && (!state?.striker || !state?.non_striker));
  const needsBowler = Boolean(inningsLive && !state?.current_bowler);
  const canScore = Boolean(inningsLive && state?.striker && state?.non_striker && state?.current_bowler);

  // Batters who have not been dismissed and are not already at the crease.
  const availableBatters = useMemo(() => {
    if (!state) return [];
    const dismissed = new Set(state.batting.filter(b => b.status === 'out' || b.status === 'not_out').map(b => b.player_id));
    const atCrease = new Set([state.striker?.player_id, state.non_striker?.player_id].filter(Boolean) as string[]);
    return battingSquad.filter(p => !dismissed.has(p.id) && !atCrease.has(p.id));
  }, [state, battingSquad]);

  const atCrease = useMemo(
    () => (state ? [state.striker, state.non_striker].filter(Boolean).map(b => ({ value: b!.player_id, label: b!.name })) : []),
    [state]
  );

  const recordRuns = (runs: number) => {
    scorerRecordBall({ runs, extraType: extraType || null });
    setExtraType('');
  };

  /** Wide or no ball with nothing run off it — the common case, one tap. */
  const recordExtraNow = (type: ExtraType) => {
    scorerRecordBall({ runs: 0, extraType: type });
    setExtraType('');
  };

  const isRunOut = dismissalType === 'run_out';

  const recordWicket = () => {
    scorerRecordBall({
      // Runs completed before the fielders broke the stumps still count. Only a
      // run out can have them: every other dismissal ends the ball at once.
      runs: isRunOut ? runOutRuns : 0,
      isWicket: true,
      dismissalType,
      extraType: extraType || null,
      ...(isRunOut
        ? { dismissedPlayerId: runOutBatterId || undefined, batsmenCrossed: runOutCrossed }
        : {})
    });
    setExtraType('');
    setRunOutRuns(0);
    setRunOutCrossed(false);
    setRunOutBatterId('');
  };

  if (matches.length === 0) {
    return (
      <div className="glass-panel rounded-2xl border border-cricket-border/50 p-10 text-center">
        <Radio className="w-9 h-9 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-300 font-bold">No fixtures available</p>
        <p className="text-gray-500 text-xs mt-1">
          Generate fixtures from the Live Match Scorer &amp; Fixtures tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-broadcast text-xl text-white">SAKHA MATCH CONTROL CONSOLE</h2>
        <span
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${isConnected
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
            : 'bg-red-500/15 text-red-300 border-red-500/40'
            }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          {isConnected ? 'Broadcasting' : 'Reconnecting'}
        </span>
      </div>

      <MatchPickerBar matches={matches} selectedId={selectedId} onSelect={setSelectedId} />

      {(matchError || notice) && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs font-bold text-red-300">{matchError || notice}</p>
        </div>
      )}

      {!state ? (
        <div className="glass-panel rounded-2xl border border-cricket-border/50 p-10 text-center">
          <p className="text-gray-400 font-bold text-sm">Loading match…</p>
        </div>
      ) : (
        <>
          <MatchHeaderBar state={state} />
          <TargetBanner state={state} />

          <div className="grid xl:grid-cols-3 gap-4">
            {/* ---------------- Control column ---------------- */}
            <div className="space-y-4">
              {!inningsLive && state.status !== 'completed' && (
                <div className="glass-card rounded-xl border border-cricket-border/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-emerald-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">
                      Open Innings {state.all_innings.length + 1}
                    </p>
                  </div>

                  {isFirstInnings ? (
                    <div>
                      <label className="block">
                        <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">
                          Overs Per Side
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={oversLimit}
                          onChange={e => setOversLimit(e.target.value)}
                          className="mt-1 w-full bg-cricket-card text-xs text-gray-200 border border-cricket-border rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 tabular-nums"
                        />
                      </label>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {[5, 10, 20, 50].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setOversLimit(String(n))}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black border transition ${Number(oversLimit) === n
                              ? 'bg-blue-600/25 text-blue-300 border-blue-500/40'
                              : 'bg-gray-900/50 text-gray-400 border-cricket-border/50 hover:text-gray-200'
                              }`}
                          >
                            {n === 20 ? 'T20' : n === 50 ? 'ODI' : `${n} ov`}
                          </button>
                        ))}
                      </div>
                      {!oversValid && (
                        <p className="text-[10px] font-bold text-red-400 mt-1">
                          Enter a whole number of overs between 1 and 50.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-gray-900/50 border border-cricket-border/50 px-2.5 py-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">Overs Per Side</p>
                      <p className="text-sm font-black text-white tabular-nums mt-0.5">
                        {state.overs_limit}
                        <span className="text-[10px] font-bold text-gray-500 ml-1.5">
                          fixed for the chase
                        </span>
                      </p>
                    </div>
                  )}

                  <Select
                    label="Batting Team"
                    value={battingTeamId}
                    onChange={v => { setBattingTeamId(v); setStrikerId(''); setNonStrikerId(''); setOpeningBowlerId(''); }}
                    options={[
                      { value: state.home_team.id, label: state.home_team.name },
                      { value: state.away_team.id, label: state.away_team.name }
                    ]}
                  />
                  <Select label="Striker" value={strikerId} onChange={setStrikerId} options={opts(battingSquad)} />
                  <Select label="Non-striker" value={nonStrikerId} onChange={setNonStrikerId} options={opts(battingSquad.filter(p => p.id !== strikerId))} />
                  <Select label="Opening Bowler" value={openingBowlerId} onChange={setOpeningBowlerId} options={opts(bowlingSquad)} />

                  <button
                    disabled={!battingTeamId || !strikerId || !nonStrikerId || !openingBowlerId || !oversValid}
                    onClick={() => scorerStartInnings({
                      battingTeamId,
                      strikerId,
                      nonStrikerId,
                      bowlerId: openingBowlerId,
                      // Only innings 1 sets the quota; the chase inherits it.
                      ...(isFirstInnings ? { oversLimit: Number(oversLimit) } : {})
                    })}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-xs transition"
                  >
                    {isFirstInnings ? `START ${oversValid ? Number(oversLimit) : ''}-OVER MATCH` : 'START INNINGS'}
                  </button>
                </div>
              )}

              {needsBowler && (
                <div className="glass-card rounded-xl border border-yellow-500/40 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-yellow-300">
                    Over complete — name the next bowler
                  </p>
                  <Select
                    label="Bowler"
                    value=""
                    placeholder="Choose bowler…"
                    onChange={v => v && scorerSetBowler(v)}
                    options={opts(bowlingSquad)}
                  />
                </div>
              )}

              {needsBatter && (
                <div className="glass-card rounded-xl border border-red-500/40 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-red-300">
                    Wicket fell — send in the next batter
                  </p>
                  <Select
                    label="New Batter"
                    value=""
                    placeholder="Choose batter…"
                    onChange={v => v && scorerNewBatter(v)}
                    options={opts(availableBatters)}
                  />
                </div>
              )}

              {inningsLive && (
                <div className="glass-card rounded-xl border border-cricket-border/50 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">Ball Entry</p>

                  {/* Runs off the bat. With an extra armed below, these record
                      "extra + N runs" instead of a plain delivery. */}
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2, 3, 4, 6].map(r => (
                      <button
                        key={r}
                        disabled={!canScore}
                        onClick={() => recordRuns(r)}
                        className={`py-3 rounded-xl font-black text-sm border transition disabled:opacity-30 disabled:cursor-not-allowed ${r === 4 || r === 6
                          ? 'bg-cricket-gold hover:bg-yellow-400 text-black border-yellow-300'
                          : 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700'
                          }`}
                      >
                        {r === 0 ? 'DOT' : `+${r}`}
                      </button>
                    ))}
                  </div>

                  {/* A wide or no ball with nothing run off it is by far the most
                      common extra, so it gets a single tap of its own. */}
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Extras — one tap
                    </span>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        disabled={!canScore}
                        onClick={() => recordExtraNow('wide')}
                        className="py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-sm border border-purple-400 transition"
                      >
                        WIDE <span className="text-purple-200 text-xs">+1</span>
                      </button>
                      <button
                        disabled={!canScore}
                        onClick={() => recordExtraNow('no_ball')}
                        className="py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-sm border border-purple-400 transition"
                      >
                        NO BALL <span className="text-purple-200 text-xs">+1</span>
                      </button>
                    </div>
                  </div>

                  {/* Modifiers for the "extra plus runs" cases: a no ball hit for
                      four, byes run off a wide, and so on. */}
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Extra + runs — tap one, then a run button
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 mt-1">
                      {EXTRAS.map(e => (
                        <button
                          key={e.value}
                          onClick={() => setExtraType(prev => (prev === e.value ? '' : e.value))}
                          className={`py-1.5 rounded-lg text-[10px] font-black border transition ${extraType === e.value
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-gray-900/50 text-gray-400 border-cricket-border/50 hover:text-gray-200'
                            }`}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                    {extraType && (
                      <p className="mt-1.5 text-[10px] font-bold text-purple-300">
                        Armed: the next run button records a{' '}
                        {EXTRAS.find(e => e.value === extraType)?.label.toLowerCase()} plus those runs.
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-cricket-border/40 space-y-2">
                    <Select
                      label="Dismissal Type"
                      value={dismissalType}
                      onChange={v => setDismissalType(v as DismissalType)}
                      options={DISMISSALS}
                      placeholder="Bowled"
                    />

                    {/* A run out is the only dismissal where runs can already be
                        banked and where either batsman may be the one out. */}
                    {isRunOut && (
                      <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 space-y-3">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">
                            Runs completed before the dismissal
                          </span>
                          <div className="grid grid-cols-4 gap-1.5 mt-1">
                            {[0, 1, 2, 3].map(n => (
                              <button
                                key={n}
                                onClick={() => setRunOutRuns(n)}
                                className={`py-1.5 rounded-lg text-[11px] font-black border transition ${runOutRuns === n
                                  ? 'bg-red-600 text-white border-red-400'
                                  : 'bg-gray-900/50 text-gray-400 border-cricket-border/50 hover:text-gray-200'
                                  }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-gray-500 font-semibold mt-1">
                            The run in progress is void and is not counted.
                          </p>
                        </div>

                        <div>
                          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-500">
                            Batsman out
                          </span>
                          <div className="grid grid-cols-2 gap-1.5 mt-1">
                            {[
                              { id: state.striker?.player_id, name: state.striker?.name, end: 'Striker' },
                              { id: state.non_striker?.player_id, name: state.non_striker?.name, end: 'Non-striker' }
                            ].map(b => (
                              <button
                                key={b.end}
                                disabled={!b.id}
                                onClick={() => setRunOutBatterId(b.id || '')}
                                className={`py-1.5 px-2 rounded-lg text-[10px] font-black border transition disabled:opacity-30 ${runOutBatterId === b.id
                                  ? 'bg-red-600 text-white border-red-400'
                                  : 'bg-gray-900/50 text-gray-400 border-cricket-border/50 hover:text-gray-200'
                                  }`}
                              >
                                <span className="block truncate">{b.name || '—'}</span>
                                <span className="block text-[8px] opacity-70">{b.end}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <label className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={runOutCrossed}
                            onChange={e => setRunOutCrossed(e.target.checked)}
                            className="mt-0.5 accent-red-500"
                          />
                          <span className="text-[11px] font-bold text-gray-300 leading-snug">
                            Batsmen had crossed
                            <span className="block text-[10px] font-semibold text-gray-500">
                              Tick if they passed each other on the incomplete run — the incoming
                              batsman then takes the other end.
                            </span>
                          </span>
                        </label>
                      </div>
                    )}

                    <button
                      disabled={!canScore || (isRunOut && !runOutBatterId)}
                      onClick={recordWicket}
                      className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-xs border border-red-400 transition"
                    >
                      {isRunOut
                        ? `RECORD RUN OUT${runOutRuns > 0 ? ` (+${runOutRuns})` : ''}`
                        : 'RECORD WICKET'}
                    </button>
                    {isRunOut && !runOutBatterId && (
                      <p className="text-[10px] font-bold text-yellow-400">
                        Choose which batsman was short of his ground.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-cricket-border/40">
                    <button
                      onClick={scorerSwapStrike}
                      className="py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" /> Swap Strike
                    </button>
                    <button
                      onClick={scorerUndoBall}
                      className="py-2 rounded-xl bg-gray-700/40 hover:bg-gray-700/70 text-gray-300 border border-gray-600/50 font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
                    >
                      <Undo2 className="w-3.5 h-3.5" /> Undo Ball
                    </button>
                  </div>
                </div>
              )}

              {inningsLive && atCrease.length === 2 && (
                <div className="glass-card rounded-xl border border-cricket-border/50 p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">Replace Batter</p>
                  </div>
                  <Select label="Outgoing" value={replaceOutgoing} onChange={setReplaceOutgoing} options={atCrease} />
                  <Select label="Incoming" value={replaceIncoming} onChange={setReplaceIncoming} options={opts(availableBatters)} />
                  <button
                    disabled={!replaceOutgoing || !replaceIncoming}
                    onClick={() => {
                      scorerReplaceBatter(replaceOutgoing, replaceIncoming);
                      setReplaceOutgoing('');
                      setReplaceIncoming('');
                    }}
                    className="w-full py-2 rounded-xl bg-gray-700/50 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-200 font-bold text-[11px] transition"
                  >
                    Swap Player (retired / correction)
                  </button>
                </div>
              )}

              {inningsLive && state.bowling.length > 0 && (
                <div className="glass-card rounded-xl border border-cricket-border/50 p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">Replace Bowler</p>
                  </div>

                  <Select
                    label="Outgoing"
                    value={bowlerOutgoing}
                    onChange={setBowlerOutgoing}
                    options={state.bowling.map(b => ({
                      value: b.player_id,
                      label: `${b.name} — ${b.overs} ov, ${b.wickets}-${b.runs}${b.is_current ? ' (bowling)' : ''}`
                    }))}
                  />
                  <Select
                    label="Incoming"
                    value={bowlerIncoming}
                    onChange={setBowlerIncoming}
                    options={opts(bowlingSquad.filter(p => p.id !== bowlerOutgoing))}
                  />

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transferSpell}
                      onChange={e => setTransferSpell(e.target.checked)}
                      className="mt-0.5 accent-blue-500"
                    />
                    <span className="text-[11px] font-bold text-gray-300 leading-snug">
                      Move this innings' figures across
                      <span className="block text-[10px] font-semibold text-gray-500">
                        On for a wrong-bowler correction: overs, runs and wickets transfer to the
                        incoming bowler. Off for an injury — the outgoing bowler keeps his figures
                        and simply hands over the ball.
                      </span>
                    </span>
                  </label>

                  <button
                    disabled={!bowlerOutgoing || !bowlerIncoming}
                    onClick={() => {
                      scorerReplaceBowler(bowlerOutgoing, bowlerIncoming, transferSpell);
                      setBowlerOutgoing('');
                      setBowlerIncoming('');
                    }}
                    className="w-full py-2 rounded-xl bg-gray-700/50 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-200 font-bold text-[11px] transition"
                  >
                    {transferSpell ? 'Reassign Spell (correction)' : 'Hand Over Ball (injury)'}
                  </button>
                </div>
              )}

              <div className="glass-card rounded-xl border border-cricket-border/50 p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">Match Flow</p>

                {state.status !== 'completed' && (
                  <>
                    <button
                      disabled={!inningsLive}
                      onClick={scorerCompleteInnings}
                      className="w-full py-2 rounded-xl bg-yellow-600/25 hover:bg-yellow-600/40 disabled:opacity-30 disabled:cursor-not-allowed text-yellow-300 border border-yellow-500/40 font-bold text-[11px] transition"
                    >
                      Declare Innings Complete
                    </button>
                    <button
                      onClick={scorerCompleteMatch}
                      className="w-full py-2 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Complete Match
                    </button>
                  </>
                )}

                {/* Escape hatch for a mis-configured opening: wipes the match so
                    the setup form comes back. Confirmed in two taps because it
                    discards every ball scored so far. */}
                <div className="pt-2 border-t border-cricket-border/40">
                  {!confirmReset ? (
                    <button
                      onClick={() => setConfirmReset(true)}
                      className="w-full py-2 rounded-xl bg-gray-800/60 hover:bg-gray-700/70 text-gray-300 border border-cricket-border/60 font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
                    >
                      <Settings2 className="w-3.5 h-3.5" /> Edit Setup / Restart Match
                    </button>
                  ) : (
                    <div className="rounded-xl border border-red-500/50 bg-red-950/30 p-3 space-y-2">
                      <p className="text-[11px] font-black text-red-300 leading-snug">
                        Discard this match and start over?
                      </p>
                      <p className="text-[10px] font-semibold text-gray-400 leading-snug">
                        Every ball, scorecard and commentary line for
                        {' '}{state.home_team.short_name} v {state.away_team.short_name} is deleted.
                        {state.status === 'completed'
                          ? ' Its result is also removed from the points table.'
                          : ''}
                        {' '}This cannot be undone.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setConfirmReset(false)}
                          className="py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600/50 font-bold text-[11px] transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            scorerResetMatch();
                            setConfirmReset(false);
                            // Clear the setup form so it does not re-submit stale picks.
                            setStrikerId('');
                            setNonStrikerId('');
                            setOpeningBowlerId('');
                          }}
                          className="py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white border border-red-400 font-black text-[11px] transition"
                        >
                          Yes, reset
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ---------------- Live mirror of the broadcast ---------------- */}
            <div className="xl:col-span-2 space-y-4">
              <ScorePanel state={state} />
              <BroadcastPlayerStrip state={state} />
              <OverTimeline state={state} />
              <MatchStatGrid state={state} />
              <FallOfWicketsPanel wickets={state.fall_of_wickets} />

              <div className="grid lg:grid-cols-2 gap-4">
                <BattingScorecard batting={state.batting} />
                <BowlingScorecard bowling={state.bowling} />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <InningsSummaryPanel innings={state.all_innings} oversLimit={state.overs_limit} />
                <CommentaryFeed feed={matchFeed} fallback={state.recent_events} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
