import { Server, Socket } from 'socket.io';
import { db } from '../db/database';
import { recordPurseTransaction, getFranchisePurse } from '../services/purseLedgerService';
import { verifyTokenAndGetUser } from '../services/authService';
import { v4 as uuidv4 } from 'uuid';
import { calculateHardSafeLimit, calculateMinimumFutureReserve, parseGroupRules } from '../services/hardSafeLimitCalculator';

interface ActiveLotState {
  lotId: string;
  sessionId: string;
  tournamentId: string;
  playerId: string;
  playerName: string;
  group_name: string;
  role: string;
  isForeign: boolean;
  basePrice: number;
  currentBid: number;
  highestBidderId: string | null;
  highestBidderName: string | null;
  highestBidderShort: string | null;
  highestBidderLogo?: string | null;
  highestBidderOwner?: string | null;
  timer: number;
  timerDuration: number; // full countdown length in seconds; restored to this value on toggle-on / new bid
  timerEnabled: boolean; // when false, no countdown runs and lots must be closed manually by the operator
  isPaused: boolean;
  status: 'queued' | 'live' | 'sold' | 'unsold';
}

let activeAuctionState: ActiveLotState | null = null;
let timerInterval: NodeJS.Timeout | null = null;

function calculateDynamicMaxBid(franchiseId: string, playerGroup: string, remainingPurse: number, tournamentId: string): number {
  // 1. Fetch currently purchased players for this franchise
  const squad = db.prepare(`
    SELECT p.group_name, al.sold_price 
    FROM auction_lots al
    JOIN players p ON al.player_id = p.id
    WHERE al.buyer_id = ? AND al.status = 'sold'
  `).all(franchiseId) as { group_name: string; sold_price: number }[];

  const rules = db.prepare('SELECT max_squad, custom_rules_json FROM tournament_rules WHERE tournament_id = ?').get(tournamentId) as any;
  const customRulesJson = rules?.custom_rules_json;

  if (squad.length >= (rules?.max_squad || 7)) return -1;

  const currentGroupCounts: Record<string, number> = {};
  squad.forEach((p: any) => {
    const g = (p.group_name || '').toUpperCase();
    currentGroupCounts[g] = (currentGroupCounts[g] || 0) + 1;
  });

  const parsedRules = typeof customRulesJson === 'string' ? JSON.parse(customRulesJson) : customRulesJson;
  const groupRules = parsedRules?.group_rules || [
    { group_name: "GROUP A", base_price: 100000, min_players: 2, max_players: 2 },
    { group_name: "GROUP B", base_price: 50000, min_players: 2, max_players: 2 },
    { group_name: "GROUP C", base_price: 25000, min_players: 3, max_players: 3 }
  ];

  const groupRule = groupRules.find((r: any) => r.group_name.toUpperCase() === playerGroup.toUpperCase());
  if (groupRule) {
    const ownedInGroup = currentGroupCounts[playerGroup.toUpperCase()] || 0;
    const maxAllowed = groupRule.max_players ?? groupRule.min_players;
    if (ownedInGroup >= maxAllowed) {
      return -1;
    }
  }

  const result = calculateHardSafeLimit({
    wallet: remainingPurse,
    squad,
    currentPlayerGroup: playerGroup,
    customRulesJson
  });

  if (remainingPurse < result.minimumFutureReserve) {
    return -1;
  }

  return result.hardSafeLimit;
}

