import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export function getTournaments() {
  const tournaments = db.prepare('SELECT * FROM tournaments ORDER BY created_at DESC').all() as any[];
  for (const t of tournaments) {
    t.rules = db.prepare('SELECT * FROM tournament_rules WHERE tournament_id = ?').get(t.id);
    if (t.rules) {
      if (typeof t.rules.base_price_tiers === 'string') t.rules.base_price_tiers = JSON.parse(t.rules.base_price_tiers);
      if (typeof t.rules.increment_ladder === 'string') t.rules.increment_ladder = JSON.parse(t.rules.increment_ladder);
    }
  }
  return tournaments;
}

export function getTournamentById(id: string) {
  const t = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(id) as any;
  if (!t) throw new Error('Tournament not found');
  t.rules = db.prepare('SELECT * FROM tournament_rules WHERE tournament_id = ?').get(t.id);
  if (t.rules) {
    if (typeof t.rules.base_price_tiers === 'string') t.rules.base_price_tiers = JSON.parse(t.rules.base_price_tiers);
    if (typeof t.rules.increment_ladder === 'string') t.rules.increment_ladder = JSON.parse(t.rules.increment_ladder);
  }
  return t;
}

export function createTournament(data: { name: string; sport?: string; format?: string; dates?: string; logo_url?: string }) {
  const id = `tour-${uuidv4().substring(0, 8)}`;
  db.prepare(`
    INSERT INTO tournaments (id, name, sport, format, dates, status, logo_url)
    VALUES (?, ?, ?, ?, ?, 'draft', ?)
  `).run(id, data.name, data.sport || 'Cricket', data.format || 'T20', data.dates || '', data.logo_url || null);

  const defaultLadder = JSON.stringify([
    { upto: 10000000, increment: 1000000 },
    { upto: 50000000, increment: 2500000 },
    { upto: 100000000, increment: 5000000 },
    { upto: 9999999999, increment: 10000000 }
  ]);
  const defaultTiers = JSON.stringify([20000000, 15000000, 10000000, 5000000, 2000000]);

  db.prepare(`
    INSERT INTO tournament_rules (id, tournament_id, purse_budget, min_squad, max_squad, foreign_player_limit, rtm_count_per_team, base_price_tiers, increment_ladder)
    VALUES (?, ?, 1000000000, 15, 25, 8, 2, ?, ?)
  `).run(uuidv4(), id, defaultTiers, defaultLadder);

  return getTournamentById(id);
}

export function updateTournamentRules(id: string, rules: any) {
  const t = getTournamentById(id);
  if (t.status === 'completed' || t.status === 'archived') {
    throw new Error('Cannot edit rules on completed or archived tournaments.');
  }

  const basePriceTiersStr = typeof rules.base_price_tiers === 'string' ? rules.base_price_tiers : JSON.stringify(rules.base_price_tiers);
  const incrementLadderStr = typeof rules.increment_ladder === 'string' ? rules.increment_ladder : JSON.stringify(rules.increment_ladder);

  db.prepare(`
    UPDATE tournament_rules
    SET purse_budget = ?, min_squad = ?, max_squad = ?, foreign_player_limit = ?, rtm_count_per_team = ?, base_price_tiers = ?, increment_ladder = ?
    WHERE tournament_id = ?
  `).run(
    rules.purse_budget,
    rules.min_squad,
    rules.max_squad,
    rules.foreign_player_limit,
    rules.rtm_count_per_team,
    basePriceTiersStr,
    incrementLadderStr,
    id
  );

  return getTournamentById(id);
}

export function updateTournamentStatus(id: string, status: string) {
  const t = getTournamentById(id);
  if (t.status === 'completed' && status !== 'archived') {
    throw new Error('Tournament is locked in completed state.');
  }
  db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run(status, id);
  return getTournamentById(id);
}
