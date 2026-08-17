import { db } from '../db/database';
import { recordPurseTransaction, getFranchisePurse } from './purseLedgerService';
import { v4 as uuidv4 } from 'uuid';

export function getFranchises(tournamentId: string) {
  const franchises = db.prepare(`
    SELECT f.*, u.name as owner_name, u.email as owner_email
    FROM franchises f
    LEFT JOIN users u ON f.owner_id = u.id
    WHERE f.tournament_id = ?
    ORDER BY f.name ASC
  `).all(tournamentId) as any[];

  for (const f of franchises) {
    // Get squad count and bought players
    const squad = db.prepare(`
      SELECT al.*, p.name, p.group_name, p.role, p.is_foreign, p.status, p.photo_url
      FROM auction_lots al
      JOIN players p ON al.player_id = p.id
      WHERE al.buyer_id = ? AND al.status = 'sold'
    `).all(f.id) as any[];

    f.squad = squad;
    f.total_players = squad.length;
    f.foreign_players = squad.filter(p => p.is_foreign === 1).length;
    f.total_spent = f.initial_purse - f.remaining_purse;
  }

  return franchises;
}

export function getFranchiseById(id: string) {
  const f = db.prepare(`
    SELECT f.*, u.name as owner_name, u.email as owner_email
    FROM franchises f
    LEFT JOIN users u ON f.owner_id = u.id
    WHERE f.id = ?
  `).get(id) as any;

  if (!f) throw new Error('Franchise not found');

  const squad = db.prepare(`
    SELECT al.*, p.name, p.group_name, p.role, p.is_foreign, p.status, p.photo_url, p.base_price
    FROM auction_lots al
    JOIN players p ON al.player_id = p.id
    WHERE al.buyer_id = ? AND al.status = 'sold'
  `).all(f.id) as any[];

  const purseData = getFranchisePurse(id);

  f.squad = squad;
  f.total_players = squad.length;
  f.foreign_players = squad.filter(p => p.is_foreign === 1).length;
  f.total_spent = f.initial_purse - purseData.remainingPurse;
  f.remaining_purse = purseData.remainingPurse;
  f.ledger = purseData.ledger;

  return f;
}

export function createFranchise(data: {
  tournament_id: string;
  name: string;
  short_name: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  owner_id?: string;
  initial_purse?: number;
}) {
  const rules = db.prepare('SELECT purse_budget FROM tournament_rules WHERE tournament_id = ?').get(data.tournament_id) as any;
  const purse = data.initial_purse || rules?.purse_budget || 10000;
  const id = `fran-${uuidv4().substring(0, 8)}`;

  db.prepare(`
    INSERT INTO franchises (id, tournament_id, name, short_name, logo_url, primary_color, secondary_color, owner_id, initial_purse, remaining_purse)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.tournament_id,
    data.name,
    data.short_name,
    data.logo_url || 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=150&auto=format&fit=crop&q=80',
    data.primary_color || '#3b82f6',
    data.secondary_color || '#1e40af',
    data.owner_id || null,
    purse,
    purse
  );

  // Log initial credit transaction in ledger
  recordPurseTransaction(id, purse, 'initial_credit', undefined, 'Initial Franchise Purse Allocation');

  // Insert empty Points Table record
  db.prepare(`
    INSERT OR IGNORE INTO points_table (id, tournament_id, franchise_id, played, won, lost, tied, no_result, points, nrr, position)
    VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0.000, 1)
  `).run(uuidv4(), data.tournament_id, id);

  return getFranchiseById(id);
}

export function updateFranchise(
  id: string,
  data: {
    name?: string;
    short_name?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    owner_id?: string;
    initial_purse?: number;
    remaining_purse?: number;
  }
) {
  const existing = db.prepare('SELECT * FROM franchises WHERE id = ?').get(id) as any;
  if (!existing) throw new Error('Franchise not found');

  const name = data.name !== undefined ? data.name : existing.name;
  const short_name = data.short_name !== undefined ? data.short_name : existing.short_name;
  const logo_url = data.logo_url !== undefined ? data.logo_url : existing.logo_url;
  const primary_color = data.primary_color !== undefined ? data.primary_color : existing.primary_color;
  const secondary_color = data.secondary_color !== undefined ? data.secondary_color : existing.secondary_color;
  const owner_id = data.owner_id !== undefined ? (data.owner_id || null) : existing.owner_id;
  const initial_purse = data.initial_purse !== undefined ? data.initial_purse : existing.initial_purse;
  let remaining_purse = data.remaining_purse !== undefined ? data.remaining_purse : existing.remaining_purse;

  // If initial_purse was adjusted, update remaining_purse proportionally if not explicitly specified
  if (data.initial_purse !== undefined && data.remaining_purse === undefined) {
    const diff = data.initial_purse - existing.initial_purse;
    remaining_purse = Math.max(0, existing.remaining_purse + diff);
  }

  db.prepare(`
    UPDATE franchises
    SET name = ?, short_name = ?, logo_url = ?, primary_color = ?, secondary_color = ?, owner_id = ?, initial_purse = ?, remaining_purse = ?
    WHERE id = ?
  `).run(name, short_name, logo_url, primary_color, secondary_color, owner_id, initial_purse, remaining_purse, id);

  return getFranchiseById(id);
}

export function deleteFranchise(id: string) {
  const existing = db.prepare('SELECT * FROM franchises WHERE id = ?').get(id) as any;
  if (!existing) throw new Error('Franchise not found');

  db.transaction(() => {
    // Reset auction lots bought by or currently bid on by this franchise
    db.prepare("UPDATE auction_lots SET buyer_id = NULL, status = 'queued', sold_price = NULL WHERE buyer_id = ?").run(id);
    db.prepare("UPDATE auction_lots SET current_bidder_id = NULL, current_highest_bid = 0 WHERE current_bidder_id = ?").run(id);

    // Delete associated records
    db.prepare("DELETE FROM bids WHERE franchise_id = ?").run(id);
    db.prepare("DELETE FROM group_teams WHERE franchise_id = ?").run(id);
    db.prepare("DELETE FROM purse_ledger WHERE franchise_id = ?").run(id);
    db.prepare("DELETE FROM points_table WHERE franchise_id = ?").run(id);
    db.prepare("DELETE FROM matches WHERE home_team_id = ? OR away_team_id = ?").run(id, id);

    // Delete franchise
    db.prepare("DELETE FROM franchises WHERE id = ?").run(id);
  })();

  return { success: true, message: `Franchise ${existing.name} deleted successfully.` };
}

export function toggleFranchiseBidding(id: string) {
  const f = db.prepare('SELECT is_bidding_enabled FROM franchises WHERE id = ?').get(id) as any;
  if (!f) throw new Error('Franchise not found');
  const newVal = f.is_bidding_enabled === 1 ? 0 : 1;
  db.prepare('UPDATE franchises SET is_bidding_enabled = ? WHERE id = ?').run(newVal, id);
  return getFranchiseById(id);
}

export function toggleAllFranchisesBidding(tournamentId: string, enabled: boolean) {
  const val = enabled ? 1 : 0;
  db.prepare('UPDATE franchises SET is_bidding_enabled = ? WHERE tournament_id = ?').run(val, tournamentId);
  return getFranchises(tournamentId);
}

