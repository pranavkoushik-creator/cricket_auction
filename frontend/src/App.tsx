import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { AnalyticsReportsView } from './views/AnalyticsReportsView';
import { LoginView } from './views/LoginView';

const MainContent: React.FC = () => {
  const { isAuthenticated, currentRole } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Set default tab based on authenticated role
  useEffect(() => {
    if (isAuthenticated) {
      if (currentRole === 'Super Admin') {
        setActiveTab('dashboard');
      } else if (currentRole === 'Franchise Owner') {
        setActiveTab('auction-bidding');
      } else if (currentRole === 'Player') {
        setActiveTab('player-register');
      }
    }
  }, [isAuthenticated, currentRole]);

  // Render Login Screen if not authenticated
  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-cricket-dark flex flex-col font-sans text-gray-100 selection:bg-yellow-500 selection:text-black">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        {activeTab === 'dashboard' && currentRole === 'Super Admin' && <DashboardView setActiveTab={setActiveTab} />}
        {activeTab === 'auction-operator' && currentRole === 'Super Admin' && <LiveAuctionOperatorView />}
        {activeTab === 'auction-bidding' && (currentRole === 'Super Admin' || currentRole === 'Franchise Owner') && <LiveAuctionBiddingView />}
        {activeTab === 'auction-spectator' && <SpectatorAuctionView />}
        {activeTab === 'player-register' && (currentRole === 'Super Admin' || currentRole === 'Player') && <PlayerRegistrationView />}
        {activeTab === 'players-approval' && currentRole === 'Super Admin' && <PlayerApprovalQueueView />}
        {activeTab === 'franchises' && (currentRole === 'Super Admin' || currentRole === 'Franchise Owner') && <FranchiseManagementView />}
        {activeTab === 'match-scorer' && currentRole === 'Super Admin' && <LiveScorerConsoleView />}
        {activeTab === 'reports' && (currentRole === 'Super Admin' || currentRole === 'Franchise Owner') && <AnalyticsReportsView />}
      </main>

      <footer className="glass-panel border-t border-cricket-border/40 py-4 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between px-4 gap-2">
          <p>© 2026 Sports Tournament & Player Auction Management Platform · Role-Based JWT Secure Portal</p>
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
