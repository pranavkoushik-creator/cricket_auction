import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { completeMatch, revertMatchFromStandings, purgeMatchData } from './matchService';

/**
 * Server-authoritative live cricket match engine.
 *
 * Every mutation goes through this module so the client never computes score
 * state -- it only renders whatever getLiveMatchState() returns. The socket
 * layer (socket/matchEngine.ts) and the REST layer (routes/matchRoutes.ts) both
 * call these same functions, so there is exactly one implementation of the rules.
 */

// ---------------------------------------------------------------- types

export type DismissalType = 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket';
export type ExtraType = 'wide' | 'no_ball' | 'bye' | 'leg_bye';
export type BatterStatus = 'did_not_bat' | 'batting' | 'out' | 'not_out';

export interface BallInput {
  /** Runs the batsmen completed. Runs finished before a run out still count. */
  runs: number;
  extraType?: ExtraType | null;
  isWicket?: boolean;
  dismissalType?: DismissalType | null;
  /** Defaults to the striker; set explicitly for run-outs at the non-striker's end. */
  dismissedPlayerId?: string | null;
  /**
   * Run outs only: whether the batsmen had crossed on the incomplete run when
   * the bails came off. If they had, the survivor finishes at the end he was
   * running to, so the incoming batsman takes the other end.
   */
  batsmenCrossed?: boolean;
}

export interface TeamBrand {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  owner_name: string | null;
}

export interface BattingCard {
  player_id: string;
  name: string;
  photo_url: string | null;
  batting_position: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strike_rate: number;
  status: BatterStatus;
  dismissal_type: DismissalType | null;
  dismissal_bowler_name: string | null;
  is_striker: boolean;
  is_non_striker: boolean;
}

export interface BowlingCard {
  player_id: string;
  name: string;
  photo_url: string | null;
  overs: string;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
  economy: number;
  is_current: boolean;
}

export interface OverBall {
  ball: number;
  label: string;
  runs: number;
  isWicket: boolean;
  extraType: ExtraType | null;
}

export interface OverGroup {
  over_number: number;
  balls: OverBall[];
  runs: number;
  wickets: number;
}

export interface FallOfWicket {
  order: number;
  player_id: string;
  name: string;
  score: number;
  overs: string;
}

export interface InningsSummary {
  innings_number: number;
  batting_team: TeamBrand;
  bowling_team: TeamBrand;
  runs: number;
  wickets: number;
  balls: number;
  overs: string;
  extras: number;
  run_rate: number;
  target: number | null;
  status: 'in_progress' | 'completed';
}

export interface LiveMatchState {
  match_id: string;
  tournament_id: string;
  match_number: number;
  stage: string;
  venue: string | null;
  status: 'upcoming' | 'live' | 'completed' | 'abandoned';
  overs_limit: number;
  current_innings: number;
  home_team: TeamBrand;
  away_team: TeamBrand;
  innings: InningsSummary | null;
  all_innings: InningsSummary[];
  batting: BattingCard[];
  bowling: BowlingCard[];
  striker: BattingCard | null;
  non_striker: BattingCard | null;
  current_bowler: BowlingCard | null;
  previous_bowler_id: string | null;
  this_over: OverBall[];
  /** Completed overs, newest first, for the broadcast over-by-over ribbon. */
  recent_overs: OverGroup[];
  fall_of_wickets: FallOfWicket[];
  /** Runs still needed to win. Innings 2 only. */
  runs_required: number | null;
  balls_remaining: number | null;
  required_run_rate: number | null;
  result_summary: string | null;
  winner_team_id: string | null;
  recent_events: { id: string; event_number: number; label: string; timestamp: string }[];
}

// ---------------------------------------------------------------- helpers

