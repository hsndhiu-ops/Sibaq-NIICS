import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { api } from '../../api';
import { Plus, Key, Edit, X, UserPlus } from 'lucide-react';

interface AdminAccountsProps {
  onNotify: (msg: string) => void;
}

export const AdminAccounts: React.FC<AdminAccountsProps> = ({ onNotify }) => {
  const [accounts, setAccounts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [roleFilter, setRoleFilter] = useState<'all' | 'guide' | 'student'>('all');

  // Create account modal
  const [isCreating, setIsCreating] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'guide' | 'student'>('student');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGuideId, setNewGuideId] = useState('');
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSaving(true);
    setCreateError(null);

    try {
      await api.createAccount({
        username: newUsername,
        password: newPassword,
        role: newRole,
        fullName: newFullName,
        email: newEmail || null,
        guideId: newRole === 'student' && newGuideId ? newGuideId : null,
      });

      setIsCreating(false);
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewEmail('');
      setNewGuideId('');
      onNotify('Account created successfully.');
      loadAccounts();
    } catch (err: any) {
      setCreateError(err.message || 'Not available yet');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !resetPasswordVal) return;
    setResetSaving(true);
    setResetError(null);

    try {
      await api.resetPassword(resetTargetUser.id, resetPasswordVal);
      setResetTargetUser(null);
      setResetPasswordVal('');
      onNotify(`Password reset for ${resetTargetUser.fullName}.`);
    } catch (err: any) {
      setResetError(err.message || 'Not available yet');
    } finally {
      setResetSaving(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetUser) return;
    setEditSaving(true);
    setEditError(null);

    try {
      await api.updateAccount(editTargetUser.id, {
        fullName: editFullName,
        email: editEmail || null,
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

  const guides = accounts.filter((a) => a.role === 'guide');
  const filteredAccounts =
    roleFilter === 'all'
      ? accounts
      : accounts.filter((a) => a.role === roleFilter);

  const getGuideName = (gId: string | null) => {
    if (!gId) return 'Unassigned';
    const g = guides.find((guide) => guide.id === gId);
    return g ? g.fullName : 'Unassigned';
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            Accounts
          </h2>
          <p className="text-xs text-[#6B7280]">
            Manage student candidates and guide supervisor credentials
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError(null);
            setIsCreating(true);
          }}
          className="px-3.5 py-2 rounded-xl bg-[#EF4B47] text-white text-xs font-semibold hover:opacity-95 flex items-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create account</span>
        </button>
      </div>

      {/* Role filter buttons */}
      <div className="flex bg-[#F3F4F6] p-1 rounded-xl max-w-xs">
        <button
          onClick={() => setRoleFilter('all')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            roleFilter === 'all'
              ? 'bg-white text-[#111111] shadow-xs'
              : 'text-[#6B7280] hover:text-[#111111]'
          }`}
        >
          All ({accounts.length})
        </button>
        <button
          onClick={() => setRoleFilter('guide')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            roleFilter === 'guide'
              ? 'bg-white text-[#111111] shadow-xs'
              : 'text-[#6B7280] hover:text-[#111111]'
          }`}
        >
          Guides ({accounts.filter((a) => a.role === 'guide').length})
        </button>
        <button
          onClick={() => setRoleFilter('student')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            roleFilter === 'student'
              ? 'bg-white text-[#111111] shadow-xs'
              : 'text-[#6B7280] hover:text-[#111111]'
          }`}
        >
          Students ({accounts.filter((a) => a.role === 'student').length})
        </button>
      </div>

      {/* Accounts List */}
      {loadError && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5]/60 text-[#B91C1C] text-sm text-center">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading accounts...
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          No accounts found.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAccounts.map((user) => (
            <div
              key={user.id}
              className="p-4 rounded-2xl bg-[#F3F4F6] flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#111111] truncate">
                    {user.fullName}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-[#111111] capitalize">
                    {user.role}
                  </span>
                </div>
                <div className="text-xs text-[#6B7280] mt-0.5 truncate">
                  Roll / Username: <span className="text-[#111111] font-medium">{user.username}</span>
                  {user.role === 'student' && (
                    <span> • Guide: {getGuideName(user.guideId)}</span>
                  )}
                  {user.email && <span> • {user.email}</span>}
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
                  <Key className="w-3.5 h-3.5 text-[#EF4B47]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Account Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <h3 className="font-bold text-base text-[#111111]">
                Create User Account
              </h3>
              <button
                onClick={() => setIsCreating(false)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRole('student')}
                    className={`py-2 rounded-xl text-xs font-semibold ${
                      newRole === 'student'
                        ? 'bg-[#EF4B47] text-white'
                        : 'bg-[#F3F4F6] text-[#111111]'
                    }`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole('guide')}
                    className={`py-2 rounded-xl text-xs font-semibold ${
                      newRole === 'guide'
                        ? 'bg-[#EF4B47] text-white'
                        : 'bg-[#F3F4F6] text-[#111111]'
                    }`}
                  >
                    Guide
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Ahmad Shafi"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Username / Roll ID
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. DH2401 or u_guide1"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Initial password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set first password"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Gmail address (optional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="student@gmail.com"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0"
                />
              </div>

              {newRole === 'student' && (
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Assign guide (optional)
                  </label>
                  <select
                    value={newGuideId}
                    onChange={(e) => setNewGuideId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0"
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

              {createError && (
                <p className="text-xs text-[#111111] font-medium">{createError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSaving}
                  className="px-4 py-2 rounded-xl bg-[#EF4B47] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50"
                >
                  {createSaving ? 'Creating...' : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  New password
                </label>
                <input
                  type="password"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  placeholder="Enter new password"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0"
                />
              </div>

              {resetError && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5]/60 text-[#B91C1C] text-xs font-medium">
                  {resetError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSaving}
                  className="px-4 py-2 rounded-xl bg-[#EF4B47] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50"
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
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Gmail address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="student@gmail.com"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0"
                />
              </div>

              {editTargetUser.role === 'student' && (
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    Assigned guide
                  </label>
                  <select
                    value={editGuideId}
                    onChange={(e) => setEditGuideId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0"
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
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5]/60 text-[#B91C1C] text-xs font-medium">
                  {editError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTargetUser(null)}
                  className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 rounded-xl bg-[#EF4B47] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50"
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
