import Database from 'better-sqlite3';
import { DB_PATH } from '../config';
import fs from 'fs';
import path from 'path';

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      status TEXT DEFAULT 'active', -- active, suspended
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tournaments table
    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sport TEXT DEFAULT 'Cricket',
      format TEXT DEFAULT 'T20',
      dates TEXT,
      status TEXT DEFAULT 'draft', -- draft, active, in_progress, completed, archived
      logo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- User Tournament Roles (Scoped per tournament)
    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tournament_id TEXT NOT NULL,
      role TEXT NOT NULL, -- Super Admin, Tournament Admin, Auction Operator, Franchise Owner, Franchise Manager, Player, Scorer, Spectator
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      UNIQUE(user_id, tournament_id, role)
    );

    -- Tournament Rules
    CREATE TABLE IF NOT EXISTS tournament_rules (
      id TEXT PRIMARY KEY,
      tournament_id TEXT UNIQUE NOT NULL,
      purse_budget REAL DEFAULT 1000000000, -- e.g. 100 Cr (in rupees)
      min_squad INTEGER DEFAULT 15,
      max_squad INTEGER DEFAULT 25,
      foreign_player_limit INTEGER DEFAULT 8,
      rtm_count_per_team INTEGER DEFAULT 2,
      base_price_tiers TEXT, -- JSON array of base price values in INR e.g. [20000000, 15000000, 10000000, 5000000, 2000000]
      increment_ladder TEXT, -- JSON array of thresholds & increments
      custom_rules_json TEXT,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    );

    -- Franchises
    CREATE TABLE IF NOT EXISTS franchises (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      logo_url TEXT,
      primary_color TEXT DEFAULT '#3b82f6',
      secondary_color TEXT DEFAULT '#1e40af',
      owner_id TEXT,
      manager_ids TEXT, -- JSON array of user_ids
      initial_purse REAL NOT NULL,
      remaining_purse REAL NOT NULL, -- derived state updated via purse_ledger
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    -- Players / Player Registrations
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      tournament_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL, -- Marquee, Tier-1, Tier-2, Tier-3
      role TEXT NOT NULL, -- Batsman, Bowler, All-Rounder, Wicket-Keeper
      is_foreign INTEGER DEFAULT 0, -- 0 or 1
      country TEXT DEFAULT 'India',
      base_price REAL NOT NULL,
      photo_url TEXT,
      document_url TEXT,
      approval_status TEXT DEFAULT 'pending', -- pending, approved, rejected, changes_requested, suspended
      approval_reason TEXT,
      stats_json TEXT, -- flexible stats (matches, runs, wickets, avg, sr)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Auction Sessions
    CREATE TABLE IF NOT EXISTS auction_sessions (
      id TEXT PRIMARY KEY,
      tournament_id TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'scheduled', -- scheduled, live, paused, completed
      current_lot_id TEXT,
      current_round INTEGER DEFAULT 1,
      timer_seconds INTEGER DEFAULT 30,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    );

    -- Auction Lots
    CREATE TABLE IF NOT EXISTS auction_lots (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      tournament_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      sequence_number INTEGER NOT NULL,
      set_name TEXT DEFAULT 'Set 1 - Marquee',
      status TEXT DEFAULT 'queued', -- queued, live, sold, unsold, passed
      current_highest_bid REAL DEFAULT 0,
      current_bidder_id TEXT, -- franchise_id
      rtm_claimed_by TEXT, -- franchise_id
      sold_price REAL,
      buyer_id TEXT, -- franchise_id
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES auction_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (current_bidder_id) REFERENCES franchises(id),
      FOREIGN KEY (buyer_id) REFERENCES franchises(id)
    );

    -- Bids Log
    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      lot_id TEXT NOT NULL,
      franchise_id TEXT NOT NULL,
      amount REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lot_id) REFERENCES auction_lots(id) ON DELETE CASCADE,
      FOREIGN KEY (franchise_id) REFERENCES franchises(id)
    );

    -- Immutable Purse Ledger
    CREATE TABLE IF NOT EXISTS purse_ledger (
      id TEXT PRIMARY KEY,
      franchise_id TEXT NOT NULL,
      lot_id TEXT,
      transaction_type TEXT NOT NULL, -- initial_credit, bid_deduction, sale_refund, adjustment
      amount REAL NOT NULL, -- negative for deduction, positive for refund/credit
      balance_after REAL NOT NULL,
      note TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (franchise_id) REFERENCES franchises(id) ON DELETE CASCADE
    );

    -- Groups
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    );

    -- Group Teams
    CREATE TABLE IF NOT EXISTS group_teams (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      franchise_id TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (franchise_id) REFERENCES franchises(id) ON DELETE CASCADE
    );

    -- Matches
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      group_id TEXT,
      match_number INTEGER NOT NULL,
      stage TEXT DEFAULT 'Group Stage', -- Group Stage, Quarter Final, Semi Final, Final
      home_team_id TEXT NOT NULL,
      away_team_id TEXT NOT NULL,
      venue TEXT,
      scheduled_time DATETIME,
      status TEXT DEFAULT 'upcoming', -- upcoming, live, completed, abandoned
      toss_winner_id TEXT,
      toss_decision TEXT, -- bat, bowl
      result_summary TEXT,
      winner_team_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (home_team_id) REFERENCES franchises(id),
      FOREIGN KEY (away_team_id) REFERENCES franchises(id)
    );

    -- Match Events (Scoring audit log)
    CREATE TABLE IF NOT EXISTS match_events (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      innings INTEGER NOT NULL,
      event_number INTEGER NOT NULL,
      event_type TEXT NOT NULL, -- ball, wicket, run, boundary, extra, set_point, goal
      payload_json TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );

    -- Points Table
    CREATE TABLE IF NOT EXISTS points_table (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      group_id TEXT,
      franchise_id TEXT NOT NULL,
      played INTEGER DEFAULT 0,
      won INTEGER DEFAULT 0,
      lost INTEGER DEFAULT 0,
      tied INTEGER DEFAULT 0,
      no_result INTEGER DEFAULT 0,
      points INTEGER DEFAULT 0,
      nrr REAL DEFAULT 0.0,
      runs_scored INTEGER DEFAULT 0,
      overs_faced REAL DEFAULT 0.0,
      runs_conceded INTEGER DEFAULT 0,
      overs_bowled REAL DEFAULT 0.0,
      position INTEGER DEFAULT 0,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
      FOREIGN KEY (franchise_id) REFERENCES franchises(id) ON DELETE CASCADE,
      UNIQUE(tournament_id, franchise_id)
    );

    -- Notifications Log
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      tournament_id TEXT,
      user_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
