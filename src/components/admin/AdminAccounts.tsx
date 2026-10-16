import React, { useState, useEffect } from 'react';
import { User, Program } from '../../types';
import { api } from '../../api';
import { Plus, Key, Edit, X, UserPlus, AlertCircle, Search, Trash2, Check, BookOpen, Users } from 'lucide-react';
import { CreateUserModal } from './CreateUserModal';
import { Pentagon } from '../brand/Decorations';

interface AdminAccountsProps {
  onNotify: (msg: string) => void;
}

export const AdminAccounts: React.FC<AdminAccountsProps> = ({ onNotify }) => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete user confirmation state
  const [deleteTargetUser, setDeleteTargetUser] = useState<User | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletedNotice, setDeletedNotice] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.getAdminAccounts();
      setAccounts(res.accounts || []);
    } catch (err: any) {
      console.error('[loadAccounts] error:', err);
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
      setResetSaving(false);
      setResetTargetUser(null);
      setResetPasswordVal('');
      onNotify(`Password reset for ${resetTargetUser.fullName}.`);
    } catch (err: any) {
      console.error('[resetPassword] error:', err.message || err);
      setResetError(err.message || "Couldn't reset password. Try again.");
      setResetSaving(false);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetUser || !editFullName.trim()) return;

    if (editEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editEmail.trim())) {
        setEditError('Enter a valid email address');
        return;
      }
    }

    setEditSaving(true);
    setEditError(null);

    try {
      await api.updateAccount(editTargetUser.id, {
        fullName: editFullName.trim(),
        email: editEmail.trim() || undefined,
      });

      setEditTargetUser(null);
      onNotify('Account details updated.');
      await loadAccounts();
    } catch (err: any) {
      console.error('[updateAccount] error:', err.message || err);
      setEditError(err.message || "Couldn't update account. Try again.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setDeleteSubmitting(true);
    setDeleteError(null);

    const targetName = deleteTargetUser.fullName;
    try {
      await api.deleteAccount(deleteTargetUser.id);
      setDeleteSubmitting(false);
      setDeleteTargetUser(null);
      setDeletedNotice(`${targetName} has been deleted.`);
      onNotify(`${targetName} has been deleted.`);
      await loadAccounts();
    } catch (err: any) {
      console.error('[deleteAccount] error:', err.message || err);
      setDeleteError(err.message || "Couldn't delete account. Try again.");
      setDeleteSubmitting(false);
    }
  };

  const guides = accounts.filter((a) => a.role === 'guide');
  const students = accounts.filter((a) => a.role === 'student');

  const filteredAccounts = accounts.filter((user) => {
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (user.fullName || '').toLowerCase().includes(q);
    const userMatch = (user.username || '').toLowerCase().includes(q);
    const progMatch = (user.programs || []).some((p: any) =>
      (p.name || '').toLowerCase().includes(q)
    );
    return nameMatch || userMatch || progMatch;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Title & Create Account Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
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
          className="h-11 px-4 rounded-xl bg-[#D4202C] hover:bg-[#B81B26] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create account</span>
        </button>
      </div>

      {/* Deleted notification banner */}
      {deletedNotice && (
        <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-900 text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-600 shrink-0"></span>
            <span>{deletedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeletedNotice(null)}
            className="p-1 rounded-md text-green-700 hover:text-green-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search box and three-way filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, roll, or program..."
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#F3F4F6] text-xs sm:text-sm text-[#111111] placeholder:text-[#6B7280] border border-transparent focus:border-[#D4202C] focus:bg-white focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#6B7280] hover:text-[#111111] hover:bg-gray-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter buttons */}
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
              Guides ({guides.length})
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
              Students ({students.length})
            </button>
          </div>

          {searchQuery.trim() && (
            <div className="text-xs text-[#6B7280]">
              {filteredAccounts.length} {filteredAccounts.length === 1 ? 'result' : 'results'}
            </div>
          )}
        </div>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 text-[#D4202C] text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Accounts List */}
      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-xs sm:text-sm text-[#6B7280]">
          Loading accounts and program assignments...
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-xs sm:text-sm text-[#6B7280] flex flex-col items-center justify-center">
          <Pentagon size={56} className="mb-3" />
          <p>{searchQuery ? `No results for "${searchQuery}"` : 'No accounts found.'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAccounts.map((user) => {
            const isGuide = user.role === 'guide';
            const isStudent = user.role === 'student';

            return (
              <div
                key={user.id}
                className="p-4 rounded-2xl bg-[#F3F4F6] border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:shadow-xs transition-shadow"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm sm:text-base text-[#111111]">
                      {user.fullName}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#111111] border border-gray-200">
                      {isGuide ? 'Guide' : isStudent ? 'Student' : user.role}
                    </span>
                    <span className="text-xs text-[#6B7280]">
                      @{user.username}
                    </span>
                  </div>

                  {/* Program information per contract: When showing a student's card, list the programs he belongs to and each program's guide(s) */}
                  {isStudent && (
                    <div className="text-xs text-[#4B5563]">
                      {(user.programs || []).length === 0 ? (
                        <span className="text-[#9CA3AF] italic">
                          No competition programs allocated yet
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {(user.programs || []).map((prog: any) => {
                            const guideText = prog.guideNames && prog.guideNames.length > 0
                              ? prog.guideNames.join(', ')
                              : 'No guide assigned';

                            return (
                              <span
                                key={prog.id}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-gray-200 text-xs font-medium text-[#111111]"
                              >
                                <BookOpen className="w-3 h-3 text-[#D4202C] shrink-0" />
                                <span>{prog.name}</span>
                                <span className="text-[11px] text-[#6B7280]">
                                  (Guide: <strong className="text-[#111111] font-semibold">{guideText}</strong>)
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Guide details: programs guided and unique students guided */}
                  {isGuide && (
                    <div className="text-xs text-[#4B5563]">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-[#111111]">
                          {user.studentCount || 0} {(user.studentCount || 0) === 1 ? 'student' : 'students'} guided
                        </span>
                        <span>·</span>
                        {(user.programs || []).length === 0 ? (
                          <span className="text-[#9CA3AF] italic">No programs assigned yet</span>
                        ) : (
                          <span className="text-[#6B7280]">
                            Programs: <strong className="text-[#111111] font-medium">
                              {(user.programs || []).map((p: any) => p.name).join(', ')}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {user.email && (
                    <div className="text-xs text-[#6B7280]">{user.email}</div>
                  )}
                </div>

                {/* Actions: Edit, Reset password, Delete */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => {
                      setEditTargetUser(user);
                      setEditFullName(user.fullName);
                      setEditEmail(user.email || '');
                      setEditError(null);
                    }}
                    className="p-2 rounded-xl bg-white border border-gray-200 text-[#111111] hover:bg-gray-100 transition-colors cursor-pointer"
                    title="Edit name or email"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      setResetTargetUser(user);
                      setResetPasswordVal('');
                      setResetError(null);
                    }}
                    className="p-2 rounded-xl bg-white border border-gray-200 text-[#111111] hover:bg-gray-100 transition-colors cursor-pointer"
                    title="Reset password"
                  >
                    <Key className="w-3.5 h-3.5 text-[#D4202C]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTargetUser(user);
                      setDeleteError(null);
                    }}
                    className="p-2 rounded-xl bg-white border border-gray-200 text-[#D4202C] hover:bg-red-50 transition-colors cursor-pointer"
                    title={`Delete ${user.fullName}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- Create Account Modal --- */}
      {isCreating && (
        <CreateUserModal
          isOpen={isCreating}
          onClose={() => setIsCreating(false)}
          onSuccess={() => {
            setIsCreating(false);
            loadAccounts();
            onNotify('Account created successfully.');
          }}
          programs={[]}
        />
      )}

      {/* --- Edit User Modal --- */}
      {editTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-[#111111]">
                  Edit account
                </h3>
                <p className="text-xs text-[#6B7280]">@{editTargetUser.username}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditTargetUser(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#111111] mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111111] mb-1">
                  Notification email (optional)
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="e.g. mentor@gmail.com"
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditTargetUser(null)}
                  disabled={editSaving}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111] rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving || !editFullName.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-[#D4202C] text-white rounded-xl hover:bg-[#b01b24] cursor-pointer disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Reset Password Modal --- */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-[#111111]">
                  Reset password
                </h3>
                <p className="text-xs text-[#6B7280]">{resetTargetUser.fullName} (@{resetTargetUser.username})</p>
              </div>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#111111] mb-1">
                  New password (min 6 characters)
                </label>
                <input
                  type="password"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  disabled={resetSaving}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111] rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSaving || resetPasswordVal.length < 6}
                  className="px-4 py-2 text-xs font-semibold bg-[#D4202C] text-white rounded-xl hover:bg-[#b01b24] cursor-pointer disabled:opacity-50"
                >
                  {resetSaving ? 'Resetting...' : 'Reset password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Delete Confirmation Modal --- */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4 animate-in fade-in duration-150">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-[#D4202C] flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-bold text-base sm:text-lg text-[#111111]">
                Delete account
              </h3>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1.5 leading-relaxed">
                Are you sure you want to delete <strong className="text-[#111111]">{deleteTargetUser.fullName}</strong> (@{deleteTargetUser.username})? This action cannot be undone.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111] rounded-xl hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-xs font-semibold bg-[#D4202C] text-white rounded-xl hover:bg-[#b01b24] cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteSubmitting ? 'Deleting...' : 'Delete account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
