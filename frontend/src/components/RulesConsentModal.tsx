import React, { useState } from 'react';
import { ShieldCheck, CheckSquare, Square, Gavel, DollarSign, Crown, Zap, AlertTriangle, X, FileText } from 'lucide-react';
import { apiRequest } from '../utils/api';

interface RulesConsentModalProps {
  isOpen: boolean;
  isMandatory?: boolean;
  onClose?: () => void;
  onAccept?: () => void;
}

export const RulesConsentModal: React.FC<RulesConsentModalProps> = ({
  isOpen,
  isMandatory = false,
  onClose,
  onAccept
}) => {
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAgree = async () => {
    if (!isChecked && isMandatory) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (isMandatory) {
        await apiRequest('/auth/accept-rules', { method: 'POST' });
      }
      if (onAccept) onAccept();
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit consent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel w-full max-w-3xl max-h-[90vh] rounded-3xl border-2 border-yellow-500/40 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 px-6 border-b border-yellow-500/30 flex items-center justify-between shrink-0 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-black shrink-0" />
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-black uppercase tracking-wider font-broadcast">
                SAKHA PREMIER LEAGUE 2026 — RULES OF THE AUCTION
              </h2>
              <p className="text-xs font-bold text-gray-900">
                {isMandatory ? 'Mandatory Franchise Owner Rules Review & Agreement' : 'Official Tournament Rules & Regulations Reference'}
              </p>
            </div>
          </div>
          {!isMandatory && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-black/20 hover:bg-black/40 text-black font-bold transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Rules Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-gray-200 text-xs sm:text-sm">
          
          {isMandatory && (
            <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 text-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold leading-relaxed">
                As a registered <span className="font-extrabold text-yellow-300">Franchise Owner</span>, you must carefully study the mandatory rules below. Once agreed, your consent is recorded permanently.
              </p>
            </div>
          )}

          {/* RULE CARD 1: Purse & Squad Budget */}
          <div className="bg-gray-900/80 p-5 rounded-2xl border border-gray-800 space-y-2.5">
            <h3 className="text-base font-black text-yellow-400 flex items-center gap-2 uppercase tracking-wide font-broadcast">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              <span>1. Franchise Purse & Squad Size Limits</span>
            </h3>
            <ul className="list-disc list-inside space-y-1.5 text-gray-300 font-medium leading-relaxed pl-1 text-xs sm:text-sm">
              <li><strong className="text-white">Total Franchise Purse:</strong> Every franchise is allocated a total budget of <strong className="text-emerald-400 font-black">₹10.00 Lakhs (₹10,00,000)</strong>.</li>
              <li><strong className="text-white">Squad Size Requirement:</strong> Each franchise <strong className="text-yellow-400 font-extrabold">MUST complete a squad of exactly 7 Players</strong> by the end of the auction.</li>
            </ul>
          </div>

          {/* RULE CARD 2: Group Set Rules & Base Prices */}
          <div className="bg-gray-900/80 p-5 rounded-2xl border border-gray-800 space-y-2.5">
            <h3 className="text-base font-black text-yellow-400 flex items-center gap-2 uppercase tracking-wide font-broadcast">
              <FileText className="w-5 h-5 text-yellow-400" />
              <span>2. Player Group Composition & Base Prices</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="bg-gray-950 p-3.5 rounded-xl border border-yellow-500/30 text-center space-y-1">
                <span className="text-xs font-black text-yellow-300 block uppercase">GROUP A</span>
                <p className="text-xs font-bold text-white">Base: ₹1,00,000</p>
                <span className="text-[11px] text-gray-400 font-semibold block">Required: Exactly 2 Players</span>
              </div>
              <div className="bg-gray-950 p-3.5 rounded-xl border border-blue-500/30 text-center space-y-1">
                <span className="text-xs font-black text-blue-300 block uppercase">GROUP B</span>
                <p className="text-xs font-bold text-white">Base: ₹50,000</p>
                <span className="text-[11px] text-gray-400 font-semibold block">Required: 2 to 3 Players</span>
              </div>
              <div className="bg-gray-950 p-3.5 rounded-xl border border-emerald-500/30 text-center space-y-1">
                <span className="text-xs font-black text-emerald-300 block uppercase">GROUP C</span>
                <p className="text-xs font-bold text-white">Base: ₹25,000</p>
                <span className="text-[11px] text-gray-400 font-semibold block">Required: 2 to 3 Players</span>
              </div>
            </div>
          </div>

          {/* RULE CARD 3: Automatic Captaincy Rule */}
          <div className="bg-gray-900/80 p-5 rounded-2xl border border-gray-800 space-y-2.5">
            <h3 className="text-base font-black text-yellow-400 flex items-center gap-2 uppercase tracking-wide font-broadcast">
              <Crown className="w-5 h-5 text-yellow-400" />
              <span>3. Automatic Team Captaincy Rule</span>
            </h3>
            <p className="text-gray-300 font-medium leading-relaxed text-xs sm:text-sm">
              The <strong className="text-yellow-300 font-bold">FIRST Group A player</strong> purchased chronologically by a franchise automatically becomes the designated <strong className="text-yellow-400 font-black">Team Captain (👑 CAPT)</strong>.
            </p>
          </div>

          {/* RULE CARD 4: Automated Financial Guardrails & Increments */}
          <div className="bg-gray-900/80 p-5 rounded-2xl border border-gray-800 space-y-2.5">
            <h3 className="text-base font-black text-yellow-400 flex items-center gap-2 uppercase tracking-wide font-broadcast">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span>4. Dynamic Safe Bid Limits & Increments</span>
            </h3>
            <ul className="list-disc list-inside space-y-1.5 text-gray-300 font-medium leading-relaxed pl-1 text-xs sm:text-sm">
              <li><strong className="text-white">Max Safe Bid Limit:</strong> The platform dynamically calculates a hard safe limit for every bid. Bids that leave insufficient purse money to purchase remaining required squad slots at base price are <strong className="text-red-400 font-bold">automatically blocked</strong>.</li>
              <li><strong className="text-white">Quick Increments:</strong> Bid increases are executed using quick controls of <strong className="text-emerald-400 font-bold">+₹5,000, +₹10,000, +₹25,000, +₹50,000</strong>.</li>
            </ul>
          </div>

          {/* RULE CARD 5: Auction Controls & Admin Authority */}
          <div className="bg-gray-900/80 p-5 rounded-2xl border border-gray-800 space-y-2.5">
            <h3 className="text-base font-black text-yellow-400 flex items-center gap-2 uppercase tracking-wide font-broadcast">
              <Gavel className="w-5 h-5 text-yellow-400" />
              <span>5. Auctioneer Authority & Disqualification</span>
            </h3>
            <ul className="list-disc list-inside space-y-1.5 text-gray-300 font-medium leading-relaxed pl-1 text-xs sm:text-sm">
              <li><strong className="text-white">Timer & Closing:</strong> Lots feature a 15-second countdown timer. The Super Admin Auctioneer holds authority to pause, turn off timers, or manually close lots.</li>
              <li><strong className="text-white">Franchise Bidding Lock:</strong> Super Admin reserves the right to disable bidding for any franchise violating rules.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer & Consent Submission */}
        <div className="p-5 px-6 border-t border-gray-800 bg-gray-950 shrink-0 space-y-4">
          {error && (
            <p className="text-xs font-bold text-red-400 text-center">{error}</p>
          )}

          {isMandatory ? (
            <div className="space-y-4">
              <label
                onClick={() => setIsChecked(!isChecked)}
                className="flex items-start gap-3 cursor-pointer select-none p-3.5 rounded-2xl bg-gray-900 border border-gray-800 hover:border-yellow-500/40 transition"
              >
                <button
                  type="button"
                  className="mt-0.5 shrink-0 focus:outline-none"
                >
                  {isChecked ? (
                    <CheckSquare className="w-5 h-5 text-yellow-400" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                <span className="text-xs sm:text-sm font-bold text-gray-200 leading-snug">
                  I have read, understood, and agree to abide by all the Sakha Premier League 2026 Mega Auction Rules & Regulations.
                </span>
              </label>

              <button
                onClick={handleAgree}
                disabled={!isChecked || isSubmitting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:brightness-110 text-black font-black text-sm sm:text-base uppercase tracking-wider shadow-xl shadow-yellow-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                <span>{isSubmitting ? 'RECORDING CONSENT...' : 'AGREE & ENTER AUCTION ROOM'}</span>
                <ShieldCheck className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs sm:text-sm transition"
              >
                Close Rules
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
