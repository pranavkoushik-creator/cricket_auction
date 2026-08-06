import React from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { Trophy, Shield, Users, Radio, Calendar, BarChart3, UserCheck, Eye, Activity } from 'lucide-react';
import { formatRoleColor } from '../utils/formatters';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { currentRole, loginDemoUser, tournaments, currentTournamentId, setCurrentTournamentId } = useAuth();

  const roles: UserRole[] = [
    'Super Admin',
    'Tournament Admin',
    'Auction Operator',
    'Franchise Owner',
    'Player',
    'Scorer',
    'Spectator'
  ];

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: Trophy, roles: ['Super Admin', 'Tournament Admin', 'Franchise Owner', 'Player', 'Scorer', 'Spectator'] },
    { id: 'auction-operator', label: 'Operator Console', icon: Radio, roles: ['Super Admin', 'Tournament Admin', 'Auction Operator'] },
    { id: 'auction-bidding', label: 'Franchise Bidding', icon: Shield, roles: ['Super Admin', 'Franchise Owner', 'Franchise Manager'] },
    { id: 'auction-spectator', label: 'Live Ticker', icon: Eye, roles: ['Super Admin', 'Spectator', 'Player', 'Franchise Owner', 'Auction Operator'] },
    { id: 'players-approval', label: 'Player Approvals', icon: UserCheck, roles: ['Super Admin', 'Tournament Admin'] },
    { id: 'player-register', label: 'Player Registration', icon: Users, roles: ['Super Admin', 'Player'] },
    { id: 'franchises', label: 'Franchise Roster', icon: Shield, roles: ['Super Admin', 'Tournament Admin', 'Franchise Owner'] },
    { id: 'match-scorer', label: 'Match Scorer', icon: Activity, roles: ['Super Admin', 'Scorer', 'Tournament Admin'] },
    { id: 'match-scheduler', label: 'Fixtures & Standings', icon: Calendar, roles: ['Super Admin', 'Tournament Admin', 'Franchise Owner', 'Spectator', 'Scorer'] },
    { id: 'reports', label: 'Analytics & Reports', icon: BarChart3, roles: ['Super Admin', 'Tournament Admin', 'Franchise Owner'] }
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-cricket-border/50 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Tournament Select */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 via-amber-400 to-yellow-300 flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <Trophy className="w-6 h-6 text-black stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-white tracking-tight flex items-center gap-2">
              CRICKET AUCTION <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">v1.0 Pro</span>
            </h1>
            <p className="text-xs text-gray-400 font-medium">End-to-End Tournament & Auction Platform</p>
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

        {/* Role Switcher Toolbar */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
          <span className="text-xs text-gray-400 font-semibold whitespace-nowrap mr-1">Switch Role:</span>
          {roles.map(r => (
            <button
              key={r}
              onClick={() => {
                loginDemoUser(r);
                if (r === 'Auction Operator') setActiveTab('auction-operator');
                else if (r === 'Franchise Owner') setActiveTab('auction-bidding');
                else if (r === 'Player') setActiveTab('player-register');
                else if (r === 'Scorer') setActiveTab('match-scorer');
              }}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all duration-200 font-medium whitespace-nowrap ${
                currentRole === r
                  ? `${formatRoleColor(r)} shadow-md font-bold scale-105`
                  : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:border-gray-700 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <nav className="max-w-7xl mx-auto flex items-center space-x-1 mt-3 overflow-x-auto border-t border-gray-800/60 pt-2 scrollbar-none">
        {navItems
          .filter(item => item.roles.includes(currentRole) || currentRole === 'Super Admin')
          .map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
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
