import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarRange, Plus, Trash2, Wand2 } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { ConsoleModal } from './ConsoleModal';

interface FixtureRow {
  id: string;
  match_number: number;
  stage: string;
  venue: string | null;
  scheduled_time: string | null;
  status: 'upcoming' | 'live' | 'completed' | 'abandoned';
  home_team_id: string;
  away_team_id: string;
  home_team_name: string;
  home_team_short: string;
  away_team_name: string;
  away_team_short: string;
  result_summary?: string | null;
}

interface FranchiseRow {
  id: string;
  name: string;
  short_name: string;
}

const STATUS_TONE: Record<string, string> = {
  live: 'bg-red-600/20 text-red-300 border-red-500/40',
  completed: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
  upcoming: 'bg-gray-700/40 text-gray-300 border-gray-600/50',
  abandoned: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/40'
};

/**
 * Fixture management for the Match Control Console.
 *
 * The generator is a round robin over every franchise. Regenerating keeps
 * played matches by default and numbers new fixtures after them, so the
 * schedule never ends up with two "#3"s. A full rebuild is available but is
 * confirmed separately because it also clears the standings.
 */
export const FixtureManagerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  onChanged?: () => void;
}> = ({ isOpen, onClose, tournamentId, onChanged }) => {
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [franchises, setFranchises] = useState<FranchiseRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Generator options
  const [rounds, setRounds] = useState(1);
  const [wipeAll, setWipeAll] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [intervalDays, setIntervalDays] = useState(2);

  // Manual fixture
  const [homeId, setHomeId] = useState('');
  const [awayId, setAwayId] = useState('');
  const [venue, setVenue] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = () => {
    if (!tournamentId) return;
    Promise.all([
      apiRequest(`/matches?tournamentId=${tournamentId}`),
      apiRequest(`/franchises?tournamentId=${tournamentId}`)
    ])
      .then(([m, f]) => { setFixtures(m); setFranchises(f); setError(null); })
      .catch(err => setError(err.message));
  };

  useEffect(() => {
    if (isOpen) {
      load();
      setConfirmWipe(false);
      setConfirmDelete(null);
      setNotice(null);
    }
  }, [isOpen, tournamentId]);

  const played = fixtures.filter(f => f.status !== 'upcoming').length;
  const pairs = franchises.length >= 2 ? (franchises.length * (franchises.length - 1)) / 2 : 0;
  const willCreate = pairs * rounds;

  const run = (fn: () => Promise<any>, message: string) => {
    setBusy(true);
    setError(null);
    fn()
      .then(res => { setFixtures(res); setNotice(message); onChanged?.(); })
      .catch(err => setError(err.message))
      .finally(() => setBusy(false));
  };

  const generate = () => {
    run(
      () => apiRequest('/matches/generate', {
        method: 'POST',
        body: JSON.stringify({
          tournamentId,
          rounds,
          mode: wipeAll ? 'replace_all' : 'replace_upcoming',
          startDate,
          intervalDays
        })
      }),
      wipeAll ? 'Schedule rebuilt and standings cleared.' : 'Upcoming fixtures regenerated.'
    );
    setConfirmWipe(false);
  };

  const addManual = () => {
    run(
      () => apiRequest('/matches/fixtures/manual', {
        method: 'POST',
        body: JSON.stringify({ tournamentId, homeTeamId: homeId, awayTeamId: awayId, venue })
      }),
      'Fixture added.'
    );
    setHomeId(''); setAwayId(''); setVenue('');
  };

  const remove = (id: string) => {
    run(() => apiRequest(`/matches/fixtures/${id}`, { method: 'DELETE' }), 'Fixture deleted.');
    setConfirmDelete(null);
  };

  const removeAll = () => {
    run(() => apiRequest(`/matches/fixtures/all?tournamentId=${tournamentId}`, { method: 'DELETE' }), 'All fixtures deleted and schedule cleared.');
    setConfirmWipe(false);
  };

  const label = 'text-[9px] font-black uppercase tracking-[0.15em] text-gray-500';
  const input = 'mt-1 w-full bg-cricket-card text-xs text-gray-200 border border-cricket-border rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500';

  return (
    <ConsoleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Fixtures"
      subtitle={`${fixtures.length} scheduled · ${played} played · ${franchises.length} teams`}
      icon={<CalendarRange className="w-4 h-4 shrink-0" />}
      wide
    >
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs font-bold text-red-300">{error}</p>
        </div>
      )}
      {notice && !error && (
        <p className="text-xs font-bold text-emerald-300 mb-3">{notice}</p>
      )}

      {/* ---------------- Round-robin generator ---------------- */}
      <div className="glass-card rounded-xl border border-cricket-border/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-3.5 h-3.5 text-cricket-gold" />
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">Round Robin Generator</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <span className={label}>Format</span>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {[
                { n: 1, t: 'Single', h: 'Each pair once' },
                { n: 2, t: 'Home & Away', h: 'Each pair twice' }
              ].map(o => (
                <button
                  key={o.n}
                  onClick={() => setRounds(o.n)}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-black border transition ${rounds === o.n
                    ? 'bg-blue-600/25 text-blue-300 border-blue-500/40'
                    : 'bg-gray-900/50 text-gray-400 border-cricket-border/50 hover:text-gray-200'
                    }`}
                >
                  <span className="block">{o.t}</span>
                  <span className="block text-[8px] opacity-70 font-bold">{o.h}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className={label}>First Match Date</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={input} />
          </label>

          <label className="block">
            <span className={label}>Days Between</span>
            <input
              type="number" min={0} max={30}
              value={intervalDays}
              onChange={e => setIntervalDays(Number(e.target.value))}
              className={`${input} tabular-nums`}
            />
          </label>
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={wipeAll}
            onChange={e => { setWipeAll(e.target.checked); setConfirmWipe(false); }}
            className="mt-0.5 accent-red-500"
          />
          <span className="text-[11px] font-bold text-gray-300 leading-snug">
            Rebuild the whole schedule
            <span className="block text-[10px] font-semibold text-gray-500">
              Off: played matches are kept and new fixtures are numbered after them.
              On: every fixture and result is deleted and the points table is cleared.
            </span>
          </span>
        </label>

        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <p className="text-[11px] font-bold text-gray-400">
            Will create <span className="text-white tabular-nums">{willCreate}</span> fixture{willCreate === 1 ? '' : 's'}
            {!wipeAll && played > 0 && <span className="text-gray-500"> · keeping {played} played</span>}
          </p>

          {wipeAll && !confirmWipe ? (
            <button
              disabled={busy || franchises.length < 2}
              onClick={() => setConfirmWipe(true)}
              className="px-3 py-2 rounded-xl bg-red-600/25 hover:bg-red-600/40 text-red-300 border border-red-500/50 font-black text-[11px] transition disabled:opacity-30"
            >
              Rebuild Schedule…
            </button>
          ) : wipeAll && confirmWipe ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-red-300">Delete all results?</span>
              <button onClick={() => setConfirmWipe(false)} className="px-2.5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600/50 font-bold text-[11px]">Cancel</button>
              <button disabled={busy} onClick={generate} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white border border-red-400 font-black text-[11px] disabled:opacity-40">Yes, rebuild</button>
            </div>
          ) : (
            <button
              disabled={busy || franchises.length < 2}
              onClick={generate}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] transition disabled:opacity-30"
            >
              Generate Fixtures
            </button>
          )}
        </div>

        {franchises.length < 2 && (
          <p className="text-[10px] font-bold text-yellow-400">At least 2 franchises are needed to build a schedule.</p>
        )}
      </div>

      {/* ---------------- Manual fixture ---------------- */}
      <div className="glass-card rounded-xl border border-cricket-border/50 p-4 space-y-3 mt-3">
        <div className="flex items-center gap-2">
          <Plus className="w-3.5 h-3.5 text-blue-400" />
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">Add One Fixture</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block">
            <span className={label}>Home</span>
            <select value={homeId} onChange={e => setHomeId(e.target.value)} className={input}>
              <option value="">Select…</option>
              {franchises.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={label}>Away</span>
            <select value={awayId} onChange={e => setAwayId(e.target.value)} className={input}>
              <option value="">Select…</option>
              {franchises.filter(f => f.id !== homeId).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={label}>Venue (optional)</span>
            <input value={venue} onChange={e => setVenue(e.target.value)} placeholder="Wankhede Stadium, Mumbai" className={input} />
          </label>
        </div>

        <button
          disabled={busy || !homeId || !awayId}
          onClick={addManual}
          className="px-3 py-2 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 font-black text-[11px] transition disabled:opacity-30"
        >
          Add Fixture
        </button>
      </div>

      {/* ---------------- Current schedule ---------------- */}
      <div className="mt-3 rounded-xl border border-cricket-border/50 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-cricket-border/50 bg-gray-900/40 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-300">Current Schedule</p>
          {fixtures.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete all fixtures? This will wipe the points table.')) {
                  removeAll();
                }
              }}
              disabled={busy}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-400 hover:text-red-300 transition disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              Delete All
            </button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {fixtures.length === 0 && (
            <p className="text-xs text-gray-600 font-semibold text-center py-6">No fixtures scheduled</p>
          )}
          {fixtures.map(f => (
            <div key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-cricket-border/20 last:border-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-black text-gray-500 text-xs tabular-nums w-8 shrink-0">#{f.match_number}</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {f.home_team_name} v {f.away_team_name}
                  </p>
                  <p className="text-[10px] text-gray-500 font-semibold truncate">
                    {f.stage}{f.venue ? ` · ${f.venue}` : ''}
                    {f.scheduled_time ? ` · ${String(f.scheduled_time).slice(0, 10)}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${STATUS_TONE[f.status]}`}>
                  {f.status}
                </span>
                {confirmDelete === f.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded-lg bg-gray-800 text-gray-300 text-[10px] font-bold">No</button>
                    <button disabled={busy} onClick={() => remove(f.id)} className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-black disabled:opacity-40">Delete</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(f.id)}
                    title={f.status === 'completed' ? 'Delete fixture and remove its result from the standings' : 'Delete fixture'}
                    className="p-1.5 rounded-lg bg-gray-800/60 hover:bg-red-900/50 text-gray-400 hover:text-red-300 border border-cricket-border/50 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ConsoleModal>
  );
};
