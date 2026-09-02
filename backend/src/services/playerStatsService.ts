import { db } from '../db/database';
import { formatOvers } from './liveMatchService';

/**
 * Player and match analytics.
 *
 * Career figures are DERIVED from the per-innings rows the match engine already
 * writes (match_batting / match_bowling) rather than kept in a parallel summary
 * table. There is therefore one source of truth: correcting a scorecard, undoing
 * a ball or resetting a match flows straight through to every aggregate, with no
 * chance of the two drifting apart.
 *
 * Innings rows survive for the life of the fixture, so this doubles as the
 * historical record a future auction can be priced against.
 */

// ---------------------------------------------------------------- types

export interface CareerBatting {
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  not_outs: number;
  dismissals: number;
  highest_score: number;
  highest_not_out: boolean;
  /** Runs per dismissal. Null when the batter has never been out. */
  average: number | null;
  strike_rate: number;
  fifties: number;
  hundreds: number;
  ducks: number;
}

export interface CareerBowling {
  innings: number;
  balls: number;
  overs: string;
  runs: number;
  wickets: number;
  maidens: number;
  economy: number;
  /** Runs per wicket. Null when the bowler has never taken one. */
  average: number | null;
  /** Balls per wicket. Null when the bowler has never taken one. */
  strike_rate: number | null;
  best_wickets: number;
  best_runs: number;
  three_wicket_hauls: number;
  five_wicket_hauls: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Only fixtures that actually happened contribute to a player's record. */
const PLAYED_STATUSES = "('live', 'completed')";

// ---------------------------------------------------------------- player

export function getPlayerStats(playerId: string, tournamentId: string) {
  const player = db.prepare(`
    SELECT p.*, f.id AS franchise_id, f.name AS franchise_name, f.short_name AS franchise_short,
           f.logo_url AS franchise_logo, f.primary_color AS franchise_color, f.secondary_color AS franchise_secondary,
           al.sold_price
    FROM players p
    LEFT JOIN auction_lots al ON al.player_id = p.id AND al.status = 'sold'
    LEFT JOIN franchises f ON f.id = al.buyer_id
    WHERE p.id = ?
  `).get(playerId) as any;

  if (!player) throw new Error('Player not found');

  const bat = db.prepare(`
    SELECT
      COUNT(*) AS innings,
      COALESCE(SUM(mb.runs), 0) AS runs,
      COALESCE(SUM(mb.balls), 0) AS balls,
      COALESCE(SUM(mb.fours), 0) AS fours,
      COALESCE(SUM(mb.sixes), 0) AS sixes,
      COALESCE(SUM(CASE WHEN mb.status = 'out' THEN 1 ELSE 0 END), 0) AS dismissals,
      COALESCE(SUM(CASE WHEN mb.status <> 'out' THEN 1 ELSE 0 END), 0) AS not_outs,
      COALESCE(SUM(CASE WHEN mb.runs >= 100 THEN 1 ELSE 0 END), 0) AS hundreds,
      COALESCE(SUM(CASE WHEN mb.runs >= 50 AND mb.runs < 100 THEN 1 ELSE 0 END), 0) AS fifties,
      COALESCE(SUM(CASE WHEN mb.runs = 0 AND mb.balls > 0 AND mb.status = 'out' THEN 1 ELSE 0 END), 0) AS ducks
    FROM match_batting mb
    JOIN matches m ON m.id = mb.match_id
    WHERE mb.player_id = ? AND m.tournament_id = ?
      AND m.status IN ${PLAYED_STATUSES} AND mb.status <> 'did_not_bat'
  `).get(playerId, tournamentId) as any;

  // Highest score needs the not-out flag, so it cannot come from MAX() alone.
  const best = db.prepare(`
    SELECT mb.runs, mb.status
    FROM match_batting mb
    JOIN matches m ON m.id = mb.match_id
    WHERE mb.player_id = ? AND m.tournament_id = ?
      AND m.status IN ${PLAYED_STATUSES} AND mb.status <> 'did_not_bat'
    ORDER BY mb.runs DESC, (mb.status <> 'out') DESC
    LIMIT 1
  `).get(playerId, tournamentId) as any;

  const bowl = db.prepare(`
    SELECT
      COUNT(*) AS innings,
      COALESCE(SUM(mbw.balls), 0) AS balls,
      COALESCE(SUM(mbw.runs), 0) AS runs,
      COALESCE(SUM(mbw.wickets), 0) AS wickets,
      COALESCE(SUM(mbw.maidens), 0) AS maidens,
      COALESCE(SUM(CASE WHEN mbw.wickets >= 5 THEN 1 ELSE 0 END), 0) AS five_fers,
      COALESCE(SUM(CASE WHEN mbw.wickets >= 3 AND mbw.wickets < 5 THEN 1 ELSE 0 END), 0) AS three_fers
    FROM match_bowling mbw
    JOIN matches m ON m.id = mbw.match_id
    WHERE mbw.player_id = ? AND m.tournament_id = ?
      AND m.status IN ${PLAYED_STATUSES} AND mbw.balls > 0
  `).get(playerId, tournamentId) as any;

  const bestBowl = db.prepare(`
    SELECT mbw.wickets, mbw.runs
    FROM match_bowling mbw
    JOIN matches m ON m.id = mbw.match_id
    WHERE mbw.player_id = ? AND m.tournament_id = ?
      AND m.status IN ${PLAYED_STATUSES} AND mbw.balls > 0
    ORDER BY mbw.wickets DESC, mbw.runs ASC
    LIMIT 1
  `).get(playerId, tournamentId) as any;

  const matchCount = db.prepare(`
    SELECT COUNT(DISTINCT match_id) AS c FROM (
      SELECT mb.match_id FROM match_batting mb JOIN matches m ON m.id = mb.match_id
        WHERE mb.player_id = ? AND m.tournament_id = ? AND m.status IN ${PLAYED_STATUSES}
      UNION
      SELECT mbw.match_id FROM match_bowling mbw JOIN matches m ON m.id = mbw.match_id
        WHERE mbw.player_id = ? AND m.tournament_id = ? AND m.status IN ${PLAYED_STATUSES}
    )
  `).get(playerId, tournamentId, playerId, tournamentId) as any;

  const batting: CareerBatting = {
    matches: matchCount.c,
    innings: bat.innings,
    runs: bat.runs,
    balls: bat.balls,
    fours: bat.fours,
    sixes: bat.sixes,
    not_outs: bat.not_outs,
    dismissals: bat.dismissals,
    highest_score: best?.runs ?? 0,
    highest_not_out: Boolean(best && best.status !== 'out'),
    average: bat.dismissals > 0 ? round2(bat.runs / bat.dismissals) : null,
    strike_rate: bat.balls > 0 ? round2((bat.runs / bat.balls) * 100) : 0,
    fifties: bat.fifties,
    hundreds: bat.hundreds,
    ducks: bat.ducks
  };

  const bowling: CareerBowling = {
    innings: bowl.innings,
    balls: bowl.balls,
    overs: formatOvers(bowl.balls),
    runs: bowl.runs,
    wickets: bowl.wickets,
    maidens: bowl.maidens,
    economy: bowl.balls > 0 ? round2((bowl.runs / bowl.balls) * 6) : 0,
    average: bowl.wickets > 0 ? round2(bowl.runs / bowl.wickets) : null,
    strike_rate: bowl.wickets > 0 ? round2(bowl.balls / bowl.wickets) : null,
    best_wickets: bestBowl?.wickets ?? 0,
    best_runs: bestBowl?.runs ?? 0,
    three_wicket_hauls: bowl.three_fers,
    five_wicket_hauls: bowl.five_fers
  };

  const battingInnings = (db.prepare(`
    SELECT mb.runs, mb.balls, mb.fours, mb.sixes, mb.status, mb.dismissal_type, mb.batting_position,
           mb.innings_number, m.id AS match_id, m.match_number, m.status AS match_status, m.scheduled_time,
           opp.name AS opponent_name, opp.short_name AS opponent_short, opp.primary_color AS opponent_color,
           bw.name AS dismissal_bowler_name
    FROM match_batting mb
    JOIN matches m ON m.id = mb.match_id
    JOIN match_innings mi ON mi.match_id = mb.match_id AND mi.innings_number = mb.innings_number
    JOIN franchises opp ON opp.id = mi.bowling_team_id
    LEFT JOIN players bw ON bw.id = mb.dismissal_bowler_id
    WHERE mb.player_id = ? AND m.tournament_id = ?
      AND m.status IN ${PLAYED_STATUSES} AND mb.status <> 'did_not_bat'
    ORDER BY m.match_number ASC, mb.innings_number ASC
  `).all(playerId, tournamentId) as any[]).map(r => ({
    ...r,
    strike_rate: r.balls > 0 ? round2((r.runs / r.balls) * 100) : 0,
    not_out: r.status !== 'out'
  }));

  const bowlingInnings = (db.prepare(`
    SELECT mbw.balls, mbw.runs, mbw.wickets, mbw.maidens, mbw.innings_number,
           m.id AS match_id, m.match_number, m.status AS match_status, m.scheduled_time,
           opp.name AS opponent_name, opp.short_name AS opponent_short, opp.primary_color AS opponent_color
    FROM match_bowling mbw
    JOIN matches m ON m.id = mbw.match_id
    JOIN match_innings mi ON mi.match_id = mbw.match_id AND mi.innings_number = mbw.innings_number
    JOIN franchises opp ON opp.id = mi.batting_team_id
    WHERE mbw.player_id = ? AND m.tournament_id = ?
      AND m.status IN ${PLAYED_STATUSES} AND mbw.balls > 0
    ORDER BY m.match_number ASC, mbw.innings_number ASC
  `).all(playerId, tournamentId) as any[]).map(r => ({
    ...r,
    overs: formatOvers(r.balls),
    economy: r.balls > 0 ? round2((r.runs / r.balls) * 6) : 0
  }));

  return {
    player: {
      id: player.id,
      name: player.name,
      photo_url: player.photo_url,
      group_name: player.group_name,
      is_foreign: player.is_foreign,
      is_captain: player.is_captain,
      base_price: player.base_price,
      sold_price: player.sold_price ?? null,
      role: parseRole(player.stats_json),
      pre_tournament_stats: safeParse(player.stats_json),
      franchise: player.franchise_id ? {
        id: player.franchise_id,
        name: player.franchise_name,
        short_name: player.franchise_short,
        logo_url: player.franchise_logo,
        primary_color: player.franchise_color,
        secondary_color: player.franchise_secondary
      } : null
    },
    batting,
    bowling,
    batting_innings: battingInnings,
    bowling_innings: bowlingInnings,
    // Most recent first, for a form guide.
    recent_batting: [...battingInnings].reverse().slice(0, 5),
    recent_bowling: [...bowlingInnings].reverse().slice(0, 5)
  };
}

function safeParse(json: string | null): any {
  try {
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

function parseRole(json: string | null): string | null {
  return safeParse(json).Role ?? null;
}

/**
 * Tournament-wide table, one row per squad player. Powers the picker list and
 * gives the admin an at-a-glance leaderboard for auction planning.
 */
export function getPlayerLeaderboard(tournamentId: string) {
  return db.prepare(`
    SELECT
      p.id, p.name, p.photo_url, p.group_name, p.is_foreign, p.is_captain, p.base_price, p.stats_json,
      f.short_name AS franchise_short, f.name AS franchise_name, f.primary_color AS franchise_color,
      al.sold_price,
      COALESCE(b.innings, 0)  AS bat_innings,
      COALESCE(b.runs, 0)     AS runs,
      COALESCE(b.balls, 0)    AS bat_balls,
      COALESCE(b.outs, 0)     AS dismissals,
      COALESCE(w.innings, 0)  AS bowl_innings,
      COALESCE(w.wickets, 0)  AS wickets,
      COALESCE(w.balls, 0)    AS bowl_balls,
      COALESCE(w.runs, 0)     AS runs_conceded
    FROM players p
    LEFT JOIN auction_lots al ON al.player_id = p.id AND al.status = 'sold'
    LEFT JOIN franchises f ON f.id = al.buyer_id
    LEFT JOIN (
      SELECT mb.player_id,
             COUNT(*) AS innings, SUM(mb.runs) AS runs, SUM(mb.balls) AS balls,
             SUM(CASE WHEN mb.status = 'out' THEN 1 ELSE 0 END) AS outs
      FROM match_batting mb JOIN matches m ON m.id = mb.match_id
      WHERE m.tournament_id = ? AND m.status IN ${PLAYED_STATUSES} AND mb.status <> 'did_not_bat'
      GROUP BY mb.player_id
    ) b ON b.player_id = p.id
    LEFT JOIN (
      SELECT mbw.player_id,
             COUNT(*) AS innings, SUM(mbw.wickets) AS wickets,
             SUM(mbw.balls) AS balls, SUM(mbw.runs) AS runs
      FROM match_bowling mbw JOIN matches m ON m.id = mbw.match_id
      WHERE m.tournament_id = ? AND m.status IN ${PLAYED_STATUSES} AND mbw.balls > 0
      GROUP BY mbw.player_id
    ) w ON w.player_id = p.id
    WHERE p.tournament_id = ?
    ORDER BY runs DESC, wickets DESC, p.name ASC
  `).all(tournamentId, tournamentId, tournamentId).map((r: any) => ({
    ...r,
    role: parseRole(r.stats_json),
    average: r.dismissals > 0 ? round2(r.runs / r.dismissals) : null,
    strike_rate: r.bat_balls > 0 ? round2((r.runs / r.bat_balls) * 100) : 0,
    economy: r.bowl_balls > 0 ? round2((r.runs_conceded / r.bowl_balls) * 6) : 0,
    overs: formatOvers(r.bowl_balls)
  }));
}

// ---------------------------------------------------------------- matches

/** Every fixture that has been played or is under way, newest first. */
export function getMatchHistory(tournamentId: string) {
  return db.prepare(`
    SELECT m.id, m.match_number, m.stage, m.venue, m.scheduled_time, m.status, m.result_summary, m.overs_limit,
           h.short_name AS home_team_short, h.name AS home_team_name, h.primary_color AS home_team_color,
           a.short_name AS away_team_short, a.name AS away_team_name, a.primary_color AS away_team_color,
           w.short_name AS winner_short,
           (SELECT COUNT(*) FROM match_innings mi WHERE mi.match_id = m.id) AS innings_count
    FROM matches m
    JOIN franchises h ON h.id = m.home_team_id
    JOIN franchises a ON a.id = m.away_team_id
    LEFT JOIN franchises w ON w.id = m.winner_team_id
    WHERE m.tournament_id = ? AND m.status IN ${PLAYED_STATUSES}
    ORDER BY m.match_number DESC
  `).all(tournamentId);
}

/** The stored record of a match: both innings, in full. */
export function getMatchScorecard(matchId: string) {
  const match = db.prepare(`
    SELECT m.*,
           h.name AS home_team_name, h.short_name AS home_team_short, h.primary_color AS home_team_color,
           a.name AS away_team_name, a.short_name AS away_team_short, a.primary_color AS away_team_color,
           w.name AS winner_name
    FROM matches m
    JOIN franchises h ON h.id = m.home_team_id
    JOIN franchises a ON a.id = m.away_team_id
    LEFT JOIN franchises w ON w.id = m.winner_team_id
    WHERE m.id = ?
  `).get(matchId) as any;

  if (!match) throw new Error('Match not found');

  const inningsRows = db.prepare(`
    SELECT mi.*, bt.name AS batting_team_name, bt.short_name AS batting_team_short, bt.primary_color AS batting_team_color,
           bw.name AS bowling_team_name, bw.short_name AS bowling_team_short
    FROM match_innings mi
    JOIN franchises bt ON bt.id = mi.batting_team_id
    JOIN franchises bw ON bw.id = mi.bowling_team_id
    WHERE mi.match_id = ?
    ORDER BY mi.innings_number ASC
  `).all(matchId) as any[];

  const innings = inningsRows.map(row => {
    const batting = (db.prepare(`
      SELECT mb.*, p.name, p.photo_url, b.name AS dismissal_bowler_name
      FROM match_batting mb
      JOIN players p ON p.id = mb.player_id
      LEFT JOIN players b ON b.id = mb.dismissal_bowler_id
      WHERE mb.match_id = ? AND mb.innings_number = ?
      ORDER BY mb.batting_position ASC
    `).all(matchId, row.innings_number) as any[]).map(r => ({
      ...r,
      strike_rate: r.balls > 0 ? round2((r.runs / r.balls) * 100) : 0
    }));

    const bowling = (db.prepare(`
      SELECT mbw.*, p.name, p.photo_url
      FROM match_bowling mbw
      JOIN players p ON p.id = mbw.player_id
      WHERE mbw.match_id = ? AND mbw.innings_number = ? AND mbw.balls > 0
      ORDER BY mbw.wickets DESC, mbw.runs ASC
    `).all(matchId, row.innings_number) as any[]).map(r => ({
      ...r,
      overs: formatOvers(r.balls),
      economy: r.balls > 0 ? round2((r.runs / r.balls) * 6) : 0
    }));

    const fall_of_wickets = (db.prepare(`
      SELECT mb.player_id, mb.fow_score, mb.fow_ball, p.name
      FROM match_batting mb
      JOIN players p ON p.id = mb.player_id
      WHERE mb.match_id = ? AND mb.innings_number = ? AND mb.status = 'out'
      ORDER BY mb.fow_ball ASC, mb.fow_score ASC
    `).all(matchId, row.innings_number) as any[]).map((r, i) => ({
      order: i + 1,
      player_id: r.player_id,
      name: r.name,
      score: r.fow_score ?? 0,
      overs: formatOvers(r.fow_ball ?? 0)
    }));

    return {
      innings_number: row.innings_number,
      batting_team: { name: row.batting_team_name, short_name: row.batting_team_short, primary_color: row.batting_team_color },
      bowling_team: { name: row.bowling_team_name, short_name: row.bowling_team_short },
      runs: row.runs,
      wickets: row.wickets,
      balls: row.balls,
      overs: formatOvers(row.balls),
      extras: row.extras,
      target: row.target,
      status: row.status,
      run_rate: row.balls > 0 ? round2((row.runs / row.balls) * 6) : 0,
      batting,
      bowling,
      fall_of_wickets
    };
  });

  return {
    match: {
      id: match.id,
      match_number: match.match_number,
      stage: match.stage,
      venue: match.venue,
      scheduled_time: match.scheduled_time,
      status: match.status,
      overs_limit: match.overs_limit || 20,
      result_summary: match.result_summary,
      winner_name: match.winner_name,
      home_team: { name: match.home_team_name, short_name: match.home_team_short, primary_color: match.home_team_color },
      away_team: { name: match.away_team_name, short_name: match.away_team_short, primary_color: match.away_team_color }
    },
    innings
  };
}
