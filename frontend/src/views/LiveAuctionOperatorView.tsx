import React, { useEffect, useState, useCallback } from 'react';
import { useAuctionSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { formatCurrency } from '../utils/formatters';
import { Radio, Play, Pause, CheckCircle, XCircle, RotateCcw, SkipForward, Flame, Clock, Timer, TimerOff, ShieldAlert, Wifi, WifiOff } from 'lucide-react';

// A small labeled switch matching the console's existing badge/button styling.
// Kept local to this file since it's only ever used by the operator console.
interface TimerToggleSwitchProps {
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}

const TimerToggleSwitch: React.FC<TimerToggleSwitchProps> = ({ enabled, disabled, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    onClick={onToggle}
    disabled={disabled}
    title={enabled ? 'Timer is ON — lot auto-closes when it hits 00:00' : 'Timer is OFF — lot must be closed manually'}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs border transition disabled:opacity-40 disabled:cursor-not-allowed ${enabled
      ? 'bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border-blue-500/40'
      : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
      }`}
  >
    {enabled ? <Timer className="w-4 h-4" /> : <TimerOff className="w-4 h-4" />}
    <span>{enabled ? 'TIMER ON' : 'TIMER OFF'}</span>
    <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-gray-600'
      }`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-1'
        }`} />
    </span>
  </button>
);

export const LiveAuctionOperatorView: React.FC = () => {
  const { currentTournamentId } = useAuth();
  const {
    auctionState,
    eventsLog,
    isConnected,
    operatorStartLot,
    operatorMarkSold,
    operatorMarkUnsold,
    operatorTogglePause,
    operatorToggleTimer,
    operatorRollbackSale
  } = useAuctionSocket();

  const [queuedLots, setQueuedLots] = useState<any[]>([]);
  const [soldLots, setSoldLots] = useState<any[]>([]);
  const [selectedQueueLotId, setSelectedQueueLotId] = useState<string>('');
  const [startingLot, setStartingLot] = useState(false);

  const fetchLots = useCallback(() => {
    if (!currentTournamentId) return;
    apiRequest(`/players?tournamentId=${currentTournamentId}&status=approved`)
      .then(res => {
        // Queued: not yet sold/unsold/live
        const queued = res.filter((p: any) => !p.lot_status || p.lot_status === 'queued' || p.lot_status === 'unsold');
        const sold = res.filter((p: any) => p.lot_status === 'sold');
        setQueuedLots(queued);
        setSoldLots(sold);
        // Always pick the first queued lot when list refreshes
        if (queued.length > 0) {
          const firstLotId = queued[0].lot_id || queued[0].id;
          setSelectedQueueLotId(prev => {
            // Keep current selection if it's still in the queue, else reset
            const stillExists = queued.some((p: any) => (p.lot_id || p.id) === prev);
            return stillExists ? prev : firstLotId;
          });
        } else {
          setSelectedQueueLotId('');
        }
      })
      .catch(console.error);
  }, [currentTournamentId]);

  const lastRollbackTime = eventsLog.find(e => e.type === 'rollback')?.timestamp || '';

  useEffect(() => {
    fetchLots();
  }, [fetchLots, auctionState?.status, lastRollbackTime]);

  const handleStartLot = () => {
    if (!selectedQueueLotId) {
      alert('Please select a player lot from the dropdown first!');
      return;
    }
    if (!isConnected) {
      alert('WebSocket not connected. Please wait for connection...');
      return;
    }
    setStartingLot(true);
    operatorStartLot(selectedQueueLotId);
    // Reset the starting state after a short delay
    setTimeout(() => setStartingLot(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Operator Header Bar */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-amber-500/30">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              LIVE AUCTION OPERATOR CONSOLE
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                Broadcasting
              </span>
            </h2>
            <p className="text-xs text-gray-400">Strict real-time bid validation, configurable lot timer, and purse ledger locking</p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${isConnected
            ? 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30'
            : 'bg-red-900/40 text-red-300 border-red-500/30 animate-pulse'
            }`}>
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
          </div>

          <TimerToggleSwitch
            enabled={auctionState?.timerEnabled !== false}
            disabled={!auctionState || auctionState.status !== 'live'}
            onToggle={operatorToggleTimer}
          />

          <button
            onClick={operatorTogglePause}
            disabled={!auctionState || auctionState.status !== 'live'}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs border transition disabled:opacity-40 disabled:cursor-not-allowed ${auctionState?.isPaused
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
              : 'bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border-amber-500/40'
              }`}
          >
            {auctionState?.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{auctionState?.isPaused ? 'RESUME AUCTION' : 'PAUSE AUCTION'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Center Lot Display (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {auctionState && auctionState.status === 'live' ? (
            <div className="glass-panel p-6 rounded-2xl border-2 border-yellow-500/40 relative overflow-hidden space-y-6">
              {/* Top Bar: Timer & Category */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 uppercase tracking-wider">
                  {auctionState.category} Set · {auctionState.role}
                </span>

                {/* Countdown Timer Badge */}
                {auctionState.timerEnabled === false ? (
                  <div className="flex items-center space-x-2 px-4 py-1.5 rounded-xl border text-xs font-extrabold bg-gray-900 text-gray-400 border-gray-700 uppercase tracking-wider">
                    <TimerOff className="w-4 h-4" />
                    <span>Timer Off · Close Manually</span>
                  </div>
                ) : (
                  <div className={`flex items-center space-x-2 px-4 py-1.5 rounded-xl border text-base font-extrabold ${auctionState.timer <= 5
                    ? 'bg-red-950/80 text-red-400 border-red-500 timer-danger'
                    : 'bg-gray-900 text-yellow-400 border-yellow-500/30'
                    }`}>
                    <Clock className="w-5 h-5" />
                    <span>00:{auctionState.timer < 10 ? `0${auctionState.timer}` : auctionState.timer}</span>
                  </div>
                )}
              </div>

              {/* Player Card Big Display */}
              <div className="flex flex-col sm:flex-row items-center gap-6 bg-gray-900/60 p-5 rounded-xl border border-gray-800">
                <img
                  src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80"
                  alt={auctionState.playerName}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl object-cover border-2 border-yellow-500/50 shadow-xl"
                />
                <div className="space-y-2 text-center sm:text-left flex-1">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs text-gray-400 font-semibold">{auctionState.isForeign ? '🌍 Foreign Player' : '🇮🇳 Indian Player'}</span>
                  </div>
                  <h3 className="text-3xl font-black text-white">{auctionState.playerName}</h3>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-lg border border-gray-700">Role: {auctionState.role}</span>
                    <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-lg border border-gray-700">Base Price: {formatCurrency(auctionState.basePrice)}</span>
                    <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-lg border border-gray-700">Category: {auctionState.category}</span>
                  </div>
                </div>
              </div>

              {/* Current Highest Bid Section */}
              <div className="glass-card p-5 rounded-xl border border-amber-500/30 text-center space-y-2">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Current Highest Bid</p>
                <p className="text-4xl font-black text-yellow-400 tracking-tight">
                  {auctionState.currentBid > 0 ? formatCurrency(auctionState.currentBid) : formatCurrency(auctionState.basePrice)}
                </p>
                {auctionState.highestBidderName ? (
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full gold-badge text-sm">
                    <Flame className="w-4 h-4 text-black" />
                    <span>Leading Bidder: {auctionState.highestBidderName} ({auctionState.highestBidderShort})</span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Waiting for first bid at base price of {formatCurrency(auctionState.basePrice)}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={operatorMarkSold}
                  disabled={!auctionState.highestBidderId}
                  className="py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>MARK SOLD</span>
                </button>
                <button
                  onClick={operatorMarkUnsold}
                  className="py-3.5 rounded-xl bg-gradient-to-r from-rose-700 to-red-600 hover:brightness-110 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition"
                >
                  <XCircle className="w-5 h-5" />
                  <span>MARK UNSOLD</span>
                </button>
              </div>

              {/* Paused overlay */}
              {auctionState.isPaused && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10">
                  <div className="text-center space-y-2">
                    <p className="text-3xl font-black text-amber-400 animate-pulse">⏸ AUCTION PAUSED</p>
                    <p className="text-sm text-gray-300">Click "RESUME AUCTION" to continue bidding</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Queue Selector Card when no lot is live */
            <div className="glass-panel p-8 rounded-2xl text-center space-y-6 border border-gray-800">
              <div className="w-16 h-16 rounded-2xl bg-gray-800 text-yellow-400 mx-auto flex items-center justify-center border border-gray-700">
                <SkipForward className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">No Live Lot Currently Active</h3>
                <p className="text-xs text-gray-400">Select an approved player from the lot queue below to start live bidding</p>
              </div>

              {!isConnected && (
                <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center justify-center gap-2">
                  <WifiOff className="w-4 h-4" />
                  <span>WebSocket disconnected — waiting for reconnection...</span>
                </div>
              )}

              {queuedLots.length > 0 ? (
                <div className="max-w-md mx-auto space-y-4">
                  <label className="block text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Select Player from Auction Queue ({queuedLots.length} remaining)
                  </label>
                  <select
                    value={selectedQueueLotId}
                    onChange={e => setSelectedQueueLotId(e.target.value)}
                    className="w-full bg-gray-900 text-white text-sm border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30"
                  >
                    {queuedLots.map((p) => (
                      <option key={p.id} value={p.lot_id || p.id}>
                        {p.name} ({p.role} · {p.category} · Base: {formatCurrency(p.base_price)})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleStartLot}
                    disabled={!selectedQueueLotId || !isConnected || startingLot}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-extrabold text-sm shadow-lg shadow-yellow-500/30 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {startingLot ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        <span>STARTING LIVE BIDDING...</span>
                      </>
                    ) : (
                      <>
                        <Radio className="w-4 h-4" />
                        <span>START LIVE BIDDING FOR SELECTED PLAYER</span>
                      </>
                    )}
                  </button>

                  {selectedQueueLotId && (
                    <p className="text-[11px] text-gray-500 text-center">
                      Lot ID: <span className="text-gray-400 font-mono">{selectedQueueLotId}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-emerald-400 font-semibold">✅ All approved lots have been processed!</p>
              )}
            </div>
          )}

          {/* Sold Lots Rollback Management */}
          {soldLots.length > 0 && (
            <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Recent Completed Sales (Sale Rollback Audit Console)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                {soldLots.map(p => (
                  <div key={p.id} className="glass-card p-3 rounded-xl border border-gray-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{p.name}</p>
                      <p className="text-gray-400">{p.buyer_short} · Sold: {formatCurrency(p.sold_price)}</p>
                    </div>
                    <button
                      onClick={() => operatorRollbackSale(p.lot_id)}  // BUG FIX: was p.id, must be p.lot_id
                      className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1 transition text-[11px]"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Rollback</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Realtime Event Log Stream */}
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Live WebSocket Event Stream</span>
            </h4>
            <span className="text-[11px] text-gray-500">{eventsLog.length} events</span>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {eventsLog.length > 0 ? (
              eventsLog.map((ev, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-gray-900/80 border border-gray-800 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span className={`uppercase font-semibold ${ev.type === 'sold' ? 'text-emerald-400' :
                      ev.type === 'unsold' ? 'text-red-400' :
                        ev.type === 'new_bid' ? 'text-yellow-400' :
                          ev.type === 'lot_started' ? 'text-blue-400' :
                            'text-gray-400'
                      }`}>{ev.type}</span>
                    <span>{ev.timestamp}</span>
                  </div>
                  <p className="text-gray-200 font-medium">{ev.message}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 space-y-2">
                <p className="text-xs text-gray-500">Waiting for live auction events...</p>
                {isConnected && (
                  <p className="text-[11px] text-emerald-500">✓ Connected to WebSocket engine</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};