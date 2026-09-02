import { db, initDatabase } from './database';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * Standalone seeder: 5 international cricket teams, 7 players each (35 total).
 *
 * Squads are written as *completed auction lots* (status = 'sold') because that is
 * how the app derives a franchise squad -- see franchiseService.getFranchises().
 * Each franchise therefore also gets a purse ledger: one initial_credit row plus a
 * bid_deduction row per player, so SUM(purse_ledger.amount) equals the remaining
 * purse that getFranchisePurse() computes.
 *
 * Run:  npm --prefix backend run seed:teams
 */

type PlayerRole = 'Batter' | 'Bowler' | 'All-rounder' | 'Wicket-keeper Batter';
type GroupName = 'GROUP A' | 'GROUP B' | 'GROUP C';

interface SeedPlayer {
  name: string;
  role: PlayerRole;
  group_name: GroupName;
  price: number;
  stats: { Innings: number; Runs: number; 'Strike Rate': number; Wickets: number };
}

interface SeedTeam {
  id: string;
  name: string;
  short_name: string;
  primary_color: string;
  secondary_color: string;
  is_foreign: 0 | 1;
  owner: { id: string; name: string; email: string };
  players: SeedPlayer[];
}

// Base price per tier, mirroring tournament_rules.custom_rules_json in seed.ts
const BASE_PRICE: Record<GroupName, number> = {
  'GROUP A': 100000,
  'GROUP B': 50000,
  'GROUP C': 25000
};

// Group composition every squad must satisfy (2 + 2 + 3 = 7)
const REQUIRED_COMPOSITION: Record<GroupName, number> = {
  'GROUP A': 2,
  'GROUP B': 2,
  'GROUP C': 3
};

