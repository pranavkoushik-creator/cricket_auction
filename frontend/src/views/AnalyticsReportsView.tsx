import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAuctionSocket } from '../context/SocketContext';
import { apiRequest } from '../utils/api';
import { formatCurrency } from '../utils/formatters';
import { Trophy, DollarSign, FileSpreadsheet } from 'lucide-react';

export const AnalyticsReportsView: React.FC = () => {
  const { currentTournamentId } = useAuth();
  const { eventsLog, auctionState } = useAuctionSocket();
  const [report, setReport] = useState<any>(null);

  const lastRollbackTime = eventsLog.find(e => e.type === 'rollback')?.timestamp || '';

  useEffect(() => {
    apiRequest(`/reports/auction?tournamentId=${currentTournamentId}`)
      .then(setReport)
      .catch(console.error);
  }, [currentTournamentId, lastRollbackTime, auctionState?.status]);

  if (!report) return <div className="p-8 text-center text-gray-400">Loading auction analytics & reports...</div>;

  const exportCSV = () => {
    let csv = 'Player Name,Group,Role,Buyer Franchise,Sold Price (INR)\n';
    report.sold_lots.forEach((l: any) => {
      csv += `"${l.player_name}","${l.group_name}","${l.role}","${l.buyer_name}",${l.sold_price}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auction_report_${currentTournamentId}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-blue-500/30">
        <div className="flex items-center space-x-3">
          <img src="/sakha_logo.png" alt="Sakha Logo" className="h-10 sm:h-12 w-auto object-contain bg-white px-2.5 py-1 rounded-lg shadow-md shrink-0" />
          <div>
            <h2 className="text-xl font-extrabold text-white">SAKHA AUCTION ANALYTICS &amp; EXPORT REPORTS</h2>
            <p className="text-xs text-gray-400">Comprehensive spend breakdown, bid leaderboards, and auditable data exports</p>
          </div>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Auction Report (.CSV)</span>
        </button>
      </div>

      {/* Analytics KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-xl border border-gray-800 space-y-1">
          <p className="text-xs text-gray-400 font-semibold">Total Spend Across Franchises</p>
          <p className="text-2xl font-black text-yellow-400">{formatCurrency(report.summary.total_spend_inr)}</p>
        </div>

        <div className="glass-card p-5 rounded-xl border border-gray-800 space-y-1">
          <p className="text-xs text-gray-400 font-semibold">Average Player Purchase Price</p>
          <p className="text-2xl font-black text-emerald-400">{formatCurrency(report.summary.average_bid_inr)}</p>
        </div>

        <div className="glass-card p-5 rounded-xl border border-gray-800 space-y-1">
          <p className="text-xs text-gray-400 font-semibold">Total Sold Players</p>
          <p className="text-2xl font-black text-blue-400">{report.summary.total_players_sold}</p>
        </div>

        <div className="glass-card p-5 rounded-xl border border-gray-800 space-y-1">
          <p className="text-xs text-gray-400 font-semibold">Highest Individual Bid</p>
          <p className="text-2xl font-black text-cyan-400">
            {report.summary.highest_bid ? formatCurrency(report.summary.highest_bid.sold_price) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Franchise Spend Breakdown & Top Purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Franchise Spend Table */}
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Franchise Spend Summary</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 uppercase font-semibold">
                  <th className="py-2.5 px-3">Franchise</th>
                  <th className="py-2.5 px-3 text-center">Squad</th>
                  <th className="py-2.5 px-3 text-right">Total Spent</th>
                  <th className="py-2.5 px-3 text-right">Purse Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {report.franchise_breakdown.map((f: any) => (
                  <tr key={f.id} className="hover:bg-gray-900/40">
                    <td className="py-3 px-3 font-bold text-white">{f.name} ({f.short_name})</td>
                    <td className="py-3 px-3 text-center font-semibold text-gray-300">{f.squad_size}</td>
                    <td className="py-3 px-3 text-right font-bold text-yellow-400">{formatCurrency(f.total_spent)}</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">{formatCurrency(f.remaining_purse)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Purchases Leaderboard */}
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span>Top Purchases Leaderboard</span>
          </h3>

          <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
            {report.top_purchases.length > 0 ? (
              report.top_purchases.map((lot: any, idx: number) => (
                <div key={lot.id} className="glass-card p-3 rounded-xl border border-gray-800 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 font-extrabold flex items-center justify-center text-[11px]">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-white">{lot.player_name}</p>
                      <p className="text-[11px] text-gray-400">{lot.role} · Bought by {lot.buyer_name}</p>
                    </div>
                  </div>
                  <span className="font-extrabold text-yellow-400">{formatCurrency(lot.sold_price)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 text-center py-10">No completed player sales yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
