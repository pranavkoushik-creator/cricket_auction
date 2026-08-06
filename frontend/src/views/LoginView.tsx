import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Users, User, Lock, Mail, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export const LoginView: React.FC<{ onLoginSuccess?: () => void }> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      setLoading(false);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string) => {
    setLoading(true);
    setError(null);
    setEmail(demoEmail);
    setPassword('password123');

    try {
      await login(demoEmail, 'password123');
      setLoading(false);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Quick login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 glass-panel p-6 sm:p-8 rounded-3xl border border-gray-800 shadow-2xl relative overflow-hidden">
        
        {/* Left Side: Standard Login Form */}
        <div className="space-y-6 flex flex-col justify-center">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-black border border-yellow-500/30 uppercase">
              🔐 JWT SECURE AUTHENTICATION
            </div>
            <h1 className="text-3xl font-black text-white tracking-wide font-broadcast">
              SIGN IN TO PLATFORM
            </h1>
            <p className="text-xs text-gray-400">
              Access your role-based dashboard using your credentials.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2 animate-bounce">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleStandardLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="admin@platform.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:brightness-110 text-black font-black text-sm shadow-xl shadow-yellow-500/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  <span>SIGNING IN...</span>
                </>
              ) : (
                <>
                  <span>SIGN IN TO PORTAL</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-[11px] text-gray-500 text-center">
            Default demo password for all accounts: <span className="text-gray-300 font-mono">password123</span>
          </p>
        </div>

        {/* Right Side: Quick 1-Click Role Login Cards */}
        <div className="bg-gray-900/60 p-5 sm:p-6 rounded-2xl border border-gray-800 space-y-4 flex flex-col justify-center">
          <div className="border-b border-gray-800 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2 uppercase tracking-wide">
              <Users className="w-4 h-4 text-yellow-400" />
              <span>1-CLICK DEMO ROLE LOGIN</span>
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Select a role below to automatically authenticate with distinct permissions</p>
          </div>

          <div className="space-y-2.5">
            {/* Super Admin */}
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('admin@platform.com')}
              className="w-full p-3 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-left transition flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/40">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-white group-hover:text-purple-300 transition">SUPER ADMIN</p>
                  <p className="text-[10px] text-gray-400">admin@platform.com · Full Master Control</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition" />
            </button>

            {/* Franchise Owners Header */}
            <div className="pt-1">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1.5">FRANCHISE OWNERS (DEDICATED TEAM ACCOUNTS)</span>
              
              <div className="grid grid-cols-2 gap-2">
                {/* MI Owner */}
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('mi@franchise.com')}
                  className="p-2.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 text-left transition group"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">MI</span>
                    <div>
                      <p className="text-[11px] font-extrabold text-white">Mumbai Owner</p>
                      <p className="text-[9px] text-gray-400">mi@franchise.com</p>
                    </div>
                  </div>
                </button>

                {/* CSK Owner */}
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('csk@franchise.com')}
                  className="p-2.5 rounded-xl bg-yellow-950/40 hover:bg-yellow-900/60 border border-yellow-500/30 text-left transition group"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded bg-yellow-500 text-black text-[10px] font-black flex items-center justify-center">CSK</span>
                    <div>
                      <p className="text-[11px] font-extrabold text-white">Chennai Owner</p>
                      <p className="text-[9px] text-gray-400">csk@franchise.com</p>
                    </div>
                  </div>
                </button>

                {/* RCB Owner */}
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('rcb@franchise.com')}
                  className="p-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-left transition group"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded bg-red-600 text-white text-[10px] font-black flex items-center justify-center">RCB</span>
                    <div>
                      <p className="text-[11px] font-extrabold text-white">RCB Owner</p>
                      <p className="text-[9px] text-gray-400">rcb@franchise.com</p>
                    </div>
                  </div>
                </button>

                {/* DC Owner */}
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('dc@franchise.com')}
                  className="p-2.5 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-left transition group"
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center">DC</span>
                    <div>
                      <p className="text-[11px] font-extrabold text-white">Delhi Owner</p>
                      <p className="text-[9px] text-gray-400">dc@franchise.com</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Registered Player */}
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('player@cricket.com')}
              className="w-full p-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-left transition flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/40">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-white group-hover:text-emerald-300 transition">REGISTERED PLAYER</p>
                  <p className="text-[10px] text-gray-400">player@cricket.com · Registration & Status Tracker</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