const TEAMS: SeedTeam[] = [
  {
    id: 'fran-ind',
    name: 'India',
    short_name: 'IND',
    primary_color: '#0033A0',
    secondary_color: '#FF9933',
    is_foreign: 0,
    owner: { id: 'usr-own-ind', name: 'India Team Owner', email: 'owner.ind@platform.com' },
    players: [
      { name: 'Virat Kohli', role: 'Batter', group_name: 'GROUP A', price: 280000, stats: { Innings: 125, Runs: 4188, 'Strike Rate': 138, Wickets: 4 } },
      { name: 'Jasprit Bumrah', role: 'Bowler', group_name: 'GROUP A', price: 240000, stats: { Innings: 70, Runs: 68, 'Strike Rate': 92, Wickets: 89 } },
      { name: 'Rohit Sharma', role: 'Batter', group_name: 'GROUP B', price: 120000, stats: { Innings: 151, Runs: 4231, 'Strike Rate': 140, Wickets: 1 } },
      { name: 'Ravindra Jadeja', role: 'All-rounder', group_name: 'GROUP B', price: 100000, stats: { Innings: 74, Runs: 515, 'Strike Rate': 127, Wickets: 54 } },
      { name: 'Rishabh Pant', role: 'Wicket-keeper Batter', group_name: 'GROUP C', price: 65000, stats: { Innings: 66, Runs: 1209, 'Strike Rate': 126, Wickets: 0 } },
      { name: 'Mohammed Shami', role: 'Bowler', group_name: 'GROUP C', price: 45000, stats: { Innings: 23, Runs: 21, 'Strike Rate': 88, Wickets: 24 } },
      { name: 'Kuldeep Yadav', role: 'Bowler', group_name: 'GROUP C', price: 35000, stats: { Innings: 40, Runs: 42, 'Strike Rate': 95, Wickets: 69 } }
    ]
  },
  {
    id: 'fran-aus',
    name: 'Australia',
    short_name: 'AUS',
    primary_color: '#115740',
    secondary_color: '#FFD100',
    is_foreign: 1,
    owner: { id: 'usr-own-aus', name: 'Australia Team Owner', email: 'owner.aus@platform.com' },
    players: [
      { name: 'Steve Smith', role: 'Batter', group_name: 'GROUP A', price: 250000, stats: { Innings: 63, Runs: 1094, 'Strike Rate': 125, Wickets: 0 } },
      { name: 'Pat Cummins', role: 'Bowler', group_name: 'GROUP A', price: 240000, stats: { Innings: 56, Runs: 129, 'Strike Rate': 118, Wickets: 62 } },
      { name: 'Travis Head', role: 'Batter', group_name: 'GROUP B', price: 115000, stats: { Innings: 42, Runs: 1092, 'Strike Rate': 158, Wickets: 3 } },
      { name: 'Mitchell Starc', role: 'Bowler', group_name: 'GROUP B', price: 105000, stats: { Innings: 65, Runs: 74, 'Strike Rate': 105, Wickets: 79 } },
      { name: 'Glenn Maxwell', role: 'All-rounder', group_name: 'GROUP C', price: 60000, stats: { Innings: 100, Runs: 2126, 'Strike Rate': 154, Wickets: 39 } },
      { name: 'Alex Carey', role: 'Wicket-keeper Batter', group_name: 'GROUP C', price: 55000, stats: { Innings: 38, Runs: 602, 'Strike Rate': 122, Wickets: 0 } },
      { name: 'Nathan Lyon', role: 'Bowler', group_name: 'GROUP C', price: 40000, stats: { Innings: 29, Runs: 18, 'Strike Rate': 76, Wickets: 31 } }
    ]
  },
  {
    id: 'fran-eng',
    name: 'England',
    short_name: 'ENG',
    primary_color: '#002D5B',
    secondary_color: '#CE1124',
    is_foreign: 1,
    owner: { id: 'usr-own-eng', name: 'England Team Owner', email: 'owner.eng@platform.com' },
    players: [
      { name: 'Joe Root', role: 'Batter', group_name: 'GROUP A', price: 255000, stats: { Innings: 32, Runs: 893, 'Strike Rate': 126, Wickets: 6 } },
      { name: 'Jofra Archer', role: 'Bowler', group_name: 'GROUP A', price: 220000, stats: { Innings: 30, Runs: 41, 'Strike Rate': 110, Wickets: 42 } },
      { name: 'Ben Stokes', role: 'All-rounder', group_name: 'GROUP B', price: 130000, stats: { Innings: 43, Runs: 585, 'Strike Rate': 134, Wickets: 26 } },
      { name: 'Harry Brook', role: 'Batter', group_name: 'GROUP B', price: 120000, stats: { Innings: 38, Runs: 861, 'Strike Rate': 146, Wickets: 0 } },
      { name: 'Jos Buttler', role: 'Wicket-keeper Batter', group_name: 'GROUP C', price: 65000, stats: { Innings: 114, Runs: 3245, 'Strike Rate': 145, Wickets: 0 } },
      { name: 'Mark Wood', role: 'Bowler', group_name: 'GROUP C', price: 42000, stats: { Innings: 34, Runs: 22, 'Strike Rate': 98, Wickets: 45 } },
      { name: 'Adil Rashid', role: 'Bowler', group_name: 'GROUP C', price: 38000, stats: { Innings: 108, Runs: 96, 'Strike Rate': 89, Wickets: 122 } }
    ]
  },
  {
    id: 'fran-sa',
    name: 'South Africa',
    short_name: 'SA',
    primary_color: '#007A4D',
    secondary_color: '#FFB612',
    is_foreign: 1,
    owner: { id: 'usr-own-sa', name: 'South Africa Team Owner', email: 'owner.sa@platform.com' },
    players: [
      { name: 'Kagiso Rabada', role: 'Bowler', group_name: 'GROUP A', price: 245000, stats: { Innings: 61, Runs: 54, 'Strike Rate': 112, Wickets: 76 } },
      { name: 'Aiden Markram', role: 'Batter', group_name: 'GROUP A', price: 210000, stats: { Innings: 55, Runs: 1372, 'Strike Rate': 141, Wickets: 5 } },
      { name: 'Marco Jansen', role: 'All-rounder', group_name: 'GROUP B', price: 115000, stats: { Innings: 28, Runs: 174, 'Strike Rate': 139, Wickets: 30 } },
      { name: 'Temba Bavuma', role: 'Batter', group_name: 'GROUP B', price: 105000, stats: { Innings: 29, Runs: 631, 'Strike Rate': 121, Wickets: 0 } },
      { name: 'Quinton de Kock', role: 'Wicket-keeper Batter', group_name: 'GROUP C', price: 68000, stats: { Innings: 82, Runs: 2278, 'Strike Rate': 139, Wickets: 0 } },
      { name: 'Anrich Nortje', role: 'Bowler', group_name: 'GROUP C', price: 45000, stats: { Innings: 39, Runs: 26, 'Strike Rate': 84, Wickets: 51 } },
      { name: 'Keshav Maharaj', role: 'Bowler', group_name: 'GROUP C', price: 35000, stats: { Innings: 26, Runs: 31, 'Strike Rate': 93, Wickets: 24 } }
    ]
  },
  {
    id: 'fran-nz',
    name: 'New Zealand',
    short_name: 'NZ',
    primary_color: '#000000',
    secondary_color: '#C0C0C0',
    is_foreign: 1,
    owner: { id: 'usr-own-nz', name: 'New Zealand Team Owner', email: 'owner.nz@platform.com' },
    players: [
      { name: 'Kane Williamson', role: 'Batter', group_name: 'GROUP A', price: 250000, stats: { Innings: 85, Runs: 2575, 'Strike Rate': 123, Wickets: 0 } },
      { name: 'Trent Boult', role: 'Bowler', group_name: 'GROUP A', price: 215000, stats: { Innings: 62, Runs: 48, 'Strike Rate': 101, Wickets: 84 } },
      { name: 'Devon Conway', role: 'Batter', group_name: 'GROUP B', price: 110000, stats: { Innings: 47, Runs: 1445, 'Strike Rate': 133, Wickets: 0 } },
      { name: 'Mitchell Santner', role: 'All-rounder', group_name: 'GROUP B', price: 100000, stats: { Innings: 84, Runs: 431, 'Strike Rate': 124, Wickets: 87 } },
      { name: 'Tom Latham', role: 'Wicket-keeper Batter', group_name: 'GROUP C', price: 60000, stats: { Innings: 25, Runs: 431, 'Strike Rate': 118, Wickets: 0 } },
      { name: 'Tim Southee', role: 'Bowler', group_name: 'GROUP C', price: 44000, stats: { Innings: 122, Runs: 249, 'Strike Rate': 130, Wickets: 164 } },
      { name: 'Matt Henry', role: 'Bowler', group_name: 'GROUP C', price: 36000, stats: { Innings: 22, Runs: 19, 'Strike Rate': 87, Wickets: 26 } }
    ]
  }
];

