import { db, initDatabase } from './database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export function seedData() {
  initDatabase();

  // Group A players' photo URLs mapping (Zoho People/Contacts and local images)
  const groupAPhotos: Record<string, string> = {
    'Ajey Simha': '/images/ajey.jpg',
    'Punith N': '/images/punith.jpg',
    'Dushyanth S J': '/images/dushyanth.jpg',
    'HEMANTH R': '/images/hemanth.jpg',
    'Manoj M R': '/images/manoj_m_r.jpg',
    'Rishav D Raj': '/images/rishav.jpg',
    'Santhosh M': '/images/santhosh.jpg',
    'SAYAM D jAIN': '/images/sayam.jpg',
    'Srivathsa E R': '/images/srivathsa.jpg',
    'Suhas Gowda': '/images/suhas.jpg',
    'Sujan Shetty': '/images/sujan.jpg',
    'Surya H R': '/images/surya.jpg'
  };

  // Restore Zoho photo URLs for Group A players in the database if they were previously migrated to Unsplash
  try {
    for (const [name, zohoUrl] of Object.entries(groupAPhotos)) {
      db.prepare("UPDATE players SET photo_url = ? WHERE name = ? AND photo_url LIKE '%unsplash.com%'").run(zohoUrl, name);
    }
  } catch (err) {
    console.error('[Seeder] Error restoring Zoho URLs:', err);
  }

  const passwordHash = bcrypt.hashSync('password123', 10);
  const tId = 'tour-ipl-2026';

  // Check if tournament already exists to avoid wiping user data on every startup
  const tournamentExists = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(tId);
  if (tournamentExists) {
    console.log('[Seeder] Tournament already initialized. Skipping seed data reset.');
    return;
  }

  // 1. Create Main Tournament Record if not exists
  db.prepare(`
    INSERT INTO tournaments (id, name, sport, format, dates, status)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(
    tId,
    'SAKHA Premier League 2026 Mega Auction',
    'Cricket',
    'T20',
    '2026-08-15 to 2026-10-15',
    'active'
  );

  // 2. Create Core Users
  const users = [
    { id: 'usr-admin', name: 'Pranav Koushik (Super Admin)', email: 'admin@platform.com', role: 'Super Admin' },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, status, avatar_url)
    VALUES (?, ?, ?, ?, 'active', ?)
    ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name
  `);

  const insertRole = db.prepare(`
    INSERT INTO user_roles (id, user_id, tournament_id, role)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, tournament_id, role) DO NOTHING
  `);

  for (const u of users) {
    insertUser.run(u.id, u.name, u.email, passwordHash, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');
    insertRole.run(uuidv4(), u.id, tId, u.role);
  }

  // Clear existing players, lots, bids for fresh seed
  db.prepare('DELETE FROM match_events').run();
  db.prepare('DELETE FROM matches').run();
  db.prepare('DELETE FROM points_table').run();
  db.prepare('DELETE FROM bids').run();
  db.prepare('DELETE FROM auction_lots').run();
  db.prepare('DELETE FROM purse_ledger').run();
  db.prepare('DELETE FROM players').run();
  db.prepare('DELETE FROM franchises').run();

  console.log('Seeding initial IPL Tournament, Roles, Franchises, Players, and Fixtures...');

  // 3. Create Tournament Rules
  const incrementLadder = JSON.stringify([
    { upto: 1000000, increment: 5000 },
    { upto: 5000000, increment: 10000 },
    { upto: 10000000, increment: 25000 },
    { upto: 9999999999, increment: 50000 }
  ]);

  const basePriceTiers = JSON.stringify([100000, 50000, 25000]);

  const customRules = JSON.stringify({
    group_rules: [
      { group_name: "GROUP A", base_price: 100000, min_players: 2, max_players: 2 },
      { group_name: "GROUP B", base_price: 50000, min_players: 2, max_players: 3 },
      { group_name: "GROUP C", base_price: 25000, min_players: 2, max_players: 3 }
    ],
    bid_increments: [5000, 10000, 25000, 50000]
  });

  db.prepare(`
    INSERT INTO tournament_rules (id, tournament_id, purse_budget, min_squad, max_squad, rtm_count_per_team, base_price_tiers, increment_ladder, custom_rules_json)
    VALUES (?, ?, 1000000, 7, 7, 2, ?, ?, ?)
    ON CONFLICT(tournament_id) DO UPDATE SET 
      purse_budget = excluded.purse_budget,
      min_squad = excluded.min_squad,
      max_squad = excluded.max_squad,
      base_price_tiers = excluded.base_price_tiers,
      increment_ladder = excluded.increment_ladder,
      custom_rules_json = excluded.custom_rules_json
  `).run(uuidv4(), tId, basePriceTiers, incrementLadder, customRules);

  // 4. Create 4 Franchises (Removed dummy franchises; allow clean creation through UI)

  // 5. Create 39 Players from PDF
  const playersData = [
    { name: 'Ajey Simha', group_name: 'GROUP A', status: 'Returning', is_foreign: 0, base: 100, stats: { "Innings": 1, "Runs": 43, "Strike Rate": 268, "Wickets": 1 } },
    { name: 'Punith N', group_name: 'GROUP A', status: 'Returning', is_foreign: 0, base: 100, stats: { "Innings": 2, "Runs": 11, "Strike Rate": 275, "Wickets": 0 } },
    { name: 'Dushyanth S J', group_name: 'GROUP A', status: 'Returning', is_foreign: 0, base: 100, stats: { "Innings": 4, "Runs": 252, "Strike Rate": 327, "Wickets": 2 } },
    { name: 'HEMANTH R', group_name: 'GROUP A', status: 'Returning', is_foreign: 0, base: 100, stats: { "Innings": 2, "Runs": 32, "Strike Rate": 246, "Wickets": 4 } },
    { name: 'Manoj M R', group_name: 'GROUP A', status: 'Returning', is_foreign: 0, base: 100, stats: { "Innings": 4, "Runs": 28, "Strike Rate": 121, "Wickets": 1 } },
    { name: 'Rishav D Raj', group_name: 'GROUP A', status: 'Returning', is_foreign: 0, base: 100, stats: { "Innings": 2, "Runs": 88, "Strike Rate": 283, "Wickets": 0 } },
    { name: 'Santhosh M', group_name: 'GROUP A', status: 'Returning', is_foreign: 0, base: 100, stats: { "Innings": 3, "Runs": 18, "Strike Rate": 78, "Wickets": 0 } },
    { name: 'SAYAM D jAIN', group_name: 'GROUP A', status: 'Returning', is_foreign: 0, base: 100, stats: { "Innings": 5, "Runs": 199, "Strike Rate": 288, "Wickets": 3 } },
    { name: 'Srivathsa E R', group_name: 'GROUP A', status: 'Returning', is_foreign: 0, base: 100, stats: { "Innings": 3, "Runs": 51, "Strike Rate": 231, "Wickets": 1 } },
    { name: 'Suhas Gowda', group_name: 'GROUP A', status: 'Returning', is_foreign: 0, base: 100, stats: { "Innings": 5, "Runs": 153, "Strike Rate": 239, "Wickets": 2 } },
    { name: 'Sujan Shetty', group_name: 'GROUP A', status: 'Returning', is_foreign: 0, base: 100, stats: { "Innings": 5, "Runs": 55, "Strike Rate": 196, "Wickets": 2 } },
    { name: 'Surya H R', group_name: 'GROUP A', status: 'Returning', is_foreign: 0, base: 100, stats: { "Innings": 3, "Runs": 153, "Strike Rate": 272, "Wickets": 1 } },
    { name: 'Ankit Kumar', group_name: 'GROUP B', status: 'Returning', is_foreign: 0, base: 50, stats: { "Innings": 1, "Runs": 1, "Strike Rate": 12, "Wickets": 0 } },
    { name: 'Kiran Kumar HA', group_name: 'GROUP B', status: 'Returning', is_foreign: 0, base: 50, stats: { "Innings": 2, "Runs": 11, "Strike Rate": 73, "Wickets": 0 } },
    { name: 'Manoj K N', group_name: 'GROUP B', status: 'Returning', is_foreign: 0, base: 50, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Milap Nagar', group_name: 'GROUP B', status: 'Returning', is_foreign: 0, base: 50, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Nandan', group_name: 'GROUP B', status: 'Returning', is_foreign: 0, base: 50, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Nithesh', group_name: 'GROUP B', status: 'Returning', is_foreign: 0, base: 50, stats: { "Innings": 3, "Runs": 2, "Strike Rate": 133, "Wickets": 2 } },
    { name: 'Noor Athil', group_name: 'GROUP B', status: 'Returning', is_foreign: 0, base: 50, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Arun Kumar HR', group_name: 'GROUP B', status: 'Returning', is_foreign: 0, base: 50, stats: { "Innings": 5, "Runs": 91, "Strike Rate": 260, "Wickets": 5 } },
    { name: 'Rakesh YS', group_name: 'GROUP B', status: 'Returning', is_foreign: 0, base: 50, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Ratikanta Mohapatra', group_name: 'GROUP B', status: 'Newcomer', is_foreign: 0, base: 50, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Revana Siddappa', group_name: 'GROUP B', status: 'Newcomer', is_foreign: 0, base: 50, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Sarang Kaliyath', group_name: 'GROUP B', status: 'Newcomer', is_foreign: 0, base: 50, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Shrishail Chanaveer', group_name: 'GROUP B', status: 'Returning', is_foreign: 0, base: 50, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Srinidhi A', group_name: 'GROUP B', status: 'Returning', is_foreign: 0, base: 50, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Sushil Kumar Singh', group_name: 'GROUP B', status: 'Returning', is_foreign: 0, base: 50, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Dinesh Gowd Patel', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Karthik Shastry', group_name: 'GROUP C', status: 'Returning', is_foreign: 0, base: 25, stats: { "Innings": 3, "Runs": 6, "Strike Rate": 75, "Wickets": 0 } },
    { name: 'Krishnasis', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Pranav Koushik N', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Pushpalatha G', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Rajdhilip G', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Samir', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Shakib Jilani', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'shashank d r', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Siba Prasad Hota', group_name: 'GROUP C', status: 'Returning', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Suchith M S', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Viral Upendrabhai Vasoya', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Vivek Kulkarni', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Vyom Kumar Mittal', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
    { name: 'Yashas Kumar S', group_name: 'GROUP C', status: 'Newcomer', is_foreign: 0, base: 25, stats: { "Innings": 0, "Runs": 0, "Strike Rate": 0, "Wickets": 0 } },
  ];

  const insertPlayer = db.prepare(`
    INSERT INTO players (id, tournament_id, name, group_name, is_foreign, status, base_price, approval_status, stats_json, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)
  `);

  const createdPlayerIds: string[] = [];
  const photos = [
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'
  ];



  for (let i = 0; i < playersData.length; i++) {
    const p = playersData[i];
    const pId = 'ply-' + (i + 1);
    createdPlayerIds.push(pId);
    const photoUrl = groupAPhotos[p.name] || photos[i % photos.length];
    insertPlayer.run(
      pId,
      tId,
      p.name,
      p.group_name,
      p.is_foreign,
      p.status,
      p.base * 1000,
      JSON.stringify(p.stats),
      photoUrl
    );
  }

  // 6. Create Auction Session and Lots
  const sessionId = 'ses-ipl-2026';
  db.prepare(`
    INSERT INTO auction_sessions (id, tournament_id, status, current_lot_id, timer_seconds, timer_enabled)
    VALUES (?, ?, 'scheduled', null, 15, 1)
    ON CONFLICT DO NOTHING
  `).run(sessionId, tId);

  const insertLot = db.prepare(`
    INSERT INTO auction_lots (id, session_id, tournament_id, player_id, sequence_number, set_name, status, current_highest_bid)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', 0)
  `);

  let seq = 1;
  for (let i = 0; i < createdPlayerIds.length; i++) {
    const pId = createdPlayerIds[i];
    const pData = playersData[i];
    const lotId = 'lot-' + (i + 1);
    insertLot.run(
      lotId,
      sessionId,
      tId,
      pId,
      seq++,
      pData.group_name
    );
  }

  // Set the first lot as current in the session
  db.prepare('UPDATE auction_sessions SET current_lot_id = ? WHERE id = ?').run('lot-1', sessionId);

  console.log('Seeding completed successfully!');
}
