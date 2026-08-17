import React, { useEffect, useState } from 'react';
import { X, Timer, TimerOff } from 'lucide-react';

interface AuctionTimerUpdateModalProps {
    isOpen: boolean;
    defaultSeconds: number;
    defaultEnabled?: boolean;
    onClose: () => void;
    onUpdateTimer: (seconds: number, timerEnabled: boolean) => Promise<void>;
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
    defaultEnabled = true,
    onClose,
    onUpdateTimer,
    onAuctionStart
}) => {
    const [seconds, setSeconds] = useState<number>(defaultSeconds);
    const [timerEnabled, setTimerEnabled] = useState<boolean>(defaultEnabled);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset local state every time the modal is freshly opened
    useEffect(() => {
        if (isOpen) {
            setSeconds(defaultSeconds);
            setTimerEnabled(defaultEnabled ?? true);
            setSaving(false);
            setShowSuccess(false);
            setError(null);
        }
    }, [isOpen, defaultSeconds, defaultEnabled]);

    if (!isOpen) return null;

    const handleUpdateTimer = async () => {
        if (timerEnabled && (!seconds || seconds <= 0)) {
            setError('Please enter a valid time in seconds.');
            return;
        }
        setError(null);
        setSaving(true);
        try {
            await onUpdateTimer(seconds, timerEnabled);
            setSaving(false);
            setShowSuccess(true);
            onAuctionStart();
        } catch (err: any) {
            setSaving(false);
            setError(err.message || 'Failed to update timer. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-panel w-full max-w-sm rounded-2xl border border-yellow-500/30 bg-gray-950 p-6 space-y-5 relative shadow-2xl">
                {!showSuccess && (
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition disabled:opacity-30 disabled:cursor-not-allowed p-1 rounded-lg hover:bg-gray-800"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
                <div className="flex items-center gap-2.5 border-b border-gray-800 pb-4">
                    <div className="w-9 h-9 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center border border-yellow-500/40">
                        {timerEnabled ? <Timer className="w-4 h-4" /> : <TimerOff className="w-4 h-4 text-red-400" />}
                    </div>
                    <div>
                        <h3 className="text-base font-extrabold text-white">Auction Timer Update</h3>
                        <p className="text-[11px] text-gray-400">Configure timer duration & toggle option</p>
                    </div>
                </div>

                {/* Enable / Disable Timer Toggle Switch */}
                <div className="bg-gray-900/80 rounded-xl p-3.5 border border-gray-800 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {timerEnabled ? (
                                <Timer className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <TimerOff className="w-4 h-4 text-red-400" />
                            )}
                            <span className="text-xs font-bold text-white uppercase tracking-wide">
                                Countdown Timer
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setTimerEnabled(!timerEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                timerEnabled ? 'bg-emerald-500' : 'bg-gray-700'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    timerEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                    <p className={`text-[11px] ${timerEnabled ? 'text-emerald-400' : 'text-amber-400 font-medium'}`}>
                        {timerEnabled
                            ? '✓ Timer Enabled — Lot auto-closes when countdown hits 00:00'
                            : '🚫 Timer Turned OFF — Lot remains open until operator closes it manually'}
                    </p>
                </div>

                {/* Timer Duration Input */}
                <div className={`space-y-2 transition-opacity ${!timerEnabled ? 'opacity-50' : 'opacity-100'}`}>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Timer Duration (in seconds)
                    </label>
                    <input
                        type="number"
                        min={1}
                        value={seconds}
                        disabled={!timerEnabled}
                        onChange={e => setSeconds(Number(e.target.value))}
                        className="w-full bg-gray-900 text-white text-sm border border-gray-700 rounded-xl p-3 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 disabled:cursor-not-allowed disabled:bg-gray-900/50"
                        placeholder="e.g. 15"
                    />
                    {timerEnabled && seconds > 60 && (
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
                        <span>{timerEnabled ? 'Update Timer' : 'Save & Start (Timer OFF)'}</span>
                    )}
                </button>
            </div>
        </div>
    );
};