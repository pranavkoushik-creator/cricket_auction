import React, { useEffect, useState } from 'react';
import { useAuctionSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { formatCurrency } from '../utils/formatters';
import { Clock, AlertTriangle, CheckCircle2, Flame, Users, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';

export const LiveAuctionBiddingView: React.FC = () => {
  const { currentTournamentId, selectedFranchiseId, setSelectedFranchiseId, currentRole, user } = useAuth();
  const isFranchiseOwner = currentRole === 'Franchise Owner';
  const { auctionState, bidError, placeBid, eventsLog } = useAuctionSocket();

  const [franchises, setFranchises] = useState<any[]>([]);
  const [currentFranchise, setCurrentFranchise] = useState<any>(null);

  const fetchFranchiseData = () => {
    apiRequest(`/franchises?tournamentId=${currentTournamentId}`)
      .then(res => {
        setFranchises(res);
        // If Franchise Owner, strictly pick their assigned franchise
        const ownerFranchiseId = isFranchiseOwner && user?.franchise_id ? user.franchise_id : selectedFranchiseId;
        const active = res.find((f: any) => f.id === ownerFranchiseId) || res[0];
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
  }, [currentTournamentId, selectedFranchiseId, auctionState?.currentBid, auctionState?.status, user?.franchise_id, lastRollbackTime]);

  // Trigger confetti on winning sale
  useEffect(() => {
    if (auctionState?.status === 'sold' && auctionState.highestBidderId === selectedFranchiseId) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  }, [auctionState?.status]);

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
        <div className="flex items-center gap-4 bg-gray-900/80 px-4 py-2.5 rounded-xl border border-gray-800">
          <div className="text-right">
            <p className="text-[11px] font-semibold text-gray-400">REMAINING PURSE</p>
            <p className="text-xl font-black text-emerald-400">{formatCurrency(currentFranchise.remaining_purse)}</p>
          </div>
          <div className="h-8 w-px bg-gray-800" />
          <div className="text-right">
            <p className="text-[11px] font-semibold text-gray-400">SQUAD SIZE</p>
            <p className="text-sm font-bold text-white">
              {currentFranchise.total_players} / 25 <span className="text-xs text-gray-400">({currentFranchise.foreign_players} foreign)</span>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Lot Card & Bidding Controls */}
        <div className="lg:col-span-2 space-y-6">
          {auctionState && auctionState.status === 'live' ? (
            <div className={`glass-panel p-6 rounded-2xl border-2 transition-all ${isLeading ? 'border-emerald-500/60 shadow-xl shadow-emerald-500/10' : 'border-blue-500/30'
              } space-y-6`}>
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {auctionState.category} Set · {auctionState.role}
                </span>

                <div className={`flex items-center space-x-2 px-3.5 py-1 rounded-xl border font-bold text-sm ${auctionState.timer <= 5 ? 'bg-red-950 text-red-400 border-red-500' : 'bg-gray-900 text-yellow-400 border-gray-700'
                  }`}>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>00:{auctionState.timer < 10 ? `0${auctionState.timer}` : auctionState.timer}</span>
                </div>
              </div>

              {/* Player Image & Bio */}
              <div className="flex flex-col sm:flex-row items-center gap-6 bg-gray-900/60 p-5 rounded-xl border border-gray-800">
                <img
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80"
                  alt={auctionState.playerName}
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl object-cover border-2 border-blue-500/40 shadow-lg"
                />
                <div className="space-y-2 text-center sm:text-left flex-1">
                  <span className="text-xs text-gray-400 font-semibold">{auctionState.isForeign ? 'Foreign Player' : 'Indian Player'}</span>
                  <h3 className="text-3xl font-black text-white">{auctionState.playerName}</h3>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start text-xs text-gray-300">
                    <span className="bg-gray-800 px-2.5 py-1 rounded border border-gray-700">Role: {auctionState.role}</span>
                    <span className="bg-gray-800 px-2.5 py-1 rounded border border-gray-700">Base Price: {formatCurrency(auctionState.basePrice)}</span>
                  </div>
                </div>
              </div>

              {/* Current Bidder Box */}
              <div className="glass-card p-5 rounded-xl border border-gray-800 text-center space-y-2">
                <p className="text-xs text-gray-400 font-semibold uppercase">Current Highest Bid</p>
                <p className="text-4xl font-black text-yellow-400">{formatCurrency(auctionState.currentBid || auctionState.basePrice)}</p>

                {auctionState.highestBidderName ? (
                  <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold ${isLeading ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-gray-800 text-amber-300 border border-gray-700'
                    }`}>
                    {isLeading ? <CheckCircle2 className="w-4 h-4" /> : <Flame className="w-4 h-4 text-amber-400" />}
                    <span>{isLeading ? 'YOUR FRANCHISE IS LEADING!' : `Leading: ${auctionState.highestBidderName} (${auctionState.highestBidderShort})`}</span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Be the first franchise to place a bid at {formatCurrency(auctionState.basePrice)}</p>
                )}
              </div>

              {/* Bidding Buttons Ladder */}
              <div className="space-y-3 pt-2">
                <p className="text-xs font-semibold text-gray-400 text-center uppercase tracking-wider">Quick Bid Increment Controls</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => placeBid(currentFranchise.id, minNextBid)}
                    disabled={isLeading}
                    className="py-4 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:brightness-110 text-black font-black text-base shadow-xl shadow-yellow-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    <span>RAISE BID TO {formatCurrency(minNextBid)}</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => placeBid(currentFranchise.id, currentBidBase + 2500000)}
                    disabled={isLeading}
                    className="py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    + ₹25 LAKHS ({formatCurrency(currentBidBase + 2500000)})
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => placeBid(currentFranchise.id, currentBidBase + 5000000)}
                    disabled={isLeading}
                    className="py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs border border-gray-700 disabled:opacity-40 transition"
                  >
                    + ₹50 LAKHS ({formatCurrency(currentBidBase + 5000000)})
                  </button>
                  <button
                    onClick={() => placeBid(currentFranchise.id, currentBidBase + 10000000)}
                    disabled={isLeading}
                    className="py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs border border-gray-700 disabled:opacity-40 transition"
                  >
                    + ₹1 CRORE ({formatCurrency(currentBidBase + 10000000)})
                  </button>
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

          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {currentFranchise.squad && currentFranchise.squad.length > 0 ? (
              currentFranchise.squad.map((p: any) => (
                <div key={p.id} className="glass-card p-3 rounded-xl border border-gray-800 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-white">{p.name}</p>
                    <p className="text-[11px] text-gray-400">{p.role} · {p.category}</p>
                  </div>
                  <span className="font-extrabold text-yellow-400">{formatCurrency(p.sold_price)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 text-center py-10">No players purchased yet in this auction session.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
