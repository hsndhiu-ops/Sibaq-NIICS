import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api';
import { supabase } from '../../lib/supabase';
import { Check, Bell, Flame, MoreVertical, Search, X, Users, AlertCircle, ArrowRight, UserMinus } from 'lucide-react';
import { Pentagon } from '../brand/Decorations';

interface AdminGuidesProps {
  onSelectStudent: (studentId: string) => void;
  onNotify: (msg: string) => void;
}

export const AdminGuides: React.FC<AdminGuidesProps> = ({
  onSelectStudent,
  onNotify,
}) => {
  const [guides, setGuides] = useState<any[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<any[]>([]);
  const [date, setDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Active student row dropdown menu
  const [activeMenuStudentId, setActiveMenuStudentId] = useState<string | null>(null);

  // Move / Assign single student modal
  const [moveStudentTarget, setMoveStudentTarget] = useState<{
    student: { id: string; fullName: string; username: string };
    currentGuide: { id: string; fullName: string } | null;
  } | null>(null);
  const [selectedTargetGuideId, setSelectedTargetGuideId] = useState<string | null>(null);
  const [guideSearchQuery, setGuideSearchQuery] = useState('');
  const [isMoveSubmitting, setIsMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Remove single student confirmation modal
  const [removeStudentTarget, setRemoveStudentTarget] = useState<{
    student: { id: string; fullName: string };
    guide: { id: string; fullName: string };
  } | null>(null);
  const [isRemoveSubmitting, setIsRemoveSubmitting] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Transfer all students modal
  const [transferSourceGuide, setTransferSourceGuide] = useState<any | null>(null);
  const [transferTargetGuideId, setTransferTargetGuideId] = useState<string | null>(null);
  const [transferMode, setTransferMode] = useState<'guide' | 'unassign'>('guide');
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [isTransferSubmitting, setIsTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Close dropdown menu when clicking outside
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuStudentId(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  useEffect(() => {
    loadGuides();
  }, []);

  const loadGuides = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminGuides();
      setGuides(res.guides);
      setDate(res.date);

      // Query unassigned students (role = 'student', guide_id is null)
      const { data: unassigned, error: unassignedErr } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('role', 'student')
        .is('guide_id', null)
        .order('full_name', { ascending: true });

      if (unassignedErr) {
        console.error('[profiles] error loading unassigned students:', unassignedErr.message || unassignedErr);
      } else {
        setUnassignedStudents(
          (unassigned || []).map((u: any) => ({
            id: u.id,
            fullName: u.full_name || u.username,
            username: u.username,
          }))
        );
      }
    } catch (_err) {
      // Graceful error handling
    } finally {
      setLoading(false);
    }
  };

  const handleRemind = async (guideId: string) => {
    try {
      const res = await api.remindGuide(guideId);
      onNotify(res.message);
    } catch (err: any) {
      console.error('[remindGuide] error:', err.message || err);
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
    return normalizeText(text).includes(cleanQuery);
  };

  // Execute set_student_guide to move or assign
  const handleExecuteMove = async () => {
    if (!moveStudentTarget || !selectedTargetGuideId) return;
    setIsMoveSubmitting(true);
    setMoveError(null);

    const targetGuide = guides.find((g) => g.id === selectedTargetGuideId);
    const targetName = targetGuide ? targetGuide.fullName : 'guide';

    const { error } = await supabase.rpc('set_student_guide', {
      p_student: moveStudentTarget.student.id,
      p_guide: selectedTargetGuideId,
    });

    if (error) {
      console.error('[set_student_guide] error:', error.message || error);
      setMoveError(error.message || "Couldn't move student. Try again.");
      setIsMoveSubmitting(false);
      return;
    }

    setIsMoveSubmitting(false);
    setMoveStudentTarget(null);
    setSelectedTargetGuideId(null);
    setGuideSearchQuery('');
    await loadGuides();
    onNotify(`Moved ${moveStudentTarget.student.fullName} to ${targetName}.`);
  };

  // Execute set_student_guide to remove
  const handleExecuteRemove = async () => {
    if (!removeStudentTarget) return;
    setIsRemoveSubmitting(true);
    setRemoveError(null);

    const { error } = await supabase.rpc('set_student_guide', {
      p_student: removeStudentTarget.student.id,
      p_guide: null,
    });

    if (error) {
      console.error('[set_student_guide] error:', error.message || error);
      setRemoveError(error.message || "Couldn't remove student. Try again.");
      setIsRemoveSubmitting(false);
      return;
    }

    setIsRemoveSubmitting(false);
    const studentName = removeStudentTarget.student.fullName;
    const guideName = removeStudentTarget.guide.fullName;
    setRemoveStudentTarget(null);
    await loadGuides();
    onNotify(`Removed ${studentName} from ${guideName}.`);
  };

  // Execute transfer_guide_students
  const handleExecuteTransfer = async () => {
    if (!transferSourceGuide) return;
    setIsTransferSubmitting(true);
    setTransferError(null);

    const pTo = transferMode === 'guide' ? transferTargetGuideId : null;
    const targetGuide = transferMode === 'guide' ? guides.find((g) => g.id === transferTargetGuideId) : null;

    const { data: movedCount, error } = await supabase.rpc('transfer_guide_students', {
      p_from: transferSourceGuide.id,
      p_to: pTo,
    });

    if (error) {
      console.error('[transfer_guide_students] error:', error.message || error);
      setTransferError(error.message || "Couldn't transfer students. Try again.");
      setIsTransferSubmitting(false);
      return;
    }

    setIsTransferSubmitting(false);
    const count = typeof movedCount === 'number' ? movedCount : transferSourceGuide.menteesCount;
    const studentLabel = count === 1 ? '1 student' : `${count} students`;
    const fromName = transferSourceGuide.fullName;

    setTransferSourceGuide(null);
    setTransferTargetGuideId(null);
    setTransferSearchQuery('');
    await loadGuides();

    if (transferMode === 'guide' && targetGuide) {
      onNotify(`Moved ${studentLabel} to ${targetGuide.fullName}.`);
    } else {
      onNotify(`Removed ${studentLabel} from ${fromName}.`);
    }
  };

  if (loading) {
    return (
      <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
        Loading guides overview...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
          Guides
        </h2>
      </div>

      {/* Section: Students without a guide (n) - hidden when empty */}
      {unassignedStudents.length > 0 && (
        <div className="p-5 rounded-2xl bg-[#F3F4F6] space-y-3 border border-red-100">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm sm:text-base text-[#111111] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D4202C]"></span>
              Students without a guide ({unassignedStudents.length})
            </h3>
          </div>
          <div className="space-y-2">
            {unassignedStudents.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl bg-white flex items-center justify-between gap-3 shadow-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-xs sm:text-sm text-[#111111] truncate">
                    {s.fullName}
                  </div>
                  <div className="text-xs text-[#6B7280]">Roll: {s.username}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMoveStudentTarget({
                      student: s,
                      currentGuide: null,
                    });
                    setSelectedTargetGuideId(null);
                    setGuideSearchQuery('');
                    setMoveError(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#D4202C] hover:bg-[#B81B26] text-white text-xs font-semibold shrink-0 transition-colors cursor-pointer"
                >
                  Assign guide
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {guides.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280] flex flex-col items-center justify-center">
          <Pentagon size={64} className="mb-3" />
          <p>No guides configured yet. Create guide accounts in the Accounts tab.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {guides.map((g) => (
            <div
              key={g.id}
              className="p-5 rounded-2xl bg-[#F3F4F6] space-y-4 relative"
            >
              {/* Guide header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base text-[#111111]">
                    {g.fullName}
                  </h3>
                  <div className="text-xs font-medium text-[#111111] mt-1">
                    Marked {g.markedCount} of {g.menteesCount} mentees today
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Transfer all students button */}
                  {g.menteesCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setTransferSourceGuide(g);
                        setTransferTargetGuideId(null);
                        setTransferMode('guide');
                        setTransferSearchQuery('');
                        setTransferError(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-100 text-xs font-semibold text-[#111111] transition-colors cursor-pointer"
                    >
                      Transfer all students
                    </button>
                  )}

                  {!g.allMarked && g.menteesCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleRemind(g.id)}
                      className="px-3 py-1.5 rounded-xl bg-white text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center gap-1.5"
                    >
                      <Bell className="w-3.5 h-3.5 text-[#6B7280]" />
                      <span>Send reminder</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-white text-[#111111]">
                      <Check className="w-3.5 h-3.5 text-[#D4202C]" />
                      All marked
                    </span>
                  )}
                </div>
              </div>

              {/* Mentees list under this guide */}
              <div className="space-y-2 pt-1 border-t border-gray-200">
                <span className="text-xs font-semibold text-[#6B7280] block mb-2">
                  Assigned mentees ({g.mentees.length}):
                </span>
                {g.mentees.length === 0 ? (
                  <div className="text-xs text-[#6B7280] p-2 bg-white rounded-xl">
                    No students currently assigned to this guide.
                  </div>
                ) : (
                  g.mentees.map((m: any) => {
                    const isPresent = m.attendance?.status === 'present';
                    const isMenuOpen = activeMenuStudentId === m.id;

                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectStudent(m.id)}
                        className="p-3 rounded-xl bg-white flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 transition-colors relative"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs sm:text-sm text-[#111111] truncate">
                            {m.fullName}
                          </div>
                          {m.programs.length > 0 && (
                            <div className="text-xs text-[#6B7280] truncate mt-0.5">
                              {m.programs.join(', ')}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isPresent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#D4202C] text-white text-xs font-semibold">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280] text-xs font-semibold">
                              <span>-</span>
                              Absent
                            </span>
                          )}

                          <div className="text-xs font-semibold text-[#111111] min-w-12 text-right">
                            {isPresent
                              ? m.attendance?.points !== null
                                ? `${m.attendance?.points} pts`
                                : 'Pending'
                              : '0 pts'}
                          </div>

                          <div className="flex items-center gap-0.5 text-xs text-[#111111] font-semibold bg-[#F3F4F6] px-2 py-0.5 rounded-lg">
                            <Flame className="w-3.5 h-3.5 text-[#D4202C]" />
                            <span>{m.streak}d</span>
                          </div>

                          {/* "..." menu button */}
                          <div
                            className="relative"
                            onClick={(e) => e.stopPropagation()}
                            ref={isMenuOpen ? menuRef : null}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuStudentId(isMenuOpen ? null : m.id);
                              }}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-[#6B7280] hover:text-[#111111] transition-colors"
                              title="Student actions"
                              aria-label="Student actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuStudentId(null);
                                    setMoveStudentTarget({
                                      student: { id: m.id, fullName: m.fullName, username: m.username },
                                      currentGuide: { id: g.id, fullName: g.fullName },
                                    });
                                    setSelectedTargetGuideId(null);
                                    setGuideSearchQuery('');
                                    setMoveError(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-[#111111] hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <ArrowRight className="w-3.5 h-3.5 text-[#6B7280]" />
                                  <span>Move to another guide</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuStudentId(null);
                                    setRemoveStudentTarget({
                                      student: { id: m.id, fullName: m.fullName },
                                      guide: { id: g.id, fullName: g.fullName },
                                    });
                                    setRemoveError(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-semibold text-[#D4202C] hover:bg-red-50 flex items-center gap-2"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                  <span>Remove from this guide</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guide Picker / Move Modal */}
      {moveStudentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  {moveStudentTarget.currentGuide ? 'Move to another guide' : 'Assign guide'}
                </h3>
                <p className="text-xs text-[#6B7280]">
                  {moveStudentTarget.student.fullName} ({moveStudentTarget.student.username})
                  {moveStudentTarget.currentGuide && ` • Current: ${moveStudentTarget.currentGuide.fullName}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMoveStudentTarget(null)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {moveError && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-red-50 text-xs font-semibold text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{moveError}</span>
              </div>
            )}

            {/* Search box */}
            <div className="p-4 pb-2">
              <div className="relative">
                <label htmlFor="modal-guide-search" className="sr-only">
                  Search guides
                </label>
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
                <input
                  id="modal-guide-search"
                  type="text"
                  value={guideSearchQuery}
                  onChange={(e) => setGuideSearchQuery(e.target.value)}
                  placeholder="Search guides by name or username"
                  className="w-full h-[44px] pl-9 pr-9 rounded-[10px] bg-[#F3F4F6] text-xs sm:text-sm text-[#111111] placeholder:text-[#6B7280] border border-transparent focus:border-[#D4202C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4202C]/20"
                />
                {guideSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setGuideSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6B7280] hover:text-[#111111]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Guides List */}
            <div className="px-4 py-2 overflow-y-auto flex-1 space-y-2">
              {guides
                .filter((g) => {
                  if (moveStudentTarget.currentGuide && g.id === moveStudentTarget.currentGuide.id) {
                    return false;
                  }
                  if (!guideSearchQuery.trim()) return true;
                  return (
                    matchesSearch(g.fullName, guideSearchQuery) ||
                    matchesSearch(g.username, guideSearchQuery)
                  );
                })
                .map((g) => {
                  const isSelected = selectedTargetGuideId === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => setSelectedTargetGuideId(g.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#D4202C] bg-red-50/40 shadow-xs'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-[#111111] truncate">
                          {g.fullName}
                        </div>
                        <div className="text-xs text-[#6B7280]">
                          Roll: {g.username}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#111111]">
                          {g.menteesCount} {g.menteesCount === 1 ? 'student' : 'students'}
                        </span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-[#D4202C] bg-[#D4202C]' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="p-4 border-t border-[#F3F4F6] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveStudentTarget(null)}
                className="px-4 py-2 rounded-[10px] text-xs font-semibold text-[#6B7280] hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteMove}
                disabled={!selectedTargetGuideId || isMoveSubmitting}
                className="h-[44px] px-5 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {isMoveSubmitting ? 'Moving...' : moveStudentTarget.currentGuide ? 'Move' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Single Student Confirmation Modal */}
      {removeStudentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4">
            <h3 className="font-bold text-base text-[#111111]">
              Remove from guide
            </h3>
            <p className="text-xs sm:text-sm text-[#111111] leading-relaxed">
              Remove {removeStudentTarget.student.fullName} from {removeStudentTarget.guide.fullName}'s list? {removeStudentTarget.guide.fullName} will no longer see this student. Open tasks stay with {removeStudentTarget.guide.fullName}.
            </p>

            {removeError && (
              <div className="p-3 rounded-xl bg-red-50 text-xs font-semibold text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{removeError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRemoveStudentTarget(null)}
                className="px-4 py-2 rounded-[10px] text-xs font-semibold text-[#6B7280] hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRemove}
                disabled={isRemoveSubmitting}
                className="px-4 py-2 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isRemoveSubmitting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer All Students Modal */}
      {transferSourceGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  Transfer all students
                </h3>
                <p className="text-xs text-[#6B7280]">
                  From {transferSourceGuide.fullName} ({transferSourceGuide.menteesCount} {transferSourceGuide.menteesCount === 1 ? 'student' : 'students'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferSourceGuide(null)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {transferError && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-red-50 text-xs font-semibold text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            <div className="p-4 space-y-3">
              {/* Option switch: Move to another guide vs Remove all */}
              <div className="flex bg-[#F3F4F6] p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTransferMode('guide')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    transferMode === 'guide' ? 'bg-white text-[#111111] shadow-xs' : 'text-[#6B7280]'
                  }`}
                >
                  Choose another guide
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTransferMode('unassign');
                    setTransferTargetGuideId(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    transferMode === 'unassign' ? 'bg-white text-[#D4202C] shadow-xs' : 'text-[#6B7280]'
                  }`}
                >
                  Remove all (leave unassigned)
                </button>
              </div>

              {transferMode === 'guide' ? (
                <>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
                    <input
                      type="text"
                      value={transferSearchQuery}
                      onChange={(e) => setTransferSearchQuery(e.target.value)}
                      placeholder="Search guides"
                      className="w-full h-[44px] pl-9 pr-9 rounded-[10px] bg-[#F3F4F6] text-xs text-[#111111] placeholder:text-[#6B7280] border border-transparent focus:border-[#D4202C] focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-2">
                    {guides
                      .filter((g) => g.id !== transferSourceGuide.id)
                      .filter((g) => {
                        if (!transferSearchQuery.trim()) return true;
                        return (
                          matchesSearch(g.fullName, transferSearchQuery) ||
                          matchesSearch(g.username, transferSearchQuery)
                        );
                      })
                      .map((g) => {
                        const isSelected = transferTargetGuideId === g.id;
                        return (
                          <div
                            key={g.id}
                            onClick={() => setTransferTargetGuideId(g.id)}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-[#D4202C] bg-red-50/40'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-xs sm:text-sm text-[#111111] truncate">
                                {g.fullName}
                              </div>
                              <div className="text-xs text-[#6B7280]">Roll: {g.username}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#111111]">
                                {g.menteesCount} {g.menteesCount === 1 ? 'student' : 'students'}
                              </span>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-[#D4202C] bg-[#D4202C]' : 'border-gray-300'
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {transferTargetGuideId && (
                    <div className="p-3 rounded-xl bg-[#F3F4F6] text-xs text-[#111111]">
                      Move {transferSourceGuide.menteesCount}{' '}
                      {transferSourceGuide.menteesCount === 1 ? 'student' : 'students'} to{' '}
                      <strong>
                        {guides.find((g) => g.id === transferTargetGuideId)?.fullName}
                      </strong>
                      ? Their open tasks will move with them.
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-xs text-[#111111] leading-relaxed">
                  Remove all {transferSourceGuide.menteesCount}{' '}
                  {transferSourceGuide.menteesCount === 1 ? 'student' : 'students'} from{' '}
                  <strong>{transferSourceGuide.fullName}</strong>'s list? {transferSourceGuide.fullName}{' '}
                  will no longer see these students. Open tasks stay with {transferSourceGuide.fullName}.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#F3F4F6] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTransferSourceGuide(null)}
                className="px-4 py-2 rounded-[10px] text-xs font-semibold text-[#6B7280] hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                disabled={
                  isTransferSubmitting ||
                  (transferMode === 'guide' && !transferTargetGuideId)
                }
                className="h-[44px] px-5 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {isTransferSubmitting
                  ? 'Transferring...'
                  : transferMode === 'guide'
                  ? 'Transfer'
                  : 'Remove all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

