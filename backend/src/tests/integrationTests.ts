import assert from 'assert';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { calculateMinimumFutureReserve, calculateHardSafeLimit } from '../services/hardSafeLimitCalculator';

function runIntegrationTests() {
  console.log('Running Hard Safe Limit Integration Simulation...');

  // Initialize isolated memory DB
  const db = new Database(':memory:');

  // Create tables
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE);
    CREATE TABLE tournaments (id TEXT PRIMARY KEY, name TEXT, status TEXT);
    CREATE TABLE tournament_rules (
      id TEXT PRIMARY KEY,
      tournament_id TEXT UNIQUE,
      purse_budget REAL,
      min_squad INTEGER,
      max_squad INTEGER,
      base_price_tiers TEXT,
      increment_ladder TEXT,
      custom_rules_json TEXT
    );
    CREATE TABLE franchises (
      id TEXT PRIMARY KEY,
      tournament_id TEXT,
      name TEXT,
      short_name TEXT,
      initial_purse REAL,
      remaining_purse REAL
    );
    CREATE TABLE players (
      id TEXT PRIMARY KEY,
      tournament_id TEXT,
      name TEXT,
      group_name TEXT,
      base_price REAL,
      approval_status TEXT
    );
    CREATE TABLE auction_sessions (id TEXT PRIMARY KEY, tournament_id TEXT, status TEXT, current_lot_id TEXT);
    CREATE TABLE auction_lots (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      tournament_id TEXT,
      player_id TEXT,
      sequence_number INTEGER,
      status TEXT,
      current_highest_bid REAL,
      current_bidder_id TEXT,
      sold_price REAL,
      buyer_id TEXT
    );
    CREATE TABLE bids (id TEXT PRIMARY KEY, lot_id TEXT, franchise_id TEXT, amount REAL);
    CREATE TABLE purse_ledger (
      id TEXT PRIMARY KEY,
      franchise_id TEXT,
      lot_id TEXT,
      transaction_type TEXT,
      amount REAL,
      balance_after REAL
    );
  `);

  const tId = 'tour-integration-2026';
  db.prepare("INSERT INTO tournaments VALUES (?, 'Integration Test Tour', 'active')").run(tId);

  // Group Rules Config (N-groups)
  const customRules = JSON.stringify({
    group_rules: [
      { group_name: "GROUP A", base_price: 100000, min_players: 2, max_players: 2 },
      { group_name: "GROUP B", base_price: 50000, min_players: 2, max_players: 3 },
      { group_name: "GROUP C", base_price: 25000, min_players: 2, max_players: 3 }
    ],
    bid_increments: [5000, 10000, 25000, 50000]
  });

  db.prepare(`
    INSERT INTO tournament_rules VALUES (?, ?, 1000000, 7, 7, '[100000,50000,25000]', '[]', ?)
  `).run(uuidv4(), tId, customRules);

  // Seed 6 Franchises
  const franchises = [
    { id: 'f-1', name: 'Franchise 1', short: 'F1' },
    { id: 'f-2', name: 'Franchise 2', short: 'F2' },
    { id: 'f-3', name: 'Franchise 3', short: 'F3' },
    { id: 'f-4', name: 'Franchise 4', short: 'F4' },
    { id: 'f-5', name: 'Franchise 5', short: 'F5' },
    { id: 'f-6', name: 'Franchise 6', short: 'F6' }
  ];
  for (const f of franchises) {
    db.prepare("INSERT INTO franchises VALUES (?, ?, ?, ?, 1000000, 1000000)").run(f.id, tId, f.name, f.short);
    db.prepare("INSERT INTO purse_ledger VALUES (?, ?, null, 'initial_credit', 1000000, 1000000)").run(uuidv4(), f.id);
  }

  // Seed 42 Players (12 Group A, 15 Group B, 15 Group C)
  const players: { id: string; name: string; group_name: string; base_price: number }[] = [];

  for (let i = 1; i <= 12; i++) {
    players.push({ id: `p-a-${i}`, name: `Player A-${i}`, group_name: 'GROUP A', base_price: 100000 });
  }
  for (let i = 1; i <= 15; i++) {
    players.push({ id: `p-b-${i}`, name: `Player B-${i}`, group_name: 'GROUP B', base_price: 50000 });
  }
  for (let i = 1; i <= 15; i++) {
    players.push({ id: `p-c-${i}`, name: `Player C-${i}`, group_name: 'GROUP C', base_price: 25000 });
  }

  for (const p of players) {
    db.prepare("INSERT INTO players VALUES (?, ?, ?, ?, ?, 'approved')").run(p.id, tId, p.name, p.group_name, p.base_price);
  }

  // Seed Lots
  const sessionId = 'ses-1';
  db.prepare("INSERT INTO auction_sessions VALUES (?, ?, 'scheduled', 'lot-1')").run(sessionId, tId);

  for (let i = 0; i < players.length; i++) {
    const lotId = `lot-${i + 1}`;
    db.prepare("INSERT INTO auction_lots VALUES (?, ?, ?, ?, ?, 'queued', 0, null, null, null)").run(
      lotId,
      sessionId,
      tId,
      players[i].id,
      i + 1
    );
  }

  // Pure function helper matching the engine's transaction safety
  function simulateBid(franchiseId: string, lotId: string, bidAmount: number, playerGroup: string): { allowed: boolean; reasonCode?: string } {
    const franchise = db.prepare('SELECT * FROM franchises WHERE id = ?').get(franchiseId) as any;
    const remainingPurse = franchise.remaining_purse;

    const squad = db.prepare(`
      SELECT p.group_name, al.sold_price 
      FROM auction_lots al
      JOIN players p ON al.player_id = p.id
      WHERE al.buyer_id = ? AND al.status = 'sold'
    `).all(franchiseId) as { group_name: string; sold_price: number }[];

    if (squad.length >= 7) {
      return { allowed: false, reasonCode: 'MAX_SQUAD' };
    }

    const currentGroupCounts: Record<string, number> = {};
    squad.forEach((p: any) => {
      const g = (p.group_name || '').toUpperCase();
      currentGroupCounts[g] = (currentGroupCounts[g] || 0) + 1;
    });

    const parsedRules = JSON.parse(customRules);
    const groupRules = parsedRules.group_rules;

    const groupRule = groupRules.find((r: any) => r.group_name.toUpperCase() === playerGroup.toUpperCase());
    if (groupRule) {
      const ownedInGroup = currentGroupCounts[playerGroup.toUpperCase()] || 0;
      const maxAllowed = groupRule.max_players ?? groupRule.min_players;
      if (ownedInGroup >= maxAllowed) {
        return { allowed: false, reasonCode: 'GROUP_MAX_LIMIT' };
      }
    }

    const result = calculateMinimumFutureReserve(
      { squad, remainingPurse },
      playerGroup,
      { custom_rules_json: customRules }
    );

    const hardSafeLimit = result.hardSafeLimit;
    const minimumFutureReserve = result.totalReserve;

    if (remainingPurse < minimumFutureReserve) {
      return { allowed: false, reasonCode: 'TEAM_COMPLETION_FINANCIAL_RISK' };
    }

    if (bidAmount > hardSafeLimit) {
      return { allowed: false, reasonCode: 'HARD_SAFE_LIMIT_EXCEEDED' };
    }

    return { allowed: true };
  }

  // Simulate complete auction lot by lot
  for (let i = 0; i < players.length; i++) {
    const lotId = `lot-${i + 1}`;
    const p = players[i];

    // Determine eligible bidders for this player
    const eligibleBidders = franchises.filter(f => {
      const eligibility = simulateBid(f.id, lotId, p.base_price, p.group_name);
      return eligibility.allowed;
    });

    if (eligibleBidders.length === 0) {
      continue; // No one can buy this player (unsold)
    }

    // Bidding war! Let them raise the bid until only one bidder remains
    let currentBid = p.base_price;
    let highestBidder = eligibleBidders[0];
    let bidWarActive = true;

    while (bidWarActive) {
      bidWarActive = false;
      for (const bidder of eligibleBidders) {
        if (bidder.id === highestBidder.id) continue;

        const nextBid = currentBid + 5000;
        const bidCheck = simulateBid(bidder.id, lotId, nextBid, p.group_name);
        if (bidCheck.allowed) {
          currentBid = nextBid;
          highestBidder = bidder;
          bidWarActive = true; // Still active since we had a higher bid
        }
      }
    }

    // Record sale
    db.prepare(`
      UPDATE auction_lots
      SET status = 'sold', sold_price = ?, buyer_id = ?
      WHERE id = ?
    `).run(currentBid, highestBidder.id, lotId);

    // Purse transaction
    const franchise = db.prepare('SELECT remaining_purse FROM franchises WHERE id = ?').get(highestBidder.id) as any;
    const newPurse = franchise.remaining_purse - currentBid;
    db.prepare('UPDATE franchises SET remaining_purse = ? WHERE id = ?').run(newPurse, highestBidder.id);
    db.prepare("INSERT INTO purse_ledger VALUES (?, ?, ?, 'bid_deduction', ?, ?)").run(
      uuidv4(),
      highestBidder.id,
      lotId,
      -currentBid,
      newPurse
    );
  }

  // Post-simulation Verifications
  console.log('Verifying final auction results...');
  console.log('Final squads:');
  for (const f of franchises) {
    const squad = db.prepare("SELECT * FROM auction_lots WHERE buyer_id = ? AND status = 'sold'").all(f.id) as any[];
    const dbFran = db.prepare('SELECT remaining_purse FROM franchises WHERE id = ?').get(f.id) as any;
    const countA = squad.filter(l => players.find(p => p.id === l.player_id)?.group_name === 'GROUP A').length;
    const countB = squad.filter(l => players.find(p => p.id === l.player_id)?.group_name === 'GROUP B').length;
    const countC = squad.filter(l => players.find(p => p.id === l.player_id)?.group_name === 'GROUP C').length;
    console.log(`Franchise ${f.name} (${f.short}): total=${squad.length}, remainingPurse=${dbFran.remaining_purse}, A=${countA}, B=${countB}, C=${countC}`);
  }

  // 1. Every franchise has exactly 7 players
  for (const f of franchises) {
    const squad = db.prepare("SELECT * FROM auction_lots WHERE buyer_id = ? AND status = 'sold'").all(f.id) as any[];
    assert.strictEqual(squad.length, 7, `Franchise ${f.short} should have exactly 7 players`);

    // 2. Every franchise satisfies group requirements: A=2, B=2, C=3
    const countA = squad.filter(l => players.find(p => p.id === l.player_id)?.group_name === 'GROUP A').length;
    const countB = squad.filter(l => players.find(p => p.id === l.player_id)?.group_name === 'GROUP B').length;
    const countC = squad.filter(l => players.find(p => p.id === l.player_id)?.group_name === 'GROUP C').length;

    assert.strictEqual(countA, 2, `Franchise ${f.short} should have 2 Group A players`);
    assert.ok(countB >= 2 && countB <= 3, `Franchise ${f.short} should have between 2 and 3 Group B players`);
    assert.ok(countC >= 2 && countC <= 3, `Franchise ${f.short} should have between 2 and 3 Group C players`);
    assert.strictEqual(countB + countC, 5, `Franchise ${f.short} total B and C players should equal 5`);

    // 3. No franchise has a negative wallet
    const franchise = db.prepare('SELECT remaining_purse FROM franchises WHERE id = ?').get(f.id) as any;
    assert.ok(franchise.remaining_purse >= 0, `Franchise ${f.short} wallet should not be negative`);
  }

  // 4. No player is sold twice
  const allSoldLots = db.prepare("SELECT player_id, COUNT(*) as cnt FROM auction_lots WHERE status = 'sold' GROUP BY player_id").all() as { player_id: string; cnt: number }[];
  for (const lot of allSoldLots) {
    assert.strictEqual(lot.cnt, 1, `Player ${lot.player_id} should be sold exactly once`);
  }

  console.log('✔ Integration simulation verifications passed successfully!');
  console.log('Integration Test Completed Successfully!');
}

runIntegrationTests();
