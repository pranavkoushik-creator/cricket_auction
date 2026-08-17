import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { CheckCircle2, Send } from 'lucide-react';

export const PlayerRegistrationView: React.FC = () => {
  const { currentTournamentId } = useAuth();
  const [formData, setFormData] = useState({
    name: 'Shreyas Iyer',
    group_name: 'GROUP A',
    role: 'Batsman',
    is_foreign: 0,
    status: 'Newcomer',
    base_price: 200,
    photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    document_url: 'https://example.com/id-proof.pdf',
    matches: 101,
    runs: 2776,
    wickets: 0
  });

  const [submitted, setSubmitted] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    apiRequest('/players', {
      method: 'POST',
      body: JSON.stringify({
        ...formData,
        tournament_id: currentTournamentId,
        stats: {
          matches: formData.matches,
          runs: formData.runs,
          wickets: formData.wickets
        }
      })
    })
      .then(res => setSubmitted(res))
      .catch(err => setError(err.message));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 flex items-center space-x-4">
        <img src="/sakha_logo.png" alt="Sakha Logo" className="h-10 sm:h-12 w-auto object-contain bg-white px-2.5 py-1 rounded-lg shadow-md shrink-0" />
        <div>
          <h2 className="text-xl font-extrabold text-white">SAKHA PLAYER SELF-REGISTRATION PORTAL</h2>
          <p className="text-xs text-gray-400">Register to participate in the IPL 2026 Mega Auction lot queue</p>
        </div>
      </div>

      {submitted ? (
        <div className="glass-panel p-8 rounded-2xl border border-emerald-500/40 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
          <h3 className="text-2xl font-bold text-white">Registration Submitted Successfully!</h3>
          <p className="text-xs text-gray-300">
            Registration ID: <span className="font-mono text-yellow-400 font-bold">{submitted.id}</span>
          </p>
          <div className="inline-block px-4 py-1.5 rounded-full bg-yellow-500/20 text-yellow-300 font-bold text-xs border border-yellow-500/40">
            Status: PENDING ADMIN REVIEW
          </div>
          <button
            onClick={() => setSubmitted(null)}
            className="block mx-auto px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs border border-gray-700 mt-4"
          >
            Register Another Player
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl border border-gray-800 space-y-5">
          {error && <div className="p-3 bg-red-950/80 border border-red-500 rounded-xl text-red-200 text-xs">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Full Player Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-900 text-white text-sm border border-gray-800 rounded-xl p-2.5 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Base Price Tier</label>
              <select
                value={formData.base_price}
                onChange={e => setFormData({ ...formData, base_price: Number(e.target.value) })}
                className="w-full bg-gray-900 text-white text-sm border border-gray-800 rounded-xl p-2.5 focus:outline-none focus:border-cyan-500"
              >
                <option value={200}>₹200</option>
                <option value={150}>₹150</option>
                <option value={100}>₹100</option>
                <option value={50}>₹50</option>
                <option value={20}>₹20</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Group</label>
              <select
                value={formData.group_name}
                onChange={e => setFormData({ ...formData, group_name: e.target.value })}
                className="w-full bg-gray-900 text-white text-sm border border-gray-800 rounded-xl p-2.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="GROUP A">GROUP A</option>
                <option value="GROUP B">GROUP B</option>
                <option value="GROUP C">GROUP C</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Player Specialization Role</label>
              <select
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                className="w-full bg-gray-900 text-white text-sm border border-gray-800 rounded-xl p-2.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="Batsman">Batsman</option>
                <option value="Bowler">Bowler</option>
                <option value="All-Rounder">All-Rounder</option>
                <option value="Wicket-Keeper">Wicket-Keeper</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Nationality</label>
              <div className="flex gap-4 items-center mt-2">
                <label className="flex items-center space-x-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    name="is_foreign"
                    checked={formData.is_foreign === 0}
                    onChange={() => setFormData({ ...formData, is_foreign: 0 })}
                  />
                  <span>Indian Player</span>
                </label>
                <label className="flex items-center space-x-2 text-xs text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    name="is_foreign"
                    checked={formData.is_foreign === 1}
                    onChange={() => setFormData({ ...formData, is_foreign: 1 })}
                  />
                  <span>Foreign Overseas</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-gray-900 text-white text-sm border border-gray-800 rounded-xl p-2.5 focus:outline-none focus:border-cyan-500"
              >
                <option value="Newcomer">Newcomer</option>
                <option value="Returning">Returning</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition"
            >
              <Send className="w-4 h-4" />
              <span>SUBMIT PLAYER REGISTRATION</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
