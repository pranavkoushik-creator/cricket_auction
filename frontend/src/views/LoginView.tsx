import React, { useState } from 'react';
import { Trophy, Eye, EyeOff, Mail, Lock, Zap, Radio } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginViewProps {
  onLogin: () => void;
  onViewLiveAuction: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onViewLiveAuction }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      setIsLoading(false);
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-cricket-dark flex items-center justify-center overflow-hidden px-4 py-6 font-sans">

      {/* ── Animated background orbs ── */}
      <div className="absolute -top-36 -left-24 w-[480px] h-[480px] rounded-full bg-yellow-500/10 blur-[100px] pointer-events-none animate-[orbDrift_12s_ease-in-out_infinite_alternate]" />
      <div className="absolute -bottom-28 -right-20 w-[420px] h-[420px] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none animate-[orbDrift_12s_ease-in-out_4s_infinite_alternate]" />
      <div className="absolute top-1/2 left-[60%] w-[300px] h-[300px] rounded-full bg-emerald-500/8 blur-[100px] pointer-events-none animate-[orbDrift_12s_ease-in-out_2s_infinite_alternate]" />

      {/* ── Subtle grid overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* ── Page content ── */}
      <div className="relative z-10 flex flex-col items-center gap-7 w-full max-w-[460px]">

        {/* ── League Heading ── */}
        <div className="flex items-center gap-4">
          <img src="/sakha_logo.png" alt="Sakha Logo" className="h-14 sm:h-16 w-auto object-contain bg-white px-3 py-1.5 rounded-xl shadow-xl shrink-0" />
          <div>
            <h1 className="text-[1.7rem] font-black text-white tracking-tight leading-tight m-0"
              style={{ textShadow: '0 0 32px rgba(255,184,0,0.25)' }}>
              SAKHA SPORTS LEAGUE{' '}
              <span className="text-cricket-gold">2026</span>
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-1 tracking-wide">
              End-to-End Tournament &amp; Auction Management Platform
            </p>
          </div>
        </div>

        {/* ── Login Card ── */}
        <div className="relative w-full rounded-3xl">
          {/* Animated gradient border glow */}
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-yellow-500/35 via-blue-500/35 to-emerald-500/20 z-0 animate-[cardGlow_4s_ease-in-out_infinite_alternate]" />

          {/* Card body */}
          <div className="relative z-10 glass-panel rounded-3xl border border-white/7 px-9 pt-9 pb-8">

            {/* Card heading */}
            <div className="flex flex-col items-center gap-2.5 mb-7">
              <h2
                className="text-[1.6rem] font-black tracking-[4px] m-0"
                style={{
                  background: 'linear-gradient(90deg,#FFB800,#ffffff,#3B82F6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                LOGIN
              </h2>
              <p className="text-xs text-gray-600 font-medium m-0">
                Secure access to your dashboard
              </p>
            </div>

            {/* ── Form ── */}
            <form onSubmit={handleLogin} className="flex flex-col gap-[18px]" noValidate>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-email" className="text-[0.72rem] font-semibold text-gray-400 uppercase tracking-[0.06em]">
                  Email Address
                </label>
                <div className="relative flex items-center group">
                  <Mail className="absolute left-3.5 w-4 h-4 text-gray-600 pointer-events-none transition-colors duration-200 group-focus-within:text-cricket-gold" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full pl-[42px] pr-3.5 py-3 bg-cricket-dark/70 border border-cricket-border/90 rounded-xl text-gray-100 text-[0.9rem] font-sans placeholder:text-gray-700 outline-none transition-all duration-200 focus:border-cricket-gold focus:bg-cricket-dark focus:shadow-[0_0_0_3px_rgba(255,184,0,0.12)] box-border"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-password" className="text-[0.72rem] font-semibold text-gray-400 uppercase tracking-[0.06em]">
                  Password
                </label>
                <div className="relative flex items-center group">
                  <Lock className="absolute left-3.5 w-4 h-4 text-gray-600 pointer-events-none transition-colors duration-200 group-focus-within:text-cricket-gold" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full pl-[42px] pr-11 py-3 bg-cricket-dark/70 border border-cricket-border/90 rounded-xl text-gray-100 text-[0.9rem] font-sans placeholder:text-gray-700 outline-none transition-all duration-200 focus:border-cricket-gold focus:bg-cricket-dark focus:shadow-[0_0_0_3px_rgba(255,184,0,0.12)] box-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 text-gray-600 hover:text-cricket-gold hover:bg-yellow-500/8 p-1 rounded-md transition-colors duration-200 flex items-center justify-center"
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-[0.78rem] text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2 m-0">
                  {error}
                </p>
              )}

              {/* Submit button */}
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="mt-1 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-br from-yellow-400 via-amber-400 to-yellow-300 text-black font-extrabold text-[0.88rem] tracking-[2px] border-none cursor-pointer shadow-[0_4px_20px_rgba(255,184,0,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(255,184,0,0.5)] hover:brightness-105 active:translate-y-0 active:shadow-[0_2px_12px_rgba(255,184,0,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="w-[18px] h-[18px] rounded-full border-[2.5px] border-black/20 border-t-black animate-spin inline-block" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    LOGIN
                  </>
                )}
              </button>
            </form>

            {/* ── OR Divider ── */}
            <div className="flex items-center gap-3 my-6">
              <span className="flex-1 h-px bg-gradient-to-r from-transparent via-cricket-border/80 to-transparent" />
              <span className="text-[0.72rem] font-bold text-gray-600 tracking-[2px] px-3 py-1 border border-cricket-border/70 rounded-full bg-cricket-dark/50">
                OR
              </span>
              <span className="flex-1 h-px bg-gradient-to-r from-transparent via-cricket-border/80 to-transparent" />
            </div>

            {/* ── View Live Auction ── */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-[0.82rem] text-gray-500 font-medium m-0">
                Click here to View{' '}
                <span className="text-cricket-accent font-bold">LIVE AUCTION</span>
              </p>
              <button
                id="view-live-auction-btn"
                type="button"
                onClick={onViewLiveAuction}
                className="w-full flex items-center justify-center gap-2 py-3 px-7 rounded-xl bg-transparent border border-cricket-accent/50 text-cricket-accent font-bold text-[0.82rem] tracking-[1.5px] cursor-pointer transition-all duration-200 hover:border-cricket-accent hover:text-blue-400 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:-translate-y-px active:translate-y-0"
              >
                <Radio className="w-4 h-4 animate-pulse" />
                VIEW LIVE AUCTION
              </button>
            </div>

          </div>{/* /card-inner */}
        </div>{/* /card */}

        {/* Footer */}
        <p className="text-[0.68rem] text-gray-700 text-center m-0 tracking-wide">
          © 2026 Sakha Sports League · Powered by Real-Time WebSocket Engine
        </p>
      </div>

      {/* Minimal keyframe definitions that Tailwind can't express via utilities */}
      <style>{`
        @keyframes orbDrift {
          0%   { transform: translate(0,0) scale(1); }
          100% { transform: translate(30px,40px) scale(1.08); }
        }
        @keyframes cardGlow {
          0%   { opacity: 0.55; }
          100% { opacity: 1; }
        }
        @media (max-width: 480px) {
          .login-card-inner { padding: 28px 20px 24px; }
        }
      `}</style>
    </div>
  );
};