const PHOTOS = [
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'
];

/**
 * Fails fast on malformed seed data rather than writing a squad the auction
 * rules would reject.
 */
function validate(purseBudget: number, maxSquad: number) {
  const seenNames = new Set<string>();

  for (const team of TEAMS) {
    if (team.players.length !== maxSquad) {
      throw new Error(`${team.name}: has ${team.players.length} players, tournament max_squad is ${maxSquad}`);
    }

    for (const group of Object.keys(REQUIRED_COMPOSITION) as GroupName[]) {
      const actual = team.players.filter(p => p.group_name === group).length;
      if (actual !== REQUIRED_COMPOSITION[group]) {
        throw new Error(`${team.name}: has ${actual} ${group} players, rules require ${REQUIRED_COMPOSITION[group]}`);
      }
    }

    const spend = team.players.reduce((sum, p) => sum + p.price, 0);
    if (spend > purseBudget) {
      throw new Error(`${team.name}: spends ${spend} but the purse budget is ${purseBudget}`);
    }

    for (const p of team.players) {
      if (p.price < BASE_PRICE[p.group_name]) {
        throw new Error(`${team.name} / ${p.name}: sold price ${p.price} is below the ${p.group_name} base price ${BASE_PRICE[p.group_name]}`);
      }
      if (seenNames.has(p.name)) {
        throw new Error(`Duplicate player across squads: ${p.name}`);
      }
      seenNames.add(p.name);
    }

    const batters = team.players.filter(p => p.role === 'Batter' || p.role === 'Wicket-keeper Batter').length;
    const bowlers = team.players.filter(p => p.role === 'Bowler').length;
    if (batters < 1 || bowlers < 1) {
      throw new Error(`${team.name}: needs at least one batter and one bowler (has ${batters} / ${bowlers})`);
    }
  }
}

