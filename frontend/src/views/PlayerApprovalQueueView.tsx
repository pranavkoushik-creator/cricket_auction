import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { formatCurrency } from '../utils/formatters';
import { UserCheck, Check, X, Ban } from 'lucide-react';

export const PlayerApprovalQueueView: React.FC = () => {
  const { currentTournamentId } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadPlayers = () => {
    apiRequest(`/players?tournamentId=${currentTournamentId}&status=${filterStatus}`)
      .then(setPlayers)
      .catch(console.error);
  };

  useEffect(() => {
    loadPlayers();
  }, [currentTournamentId, filterStatus]);

  const handleAction = (playerId: string, action: 'approve' | 'reject' | 'request-changes' | 'suspend') => {
    apiRequest(`/players/${playerId}/${action}`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: `Admin review action: ${action}` })
    })
      .then(() => loadPlayers())
      .catch(console.error);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-blue-500/30">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/40">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">ADMIN REGISTRATION APPROVAL QUEUE</h2>
            <p className="text-xs text-gray-400">Review eligibility, approve for auction lot assignment, or suspend players</p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-2">
          {['all', 'pending', 'approved', 'rejected', 'suspended'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`text-xs px-3 py-1.5 rounded-lg border uppercase font-bold transition ${
                filterStatus === st
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                  : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Players List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.map(p => (
          <div key={p.id} className="glass-card p-5 rounded-2xl border border-gray-800 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <img src={p.photo_url} alt={p.name} className="w-12 h-12 rounded-xl object-cover border border-gray-700" />
                  <div>
                    <h4 className="text-base font-bold text-white">{p.name}</h4>
                    <p className="text-xs text-gray-400">{p.role} · {p.country}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                  p.approval_status === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : p.approval_status === 'pending'
                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                    : 'bg-red-500/20 text-red-300 border-red-500/30'
                }`}>
                  {p.approval_status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-gray-900/80 p-2.5 rounded-xl border border-gray-800">
                <div>
                  <span className="text-gray-500 block text-[10px]">Category</span>
                  <span className="font-bold text-white">{p.category}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Base Price</span>
                  <span className="font-bold text-yellow-400">{formatCurrency(p.base_price)}</span>
                </div>
              </div>
            </div>

            {/* Actions Toolbar */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-gray-800/80">
              <button
                onClick={() => handleAction(p.id, 'approve')}
                className="flex-1 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center justify-center gap-1 transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>

              <button
                onClick={() => handleAction(p.id, 'reject')}
                className="py-1.5 px-2.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-300 font-bold text-xs border border-red-500/40 flex items-center justify-center gap-1 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handleAction(p.id, 'suspend')}
                className="py-1.5 px-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs border border-gray-700 flex items-center justify-center gap-1 transition"
              >
                <Ban className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
