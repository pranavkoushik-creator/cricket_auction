import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Trophy, Shield, Users, Radio, BarChart3, UserCheck, Eye, Activity, LogOut } from 'lucide-react';
import { formatRoleColor } from '../utils/formatters';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, currentRole, logout, tournaments, currentTournamentId, setCurrentTournamentId } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: Trophy, roles: ['Super Admin'] },
    { id: 'auction-operator', label: 'Operator Console', icon: Radio, roles: ['Super Admin'] },
    { id: 'auction-bidding', label: 'Live Franchise Bidding', icon: Shield, roles: ['Franchise Owner'] },
    { id: 'franchises', label: currentRole === 'Franchise Owner' ? 'My Squad & Purse Ledger' : 'Franchise Management', icon: Shield, roles: ['Super Admin', 'Franchise Owner'] },
    { id: 'players-approval', label: 'Player Approvals', icon: UserCheck, roles: ['Super Admin'] },
    { id: 'match-scorer', label: 'Live Match Scorer & Fixtures', icon: Activity, roles: ['Super Admin'] },
    { id: 'player-register', label: 'Player Registration', icon: Users, roles: ['Player'] },
    { id: 'auction-spectator', label: 'Spectator Live Ticker', icon: Eye, roles: ['Super Admin', 'Franchise Owner', 'Player'] },
    { id: 'reports', label: 'Analytics & Reports', icon: BarChart3, roles: ['Super Admin', 'Franchise Owner'] }
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-cricket-border/50 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand Logo & Tournament Selector */}
        <div className="flex items-center space-x-3">
          <img src="/sakha_logo.png" alt="Sakha Logo" className="h-10 sm:h-12 w-auto object-contain bg-white px-2.5 py-1 rounded-lg shadow-md shrink-0" />
          <div>
            <h1 className="font-extrabold text-lg text-white tracking-tight flex items-center gap-2 font-broadcast">
              SAKHA SPORTS LEAGUE <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">v1.0 Pro</span>
            </h1>
            <p className="text-xs text-gray-400 font-medium">Role-Based Sports Tournament & Auction Platform</p>
          </div>

          {tournaments.length > 0 && (
            <div className="hidden sm:block pl-4 border-l border-gray-800">
              <select
                value={currentTournamentId}
                onChange={e => setCurrentTournamentId(e.target.value)}
                className="bg-cricket-card text-xs text-gray-200 border border-cricket-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
              >
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Authenticated User Profile Badge & Logout */}
        {user && (
          <div className="flex items-center gap-3 self-end md:self-center">
            {/* Assigned Franchise Badge for Franchise Owners */}
            {currentRole === 'Franchise Owner' && user.franchise_short && (
              <div className="px-2.5 py-1 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-black flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span>TEAM: {user.franchise_short}</span>
              </div>
            )}

            {/* Profile Pill */}
            <div className="flex items-center space-x-2.5 bg-gray-900/80 px-3 py-1.5 rounded-xl border border-gray-800">
              <div className="w-7 h-7 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center border border-yellow-500/40 text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-extrabold text-white leading-tight">{user.name}</p>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${formatRoleColor(currentRole)}`}>
                  {currentRole}
                </span>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-800/40 transition flex items-center gap-1 text-xs font-bold"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Role-Scoped Navigation Tabs */}
      <nav className="max-w-7xl mx-auto flex items-center space-x-1 mt-3 overflow-x-auto border-t border-gray-800/60 pt-2 scrollbar-none">
        {navItems
          .filter(item => item.roles.includes(currentRole))
          .map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm font-bold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
      </nav>
    </header>
  );
};
