import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Navbar } from './components/Navbar';
import { DashboardView } from './views/DashboardView';
import { LiveAuctionOperatorView } from './views/LiveAuctionOperatorView';
import { LiveAuctionBiddingView } from './views/LiveAuctionBiddingView';
import { SpectatorAuctionView } from './views/SpectatorAuctionView';
import { PlayerRegistrationView } from './views/PlayerRegistrationView';
import { PlayerApprovalQueueView } from './views/PlayerApprovalQueueView';
import { FranchiseManagementView } from './views/FranchiseManagementView';
import { LiveScorerConsoleView } from './views/LiveScorerConsoleView';
import { MatchSchedulerView } from './views/MatchSchedulerView';
import { AnalyticsReportsView } from './views/AnalyticsReportsView';
import { LoginView } from './views/LoginView';

const MainContent: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Show login page first
  if (!isLoggedIn) {
    return (
      <LoginView
        onLogin={() => {
          setActiveTab('dashboard');
          setIsLoggedIn(true);
        }}
        onViewLiveAuction={() => {
          setActiveTab('auction-spectator');
          setIsLoggedIn(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cricket-dark flex flex-col font-sans text-gray-100 selection:bg-yellow-500 selection:text-black">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        {activeTab === 'dashboard' && <DashboardView setActiveTab={setActiveTab} />}
        {activeTab === 'auction-operator' && <LiveAuctionOperatorView />}
        {activeTab === 'auction-bidding' && <LiveAuctionBiddingView />}
        {activeTab === 'auction-spectator' && <SpectatorAuctionView />}
        {activeTab === 'player-register' && <PlayerRegistrationView />}
        {activeTab === 'players-approval' && <PlayerApprovalQueueView />}
        {activeTab === 'franchises' && <FranchiseManagementView />}
        {activeTab === 'match-scorer' && <LiveScorerConsoleView />}
        {activeTab === 'match-scheduler' && <MatchSchedulerView />}
        {activeTab === 'reports' && <AnalyticsReportsView />}
      </main>

      <footer className="glass-panel border-t border-cricket-border/40 py-4 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between px-4 gap-2">
          <p>© 2026 Sports Tournament & Player Auction Management Platform · Architected for CTO Review</p>
          <p className="text-gray-400 font-medium">Real-Time WebSocket Engine · Immutable Purse Ledger Enabled</p>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <MainContent />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
