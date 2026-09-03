import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export function getMatches(tournamentId: string) {
  const matches = db.prepare(`
    SELECT m.*, 
           h.name as home_team_name, h.short_name as home_team_short, h.logo_url as home_team_logo, h.primary_color as home_team_color,
           a.name as away_team_name, a.short_name as away_team_short, a.logo_url as away_team_logo, a.primary_color as away_team_color,
           w.name as winner_team_name, w.short_name as winner_team_short
    FROM matches m
    JOIN franchises h ON m.home_team_id = h.id
    JOIN franchises a ON m.away_team_id = a.id
    LEFT JOIN franchises w ON m.winner_team_id = w.id
    WHERE m.tournament_id = ?
    ORDER BY m.match_number ASC
  `).all(tournamentId) as any[];

  return matches;
}

export function getMatchById(id: string) {
  const match = db.prepare(`
    SELECT m.*, 
           h.name as home_team_name, h.short_name as home_team_short, h.logo_url as home_team_logo, h.primary_color as home_team_color,
           a.name as away_team_name, a.short_name as away_team_short, a.logo_url as away_team_logo, a.primary_color as away_team_color,
           w.name as winner_team_name, w.short_name as winner_team_short
    FROM matches m
    JOIN franchises h ON m.home_team_id = h.id
    JOIN franchises a ON m.away_team_id = a.id
    LEFT JOIN franchises w ON m.winner_team_id = w.id
    WHERE m.id = ?
  `).get(id) as any;

  if (!match) throw new Error('Match not found');

  const events = db.prepare(`
    SELECT * FROM match_events WHERE match_id = ? ORDER BY event_number ASC
  `).all(id) as any[];

  for (const e of events) {
    if (typeof e.payload_json === 'string') {
      try {
        e.payload = JSON.parse(e.payload_json);
      } catch (err) {
        e.payload = {};
      }
    }
  }

  match.events = events;
  return match;
}

export const DEFAULT_VENUES = [
  'Wankhede Stadium, Mumbai',
  'MA Chidambaram Stadium, Chennai',
  'M. Chinnaswamy Stadium, Bengaluru',
  'Arun Jaitley Stadium, Delhi'
];

