import { Server, Socket } from 'socket.io';
import { db } from '../db/database';
import { recordPurseTransaction, getFranchisePurse } from '../services/purseLedgerService';
import { v4 as uuidv4 } from 'uuid';

interface ActiveLotState {
  lotId: string;
  tournamentId: string;
  playerId: string;
  playerName: string;
  category: string;
  role: string;
  isForeign: boolean;
  basePrice: number;
  currentBid: number;
  highestBidderId: string | null;
  highestBidderName: string | null;
  highestBidderShort: string | null;
  timer: number;
  isPaused: boolean;
  status: 'queued' | 'live' | 'sold' | 'unsold';
}

let activeAuctionState: ActiveLotState | null = null;
let timerInterval: NodeJS.Timeout | null = null;

export function setupAuctionSocket(io: Server) {
  const auctionRoom = 'auction_room';

  function calculateMinNextBid(currentBid: number, basePrice: number): number {
    if (currentBid === 0) return basePrice;

    // Default ladder
    if (currentBid < 10000000) return currentBid + 1000000;       // < 1 Cr: +10 Lakhs
    if (currentBid < 50000000) return currentBid + 2500000;       // < 5 Cr: +25 Lakhs
    if (currentBid < 100000000) return currentBid + 5000000;      // < 10 Cr: +50 Lakhs
    return currentBid + 10000000;                                 // >= 10 Cr: +1 Cr
  }

  function broadcastState() {
    if (!activeAuctionState) return;

    const minNextBid = calculateMinNextBid(activeAuctionState.currentBid, activeAuctionState.basePrice);
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
        `Purchased ${activeAuctionState.playerName} for ₹${(finalPrice / 10000000).toFixed(2)} Cr (Auto-close)`
      );

      activeAuctionState.status = 'sold';
      broadcastState();

      io.to(auctionRoom).emit('auction:event', {
        type: 'sold',
        message: `⏱ TIMER EXPIRED → SOLD! ${activeAuctionState.playerName} to ${activeAuctionState.highestBidderName} for ₹${(finalPrice / 10000000).toFixed(2)} Cr!`
      });
    } else {
      // No bids at all
      const lotId = activeAuctionState.lotId;
      db.prepare("UPDATE auction_lots SET status = 'unsold' WHERE id = ?").run(lotId);

      activeAuctionState.status = 'unsold';
      broadcastState();

      io.to(auctionRoom).emit('auction:event', {
        type: 'unsold',
        message: `⏱ TIMER EXPIRED — ${activeAuctionState.playerName} goes UNSOLD (no bids).`
      });
    }
  }

  function startTimer() {
    stopTimer();
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
      SELECT al.*, p.name as player_name, p.category, p.role, p.is_foreign, p.base_price, p.photo_url,
             f.name as bidder_name, f.short_name as bidder_short
      FROM auction_lots al
      JOIN players p ON al.player_id = p.id
      LEFT JOIN franchises f ON al.current_bidder_id = f.id
      WHERE al.id = ? OR al.player_id = ?
      LIMIT 1
    `).get(lotIdOrPlayerId, lotIdOrPlayerId) as any;

    if (!lot) throw new Error(`Lot not found for identifier: ${lotIdOrPlayerId}`);

    return {
      lotId: lot.id,
      tournamentId: lot.tournament_id,
      playerId: lot.player_id,
      playerName: lot.player_name,
      category: lot.category,
      role: lot.role,
      isForeign: Boolean(lot.is_foreign),
      basePrice: lot.base_price,
      currentBid: lot.current_highest_bid || 0,
      highestBidderId: lot.current_bidder_id || null,
      highestBidderName: lot.bidder_name || null,
      highestBidderShort: lot.bidder_short || null,
      timer: 30,
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
        const minNextBid = calculateMinNextBid(activeAuctionState.currentBid, activeAuctionState.basePrice);
        socket.emit('auction:state', { ...activeAuctionState, minNextBid });
      } else if (activeAuctionState && activeAuctionState.status === 'live') {
        // Different tournament but there's a live lot - still share state
        const minNextBid = calculateMinNextBid(activeAuctionState.currentBid, activeAuctionState.basePrice);
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
              const minNextBid = calculateMinNextBid(lotState.currentBid, lotState.basePrice);
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
      console.log(`[AuctionEngine] operator:start_lot called for lotId: ${lotId}`);
      try {
        if (!lotId) {
          return socket.emit('auction:error', { message: 'No lot ID provided.' });
        }

        const state = loadLotState(lotId);

        if (state.status === 'sold' || state.status === 'unsold') {
          return socket.emit('auction:error', {
            message: `Cannot restart a lot that is already ${state.status}.`
          });
        }

        state.status = 'live';
        state.timer = 30;
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

        const msg = `🟢 Auction started for ${state.playerName} — Base: ₹${(state.basePrice / 10000000).toFixed(2)} Cr`;
        console.log(`[AuctionEngine] ${msg}`);
        io.to(auctionRoom).emit('auction:event', { type: 'lot_started', message: msg });
      } catch (err: any) {
        console.error('[AuctionEngine] Error in operator:start_lot:', err.message);
        socket.emit('auction:error', { message: err.message });
      }
    });

    // 2. Franchise: Place Bid
    socket.on('bid:place', ({ franchiseId, bidAmount }: { franchiseId: string; bidAmount: number }) => {
      if (!activeAuctionState || activeAuctionState.status !== 'live') {
        return socket.emit('bid:rejected', { reason: 'No active lot currently accepting bids.' });
      }

      if (activeAuctionState.isPaused) {
        return socket.emit('bid:rejected', { reason: 'Auction is currently paused by operator.' });
      }

      // Check duplicate leading bidder
      if (activeAuctionState.highestBidderId === franchiseId) {
        return socket.emit('bid:rejected', { reason: 'Your franchise is already the highest bidder!' });
      }

      // Check min required increment
      // const minRequired = calculateMinNextBid(activeAuctionState.currentBid, activeAuctionState.basePrice);
      // if (bidAmount < minRequired) {
      //   return socket.emit('bid:rejected', { reason: `Bid must be at least ₹${(minRequired / 10000000).toFixed(2)} Cr` });

      if (activeAuctionState.currentBid === 0) {
        if (bidAmount < activeAuctionState.basePrice) {
          return socket.emit('bid:rejected', { reason: `Opening bid must be at least base price of ₹${(activeAuctionState.basePrice / 10000000).toFixed(2)} Cr` });
        }
      } else if (bidAmount <= activeAuctionState.currentBid) {
        return socket.emit('bid:rejected', { reason: 'Bid must be higher than the current bid!' });
      }
      // }

      // Check franchise purse availability & squad rules
      const franchise = db.prepare('SELECT * FROM franchises WHERE id = ?').get(franchiseId) as any;
      if (!franchise) return socket.emit('bid:rejected', { reason: 'Franchise not found.' });

      const purse = getFranchisePurse(franchiseId);
      if (purse.remainingPurse < bidAmount) {
        return socket.emit('bid:rejected', {
          reason: `Insufficient purse! Remaining: ₹${(purse.remainingPurse / 10000000).toFixed(2)} Cr, Required: ₹${(bidAmount / 10000000).toFixed(2)} Cr`
        });
      }

      // Check squad size limits
      const rules = db.prepare('SELECT max_squad, foreign_player_limit FROM tournament_rules WHERE tournament_id = ?').get(activeAuctionState.tournamentId) as any;
      const squadCount = db.prepare("SELECT count(*) as count FROM auction_lots WHERE buyer_id = ? AND status = 'sold'").get(franchiseId) as any;

      if (rules && squadCount.count >= rules.max_squad) {
        return socket.emit('bid:rejected', { reason: `Maximum squad limit of ${rules.max_squad} players reached!` });
      }

      if (activeAuctionState.isForeign && rules) {
        const foreignCount = db.prepare(`
          SELECT count(*) as count FROM auction_lots al
          JOIN players p ON al.player_id = p.id
          WHERE al.buyer_id = ? AND al.status = 'sold' AND p.is_foreign = 1
        `).get(franchiseId) as any;

        if (foreignCount.count >= rules.foreign_player_limit) {
          return socket.emit('bid:rejected', { reason: `Foreign player limit of ${rules.foreign_player_limit} reached!` });
        }
      }

      // Bid is VALID! Record bid in DB and update active state
      const bidId = uuidv4();
      db.prepare(`
        INSERT INTO bids (id, lot_id, franchise_id, amount)
        VALUES (?, ?, ?, ?)
      `).run(bidId, activeAuctionState.lotId, franchiseId, bidAmount);

      db.prepare(`
        UPDATE auction_lots
        SET current_highest_bid = ?, current_bidder_id = ?
        WHERE id = ?
      `).run(bidAmount, franchiseId, activeAuctionState.lotId);

      activeAuctionState.currentBid = bidAmount;
      activeAuctionState.highestBidderId = franchiseId;
      activeAuctionState.highestBidderName = franchise.name;
      activeAuctionState.highestBidderShort = franchise.short_name;
      activeAuctionState.timer = 30; // Reset timer on active bid

      socket.emit('bid:accepted', { amount: bidAmount });
      broadcastState();

      io.to(auctionRoom).emit('auction:event', {
        type: 'new_bid',
        message: `💰 ${franchise.short_name} bid ₹${(bidAmount / 10000000).toFixed(2)} Cr for ${activeAuctionState.playerName}`
      });
    });

    // 3. Operator: Mark Lot SOLD
    socket.on('operator:mark_sold', () => {
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
        `Purchased ${activeAuctionState.playerName} for ₹${(finalPrice / 10000000).toFixed(2)} Cr`
      );

      activeAuctionState.status = 'sold';
      broadcastState();

      io.to(auctionRoom).emit('auction:event', {
        type: 'sold',
        message: `🏏 SOLD! ${activeAuctionState.playerName} → ${activeAuctionState.highestBidderName} for ₹${(finalPrice / 10000000).toFixed(2)} Cr!`
      });
    });

    // 4. Operator: Mark Lot UNSOLD
    socket.on('operator:mark_unsold', () => {
      if (!activeAuctionState || activeAuctionState.status !== 'live') return;

      stopTimer();

      const lotId = activeAuctionState.lotId;
      db.prepare("UPDATE auction_lots SET status = 'unsold' WHERE id = ?").run(lotId);

      activeAuctionState.status = 'unsold';
      broadcastState();

      io.to(auctionRoom).emit('auction:event', {
        type: 'unsold',
        message: `❌ ${activeAuctionState.playerName} goes UNSOLD.`
      });
    });

    // 5. Operator: Pause / Resume Auction
    socket.on('operator:toggle_pause', () => {
      if (!activeAuctionState || activeAuctionState.status !== 'live') return;
      activeAuctionState.isPaused = !activeAuctionState.isPaused;
      broadcastState();
      io.to(auctionRoom).emit('auction:event', {
        type: 'pause_toggled',
        message: activeAuctionState.isPaused ? '⏸ Auction PAUSED by Operator' : '▶️ Auction RESUMED by Operator'
      });
    });

    // 6. Operator: Sale Rollback
    socket.on('operator:rollback_sale', ({ lotId }: { lotId: string }) => {
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
          message: `🔄 Sale ROLLBACK for ${player?.name || 'player'}. ₹${(refundAmount / 10000000).toFixed(2)} Cr refunded.`
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
