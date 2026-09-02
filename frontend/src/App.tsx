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
import { LiveMatchBroadcastView } from './views/LiveMatchBroadcastView';
import { LiveMatchScorerView } from './views/LiveMatchScorerView';
import { PlayerAnalyticsView } from './views/PlayerAnalyticsView';
import { AnalyticsReportsView } from './views/AnalyticsReportsView';
import { LoginView } from './views/LoginView';
import { RulesConsentModal } from './components/RulesConsentModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';

const MainContent: React.FC = () => {
  const { isAuthenticated, currentRole, user, recordRulesAcceptedLocally } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showSpectatorView, setShowSpectatorView] = useState(false);
  const [publicFeed, setPublicFeed] = useState<'auction' | 'match'>('auction');
  const [isRulesReferenceOpen, setIsRulesReferenceOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);

  // Franchise Owners must accept rules before interacting
  const isMandatoryRulesOpen = Boolean(isAuthenticated && currentRole === 'Franchise Owner' && !user?.rules_accepted_at);

  // Set default tab based on authenticated role
  useEffect(() => {
    if (isAuthenticated) {
      if (currentRole === 'Super Admin') {
        setActiveTab('dashboard');
      } else if (currentRole === 'Franchise Owner') {
        setActiveTab('auction-bidding');
      }
      // else if (currentRole === 'Player') {
      //   setActiveTab('player-register');
      // }
    }
  }, [isAuthenticated, currentRole]);

  // Render Login Screen (or the public spectator view) if not authenticated
  if (!isAuthenticated) {
    if (showSpectatorView) {
      return (
        <div className="min-h-screen bg-cricket-dark flex flex-col font-sans text-gray-100">
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <button
                onClick={() => setShowSpectatorView(false)}
                className="text-xs font-bold text-gray-400 hover:text-cricket-gold transition"
              >
                ← Back to Login
              </button>

              {/* Public viewers can follow either broadcast without signing in */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-900/60 border border-cricket-border/50">
                {([
                  { id: 'auction', label: 'Live Auction' },
                  { id: 'match', label: 'Live Match' }
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPublicFeed(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${publicFeed === opt.id
                      ? 'bg-blue-600/25 text-blue-300 border border-blue-500/40'
                      : 'text-gray-400 hover:text-gray-200'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {publicFeed === 'auction' ? <SpectatorAuctionView /> : <LiveMatchBroadcastView publicMode />}
          </main>
        </div>
      );
    }

    return (
      <LoginView
        onLogin={() => setShowSpectatorView(false)}
        onViewLiveAuction={() => setShowSpectatorView(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cricket-dark flex flex-col font-sans text-gray-100 selection:bg-yellow-500 selection:text-black">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenRules={() => setIsRulesReferenceOpen(true)}
        onOpenResetPassword={() => setIsResetPasswordOpen(true)}
      />

      {/* Mandatory Rules Consent Overlay for Franchise Owners */}
      {isMandatoryRulesOpen && (
        <RulesConsentModal
          isOpen={true}
          isMandatory={true}
          onAccept={recordRulesAcceptedLocally}
        />
      )}

      {/* Reference Rules Modal (triggerable via Navbar button) */}
      {!isMandatoryRulesOpen && isRulesReferenceOpen && (
        <RulesConsentModal
          isOpen={true}
          isMandatory={false}
          onClose={() => setIsRulesReferenceOpen(false)}
        />
      )}

      {/* Admin Reset Password Modal */}
      {isResetPasswordOpen && (
        <ResetPasswordModal
          isOpen={true}
          onClose={() => setIsResetPasswordOpen(false)}
        />
      )}

      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 md:p-6">
        {activeTab === 'dashboard' && currentRole === 'Super Admin' && <DashboardView setActiveTab={setActiveTab} />}
        {activeTab === 'auction-operator' && currentRole === 'Super Admin' && <LiveAuctionOperatorView />}
        {activeTab === 'auction-bidding' && (currentRole === 'Super Admin' || currentRole === 'Franchise Owner') && <LiveAuctionBiddingView />}
        {activeTab === 'auction-spectator' && <SpectatorAuctionView />}
        {activeTab === 'player-register' && (currentRole === 'Super Admin' || currentRole === 'Player') && <PlayerRegistrationView />}
        {activeTab === 'players-approval' && currentRole === 'Super Admin' && <PlayerApprovalQueueView />}
        {activeTab === 'franchises' && (currentRole === 'Super Admin' || currentRole === 'Franchise Owner') && <FranchiseManagementView />}
        {activeTab === 'match-scorer' && currentRole === 'Super Admin' && <LiveScorerConsoleView />}
        {activeTab === 'match-control' && currentRole === 'Super Admin' && <LiveMatchScorerView />}
        {activeTab === 'match-live' && <LiveMatchBroadcastView />}
        {activeTab === 'player-analytics' && <PlayerAnalyticsView />}
        {activeTab === 'reports' && (currentRole === 'Super Admin' || currentRole === 'Franchise Owner') && <AnalyticsReportsView />}
      </main>

      <footer className="glass-panel border-t border-cricket-border/40 py-4 text-center text-xs text-gray-500">
        <div className="max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between px-4 gap-3">
          <div className="flex items-center gap-2">
            <img src="/sakha_logo.png" alt="Sakha Logo" className="h-6 w-auto object-contain bg-white px-1.5 py-0.5 rounded shadow-sm opacity-90" />
            <p>© 2026 Sakha Sports Tournament &amp; Player Auction Platform</p>
          </div>
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