export interface FixtureOptions {
  /** 1 = single round robin, 2 = home and away (each pair meets twice). */
  rounds?: number;
  /**
   * replace_upcoming keeps played matches and appends around them.
   * replace_all wipes every fixture and zeroes the standings.
   */
  mode?: 'replace_upcoming' | 'replace_all';
  /** ISO date the first fixture is scheduled for. Defaults to today. */
  startDate?: string;
  intervalDays?: number;
  venues?: string[];
  stage?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function insertFixture(
  tournamentId: string,
  matchNumber: number,
  stage: string,
  homeId: string,
  awayId: string,
  venue: string,
  scheduledTime: string
) {
  const id = `match-${uuidv4().substring(0, 8)}`;
  db.prepare(`
    INSERT INTO matches (id, tournament_id, match_number, stage, home_team_id, away_team_id, venue, scheduled_time, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'upcoming')
  `).run(id, tournamentId, matchNumber, stage, homeId, awayId, venue, scheduledTime);
  return id;
}

const toSqlDate = (d: Date) => d.toISOString().replace('T', ' ').substring(0, 19);

/**
 * Builds a round-robin schedule.
 *
 * Match numbers continue from the highest number that survives the run rather
 * than restarting at 1, otherwise regenerating around played matches produces
 * duplicate numbers (two "#2", two "#3" and so on).
 */
export function generateFixtures(tournamentId: string, opts: FixtureOptions = {}) {
  const franchises = db.prepare(
    'SELECT id, name FROM franchises WHERE tournament_id = ? ORDER BY name ASC'
  ).all(tournamentId) as { id: string; name: string }[];

  if (franchises.length < 2) {
    throw new Error('At least 2 franchises are required to generate fixtures.');
  }

  const rounds = clamp(Math.floor(Number(opts.rounds ?? 1)) || 1, 1, 4);
  const mode = opts.mode === 'replace_all' ? 'replace_all' : 'replace_upcoming';
  const intervalDays = clamp(Number(opts.intervalDays ?? 2), 0, 30);
  const stage = (opts.stage || 'Group Stage').trim() || 'Group Stage';
  const venues = opts.venues?.length ? opts.venues : DEFAULT_VENUES;

  const start = opts.startDate ? new Date(opts.startDate) : new Date();
  if (Number.isNaN(start.getTime())) throw new Error('The start date is not a valid date.');

  // Single round robin generator using Circle Method to prevent consecutive matches
  const teams = [...franchises];
  if (teams.length % 2 !== 0) {
    teams.push({ id: 'BYE' } as any);
  }

  const matchPairs = [];

  const n = teams.length;
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      if (home.id !== 'BYE' && away.id !== 'BYE') {
        if (i === 0 && round % 2 !== 0) {
          matchPairs.push({ home: away.id, away: home.id });
        } else {
          matchPairs.push({ home: home.id, away: away.id });
        }
      }
    }
    // Rotate teams: keep first fixed, shift others right
    const last = teams.pop();
    if (last) {
      teams.splice(1, 0, last);
    }
  }

  if (mode === 'replace_all') {
    const all = db.prepare('SELECT id FROM matches WHERE tournament_id = ?').all(tournamentId) as { id: string }[];
    for (const m of all) purgeMatchData(m.id);
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(tournamentId);

    db.prepare(`
      UPDATE points_table
      SET played = 0, won = 0, lost = 0, tied = 0, no_result = 0, points = 0, nrr = 0,
          runs_scored = 0, overs_faced = 0, runs_conceded = 0, overs_bowled = 0
      WHERE tournament_id = ?
    `).run(tournamentId);
  } else {
    const stale = db.prepare(
      "SELECT id FROM matches WHERE tournament_id = ? AND status = 'upcoming'"
    ).all(tournamentId) as { id: string }[];
    for (const m of stale) purgeMatchData(m.id);
    db.prepare("DELETE FROM matches WHERE tournament_id = ? AND status = 'upcoming'").run(tournamentId);
  }

  const highest = db.prepare(
    'SELECT MAX(match_number) AS n FROM matches WHERE tournament_id = ?'
  ).get(tournamentId) as any;

  let matchNum = (highest?.n || 0) + 1;

  for (let i = 0; i < matchPairs.length; i++) {
    const home = matchPairs[i].home;
    const away = matchPairs[i].away;
    const mId = `match-${uuidv4().substring(0, 8)}`;
    const venue = venues[(matchNum - 1) % venues.length];
    const matchDate = new Date(Date.now() + matchNum * 86400000 * 2).toISOString().replace('T', ' ').substring(0, 19);

    db.prepare(`
      INSERT INTO matches (id, tournament_id, match_number, stage, home_team_id, away_team_id, venue, scheduled_time, status)
      VALUES (?, ?, ?, 'Group Stage', ?, ?, ?, ?, 'upcoming')
    `).run(mId, tournamentId, matchNum++, home, away, venue, matchDate);
  }

  //   const run = db.transaction(() => {
  //     if (mode === 'replace_all') {
  //       const all = db.prepare('SELECT id FROM matches WHERE tournament_id = ?').all(tournamentId) as { id: string }[];
  //       for (const m of all) purgeMatchData(m.id);
  //       db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(tournamentId);

  //       // No matches left, so every standings row must read zero.
  //       db.prepare(`
  //         UPDATE points_table
  //         SET played = 0, won = 0, lost = 0, tied = 0, no_result = 0, points = 0, nrr = 0,
  //             runs_scored = 0, overs_faced = 0, runs_conceded = 0, overs_bowled = 0
  //         WHERE tournament_id = ?
  //       `).run(tournamentId);
  //     } else {
  //       const stale = db.prepare(
  //         "SELECT id FROM matches WHERE tournament_id = ? AND status = 'upcoming'"
  //       ).all(tournamentId) as { id: string }[];
  //       // An 'upcoming' match can still own rows if it was reset, so purge first.
  //       for (const m of stale) purgeMatchData(m.id);
  //       db.prepare("DELETE FROM matches WHERE tournament_id = ? AND status = 'upcoming'").run(tournamentId);
  //     }

  //     const highest = db.prepare(
  //       'SELECT MAX(match_number) AS n FROM matches WHERE tournament_id = ?'
  //     ).get(tournamentId) as any;

  //     let matchNumber = (highest?.n || 0) + 1;
  //     let created = 0;

  //     for (let round = 1; round <= rounds; round++) {
  //       for (let i = 0; i < franchises.length; i++) {
  //         for (let j = i + 1; j < franchises.length; j++) {
  //           // Even rounds reverse the tie so each side hosts once.
  //           const [home, away] = round % 2 === 1
  //             ? [franchises[i], franchises[j]]
  //             : [franchises[j], franchises[i]];

  //           const date = new Date(start.getTime() + created * intervalDays * 86400000);
  //           insertFixture(
  //             tournamentId,
  //             matchNumber++,
  //             rounds > 1 ? `${stage} — Round ${round}` : stage,
  //             home.id,
  //             away.id,
  //             venues[created % venues.length],
  //             toSqlDate(date)
  //           );
  //           created += 1;
  //         }
  //       }
  //     }

  //     return created;
  //   });

  //   const created = run();
  //   return { created, matches: getMatches(tournamentId) };
  // }

  // /** Adds a single fixture by hand, for a rematch or a knockout tie. */
  // export function addManualFixture(
  //   tournamentId: string,
  //   data: { homeTeamId: string; awayTeamId: string; venue?: string; scheduledTime?: string; stage?: string }
  // ) {
  //   const { homeTeamId, awayTeamId } = data;

  //   if (!homeTeamId || !awayTeamId) throw new Error('Both teams are required.');
  //   if (homeTeamId === awayTeamId) throw new Error('A team cannot play itself.');

  //   const valid = db.prepare(
  //     'SELECT id FROM franchises WHERE tournament_id = ? AND id IN (?, ?)'
  //   ).all(tournamentId, homeTeamId, awayTeamId) as any[];
  //   if (valid.length !== 2) throw new Error('Both teams must belong to this tournament.');

  //   const highest = db.prepare(
  //     'SELECT MAX(match_number) AS n FROM matches WHERE tournament_id = ?'
  //   ).get(tournamentId) as any;

  //   insertFixture(
  //     tournamentId,
  //     (highest?.n || 0) + 1,
  //     (data.stage || 'Group Stage').trim() || 'Group Stage',
  //     homeTeamId,
  //     awayTeamId,
  //     data.venue?.trim() || DEFAULT_VENUES[0],
  //     data.scheduledTime || toSqlDate(new Date())
  //   );

  return { created: matchPairs.length, matches: getMatches(tournamentId) };
}

