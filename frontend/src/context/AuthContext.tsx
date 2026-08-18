import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole, Tournament } from '../types';
import { apiRequest } from '../utils/api';

interface AuthContextType {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  currentRole: UserRole;
  currentTournamentId: string;
  tournaments: Tournament[];
  selectedFranchiseId: string;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  setSelectedFranchiseId: (id: string) => void;
  setCurrentTournamentId: (id: string) => void;
  recordRulesAcceptedLocally: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentTournamentId, setCurrentTournamentId] = useState<string>('tour-ipl-2026');
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const recordRulesAcceptedLocally = () => {
    if (!user) return;
    const updatedUser = { ...user, rules_accepted_at: new Date().toISOString() };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  // Automatically update selectedFranchiseId if Franchise Owner
  useEffect(() => {
    if (user && user.role === 'Franchise Owner' && user.franchise_id) {
      setSelectedFranchiseId(user.franchise_id);
    }
  }, [user]);

  // 1. Validate token session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      apiRequest('/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` }
      })
        .then(u => {
          setUser(u);
          localStorage.setItem('user', JSON.stringify(u));
        })
        .catch(() => {
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        });
    }
  }, []);

  // 2. Fetch tournaments whenever token becomes available
  useEffect(() => {
    const activeToken = token || localStorage.getItem('token');
    if (!activeToken) return;

    apiRequest('/tournaments')
      .then(res => {
        setTournaments(res);
        if (res.length > 0) {
          setCurrentTournamentId(res[0].id);
        }
      })
      .catch(console.error);
  }, [token]);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));

    if (res.user.role === 'Franchise Owner' && res.user.franchise_id) {
      setSelectedFranchiseId(res.user.franchise_id);
    }

    return res.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const currentRole: UserRole = user?.role || 'Super Admin';
  const isAuthenticated = Boolean(token && user);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated,
        currentRole,
        currentTournamentId,
        tournaments,
        selectedFranchiseId,
        login,
        logout,
        setSelectedFranchiseId,
        setCurrentTournamentId,
        recordRulesAcceptedLocally
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
