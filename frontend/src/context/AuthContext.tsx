import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole, Tournament } from '../types';
import { apiRequest } from '../utils/api';

interface AuthContextType {
  user: User | null;
  currentRole: UserRole;
  currentTournamentId: string;
  tournaments: Tournament[];
  selectedFranchiseId: string;
  setUserRole: (role: UserRole) => void;
  setSelectedFranchiseId: (id: string) => void;
  setCurrentTournamentId: (id: string) => void;
  loginDemoUser: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>({
    id: 'usr-admin',
    name: 'Pranav Koushik',
    email: 'admin@platform.com',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  });
  const [currentRole, setCurrentRole] = useState<UserRole>('Super Admin');
  const [currentTournamentId, setCurrentTournamentId] = useState<string>('tour-ipl-2026');
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('fran-mi');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    // Fetch tournaments on mount
    apiRequest('/tournaments')
      .then(res => {
        setTournaments(res);
        if (res.length > 0) {
          setCurrentTournamentId(res[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const loginDemoUser = (role: UserRole) => {
    setCurrentRole(role);
    switch (role) {
      case 'Super Admin':
        setUser({ id: 'usr-admin', name: 'Pranav Koushik (Super Admin)', email: 'admin@platform.com' });
        break;
      case 'Tournament Admin':
        setUser({ id: 'usr-organizer', name: 'Rajesh Sharma (Organizer)', email: 'organizer@t20.com' });
        break;
      case 'Auction Operator':
        setUser({ id: 'usr-operator', name: 'Richard Madley (Auctioneer)', email: 'operator@t20.com' });
        break;
      case 'Franchise Owner':
        setUser({ id: 'usr-owner-mi', name: 'Nita Ambani (MI Owner)', email: 'mi@franchise.com' });
        setSelectedFranchiseId('fran-mi');
        break;
      case 'Player':
        setUser({ id: 'usr-player', name: 'Virat Kohli (Registered Player)', email: 'player@cricket.com' });
        break;
      case 'Scorer':
        setUser({ id: 'usr-scorer', name: 'Nitin Menon (Match Official)', email: 'scorer@t20.com' });
        break;
      case 'Spectator':
        setUser({ id: 'usr-spectator', name: 'Cricket Spectator', email: 'fan@cricket.com' });
        break;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentRole,
        currentTournamentId,
        tournaments,
        selectedFranchiseId,
        setUserRole: setCurrentRole,
        setSelectedFranchiseId,
        setCurrentTournamentId,
        loginDemoUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
