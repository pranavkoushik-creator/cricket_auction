import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { formatCurrency } from '../utils/formatters';
import { UserCheck, Check, X, Ban, UserPlus, Upload, Download, FileSpreadsheet, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface SinglePlayerForm {
  name: string;
  role: string;
  group_name: string;
  base_price: number;
  status: string;
  is_foreign: boolean;
  photo_url: string;
  approval_status: 'approved' | 'pending';
}

const DEFAULT_SINGLE_PLAYER: SinglePlayerForm = {
  name: '',
  role: 'Batsman',
  group_name: 'GROUP A',
  base_price: 100, // 100 rs
  status: 'Newcomer',
  is_foreign: false,
  photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  approval_status: 'approved'
};

export const PlayerApprovalQueueView: React.FC = () => {
  const { currentTournamentId } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [singleForm, setSingleForm] = useState<SinglePlayerForm>(DEFAULT_SINGLE_PLAYER);
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);

  // Bulk CSV Ingestion States
  const [parsedCsvPlayers, setParsedCsvPlayers] = useState<any[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadPlayers = () => {
    apiRequest(`/players?tournamentId=${currentTournamentId}&status=${filterStatus}`)
      .then(setPlayers)
      .catch(console.error);
  };

  useEffect(() => {
    loadPlayers();
  }, [currentTournamentId, filterStatus]);

  const handleAction = (playerId: string, action: 'approve' | 'reject' | 'request-changes' | 'suspend') => {
    apiRequest(`/players/${playerId}/${action}`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: `Admin review action: ${action}` })
    })
      .then(() => loadPlayers())
      .catch(console.error);
  };

  // Submit Single Player Manual Form
  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleForm.name.trim()) {
      setSingleError('Player Name is required.');
      return;
    }

    setIsSubmittingSingle(true);
    setSingleError(null);

    apiRequest('/players/create-single', {
      method: 'POST',
      body: JSON.stringify({
        tournament_id: currentTournamentId,
        ...singleForm
      })
    })
      .then(() => {
        setIsSubmittingSingle(false);
        setIsModalOpen(false);
        setSingleForm(DEFAULT_SINGLE_PLAYER);
        setSuccessToast(`Player "${singleForm.name}" created & queued for auction!`);
        loadPlayers();
        setTimeout(() => setSuccessToast(null), 4000);
      })
      .catch(err => {
        setSingleError(err.message || 'Failed to create player.');
        setIsSubmittingSingle(false);
      });
  };

  // CSV Ingestion Parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setBulkError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');

        if (lines.length <= 1) {
          setBulkError('CSV file is empty or only contains header line.');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const nameIdx = headers.findIndex(h => h.includes('name'));
        const roleIdx = headers.findIndex(h => h.includes('role'));
        const groupNameIdx = headers.findIndex(h => h.includes('group_name') || h.includes('group'));
        const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('base'));
        const statusIdx = headers.findIndex(h => h.includes('status'));
        const foreignIdx = headers.findIndex(h => h.includes('foreign'));
        const photoIdx = headers.findIndex(h => h.includes('photo') || h.includes('image'));

        if (nameIdx === -1) {
          setBulkError('CSV must include a "name" column header.');
          return;
        }

        const parsedRows: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          if (!cols[nameIdx] || cols[nameIdx] === '') continue;

          const isForeignVal = foreignIdx !== -1 ? (cols[foreignIdx]?.toLowerCase() === 'true' || cols[foreignIdx] === '1' || cols[foreignIdx]?.toLowerCase() === 'yes') : false;

          parsedRows.push({
            name: cols[nameIdx],
            role: roleIdx !== -1 && cols[roleIdx] ? cols[roleIdx] : 'Batsman',
            group_name: groupNameIdx !== -1 && cols[groupNameIdx] ? cols[groupNameIdx] : 'GROUP A',
            base_price: priceIdx !== -1 && !isNaN(Number(cols[priceIdx])) ? Number(cols[priceIdx]) : 20000000,
            status: statusIdx !== -1 && cols[statusIdx] ? cols[statusIdx] : 'Newcomer',
            is_foreign: isForeignVal,
            photo_url: photoIdx !== -1 && cols[photoIdx] ? cols[photoIdx] : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
          });
        }

        if (parsedRows.length === 0) {
          setBulkError('No valid player data rows found in CSV.');
          return;
        }

        setParsedCsvPlayers(parsedRows);
      } catch (err: any) {
        setBulkError('Failed to parse CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Submit Bulk Ingestion
  const handleBulkSubmit = () => {
    if (parsedCsvPlayers.length === 0) return;

    setIsSubmittingBulk(true);
    setBulkError(null);

    apiRequest('/players/bulk-import', {
      method: 'POST',
      body: JSON.stringify({
        tournamentId: currentTournamentId,
        players: parsedCsvPlayers
      })
    })
      .then(res => {
        setIsSubmittingBulk(false);
        setIsModalOpen(false);
        setParsedCsvPlayers([]);
        setCsvFileName(null);
        setSuccessToast(`Successfully imported ${res.importedCount} players to database & auction queue!`);
        loadPlayers();
        setTimeout(() => setSuccessToast(null), 5000);
      })
      .catch(err => {
        setBulkError(err.message || 'Failed to bulk import players.');
        setIsSubmittingBulk(false);
      });
  };

  // Download Sample CSV Template
  const handleDownloadSampleCsv = () => {
    const csvContent = `name,role,group_name,base_price,status,is_foreign,photo_url\nSanju Samson,Wicket-Keeper,GROUP A,20000000,Returning,0,https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80\nMitchell Starc,Bowler,GROUP A,20000000,Returning,1,https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80\nShreyas Iyer,Batsman,GROUP A,15000000,Newcomer,0,https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_players_import.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-bold shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-blue-500/30">
        <div className="flex items-center space-x-3">
          <img src="/sakha_logo.png" alt="Sakha Logo" className="h-10 sm:h-12 w-auto object-contain bg-white px-2.5 py-1 rounded-lg shadow-md shrink-0" />
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              SAKHA ADMIN REGISTRATION APPROVAL QUEUE
            </h2>
            <p className="text-xs text-gray-400">Review eligibility, approve for auction lot assignment, or suspend players</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* CREATE / INGEST PLAYERS BUTTON */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ ADD / INGEST PLAYERS</span>
          </button>

          {/* Filter Toolbar */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['all', 'pending', 'approved', 'rejected', 'suspended'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`text-xs px-3 py-1.5 rounded-lg border uppercase font-bold transition ${filterStatus === st
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                  : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-white'
                  }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Players List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {players.map(p => (
          <div key={p.id} className="glass-card p-5 rounded-2xl border border-gray-800 space-y-4 flex flex-col justify-between hover:border-gray-700 transition">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <img src={p.photo_url} alt={p.name} className="w-12 h-12 rounded-xl object-cover border border-gray-700 shadow-md" />
                  <div>
                    <h4 className="text-base font-bold text-white">{p.name}</h4>
                    <p className="text-xs text-gray-400">{p.role} · {p.status}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${p.approval_status === 'approved'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : p.approval_status === 'pending'
                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                    : 'bg-red-500/20 text-red-300 border-red-500/30'
                  }`}>
                  {p.approval_status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-gray-900/80 p-2.5 rounded-xl border border-gray-800">
                <div>
                  <span className="text-gray-500 block text-[10px]">Group</span>
                  <span className="font-bold text-white">{p.group_name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Base Price</span>
                  <span className="font-bold text-yellow-400">{formatCurrency(p.base_price)}</span>
                </div>
              </div>
            </div>

            {/* Actions Toolbar */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-gray-800/80">
              <button
                onClick={() => handleAction(p.id, 'approve')}
                className="flex-1 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center justify-center gap-1 transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>

              <button
                onClick={() => handleAction(p.id, 'reject')}
                className="py-1.5 px-2.5 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-300 font-bold text-xs border border-red-500/40 flex items-center justify-center gap-1 transition"
                title="Reject Player"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handleAction(p.id, 'suspend')}
                className="py-1.5 px-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs border border-gray-700 flex items-center justify-center gap-1 transition"
                title="Suspend Player"
              >
                <Ban className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE & INGEST PLAYERS MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-2xl w-full rounded-2xl border border-blue-500/40 p-6 space-y-5 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <span>Add / Ingest Players to Database</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Selection Switcher */}
            <div className="flex items-center gap-2 bg-gray-900/80 p-1.5 rounded-xl border border-gray-800">
              <button
                onClick={() => setActiveTab('single')}
                className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-2 ${activeTab === 'single'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Single Player (Manual)</span>
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-2 ${activeTab === 'bulk'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Bulk Ingest (CSV Upload)</span>
              </button>
            </div>

            {/* TAB 1: SINGLE PLAYER FORM */}
            {activeTab === 'single' && (
              <form onSubmit={handleSingleSubmit} className="space-y-4">
                {singleError && (
                  <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{singleError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-400">Player Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sanju Samson"
                    value={singleForm.name}
                    onChange={e => setSingleForm({ ...singleForm, name: e.target.value })}
                    className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-400">Playing Role *</label>
                    <select
                      value={singleForm.role}
                      onChange={e => setSingleForm({ ...singleForm, role: e.target.value })}
                      className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                    >
                      <option value="Batsman">Batsman</option>
                      <option value="Bowler">Bowler</option>
                      <option value="All-Rounder">All-Rounder</option>
                      <option value="Wicket-Keeper">Wicket-Keeper</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-400">Auction Group *</label>
                    <select
                      value={singleForm.group_name}
                      onChange={e => setSingleForm({ ...singleForm, group_name: e.target.value })}
                      className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                    >
                      <option value="GROUP A">GROUP A</option>
                      <option value="GROUP B">GROUP B</option>
                      <option value="GROUP C">GROUP C</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-400">Base Price (INR) *</label>
                  <input
                    type="number"
                    // step={1000000}
                    value={singleForm.base_price}
                    onChange={e => setSingleForm({ ...singleForm, base_price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-yellow-400 font-bold">{formatCurrency(singleForm.base_price)}</p>

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-gray-400">Presets:</span>
                    {[100, 50, 25].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSingleForm({ ...singleForm, base_price: val })}
                        className="text-[10px] px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono border border-gray-700"
                      >
                        {formatCurrency(val)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-400">Status</label>
                    <select
                      value={singleForm.status}
                      onChange={e => setSingleForm({ ...singleForm, status: e.target.value })}
                      className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                    >
                      <option value="Newcomer">Newcomer</option>
                      <option value="Returning">Returning</option>
                    </select>
                  </div>

                  <div className="pt-4 flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_foreign"
                      checked={singleForm.is_foreign}
                      onChange={e => setSingleForm({ ...singleForm, is_foreign: e.target.checked })}
                      className="w-4 h-4 rounded bg-gray-900 border-gray-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="is_foreign" className="text-xs font-semibold text-gray-300 cursor-pointer">
                      Is Overseas / Foreign Player?
                    </label>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-400">Photo URL</label>
                  <input
                    type="url"
                    value={singleForm.photo_url}
                    onChange={e => setSingleForm({ ...singleForm, photo_url: e.target.value })}
                    className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingSingle}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isSubmittingSingle ? 'Creating...' : 'Create & Queue Player'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: BULK CSV INGESTION */}
            {activeTab === 'bulk' && (
              <div className="space-y-4">
                {bulkError && (
                  <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{bulkError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between bg-blue-950/40 p-3 rounded-xl border border-blue-500/30 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-blue-200 block">Download Template CSV</span>
                    <span className="text-[11px] text-gray-400">Sample file format with columns: name, role, group_name, base_price, status, is_foreign</span>
                  </div>
                  <button
                    onClick={handleDownloadSampleCsv}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Template CSV</span>
                  </button>
                </div>

                {/* CSV Drag & Drop Upload Container */}
                <div className="border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-2xl p-6 text-center space-y-3 bg-gray-900/40 transition relative">
                  <Upload className="w-8 h-8 text-blue-400 mx-auto" />
                  <div>
                    <p className="text-xs font-bold text-white">Click to Select CSV File to Ingest</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Supports .csv files formatted with player records</p>
                  </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  {csvFileName && (
                    <span className="inline-block text-xs font-bold text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/40">
                      📄 Loaded: {csvFileName}
                    </span>
                  )}
                </div>

                {/* CSV Parsed Preview Table */}
                {parsedCsvPlayers.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Parsed {parsedCsvPlayers.length} Players Ready for Import</span>
                      </span>
                      <button
                        onClick={() => setParsedCsvPlayers([])}
                        className="text-[11px] text-gray-400 hover:text-red-400 underline"
                      >
                        Clear Parsed List
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto border border-gray-800 rounded-xl bg-gray-900/60">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-gray-800 text-gray-400 uppercase font-semibold">
                            <th className="py-2 px-3">Player Name</th>
                            <th className="py-2 px-3">Role</th>
                            <th className="py-2 px-3">Group</th>
                            <th className="py-2 px-3">Base Price</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {parsedCsvPlayers.map((p, idx) => (
                            <tr key={idx} className="hover:bg-gray-800/40">
                              <td className="py-2 px-3 font-bold text-white">{p.name}</td>
                              <td className="py-2 px-3 text-gray-300">{p.role}</td>
                              <td className="py-2 px-3 text-gray-300">{p.group_name}</td>
                              <td className="py-2 px-3 text-yellow-400 font-bold">{formatCurrency(p.base_price)}</td>
                              <td className="py-2 px-3 text-gray-400">{p.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkSubmit}
                    disabled={parsedCsvPlayers.length === 0 || isSubmittingBulk}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-xs font-extrabold shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {isSubmittingBulk ? 'Ingesting Players...' : `Import ${parsedCsvPlayers.length} Players to Database`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
