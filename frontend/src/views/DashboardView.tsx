import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAuctionSocket } from '../context/SocketContext';
import { apiRequest } from '../utils/api';
import { formatCurrency } from '../utils/formatters';
import { Shield, Users, Radio, CheckCircle, ArrowUpRight, DollarSign } from 'lucide-react';

export const DashboardView: React.FC<{ setActiveTab: (tab: string) => void }> = ({ setActiveTab }) => {
  const { currentTournamentId } = useAuth();
  const { eventsLog, auctionState } = useAuctionSocket();
  const [tournament, setTournament] = useState<any>(null);

  const lastRollbackTime = eventsLog.find(e => e.type === 'rollback')?.timestamp || '';
  const [franchises, setFranchises] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    apiRequest(`/tournaments/${currentTournamentId}`)
      .then(setTournament)
      .catch(console.error);

    apiRequest(`/franchises?tournamentId=${currentTournamentId}`)
      .then(setFranchises)
      .catch(console.error);

    apiRequest(`/players?tournamentId=${currentTournamentId}`)
      .then(setPlayers)
      .catch(console.error);
  }, [currentTournamentId, lastRollbackTime, auctionState?.status]);

  if (!tournament) return <div className="p-8 text-center text-gray-400">Loading tournament dashboard...</div>;

  const soldCount = players.filter(p => p.lot_status === 'sold').length;
  const unsoldCont = players.filter(p => p.lot_status === 'unsold').length;
  const approvedCount = players.filter(p => p.approval_status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden border border-blue-500/20">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <img src="/sakha_logo.png" alt="Sakha Logo" className="h-14 sm:h-16 w-auto object-contain bg-white px-3 py-1.5 rounded-xl shadow-lg shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase font-semibold">
                  Status: {tournament.status}
                </span>
                <span className="text-xs text-gray-400 font-medium">{tournament.sport} · {tournament.format}</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white mt-1">{tournament.name}</h2>
              <p className="text-xs text-gray-400">{tournament.dates}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('auction-operator')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold text-xs shadow-lg shadow-amber-500/20 hover:brightness-110 transition"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Launch Live Auction Console</span>
            </button>
            <button
              onClick={() => setActiveTab('auction-bidding')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition"
            >
              <Shield className="w-4 h-4" />
              <span>Franchise Bidding Room</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-xl border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400">Total Purse Per Team</p>
            <p className="text-2xl font-extrabold text-yellow-400 mt-1">
              {formatCurrency(tournament.rules?.purse_budget || 10000)}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">Immutable Purse Ledger Enabled</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-400 border border-yellow-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-xl border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400">Franchises Registered</p>
            <p className="text-2xl font-extrabold text-blue-400 mt-1">{franchises.length}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Squad Cap: {tournament.rules?.max_squad || 7} players</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
            <Shield className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-xl border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400">Registered Players</p>
            <p className="text-2xl font-extrabold text-cyan-400 mt-1">{players.length}</p>
            <p className="text-[11px] text-emerald-400 mt-0.5">{approvedCount} Approved for Lots</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-xl border border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400">Auction Progress</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">{soldCount} Sold</p>
            <p className="text-[11px] text-amber-400 mt-0.5">{unsoldCont} Unsold Pool</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Franchises & Purse Progress Grid */}
      <div className="glass-panel p-6 rounded-2xl border border-cricket-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              <span>Franchise Purse & Squad Overview</span>
            </h3>
            <p className="text-xs text-gray-400">Real-time derived remaining budget from immutable purse ledger</p>
          </div>
          <button
            onClick={() => setActiveTab('franchises')}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
          >
            <span>View Full Roster Hub</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {franchises.map(f => {
            const spent = f.initial_purse - f.remaining_purse;
            const pct = Math.round((spent / f.initial_purse) * 100);
            return (
              <div key={f.id} className="glass-card p-4 rounded-xl border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img src={f.logo_url} alt={f.name} className="w-10 h-10 rounded-full object-cover border border-gray-700" />
                    <div>
                      <h4 className="text-sm font-bold text-white">{f.name} ({f.short_name})</h4>
                      <p className="text-xs text-gray-400">Owner: {f.owner_name || 'Assigned'}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                    Squad: {f.total_players}/{tournament.rules?.max_squad || 7}
                  </span>
                </div>

                {/* Purse Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-400">Purse Remaining:</span>
                    <span className="text-emerald-400 font-bold">{formatCurrency(f.remaining_purse)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${100 - pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>Spent: {formatCurrency(spent)} ({pct}%)</span>
                    <span>Initial: {formatCurrency(f.initial_purse)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