export function seedTeams(tournamentId = 'tour-ipl-2026') {
  initDatabase();

  const tournament = db.prepare('SELECT id, name FROM tournaments WHERE id = ?').get(tournamentId) as any;
  if (!tournament) {
    throw new Error(`Tournament "${tournamentId}" not found. Start the backend once so seedData() creates it, then re-run.`);
  }

  const rules = db.prepare('SELECT purse_budget, max_squad FROM tournament_rules WHERE tournament_id = ?').get(tournamentId) as any;
  const purseBudget: number = rules?.purse_budget ?? 1000000;
  const maxSquad: number = rules?.max_squad ?? 7;

  validate(purseBudget, maxSquad);

  const preferredSessionId = `ses-${tournamentId}`;
  const passwordHash = bcrypt.hashSync('password123', 10);

  const run = db.transaction(() => {
    // Replace this tournament's auction data only. Ordered child-first so the
    // delete works regardless of cascade support.
    db.prepare('DELETE FROM match_events WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = ?)').run(tournamentId);
    db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(tournamentId);
    db.prepare('DELETE FROM points_table WHERE tournament_id = ?').run(tournamentId);
    db.prepare('DELETE FROM bids WHERE lot_id IN (SELECT id FROM auction_lots WHERE tournament_id = ?)').run(tournamentId);
    db.prepare('DELETE FROM auction_lots WHERE tournament_id = ?').run(tournamentId);
    db.prepare('DELETE FROM purse_ledger WHERE franchise_id IN (SELECT id FROM franchises WHERE tournament_id = ?)').run(tournamentId);
    db.prepare('DELETE FROM players WHERE tournament_id = ?').run(tournamentId);
    db.prepare('DELETE FROM franchises WHERE tournament_id = ?').run(tournamentId);

    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, status, avatar_url)
      VALUES (?, ?, ?, ?, 'active', ?)
      ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash
    `);
    const insertRole = db.prepare(`
      INSERT INTO user_roles (id, user_id, tournament_id, role)
      VALUES (?, ?, ?, 'Franchise Owner')
      ON CONFLICT(user_id, tournament_id, role) DO NOTHING
    `);
    const insertFranchise = db.prepare(`
      INSERT INTO franchises (id, tournament_id, name, short_name, logo_url, primary_color, secondary_color, owner_id, initial_purse, remaining_purse, is_bidding_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const insertPlayer = db.prepare(`
      INSERT INTO players (id, tournament_id, name, group_name, is_foreign, status, base_price, approval_status, stats_json, photo_url, is_captain)
      VALUES (?, ?, ?, ?, ?, 'Returning', ?, 'approved', ?, ?, ?)
    `);
    const insertLot = db.prepare(`
      INSERT INTO auction_lots (id, session_id, tournament_id, player_id, sequence_number, set_name, status, current_highest_bid, sold_price, buyer_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'sold', ?, ?, ?, ?)
    `);
    const insertLedger = db.prepare(`
      INSERT INTO purse_ledger (id, franchise_id, lot_id, transaction_type, amount, balance_after, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPoints = db.prepare(`
      INSERT INTO points_table (id, tournament_id, franchise_id, played, won, lost, tied, no_result, points, nrr, position)
      VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0.0, ?)
    `);

    db.prepare(`
      INSERT INTO auction_sessions (id, tournament_id, status, current_lot_id, timer_seconds, timer_enabled)
      VALUES (?, ?, 'completed', null, 15, 1)
      ON CONFLICT(tournament_id) DO UPDATE SET status = 'completed', current_lot_id = null
    `).run(preferredSessionId, tournamentId);

    // auction_sessions is UNIQUE per tournament, so the upsert above may have
    // updated a pre-existing row that carries a different id. Lots must point at
    // whichever id actually won.
    const sessionId = (db.prepare('SELECT id FROM auction_sessions WHERE tournament_id = ?').get(tournamentId) as any).id as string;

    let sequence = 1;
    let photoIndex = 0;

    TEAMS.forEach((team, teamIndex) => {
      insertUser.run(team.owner.id, team.owner.name, team.owner.email, passwordHash, PHOTOS[teamIndex % PHOTOS.length]);
      insertRole.run(uuidv4(), team.owner.id, tournamentId);

      const spend = team.players.reduce((sum, p) => sum + p.price, 0);
      const remaining = purseBudget - spend;

      insertFranchise.run(
        team.id,
        tournamentId,
        team.name,
        team.short_name,
        `https://ui-avatars.com/api/?name=${encodeURIComponent(team.short_name)}&background=${team.primary_color.slice(1)}&color=fff&size=150&bold=true`,
        team.primary_color,
        team.secondary_color,
        team.owner.id,
        purseBudget,
        remaining
      );

      // The ledger opens with the full purse: getFranchisePurse() derives the
      // remaining purse from SUM(amount), so the credit must precede deductions.
      insertLedger.run(uuidv4(), team.id, null, 'initial_credit', purseBudget, purseBudget, 'Initial Franchise Purse Allocation');

      let balance = purseBudget;
      const firstGroupAIndex = team.players.findIndex(p => p.group_name === 'GROUP A');

      team.players.forEach((p, playerIndex) => {
        const playerId = `${team.id}-p${playerIndex + 1}`;
        const lotId = `${team.id}-lot${playerIndex + 1}`;

        // Mirrors updateFranchiseCaptainStatus(): a franchise's first GROUP A
        // signing is its captain.
        const isCaptain = playerIndex === firstGroupAIndex ? 1 : 0;

        insertPlayer.run(
          playerId,
          tournamentId,
          p.name,
          p.group_name,
          team.is_foreign,
          BASE_PRICE[p.group_name],
          JSON.stringify({ Role: p.role, ...p.stats }),
          PHOTOS[photoIndex++ % PHOTOS.length],
          isCaptain
        );

        // updated_at drives squad ordering in franchiseService; keep it monotonic.
        const soldAt = new Date(Date.now() + sequence * 1000).toISOString().replace('T', ' ').slice(0, 19);

        insertLot.run(lotId, sessionId, tournamentId, playerId, sequence, p.group_name, p.price, p.price, team.id, soldAt);

        balance -= p.price;
        insertLedger.run(uuidv4(), team.id, lotId, 'bid_deduction', -p.price, balance, `Purchased ${p.name} for ${p.price} rs`);

        sequence += 1;
      });

      insertPoints.run(uuidv4(), tournamentId, team.id, teamIndex + 1);
    });
  });

  run();

  return {
    tournamentId,
    teams: TEAMS.length,
    players: TEAMS.reduce((n, t) => n + t.players.length, 0),
    purseBudget
  };
}

