export type UserRole = 
  | 'Super Admin'
  | 'Tournament Admin'
  | 'Auction Operator'
  | 'Franchise Owner'
  | 'Franchise Manager'
  | 'Player'
  | 'Scorer'
  | 'Spectator';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  roles?: { tournament_id: string; role: UserRole }[];
}

export interface TournamentRules {
  id: string;
  tournament_id: string;
  purse_budget: number;
  min_squad: number;
  max_squad: number;
  foreign_player_limit: number;
  rtm_count_per_team: number;
  base_price_tiers: number[];
  increment_ladder: { upto: number; increment: number }[];
}

export interface Tournament {
  id: string;
  name: string;
  sport: string;
  format: string;
  dates: string;
  status: 'draft' | 'active' | 'in_progress' | 'completed' | 'archived';
  logo_url?: string;
  rules?: TournamentRules;
}

export interface PurseLedgerEntry {
  id: string;
  franchise_id: string;
  lot_id?: string;
  transaction_type: 'initial_credit' | 'bid_deduction' | 'sale_refund' | 'adjustment';
  amount: number;
  balance_after: number;
  note?: string;
  timestamp: string;
  player_name?: string;
}

export interface Franchise {
  id: string;
  tournament_id: string;
  name: string;
  short_name: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  owner_id?: string;
  owner_name?: string;
  initial_purse: number;
  remaining_purse: number;
  total_spent?: number;
  total_players?: number;
  foreign_players?: number;
  squad?: SquadPlayer[];
  ledger?: PurseLedgerEntry[];
}

export interface SquadPlayer {
  id: string;
  player_id: string;
  name: string;
  category: string;
  role: string;
  is_foreign: number;
  country: string;
  photo_url?: string;
  sold_price: number;
  base_price?: number;
}

export interface Player {
  id: string;
  tournament_id: string;
  user_id?: string;
  name: string;
  category: string;
  role: string;
  is_foreign: number;
  country: string;
  base_price: number;
  approval_status: 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'suspended';
  approval_reason?: string;
  photo_url?: string;
  document_url?: string;
  stats?: {
    matches?: number;
    runs?: number;
    wickets?: number;
    avg?: number;
    sr?: number;
    economy?: number;
  };
  lot_status?: string;
  sold_price?: number;
  buyer_name?: string;
  buyer_short?: string;
}

export interface ActiveAuctionState {
  lotId: string;
  tournamentId: string;
  playerId: string;
  playerName: string;
  category: string;
  role: string;
  isForeign: boolean;
  basePrice: number;
  currentBid: number;
  minNextBid: number;
  highestBidderId: string | null;
  highestBidderName: string | null;
  highestBidderShort: string | null;
  timer: number;
  isPaused: boolean;
  status: 'queued' | 'live' | 'sold' | 'unsold';
}

export interface Match {
  id: string;
  tournament_id: string;
  match_number: number;
  stage: string;
  home_team_id: string;
  home_team_name: string;
  home_team_short: string;
  home_team_logo?: string;
  home_team_color: string;
  away_team_id: string;
  away_team_name: string;
  away_team_short: string;
  away_team_logo?: string;
  away_team_color: string;
  venue: string;
  scheduled_time: string;
  status: 'upcoming' | 'live' | 'completed' | 'abandoned';
  result_summary?: string;
  winner_team_id?: string;
  winner_team_name?: string;
  events?: MatchEvent[];
}

export interface MatchEvent {
  id: string;
  match_id: string;
  innings: number;
  event_number: number;
  event_type: string;
  payload: any;
  timestamp: string;
}

export interface PointsTableEntry {
  id: string;
  tournament_id: string;
  franchise_id: string;
  franchise_name: string;
  franchise_short: string;
  franchise_logo?: string;
  primary_color: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  points: number;
  nrr: number;
  position: number;
}