/** Removes one fixture, reversing its standings contribution if it was played. */
export function deleteFixture(matchId: string) {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as any;
  if (!match) throw new Error('Match not found.');

  const run = db.transaction(() => {
    revertMatchFromStandings(matchId);
    purgeMatchData(matchId);
    db.prepare('DELETE FROM matches WHERE id = ?').run(matchId);
  });

  run();
  return getMatches(match.tournament_id);
}

export function addMatchEvent(matchId: string, innings: number, eventType: string, payload: any) {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as any;
  if (!match) throw new Error('Match not found');

  const maxEv = db.prepare('SELECT MAX(event_number) as max_ev FROM match_events WHERE match_id = ?').get(matchId) as any;
  const eventNum = (maxEv?.max_ev || 0) + 1;
  const id = `ev-${uuidv4().substring(0, 8)}`;

  db.prepare(`
    INSERT INTO match_events (id, match_id, innings, event_number, event_type, payload_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, matchId, innings, eventNum, eventType, JSON.stringify(payload));

  // If match status was upcoming, set to live
  if (match.status === 'upcoming') {
    db.prepare("UPDATE matches SET status = 'live' WHERE id = ?").run(matchId);
  }

  return getMatchById(matchId);
}

export function completeMatch(matchId: string, winnerTeamId: string, resultSummary: string, homeScore: { runs: number; overs: number }, awayScore: { runs: number; overs: number }) {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as any;
  if (!match) throw new Error('Match not found');

  db.prepare(`
    UPDATE matches
    SET status = 'completed', winner_team_id = ?, result_summary = ?
    WHERE id = ?
  `).run(winnerTeamId, resultSummary, matchId);

  // Recalculate Points Table & NRR for home and away franchises
  updateTeamPointsTable(match.tournament_id, match.home_team_id, winnerTeamId === match.home_team_id, homeScore.runs, homeScore.overs, awayScore.runs, awayScore.overs);
  updateTeamPointsTable(match.tournament_id, match.away_team_id, winnerTeamId === match.away_team_id, awayScore.runs, awayScore.overs, homeScore.runs, homeScore.overs);

  // Recalculate positions
  recalculateStandingsPositions(match.tournament_id);

  return getMatchById(matchId);
}

function updateTeamPointsTable(tournamentId: string, franchiseId: string, isWinner: boolean, runsFor: number, oversFor: number, runsAgainst: number, oversAgainst: number) {
  let row = db.prepare('SELECT * FROM points_table WHERE tournament_id = ? AND franchise_id = ?').get(tournamentId, franchiseId) as any;
  if (!row) {
    const id = uuidv4();
    db.prepare('INSERT INTO points_table (id, tournament_id, franchise_id) VALUES (?, ?, ?)').run(id, tournamentId, franchiseId);
    row = db.prepare('SELECT * FROM points_table WHERE id = ?').get(id);
  }

  const played = row.played + 1;
  const won = row.won + (isWinner ? 1 : 0);
  const lost = row.lost + (isWinner ? 0 : 1);
  const points = won * 2; // 2 points per win

  const totalRunsScored = row.runs_scored + runsFor;
  const totalOversFaced = row.overs_faced + oversFor;
  const totalRunsConceded = row.runs_conceded + runsAgainst;
  const totalOversBowled = row.overs_bowled + oversAgainst;

  const forRate = totalOversFaced > 0 ? totalRunsScored / totalOversFaced : 0;
  const againstRate = totalOversBowled > 0 ? totalRunsConceded / totalOversBowled : 0;
  const nrr = Number((forRate - againstRate).toFixed(3));

  db.prepare(`
    UPDATE points_table
    SET played = ?, won = ?, lost = ?, points = ?, nrr = ?, runs_scored = ?, overs_faced = ?, runs_conceded = ?, overs_bowled = ?
    WHERE tournament_id = ? AND franchise_id = ?
  `).run(played, won, lost, points, nrr, totalRunsScored, totalOversFaced, totalRunsConceded, totalOversBowled, tournamentId, franchiseId);
}

/**
 * Subtracts one match's contribution from a franchise's standings row.
 *
 * points_table is a running accumulator, so undoing a result means reversing
 * exactly the arithmetic updateTeamPointsTable() applied. Callers must pass the
 * same figures the result was recorded with.
 */
export function revertTeamPointsTable(
  tournamentId: string,
  franchiseId: string,
  wasWinner: boolean,
  runsFor: number,
  oversFor: number,
  runsAgainst: number,
  oversAgainst: number
) {
  const row = db.prepare(
    'SELECT * FROM points_table WHERE tournament_id = ? AND franchise_id = ?'
  ).get(tournamentId, franchiseId) as any;

  if (!row) return;

  // Clamped at zero so a double revert can never drive the table negative.
  const played = Math.max(0, row.played - 1);
  const won = Math.max(0, row.won - (wasWinner ? 1 : 0));
  const lost = Math.max(0, row.lost - (wasWinner ? 0 : 1));
  const points = won * 2;

  const runsScored = Math.max(0, row.runs_scored - runsFor);
  const oversFaced = Math.max(0, row.overs_faced - oversFor);
  const runsConceded = Math.max(0, row.runs_conceded - runsAgainst);
  const oversBowled = Math.max(0, row.overs_bowled - oversAgainst);

  const forRate = oversFaced > 0 ? runsScored / oversFaced : 0;
  const againstRate = oversBowled > 0 ? runsConceded / oversBowled : 0;
  const nrr = Number((forRate - againstRate).toFixed(3));

  db.prepare(`
    UPDATE points_table
    SET played = ?, won = ?, lost = ?, points = ?, nrr = ?, runs_scored = ?, overs_faced = ?, runs_conceded = ?, overs_bowled = ?
    WHERE tournament_id = ? AND franchise_id = ?
  `).run(played, won, lost, points, nrr, runsScored, oversFaced, runsConceded, oversBowled, tournamentId, franchiseId);
}

/**
 * Removes one completed match's contribution from the standings.
 *
 * Shared by the scorer's match reset and by fixture deletion, so both undo a
 * result the same way. Returns false when there is nothing to revert -- an
 * unplayed match, or one completed through the legacy console, which left no
 * match_innings rows to reconstruct the figures from.
 */
export function revertMatchFromStandings(matchId: string): boolean {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId) as any;
  if (!match || match.status !== 'completed' || !match.winner_team_id) return false;

  const innings = db.prepare(
    'SELECT * FROM match_innings WHERE match_id = ? ORDER BY innings_number ASC'
  ).all(matchId) as any[];
  if (innings.length < 2) return false;

  const oversLimit: number = match.overs_limit || 20;
  // Same convention the result was recorded with: a side bowled out is charged
  // the full quota of overs.
  const chargedOvers = (row: any) => (row.wickets >= 10 ? oversLimit : row.balls / 6);

  const [first, second] = innings;
  const homeIsFirst = first.batting_team_id === match.home_team_id;
  const homeInnings = homeIsFirst ? first : second;
  const awayInnings = homeIsFirst ? second : first;

  revertTeamPointsTable(
    match.tournament_id, match.home_team_id,
    match.winner_team_id === match.home_team_id,
    homeInnings.runs, chargedOvers(homeInnings), awayInnings.runs, chargedOvers(awayInnings)
  );
  revertTeamPointsTable(
    match.tournament_id, match.away_team_id,
    match.winner_team_id === match.away_team_id,
    awayInnings.runs, chargedOvers(awayInnings), homeInnings.runs, chargedOvers(homeInnings)
  );
  recalculateStandingsPositions(match.tournament_id);
  return true;
}

/** Deletes every row derived from a match, leaving the fixture row itself. */
export function purgeMatchData(matchId: string) {
  db.prepare('DELETE FROM match_events WHERE match_id = ?').run(matchId);
  db.prepare('DELETE FROM match_batting WHERE match_id = ?').run(matchId);
  db.prepare('DELETE FROM match_bowling WHERE match_id = ?').run(matchId);
  db.prepare('DELETE FROM match_innings WHERE match_id = ?').run(matchId);
  db.prepare('DELETE FROM match_live_state WHERE match_id = ?').run(matchId);
}

export function recalculateStandingsPositions(tournamentId: string) {
  const standings = db.prepare(`
    SELECT * FROM points_table WHERE tournament_id = ? ORDER BY points DESC, nrr DESC
  `).all(tournamentId) as any[];

  for (let i = 0; i < standings.length; i++) {
    db.prepare('UPDATE points_table SET position = ? WHERE id = ?').run(i + 1, standings[i].id);
  }
}

export function getStandings(tournamentId: string) {
  // Lazily ensure all franchises have a points table row
  const franchises = db.prepare('SELECT id FROM franchises WHERE tournament_id = ?').all(tournamentId) as { id: string }[];
  for (const f of franchises) {
    const existing = db.prepare('SELECT id FROM points_table WHERE tournament_id = ? AND franchise_id = ?').get(tournamentId, f.id);
    if (!existing) {
      db.prepare(`
        INSERT INTO points_table (id, tournament_id, franchise_id, played, won, lost, tied, no_result, points, nrr, runs_scored, overs_faced, runs_conceded, overs_bowled, position)
        VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
      `).run(uuidv4(), tournamentId, f.id);
    }
  }

  return db.prepare(`
    SELECT pt.*, f.name as franchise_name, f.short_name as franchise_short, f.logo_url as franchise_logo, f.primary_color
    FROM points_table pt
    JOIN franchises f ON pt.franchise_id = f.id
    WHERE pt.tournament_id = ?
    ORDER BY pt.points DESC, pt.nrr DESC, pt.position ASC
  `).all(tournamentId);
}
