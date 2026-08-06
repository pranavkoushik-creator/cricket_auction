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

export function generateFixtures(tournamentId: string) {
  const franchises = db.prepare('SELECT id FROM franchises WHERE tournament_id = ?').all(tournamentId) as { id: string }[];
  if (franchises.length < 2) {
    throw new Error('At least 2 franchises are required to generate fixtures.');
  }

  // Clear existing upcoming matches
  db.prepare("DELETE FROM matches WHERE tournament_id = ? AND status = 'upcoming'").run(tournamentId);

  let matchNum = 1;
  const venues = ['Wankhede Stadium, Mumbai', 'MA Chidambaram Stadium, Chennai', 'M. Chinnaswamy Stadium, Bengaluru', 'Arun Jaitley Stadium, Delhi'];

  // Single round robin generator
  for (let i = 0; i < franchises.length; i++) {
    for (let j = i + 1; j < franchises.length; j++) {
      const home = franchises[i].id;
      const away = franchises[j].id;
      const mId = `match-${uuidv4().substring(0, 8)}`;
      const venue = venues[(matchNum - 1) % venues.length];
      const matchDate = new Date(Date.now() + matchNum * 86400000 * 2).toISOString().replace('T', ' ').substring(0, 19);

      db.prepare(`
        INSERT INTO matches (id, tournament_id, match_number, stage, home_team_id, away_team_id, venue, scheduled_time, status)
        VALUES (?, ?, ?, 'Group Stage', ?, ?, ?, ?, 'upcoming')
      `).run(mId, tournamentId, matchNum++, home, away, venue, matchDate);
    }
  }

  return getMatches(tournamentId);
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

export function recalculateStandingsPositions(tournamentId: string) {
  const standings = db.prepare(`
    SELECT * FROM points_table WHERE tournament_id = ? ORDER BY points DESC, nrr DESC
  `).all(tournamentId) as any[];

  for (let i = 0; i < standings.length; i++) {
    db.prepare('UPDATE points_table SET position = ? WHERE id = ?').run(i + 1, standings[i].id);
  }
}

export function getStandings(tournamentId: string) {
  return db.prepare(`
    SELECT pt.*, f.name as franchise_name, f.short_name as franchise_short, f.logo_url as franchise_logo, f.primary_color
    FROM points_table pt
    JOIN franchises f ON pt.franchise_id = f.id
    WHERE pt.tournament_id = ?
    ORDER BY pt.position ASC
  `).all(tournamentId);
}