/** Cricket notation: 17 legal balls -> "2.5". */
export function formatOvers(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Wides and no-balls do not advance the over; byes and leg-byes do. */
function isLegalDelivery(extraType?: ExtraType | null): boolean {
  return extraType !== 'wide' && extraType !== 'no_ball';
}

/** Byes and leg-byes are not credited to the batter. */
function creditsBatter(extraType?: ExtraType | null): boolean {
  return !extraType || extraType === 'no_ball';
}

function teamBrand(row: any, prefix: string): TeamBrand {
  return {
    id: row[`${prefix}_id`],
    name: row[`${prefix}_name`],
    short_name: row[`${prefix}_short`],
    logo_url: row[`${prefix}_logo`] ?? null,
    primary_color: row[`${prefix}_color`] || '#3b82f6',
    secondary_color: row[`${prefix}_secondary`] || '#1e40af',
    owner_name: row[`${prefix}_owner`] ?? null
  };
}

function getMatchRow(matchId: string) {
  const match = db.prepare(`
    SELECT m.*,
           h.id AS home_team_id, h.name AS home_team_name, h.short_name AS home_team_short,
           h.logo_url AS home_team_logo, h.primary_color AS home_team_color,
           h.secondary_color AS home_team_secondary, hu.name AS home_team_owner,
           a.id AS away_team_id, a.name AS away_team_name, a.short_name AS away_team_short,
           a.logo_url AS away_team_logo, a.primary_color AS away_team_color,
           a.secondary_color AS away_team_secondary, au.name AS away_team_owner
    FROM matches m
    JOIN franchises h ON m.home_team_id = h.id
    JOIN franchises a ON m.away_team_id = a.id
    LEFT JOIN users hu ON h.owner_id = hu.id
    LEFT JOIN users au ON a.owner_id = au.id
    WHERE m.id = ?
  `).get(matchId) as any;

  if (!match) throw new Error('Match not found');
  return match;
}

function getLiveStateRow(matchId: string) {
  let state = db.prepare('SELECT * FROM match_live_state WHERE match_id = ?').get(matchId) as any;
  if (!state) {
    db.prepare('INSERT INTO match_live_state (match_id, current_innings) VALUES (?, 1)').run(matchId);
    state = db.prepare('SELECT * FROM match_live_state WHERE match_id = ?').get(matchId) as any;
  }
  return state;
}

function getInningsRow(matchId: string, inningsNumber: number) {
  return db.prepare(
    'SELECT * FROM match_innings WHERE match_id = ? AND innings_number = ?'
  ).get(matchId, inningsNumber) as any;
}

function requireActiveInnings(matchId: string) {
  const state = getLiveStateRow(matchId);
  const innings = getInningsRow(matchId, state.current_innings);
  if (!innings) {
    throw new Error(`Innings ${state.current_innings} has not been started. Open the innings first.`);
  }
  if (innings.status === 'completed') {
    throw new Error(`Innings ${state.current_innings} is already complete.`);
  }
  return { state, innings };
}

function touchState(matchId: string) {
  db.prepare('UPDATE match_live_state SET last_updated = CURRENT_TIMESTAMP WHERE match_id = ?').run(matchId);
}

// ---------------------------------------------------------------- event log

function logEvent(matchId: string, inningsNumber: number, eventType: string, payload: any) {
  const maxEv = db.prepare('SELECT MAX(event_number) AS max_ev FROM match_events WHERE match_id = ?').get(matchId) as any;
  const eventNumber = (maxEv?.max_ev || 0) + 1;
  const id = `ev-${uuidv4().substring(0, 8)}`;

  db.prepare(`
    INSERT INTO match_events (id, match_id, innings, event_number, event_type, payload_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, matchId, inningsNumber, eventNumber, eventType, JSON.stringify(payload));

  return { id, eventNumber };
}

/** Human-readable commentary line for a ball. */
function ballLabel(input: BallInput, strikerName: string, bowlerName: string, dismissedName?: string): string {
  if (input.isWicket) {
    const who = dismissedName || strikerName;
    if (input.dismissalType === 'run_out') {
      const ran = input.runs > 0 ? ` (${input.runs} run${input.runs === 1 ? '' : 's'} completed)` : '';
      return `RUN OUT! ${who} is short of his ground${ran}`;
    }
    const how = (input.dismissalType || 'out').replace('_', ' ');
    return `WICKET! ${who} ${how} b ${bowlerName}`;
  }
  if (input.extraType === 'wide') return `Wide +${input.runs + 1}`;
  if (input.extraType === 'no_ball') return `No ball +${input.runs + 1}`;
  if (input.extraType === 'bye') return `${input.runs} bye${input.runs === 1 ? '' : 's'}`;
  if (input.extraType === 'leg_bye') return `${input.runs} leg bye${input.runs === 1 ? '' : 's'}`;
  if (input.runs === 0) return `${strikerName} — dot ball`;
  if (input.runs === 4) return `FOUR! ${strikerName} finds the boundary`;
  if (input.runs === 6) return `SIX! ${strikerName} goes big`;
  return `${strikerName} takes ${input.runs}`;
}

function ballToken(input: BallInput): string {
  if (input.isWicket) {
    if (input.dismissalType === 'run_out' && input.runs > 0) {
      return `W+${input.runs}`;
    }
    return 'W';
  }
  if (input.extraType === 'wide') return input.runs > 0 ? `WD+${input.runs}` : 'WD';
  if (input.extraType === 'no_ball') return input.runs > 0 ? `NB+${input.runs}` : 'NB';
  if (input.extraType === 'bye') return `B+${input.runs}`;
  if (input.extraType === 'leg_bye') return `LB+${input.runs}`;
  return String(input.runs);
}

// ---------------------------------------------------------------- reads

export function getLiveMatchState(matchId: string): LiveMatchState {
  const match = getMatchRow(matchId);
  const state = getLiveStateRow(matchId);
  const oversLimit: number = match.overs_limit || 20;

  const home = teamBrand(match, 'home_team');
  const away = teamBrand(match, 'away_team');
  const brandById = (id: string) => (id === home.id ? home : away);

  const inningsRows = db.prepare(
    'SELECT * FROM match_innings WHERE match_id = ? ORDER BY innings_number ASC'
  ).all(matchId) as any[];

  const toSummary = (row: any): InningsSummary => ({
    innings_number: row.innings_number,
    batting_team: brandById(row.batting_team_id),
    bowling_team: brandById(row.bowling_team_id),
    runs: row.runs,
    wickets: row.wickets,
    balls: row.balls,
    overs: formatOvers(row.balls),
    extras: row.extras,
    run_rate: row.balls > 0 ? round2((row.runs / row.balls) * 6) : 0,
    target: row.target ?? null,
    status: row.status
  });

  const allInnings = inningsRows.map(toSummary);
  const currentRow = inningsRows.find(r => r.innings_number === state.current_innings) || null;
  const innings = currentRow ? toSummary(currentRow) : null;

  let batting: BattingCard[] = [];
  let bowling: BowlingCard[] = [];
  let thisOver: OverBall[] = [];
  let recentOvers: OverGroup[] = [];
  let fallOfWickets: FallOfWicket[] = [];
  let previousBowlerId: string | null = null;

  if (currentRow) {
    batting = (db.prepare(`
      SELECT mb.*, p.name, p.photo_url, bw.name AS dismissal_bowler_name
      FROM match_batting mb
      JOIN players p ON mb.player_id = p.id
      LEFT JOIN players bw ON mb.dismissal_bowler_id = bw.id
      WHERE mb.match_id = ? AND mb.innings_number = ?
      ORDER BY mb.batting_position ASC
    `).all(matchId, currentRow.innings_number) as any[]).map(r => ({
      player_id: r.player_id,
      name: r.name,
      photo_url: r.photo_url,
      batting_position: r.batting_position,
      runs: r.runs,
      balls: r.balls,
      fours: r.fours,
      sixes: r.sixes,
      strike_rate: r.balls > 0 ? round2((r.runs / r.balls) * 100) : 0,
      status: r.status,
      dismissal_type: r.dismissal_type,
      dismissal_bowler_name: r.dismissal_bowler_name,
      is_striker: r.player_id === state.striker_id,
      is_non_striker: r.player_id === state.non_striker_id
    }));

    bowling = (db.prepare(`
      SELECT mbw.*, p.name, p.photo_url
      FROM match_bowling mbw
      JOIN players p ON mbw.player_id = p.id
      WHERE mbw.match_id = ? AND mbw.innings_number = ?
      ORDER BY mbw.balls DESC
    `).all(matchId, currentRow.innings_number) as any[]).map(r => ({
      player_id: r.player_id,
      name: r.name,
      photo_url: r.photo_url,
      overs: formatOvers(r.balls),
      balls: r.balls,
      runs: r.runs,
      wickets: r.wickets,
      maidens: r.maidens,
      economy: r.balls > 0 ? round2((r.runs / r.balls) * 6) : 0,
      is_current: r.player_id === state.bowler_id
    }));

    // Walk the ball log once, closing an over every sixth legal delivery. The
    // last group is the over in progress; everything before it is history.
    const overEvents = db.prepare(`
      SELECT * FROM match_events
      WHERE match_id = ? AND innings = ? AND event_type = 'ball'
      ORDER BY event_number ASC
    `).all(matchId, currentRow.innings_number) as any[];

    const completed: (OverGroup & { bowler_id?: string | null })[] = [];
    let building: OverGroup & { bowler_id?: string | null } = { over_number: 1, balls: [], runs: 0, wickets: 0, bowler_id: null };
    let legal = 0;

    for (const ev of overEvents) {
      const payload = safeParse(ev.payload_json);
      if (payload.bowlerId) building.bowler_id = payload.bowlerId;

      building.balls.push({
        ball: building.balls.length + 1,
        label: payload.token || String(payload.runs ?? 0),
        runs: payload.runs ?? 0,
        isWicket: Boolean(payload.isWicket),
        extraType: payload.extraType ?? null
      });
      building.runs += payload.totalRuns ?? payload.runs ?? 0;
      if (payload.isWicket) building.wickets += 1;

      if (isLegalDelivery(payload.extraType)) {
        legal += 1;
        if (legal % 6 === 0) {
          completed.push(building);
          building = { over_number: completed.length + 1, balls: [], runs: 0, wickets: 0, bowler_id: null };
        }
      }
    }

    thisOver = building.balls;
    recentOvers = completed.slice(-3).reverse();
    if (completed.length > 0) {
      previousBowlerId = completed[completed.length - 1].bowler_id || null;
    }

    fallOfWickets = (db.prepare(`
      SELECT mb.player_id, mb.fow_score, mb.fow_ball, p.name
      FROM match_batting mb
      JOIN players p ON mb.player_id = p.id
      WHERE mb.match_id = ? AND mb.innings_number = ? AND mb.status = 'out'
      ORDER BY mb.fow_ball ASC, mb.fow_score ASC
    `).all(matchId, currentRow.innings_number) as any[]).map((r, i) => ({
      order: i + 1,
      player_id: r.player_id,
      name: r.name,
      score: r.fow_score ?? 0,
      overs: formatOvers(r.fow_ball ?? 0)
    }));
  }

  const striker = batting.find(b => b.is_striker) || null;
  const nonStriker = batting.find(b => b.is_non_striker) || null;
  const currentBowler = bowling.find(b => b.is_current) || null;

  // Chase math -- innings 2 only.
  let runsRequired: number | null = null;
  let ballsRemaining: number | null = null;
  let requiredRunRate: number | null = null;

  if (currentRow && currentRow.target != null && currentRow.status === 'in_progress') {
    runsRequired = Math.max(0, currentRow.target - currentRow.runs);
    ballsRemaining = Math.max(0, oversLimit * 6 - currentRow.balls);
    requiredRunRate = ballsRemaining > 0 ? round2((runsRequired / ballsRemaining) * 6) : 0;
  }

  const recentEvents = (db.prepare(`
    SELECT id, event_number, event_type, payload_json, timestamp
    FROM match_events WHERE match_id = ?
    ORDER BY event_number DESC LIMIT 30
  `).all(matchId) as any[]).map(ev => {
    const payload = safeParse(ev.payload_json);
    return {
      id: ev.id,
      event_number: ev.event_number,
      label: payload.label || ev.event_type,
      timestamp: ev.timestamp
    };
  });

  return {
    match_id: match.id,
    tournament_id: match.tournament_id,
    match_number: match.match_number,
    stage: match.stage,
    venue: match.venue,
    status: match.status,
    overs_limit: oversLimit,
    current_innings: state.current_innings,
    home_team: home,
    away_team: away,
    innings,
    all_innings: allInnings,
    batting,
    bowling,
    striker,
    non_striker: nonStriker,
    current_bowler: currentBowler,
    previous_bowler_id: previousBowlerId,
    this_over: thisOver,
    recent_overs: recentOvers,
    fall_of_wickets: fallOfWickets,
    runs_required: runsRequired,
    balls_remaining: ballsRemaining,
    required_run_rate: requiredRunRate,
    result_summary: match.result_summary,
    winner_team_id: match.winner_team_id,
    recent_events: recentEvents
  };
}

function safeParse(json: string): any {
  try {
    return typeof json === 'string' ? JSON.parse(json) : json || {};
  } catch {
    return {};
  }
}

/** Squad of a franchise, for the scorer's batter/bowler pickers. */
export function getMatchSquads(matchId: string) {
  const match = getMatchRow(matchId);

  const squadFor = (franchiseId: string) => db.prepare(`
    SELECT p.id, p.name, p.photo_url, p.group_name, p.is_captain, p.stats_json
    FROM auction_lots al
    JOIN players p ON al.player_id = p.id
    WHERE al.buyer_id = ? AND al.status = 'sold'
    ORDER BY al.updated_at ASC
  `).all(franchiseId) as any[];

  return {
    home: { team: teamBrand(match, 'home_team'), players: squadFor(match.home_team_id) },
    away: { team: teamBrand(match, 'away_team'), players: squadFor(match.away_team_id) }
  };
}

// ---------------------------------------------------------------- mutations

export const MIN_OVERS_LIMIT = 1;
export const MAX_OVERS_LIMIT = 50;

export function startInnings(
  matchId: string,
  opts: {
    battingTeamId: string;
    strikerId: string;
    nonStrikerId: string;
    bowlerId: string;
    /** Overs per side. Only honoured when opening innings 1; innings 2 inherits it. */
    oversLimit?: number;
  }
): LiveMatchState {
  const match = getMatchRow(matchId);
  const { battingTeamId, strikerId, nonStrikerId, bowlerId } = opts;

  if (battingTeamId !== match.home_team_id && battingTeamId !== match.away_team_id) {
    throw new Error('Batting team must be one of the two teams in this match.');
  }
  if (strikerId === nonStrikerId) {
    throw new Error('Striker and non-striker must be different players.');
  }

  const bowlingTeamId = battingTeamId === match.home_team_id ? match.away_team_id : match.home_team_id;
  const existing = db.prepare('SELECT * FROM match_innings WHERE match_id = ? ORDER BY innings_number ASC').all(matchId) as any[];

  if (existing.some(i => i.status === 'in_progress')) {
    throw new Error('An innings is already in progress. Complete it before starting the next one.');
  }
  if (existing.length >= 2) {
    throw new Error('Both innings have already been played.');
  }

  const inningsNumber = existing.length + 1;
  // Innings 2 chases first-innings runs + 1.
  const target = inningsNumber === 2 ? (existing[0].runs as number) + 1 : null;

  // The overs limit is a match-level setting: both sides must get the same
  // quota, so it is fixed when innings 1 opens and inherited by the chase.
  let oversLimit: number = match.overs_limit || 20;
  if (opts.oversLimit != null) {
    if (inningsNumber === 2) {
      throw new Error('The overs limit is fixed when the first innings opens and cannot change mid-match.');
    }
    const parsed = Math.floor(Number(opts.oversLimit));
    if (!Number.isFinite(parsed) || parsed < MIN_OVERS_LIMIT || parsed > MAX_OVERS_LIMIT) {
      throw new Error(`Overs per side must be a whole number between ${MIN_OVERS_LIMIT} and ${MAX_OVERS_LIMIT}.`);
    }
    oversLimit = parsed;
  }

  const run = db.transaction(() => {
    // Opening an innings resets its slate. This clears any half-entered attempt
    // and any events logged by the pre-engine scorer console, which used the
    // same match_events table with a different payload shape.
    db.prepare('DELETE FROM match_events WHERE match_id = ? AND innings = ?').run(matchId, inningsNumber);
    db.prepare('DELETE FROM match_batting WHERE match_id = ? AND innings_number = ?').run(matchId, inningsNumber);
    db.prepare('DELETE FROM match_bowling WHERE match_id = ? AND innings_number = ?').run(matchId, inningsNumber);

    db.prepare(`
      INSERT INTO match_innings (id, match_id, innings_number, batting_team_id, bowling_team_id, target, status)
      VALUES (?, ?, ?, ?, ?, ?, 'in_progress')
    `).run(uuidv4(), matchId, inningsNumber, battingTeamId, bowlingTeamId, target);

    db.prepare(`
      INSERT INTO match_live_state (match_id, current_innings, striker_id, non_striker_id, bowler_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(match_id) DO UPDATE SET
        current_innings = excluded.current_innings,
        striker_id = excluded.striker_id,
        non_striker_id = excluded.non_striker_id,
        bowler_id = excluded.bowler_id,
        last_updated = CURRENT_TIMESTAMP
    `).run(matchId, inningsNumber, strikerId, nonStrikerId, bowlerId);

    ensureBatter(matchId, inningsNumber, strikerId, 'batting');
    ensureBatter(matchId, inningsNumber, nonStrikerId, 'batting');
    ensureBowler(matchId, inningsNumber, bowlerId);

    if (inningsNumber === 1) {
      db.prepare('UPDATE matches SET overs_limit = ? WHERE id = ?').run(oversLimit, matchId);
    }

    if (match.status === 'upcoming') {
      db.prepare("UPDATE matches SET status = 'live' WHERE id = ?").run(matchId);
    }

    logEvent(matchId, inningsNumber, 'innings_start', {
      label: `Innings ${inningsNumber} underway — ${oversLimit} overs a side${target ? `, target ${target}` : ''}`,
      battingTeamId,
      oversLimit,
      target
    });
  });

  run();
  return getLiveMatchState(matchId);
}

function ensureBatter(matchId: string, inningsNumber: number, playerId: string, status: BatterStatus) {
  const existing = db.prepare(
    'SELECT * FROM match_batting WHERE match_id = ? AND innings_number = ? AND player_id = ?'
  ).get(matchId, inningsNumber, playerId) as any;

  if (existing) {
    if (existing.status === 'did_not_bat') {
      db.prepare('UPDATE match_batting SET status = ? WHERE id = ?').run(status, existing.id);
    }
    return;
  }

  const count = db.prepare(
    'SELECT COUNT(*) AS c FROM match_batting WHERE match_id = ? AND innings_number = ?'
  ).get(matchId, inningsNumber) as any;

  db.prepare(`
    INSERT INTO match_batting (id, match_id, innings_number, player_id, batting_position, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), matchId, inningsNumber, playerId, count.c + 1, status);
}

function ensureBowler(matchId: string, inningsNumber: number, playerId: string) {
  const existing = db.prepare(
    'SELECT id FROM match_bowling WHERE match_id = ? AND innings_number = ? AND player_id = ?'
  ).get(matchId, inningsNumber, playerId) as any;

  if (!existing) {
    db.prepare(`
      INSERT INTO match_bowling (id, match_id, innings_number, player_id)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), matchId, inningsNumber, playerId);
  }
}

export function recordBall(matchId: string, input: BallInput): LiveMatchState {
  const { state, innings } = requireActiveInnings(matchId);
  const match = getMatchRow(matchId);
  const oversLimit: number = match.overs_limit || 20;

  if (!state.striker_id || !state.non_striker_id || !state.bowler_id) {
    throw new Error('Set the striker, non-striker and bowler before recording a delivery.');
  }

  const runs = Math.max(0, Number(input.runs) || 0);
  const extraType = input.extraType ?? null;
  const isWicket = Boolean(input.isWicket);
  const legal = isLegalDelivery(extraType);
  // A wide or no-ball concedes one penalty run on top of anything run off it.
  const penalty = extraType === 'wide' || extraType === 'no_ball' ? 1 : 0;
  const totalRuns = runs + penalty;
  const batterRuns = creditsBatter(extraType) ? runs : 0;
  const extrasAdded = totalRuns - batterRuns;

  const strikerRow = db.prepare('SELECT name FROM players WHERE id = ?').get(state.striker_id) as any;
  const bowlerRow = db.prepare('SELECT name FROM players WHERE id = ?').get(state.bowler_id) as any;
  const dismissedId = input.dismissedPlayerId || state.striker_id;

  if (isWicket && dismissedId !== state.striker_id && dismissedId !== state.non_striker_id) {
    throw new Error('The dismissed batsman must be one of the two players at the crease.');
  }
  const dismissedRow = isWicket
    ? db.prepare('SELECT name FROM players WHERE id = ?').get(dismissedId) as any
    : null;

  const run = db.transaction(() => {
    // --- innings totals
    const newRuns = innings.runs + totalRuns;
    const newBalls = innings.balls + (legal ? 1 : 0);
    const newWickets = innings.wickets + (isWicket ? 1 : 0);

    db.prepare(`
      UPDATE match_innings SET runs = ?, balls = ?, wickets = ?, extras = ?
      WHERE id = ?
    `).run(newRuns, newBalls, newWickets, innings.extras + extrasAdded, innings.id);

    // --- batter
    db.prepare(`
      UPDATE match_batting
      SET runs = runs + ?, balls = balls + ?, fours = fours + ?, sixes = sixes + ?
      WHERE match_id = ? AND innings_number = ? AND player_id = ?
    `).run(
      batterRuns,
      legal ? 1 : 0,
      creditsBatter(extraType) && runs === 4 ? 1 : 0,
      creditsBatter(extraType) && runs === 6 ? 1 : 0,
      matchId,
      innings.innings_number,
      state.striker_id
    );

    // --- bowler (byes and leg-byes are not charged to the bowler)
    const bowlerConcedes = extraType === 'bye' || extraType === 'leg_bye' ? penalty : totalRuns;
    db.prepare(`
      UPDATE match_bowling
      SET balls = balls + ?, runs = runs + ?, wickets = wickets + ?
      WHERE match_id = ? AND innings_number = ? AND player_id = ?
    `).run(
      legal ? 1 : 0,
      bowlerConcedes,
      // Run-outs are not credited to the bowler.
      isWicket && input.dismissalType !== 'run_out' ? 1 : 0,
      matchId,
      innings.innings_number,
      state.bowler_id
    );

    // --- strike rotation for runs the batsmen actually completed.
    // Driven by the runs run, not the total: a wide's penalty run does not move
    // anyone, but byes run off that wide do. Completed runs count on a wicket
    // ball too -- a batsman run out going for a second still banks the first.
    if (runs % 2 === 1) swapStrikeInternal(matchId);

    // --- an incomplete run on which the batsmen had already crossed leaves them
    // at opposite ends from where the completed runs left them.
    if (isWicket && input.batsmenCrossed) swapStrikeInternal(matchId);

    // --- dismissal, recorded after the ends are settled so the correct end is vacated
    if (isWicket) {
      db.prepare(`
        UPDATE match_batting
        SET status = 'out', dismissal_type = ?, dismissal_bowler_id = ?, fow_score = ?, fow_ball = ?
        WHERE match_id = ? AND innings_number = ? AND player_id = ?
      `).run(
        input.dismissalType || 'bowled',
        // A run out is a fielding dismissal: no bowler is credited.
        input.dismissalType === 'run_out' ? null : state.bowler_id,
        newRuns,
        newBalls,
        matchId,
        innings.innings_number,
        dismissedId
      );

      // The fallen batter leaves the crease; the scorer names the replacement next.
      const ends = db.prepare('SELECT striker_id, non_striker_id FROM match_live_state WHERE match_id = ?').get(matchId) as any;
      const vacated = ends.striker_id === dismissedId ? 'striker_id' : 'non_striker_id';
      db.prepare(`UPDATE match_live_state SET ${vacated} = NULL WHERE match_id = ?`).run(matchId);
    }

    // --- over completion: ends change over regardless of a wicket, then the
    // bowler is cleared so a new one must be named.
    const overComplete = legal && newBalls % 6 === 0;
    if (overComplete) {
      swapStrikeInternal(matchId);
      db.prepare('UPDATE match_live_state SET bowler_id = NULL WHERE match_id = ?').run(matchId);
    }

    const token = ballToken({ ...input, runs });
    logEvent(matchId, innings.innings_number, 'ball', {
      runs,
      totalRuns,
      extraType,
      isWicket,
      dismissalType: input.dismissalType ?? null,
      dismissedId: isWicket ? dismissedId : null,
      batsmenCrossed: Boolean(input.batsmenCrossed),
      token,
      // Both ends are recorded so undo can restore the crease exactly.
      strikerId: state.striker_id,
      nonStrikerId: state.non_striker_id,
      bowlerId: state.bowler_id,
      label: ballLabel({ ...input, runs }, strikerRow?.name || 'Batter', bowlerRow?.name || 'Bowler', dismissedRow?.name)
    });

    if (overComplete) {
      logEvent(matchId, innings.innings_number, 'over_complete', {
        label: `End of over ${newBalls / 6} — ${newRuns}/${newWickets}`
      });
    }

    // --- automatic innings/match closure
    const allOut = newWickets >= 10;
    const oversDone = newBalls >= oversLimit * 6;
    const targetChased = innings.target != null && newRuns >= innings.target;

    if (allOut || oversDone || targetChased) {
      closeInningsInternal(matchId, innings.innings_number, {
        allOut,
        oversDone,
        targetChased
      });
    }

    touchState(matchId);
  });

  run();
  return getLiveMatchState(matchId);
}

function swapStrikeInternal(matchId: string) {
  const s = db.prepare('SELECT striker_id, non_striker_id FROM match_live_state WHERE match_id = ?').get(matchId) as any;
  db.prepare('UPDATE match_live_state SET striker_id = ?, non_striker_id = ? WHERE match_id = ?')
    .run(s.non_striker_id, s.striker_id, matchId);
}

export function swapStrike(matchId: string): LiveMatchState {
  requireActiveInnings(matchId);
  swapStrikeInternal(matchId);
  touchState(matchId);
  return getLiveMatchState(matchId);
}

/** Sends the next batter in after a wicket, into whichever end is vacant. */
export function setNewBatter(matchId: string, playerId: string): LiveMatchState {
  const { state, innings } = requireActiveInnings(matchId);

  if (state.striker_id && state.non_striker_id) {
    throw new Error('Both ends are occupied. A new batter is only needed after a wicket.');
  }
  if (playerId === state.striker_id || playerId === state.non_striker_id) {
    throw new Error('That batter is already at the crease.');
  }

  const alreadyOut = db.prepare(`
    SELECT status FROM match_batting
    WHERE match_id = ? AND innings_number = ? AND player_id = ?
  `).get(matchId, innings.innings_number, playerId) as any;

  if (alreadyOut?.status === 'out') {
    throw new Error('That batter is already out in this innings.');
  }

  const end = state.striker_id ? 'non_striker_id' : 'striker_id';
  const player = db.prepare('SELECT name FROM players WHERE id = ?').get(playerId) as any;

  const run = db.transaction(() => {
    ensureBatter(matchId, innings.innings_number, playerId, 'batting');
    db.prepare(`UPDATE match_batting SET status = 'batting' WHERE match_id = ? AND innings_number = ? AND player_id = ?`)
      .run(matchId, innings.innings_number, playerId);
    db.prepare(`UPDATE match_live_state SET ${end} = ? WHERE match_id = ?`).run(playerId, matchId);
    logEvent(matchId, innings.innings_number, 'new_batter', { label: `${player?.name || 'New batter'} walks out to the middle`, playerId });
    touchState(matchId);
  });

  run();
  return getLiveMatchState(matchId);
}

export function setBowler(matchId: string, playerId: string): LiveMatchState {
  const { state, innings } = requireActiveInnings(matchId);

  if (playerId === state.bowler_id) return getLiveMatchState(matchId);

  const player = db.prepare('SELECT name FROM players WHERE id = ?').get(playerId) as any;

  const run = db.transaction(() => {
    ensureBowler(matchId, innings.innings_number, playerId);
    db.prepare('UPDATE match_live_state SET bowler_id = ? WHERE match_id = ?').run(playerId, matchId);
    logEvent(matchId, innings.innings_number, 'bowler_change', { label: `${player?.name || 'New bowler'} into the attack`, playerId });
    touchState(matchId);
  });

  run();
  return getLiveMatchState(matchId);
}

/**
 * Swaps a batter at the crease for another squad member without recording a
 * dismissal -- for retired hurt or a scorer correction.
 */
export function replaceBatter(matchId: string, outgoingId: string, incomingId: string): LiveMatchState {
  const { state, innings } = requireActiveInnings(matchId);

  const end = state.striker_id === outgoingId ? 'striker_id'
    : state.non_striker_id === outgoingId ? 'non_striker_id'
      : null;

  if (!end) throw new Error('That batter is not currently at the crease.');
  if (incomingId === state.striker_id || incomingId === state.non_striker_id) {
    throw new Error('The incoming batter is already at the crease.');
  }

  const outgoing = db.prepare('SELECT name FROM players WHERE id = ?').get(outgoingId) as any;
  const incoming = db.prepare('SELECT name FROM players WHERE id = ?').get(incomingId) as any;

  const run = db.transaction(() => {
    db.prepare(`UPDATE match_batting SET status = 'not_out' WHERE match_id = ? AND innings_number = ? AND player_id = ?`)
      .run(matchId, innings.innings_number, outgoingId);
    ensureBatter(matchId, innings.innings_number, incomingId, 'batting');
    db.prepare(`UPDATE match_batting SET status = 'batting' WHERE match_id = ? AND innings_number = ? AND player_id = ?`)
      .run(matchId, innings.innings_number, incomingId);
    db.prepare(`UPDATE match_live_state SET ${end} = ? WHERE match_id = ?`).run(incomingId, matchId);
    logEvent(matchId, innings.innings_number, 'batter_replaced', {
      label: `${incoming?.name || 'Batter'} replaces ${outgoing?.name || 'batter'}`,
      outgoingId,
      incomingId
    });
    touchState(matchId);
  });

  run();
  return getLiveMatchState(matchId);
}

/** Is this player in the given franchise's squad for this tournament? */
function isInSquad(franchiseId: string, playerId: string): boolean {
  const row = db.prepare(`
    SELECT 1 FROM auction_lots
    WHERE buyer_id = ? AND player_id = ? AND status = 'sold'
  `).get(franchiseId, playerId);
  return Boolean(row);
}

/**
 * Swaps one bowler for another.
 *
 * With transferFigures the current innings' figures move across, along with the
 * deliveries in the ball log and any wickets credited to the outgoing bowler.
 * That is the correction path: the scorer named the wrong player and the spell
 * belongs to someone else. Without it the outgoing bowler simply keeps his
 * figures and hands over the ball, which is what happens for an injury.
 */
export function replaceBowler(
  matchId: string,
  outgoingId: string,
  incomingId: string,
  transferFigures = true
): LiveMatchState {
  const { state, innings } = requireActiveInnings(matchId);

  if (!outgoingId || !incomingId) throw new Error('Both an outgoing and an incoming bowler are required.');
  if (outgoingId === incomingId) throw new Error('Choose a different bowler to bring on.');

  const outRow = db.prepare(`
    SELECT * FROM match_bowling WHERE match_id = ? AND innings_number = ? AND player_id = ?
  `).get(matchId, innings.innings_number, outgoingId) as any;

  if (!outRow) throw new Error('That bowler has not bowled in this innings.');

  if (!isInSquad(innings.bowling_team_id, incomingId)) {
    throw new Error('The incoming bowler must be in the fielding side\'s squad.');
  }

  const outgoing = db.prepare('SELECT name FROM players WHERE id = ?').get(outgoingId) as any;
  const incoming = db.prepare('SELECT name FROM players WHERE id = ?').get(incomingId) as any;

  const run = db.transaction(() => {
    ensureBowler(matchId, innings.innings_number, incomingId);

    if (transferFigures) {
      db.prepare(`
        UPDATE match_bowling
        SET balls = balls + ?, runs = runs + ?, wickets = wickets + ?, maidens = maidens + ?
        WHERE match_id = ? AND innings_number = ? AND player_id = ?
      `).run(outRow.balls, outRow.runs, outRow.wickets, outRow.maidens, matchId, innings.innings_number, incomingId);

      // Drop the emptied row so the scorecard does not show a ghost 0-0-0-0.
      db.prepare('DELETE FROM match_bowling WHERE id = ?').run(outRow.id);

      // Re-point the ball log, otherwise a later undo would decrement a bowler
      // whose figures have already moved and drive them negative.
      const balls = db.prepare(`
        SELECT id, payload_json FROM match_events
        WHERE match_id = ? AND innings = ? AND event_type = 'ball'
      `).all(matchId, innings.innings_number) as any[];

      const repoint = db.prepare('UPDATE match_events SET payload_json = ? WHERE id = ?');
      for (const ev of balls) {
        const payload = safeParse(ev.payload_json);
        if (payload.bowlerId === outgoingId) {
          payload.bowlerId = incomingId;
          repoint.run(JSON.stringify(payload), ev.id);
        }
      }

      // Wickets on the batting card were credited to the outgoing bowler.
      db.prepare(`
        UPDATE match_batting SET dismissal_bowler_id = ?
        WHERE match_id = ? AND innings_number = ? AND dismissal_bowler_id = ?
      `).run(incomingId, matchId, innings.innings_number, outgoingId);
    }

    if (state.bowler_id === outgoingId) {
      db.prepare('UPDATE match_live_state SET bowler_id = ? WHERE match_id = ?').run(incomingId, matchId);
    }

    logEvent(matchId, innings.innings_number, 'bowler_replaced', {
      label: transferFigures
        ? `${incoming?.name || 'Bowler'} replaces ${outgoing?.name || 'bowler'} — spell reassigned`
        : `${incoming?.name || 'Bowler'} takes over from ${outgoing?.name || 'bowler'}`,
      outgoingId,
      incomingId,
      transferFigures
    });

    touchState(matchId);
  });

  run();
  return getLiveMatchState(matchId);
}

function closeInningsInternal(
  matchId: string,
  inningsNumber: number,
  reason: { allOut?: boolean; oversDone?: boolean; targetChased?: boolean; manual?: boolean }
) {
  db.prepare(`UPDATE match_innings SET status = 'completed' WHERE match_id = ? AND innings_number = ?`)
    .run(matchId, inningsNumber);

  // Anyone still at the crease finishes not out.
  db.prepare(`
    UPDATE match_batting SET status = 'not_out'
    WHERE match_id = ? AND innings_number = ? AND status = 'batting'
  `).run(matchId, inningsNumber);

  const label = reason.targetChased ? 'Target chased — innings complete'
    : reason.allOut ? 'All out — innings complete'
      : reason.oversDone ? 'Overs completed — innings complete'
        : 'Innings declared complete';

  logEvent(matchId, inningsNumber, 'innings_complete', { label });

  if (inningsNumber === 2) {
    finaliseMatch(matchId);
  }
}

export function completeInnings(matchId: string): LiveMatchState {
  const { innings } = requireActiveInnings(matchId);
  const run = db.transaction(() => {
    closeInningsInternal(matchId, innings.innings_number, { manual: true });
    touchState(matchId);
  });
  run();
  return getLiveMatchState(matchId);
}

/**
 * Decides the result from both innings and hands the numbers to the existing
 * completeMatch(), which owns points-table and NRR updates.
 */
function finaliseMatch(matchId: string) {
  const match = getMatchRow(matchId);
  const innings = db.prepare(
    'SELECT * FROM match_innings WHERE match_id = ? ORDER BY innings_number ASC'
  ).all(matchId) as any[];

  if (innings.length < 2) return;

  const [first, second] = innings;
  const oversLimit: number = match.overs_limit || 20;
  const oversOf = (row: any) => row.balls / 6;

  let winnerTeamId: string;
  let summary: string;

  const nameOf = (id: string) => (id === match.home_team_id ? match.home_team_name : match.away_team_name);

  if (second.runs > first.runs) {
    winnerTeamId = second.batting_team_id;
    summary = `${nameOf(second.batting_team_id)} won by ${10 - second.wickets} wicket${10 - second.wickets === 1 ? '' : 's'}`;
  } else if (first.runs > second.runs) {
    winnerTeamId = first.batting_team_id;
    summary = `${nameOf(first.batting_team_id)} won by ${first.runs - second.runs} run${first.runs - second.runs === 1 ? '' : 's'}`;
  } else {
    // Tie: the schema has no tie-breaker column, so the first innings side is
    // recorded as winner and the summary states the tie plainly.
    winnerTeamId = first.batting_team_id;
    summary = `Match tied — ${first.runs} apiece`;
  }

  const homeIsFirst = first.batting_team_id === match.home_team_id;
  const homeInnings = homeIsFirst ? first : second;
  const awayInnings = homeIsFirst ? second : first;

  // NRR convention: a side bowled out is charged the full quota of overs.
  const chargedOvers = (row: any) => (row.wickets >= 10 ? oversLimit : oversOf(row));

  completeMatch(
    matchId,
    winnerTeamId,
    summary,
    { runs: homeInnings.runs, overs: chargedOvers(homeInnings) },
    { runs: awayInnings.runs, overs: chargedOvers(awayInnings) }
  );

  logEvent(matchId, 2, 'match_complete', { label: summary, winnerTeamId });
}

export function completeMatchNow(matchId: string): LiveMatchState {
  const innings = db.prepare('SELECT * FROM match_innings WHERE match_id = ?').all(matchId) as any[];

  const run = db.transaction(() => {
    for (const i of innings) {
      if (i.status === 'in_progress') {
        closeInningsInternal(matchId, i.innings_number, { manual: true });
      }
    }
    if (innings.length >= 2) {
      finaliseMatch(matchId);
    } else {
      db.prepare("UPDATE matches SET status = 'completed' WHERE id = ?").run(matchId);
      logEvent(matchId, 1, 'match_complete', { label: 'Match closed by the scorer' });
    }
    touchState(matchId);
  });

  run();
  return getLiveMatchState(matchId);
}

/** Reverses the most recent delivery, including its side effects. */
export function undoLastBall(matchId: string): LiveMatchState {
  const { state, innings } = requireActiveInnings(matchId);

  const last = db.prepare(`
    SELECT * FROM match_events
    WHERE match_id = ? AND innings = ? AND event_type = 'ball'
    ORDER BY event_number DESC LIMIT 1
  `).get(matchId, innings.innings_number) as any;

  if (!last) throw new Error('There is no delivery to undo in this innings.');

  const payload = safeParse(last.payload_json);
  const legal = isLegalDelivery(payload.extraType);
  const penalty = payload.extraType === 'wide' || payload.extraType === 'no_ball' ? 1 : 0;
  const runs = payload.runs ?? 0;
  const totalRuns = payload.totalRuns ?? runs + penalty;
  const batterRuns = creditsBatter(payload.extraType) ? runs : 0;
  const extrasAdded = totalRuns - batterRuns;
  const bowlerConcedes = payload.extraType === 'bye' || payload.extraType === 'leg_bye' ? penalty : totalRuns;

  const run = db.transaction(() => {
    db.prepare(`
      UPDATE match_innings
      SET runs = runs - ?, balls = balls - ?, wickets = wickets - ?, extras = extras - ?
      WHERE id = ?
    `).run(totalRuns, legal ? 1 : 0, payload.isWicket ? 1 : 0, extrasAdded, innings.id);

    db.prepare(`
      UPDATE match_batting
      SET runs = runs - ?, balls = balls - ?, fours = fours - ?, sixes = sixes - ?
      WHERE match_id = ? AND innings_number = ? AND player_id = ?
    `).run(
      batterRuns,
      legal ? 1 : 0,
      creditsBatter(payload.extraType) && runs === 4 ? 1 : 0,
      creditsBatter(payload.extraType) && runs === 6 ? 1 : 0,
      matchId, innings.innings_number, payload.strikerId
    );

    db.prepare(`
      UPDATE match_bowling
      SET balls = balls - ?, runs = runs - ?, wickets = wickets - ?
      WHERE match_id = ? AND innings_number = ? AND player_id = ?
    `).run(
      legal ? 1 : 0,
      bowlerConcedes,
      payload.isWicket && payload.dismissalType !== 'run_out' ? 1 : 0,
      matchId, innings.innings_number, payload.bowlerId
    );

    if (payload.isWicket) {
      // Reinstate the exact batsman recorded on that delivery. Older events
      // predate dismissedId, so fall back to the most recent dismissal.
      const target = payload.dismissedId
        ? (db.prepare(`
            SELECT id FROM match_batting
            WHERE match_id = ? AND innings_number = ? AND player_id = ? AND status = 'out'
          `).get(matchId, innings.innings_number, payload.dismissedId) as any)
        : (db.prepare(`
            SELECT id FROM match_batting
            WHERE match_id = ? AND innings_number = ? AND status = 'out'
            ORDER BY fow_ball DESC, fow_score DESC LIMIT 1
          `).get(matchId, innings.innings_number) as any);

      if (target) {
        db.prepare(`
          UPDATE match_batting
          SET status = 'batting', dismissal_type = NULL, dismissal_bowler_id = NULL, fow_score = NULL, fow_ball = NULL
          WHERE id = ?
        `).run(target.id);
      }
    }

    // Restore the crease and the bowler exactly as they stood before that
    // delivery. Both ends are stored on the event, so no inference is needed.
    db.prepare('UPDATE match_live_state SET striker_id = ?, non_striker_id = ?, bowler_id = ? WHERE match_id = ?')
      .run(
        payload.strikerId,
        payload.nonStrikerId ?? state.non_striker_id,
        payload.bowlerId,
        matchId
      );

    // Drop the ball event plus any over/innings markers logged after it.
    db.prepare('DELETE FROM match_events WHERE match_id = ? AND event_number >= ?').run(matchId, last.event_number);

    db.prepare(`UPDATE match_innings SET status = 'in_progress' WHERE match_id = ? AND innings_number = ?`)
      .run(matchId, innings.innings_number);

    logEvent(matchId, innings.innings_number, 'undo', { label: 'Scorer reversed the previous delivery' });
    touchState(matchId);
  });

  run();
  return getLiveMatchState(matchId);
}

/**
 * Wipes a match back to its unplayed state so the scorer can re-enter the
 * opening configuration -- batting side, opening pair, bowler and overs.
 *
 * Destructive: every ball, scorecard row and commentary line for this match is
 * discarded. If the match had already been completed its contribution to the
 * standings is reversed first, using the innings rows it was computed from,
 * so the points table stays consistent.
 */
export function resetMatch(matchId: string): LiveMatchState {
  getMatchRow(matchId); // throws if the match does not exist

  const run = db.transaction(() => {
    // Undo the standings contribution before the innings it was derived from
    // are deleted. No-op unless the match was completed through this engine.
    revertMatchFromStandings(matchId);
    purgeMatchData(matchId);

    db.prepare(`
      UPDATE matches
      SET status = 'upcoming', winner_team_id = NULL, result_summary = NULL
      WHERE id = ?
    `).run(matchId);
  });

  run();

  // Logged after the wipe so the note survives it. getLiveStateRow() recreates
  // a clean pointer row on the next read.
  logEvent(matchId, 1, 'match_reset', { label: 'Scorer reset the match — awaiting new setup' });
  return getLiveMatchState(matchId);
}

/** Matches that a spectator can currently watch. */
export function getBroadcastableMatches(tournamentId: string) {
  return db.prepare(`
    SELECT m.id, m.match_number, m.stage, m.venue, m.status, m.result_summary,
           h.name AS home_team_name, h.short_name AS home_team_short, h.logo_url AS home_team_logo, h.primary_color AS home_team_color,
           a.name AS away_team_name, a.short_name AS away_team_short, a.logo_url AS away_team_logo, a.primary_color AS away_team_color
    FROM matches m
    JOIN franchises h ON m.home_team_id = h.id
    JOIN franchises a ON m.away_team_id = a.id
    WHERE m.tournament_id = ?
    ORDER BY
      CASE m.status WHEN 'live' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
      m.match_number ASC
  `).all(tournamentId);
}
