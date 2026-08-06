import React from 'react';
import { useAuctionSocket } from '../context/SocketContext';
import { formatCurrency } from '../utils/formatters';
import { Radio, Eye, Flame, Trophy } from 'lucide-react';

export const SpectatorAuctionView: React.FC = () => {
  const { auctionState, eventsLog } = useAuctionSocket();

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-yellow-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center border border-yellow-500/40">
            <Eye className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              PUBLIC SPECTATOR LIVE TICKER
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Live Broadcast
              </span>
            </h2>
            <p className="text-xs text-gray-400">Zero-authentication live streaming bid ticker and real-time auction updates</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Live Card */}
        <div className="lg:col-span-2">
          {auctionState && auctionState.status === 'live' ? (
            <div className="glass-panel p-8 rounded-2xl border-2 border-yellow-500/40 space-y-6 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-yellow-500/20 text-yellow-300 font-bold text-xs border border-yellow-500/40 uppercase">
                Currently On The Block: {auctionState.category} Set
              </div>

              <div className="max-w-md mx-auto space-y-3">
                <img
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80"
                  alt={auctionState.playerName}
                  className="w-40 h-40 mx-auto rounded-3xl object-cover border-4 border-yellow-500/50 shadow-2xl"
                />
                <h3 className="text-4xl font-black text-white">{auctionState.playerName}</h3>
                <p className="text-sm font-semibold text-gray-400">{auctionState.role} · {auctionState.isForeign ? 'Foreign Player' : 'Indian Player'}</p>
              </div>

              <div className="glass-card p-6 rounded-2xl border border-gray-800 max-w-lg mx-auto space-y-2">
                <p className="text-xs text-gray-400 font-semibold uppercase">Current Highest Bid</p>
                <p className="text-5xl font-black text-yellow-400">{formatCurrency(auctionState.currentBid || auctionState.basePrice)}</p>

                {auctionState.highestBidderName ? (
                  <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full gold-badge text-sm mt-2">
                    <Flame className="w-4 h-4 text-black" />
                    <span>Highest Bidder: {auctionState.highestBidderName} ({auctionState.highestBidderShort})</span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Base Price: {formatCurrency(auctionState.basePrice)}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel p-16 rounded-2xl text-center space-y-4 border border-gray-800">
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto opacity-80" />
              <h3 className="text-2xl font-bold text-white">Live Auction Ticker Ready</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                No active lot on the block right now. Bids will stream live to your screen instantly when the operator starts the lot.
              </p>
            </div>
          )}
        </div>

        {/* Live Ticker Feed */}
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Real-time Public Bid Feed</span>
          </h4>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            {eventsLog.length > 0 ? (
              eventsLog.map((ev, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 text-xs space-y-1">
                  <span className="text-[10px] text-gray-500 font-semibold">{ev.timestamp}</span>
                  <p className="text-gray-200 font-medium">{ev.message}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 text-center py-10">Live bids will stream here as they happen!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
