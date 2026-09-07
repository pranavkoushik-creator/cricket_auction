import React from 'react';
import { useAuth } from '../context/AuthContext';
import { PointsTable } from '../components/match/PointsTableModal';

export const LiveScorerConsoleView: React.FC = () => {
  const { currentTournamentId } = useAuth();

  return (
    <div className="max-w-4xl mx-auto bg-gray-900/40 rounded-2xl border border-cricket-border/50 p-4 shadow-xl">
      <PointsTable tournamentId={currentTournamentId} />
    </div>
  );
};
