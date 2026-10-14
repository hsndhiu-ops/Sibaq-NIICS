import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { api } from '../../api';
import { Plus, Key, Edit, X, UserPlus, AlertCircle, Search } from 'lucide-react';
import { CreateUserModal } from './CreateUserModal';
import { Pentagon } from '../brand/Decorations';

interface AdminAccountsProps {
  onNotify: (msg: string) => void;
}

export const AdminAccounts: React.FC<AdminAccountsProps> = ({ onNotify }) => {
  const [accounts, setAccounts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [roleFilter, setRoleFilter] = useState<'all' | 'guide' | 'student'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create account modal
  const [isCreating, setIsCreating] = useState(false);

  // Reset password modal
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Edit user modal
  const [editTargetUser, setEditTargetUser] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editGuideId, setEditGuideId] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.getAdminAccounts();
      setAccounts(res.accounts);
    } catch {
      setLoadError("Couldn't load accounts. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !resetPasswordVal) return;
    if (resetPasswordVal.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      return;
    }
    setResetSaving(true);
    setResetError(null);

    try {
      await api.resetPassword(resetTargetUser.id, resetPasswordVal);
      setResetTargetUser(null);
      setResetPasswordVal('');
      onNotify(`Password reset for ${resetTargetUser.fullName}.`);
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password. Please check server configuration.');
    } finally {
      setResetSaving(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetUser) return;
    if (!editFullName.trim()) {
      setEditError('Full name is required.');
      return;
    }
    if (editEmail.trim()) {
      const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
      if (!gmailRegex.test(editEmail.trim())) {
        setEditError('Enter a valid Gmail address');
        return;
      }
    }
    setEditSaving(true);
    setEditError(null);

    try {
      await api.updateAccount(editTargetUser.id, {
        fullName: editFullName.trim(),
        email: editEmail ? editEmail.trim() : null,
        guideId: editTargetUser.role === 'student' ? editGuideId || null : undefined,
      });
      setEditTargetUser(null);
      onNotify('Account details updated.');
      loadAccounts();
    } catch (err: any) {
      setEditError(err.message || "Couldn't update account. Try again.");
    } finally {
      setEditSaving(false);
    }
  };

  const normalizeText = (text: string): string => {
    return (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u02bb\u02bc\u02bd\u02be\u02bf\u2018\u2019'`ʾʿ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  };

  const matchesSearch = (text: string, query: string): boolean => {
    const cleanQuery = normalizeText(query);
    if (!cleanQuery) return true;
    const cleanText = normalizeText(text);
    return cleanText.includes(cleanQuery);
  };

  const guides = accounts.filter((a) => a.role === 'guide');
  const guidesCount = guides.length;
  const studentsCount = accounts.filter((a) => a.role === 'student').length;

  const getStudentCountForGuide = (guideId: string) => {
    return accounts.filter((a) => a.role === 'student' && a.guideId === guideId).length;
  };

  const filteredAccounts = accounts.filter((user) => {
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;
    if (!searchQuery.trim()) return true;
    return matchesSearch(user.fullName, searchQuery) || matchesSearch(user.username, searchQuery);
  });

  const getGuideName = (gId: string | null) => {
    if (!gId) return 'Unassigned';
    const g = guides.find((guide) => guide.id === gId);
    return g ? g.fullName : 'Unassigned';
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
            Accounts
          </h2>
          <p className="text-[13px] text-[#6B7280]">
            Manage students and guide supervisor credentials
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="h-12 px-5 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create account</span>
        </button>
      </div>

      {/* Search box and three-way switch */}
      <div className="space-y-3">
        {/* Search box: 44px high, 10px radius, red focus outline, visible label for screen readers, no autofocus */}
        <div className="relative">
          <label htmlFor="accounts-search" className="sr-only">
            Search by name or username
          </label>
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
          <input
            id="accounts-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or username"
            className="w-full h-[44px] pl-10 pr-10 rounded-[10px] bg-[#F3F4F6] text-xs sm:text-sm text-[#111111] placeholder:text-[#6B7280] border border-transparent focus:border-[#D4202C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4202C]/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#6B7280] hover:text-[#111111] hover:bg-gray-200 transition-colors cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Three-way switch above the list: All, Guides, Students with counts */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex bg-[#F3F4F6] p-1 rounded-xl w-full sm:max-w-xs">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                roleFilter === 'all'
                  ? 'bg-white text-[#111111] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              All ({accounts.length})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('guide')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                roleFilter === 'guide'
                  ? 'bg-white text-[#111111] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              Guides ({guidesCount})
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('student')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                roleFilter === 'student'
                  ? 'bg-white text-[#111111] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              Students ({studentsCount})
            </button>
          </div>

          {searchQuery.trim() && (
            <div className="text-xs text-[#6B7280] px-0.5">
              {filteredAccounts.length} {filteredAccounts.length === 1 ? 'result' : 'results'}
            </div>
          )}
        </div>
      </div>

      {/* Accounts List */}
      {loadError && (
        <div className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] text-[#111111] text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading accounts...
        </div>
      ) : filteredAccounts.length === 0 ? (
        searchQuery.trim() ? (
          <div className="p-8 rounded-2xl bg-[#F3F4F6] flex flex-col items-center justify-center text-center space-y-3">
            <Pentagon size={64} className="text-[#6B7280]" />
            <p className="text-sm text-[#111111]">
              No results for "{searchQuery}"
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-[10px] bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280] flex flex-col items-center justify-center">
            <Pentagon size={64} className="mb-3" />
            <p>No accounts found.</p>
          </div>
        )
      ) : (
        <div className="space-y-2.5">
          {filteredAccounts.map((user) => (
            <div
              key={user.id}
              className="p-4 rounded-2xl bg-[#F3F4F6] flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm sm:text-base text-[#111111] truncate">
                    {user.fullName}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#111111]">
                    {user.role === 'guide' ? 'Guide' : user.role === 'student' ? 'Student' : user.role}
                  </span>
                </div>
                <div className="text-xs text-[#6B7280] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span>
                    Roll / Username: <strong className="text-[#111111] font-semibold">{user.username}</strong>
                  </span>
                  {user.role === 'student' && (
                    <span>• Guide: <strong className="text-[#111111] font-semibold">{getGuideName(user.guideId)}</strong></span>
                  )}
                  {user.role === 'guide' && (
                    <span>• <strong className="text-[#111111] font-semibold">{getStudentCountForGuide(user.id)}</strong> {getStudentCountForGuide(user.id) === 1 ? 'student' : 'students'}</span>
                  )}
                  {user.email && <span>• {user.email}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    setEditTargetUser(user);
                    setEditFullName(user.fullName);
                    setEditEmail(user.email || '');
                    setEditGuideId(user.guideId || '');
                  }}
                  className="p-2 rounded-xl bg-white text-[#111111] hover:bg-gray-100"
                  title="Edit details"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setResetTargetUser(user);
                    setResetPasswordVal('');
                  }}
                  className="p-2 rounded-xl bg-white text-[#111111] hover:bg-gray-100"
                  title="Reset password"
                >
                  <Key className="w-3.5 h-3.5 text-[#D4202C]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Account Modal */}
      <CreateUserModal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onSuccess={loadAccounts}
        onNotify={onNotify}
        guides={guides}
      />

      {/* Reset Password Modal */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  Reset Password
                </h3>
                <p className="text-xs text-[#6B7280]">
                  {resetTargetUser.fullName} ({resetTargetUser.username})
                </p>
              </div>
              <button
                onClick={() => setResetTargetUser(null)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#111111]">
                    New password
                  </label>
                  <span className="text-xs text-[#6B7280]">
                    Min. 6 characters
                  </span>
                </div>
                <input
                  type="password"
                  value={resetPasswordVal}
                  onChange={(e) => {
                    setResetPasswordVal(e.target.value);
                    if (resetError) setResetError(null);
                  }}
                  placeholder="Enter at least 6 characters"
                  required
                  minLength={6}
                  disabled={resetSaving}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0"
                />
              </div>

              {resetError && (
                <div className="p-3 rounded-xl bg-white border border-[#E5E7EB] text-[#111111] text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  disabled={resetSaving}
                  className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSaving}
                  className="px-4 py-2 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-xs font-semibold disabled:opacity-50"
                >
                  {resetSaving ? 'Saving...' : 'Set password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  Edit Account
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Roll / Username: {editTargetUser.username}
                </p>
              </div>
              <button
                onClick={() => setEditTargetUser(null)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditUser} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => {
                    setEditFullName(e.target.value);
                    if (editError) setEditError(null);
                  }}
                  required
                  disabled={editSaving}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Gmail address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => {
                    setEditEmail(e.target.value);
                    if (editError) setEditError(null);
                  }}
                  placeholder="student@gmail.com"
                  disabled={editSaving}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0 disabled:opacity-60"
                />
              </div>

              {editTargetUser.role === 'student' && (
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Assigned guide
                  </label>
                  <select
                    value={editGuideId}
                    onChange={(e) => {
                      setEditGuideId(e.target.value);
                      if (editError) setEditError(null);
                    }}
                    disabled={editSaving}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0 disabled:opacity-60"
                  >
                    <option value="">Unassigned</option>
                    {guides.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editError && (
                <div className="p-3 rounded-xl bg-white border border-[#E5E7EB] text-[#111111] text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTargetUser(null)}
                  disabled={editSaving}
                  className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-xs font-semibold disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
