import React, { useState, useEffect, useRef } from 'react';
import { User, Program } from '../../types';
import { api } from '../../api';
import {
  Plus,
  Key,
  Edit,
  X,
  AlertCircle,
  Search,
  Trash2,
  Check,
  CheckSquare,
  Square,
  MoreVertical,
  UserX,
  UserCheck,
  ShieldAlert,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import { CreateUserModal } from './CreateUserModal';
import { Pentagon } from '../brand/Decorations';

interface AdminAccountsProps {
  onNotify: (msg: string) => void;
}

export const AdminAccounts: React.FC<AdminAccountsProps> = ({ onNotify }) => {
  const [accounts, setAccounts] = useState<User[]>([]);
  const [programsList, setProgramsList] = useState<Program[]>([]);
  const [guideProgramsMap, setGuideProgramsMap] = useState<Map<string, Array<{ id: string; name: string }>>>(new Map());
  const [studentProgramsMap, setStudentProgramsMap] = useState<
    Map<string, Array<{ id: string; name: string; guideNames: string[] }>>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters & Search
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'guide' | 'student'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Active dropdown row ID
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Create account modal
  const [isCreating, setIsCreating] = useState(false);
  const [createRole, setCreateRole] = useState<'student' | 'guide' | 'admin'>('student');

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

  // Single user delete modal
  const [deleteTargetUser, setDeleteTargetUser] = useState<User | null>(null);
  const [deleteTypedUsername, setDeleteTypedUsername] = useState('');
  const [deleteImpact, setDeleteImpact] = useState<{
    programsGuided: number;
    attendanceDays: number;
    tasksCount: number;
    remarksCount: number;
    filesCount: number;
  } | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Multi-select delete mode (for students)
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [batchDeleteTypedText, setBatchDeleteTypedText] = useState('');
  const [batchDeleteSubmitting, setBatchDeleteSubmitting] = useState(false);
  const [batchDeleteError, setBatchDeleteError] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuUserId(null);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [res, progRes] = await Promise.all([
        api.getAdminAccounts(),
        api.getAdminPrograms().catch(() => ({ programs: [] })),
      ]);
      setAccounts(res.accounts || []);
      setGuideProgramsMap(res.guideProgramsMap || new Map());
      setStudentProgramsMap(res.studentProgramsMap || new Map());
      setProgramsList((progRes.programs as any) || []);
    } catch (err: any) {
      console.error('[AdminAccounts] load error:', err);
      setLoadError("Couldn't load accounts. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- Deactivate / Reactivate account ---
  const handleToggleActive = async (user: User) => {
    setOpenMenuUserId(null);
    const newStatus = !user.isActive;

    try {
      await api.setActive(user.id, newStatus);
      await loadAccounts();
      onNotify(
        newStatus
          ? `${user.fullName} activated.`
          : `${user.fullName} deactivated. This account is disabled.`
      );
    } catch (err: any) {
      console.error('[setActive] error:', err);
      onNotify(err.message || "Couldn't update account status. Try again.");
    }
  };

  // --- Reset Password ---
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
      console.error('[resetPassword] error:', err);
      setResetError(err.message || "Couldn't reset password. Try again.");
    } finally {
      setResetSaving(false);
    }
  };

  // --- Edit User ---
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetUser) return;
    if (!editFullName.trim()) {
      setEditError('Full name is required.');
      return;
    }

    setEditSaving(true);
    setEditError(null);

    try {
      await api.updateAccount(editTargetUser.id, {
        fullName: editFullName.trim(),
        email: editEmail.trim() || undefined,
      });
      setEditTargetUser(null);
      await loadAccounts();
      onNotify(`Updated details for ${editFullName.trim()}.`);
    } catch (err: any) {
      console.error('[updateAccount] error:', err);
      setEditError(err.message || "Couldn't update user details.");
    } finally {
      setEditSaving(false);
    }
  };

  // --- Open Single User Delete Modal ---
  const handleOpenDeleteModal = async (user: User) => {
    setOpenMenuUserId(null);
    setDeleteTargetUser(user);
    setDeleteTypedUsername('');
    setDeleteError(null);
    setLoadingImpact(true);

    try {
      const impact = await api.getAccountDeleteImpact(user.id, user.role);
      setDeleteImpact(impact);
    } catch {
      setDeleteImpact(null);
    } finally {
      setLoadingImpact(false);
    }
  };

  // --- Execute Single User Delete ---
  const handleExecuteDeleteUser = async () => {
    if (!deleteTargetUser) return;
    if (deleteTypedUsername !== deleteTargetUser.username) {
      setDeleteError(`Please type "${deleteTargetUser.username}" exactly to confirm.`);
      return;
    }

    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      await api.deleteUsers([deleteTargetUser.id]);
      const name = deleteTargetUser.fullName;
      setDeleteTargetUser(null);
      setDeleteTypedUsername('');
      await loadAccounts();
      onNotify(`${name} has been deleted.`);
    } catch (err: any) {
      console.error('[deleteUser] error:', err);
      setDeleteError(err.message || "Couldn't delete account. Try again.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // --- Multi-select student helpers ---
  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisibleStudents = (studentsList: User[]) => {
    const ids = studentsList.map((s) => s.id);
    const allSelected = ids.every((id) => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  // --- Execute Batch Delete Students ---
  const handleExecuteBatchDelete = async () => {
    if (batchDeleteTypedText.trim() !== 'DELETE') {
      setBatchDeleteError('You must type the word DELETE to confirm.');
      return;
    }

    setBatchDeleteSubmitting(true);
    setBatchDeleteError(null);

    try {
      // Split into batches of 50 if needed per contract
      const batchSize = 50;
      let totalDeleted = 0;
      for (let i = 0; i < selectedStudentIds.length; i += batchSize) {
        const batch = selectedStudentIds.slice(i, i + batchSize);
        await api.deleteUsers(batch);
        totalDeleted += batch.length;
      }

      setShowBatchDeleteModal(false);
      setBatchDeleteTypedText('');
      setSelectedStudentIds([]);
      setIsMultiSelectMode(false);
      await loadAccounts();
      onNotify(`Deleted ${totalDeleted} students.`);
    } catch (err: any) {
      console.error('[batchDelete] error:', err);
      setBatchDeleteError(err.message || "Couldn't delete selected accounts.");
    } finally {
      setBatchDeleteSubmitting(false);
    }
  };

  // Filter accounts
  const filteredAccounts = accounts.filter((acc) => {
    if (roleFilter !== 'all' && acc.role !== roleFilter) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      acc.fullName.toLowerCase().includes(q) ||
      acc.username.toLowerCase().includes(q) ||
      (acc.email && acc.email.toLowerCase().includes(q))
    );
  });

  const visibleStudents = filteredAccounts.filter((a) => a.role === 'student');

  return (
    <div className="space-y-6 pb-20">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#111111]">Accounts</h1>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
            Manage administrator, supervisor guide, and student accounts, reset credentials, and control access
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh accounts */}
          <button
            type="button"
            onClick={() => loadAccounts()}
            disabled={loading}
            className="p-2 rounded-xl bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 transition-colors cursor-pointer"
            title="Refresh accounts"
            aria-label="Refresh accounts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#D4202C]' : ''}`} />
          </button>

          {/* Toggle multi-select mode for students */}
          <button
            type="button"
            onClick={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              setSelectedStudentIds([]);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
              isMultiSelectMode
                ? 'bg-[#111111] text-white border-[#111111]'
                : 'bg-white text-[#111111] border-[#E5E7EB] hover:bg-gray-50'
            }`}
          >
            {isMultiSelectMode ? 'Cancel multi-select' : 'Multi-select students'}
          </button>

          {/* Dedicated Add Admin button */}
          <button
            type="button"
            onClick={() => {
              setCreateRole('admin');
              setIsCreating(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-900 text-white text-xs sm:text-sm font-semibold hover:bg-black transition-colors cursor-pointer shadow-xs"
            title="Add a new administrator account"
          >
            <ShieldAlert className="w-4 h-4 text-[#D4202C]" />
            <span>Add Admin</span>
          </button>

          {/* Create account button */}
          <button
            type="button"
            onClick={() => {
              setCreateRole(roleFilter === 'admin' ? 'admin' : roleFilter === 'guide' ? 'guide' : 'student');
              setIsCreating(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D4202C] text-white text-xs sm:text-sm font-semibold hover:bg-[#b01b24] transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create account</span>
          </button>
        </div>
      </div>

      {/* Multi-select sticky action bar */}
      {isMultiSelectMode && (
        <div className="p-3.5 rounded-2xl bg-gray-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSelectAllVisibleStudents(visibleStudents)}
              className="text-xs font-semibold underline hover:no-underline cursor-pointer"
            >
              {visibleStudents.every((s) => selectedStudentIds.includes(s.id)) && visibleStudents.length > 0
                ? 'Deselect all'
                : 'Select all visible'}
            </button>
            <span className="text-xs text-gray-300">
              {selectedStudentIds.length} {selectedStudentIds.length === 1 ? 'student' : 'students'} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedStudentIds.length === 0}
              onClick={() => {
                setBatchDeleteTypedText('');
                setBatchDeleteError(null);
                setShowBatchDeleteModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#b01b24] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete selected ({selectedStudentIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-[#F3F4F6] rounded-xl self-start flex-wrap">
          {(['all', 'admin', 'guide', 'student'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                roleFilter === r
                  ? 'bg-white text-[#111111] shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              {r === 'all' ? 'All accounts' : `${r}s`}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px] sm:w-72">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, roll, or email..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#D4202C]"
          />
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button onClick={loadAccounts} className="font-semibold underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Accounts List */}
      {loading ? (
        <div className="p-12 text-center text-xs sm:text-sm text-[#6B7280]">
          Loading accounts and programs...
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-xs sm:text-sm text-[#6B7280] flex flex-col items-center justify-center">
          <Pentagon size={56} className="mb-3" />
          <p>
            {searchQuery
              ? 'No accounts match your search criteria.'
              : 'No accounts configured in this category.'}
          </p>
          {roleFilter === 'admin' && !searchQuery && (
            <button
              type="button"
              onClick={() => {
                setCreateRole('admin');
                setIsCreating(true);
              }}
              className="mt-3.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black transition-colors flex items-center gap-1.5"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#D4202C]" />
              <span>Add Admin Account</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAccounts.map((user) => {
            const isMenuOpen = openMenuUserId === user.id;
            const isSelected = selectedStudentIds.includes(user.id);
            const studentPrograms = studentProgramsMap.get(user.id) || [];
            const guidePrograms = guideProgramsMap.get(user.id) || [];
            const isDeactivated = user.isActive === false;

            return (
              <div
                key={user.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  isDeactivated
                    ? 'bg-gray-50/70 border-gray-200 opacity-75'
                    : 'bg-[#F3F4F6] border-gray-100 hover:border-gray-200'
                } flex flex-col sm:flex-row sm:items-start justify-between gap-4`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Checkbox in multi-select mode for students */}
                  {isMultiSelectMode && user.role === 'student' && (
                    <button
                      type="button"
                      onClick={() => handleToggleSelectStudent(user.id)}
                      className="mt-0.5 text-[#D4202C] cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 fill-[#D4202C] text-white" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  )}

                  <div className="space-y-2 min-w-0 flex-1">
                    {/* Name, role badge, active badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm sm:text-base text-[#111111] truncate">
                        {user.fullName}
                      </h3>
                      <span className="text-xs text-[#6B7280] font-normal">
                        @{user.username}
                      </span>
                      <span
                        className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-md ${
                          user.role === 'admin'
                            ? 'bg-black text-white'
                            : user.role === 'guide'
                            ? 'bg-[#D4202C] text-white'
                            : 'bg-white text-[#111111] border border-gray-200'
                        }`}
                      >
                        {user.role}
                      </span>
                      {isDeactivated ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-gray-200 text-gray-700">
                          Deactivated
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </div>

                    {user.email && (
                      <p className="text-xs text-[#6B7280] truncate">
                        Email: {user.email}
                      </p>
                    )}

                    {/* Student Card: List programs he belongs to and each program's guide(s) */}
                    {user.role === 'student' && (
                      <div className="pt-1.5 border-t border-gray-200/60">
                        <span className="text-xs font-semibold text-[#6B7280] block mb-1">
                          Programs ({studentPrograms.length}):
                        </span>
                        {studentPrograms.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No programs enrolled yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {studentPrograms.map((p) => (
                              <span
                                key={p.id}
                                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[#111111]"
                              >
                                <BookOpen className="w-3 h-3 text-[#D4202C] shrink-0" />
                                <strong>{p.name}</strong>
                                <span className="text-[#6B7280]">
                                  · Guide: {p.guideNames && p.guideNames.length > 0 ? p.guideNames.join(', ') : 'None'}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Guide Card: List programs he guides */}
                    {user.role === 'guide' && (
                      <div className="pt-1.5 border-t border-gray-200/60">
                        <span className="text-xs font-semibold text-[#6B7280] block mb-1">
                          Programs guided ({guidePrograms.length}):
                        </span>
                        {guidePrograms.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No programs assigned yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {guidePrograms.map((p) => (
                              <span
                                key={p.id}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[#111111]"
                              >
                                <BookOpen className="w-3 h-3 text-[#D4202C] shrink-0" />
                                <span>{p.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right actions: The "..." menu button */}
                <div className="relative shrink-0 self-end sm:self-start" ref={isMenuOpen ? menuRef : null}>
                  <button
                    type="button"
                    onClick={() => setOpenMenuUserId(isMenuOpen ? null : user.id)}
                    className="p-2 rounded-xl bg-white hover:bg-gray-100 text-[#6B7280] hover:text-[#111111] border border-gray-200 shadow-2xs transition-colors cursor-pointer"
                    title="Account options"
                    aria-label="Account options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-40 text-left animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuUserId(null);
                          setEditTargetUser(user);
                          setEditFullName(user.fullName);
                          setEditEmail(user.email || '');
                          setEditError(null);
                        }}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-[#111111] hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span>Edit details</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuUserId(null);
                          setResetTargetUser(user);
                          setResetPasswordVal('');
                          setResetError(null);
                        }}
                        className="w-full px-3.5 py-2 text-xs font-semibold text-[#111111] hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5 text-[#D4202C]" />
                        <span>Reset password</span>
                      </button>

                      {user.role !== 'admin' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(user)}
                            className="w-full px-3.5 py-2 text-xs font-semibold text-[#111111] hover:bg-gray-50 flex items-center gap-2 cursor-pointer"
                          >
                            {user.isActive !== false ? (
                              <>
                                <UserX className="w-3.5 h-3.5 text-amber-600" />
                                <span>Deactivate account</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5 text-green-600" />
                                <span>Reactivate account</span>
                              </>
                            )}
                          </button>

                          <div className="my-1 border-t border-gray-100" />

                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(user)}
                            className="w-full px-3.5 py-2 text-xs font-semibold text-[#D4202C] hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#D4202C]" />
                            <span>Delete account</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- MODAL 1: Create Account Modal --- */}
      <CreateUserModal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onSuccess={loadAccounts}
        onNotify={onNotify}
        guides={accounts.filter((a) => a.role === 'guide')}
        initialRole={createRole}
      />

      {/* --- MODAL 2: Reset Password Modal --- */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">Reset password</h3>
                <p className="text-xs text-[#6B7280]">
                  {resetTargetUser.fullName} (@{resetTargetUser.username})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-4">
              {resetError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  New password (min. 4 characters)
                </label>
                <input
                  type="password"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  placeholder="Enter new password (min. 4 characters)"
                  required
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSaving || resetPasswordVal.length < 4}
                  className="px-4 py-2 text-xs font-semibold bg-[#D4202C] text-white rounded-xl hover:bg-[#b01b24] disabled:opacity-50 cursor-pointer"
                >
                  {resetSaving ? 'Saving...' : 'Save password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Edit User Details Modal --- */}
      {editTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">Edit details</h3>
                <p className="text-xs text-[#6B7280]">@{editTargetUser.username}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditTargetUser(null)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Notification email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="e.g. name@gmail.com"
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTargetUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving || !editFullName.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-[#D4202C] text-white rounded-xl hover:bg-[#b01b24] disabled:opacity-50 cursor-pointer"
                >
                  {editSaving ? 'Saving...' : 'Save details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Single User Delete Confirmation Modal (Part 6) --- */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#D4202C] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setDeleteTargetUser(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="font-bold text-base sm:text-lg text-[#111111]">
                Delete {deleteTargetUser.role === 'guide' ? 'guide' : 'student'} account
              </h3>
              <p className="text-xs text-[#6B7280] mt-1">
                You are about to permanently delete{' '}
                <strong className="text-[#111111]">{deleteTargetUser.fullName}</strong> (@{deleteTargetUser.username}).
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Impact section */}
            {loadingImpact ? (
              <div className="p-3 rounded-xl bg-gray-50 text-xs text-[#6B7280] text-center">
                Calculating deletion impact...
              </div>
            ) : deleteImpact ? (
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 space-y-2 text-xs">
                <span className="font-bold text-[#111111] block">Data impact of deletion:</span>
                {deleteTargetUser.role === 'guide' ? (
                  <>
                    <div className="space-y-1 text-gray-600">
                      <div>• Programs currently guided: <strong>{deleteImpact.programsGuided}</strong></div>
                      <div>• Tasks authored: <strong>{deleteImpact.tasksCount}</strong></div>
                      <div>• Remarks written: <strong>{deleteImpact.remarksCount}</strong></div>
                    </div>
                    {deleteImpact.programsGuided > 0 ? (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                        ⚠️ This guide still guides {deleteImpact.programsGuided} {deleteImpact.programsGuided === 1 ? 'program' : 'programs'}. Remove him from them first in the Programs tab before deleting.
                      </div>
                    ) : (
                      <div className="text-gray-600 italic">
                        Deleting a guide also permanently deletes the tasks and remarks he wrote.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-1 text-gray-600">
                    <div>• Attendance records: <strong>{deleteImpact.attendanceDays} days</strong></div>
                    <div>• Tasks: <strong>{deleteImpact.tasksCount}</strong></div>
                    <div>• Guidance remarks: <strong>{deleteImpact.remarksCount}</strong></div>
                    <div>• Uploaded files & screenshots: <strong>{deleteImpact.filesCount}</strong></div>
                  </div>
                )}
              </div>
            ) : null}

            {/* If guide still guides programs, offer "Deactivate instead" */}
            {deleteTargetUser.role === 'guide' && deleteImpact && deleteImpact.programsGuided > 0 ? (
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeleteTargetUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111] rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const u = deleteTargetUser;
                    setDeleteTargetUser(null);
                    handleToggleActive(u);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 cursor-pointer"
                >
                  Deactivate instead
                </button>
              </div>
            ) : (
              <>
                {/* Typing confirmation */}
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1">
                    To confirm, please type <strong className="text-[#D4202C]">{deleteTargetUser.username}</strong> below:
                  </label>
                  <input
                    type="text"
                    value={deleteTypedUsername}
                    onChange={(e) => setDeleteTypedUsername(e.target.value)}
                    placeholder={deleteTargetUser.username}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const u = deleteTargetUser;
                      setDeleteTargetUser(null);
                      handleToggleActive(u);
                    }}
                    className="text-xs font-semibold text-gray-600 hover:text-[#111111] underline cursor-pointer"
                  >
                    Deactivate instead
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteTargetUser(null)}
                      disabled={deleteSubmitting}
                      className="px-3.5 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111] rounded-xl hover:bg-gray-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteDeleteUser}
                      disabled={deleteSubmitting || deleteTypedUsername !== deleteTargetUser.username}
                      className="px-4 py-2 text-xs font-semibold bg-[#D4202C] text-white rounded-xl hover:bg-[#b01b24] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{deleteSubmitting ? 'Deleting...' : 'Delete account'}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 5: Batch Delete Students Modal (Part 6) --- */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#D4202C] flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="font-bold text-base sm:text-lg text-[#111111]">
                Delete {selectedStudentIds.length} {selectedStudentIds.length === 1 ? 'student' : 'students'}
              </h3>
              <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                This will permanently delete {selectedStudentIds.length} student accounts, including all their attendance records, tasks, guidance remarks, and uploaded files.
              </p>
            </div>

            {batchDeleteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{batchDeleteError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                To confirm this batch deletion, type <strong className="text-[#D4202C]">DELETE</strong> below:
              </label>
              <input
                type="text"
                value={batchDeleteTypedText}
                onChange={(e) => setBatchDeleteTypedText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(false)}
                disabled={batchDeleteSubmitting}
                className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111] rounded-xl hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchDelete}
                disabled={batchDeleteSubmitting || batchDeleteTypedText.trim() !== 'DELETE'}
                className="px-4 py-2 text-xs font-semibold bg-[#D4202C] text-white rounded-xl hover:bg-[#b01b24] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{batchDeleteSubmitting ? 'Deleting...' : `Delete selected (${selectedStudentIds.length})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
