import React, { useState, useEffect } from 'react';
import { User, Program, StudentProgramGuideAssignment } from '../../types';
import { api } from '../../api';
import { supabase } from '../../lib/supabase';
import { Plus, Key, Edit, X, UserPlus, AlertCircle, Search, UserMinus, Trash2, Check, CheckSquare, Square, Users } from 'lucide-react';
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

  // Multi-guide picker / assignment modal state
  const [guidePickerTarget, setGuidePickerTarget] = useState<User | null>(null);
  const [selectedGuideIds, setSelectedGuideIds] = useState<string[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<'add' | 'replace'>('add');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('general');
  const [assignments, setAssignments] = useState<StudentProgramGuideAssignment[]>([]);
  const [programsList, setProgramsList] = useState<Program[]>([]);
  const [guidePickerSearch, setGuidePickerSearch] = useState('');
  const [isGuideSubmitting, setIsGuideSubmitting] = useState(false);
  const [guidePickerError, setGuidePickerError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Assign students to guide modal state (one guide -> many students)
  const [assignStudentsGuideTarget, setAssignStudentsGuideTarget] = useState<User | null>(null);
  const [selectedStudentIdsForGuide, setSelectedStudentIdsForGuide] = useState<string[]>([]);
  const [guideAssignProgramId, setGuideAssignProgramId] = useState<string>('general');
  const [guideAssignMode, setGuideAssignMode] = useState<'add' | 'replace'>('add');
  const [studentPickerSearch, setStudentPickerSearch] = useState('');
  const [isAssignStudentsSubmitting, setIsAssignStudentsSubmitting] = useState(false);
  const [assignStudentsError, setAssignStudentsError] = useState<string | null>(null);

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
      const [res, progRes, assignRes] = await Promise.all([
        api.getAdminAccounts(),
        api.getAdminPrograms().catch(() => ({ programs: [] })),
        api.getProgramGuides().catch(() => []),
      ]);
      setAccounts(res.accounts);
      setProgramsList((progRes.programs as any) || []);
      setAssignments(assignRes || []);
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
        email: editEmail.trim() || undefined,
      });

      setEditTargetUser(null);
      onNotify('Account details updated.');
      loadAccounts();
    } catch (err: any) {
      console.error('[updateAccount] error:', err.message || err);
      setEditError(err.message || "Couldn't update account. Try again.");
    } finally {
      setEditSaving(false);
    }
  };

  const getGuidesForStudent = (studentId: string) => {
    const studentUser = accounts.find((a) => a.id === studentId);
    const directAssignments = assignments.filter((a) => a.studentId === studentId);
    const guideMap = new Map<string, { id: string; fullName: string; username: string; programs: string[] }>();

    // Program assignments
    for (const a of directAssignments) {
      const existing = guideMap.get(a.guideId);
      const isGen = !a.programId || a.programId === 'general';
      const progName = isGen ? 'General' : (a.programName || 'Program');

      if (existing) {
        if (!isGen && a.programName && !existing.programs.includes(a.programName)) {
          existing.programs.push(a.programName);
        }
      } else {
        guideMap.set(a.guideId, {
          id: a.guideId,
          fullName: a.guideName || 'Guide',
          username: a.guideUsername || '',
          programs: isGen ? [] : [progName],
        });
      }
    }

    return Array.from(guideMap.values());
  };

  const handleOpenAssignGuides = (student: User) => {
    setGuidePickerTarget(student);
    const current = getGuidesForStudent(student.id);
    setSelectedGuideIds(current.map((g) => g.id));
    setAssignmentMode('add');
    setSelectedProgramId('general');
    setGuidePickerSearch('');
    setGuidePickerError(null);
  };

  const handleExecuteSaveGuides = async () => {
    if (!guidePickerTarget) return;
    if (selectedGuideIds.length === 0) {
      setGuidePickerError('Please select at least one guide to assign.');
      return;
    }
    setIsGuideSubmitting(true);
    setGuidePickerError(null);

    try {
      const res = await api.assignStudentGuides(
        guidePickerTarget.id,
        selectedGuideIds,
        selectedProgramId,
        assignmentMode
      );
      setIsGuideSubmitting(false);
      setGuidePickerTarget(null);
      setSelectedGuideIds([]);
      await loadAccounts();
      onNotify(res.message || `Updated guides for ${guidePickerTarget.fullName}.`);
    } catch (err: any) {
      console.error('[assignStudentGuides] error:', err);
      setGuidePickerError(err.message || "Couldn't assign guides. Try again.");
      setIsGuideSubmitting(false);
    }
  };

  const handleRemoveSingleGuide = async (guideId: string) => {
    if (!guidePickerTarget) return;
    setIsGuideSubmitting(true);
    setGuidePickerError(null);
    try {
      await api.removeStudentGuide(guidePickerTarget.id, guideId, selectedProgramId || 'general');
      setSelectedGuideIds((prev) => prev.filter((id) => id !== guideId));
      await loadAccounts();
      onNotify('Removed guide assignment.');
    } catch (err: any) {
      setGuidePickerError(err.message || 'Failed to remove guide.');
    } finally {
      setIsGuideSubmitting(false);
    }
  };

  const handleOpenAssignStudentsToGuide = (guideUser: User) => {
    setAssignStudentsGuideTarget(guideUser);
    // Find students currently assigned to this guide
    const currentlyAssigned = accounts
      .filter((u) => u.role === 'student')
      .filter((s) => {
        const guides = getGuidesForStudent(s.id);
        return guides.some((g) => g.id === guideUser.id);
      })
      .map((s) => s.id);

    setSelectedStudentIdsForGuide(currentlyAssigned);
    setGuideAssignProgramId('general');
    setGuideAssignMode('add');
    setStudentPickerSearch('');
    setAssignStudentsError(null);
  };

  const handleExecuteSaveStudentsToGuide = async () => {
    if (!assignStudentsGuideTarget) return;
    if (selectedStudentIdsForGuide.length === 0 && guideAssignMode === 'add') {
      setAssignStudentsError('Please select at least one student.');
      return;
    }
    setIsAssignStudentsSubmitting(true);
    setAssignStudentsError(null);

    try {
      const res = await api.assignGuideStudents(
        assignStudentsGuideTarget.id,
        selectedStudentIdsForGuide,
        guideAssignProgramId,
        guideAssignMode
      );
      setIsAssignStudentsSubmitting(false);
      setAssignStudentsGuideTarget(null);
      setSelectedStudentIdsForGuide([]);
      await loadAccounts();
      onNotify(res.message || `Updated student assignments for ${assignStudentsGuideTarget.fullName}.`);
    } catch (err: any) {
      console.error('[assignGuideStudents] error:', err);
      setAssignStudentsError(err.message || "Couldn't assign students. Try again.");
      setIsAssignStudentsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setDeleteSubmitting(true);
    setDeleteError(null);

    const targetName = deleteTargetUser.fullName || deleteTargetUser.username;
    try {
      await api.deleteAccount(deleteTargetUser.id);
      const msg = `${targetName} has been deleted!`;
      setDeleteTargetUser(null);
      setDeleteSubmitting(false);
      setDeletedNotice(msg);
      onNotify(msg);
      await loadAccounts();
    } catch (err: any) {
      console.error('[deleteAccount] error:', err.message || err);
      setDeleteError(err.message || "Couldn't delete account. Try again.");
      setDeleteSubmitting(false);
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

      {/* Deleted notification banner */}
      {deletedNotice && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-900 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-600 shrink-0"></span>
            <span>{deletedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeletedNotice(null)}
            className="p-1 rounded-md text-green-700 hover:text-green-900 hover:bg-green-100 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
                  {user.role === 'student' && (() => {
                    const studentGuides = getGuidesForStudent(user.id);
                    return (
                      <span className="inline-flex items-center gap-1.5 flex-wrap">
                        <span>• Guides:</span>
                        {studentGuides.length > 0 ? (
                          <>
                            {studentGuides.map((g) => (
                              <span
                                key={g.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111]"
                              >
                                {g.fullName}
                                {g.programs[0] && g.programs[0] !== 'General' && (
                                  <span className="text-[10px] text-[#6B7280]">
                                    ({g.programs[0]})
                                  </span>
                                )}
                              </span>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleOpenAssignGuides(user)}
                              className="px-2 py-0.5 rounded-md bg-white hover:bg-gray-100 text-xs font-semibold text-[#111111] transition-colors cursor-pointer border border-[#E5E7EB]"
                            >
                              Manage ({studentGuides.length})
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-[#D4202C] font-semibold">No guide</span>
                            <button
                              type="button"
                              onClick={() => handleOpenAssignGuides(user)}
                              className="px-2 py-0.5 rounded-md bg-[#D4202C] hover:bg-[#B81B26] text-xs font-semibold text-white transition-colors cursor-pointer"
                            >
                              Assign guides
                            </button>
                          </>
                        )}
                      </span>
                    );
                  })()}
                  {user.role === 'guide' && (
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      <span>• <strong className="text-[#111111] font-semibold">{getStudentCountForGuide(user.id)}</strong> {getStudentCountForGuide(user.id) === 1 ? 'student' : 'students'}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenAssignStudentsToGuide(user)}
                        className="px-2 py-0.5 rounded-md bg-white border border-[#E5E7EB] hover:bg-gray-100 text-xs font-semibold text-[#111111] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Users className="w-3 h-3 text-[#D4202C]" />
                        <span>Manage students</span>
                      </button>
                    </span>
                  )}
                  {user.email && <span>• {user.email}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {user.role === 'guide' && (
                  <button
                    type="button"
                    onClick={() => handleOpenAssignStudentsToGuide(user)}
                    className="px-2.5 py-2 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-100 text-xs font-semibold text-[#111111] transition-colors cursor-pointer hidden md:flex items-center gap-1.5"
                    title={`Assign students to ${user.fullName}`}
                  >
                    <Users className="w-3.5 h-3.5 text-[#D4202C]" />
                    <span>Assign students</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditTargetUser(user);
                    setEditFullName(user.fullName);
                    setEditEmail(user.email || '');
                    setEditGuideId('');
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
                  className="p-2 rounded-xl bg-white text-[#111111] hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Reset password"
                >
                  <Key className="w-3.5 h-3.5 text-[#D4202C]" />
                </button>
                {(user.role === 'student' || user.role === 'guide') && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTargetUser(user);
                      setDeleteError(null);
                    }}
                    className="p-2 rounded-xl bg-white text-[#D4202C] hover:bg-red-50 hover:text-[#B81B26] transition-colors cursor-pointer"
                    title={`Delete ${user.role === 'guide' ? 'guide' : 'student'}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
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

      {/* Multi-Guide Assignment Modal */}
      {guidePickerTarget && (() => {
        const currentGuides = getGuidesForStudent(guidePickerTarget.id);
        const filteredGuides = guides.filter((g) => {
          if (!guidePickerSearch.trim()) return true;
          return (
            matchesSearch(g.fullName, guidePickerSearch) ||
            matchesSearch(g.username, guidePickerSearch)
          );
        });

        const toggleGuideSelect = (guideId: string) => {
          if (selectedGuideIds.includes(guideId)) {
            setSelectedGuideIds(selectedGuideIds.filter((id) => id !== guideId));
          } else {
            setSelectedGuideIds([...selectedGuideIds, guideId]);
          }
        };

        const selectAllVisible = () => {
          const visibleIds = filteredGuides.map((g) => g.id);
          setSelectedGuideIds(Array.from(new Set([...selectedGuideIds, ...visibleIds])));
        };

        const clearSelection = () => {
          setSelectedGuideIds([]);
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-[#111111] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#D4202C]" />
                    <span>Assign Guides to Student</span>
                  </h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Student: <strong className="text-[#111111]">{guidePickerTarget.fullName}</strong> ({guidePickerTarget.username})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGuidePickerTarget(null)}
                  className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {guidePickerError && (
                <div className="mx-4 mt-3 p-3 rounded-xl bg-red-50 text-xs font-semibold text-[#D4202C] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{guidePickerError}</span>
                </div>
              )}

              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                {/* Currently Assigned Guides */}
                {currentGuides.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-2">
                    <div className="text-xs font-semibold text-[#6B7280]">
                      Currently assigned guides ({currentGuides.length}):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentGuides.map((cg) => (
                        <div
                          key={cg.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] shadow-2xs"
                        >
                          <span>{cg.fullName}</span>
                          {cg.programs[0] && cg.programs[0] !== 'General' && (
                            <span className="text-[10px] text-[#6B7280] font-normal">
                              ({cg.programs[0]})
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveSingleGuide(cg.id)}
                            disabled={isGuideSubmitting}
                            className="p-0.5 rounded hover:bg-red-50 text-[#D4202C] cursor-pointer"
                            title={`Remove ${cg.fullName}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assignment Settings: Program & Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#111111] mb-1">
                      Program / Role
                    </label>
                    <select
                      value={selectedProgramId}
                      onChange={(e) => setSelectedProgramId(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#F3F4F6] text-xs font-medium text-[#111111] border-0 focus:ring-2 focus:ring-[#D4202C]"
                    >
                      <option value="general">General Guide (All programs)</option>
                      {programsList.map((prog) => (
                        <option key={prog.id} value={prog.id}>
                          {prog.name} ({prog.category || 'Stage'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#111111] mb-1">
                      Assignment Mode
                    </label>
                    <div className="flex items-center gap-2 h-10">
                      <label className="flex items-center gap-1.5 text-xs text-[#111111] cursor-pointer">
                        <input
                          type="radio"
                          name="assignMode"
                          checked={assignmentMode === 'add'}
                          onChange={() => setAssignmentMode('add')}
                          className="accent-[#D4202C]"
                        />
                        <span>Add (keep others)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-[#111111] cursor-pointer ml-2">
                        <input
                          type="radio"
                          name="assignMode"
                          checked={assignmentMode === 'replace'}
                          onChange={() => setAssignmentMode('replace')}
                          className="accent-[#D4202C]"
                        />
                        <span>Replace all</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Search guides */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
                    <input
                      type="text"
                      value={guidePickerSearch}
                      onChange={(e) => setGuidePickerSearch(e.target.value)}
                      placeholder="Search guides by name or roll number"
                      className="w-full h-[40px] pl-9 pr-8 rounded-[10px] bg-[#F3F4F6] text-xs text-[#111111] placeholder:text-[#6B7280] border border-transparent focus:border-[#D4202C] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D4202C]"
                    />
                    {guidePickerSearch && (
                      <button
                        type="button"
                        onClick={() => setGuidePickerSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6B7280]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#6B7280]">
                    <span>
                      <strong className="text-[#111111] font-semibold">{selectedGuideIds.length}</strong> {selectedGuideIds.length === 1 ? 'guide' : 'guides'} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllVisible}
                        className="text-xs text-[#D4202C] font-semibold hover:underline cursor-pointer"
                      >
                        Select all
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-xs text-[#6B7280] hover:text-[#111111] cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                {/* Guide Checkbox List */}
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {filteredGuides.map((g) => {
                    const isSelected = selectedGuideIds.includes(g.id);
                    const sCount = getStudentCountForGuide(g.id);

                    return (
                      <div
                        key={g.id}
                        onClick={() => toggleGuideSelect(g.id)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#D4202C] bg-red-50/50 shadow-2xs'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-[#D4202C] border-[#D4202C] text-white'
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs sm:text-sm text-[#111111] truncate">
                              {g.fullName}
                            </div>
                            <div className="text-[11px] text-[#6B7280]">
                              @{g.username}
                            </div>
                          </div>
                        </div>

                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#111111] shrink-0">
                          {sCount} {sCount === 1 ? 'student' : 'students'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#F3F4F6] flex items-center justify-between gap-2">
                <span className="text-xs text-[#6B7280]">
                  {selectedGuideIds.length === 0 ? 'No guides selected' : `${selectedGuideIds.length} guides selected`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGuidePickerTarget(null)}
                    disabled={isGuideSubmitting}
                    className="px-4 py-2 rounded-[10px] text-xs font-semibold text-[#6B7280] hover:bg-gray-100 cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteSaveGuides}
                    disabled={selectedGuideIds.length === 0 || isGuideSubmitting}
                    className="h-[42px] px-5 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    {isGuideSubmitting
                      ? 'Saving...'
                      : `Assign ${selectedGuideIds.length} ${selectedGuideIds.length === 1 ? 'Guide' : 'Guides'}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Assign Students to Guide Modal (One Guide -> Many Students) */}
      {assignStudentsGuideTarget && (() => {
        const studentAccounts = accounts.filter((u) => u.role === 'student');
        const filteredStudents = studentAccounts.filter((s) => {
          if (!studentPickerSearch.trim()) return true;
          const q = normalizeText(studentPickerSearch);
          return normalizeText(s.fullName).includes(q) || normalizeText(s.username).includes(q);
        });

        const allVisibleSelected =
          filteredStudents.length > 0 &&
          filteredStudents.every((s) => selectedStudentIdsForGuide.includes(s.id));

        const toggleSelectAllVisible = () => {
          if (allVisibleSelected) {
            const visibleIds = new Set(filteredStudents.map((s) => s.id));
            setSelectedStudentIdsForGuide((prev) => prev.filter((id) => !visibleIds.has(id)));
          } else {
            const next = new Set([...selectedStudentIdsForGuide, ...filteredStudents.map((s) => s.id)]);
            setSelectedStudentIdsForGuide(Array.from(next));
          }
        };

        const toggleStudent = (sId: string) => {
          setSelectedStudentIdsForGuide((prev) =>
            prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
          );
        };

        return (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-[#F3F4F6] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#111111]">
                    Assign Students to Guide
                  </h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Guide: <strong className="text-[#111111]">{assignStudentsGuideTarget.fullName}</strong> (@{assignStudentsGuideTarget.username})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignStudentsGuideTarget(null)}
                  className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {assignStudentsError && (
                <div className="mx-4 mt-3 p-3 rounded-xl bg-red-50 text-xs font-semibold text-[#D4202C] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{assignStudentsError}</span>
                </div>
              )}

              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                {/* Assignment settings: Program & Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#111111] mb-1">
                      Program / Role
                    </label>
                    <select
                      value={guideAssignProgramId}
                      onChange={(e) => setGuideAssignProgramId(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#F3F4F6] text-xs font-medium text-[#111111] border-0 focus:ring-2 focus:ring-[#D4202C]"
                    >
                      <option value="general">General Guide (All programs)</option>
                      {programsList.map((prog) => (
                        <option key={prog.id} value={prog.id}>
                          {prog.name} ({prog.category || 'Stage'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#111111] mb-1">
                      Assignment Mode
                    </label>
                    <div className="flex items-center gap-2 h-10">
                      <label className="flex items-center gap-1.5 text-xs text-[#111111] cursor-pointer">
                        <input
                          type="radio"
                          name="guideAssignMode"
                          checked={guideAssignMode === 'add'}
                          onChange={() => setGuideAssignMode('add')}
                          className="accent-[#D4202C]"
                        />
                        <span>Add (keep others)</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-[#111111] cursor-pointer ml-2">
                        <input
                          type="radio"
                          name="guideAssignMode"
                          checked={guideAssignMode === 'replace'}
                          onChange={() => setGuideAssignMode('replace')}
                          className="accent-[#D4202C]"
                        />
                        <span>Replace all</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Search & Bulk selection tools */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-[#111111]">
                      Select Students ({selectedStudentIdsForGuide.length} selected)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleSelectAllVisible}
                        className="text-xs text-[#D4202C] font-semibold hover:underline cursor-pointer"
                      >
                        {allVisibleSelected ? 'Deselect visible' : 'Select all visible'}
                      </button>
                      {selectedStudentIdsForGuide.length > 0 && (
                        <>
                          <span className="text-[#D1D5DB]">•</span>
                          <button
                            type="button"
                            onClick={() => setSelectedStudentIdsForGuide([])}
                            className="text-xs text-[#6B7280] font-semibold hover:underline cursor-pointer"
                          >
                            Clear all
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                    <input
                      type="text"
                      placeholder="Search student by name or roll number..."
                      value={studentPickerSearch}
                      onChange={(e) => setStudentPickerSearch(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#F3F4F6] text-xs font-medium text-[#111111] placeholder:text-[#6B7280] border-0 focus:ring-2 focus:ring-[#D4202C]"
                    />
                  </div>
                </div>

                {/* Students Checklist */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {filteredStudents.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#6B7280] bg-[#F9FAFB] rounded-xl">
                      No students found matching "{studentPickerSearch}".
                    </div>
                  ) : (
                    filteredStudents.map((s) => {
                      const isSelected = selectedStudentIdsForGuide.includes(s.id);
                      const currentGuides = getGuidesForStudent(s.id);

                      return (
                        <div
                          key={s.id}
                          onClick={() => toggleStudent(s.id)}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-red-50/50 border-[#D4202C]'
                              : 'bg-white border-[#E5E7EB] hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-[#D4202C] focus:ring-[#D4202C] border-gray-300 accent-[#D4202C] shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-xs sm:text-sm text-[#111111] truncate">
                                {s.fullName}
                              </div>
                              <div className="text-[11px] text-[#6B7280]">
                                Roll: {s.username}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {currentGuides.length > 0 ? (
                              <div className="text-[11px] text-[#6B7280] max-w-[140px] truncate">
                                {currentGuides.map((g) => g.fullName).join(', ')}
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#9CA3AF]">
                                No guides
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-[#F3F4F6] flex items-center justify-between gap-2">
                <span className="text-xs text-[#6B7280]">
                  {selectedStudentIdsForGuide.length === 0
                    ? 'No students selected'
                    : `${selectedStudentIdsForGuide.length} ${selectedStudentIdsForGuide.length === 1 ? 'student' : 'students'} selected`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignStudentsGuideTarget(null)}
                    disabled={isAssignStudentsSubmitting}
                    className="px-4 py-2 rounded-[10px] text-xs font-semibold text-[#6B7280] hover:bg-gray-100 cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteSaveStudentsToGuide}
                    disabled={
                      (selectedStudentIdsForGuide.length === 0 && guideAssignMode === 'add') ||
                      isAssignStudentsSubmitting
                    }
                    className="h-[42px] px-5 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    {isAssignStudentsSubmitting
                      ? 'Saving...'
                      : `Assign ${selectedStudentIdsForGuide.length} ${
                          selectedStudentIdsForGuide.length === 1 ? 'Student' : 'Students'
                        }`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete User Confirmation Modal */}
      {deleteTargetUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-[#D4202C] shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={() => {
                  setDeleteTargetUser(null);
                  setDeleteError(null);
                }}
                className="p-1 rounded-lg text-[#6B7280] hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="font-bold text-lg text-[#111111]">
                Delete {deleteTargetUser.role === 'guide' ? 'Guide' : 'Student'}?
              </h3>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1.5 leading-relaxed">
                Are you sure you want to delete <strong className="text-[#111111]">{deleteTargetUser.fullName}</strong> ({deleteTargetUser.username})?
                {deleteTargetUser.role === 'guide'
                  ? ' Any students currently assigned to this guide will become unassigned. This action cannot be undone.'
                  : ' All attendance records, submitted tasks, and program enrollments for this student will be permanently deleted. This action cannot be undone.'}
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-red-50 text-xs font-semibold text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={() => {
                  setDeleteTargetUser(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2.5 rounded-[10px] text-xs sm:text-sm font-semibold text-[#6B7280] hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleteSubmitting}
                className="px-5 py-2.5 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] text-white text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {deleteSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
