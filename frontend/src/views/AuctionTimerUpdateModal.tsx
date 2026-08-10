import React, { useEffect, useState } from 'react';
import { Clock, X } from 'lucide-react';

interface AuctionTimerUpdateModalProps {
    isOpen: boolean;
    defaultSeconds: number;
    onClose: () => void;
    onUpdateTimer: (seconds: number) => Promise<void>;
    onAuctionStart: () => void;
}

// Converts raw seconds into a readable "Xm Ys" style breakdown once the
// value crosses 60s, cascading up through minutes/hours as needed.
const formatDuration = (totalSeconds: number): string => {
    const s = Math.max(0, Math.floor(totalSeconds));
    if (s < 60) return `${s} sec`;

    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} hr`);
    if (minutes > 0) parts.push(`${minutes} min`);
    if (seconds > 0) parts.push(`${seconds} sec`);
    return parts.join(' ');
};

export const AuctionTimerUpdateModal: React.FC<AuctionTimerUpdateModalProps> = ({
    isOpen,
    defaultSeconds,
    onClose,
    onUpdateTimer,
    onAuctionStart
}) => {
    const [seconds, setSeconds] = useState<number>(defaultSeconds);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset local state every time the modal is freshly opened
    useEffect(() => {
        if (isOpen) {
            setSeconds(defaultSeconds);
            setSaving(false);
            setShowSuccess(false);
            setError(null);
        }
    }, [isOpen, defaultSeconds]);

    if (!isOpen) return null;

    const handleUpdateTimer = async () => {
        if (!seconds || seconds <= 0) {
            setError('Please enter a valid time in seconds.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await onUpdateTimer(seconds);
            setSaving(false);
            setShowSuccess(true);
            onAuctionStart();
        } catch (err: any) {
            setSaving(false);
            setError(err.message || 'Failed to update timer. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-panel w-full max-w-sm rounded-2xl border border-yellow-500/30 p-6 space-y-5 relative shadow-2xl">
                {!showSuccess && (
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
                <div className="flex items-center gap-2.5 border-b border-gray-800 pb-4">
                    <div className="w-9 h-9 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center border border-yellow-500/40">
                        <Clock className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-extrabold text-white">Auction Timer Update</h3>
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Timer Duration (in seconds)
                    </label>
                    <input
                        type="number"
                        min={1}
                        value={seconds}
                        onChange={e => setSeconds(Number(e.target.value))}
                        className="w-full bg-gray-900 text-white text-sm border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30"
                        placeholder="e.g. 15"
                    />
                    {seconds > 60 && (
                        <p className="text-[11px] text-gray-500">≈ {formatDuration(seconds)}</p>
                    )}
                    {error && (
                        <p className="text-[11px] text-red-400 font-semibold">{error}</p>
                    )}
                </div>

                <button
                    onClick={handleUpdateTimer}
                    disabled={saving}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:brightness-110 text-black font-extrabold text-sm shadow-lg shadow-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    {saving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            <span>UPDATING...</span>
                        </>
                    ) : (
                        <span>Update Timer</span>
                    )}
                </button>
            </div>
        </div>
    );
};