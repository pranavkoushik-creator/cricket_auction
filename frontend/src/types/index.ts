export type UserRole =
  | 'Super Admin'
  | 'Franchise Owner'
  | 'Player';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role?: UserRole;
  franchise_id?: string;
  franchise_name?: string;
  franchise_short?: string;
  rules_accepted_at?: string | null;
  roles?: { tournament_id: string; role: UserRole }[];
}

export interface TournamentRules {
  id: string;
  tournament_id: string;
  purse_budget: number;
  min_squad: number;
  max_squad: number;
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
  group_name: string;
  role?: string;
  is_foreign: number;
  status: string;
  photo_url?: string;
  sold_price: number;
  base_price?: number;
  is_captain?: number;
}

export interface Player {
  id: string;
  tournament_id: string;
  user_id?: string;
  name: string;
  group_name: string;
  role?: string;
  is_foreign: number;
  status: string;
  base_price: number;
  approval_status: 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'suspended';
  approval_reason?: string;
  photo_url?: string;
  document_url?: string;
  is_captain?: number;
  stats?: {
    Innings?: number;
    Runs?: number;
    "Strike Rate"?: number;
    Wickets?: number;
  };
  lot_status?: string;
  sold_price?: number;
  buyer_name?: string;
  buyer_short?: string;
}

export interface ActiveAuctionState {
  lotId: string;
  sessionId: string;
  tournamentId: string;
  playerId: string;
  playerName: string;
  group_name: string;
  role?: string;
  isForeign: boolean;
  basePrice: number;
  currentBid: number;
  minNextBid: number;
  photoUrl?: string;
  stats?: {
    Innings?: number;
    Runs?: number;
    "Strike Rate"?: number;
    Wickets?: number;
  } | null;
  highestBidderId: string | null;
  highestBidderName: string | null;
  highestBidderShort: string | null;
  highestBidderLogo?: string | null;
  highestBidderOwner?: string | null;
  timer: number;
  timerDuration: number;
  timerEnabled: boolean;
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

// ---------------------------------------------------------------------------
// LIVE MATCH BROADCAST
// Mirrors the payloads produced by backend/src/services/liveMatchService.ts.
// ---------------------------------------------------------------------------

export type DismissalType = 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket';
export type ExtraType = 'wide' | 'no_ball' | 'bye' | 'leg_bye';
export type BatterStatus = 'did_not_bat' | 'batting' | 'out' | 'not_out';

export interface TeamBrand {
  id: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  owner_name: string | null;
}

export interface BattingCard {
  player_id: string;
  name: string;
  photo_url: string | null;
  batting_position: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strike_rate: number;
  status: BatterStatus;
  dismissal_type: DismissalType | null;
  dismissal_bowler_name: string | null;
  is_striker: boolean;
  is_non_striker: boolean;
}

export interface BowlingCard {
  player_id: string;
  name: string;
  photo_url: string | null;
  overs: string;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
  economy: number;
  is_current: boolean;
}

export interface FallOfWicket {
  order: number;
  player_id: string;
  name: string;
  score: number;
  overs: string;
}

export interface InningsSummary {
  innings_number: number;
  batting_team: TeamBrand;
  bowling_team: TeamBrand;
  runs: number;
  wickets: number;
  balls: number;
  overs: string;
  extras: number;
  run_rate: number;
  target: number | null;
  status: 'in_progress' | 'completed';
}

export interface OverBall {
  ball: number;
  label: string;
  runs: number;
  isWicket: boolean;
  extraType: ExtraType | null;
}

export interface OverGroup {
  over_number: number;
  balls: OverBall[];
  runs: number;
  wickets: number;
}

export interface LiveMatchState {
  match_id: string;
  match_number: number;
  stage: string;
  venue: string | null;
  status: 'upcoming' | 'live' | 'completed' | 'abandoned';
  overs_limit: number;
  current_innings: number;
  home_team: TeamBrand;
  away_team: TeamBrand;
  innings: InningsSummary | null;
  all_innings: InningsSummary[];
  batting: BattingCard[];
  bowling: BowlingCard[];
  striker: BattingCard | null;
  non_striker: BattingCard | null;
  current_bowler: BowlingCard | null;
  this_over: OverBall[];
  recent_overs: OverGroup[];
  fall_of_wickets: FallOfWicket[];
  runs_required: number | null;
  balls_remaining: number | null;
  required_run_rate: number | null;
  result_summary: string | null;
  winner_team_id: string | null;
  recent_events: { id: string; event_number: number; label: string; timestamp: string }[];
}

export interface MatchSquadPlayer {
  id: string;
  name: string;
  photo_url: string | null;
  group_name: string;
  is_captain: number;
  stats_json: string | null;
}

export interface MatchSquads {
  home: { team: TeamBrand; players: MatchSquadPlayer[] };
  away: { team: TeamBrand; players: MatchSquadPlayer[] };
}

export interface BroadcastMatchListItem {
  id: string;
  match_number: number;
  stage: string;
  venue: string | null;
  status: 'upcoming' | 'live' | 'completed' | 'abandoned';
  result_summary: string | null;
  home_team_name: string;
  home_team_short: string;
  home_team_logo: string | null;
  home_team_color: string;
  away_team_name: string;
  away_team_short: string;
  away_team_logo: string | null;
  away_team_color: string;
}

export interface MatchFeedEntry {
  type: string;
  message: string;
  timestamp: string;
}

export interface BallInputPayload {
  runs: number;
  extraType?: ExtraType | null;
  isWicket?: boolean;
  dismissalType?: DismissalType | null;
  dismissedPlayerId?: string | null;
  /** Run outs only: had the batsmen crossed on the incomplete run? */
  batsmenCrossed?: boolean;
}