function report(tournamentId: string) {
  const rows = db.prepare(`
    SELECT f.name AS team, f.remaining_purse, COUNT(al.id) AS squad, SUM(al.sold_price) AS spent
    FROM franchises f
    LEFT JOIN auction_lots al ON al.buyer_id = f.id AND al.status = 'sold'
    WHERE f.tournament_id = ?
    GROUP BY f.id
    ORDER BY f.name
  `).all(tournamentId) as any[];

  console.log('\n  Team              Squad      Spent    Remaining');
  console.log('  ----------------------------------------------');
  for (const r of rows) {
    console.log(
      `  ${String(r.team).padEnd(16)}  ${String(r.squad).padStart(3)}  ${String(r.spent).padStart(9)}  ${String(r.remaining_purse).padStart(11)}`
    );
  }

  const roles = db.prepare(`
    SELECT json_extract(p.stats_json, '$.Role') AS role, COUNT(*) AS n
    FROM players p
    WHERE p.tournament_id = ?
    GROUP BY role
    ORDER BY n DESC
  `).all(tournamentId) as any[];

  console.log('\n  Role split:');
  for (const r of roles) console.log(`    ${String(r.role).padEnd(22)} ${r.n}`);
}

if (require.main === module) {
  const arg = process.argv.find(a => a.startsWith('--tournament='));
  const tournamentId = arg ? arg.split('=')[1] : 'tour-ipl-2026';

  try {
    const result = seedTeams(tournamentId);
    console.log(`\n[seedTeams] Seeded ${result.teams} teams and ${result.players} players into "${result.tournamentId}".`);
    report(result.tournamentId);
    console.log('');
  } catch (err) {
    console.error('[seedTeams] FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
