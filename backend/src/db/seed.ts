import { db, initDatabase } from './database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export function seedData() {
  initDatabase();

  // Check if seeded already
  const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) {
    console.log('Database already seeded.');
    return;
  }

  console.log('Seeding initial IPL Tournament, Roles, Franchises, Players, and Fixtures...');

  const passwordHash = bcrypt.hashSync('password123', 10);

  // 1. Create Core Users
  const users = [
    { id: 'usr-admin', name: 'Pranav Koushik (Super Admin)', email: 'admin@platform.com', role: 'Super Admin' },
    { id: 'usr-organizer', name: 'Rajesh Sharma (Organizer)', email: 'organizer@t20.com', role: 'Tournament Admin' },
    { id: 'usr-operator', name: 'Richard Madley (Auctioneer)', email: 'operator@t20.com', role: 'Auction Operator' },
    { id: 'usr-owner-mi', name: 'Nita Ambani (MI Owner)', email: 'mi@franchise.com', role: 'Franchise Owner' },
    { id: 'usr-owner-csk', name: 'N. Srinivasan (CSK Owner)', email: 'csk@franchise.com', role: 'Franchise Owner' },
    { id: 'usr-owner-rcb', name: 'Anand K. (RCB Owner)', email: 'rcb@franchise.com', role: 'Franchise Owner' },
    { id: 'usr-owner-dc', name: 'Parth Jindal (DC Owner)', email: 'dc@franchise.com', role: 'Franchise Owner' },
    { id: 'usr-scorer', name: 'Nitin Menon (Official Scorer)', email: 'scorer@t20.com', role: 'Scorer' },
    { id: 'usr-spectator', name: 'Cricket Fan (Public)', email: 'fan@cricket.com', role: 'Spectator' }
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, status, avatar_url)
    VALUES (?, ?, ?, ?, 'active', ?)
  `);

  for (const u of users) {
    insertUser.run(u.id, u.name, u.email, passwordHash, `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`);
  }

  // 2. Create Tournament
  const tId = 'tour-ipl-2026';
  db.prepare(`
    INSERT INTO tournaments (id, name, sport, format, dates, status, logo_url)
    VALUES (?, 'IPL 2026 Mega Auction & T20 League', 'Cricket', 'T20', 'Aug 10 - Sep 20, 2026', 'active', 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&auto=format&fit=crop&q=80')
  `).run(tId);

  // Assign user roles for this tournament
  const insertRole = db.prepare(`
    INSERT INTO user_roles (id, user_id, tournament_id, role)
    VALUES (?, ?, ?, ?)
  `);

  for (const u of users) {
    insertRole.run(uuidv4(), u.id, tId, u.role);
  }

  // 3. Create Tournament Rules
  const incrementLadder = JSON.stringify([
    { upto: 10000000, increment: 1000000 },      // Up to 1 Cr: +10 Lakhs
    { upto: 50000000, increment: 2500000 },      // Up to 5 Cr: +25 Lakhs
    { upto: 100000000, increment: 5000000 },     // Up to 10 Cr: +50 Lakhs
    { upto: 9999999999, increment: 10000000 }    // Above 10 Cr: +1 Crore
  ]);

  const basePriceTiers = JSON.stringify([20000000, 15000000, 10000000, 5000000, 2000000]); // 2 Cr, 1.5 Cr, 1 Cr, 50 L, 20 L in INR

  db.prepare(`
    INSERT INTO tournament_rules (id, tournament_id, purse_budget, min_squad, max_squad, foreign_player_limit, rtm_count_per_team, base_price_tiers, increment_ladder)
    VALUES (?, ?, 1000000000, 15, 25, 8, 2, ?, ?)
  `).run(uuidv4(), tId, basePriceTiers, incrementLadder);

  // 4. Create 4 Franchises with ₹100 Crore purse each
  const initialPurse = 1000000000; // 100 Crore Rupees
  const franchises = [
    { id: 'fran-mi', name: 'Mumbai Strikers', short: 'MI', color: '#004BA0', secColor: '#D1AB3E', owner: 'usr-owner-mi' },
    { id: 'fran-csk', name: 'Chennai Super Kings', short: 'CSK', color: '#FCCA06', secColor: '#00529C', owner: 'usr-owner-csk' },
    { id: 'fran-rcb', name: 'Royal Challengers Bengaluru', short: 'RCB', color: '#EC1C24', secColor: '#000000', owner: 'usr-owner-rcb' },
    { id: 'fran-dc', name: 'Delhi Capitals', short: 'DC', color: '#00008B', secColor: '#EF4123', owner: 'usr-owner-dc' }
  ];

  const insertFranchise = db.prepare(`
    INSERT INTO franchises (id, tournament_id, name, short_name, logo_url, primary_color, secondary_color, owner_id, initial_purse, remaining_purse)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLedger = db.prepare(`
    INSERT INTO purse_ledger (id, franchise_id, transaction_type, amount, balance_after, note)
    VALUES (?, ?, 'initial_credit', ?, ?, 'Initial Franchise Purse Allocation')
  `);

  for (const f of franchises) {
    const logo = `https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=150&auto=format&fit=crop&q=80`;
    insertFranchise.run(f.id, tId, f.name, f.short, logo, f.color, f.secColor, f.owner, initialPurse, initialPurse);
    insertLedger.run(uuidv4(), f.id, initialPurse, initialPurse);

    // Init Points Table
    db.prepare(`
      INSERT INTO points_table (id, tournament_id, franchise_id, played, won, lost, tied, no_result, points, nrr, position)
      VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0.000, 1)
    `).run(uuidv4(), tId, f.id);
  }

  // 5. Create 18 Realistic Players
  const playersData = [
    { name: 'Virat Kohli', category: 'Marquee', role: 'Batsman', is_foreign: 0, country: 'India', base: 20000000, stats: { matches: 237, runs: 7263, avg: 37.2, sr: 130.0 } },
    { name: 'Rohit Sharma', category: 'Marquee', role: 'Batsman', is_foreign: 0, country: 'India', base: 20000000, stats: { matches: 243, runs: 6211, avg: 29.5, sr: 130.8 } },
    { name: 'Jasprit Bumrah', category: 'Marquee', role: 'Bowler', is_foreign: 0, country: 'India', base: 20000000, stats: { matches: 120, wickets: 145, economy: 7.39, avg: 23.3 } },
    { name: 'MS Dhoni', category: 'Marquee', role: 'Wicket-Keeper', is_foreign: 0, country: 'India', base: 20000000, stats: { matches: 250, runs: 5082, avg: 38.8, sr: 135.9 } },
    { name: 'Rashid Khan', category: 'Marquee', role: 'All-Rounder', is_foreign: 1, country: 'Afghanistan', base: 20000000, stats: { matches: 109, wickets: 139, economy: 6.67, runs: 443 } },
    { name: 'Travis Head', category: 'Tier-1', role: 'Batsman', is_foreign: 1, country: 'Australia', base: 20000000, stats: { matches: 25, runs: 567, avg: 35.4, sr: 185.2 } },
    { name: 'Hardik Pandya', category: 'Tier-1', role: 'All-Rounder', is_foreign: 0, country: 'India', base: 20000000, stats: { matches: 123, runs: 2309, wickets: 53, sr: 145.8 } },
    { name: 'KL Rahul', category: 'Tier-1', role: 'Wicket-Keeper', is_foreign: 0, country: 'India', base: 20000000, stats: { matches: 118, runs: 4163, avg: 45.8, sr: 134.6 } },
    { name: 'Mitchell Starc', category: 'Tier-1', role: 'Bowler', is_foreign: 1, country: 'Australia', base: 20000000, stats: { matches: 39, wickets: 51, economy: 8.8, avg: 24.1 } },
    { name: 'Rishabh Pant', category: 'Tier-1', role: 'Wicket-Keeper', is_foreign: 0, country: 'India', base: 20000000, stats: { matches: 98, runs: 2838, avg: 34.6, sr: 148.0 } },
    { name: 'Suryakumar Yadav', category: 'Tier-1', role: 'Batsman', is_foreign: 0, country: 'India', base: 20000000, stats: { matches: 139, runs: 3249, avg: 31.8, sr: 143.3 } },
    { name: 'Trent Boult', category: 'Tier-2', role: 'Bowler', is_foreign: 1, country: 'New Zealand', base: 15000000, stats: { matches: 88, wickets: 105, economy: 8.2, avg: 26.5 } },
    { name: 'Shubman Gill', category: 'Tier-2', role: 'Batsman', is_foreign: 0, country: 'India', base: 15000000, stats: { matches: 91, runs: 2790, avg: 37.7, sr: 134.1 } },
    { name: 'Ravindra Jadeja', category: 'Tier-2', role: 'All-Rounder', is_foreign: 0, country: 'India', base: 15000000, stats: { matches: 226, runs: 2692, wickets: 152, sr: 128.6 } },
    { name: 'Nicholas Pooran', category: 'Tier-2', role: 'Wicket-Keeper', is_foreign: 1, country: 'West Indies', base: 15000000, stats: { matches: 62, runs: 1270, avg: 26.4, sr: 156.8 } },
    { name: 'Yuzvendra Chahal', category: 'Tier-2', role: 'Bowler', is_foreign: 0, country: 'India', base: 10000000, stats: { matches: 145, wickets: 187, economy: 7.67, avg: 21.6 } },
    { name: 'Heinrich Klaasen', category: 'Tier-3', role: 'Batsman', is_foreign: 1, country: 'South Africa', base: 10000000, stats: { matches: 19, runs: 514, avg: 36.7, sr: 177.2 } },
    { name: 'Rinku Singh', category: 'Tier-3', role: 'Batsman', is_foreign: 0, country: 'India', base: 5000000, stats: { matches: 31, runs: 725, avg: 36.2, sr: 142.1 } }
  ];

  const insertPlayer = db.prepare(`
    INSERT INTO players (id, tournament_id, name, category, role, is_foreign, country, base_price, approval_status, stats_json, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)
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
    const pId = `ply-${i + 1}`;
    createdPlayerIds.push(pId);
    insertPlayer.run(
      pId,
      tId,
      p.name,
      p.category,
      p.role,
      p.is_foreign,
      p.country,
      p.base,
      JSON.stringify(p.stats),
      photos[i % photos.length]
    );
  }

  // 6. Create Auction Session and Lots
  const sessionId = 'ses-ipl-2026';
  db.prepare(`
    INSERT INTO auction_sessions (id, tournament_id, status, current_lot_id, timer_seconds)
    VALUES (?, ?, 'scheduled', null, 30)
  `).run(sessionId, tId);

  const insertLot = db.prepare(`
    INSERT INTO auction_lots (id, session_id, tournament_id, player_id, sequence_number, set_name, status, current_highest_bid)
    VALUES (?, ?, ?, ?, ?, ?, 'queued', 0)
  `);

  for (let i = 0; i < createdPlayerIds.length; i++) {
    const pId = createdPlayerIds[i];
    const pData = playersData[i];
    const lotId = `lot-${i + 1}`;
    insertLot.run(
      lotId,
      sessionId,
      tId,
      pId,
      i + 1,
      `Set ${Math.floor(i / 5) + 1} - ${pData.category}`
    );
  }

  // Set the first lot as current in the session
  db.prepare('UPDATE auction_sessions SET current_lot_id = ? WHERE id = ?').run('lot-1', sessionId);

  // 7. Create Sample Matches for Match Scheduling & Scoring Demo
  const matches = [
    { id: 'match-1', num: 1, stage: 'Group Stage', home: 'fran-mi', away: 'fran-csk', venue: 'Wankhede Stadium, Mumbai', time: '2026-08-15 19:30:00', status: 'upcoming' },
    { id: 'match-2', num: 2, stage: 'Group Stage', home: 'fran-rcb', away: 'fran-dc', venue: 'M. Chinnaswamy Stadium, Bengaluru', time: '2026-08-16 19:30:00', status: 'upcoming' },
    { id: 'match-3', num: 3, stage: 'Group Stage', home: 'fran-csk', away: 'fran-rcb', venue: 'MA Chidambaram Stadium, Chennai', time: '2026-08-18 19:30:00', status: 'upcoming' },
    { id: 'match-4', num: 4, stage: 'Group Stage', home: 'fran-mi', away: 'fran-dc', venue: 'Arun Jaitley Stadium, Delhi', time: '2026-08-20 19:30:00', status: 'upcoming' }
  ];

  const insertMatch = db.prepare(`
    INSERT INTO matches (id, tournament_id, match_number, stage, home_team_id, away_team_id, venue, scheduled_time, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const m of matches) {
    insertMatch.run(m.id, tId, m.num, m.stage, m.home, m.away, m.venue, m.time, m.status);
  }

  console.log('Seeding completed successfully!');
}
