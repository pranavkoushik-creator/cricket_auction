import React from 'react';
import { X } from 'lucide-react';

/**
 * Shared dialog chrome for the Match Control Console panels, matching the
 * overlay style used by RulesConsentModal / ResetPasswordModal.
 */
export const ConsoleModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}> = ({ isOpen, onClose, title, subtitle, icon, children, wide }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`glass-panel rounded-2xl border border-cricket-border/60 w-full my-8 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="auction-banner-header px-4 py-3 rounded-t-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <div className="min-w-0">
              <p className="font-black text-sm uppercase tracking-wider truncate">{title}</p>
              {subtitle && <p className="text-[11px] font-bold opacity-80 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-black/20 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
};
