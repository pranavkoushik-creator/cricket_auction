import { db } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export function getPlayers(tournamentId: string, statusFilter?: string) {
  let sql = `
    SELECT p.*, al.id as lot_id, al.status as lot_status, al.buyer_id, al.sold_price, f.name as buyer_name, f.short_name as buyer_short
    FROM players p
    LEFT JOIN auction_lots al ON al.player_id = p.id
    LEFT JOIN franchises f ON al.buyer_id = f.id
    WHERE p.tournament_id = ?
  `;
  const params: any[] = [tournamentId];

  if (statusFilter && statusFilter !== 'all') {
    sql += ` AND p.approval_status = ?`;
    params.push(statusFilter);
  }

  sql += ` ORDER BY p.category, p.name ASC`;
  const players = db.prepare(sql).all(...params) as any[];

  for (const p of players) {
    if (p.stats_json && typeof p.stats_json === 'string') {
      try {
        p.stats = JSON.parse(p.stats_json);
      } catch (e) {
        p.stats = {};
      }
    }
  }
  return players;
}

export function registerPlayer(data: {
  tournament_id: string;
  user_id?: string;
  name: string;
  category: string;
  role: string;
  is_foreign: number;
  country?: string;
  base_price: number;
  photo_url?: string;
  document_url?: string;
  stats?: any;
}) {
  const id = `ply-${uuidv4().substring(0, 8)}`;
  const statsStr = data.stats ? JSON.stringify(data.stats) : JSON.stringify({ matches: 0, runs: 0, wickets: 0 });

  db.prepare(`
    INSERT INTO players (id, user_id, tournament_id, name, category, role, is_foreign, country, base_price, approval_status, stats_json, photo_url, document_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(
    id,
    data.user_id || null,
    data.tournament_id,
    data.name,
    data.category,
    data.role,
    data.is_foreign ? 1 : 0,
    data.country || 'India',
    data.base_price,
    statsStr,
    data.photo_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
    data.document_url || null
  );

  return db.prepare('SELECT * FROM players WHERE id = ?').get(id);
}

export function updatePlayerApprovalStatus(playerId: string, status: 'approved' | 'rejected' | 'changes_requested' | 'suspended', reason?: string) {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId) as any;
  if (!player) throw new Error('Player not found');

  db.prepare('UPDATE players SET approval_status = ?, approval_reason = ? WHERE id = ?').run(status, reason || null, playerId);

  // If approved and not in auction lots yet, auto-queue into auction lots
  if (status === 'approved') {
    const existingLot = db.prepare('SELECT id FROM auction_lots WHERE player_id = ?').get(playerId);
    if (!existingLot) {
      let session = db.prepare('SELECT id FROM auction_sessions WHERE tournament_id = ?').get(player.tournament_id) as any;
      if (!session) {
        const sesId = `ses-${uuidv4().substring(0, 8)}`;
        db.prepare('INSERT INTO auction_sessions (id, tournament_id, status) VALUES (?, ?, "scheduled")').run(sesId, player.tournament_id);
        session = { id: sesId };
      }

      const lastSeq = db.prepare('SELECT MAX(sequence_number) as max_seq FROM auction_lots WHERE tournament_id = ?').get(player.tournament_id) as any;
      const nextSeq = (lastSeq?.max_seq || 0) + 1;
      const lotId = `lot-${uuidv4().substring(0, 8)}`;

      db.prepare(`
        INSERT INTO auction_lots (id, session_id, tournament_id, player_id, sequence_number, set_name, status, current_highest_bid)
        VALUES (?, ?, ?, ?, ?, ?, 'queued', 0)
      `).run(lotId, session.id, player.tournament_id, playerId, nextSeq, `Set ${Math.floor(nextSeq / 5) + 1} - ${player.category}`);
    }
  }

  return db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
}