// Transaction-safe bid placement helper
const placeBidTransaction = db.transaction((params: {
  franchiseId: string,
  lotId: string,
  bidAmount: number,
  playerGroup: string,
  tournamentId: string
}) => {
  const { franchiseId, lotId, bidAmount, playerGroup, tournamentId } = params;

  const franchise = db.prepare('SELECT * FROM franchises WHERE id = ?').get(franchiseId) as any;
  if (!franchise) {
    return { allowed: false, reasonCode: 'FRANCHISE_NOT_FOUND', message: 'Franchise not found.' };
  }

  const remainingPurse = franchise.remaining_purse;

  const squad = db.prepare(`
    SELECT p.group_name, al.sold_price 
    FROM auction_lots al
    JOIN players p ON al.player_id = p.id
    WHERE al.buyer_id = ? AND al.status = 'sold'
  `).all(franchiseId) as { group_name: string; sold_price: number }[];

  const rules = db.prepare('SELECT max_squad, custom_rules_json FROM tournament_rules WHERE tournament_id = ?').get(tournamentId) as any;
  const maxSquad = rules?.max_squad || 7;
  if (squad.length >= maxSquad) {
    return { allowed: false, reasonCode: 'MAX_SQUAD_LIMIT_REACHED', message: `Maximum squad limit of ${maxSquad} players reached!` };
  }

  const currentGroupCounts: Record<string, number> = {};
  squad.forEach((p: any) => {
    const g = (p.group_name || '').toUpperCase();
    currentGroupCounts[g] = (currentGroupCounts[g] || 0) + 1;
  });

  const parsedRules = typeof rules?.custom_rules_json === 'string' ? JSON.parse(rules.custom_rules_json) : rules?.custom_rules_json;
  const groupRules = parsedRules?.group_rules || [
    { group_name: "GROUP A", base_price: 100000, min_players: 2, max_players: 2 },
    { group_name: "GROUP B", base_price: 50000, min_players: 2, max_players: 2 },
    { group_name: "GROUP C", base_price: 25000, min_players: 3, max_players: 3 }
  ];

  const groupRule = groupRules.find((r: any) => r.group_name.toUpperCase() === playerGroup.toUpperCase());
  if (groupRule) {
    const ownedInGroup = currentGroupCounts[playerGroup.toUpperCase()] || 0;
    const maxAllowed = groupRule.max_players ?? groupRule.min_players;
    if (ownedInGroup >= maxAllowed) {
      return {
        allowed: false,
        reasonCode: 'GROUP_LIMIT_EXCEEDED',
        message: `Bidding blocked: buying this player would violate group limits (Max ${maxAllowed} players allowed for ${playerGroup}).`
      };
    }
  }

  // Global feasibility check (Case 17)
  const availableQuery = db.prepare(`
    SELECT p.group_name, COUNT(*) as cnt
    FROM players p
    JOIN auction_lots al ON p.id = al.player_id
    WHERE p.tournament_id = ? 
      AND p.approval_status = 'approved'
      AND al.status IN ('queued', 'unsold', 'passed')
      AND al.id != ?
    GROUP BY p.group_name
  `);

  const availableRows = availableQuery.all(tournamentId, lotId) as { group_name: string; cnt: number }[];
  const availableCounts: Record<string, number> = {};
  availableRows.forEach(row => {
    availableCounts[row.group_name.toUpperCase()] = row.cnt;
  });

  const franchisesList = db.prepare('SELECT id FROM franchises WHERE tournament_id = ?').all(tournamentId) as { id: string }[];

  for (const rule of groupRules) {
    const gName = rule.group_name.toUpperCase();
    let totalOutstanding = 0;

    for (const f of franchisesList) {
      const fSquad = db.prepare(`
        SELECT p.group_name 
        FROM auction_lots al
        JOIN players p ON al.player_id = p.id
        WHERE al.buyer_id = ? AND al.status = 'sold'
      `).all(f.id) as { group_name: string }[];

      let owned = fSquad.filter(p => (p.group_name || '').toUpperCase() === gName).length;
      if (f.id === franchiseId && gName === playerGroup.toUpperCase()) {
        owned++;
      }

      const needed = Math.max(0, rule.min_players - owned);
      totalOutstanding += needed;
    }

    const available = availableCounts[gName] || 0;
    if (available < totalOutstanding) {
      return {
        allowed: false,
        reasonCode: 'INSUFFICIENT_POOL_PLAYERS',
        message: `Bidding blocked: buying this player would leave the player pool with too few ${gName} players to complete all franchise teams.`
      };
    }
  }

  const result = calculateMinimumFutureReserve(
    { squad, remainingPurse },
    playerGroup,
    { custom_rules_json: rules?.custom_rules_json }
  );

  const hardSafeLimit = result.hardSafeLimit;
  const minimumFutureReserve = result.totalReserve;

  if (remainingPurse < minimumFutureReserve) {
    return {
      allowed: false,
      reasonCode: 'TEAM_COMPLETION_FINANCIAL_RISK',
      message: 'You do not have enough money left to complete your required team composition.',
      requestedBid: bidAmount,
      hardSafeLimit: 0,
      currentWallet: remainingPurse,
      minimumFutureReserve
    };
  }

  if (bidAmount > hardSafeLimit) {
    return {
      allowed: false,
      reasonCode: 'HARD_SAFE_LIMIT_EXCEEDED',
      message: 'Bid exceeds the maximum amount you can safely spend while completing your team.',
      requestedBid: bidAmount,
      hardSafeLimit,
      currentWallet: remainingPurse,
      minimumFutureReserve
    };
  }

  const bidId = uuidv4();
  db.prepare(`
    INSERT INTO bids (id, lot_id, franchise_id, amount)
    VALUES (?, ?, ?, ?)
  `).run(bidId, lotId, franchiseId, bidAmount);

  db.prepare(`
    UPDATE auction_lots
    SET current_highest_bid = ?, current_bidder_id = ?
    WHERE id = ?
  `).run(bidAmount, franchiseId, lotId);

  return {
    allowed: true,
    hardSafeLimit,
    requestedBid: bidAmount,
    currentWallet: remainingPurse,
    futureReserve: minimumFutureReserve,
    franchiseName: franchise.name,
    franchiseShort: franchise.short_name
  };
});

