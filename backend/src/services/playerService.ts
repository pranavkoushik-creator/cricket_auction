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

  sql += ` ORDER BY p.group_name, p.name ASC`;
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
  group_name: string;
  role: string;
  is_foreign: number;
  status?: string;
  base_price: number;
  photo_url?: string;
  document_url?: string;
  stats?: any;
}) {
  const id = `ply-${uuidv4().substring(0, 8)}`;
  const statsStr = data.stats ? JSON.stringify(data.stats) : JSON.stringify({ matches: 0, runs: 0, wickets: 0 });

  db.prepare(`
    INSERT INTO players (id, user_id, tournament_id, name, group_name, role, is_foreign, status, base_price, approval_status, stats_json, photo_url, document_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(
    id,
    data.user_id || null,
    data.tournament_id,
    data.name,
    data.group_name,
    data.role,
    data.is_foreign ? 1 : 0,
    data.status || 'Newcomer',
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
      `).run(lotId, session.id, player.tournament_id, playerId, nextSeq, player.group_name);
    }
  }

  return db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
}

export function createSinglePlayer(data: {
  tournament_id: string;
  name: string;
  group_name: string;
  role: string;
  is_foreign?: number | boolean;
  status?: string;
  base_price: number;
  photo_url?: string;
  approval_status?: 'approved' | 'pending';
}) {
  const id = `ply-${uuidv4().substring(0, 8)}`;
  const status = data.approval_status || 'approved';
  const isForeign = data.is_foreign ? 1 : 0;
  const statusVal = data.status || 'Newcomer';
  const photoUrl = data.photo_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80';
  const statsStr = JSON.stringify({ matches: 0, runs: 0, wickets: 0 });

  db.prepare(`
    INSERT INTO players (id, tournament_id, name, group_name, role, is_foreign, status, base_price, approval_status, stats_json, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.tournament_id, data.name, data.group_name, data.role, isForeign, statusVal, data.base_price, status, statsStr, photoUrl);

  if (status === 'approved') {
    let session = db.prepare('SELECT id FROM auction_sessions WHERE tournament_id = ?').get(data.tournament_id) as any;
    if (!session) {
      const sesId = `ses-${uuidv4().substring(0, 8)}`;
      db.prepare('INSERT INTO auction_sessions (id, tournament_id, status) VALUES (?, ?, "scheduled")').run(sesId, data.tournament_id);
      session = { id: sesId };
    }

    const lastSeq = db.prepare('SELECT MAX(sequence_number) as max_seq FROM auction_lots WHERE tournament_id = ?').get(data.tournament_id) as any;
    const nextSeq = (lastSeq?.max_seq || 0) + 1;
    const lotId = `lot-${uuidv4().substring(0, 8)}`;

    db.prepare(`
      INSERT INTO auction_lots (id, session_id, tournament_id, player_id, sequence_number, set_name, status, current_highest_bid)
      VALUES (?, ?, ?, ?, ?, ?, 'queued', 0)
    `).run(lotId, session.id, data.tournament_id, id, nextSeq, data.group_name);
  }

  return db.prepare('SELECT * FROM players WHERE id = ?').get(id);
}

export function bulkImportPlayers(tournamentId: string, playersList: any[]) {
  if (!Array.isArray(playersList) || playersList.length === 0) {
    throw new Error('No valid players provided for bulk import.');
  }

  let session = db.prepare('SELECT id FROM auction_sessions WHERE tournament_id = ?').get(tournamentId) as any;
  if (!session) {
    const sesId = `ses-${uuidv4().substring(0, 8)}`;
    db.prepare('INSERT INTO auction_sessions (id, tournament_id, status) VALUES (?, ?, "scheduled")').run(sesId, tournamentId);
    session = { id: sesId };
  }

  const lastSeqRecord = db.prepare('SELECT MAX(sequence_number) as max_seq FROM auction_lots WHERE tournament_id = ?').get(tournamentId) as any;
  let nextSeq = (lastSeqRecord?.max_seq || 0) + 1;

  const insertPlayerStmt = db.prepare(`
    INSERT INTO players (id, tournament_id, name, group_name, role, is_foreign, status, base_price, approval_status, stats_json, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)
  `);

  const insertLotStmt = db.prepare(`
    INSERT INTO auction_lots (id, session_id, tournament_id, player_id, sequence_number, set_name, status, current_highest_bid)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', 0)
  `);

  const createdPlayers: any[] = [];

  const runBulk = db.transaction(() => {
    for (const p of playersList) {
      const pid = `ply-${uuidv4().substring(0, 8)}`;
      const isForeign = p.is_foreign ? 1 : 0;
      const statusVal = p.status || 'Newcomer';
      const photoUrl = p.photo_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80';
      const statsStr = JSON.stringify({ matches: 0, runs: 0, wickets: 0 });
      const basePrice = Number(p.base_price) || 20000000;
      const role = p.role || 'Batsman';
      const groupName = p.group_name || 'GROUP A';

      insertPlayerStmt.run(pid, tournamentId, p.name, groupName, role, isForeign, statusVal, basePrice, statsStr, photoUrl);

      const lotId = `lot-${uuidv4().substring(0, 8)}`;
      insertLotStmt.run(lotId, session.id, tournamentId, pid, nextSeq, groupName);
      nextSeq++;

      createdPlayers.push({ id: pid, name: p.name, role, group_name: groupName, base_price: basePrice });
    }
  });

  runBulk();

  return {
    importedCount: createdPlayers.length,
    players: createdPlayers
  };
}

