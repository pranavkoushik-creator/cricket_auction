import React, { useEffect, useState, useMemo } from 'react';
import { useAuctionSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { formatCurrency, getPhotoUrl } from '../utils/formatters';
import { Clock, TimerOff, AlertTriangle, CheckCircle2, Flame, Users, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';

export const LiveAuctionBiddingView: React.FC = () => {
  const { currentTournamentId, selectedFranchiseId, setSelectedFranchiseId, currentRole, user } = useAuth();
  const isFranchiseOwner = currentRole === 'Franchise Owner';
  const { auctionState, bidError, placeBid, eventsLog, socket } = useAuctionSocket();

  const [franchises, setFranchises] = useState<any[]>([]);
  const [currentFranchise, setCurrentFranchise] = useState<any>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [rosterFilter, setRosterFilter] = useState<'ALL' | 'GROUP A' | 'GROUP B' | 'GROUP C'>('ALL');
  const [hoveredBidAmount, setHoveredBidAmount] = useState<number | null>(null);

  const { countA, countB, countC, filteredSquad } = useMemo(() => {
    const squad = currentFranchise?.squad || [];
    let a = 0, b = 0, c = 0;
    squad.forEach((p: any) => {
      const g = (p.group_name || '').toUpperCase();
      if (g === 'GROUP A') a++;
      else if (g === 'GROUP B') b++;
      else if (g === 'GROUP C') c++;
    });

    const filtered = rosterFilter === 'ALL'
      ? squad
      : squad.filter((p: any) => (p.group_name || '').toUpperCase() === rosterFilter);

    return { countA: a, countB: b, countC: c, filteredSquad: filtered };
  }, [currentFranchise?.squad, rosterFilter]);

  const fetchFranchiseData = () => {
    apiRequest(`/franchises?tournamentId=${currentTournamentId}`)
      .then(res => {
        const sorted = [...res];
        if (user?.franchise_id) {
          sorted.sort((a, b) => {
            if (a.id === user.franchise_id) return -1;
            if (b.id === user.franchise_id) return 1;
            return 0;
          });
        }
        setFranchises(sorted);
        // If Franchise Owner, strictly pick their assigned franchise
        const ownerFranchiseId = isFranchiseOwner && user?.franchise_id ? user.franchise_id : selectedFranchiseId;
        const active = sorted.find((f: any) => f.id === ownerFranchiseId) || sorted[0];
        if (active) {
          setCurrentFranchise(active);
          if (selectedFranchiseId !== active.id) setSelectedFranchiseId(active.id);
        }
      })
      .catch(console.error);
  };

  const lastRollbackTime = eventsLog.find(e => e.type === 'rollback')?.timestamp || '';

  useEffect(() => {
    fetchFranchiseData();
    apiRequest(`/tournaments/${currentTournamentId}`)
      .then(setTournament)
      .catch(console.error);
  }, [currentTournamentId, selectedFranchiseId, auctionState?.currentBid, auctionState?.status, user?.franchise_id, lastRollbackTime]);

  // Trigger confetti on winning sale
  useEffect(() => {
    if (auctionState?.status === 'sold' && auctionState.highestBidderId === selectedFranchiseId) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  }, [auctionState?.status]);

  // Listen for franchise bidding toggles in real-time
  useEffect(() => {
    if (!socket) return;
    const handleToggle = () => {
      fetchFranchiseData();
    };
    socket.on('franchise:bidding_toggle', handleToggle);
    socket.on('franchise:bidding_toggle_all', handleToggle);
    return () => {
      socket.off('franchise:bidding_toggle', handleToggle);
      socket.off('franchise:bidding_toggle_all', handleToggle);
    };
  }, [socket]);

  const { dynamicMaxBid, minimumFutureReserve } = useMemo(() => {
    if (!auctionState || auctionState.status !== 'live' || !currentFranchise || !currentFranchise.squad || currentFranchise.is_bidding_enabled === 0) {
      return { dynamicMaxBid: -1, minimumFutureReserve: 0 };
    }

    const squad = currentFranchise.squad;
    const remainingPurse = currentFranchise.remaining_purse;
    const activeGroup = (auctionState.group_name || '').toUpperCase();

    // Group counts
    const currentGroupCounts: Record<string, number> = {};
    squad.forEach((p: any) => {
      const g = (p.group_name || '').toUpperCase();
      currentGroupCounts[g] = (currentGroupCounts[g] || 0) + 1;
    });

    // Check squad size limit
    if (squad.length >= 7) {
      return { dynamicMaxBid: -1, minimumFutureReserve: 0 };
    }

    // Load group rules from tournament
    let groupRules = [
      { group_name: "GROUP A", base_price: 100000, min_players: 2, max_players: 2 },
      { group_name: "GROUP B", base_price: 50000, min_players: 2, max_players: 3 },
      { group_name: "GROUP C", base_price: 25000, min_players: 2, max_players: 3 }
    ];

    try {
      if (tournament?.rules?.custom_rules_json) {
        const parsed = typeof tournament.rules.custom_rules_json === 'string'
          ? JSON.parse(tournament.rules.custom_rules_json)
          : tournament.rules.custom_rules_json;
        if (parsed?.group_rules) {
          groupRules = parsed.group_rules;
        }
      }
    } catch (e) {
      console.error('Failed to parse group rules on frontend:', e);
    }

    // Check group eligibility (Case 3)
    const activeRule = groupRules.find(r => r.group_name.toUpperCase() === activeGroup);
    if (activeRule) {
      const ownedInGroup = currentGroupCounts[activeGroup] || 0;
      const maxAllowed = activeRule.max_players ?? activeRule.min_players;
      if (ownedInGroup >= maxAllowed) {
        return { dynamicMaxBid: -1, minimumFutureReserve: 0 };
      }
    }

    // Hypothetical counts after purchase
    const hypotheticalCounts = { ...currentGroupCounts };
    hypotheticalCounts[activeGroup] = (hypotheticalCounts[activeGroup] || 0) + 1;

    // Calculate future reserve using optimized math to fill remaining slots to reach 7 players
    const ruleA = groupRules.find(r => r.group_name.toUpperCase() === 'GROUP A') || { base_price: 100000, min_players: 2, max_players: 2 };
    const ruleB = groupRules.find(r => r.group_name.toUpperCase() === 'GROUP B') || { base_price: 50000, min_players: 2, max_players: 3 };
    const ruleC = groupRules.find(r => r.group_name.toUpperCase() === 'GROUP C') || { base_price: 25000, min_players: 2, max_players: 3 };

    const a_hyp = hypotheticalCounts['GROUP A'] || 0;
    const b_hyp = hypotheticalCounts['GROUP B'] || 0;
    const c_hyp = hypotheticalCounts['GROUP C'] || 0;

    const a_needed = Math.max(0, ruleA.min_players - a_hyp);
    const b_needed = Math.max(0, ruleB.min_players - b_hyp);
    const c_needed = Math.max(0, ruleC.min_players - c_hyp);

    let a_reserve = a_needed * ruleA.base_price;
    let b_reserve = b_needed * ruleB.base_price;
    let c_reserve = c_needed * ruleC.base_price;

    let total_hyp = a_hyp + b_hyp + c_hyp;
    let slotsToFill = Math.max(0, 7 - total_hyp);
    let extraSlots = Math.max(0, slotsToFill - (a_needed + b_needed + c_needed));

    if (extraSlots > 0) {
      const maxGroupCExtra = Math.max(0, (ruleC.max_players || 3) - (c_hyp + c_needed));
      const cExtra = Math.min(extraSlots, maxGroupCExtra);
      const bExtra = extraSlots - cExtra;

      c_reserve += cExtra * ruleC.base_price;
      b_reserve += bExtra * ruleB.base_price;
    }

    let totalReserve = a_reserve + b_reserve + c_reserve;
    const hardSafeLimit = Math.max(0, remainingPurse - totalReserve);

    return {
      dynamicMaxBid: hardSafeLimit,
      minimumFutureReserve: totalReserve
    };
  }, [auctionState, currentFranchise, tournament]);

  const bidIncrements = useMemo(() => {
    let increments = [5000, 10000, 25000]; // Fallback defaults without 50000
    try {
      if (tournament?.rules?.custom_rules_json) {
        const parsed = typeof tournament.rules.custom_rules_json === 'string'
          ? JSON.parse(tournament.rules.custom_rules_json)
          : tournament.rules.custom_rules_json;
        if (parsed?.bid_increments) {
          increments = parsed.bid_increments.map(Number);
        }
      }
    } catch (e) {
      console.error('Failed to parse bid increments:', e);
    }
    return increments.filter(inc => inc !== 50000);
  }, [tournament]);

  if (franchises.length === 0) {
    return (
      <div className="glass-panel p-10 rounded-2xl border border-gray-800 text-center space-y-4 max-w-2xl mx-auto">
        <Users className="w-16 h-16 text-blue-500 mx-auto opacity-70 animate-pulse" />
        <h3 className="text-lg font-bold text-white">No Franchises Registered</h3>
        <p className="text-sm text-gray-400">
          There are no franchises registered in this tournament yet. Please contact the Super Admin to register franchises and owners.
        </p>
      </div>
    );
  }

  if (!currentFranchise) return <div className="p-8 text-center text-gray-400">Loading franchise bidding dashboard...</div>;

  const isLeading = auctionState?.highestBidderId === currentFranchise.id;
  const minNextBid = auctionState ? (auctionState.minNextBid || auctionState.basePrice) : 0;
  // Base amount to use for manual increment buttons — the actual current bid (not the engine's pre-bumped minNextBid)
  const currentBidBase = auctionState ? (auctionState.currentBid || auctionState.basePrice) : 0;

  return (
    <div className="space-y-6">
      {/* Franchise Selector Header Bar */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-blue-500/30">
        <div className="flex items-center space-x-4">
          <img
            src={currentFranchise.logo_url}
            alt={currentFranchise.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-blue-500 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400">Bidding as Franchise:</span>
              {isFranchiseOwner ? (
                <span className="bg-blue-900/60 text-xs font-black text-yellow-400 border border-blue-500/40 rounded-lg px-3 py-1 flex items-center gap-1.5">
                  <span>{currentFranchise.name} ({currentFranchise.short_name})</span>
                  <span className="text-[10px] text-blue-300 font-bold bg-blue-500/30 px-1.5 py-0.5 rounded uppercase">Verified Owner</span>
                </span>
              ) : (
                <select
                  value={currentFranchise.id}
                  onChange={e => setSelectedFranchiseId(e.target.value)}
                  className="bg-gray-900 text-xs font-bold text-yellow-400 border border-gray-700 rounded-lg px-2.5 py-1 focus:outline-none focus:border-yellow-500"
                >
                  {franchises.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.short_name})</option>
                  ))}
                </select>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-white mt-0.5">{currentFranchise.name}</h2>
          </div>
        </div>

        {/* Live Purse Tracker Bar */}
        <div className="flex flex-wrap items-center gap-4 bg-gray-900/80 px-4 py-2.5 rounded-xl border border-gray-800">
          <div className="text-right">
            <p className="text-[11px] font-semibold text-gray-400 text-left">REMAINING PURSE</p>
            <p className="text-xl font-black text-emerald-400">{formatCurrency(currentFranchise.remaining_purse)}</p>
          </div>
          <div className="h-8 w-px bg-gray-800 hidden sm:block" />
          <div className="text-right">
            <p className="text-[11px] font-semibold text-gray-400 text-left">MIN FUTURE RESERVE</p>
            <p className="text-sm font-bold text-yellow-400">{formatCurrency(minimumFutureReserve)}</p>
          </div>
          <div className="h-8 w-px bg-gray-800 hidden sm:block" />
          <div className="text-right">
            <p className="text-[11px] font-semibold text-gray-400 text-left">HARD SAFE LIMIT</p>
            <p className="text-sm font-bold text-cyan-400">{dynamicMaxBid === -1 ? 'BLOCKED' : formatCurrency(dynamicMaxBid)}</p>
          </div>
          <div className="h-8 w-px bg-gray-800" />
          <div className="text-right">
            <p className="text-[11px] font-semibold text-gray-400 text-left">SQUAD SIZE</p>
            <p className="text-sm font-bold text-white">
              {currentFranchise.squad?.length || 0} / 7
            </p>
          </div>
        </div>
      </div>

      {/* Bid Error Toast Alert */}
      {bidError && (
        <div className="glass-card p-4 rounded-xl border-2 border-red-500 bg-red-950/60 text-red-200 flex items-center gap-3 animate-bounce">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
          <div>
            <p className="font-bold text-xs">BID REJECTED BY ENGINE</p>
            <p className="text-xs text-red-300 font-medium">{bidError}</p>
          </div>
        </div>
      )}

      {/* Main Live Bidding Console Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 Cols: Active Lot Card & Bidding Controls */}
        <div className="lg:col-span-3 space-y-6">
          {auctionState && auctionState.status === 'live' ? (
            <div className={`glass-panel p-6 sm:p-7 rounded-2xl border-2 transition-all ${isLeading ? 'border-emerald-500/60 shadow-xl shadow-emerald-500/10' : 'border-blue-500/30'
              } space-y-6`}>

              {/* Side-by-Side 2-Column Partition Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">

                {/* LEFT PARTITION: Player Photo, Bio & Live Timer */}
                <div className="bg-gray-900/60 p-5 sm:p-6 rounded-2xl border border-gray-800 flex flex-col justify-between space-y-5">
                  <div>
                    {/* Header Tag */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 uppercase tracking-wider">
                        {auctionState.group_name} Set
                      </span>
                      <span className="text-xs text-gray-400 font-semibold">{auctionState.isForeign ? 'Foreign Player' : 'Indian Player'}</span>
                    </div>

                    {/* Player Image & Name */}
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      <img
                        src={getPhotoUrl(auctionState.photoUrl)}
                        alt={auctionState.playerName}
                        className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl object-cover border-2 border-yellow-500/50 shadow-2xl shrink-0"
                      />
                      <div className="space-y-2 text-center sm:text-left flex-1">
                        <h3 className="text-3xl sm:text-4xl font-black text-white leading-tight">{auctionState.playerName}</h3>
                        <div className="flex flex-wrap gap-2 justify-center sm:justify-start text-xs text-gray-300">
                          <span className="bg-gray-800 px-3 py-1 rounded-lg border border-gray-700 font-medium">Base: {formatCurrency(auctionState.basePrice)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Prominent Live Countdown Timer Box at Bottom of Left Partition */}
                  {auctionState.timerEnabled === false ? (
                    <div className="flex items-center justify-between p-4 rounded-xl border font-bold text-xs sm:text-sm bg-gray-950 text-gray-400 border-gray-800">
                      <div className="flex items-center gap-2">
                        <TimerOff className="w-4 h-4 text-amber-400" />
                        <span>Auction Timer:</span>
                      </div>
                      <span className="text-amber-400 font-extrabold">OFF (Operator Closes Manually)</span>
                    </div>
                  ) : (
                    <div className={`flex items-center justify-between p-4 rounded-xl border font-bold text-xs sm:text-sm ${auctionState.timer <= 5 ? 'bg-red-950 text-red-400 border-red-500 timer-danger' : 'bg-gray-950 text-yellow-400 border-yellow-500/30'
                      }`}>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 animate-spin text-yellow-400" />
                        <span className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Timer Remaining:</span>
                      </div>
                      <span className="text-lg font-black">00:{auctionState.timer < 10 ? `0${auctionState.timer}` : auctionState.timer}</span>
                    </div>
                  )}
                </div>

                {/* RIGHT PARTITION: Bidding Console, Highest Bid & Action Buttons */}
                <div className="space-y-5 flex flex-col justify-between">
                  {/* Current Highest Bid Box */}
                  <div className="glass-card p-5 rounded-2xl border border-gray-800 text-center space-y-2">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Current Highest Bid</p>
                    <p className="text-4xl sm:text-5xl font-black text-yellow-400">{formatCurrency(auctionState.currentBid || auctionState.basePrice)}</p>

                    {auctionState.highestBidderName ? (
                      <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold ${isLeading ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-gray-800 text-amber-300 border border-gray-700'
                        }`}>
                        {isLeading ? <CheckCircle2 className="w-4 h-4" /> : <Flame className="w-4 h-4 text-amber-400" />}
                        <span>{isLeading ? 'YOUR FRANCHISE IS LEADING!' : `Leading: ${auctionState.highestBidderName} (${auctionState.highestBidderShort})`}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Be the first franchise to place a bid at {formatCurrency(auctionState.basePrice)}</p>
                    )}
                  </div>

                  {/* Max Bid Limit Info Banner */}
                  {dynamicMaxBid === -1 ? (
                    <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs text-center font-bold flex items-center justify-center gap-1.5 animate-pulse">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>Bidding Blocked: Violates squad composition rules!</span>
                    </div>
                  ) : (
                    <div className="p-3 py-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs text-center font-semibold flex items-center justify-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping shrink-0" />
                      <span>Max Safe Bid Limit for {auctionState.playerName}: <span className="font-extrabold text-yellow-400 text-xs sm:text-sm ml-1">{formatCurrency(dynamicMaxBid)}</span></span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-gray-400 text-center uppercase tracking-wider">Quick Bid Increment Controls</p>

                    <button
                      onClick={() => placeBid(currentFranchise.id, minNextBid)}
                      onMouseEnter={() => setHoveredBidAmount(minNextBid)}
                      onMouseLeave={() => setHoveredBidAmount(null)}
                      disabled={isLeading || minNextBid > dynamicMaxBid || dynamicMaxBid === -1}
                      className="w-full py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:brightness-110 text-black font-black text-sm sm:text-base shadow-xl shadow-yellow-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                    >
                      <span>RAISE BID TO {formatCurrency(minNextBid)}</span>
                      <ChevronRight className="w-5 h-5" />
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      {bidIncrements.map((inc: number, index: number) => {
                        const bidVal = currentBidBase + inc;
                        return (
                          <button
                            key={index}
                            onClick={() => placeBid(currentFranchise.id, bidVal)}
                            onMouseEnter={() => setHoveredBidAmount(bidVal)}
                            onMouseLeave={() => setHoveredBidAmount(null)}
                            disabled={isLeading || bidVal > dynamicMaxBid || dynamicMaxBid === -1}
                            className="py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs sm:text-sm border border-gray-700 disabled:opacity-40 transition"
                          >
                            + {formatCurrency(inc)} ({formatCurrency(bidVal)})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dynamic Bid Validation Status Display */}
                  {hoveredBidAmount !== null && (
                    <div className={`p-3 rounded-xl text-center text-xs font-bold transition-all border ${hoveredBidAmount <= dynamicMaxBid && dynamicMaxBid !== -1
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-red-950/60 border-red-500/40 text-red-300'
                      }`}>
                      {hoveredBidAmount <= dynamicMaxBid && dynamicMaxBid !== -1 ? (
                        <span>✓ BID ALLOWED</span>
                      ) : (
                        <span>✕ BID BLOCKED — Safe limit is {formatCurrency(dynamicMaxBid)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-12 rounded-2xl text-center space-y-4 border border-gray-800">
              <div className="w-16 h-16 rounded-2xl bg-gray-900 text-yellow-400 mx-auto flex items-center justify-center border border-gray-800">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Auction Room Waiting...</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                The Auction Operator will start the next player lot shortly. Keep your purse ready!
              </p>
            </div>
          )}
        </div>

        {/* Right Sidebar: Active Squad Preview for Franchise */}
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>Current Squad Roster</span>
            </h4>
            <span className="text-xs text-gray-400 font-semibold">{currentFranchise.squad?.length || 0} Players</span>
          </div>

          {/* Group Filter Options */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-gray-950/60 rounded-xl border border-gray-850">
            <button
              onClick={() => setRosterFilter('ALL')}
              className={`py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all duration-200 ${rosterFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setRosterFilter('GROUP A')}
              className={`py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all duration-200 ${rosterFilter === 'GROUP A'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
                }`}
            >
              A ({countA}/2)
            </button>
            <button
              onClick={() => setRosterFilter('GROUP B')}
              className={`py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all duration-200 ${rosterFilter === 'GROUP B'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
                }`}
            >
              B ({countB}/2-3)
            </button>
            <button
              onClick={() => setRosterFilter('GROUP C')}
              className={`py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-all duration-200 ${rosterFilter === 'GROUP C'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                : 'text-gray-400 hover:text-white hover:bg-gray-900/60'
                }`}
            >
              C ({countC}/2-3)
            </button>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {filteredSquad && filteredSquad.length > 0 ? (
              filteredSquad.map((p: any) => {
                const isCaptain = p.is_captain === 1;
                return (
                  <div key={p.id} className="glass-card p-3 rounded-xl border border-gray-800 flex items-center justify-between text-xs">
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {isCaptain && (
                          <span className="px-1.5 py-0.5 text-[9px] font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                            👑 CAPT
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-gray-400">{p.group_name}</p>
                    </div>
                    <span className="font-extrabold text-yellow-400">{formatCurrency(p.sold_price)}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-500 text-center py-10">
                {rosterFilter === 'ALL' ? 'No players purchased yet.' : `No ${rosterFilter} players purchased yet.`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};