import React, { useEffect, useState } from 'react';
import { useAuctionSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { formatCurrency, getPhotoUrl } from '../utils/formatters';
import { Radio, Flame, Trophy, Clock, Gavel, Sparkles, XCircle, TimerOff } from 'lucide-react';
import confetti from 'canvas-confetti';

export const SpectatorAuctionView: React.FC = () => {
  const { currentTournamentId } = useAuth();
  const { auctionState, eventsLog } = useAuctionSocket();

  const [summaryReport, setSummaryReport] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'sales' | 'bids'>('all');

  const [franchises, setFranchises] = useState<any[]>([]);

  const fetchSummary = () => {
    if (!currentTournamentId) return;
    apiRequest(`/reports/auction?tournamentId=${currentTournamentId}`)
      .then(res => setSummaryReport(res.summary))
      .catch(console.error);
    apiRequest(`/franchises?tournamentId=${currentTournamentId}`)
      .then(setFranchises)
      .catch(console.error);
  };

  useEffect(() => {
    fetchSummary();
  }, [currentTournamentId, auctionState?.status]);

  const leadingFranchise = franchises.find(f =>
    f.id === auctionState?.highestBidderId ||
    f.name === auctionState?.highestBidderName ||
    f.short_name === auctionState?.highestBidderShort
  );

  // Trigger confetti when a lot is marked SOLD
  useEffect(() => {
    if (auctionState?.status === 'sold') {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#FFB800', '#10B981', '#3B82F6', '#F43F5E']
      });
    }
  }, [auctionState?.status]);

  // Filter events log for Activity Center
  const filteredEvents = eventsLog.filter(ev => {
    if (activeFilter === 'sales') return ev.type === 'sold' || ev.type === 'unsold';
    if (activeFilter === 'bids') return ev.type === 'new_bid';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Broadcast Header & Tournament Metric Ticker */}
      <div className="glass-panel p-5 rounded-2xl border border-yellow-500/30 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <img src="/sakha_logo.png" alt="Sakha Logo" className="h-10 sm:h-12 w-auto object-contain bg-white px-2.5 py-1 rounded-lg shadow-md shrink-0" />
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-wide font-broadcast">
                SAKHA LIVE AUCTION BROADCAST TRACKER
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-red-600 text-white font-extrabold flex items-center gap-1.5 animate-pulse shadow-md">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  LIVE
                </span>
              </h2>
              <p className="text-xs text-gray-400">Official IPL-Style Live Broadcast Console & Realtime Ticker</p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {summaryReport && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800 text-center">
                <span className="text-[10px] font-semibold text-gray-400 uppercase block">Total Spent</span>
                <span className="font-black text-emerald-400 text-sm">{formatCurrency(summaryReport.total_spend_inr || 0)}</span>
              </div>
              <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800 text-center">
                <span className="text-[10px] font-semibold text-gray-400 uppercase block">Players Sold</span>
                <span className="font-black text-yellow-400 text-sm">{summaryReport.total_players_sold || 0} Players</span>
              </div>
              <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800 text-center">
                <span className="text-[10px] font-semibold text-gray-400 uppercase block">Unsold</span>
                <span className="font-black text-gray-300 text-sm">{summaryReport.total_players_unsold || 0}</span>
              </div>
              <div className="bg-gray-900/80 p-2.5 rounded-xl border border-gray-800 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase block">Top Purchase</span>
                <span className="font-black text-blue-400 text-xs truncate block">
                  {summaryReport.highest_bid ? `${summaryReport.highest_bid.player_name} (${formatCurrency(summaryReport.highest_bid.sold_price)})` : 'None'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Featured Block (Left 2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {auctionState && auctionState.status === 'live' ? (
            /* CASE 1: ACTIVE LIVE BIDDING CARD (PARTITIONED 2-COLUMN SIDE-BY-SIDE LAYOUT) */
            <div className="glass-panel p-6 sm:p-7 rounded-2xl border-2 border-yellow-500/50 relative overflow-hidden space-y-6 shadow-2xl">
              {/* Header Badges */}
              <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <span className="text-xs font-black px-3.5 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 uppercase tracking-wider">
                  SET {auctionState.group_name?.toUpperCase()}
                </span>

                {auctionState.timerEnabled === false ? (
                  <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border font-bold text-xs bg-gray-900 text-gray-400 border-gray-700">
                    <TimerOff className="w-4 h-4 text-amber-400" />
                    <span>Timer OFF</span>
                  </div>
                ) : (
                  <div className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl border text-sm font-black ${auctionState.timer <= 5 ? 'bg-red-950 text-red-400 border-red-500 timer-danger' : 'bg-gray-900 text-yellow-400 border-yellow-500/30'
                    }`}>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>00:{auctionState.timer < 10 ? `0${auctionState.timer}` : auctionState.timer}</span>
                  </div>
                )}
              </div>

              {/* 2-Column Partition Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">

                {/* LEFT PARTITION: Featured Player Portrait & Details */}
                <div className="bg-gray-900/80 p-5 sm:p-6 rounded-2xl border border-gray-800 flex flex-col justify-between space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    <div className="relative shrink-0">
                      <img
                        src={getPhotoUrl(auctionState.photoUrl)}
                        alt={auctionState.playerName}
                        className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl object-cover border-2 border-yellow-500/50 shadow-2xl"
                      />
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-black/90 text-yellow-300 border border-yellow-500/30 whitespace-nowrap">
                        {auctionState.isForeign ? '🌍 FOREIGN' : '🇮🇳 INDIA'}
                      </span>
                    </div>

                    <div className="space-y-2 text-center sm:text-left flex-1">
                      <span className="text-[10px] text-yellow-400 font-extrabold uppercase tracking-widest block">FEATURED PLAYER</span>
                      <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight font-broadcast leading-tight">
                        {auctionState.playerName}
                      </h3>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start text-xs font-semibold text-gray-300 pt-1">
                        <span className="bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-700">Base: {formatCurrency(auctionState.basePrice)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT PARTITION: Current Highest Bid & Leading Team Showcase Card */}
                <div className="glass-card p-5 sm:p-6 rounded-2xl border border-amber-500/40 text-center flex flex-col justify-between space-y-4 relative overflow-hidden bg-gray-900/90">
                  <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500/20 text-amber-300 font-extrabold text-[10px] uppercase border-b border-l border-amber-500/30 tracking-wider">
                    Live Bidding Active
                  </div>

                  <div className="pt-2 space-y-1">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Current Highest Bid</p>
                    <p className="text-4xl sm:text-5xl font-black text-emerald-400 tracking-tight font-broadcast">
                      {formatCurrency(auctionState.currentBid || auctionState.basePrice)}
                    </p>
                  </div>

                  {/* Leading Franchise Showcase Box (Team Logo, Team Name, Short Code, Owner Name) */}
                  {auctionState.highestBidderName ? (
                    <div className="bg-gray-950/80 p-4 rounded-xl border border-yellow-500/30 flex items-center gap-4 text-left shadow-xl transition-all">
                      <img
                        src={auctionState.highestBidderLogo || leadingFranchise?.logo_url || 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=150&auto=format&fit=crop&q=80'}
                        alt={auctionState.highestBidderName}
                        className="w-14 h-14 rounded-xl object-cover border-2 border-yellow-500/60 shadow-md shrink-0"
                      />
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">
                            CURRENT LEADING BIDDER
                          </span>
                        </div>
                        <h4 className="text-base sm:text-lg font-black text-white truncate leading-tight font-broadcast">
                          {auctionState.highestBidderName} <span className="text-yellow-400 text-xs font-extrabold">({auctionState.highestBidderShort})</span>
                        </h4>
                        <p className="text-xs text-gray-400 font-semibold truncate">
                          Owner: <span className="text-gray-200 font-bold">{auctionState.highestBidderOwner || leadingFranchise?.owner_name || 'Verified Owner'}</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-950/60 p-4 rounded-xl border border-gray-800 text-center">
                      <p className="text-xs text-gray-400 font-medium">
                        Waiting for opening bid at base price of <span className="text-yellow-400 font-bold">{formatCurrency(auctionState.basePrice)}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : auctionState && (auctionState.status === 'sold' || auctionState.status === 'unsold') ? (
            /* CASE 2: AUCTION UPDATE CARD WITH REALISTIC ROTATED "SOLD" / "UNSOLD" STAMP (Inspired by Screenshot 1!) */
            <div className="glass-panel rounded-2xl border-2 border-yellow-500/50 overflow-hidden shadow-2xl relative">
              {/* Vibrant Gold Header Banner */}
              <div className="auction-banner-header py-3.5 px-6 text-center border-b border-yellow-600/30 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-black" />
                <h3 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-black font-broadcast">
                  AUCTION UPDATE
                </h3>
              </div>

              <div className="p-6 sm:p-8 relative">
                {/* STAMP OVERLAY */}
                <div className="absolute right-8 top-12 z-20 pointer-events-none">
                  {auctionState.status === 'sold' ? (
                    <div className="stamp-sold text-2xl sm:text-4xl">SOLD</div>
                  ) : (
                    <div className="stamp-unsold text-2xl sm:text-4xl">UNSOLD</div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                  {/* Left: Player Portrait */}
                  <div className="flex items-center gap-4 bg-gray-900/60 p-4 rounded-2xl border border-gray-800">
                    <img
                      src={getPhotoUrl(auctionState.photoUrl)}
                      alt={auctionState.playerName}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-yellow-500/50 shadow-lg"
                    />
                    <div>
                      <span className="text-[10px] text-yellow-400 font-extrabold uppercase tracking-wider block">
                        {auctionState.group_name}
                      </span>
                      <h4 className="text-xl font-black text-white font-broadcast">{auctionState.playerName}</h4>
                      <span className="text-xs text-gray-400">{auctionState.isForeign ? 'Foreign Player' : 'Indian Player'}</span>
                    </div>
                  </div>

                  {/* Right: Sold To Team & Price Details */}
                  {auctionState.status === 'sold' ? (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">SOLD TO</span>
                        <div className="flex items-center space-x-3 bg-gray-900/80 p-3 rounded-xl border border-gray-800">
                          <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-sm border border-blue-400">
                            {auctionState.highestBidderShort || 'CSK'}
                          </div>
                          <div>
                            <p className="text-base font-extrabold text-white">{auctionState.highestBidderName}</p>
                            <p className="text-xs text-gray-400 font-bold">{auctionState.highestBidderShort}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-900/90 p-4 rounded-xl border border-emerald-500/40 text-left">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">FINAL PRICE</span>
                        <span className="text-3xl font-black text-emerald-400 font-broadcast">
                          {formatCurrency(auctionState.currentBid)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">LOT STATUS</span>
                      <div className="bg-gray-900/90 p-5 rounded-xl border border-red-500/30 text-center space-y-1">
                        <p className="text-xl font-bold text-gray-300">Unsold (No Bids)</p>
                        <p className="text-xs text-gray-500">Base Price: {formatCurrency(auctionState.basePrice)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* CASE 3: IDLE / STANDBY CARD */
            <div className="glass-panel p-16 rounded-2xl text-center space-y-5 border border-gray-800 shadow-xl">
              <div className="w-20 h-20 rounded-full bg-gray-900 text-yellow-400 mx-auto flex items-center justify-center border border-gray-700 shadow-inner">
                <Trophy className="w-10 h-10 animate-bounce" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-2xl font-black text-white font-broadcast">LIVE BROADCAST STANDBY</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  The Auctioneer is preparing the next player set. Live bids and sale announcements will stream here automatically.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Activity Center Stream (Right Col - Inspired by Screenshot 2!) */}
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <h4 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wide font-broadcast">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>ACTIVITY CENTER</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </h4>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-lg border transition ${activeFilter === 'all' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-gray-900 text-gray-400 border-gray-800'
                }`}
            >
              ALL FEED
            </button>
            <button
              onClick={() => setActiveFilter('sales')}
              className={`px-3 py-1 rounded-lg border transition ${activeFilter === 'sales' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-gray-900 text-gray-400 border-gray-800'
                }`}
            >
              SALES
            </button>
            <button
              onClick={() => setActiveFilter('bids')}
              className={`px-3 py-1 rounded-lg border transition ${activeFilter === 'bids' ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-900 text-gray-400 border-gray-800'
                }`}
            >
              BIDS
            </button>
          </div>

          {/* Activity Cards List */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((ev, idx) => {
                const isSold = ev.type === 'sold';
                const isUnsold = ev.type === 'unsold';
                const isBid = ev.type === 'new_bid';
                // const isLotStart = ev.type === 'lot_started';

                if (isSold) {
                  return (
                    <div key={idx} className="activity-sold-card p-4 rounded-xl text-xs space-y-2">
                      <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Gavel className="w-3.5 h-3.5" />
                          <span>OFFICIAL SALE ANNOUNCEMENT</span>
                        </span>
                        <span>{ev.timestamp}</span>
                      </div>
                      <p className="text-white font-black text-sm tracking-wide font-broadcast">{ev.message}</p>
                    </div>
                  );
                }

                if (isUnsold) {
                  return (
                    <div key={idx} className="activity-unsold-card p-3.5 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-red-400 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>UNSOLD LOT</span>
                        </span>
                        <span>{ev.timestamp}</span>
                      </div>
                      <p className="text-gray-300 font-bold">{ev.message}</p>
                    </div>
                  );
                }

                if (isBid) {
                  return (
                    <div key={idx} className="glass-card p-3 rounded-xl border border-yellow-500/20 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-yellow-400 font-bold">
                        <span className="flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5" />
                          <span>NEW HIGHEST BID</span>
                        </span>
                        <span>{ev.timestamp}</span>
                      </div>
                      <p className="text-white font-bold">{ev.message}</p>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="activity-event-pill p-3 rounded-xl text-xs space-y-1 text-center">
                    <span className="text-[10px] text-gray-500 font-semibold block">{ev.timestamp}</span>
                    <p className="text-gray-300 font-medium">{ev.message}</p>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 space-y-2">
                <Radio className="w-8 h-8 text-gray-600 mx-auto animate-pulse" />
                <p className="text-xs text-gray-500">Activity Center listening for live auction stream...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
