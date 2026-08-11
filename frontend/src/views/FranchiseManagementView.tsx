import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { formatCurrency } from '../utils/formatters';
import { Shield, ArrowDownRight, ArrowUpRight, History, Plus, Edit3, Trash2, X, AlertTriangle, UserCheck, UserPlus, CheckCircle2 } from 'lucide-react';

interface FranchiseFormData {
  name: string;
  short_name: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  owner_id: string;
  initial_purse: number;
  remaining_purse?: number;
}

interface OwnerFormData {
  name: string;
  email: string;
  password: string;
  phone: string;
}

const DEFAULT_FORM: FranchiseFormData = {
  name: '',
  short_name: '',
  logo_url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=150&auto=format&fit=crop&q=80',
  primary_color: '#3b82f6',
  secondary_color: '#1e40af',
  owner_id: '',
  initial_purse: 1000000000 // 100 Crore
};

const DEFAULT_OWNER_FORM: OwnerFormData = {
  name: '',
  email: '',
  password: 'password123',
  phone: ''
};

export const FranchiseManagementView: React.FC = () => {
  const { currentTournamentId, currentRole } = useAuth();
  const isAdmin = currentRole === 'Super Admin' || currentRole === 'Tournament Admin';

  const [franchises, setFranchises] = useState<any[]>([]);
  const [selectedFranchise, setSelectedFranchise] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);

  // Franchise Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [formData, setFormData] = useState<FranchiseFormData>(DEFAULT_FORM);
  const [editingFranchiseId, setEditingFranchiseId] = useState<string | null>(null);

  // Owner Creation Modal States
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [ownerFormData, setOwnerFormData] = useState<OwnerFormData>(DEFAULT_OWNER_FORM);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [isSubmittingOwner, setIsSubmittingOwner] = useState(false);
  const [ownerSuccessToast, setOwnerSuccessToast] = useState<string | null>(null);

  // Delete Confirm State
  const [deletingFranchiseId, setDeletingFranchiseId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadFranchises = (selectId?: string) => {
    apiRequest(`/franchises?tournamentId=${currentTournamentId}`)
      .then(res => {
        setFranchises(res);
        const targetId = selectId || (selectedFranchise ? selectedFranchise.id : (res.length > 0 ? res[0].id : null));
        if (targetId && res.some((f: any) => f.id === targetId)) {
          loadFranchiseDetails(targetId);
        } else if (res.length > 0) {
          loadFranchiseDetails(res[0].id);
        } else {
          setSelectedFranchise(null);
        }
      })
      .catch(console.error);
  };

  const loadFranchiseDetails = (id: string) => {
    apiRequest(`/franchises/${id}`)
      .then(setSelectedFranchise)
      .catch(console.error);
  };

  const loadUsers = () => {
    return apiRequest('/auth/users')
      .then(setUsers)
      .catch(console.error);
  };

  useEffect(() => {
    loadFranchises();
    loadUsers();
  }, [currentTournamentId]);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingFranchiseId(null);
    setFormData(DEFAULT_FORM);
    setFormError(null);
    setOwnerSuccessToast(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (franchise: any) => {
    setModalMode('edit');
    setEditingFranchiseId(franchise.id);
    setFormData({
      name: franchise.name,
      short_name: franchise.short_name,
      logo_url: franchise.logo_url || DEFAULT_FORM.logo_url,
      primary_color: franchise.primary_color || DEFAULT_FORM.primary_color,
      secondary_color: franchise.secondary_color || DEFAULT_FORM.secondary_color,
      owner_id: franchise.owner_id || '',
      initial_purse: franchise.initial_purse,
      remaining_purse: franchise.remaining_purse
    });
    setFormError(null);
    setOwnerSuccessToast(null);
    setIsModalOpen(true);
  };

  const handleCreateOwner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerFormData.name.trim() || !ownerFormData.email.trim()) {
      setOwnerError('Owner Name and Email are required.');
      return;
    }

    setIsSubmittingOwner(true);
    setOwnerError(null);

    apiRequest('/auth/create-owner', {
      method: 'POST',
      body: JSON.stringify(ownerFormData)
    })
      .then(async (newOwner) => {
        setIsSubmittingOwner(false);
        setIsOwnerModalOpen(false);
        setOwnerFormData(DEFAULT_OWNER_FORM);
        
        // Refresh users list and automatically select the newly created owner!
        await loadUsers();
        setFormData(prev => ({ ...prev, owner_id: newOwner.id }));
        setOwnerSuccessToast(`Owner "${newOwner.name}" created and automatically selected!`);
      })
      .catch(err => {
        setOwnerError(err.message || 'Failed to create franchise owner');
        setIsSubmittingOwner(false);
      });
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.short_name.trim()) {
      setFormError('Franchise Name and Short Name are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    if (modalMode === 'create') {
      apiRequest('/franchises', {
        method: 'POST',
        body: JSON.stringify({
          tournament_id: currentTournamentId,
          ...formData
        })
      })
        .then(newFranchise => {
          setIsModalOpen(false);
          setIsSubmitting(false);
          loadFranchises(newFranchise.id);
        })
        .catch(err => {
          setFormError(err.message || 'Failed to create franchise');
          setIsSubmitting(false);
        });
    } else if (modalMode === 'edit' && editingFranchiseId) {
      apiRequest(`/franchises/${editingFranchiseId}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      })
        .then(updatedFranchise => {
          setIsModalOpen(false);
          setIsSubmitting(false);
          loadFranchises(updatedFranchise.id);
        })
        .catch(err => {
          setFormError(err.message || 'Failed to update franchise');
          setIsSubmitting(false);
        });
    }
  };

  const handleDeleteFranchise = (id: string) => {
    setIsDeleting(true);
    apiRequest(`/franchises/${id}`, {
      method: 'DELETE'
    })
      .then(() => {
        setIsDeleting(false);
        setDeletingFranchiseId(null);
        loadFranchises();
      })
      .catch(err => {
        alert(err.message || 'Failed to delete franchise');
        setIsDeleting(false);
      });
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="glass-panel p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-blue-500/30">
        <div className="flex items-center space-x-3">
          <img src="/sakha_logo.png" alt="Sakha Logo" className="h-10 sm:h-12 w-auto object-contain bg-white px-2.5 py-1 rounded-lg shadow-md shrink-0" />
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              SAKHA FRANCHISE MANAGEMENT &amp; IMMUTABLE PURSE LEDGER
              {isAdmin && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                  Super Admin Console
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-400">Manage franchise teams, squad roster, and immutable transaction ledger</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Admin Create Franchise Button */}
          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>CREATE FRANCHISE</span>
            </button>
          )}

          {/* Team Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-md">
            {franchises.map(f => (
              <button
                key={f.id}
                onClick={() => loadFranchiseDetails(f.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition whitespace-nowrap ${
                  selectedFranchise?.id === f.id
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                    : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-white'
                }`}
              >
                {f.short_name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedFranchise ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Col: Roster List & Franchise Header */}
          <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-4 gap-4">
              <div className="flex items-center space-x-3">
                <img
                  src={selectedFranchise.logo_url}
                  alt={selectedFranchise.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-blue-500/50 shadow-md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">{selectedFranchise.name}</h3>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded font-extrabold text-white uppercase"
                      style={{ backgroundColor: selectedFranchise.primary_color || '#3b82f6' }}
                    >
                      {selectedFranchise.short_name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <UserCheck className="w-3.5 h-3.5 text-gray-400" />
                    <span>Owner: {selectedFranchise.owner_name || 'Unassigned'}</span>
                    <span>· Total Players: {selectedFranchise.total_players} ({selectedFranchise.foreign_players} foreign)</span>
                  </p>
                </div>
              </div>

              {/* Purse & Admin Actions */}
              <div className="flex items-center gap-3 self-end sm:self-center">
                <div className="text-right bg-gray-900/80 px-3.5 py-1.5 rounded-xl border border-gray-800">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">Remaining Purse</span>
                  <span className="text-lg font-black text-emerald-400">{formatCurrency(selectedFranchise.remaining_purse)}</span>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(selectedFranchise)}
                      className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-yellow-400 border border-gray-700 transition"
                      title="Edit Franchise"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingFranchiseId(selectedFranchise.id)}
                      className="p-2 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-800/40 transition"
                      title="Delete Franchise"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Squad Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 uppercase font-semibold">
                    <th className="py-2.5 px-3">Player</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Nationality</th>
                    <th className="py-2.5 px-3 text-right">Sold Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {selectedFranchise.squad && selectedFranchise.squad.length > 0 ? (
                    selectedFranchise.squad.map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-900/40">
                        <td className="py-3 px-3 font-bold text-white flex items-center space-x-2">
                          <img src={p.photo_url} alt={p.name} className="w-7 h-7 rounded-full object-cover" />
                          <span>{p.name}</span>
                        </td>
                        <td className="py-3 px-3 text-gray-300">{p.category}</td>
                        <td className="py-3 px-3 text-gray-300">{p.role}</td>
                        <td className="py-3 px-3 text-gray-400">{p.is_foreign ? `Foreign (${p.country})` : 'Indian'}</td>
                        <td className="py-3 px-3 text-right font-extrabold text-yellow-400">{formatCurrency(p.sold_price)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">No players acquired yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Col: Immutable Purse Ledger Timeline */}
          <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-yellow-400" />
                <span>Immutable Ledger Trail</span>
              </h4>
              <span className="text-[10px] text-gray-500 uppercase font-bold">Append-Only Audit</span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {selectedFranchise.ledger && selectedFranchise.ledger.length > 0 ? (
                selectedFranchise.ledger.map((entry: any) => {
                  const isDeduction = entry.amount < 0;
                  return (
                    <div key={entry.id} className="glass-card p-3 rounded-xl border border-gray-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold flex items-center gap-1 ${isDeduction ? 'text-red-400' : 'text-emerald-400'}`}>
                          {isDeduction ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                          <span>{entry.transaction_type.toUpperCase()}</span>
                        </span>
                        <span className="font-extrabold text-white">{formatCurrency(entry.amount)}</span>
                      </div>
                      <p className="text-[11px] text-gray-300">{entry.note || entry.player_name || 'Transaction'}</p>
                      <div className="flex justify-between text-[10px] text-gray-500 pt-1">
                        <span>Balance After: {formatCurrency(entry.balance_after)}</span>
                        <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-gray-500 text-center py-8">No ledger transactions recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-4 border border-gray-800">
          <Shield className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Franchises Configured</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {isAdmin ? 'Click "CREATE FRANCHISE" above to register the first franchise for this tournament.' : 'No franchise teams available in this tournament.'}
          </p>
          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
            >
              Create Franchise Now
            </button>
          )}
        </div>
      )}

      {/* CREATE / EDIT FRANCHISE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full rounded-2xl border border-gray-700 p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                <span>{modalMode === 'create' ? 'Create New Franchise' : `Edit ${formData.name}`}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-semibold">
                {formError}
              </div>
            )}

            {ownerSuccessToast && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{ownerSuccessToast}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="block text-xs font-semibold text-gray-400">Franchise Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mumbai Strikers"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-400">Short Name *</label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    placeholder="e.g. MI"
                    value={formData.short_name}
                    onChange={e => setFormData({ ...formData, short_name: e.target.value.toUpperCase() })}
                    className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500 uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-400">Primary Theme Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={e => setFormData({ ...formData, primary_color: e.target.value })}
                      className="w-9 h-9 rounded-lg bg-gray-900 border border-gray-700 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={formData.primary_color}
                      onChange={e => setFormData({ ...formData, primary_color: e.target.value })}
                      className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-400">Secondary Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.secondary_color}
                      onChange={e => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="w-9 h-9 rounded-lg bg-gray-900 border border-gray-700 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={formData.secondary_color}
                      onChange={e => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Franchise Owner Selector with inline + Add New Owner button */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-400">Franchise Owner / Manager User</label>
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerError(null);
                      setIsOwnerModalOpen(true);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/30 transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Add New Owner</span>
                  </button>
                </div>
                <select
                  value={formData.owner_id}
                  onChange={e => setFormData({ ...formData, owner_id: e.target.value })}
                  className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="">-- Unassigned (Assign Later) --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-400">Logo Image URL</label>
                <input
                  type="url"
                  value={formData.logo_url}
                  onChange={e => setFormData({ ...formData, logo_url: e.target.value })}
                  className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-400">Initial Purse Budget (INR)</label>
                  <input
                    type="number"
                    step={1000000}
                    value={formData.initial_purse}
                    onChange={e => setFormData({ ...formData, initial_purse: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-emerald-400 font-bold">{formatCurrency(formData.initial_purse)}</p>
                </div>

                {modalMode === 'edit' && (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-400">Current Remaining Purse (INR)</label>
                    <input
                      type="number"
                      step={1000000}
                      value={formData.remaining_purse ?? formData.initial_purse}
                      onChange={e => setFormData({ ...formData, remaining_purse: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <p className="text-[10px] text-emerald-400 font-bold">{formatCurrency(formData.remaining_purse ?? 0)}</p>
                  </div>
                )}
              </div>

              {/* Quick Purse Budget Presets */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-gray-400 font-semibold">Presets:</span>
                {[1000000000, 900000000, 750000000, 500000000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFormData({ ...formData, initial_purse: val, remaining_purse: modalMode === 'edit' ? val : undefined })}
                    className="text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono border border-gray-700"
                  >
                    {formatCurrency(val)}
                  </button>
                ))}
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
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : modalMode === 'create' ? 'Create Franchise' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE FRANCHISE OWNER SUB-MODAL */}
      {isOwnerModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-blue-500/40 p-6 space-y-4 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <span>Create & Register Franchise Owner</span>
              </h3>
              <button onClick={() => setIsOwnerModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {ownerError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs font-semibold">
                {ownerError}
              </div>
            )}

            <form onSubmit={handleCreateOwner} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-400">Owner Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Preity Zinta"
                  value={ownerFormData.name}
                  onChange={e => setOwnerFormData({ ...ownerFormData, name: e.target.value })}
                  className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-400">Owner Login Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. preity@pbks.com"
                  value={ownerFormData.email}
                  onChange={e => setOwnerFormData({ ...ownerFormData, email: e.target.value })}
                  className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-400">Default Password</label>
                <input
                  type="text"
                  value={ownerFormData.password}
                  onChange={e => setOwnerFormData({ ...ownerFormData, password: e.target.value })}
                  className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500 font-mono"
                />
                <p className="text-[10px] text-gray-500">Default: password123 (Owner can log in with this email & password)</p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-400">Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={ownerFormData.phone}
                  onChange={e => setOwnerFormData({ ...ownerFormData, phone: e.target.value })}
                  className="w-full bg-gray-900 text-white text-xs border border-gray-700 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsOwnerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOwner}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSubmittingOwner ? 'Creating Owner...' : 'Create & Select Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deletingFranchiseId && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-red-500/40 p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-950/80 text-red-400 mx-auto flex items-center justify-center border border-red-500/40">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Delete Franchise Team?</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Are you sure you want to delete this franchise? This will reset all acquired squad players back to the auction queue, clear its purse ledger, and remove match records.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingFranchiseId(null)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteFranchise(deletingFranchiseId)}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-700 to-rose-600 hover:brightness-110 text-white text-xs font-extrabold shadow-lg shadow-red-600/30 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Franchise'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