export function setupAuctionSocket(io: Server) {
  const auctionRoom = 'auction_room';

  // Socket Handshake Authentication Middleware
  io.use((socket: Socket, next) => {
    try {
      const rawToken = socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        socket.handshake.query?.token;

      if (!rawToken) {
        // Unauthenticated spectator mode
        (socket as any).user = { role: 'Spectator', id: 'public', name: 'Public Spectator' };
        return next();
      }

      const user = verifyTokenAndGetUser(rawToken as string);
      (socket as any).user = user;
      next();
    } catch (err: any) {
      console.warn(`[AuctionEngine] Socket auth error for socket ${socket.id}: ${err.message}`);
      next(new Error('Authentication failed: Invalid or expired token'));
    }
  });

  function requireRole(socket: Socket, allowedRoles: string[]): boolean {
    const user = (socket as any).user;
    if (!user || !allowedRoles.includes(user.role)) {
      socket.emit('auction:error', {
        message: `403 Forbidden: Access denied. Required role: [${allowedRoles.join(', ')}]. Your role: '${user?.role || 'Guest'}'.`
      });
      return false;
    }
    return true;
  }

  function calculateMinNextBid(currentBid: number, basePrice: number, tournamentId: string): number {
    if (currentBid === 0) return basePrice;

    try {
      const rules = db.prepare('SELECT increment_ladder FROM tournament_rules WHERE tournament_id = ?').get(tournamentId) as any;
      if (rules?.increment_ladder) {
        const ladder = typeof rules.increment_ladder === 'string' ? JSON.parse(rules.increment_ladder) : rules.increment_ladder;
        if (Array.isArray(ladder) && ladder.length > 0) {
          const sorted = [...ladder].sort((x: any, y: any) => x.upto - y.upto);
          for (const step of sorted) {
            if (currentBid < step.upto) {
              return currentBid + step.increment;
            }
          }
          return currentBid + sorted[sorted.length - 1].increment;
        }
      }
    } catch (e) {
      console.error('[AuctionEngine] Failed to parse increment_ladder:', e);
    }

    if (currentBid < 1000) return currentBid + 10;
    if (currentBid < 5000) return currentBid + 25;
    if (currentBid < 10000) return currentBid + 50;
    return currentBid + 100;
  }

  function broadcastState() {
    if (!activeAuctionState) return;

    const minNextBid = calculateMinNextBid(activeAuctionState.currentBid, activeAuctionState.basePrice, activeAuctionState.tournamentId);
    io.to(auctionRoom).emit('auction:state', {
      ...activeAuctionState,
      minNextBid
    });
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Whenever a lot closes (sold or unsold, whether by timer or by operator),
  // reset the session's timer back to ON. This is a fresh default for the NEXT
  // lot only — it does not affect the lot that just closed, and the operator
  // can still turn it back off for the new lot if they want to.
  function resetTimerEnabledForNextLot(sessionId: string | undefined) {
    if (!sessionId) {
      console.warn('[AuctionEngine] Cannot reset timer_enabled — sessionId missing on activeAuctionState.');
      return;
    }
    try {
      db.prepare('UPDATE auction_sessions SET timer_enabled = 1 WHERE id = ?').run(sessionId);

      // Keep in-memory state in sync with the DB write so broadcastState()
      // and any client that (re)joins before the next lot starts see the
      // correct value immediately, instead of a stale value until a
      // fresh loadLotState() or a server restart.
      if (activeAuctionState) {
        activeAuctionState.timerEnabled = true;
      }
    } catch (err: any) {
      console.error('[AuctionEngine] Failed to reset timer_enabled for next lot:', err.message);
    }
  }

  function autoCloseLot() {
    if (!activeAuctionState || activeAuctionState.status !== 'live') return;

    // Auto-close: sold if there is a leading bidder, unsold otherwise
    if (activeAuctionState.highestBidderId && activeAuctionState.currentBid > 0) {
      const lotId = activeAuctionState.lotId;
      const buyerId = activeAuctionState.highestBidderId;
      const finalPrice = activeAuctionState.currentBid;

      db.prepare(`
        UPDATE auction_lots
        SET status = 'sold', sold_price = ?, buyer_id = ?
        WHERE id = ?
      `).run(finalPrice, buyerId, lotId);

      recordPurseTransaction(
        buyerId,
        -finalPrice,
        'bid_deduction',
        lotId,
        `Purchased ${activeAuctionState.playerName} for ₹${finalPrice} rs (Auto-close)`
      );

      activeAuctionState.status = 'sold';
      resetTimerEnabledForNextLot(activeAuctionState.sessionId);
      broadcastState();

      io.to(auctionRoom).emit('auction:event', {
        type: 'sold',
        message: `⏱ TIMER EXPIRED → SOLD! ${activeAuctionState.playerName} to ${activeAuctionState.highestBidderName} for ₹${finalPrice} rs!`
      });
    } else {
      // No bids at all
      const lotId = activeAuctionState.lotId;
      db.prepare("UPDATE auction_lots SET status = 'unsold' WHERE id = ?").run(lotId);

      activeAuctionState.status = 'unsold';
      activeAuctionState.currentBid = 0;
      activeAuctionState.highestBidderId = null;
      activeAuctionState.highestBidderName = null;
      activeAuctionState.highestBidderShort = null;

      resetTimerEnabledForNextLot(activeAuctionState.sessionId);
      broadcastState();

      io.to(auctionRoom).emit('auction:event', {
        type: 'unsold',
        message: `⏱ TIMER EXPIRED — ${activeAuctionState.playerName} goes UNSOLD (no bids).`
      });
    }
  }

  function startTimer() {
    stopTimer();

    // Timer is OFF — do not start a countdown at all. Lots stay live indefinitely
    // until the operator manually marks them sold/unsold.
    if (!activeAuctionState || !activeAuctionState.timerEnabled) {
      return;
    }

    timerInterval = setInterval(() => {
      if (!activeAuctionState || activeAuctionState.status !== 'live' || activeAuctionState.isPaused) {
        return;
      }

      if (activeAuctionState.timer > 0) {
        activeAuctionState.timer -= 1;
        io.to(auctionRoom).emit('auction:timer', { timer: activeAuctionState.timer });
      } else {
        // Timer hit zero — auto close the lot
        stopTimer();
        io.to(auctionRoom).emit('auction:timer_expired', { lotId: activeAuctionState.lotId });
        autoCloseLot();
      }
    }, 1000);
  }

  function loadLotState(lotIdOrPlayerId: string): ActiveLotState {
    console.log('[AuctionEngine] Loading lot state for:', lotIdOrPlayerId);
    const lot = db.prepare(`
      SELECT al.*, p.name as player_name, p.group_name, p.role, p.is_foreign, p.base_price, p.photo_url,
             f.name as bidder_name, f.short_name as bidder_short, f.logo_url as bidder_logo,
             u.name as bidder_owner,
             ases.timer_seconds as session_timer_seconds, ases.timer_enabled as session_timer_enabled
      FROM auction_lots al
      JOIN players p ON al.player_id = p.id
      LEFT JOIN franchises f ON al.current_bidder_id = f.id
      LEFT JOIN users u ON f.owner_id = u.id
      JOIN auction_sessions ases ON ases.id = al.session_id
      WHERE al.id = ? OR al.player_id = ?
      LIMIT 1
    `).get(lotIdOrPlayerId, lotIdOrPlayerId) as any;

    if (!lot) throw new Error(`Lot not found for identifier: ${lotIdOrPlayerId}`);

    const timerDuration = lot.session_timer_seconds || 15;
    // session_timer_enabled is null on rows created before the migration — default to ON
    const timerEnabled = lot.session_timer_enabled === null || lot.session_timer_enabled === undefined
      ? true
      : Boolean(lot.session_timer_enabled);

    return {
      lotId: lot.id,
      sessionId: lot.session_id,
      tournamentId: lot.tournament_id,
      playerId: lot.player_id,
      playerName: lot.player_name,
      group_name: lot.group_name,
      role: lot.role,
      isForeign: Boolean(lot.is_foreign),
      basePrice: lot.base_price,
      currentBid: lot.current_highest_bid || 0,
      highestBidderId: lot.current_bidder_id || null,
      highestBidderName: lot.bidder_name || null,
      highestBidderShort: lot.bidder_short || null,
      highestBidderLogo: lot.bidder_logo || null,
      highestBidderOwner: lot.bidder_owner || null,
      timer: timerDuration,
      timerDuration,
      timerEnabled,
      isPaused: false,
      status: lot.status
    };
  }

  io.on('connection', (socket: Socket) => {
    console.log(`[AuctionEngine] Socket connected: ${socket.id}`);

    socket.on('join:auction', ({ tournamentId }: { tournamentId: string }) => {
      socket.join(auctionRoom);
      console.log(`[AuctionEngine] Socket ${socket.id} joined auction room for tournament: ${tournamentId}`);

      // If active state exists, emit immediately to the joining client
      if (activeAuctionState && activeAuctionState.tournamentId === tournamentId) {
        const minNextBid = calculateMinNextBid(activeAuctionState.currentBid, activeAuctionState.basePrice, activeAuctionState.tournamentId);
        socket.emit('auction:state', { ...activeAuctionState, minNextBid });
      } else if (activeAuctionState && activeAuctionState.status === 'live') {
        // Different tournament but there's a live lot - still share state
        const minNextBid = calculateMinNextBid(activeAuctionState.currentBid, activeAuctionState.basePrice, activeAuctionState.tournamentId);
        socket.emit('auction:state', { ...activeAuctionState, minNextBid });
      } else {
        // Try loading current live or first queued lot from DB
        const session = db.prepare(
          'SELECT current_lot_id FROM auction_sessions WHERE tournament_id = ?'
        ).get(tournamentId) as any;

        if (session && session.current_lot_id) {
          try {
            const lotState = loadLotState(session.current_lot_id);
            if (lotState.status === 'live') {
              activeAuctionState = lotState;
              const minNextBid = calculateMinNextBid(lotState.currentBid, lotState.basePrice, lotState.tournamentId);
              socket.emit('auction:state', { ...lotState, minNextBid });
            }
          } catch (e) {
            console.error('[AuctionEngine] Error loading lot state on join:', e);
          }
        }
      }
    });

    // 1. Operator: Start Lot Bidding
    socket.on('operator:start_lot', ({ lotId }: { lotId: string }) => {
      if (!requireRole(socket, ['Super Admin'])) return;
      console.log(`[AuctionEngine] operator:start_lot called for lotId: ${lotId}`);
      try {
        if (!lotId) {
          return socket.emit('auction:error', { message: 'No lot ID provided.' });
        }

        const state = loadLotState(lotId);

        if (state.status === 'sold') {
          return socket.emit('auction:error', {
            message: `Cannot restart a lot that is already ${state.status}.`
          });
        }

        state.status = 'live';
        state.timer = state.timerDuration;
        state.isPaused = false;
        state.currentBid = 0;
        state.highestBidderId = null;
        state.highestBidderName = null;
        state.highestBidderShort = null;

        db.prepare("UPDATE auction_lots SET status = 'live', current_highest_bid = 0, current_bidder_id = null WHERE id = ?").run(state.lotId);
        db.prepare('UPDATE auction_sessions SET status = \'live\', current_lot_id = ? WHERE tournament_id = ?').run(state.lotId, state.tournamentId);

        activeAuctionState = state;
        startTimer();
        broadcastState();

        const msg = `🟢 Auction started for ${state.playerName} — Base: ₹${state.basePrice} rs`;
        console.log(`[AuctionEngine] ${msg}`);
        io.to(auctionRoom).emit('auction:event', { type: 'lot_started', message: msg });
      } catch (err: any) {
        console.error('[AuctionEngine] Error in operator:start_lot:', err.message);
        socket.emit('auction:error', { message: err.message });
      }
    });

    // 2. Franchise: Place Bid
    socket.on('bid:place', ({ franchiseId, bidAmount }: { franchiseId: string; bidAmount: number }) => {
      if (!requireRole(socket, ['Super Admin', 'Franchise Owner'])) return;

      const socketUser = (socket as any).user;
      if (socketUser.role === 'Franchise Owner' && socketUser.franchise_id && socketUser.franchise_id !== franchiseId) {
        return socket.emit('bid:rejected', {
          allowed: false,
          reasonCode: 'FORBIDDEN',
          message: `403 Forbidden: You can only place bids on behalf of your assigned franchise.`
        });
      }
      if (!activeAuctionState || activeAuctionState.status !== 'live') {
        return socket.emit('bid:rejected', {
          allowed: false,
          reasonCode: 'LOT_NOT_LIVE',
          message: 'No active lot currently accepting bids.'
        });
      }

      if (activeAuctionState.isPaused) {
        return socket.emit('bid:rejected', {
          allowed: false,
          reasonCode: 'AUCTION_PAUSED',
          message: 'Auction is currently paused by operator.'
        });
      }

      // Check duplicate leading bidder
      if (activeAuctionState.highestBidderId === franchiseId) {
        return socket.emit('bid:rejected', {
          allowed: false,
          reasonCode: 'ALREADY_LEADING',
          message: 'Your franchise is already the highest bidder!'
        });
      }

      // Check min required increments
      if (activeAuctionState.currentBid === 0) {
        if (bidAmount < activeAuctionState.basePrice) {
          return socket.emit('bid:rejected', {
            allowed: false,
            reasonCode: 'BID_BELOW_BASE',
            message: `Opening bid must be at least base price of ₹${activeAuctionState.basePrice} rs`
          });
        }
      } else if (bidAmount <= activeAuctionState.currentBid) {
        return socket.emit('bid:rejected', {
          allowed: false,
          reasonCode: 'BID_NOT_HIGHER',
          message: 'Bid must be higher than the current bid!'
        });
      }

      // Run transactional evaluation & execution
      const txnResult = placeBidTransaction({
        franchiseId,
        lotId: activeAuctionState.lotId,
        bidAmount,
        playerGroup: activeAuctionState.group_name,
        tournamentId: activeAuctionState.tournamentId
      });

      if (!txnResult.allowed) {
        return socket.emit('bid:rejected', txnResult);
      }

      // Success! Update memory state
      const franDetails = db.prepare(`
        SELECT f.logo_url, u.name as owner_name
        FROM franchises f
        LEFT JOIN users u ON f.owner_id = u.id
        WHERE f.id = ?
      `).get(franchiseId) as any;

      activeAuctionState.currentBid = bidAmount;
      activeAuctionState.highestBidderId = franchiseId;
      activeAuctionState.highestBidderName = txnResult.franchiseName;
      activeAuctionState.highestBidderShort = txnResult.franchiseShort;
      activeAuctionState.highestBidderLogo = franDetails?.logo_url || null;
      activeAuctionState.highestBidderOwner = franDetails?.owner_name || null;
      if (activeAuctionState.timerEnabled) {
        activeAuctionState.timer = activeAuctionState.timerDuration;
      }

      socket.emit('bid:accepted', {
        allowed: true,
        hardSafeLimit: txnResult.hardSafeLimit,
        requestedBid: bidAmount,
        currentWallet: txnResult.currentWallet,
        futureReserve: txnResult.futureReserve
      });

      broadcastState();

      io.to(auctionRoom).emit('auction:event', {
        type: 'new_bid',
        message: `💰 ${txnResult.franchiseShort} bid ₹${bidAmount} rs for ${activeAuctionState.playerName}`
      });
    });

    // 3. Operator: Mark Lot SOLD
    socket.on('operator:mark_sold', () => {
      if (!requireRole(socket, ['Super Admin'])) return;
      if (!activeAuctionState || activeAuctionState.status !== 'live') return;

      if (!activeAuctionState.highestBidderId || activeAuctionState.currentBid === 0) {
        return socket.emit('auction:error', { message: 'Cannot mark sold without any bids. Mark unsold instead.' });
      }

      stopTimer();

      const lotId = activeAuctionState.lotId;
      const buyerId = activeAuctionState.highestBidderId;
      const finalPrice = activeAuctionState.currentBid;

      db.prepare(`
        UPDATE auction_lots
        SET status = 'sold', sold_price = ?, buyer_id = ?
        WHERE id = ?
      `).run(finalPrice, buyerId, lotId);

      // Record immutable ledger deduction
      recordPurseTransaction(
        buyerId,
        -finalPrice,
        'bid_deduction',
        lotId,
        `Purchased ${activeAuctionState.playerName} for ₹${finalPrice} rs`
      );

      activeAuctionState.status = 'sold';
      resetTimerEnabledForNextLot(activeAuctionState.sessionId);
      broadcastState();

      io.to(auctionRoom).emit('auction:event', {
        type: 'sold',
        message: `🏏 SOLD! ${activeAuctionState.playerName} → ${activeAuctionState.highestBidderName} for ₹${finalPrice} rs!`
      });
    });

    // 4. Operator: Mark Lot UNSOLD
    socket.on('operator:mark_unsold', () => {
      if (!requireRole(socket, ['Super Admin'])) return;
      if (!activeAuctionState || activeAuctionState.status !== 'live') return;

      stopTimer();

      const lotId = activeAuctionState.lotId;
      db.prepare(
        "UPDATE auction_lots SET status = 'unsold', current_highest_bid = 0, current_bidder_id = null WHERE id = ?"
      ).run(lotId);

      activeAuctionState.status = 'unsold';
      activeAuctionState.currentBid = 0;
      activeAuctionState.highestBidderId = null;
      activeAuctionState.highestBidderName = null;
      activeAuctionState.highestBidderShort = null;

      resetTimerEnabledForNextLot(activeAuctionState.sessionId);
      broadcastState();

      io.to(auctionRoom).emit('auction:event', {
        type: 'unsold',
        message: `❌ ${activeAuctionState.playerName} goes UNSOLD.`
      });
    });

    // 5. Operator: Pause / Resume Auction
    socket.on('operator:toggle_pause', () => {
      if (!requireRole(socket, ['Super Admin'])) return;
      if (!activeAuctionState || activeAuctionState.status !== 'live') return;
      activeAuctionState.isPaused = !activeAuctionState.isPaused;
      broadcastState();
      io.to(auctionRoom).emit('auction:event', {
        type: 'pause_toggled',
        message: activeAuctionState.isPaused ? '⏸ Auction PAUSED by Operator' : '▶️ Auction RESUMED by Operator'
      });
    });

    // 6. Operator: Toggle Auction Timer ON/OFF
    socket.on('operator:toggle_timer', () => {
      if (!requireRole(socket, ['Super Admin'])) return;
      console.log('[AuctionEngine] operator:toggle_timer received. Current state:', {
        hasActiveState: !!activeAuctionState,
        status: activeAuctionState?.status,
        sessionId: activeAuctionState?.sessionId,
        timerEnabledBefore: activeAuctionState?.timerEnabled
      });

      if (!activeAuctionState || activeAuctionState.status !== 'live') {
        console.warn('[AuctionEngine] toggle_timer ignored — no live lot in memory.');
        return;
      }

      try {
        activeAuctionState.timerEnabled = !activeAuctionState.timerEnabled;

        // Persist the preference on the session so it carries over to the next lot / server restart
        if (activeAuctionState.sessionId) {
          db.prepare('UPDATE auction_sessions SET timer_enabled = ? WHERE id = ?')
            .run(activeAuctionState.timerEnabled ? 1 : 0, activeAuctionState.sessionId);
        } else {
          console.warn('[AuctionEngine] activeAuctionState.sessionId is missing — skipping DB persist. This usually means the server is running stale in-memory state from before a restart.');
        }

        if (activeAuctionState.timerEnabled) {
          // Resume with a fresh full countdown rather than whatever stale value was left over
          activeAuctionState.timer = activeAuctionState.timerDuration;
          startTimer();
        } else {
          // Fully OFF: no interval runs, no timer_expired event, no auto-close.
          // The lot stays live until the operator manually marks it sold/unsold.
          stopTimer();
        }

        broadcastState();

        io.to(auctionRoom).emit('auction:event', {
          type: 'timer_toggled',
          message: activeAuctionState.timerEnabled
            ? '⏱ Auction TIMER ENABLED by Operator'
            : '🚫 Auction TIMER DISABLED by Operator — lots must be closed manually'
        });

        console.log('[AuctionEngine] Timer toggled. New timerEnabled:', activeAuctionState.timerEnabled);
      } catch (err: any) {
        console.error('[AuctionEngine] Error in operator:toggle_timer:', err.message);
        socket.emit('auction:error', { message: `Failed to toggle timer: ${err.message}` });
      }
    });

    // 7. Operator: Update Timer Settings (persists to DB, syncs in-memory state)
    socket.on('operator:update_timer_seconds', ({ tournamentId, seconds, timerEnabled }: { tournamentId: string; seconds?: number; timerEnabled?: boolean }) => {
      if (!requireRole(socket, ['Super Admin'])) return;
      try {
        if (seconds !== undefined && seconds <= 0 && timerEnabled !== false) {
          return socket.emit('auction:error', { message: 'Invalid timer duration.' });
        }

        const session = db.prepare('SELECT id FROM auction_sessions WHERE tournament_id = ?').get(tournamentId) as any;
        if (!session) {
          return socket.emit('auction:error', { message: 'No active auction session found for this tournament.' });
        }

        if (typeof timerEnabled === 'boolean') {
          db.prepare('UPDATE auction_sessions SET timer_enabled = ? WHERE id = ?').run(timerEnabled ? 1 : 0, session.id);
          if (activeAuctionState && activeAuctionState.sessionId === session.id) {
            activeAuctionState.timerEnabled = timerEnabled;
            if (timerEnabled) {
              if (activeAuctionState.status === 'live' && !activeAuctionState.isPaused) {
                if (seconds) activeAuctionState.timer = seconds;
                startTimer();
              }
            } else {
              stopTimer();
            }
          }
        }

        if (seconds && seconds > 0) {
          db.prepare('UPDATE auction_sessions SET timer_seconds = ? WHERE id = ?').run(seconds, session.id);
          if (activeAuctionState && activeAuctionState.sessionId === session.id) {
            activeAuctionState.timerDuration = seconds;
            if (activeAuctionState.status !== 'live') {
              activeAuctionState.timer = seconds;
            }
          }
        }

        if (activeAuctionState && activeAuctionState.sessionId === session.id) {
          broadcastState();
        }

        socket.emit('auction:timer_seconds_updated', { seconds: seconds || 15, timerEnabled });
      } catch (err: any) {
        console.error('[AuctionEngine] Error in operator:update_timer_seconds:', err.message);
        socket.emit('auction:error', { message: err.message });
      }
    });

    // 8. Operator: Sale Rollback
    socket.on('operator:rollback_sale', ({ lotId }: { lotId: string }) => {
      if (!requireRole(socket, ['Super Admin'])) return;
      try {
        const lot = db.prepare('SELECT * FROM auction_lots WHERE id = ?').get(lotId) as any;
        if (!lot || lot.status !== 'sold') {
          return socket.emit('auction:error', { message: 'Lot is not in sold status.' });
        }

        const buyerId = lot.buyer_id;
        const refundAmount = lot.sold_price;
        const player = db.prepare('SELECT name FROM players WHERE id = ?').get(lot.player_id) as any;

        // Reset lot state in DB
        db.prepare("UPDATE auction_lots SET status = 'queued', current_highest_bid = 0, current_bidder_id = null, sold_price = null, buyer_id = null WHERE id = ?").run(lotId);

        // Record compensating refund in ledger
        recordPurseTransaction(
          buyerId,
          refundAmount,
          'sale_refund',
          lotId,
          `Rollback sale refund for ${player?.name || 'player'}`
        );

        io.to(auctionRoom).emit('auction:event', {
          type: 'rollback',
          message: `🔄 Sale ROLLBACK for ${player?.name || 'player'}. ₹${refundAmount} rs refunded.`
        });
      } catch (err: any) {
        console.error('[AuctionEngine] Error in operator:rollback_sale:', err.message);
        socket.emit('auction:error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[AuctionEngine] Socket disconnected: ${socket.id}`);
    });
  });
}