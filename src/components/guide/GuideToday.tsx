import React, { useState, useEffect, useMemo } from 'react';
import { GuideTodayData, LadderLevel, LADDER_POINTS, Program } from '../../types';
import { api } from '../../api';
import { Check, Bell, ChevronDown, ChevronUp, Search, X, AlertCircle } from 'lucide-react';
import { RemindSheet } from './RemindSheet';
import { Pentagon } from '../brand/Decorations';

interface GuideTodayProps {
  onRemindSuccess: (msg: string) => void;
}

const LADDER_OPTIONS: { level: LadderLevel; marks: number; label: string }[] = [
  { level: 'Poor', marks: 5, label: '5 Poor' },
  { level: 'Average', marks: 6, label: '6 Average' },
  { level: 'Good', marks: 7, label: '7 Good' },
  { level: 'Very good', marks: 8, label: '8 Very good' },
  { level: 'Excellent', marks: 9, label: '9 Excellent' },
  { level: 'Outstanding', marks: 10, label: '10 Outstanding' },
];

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[monthIdx] || parts[1]} ${year}`;
}

function formatProgramsOneLine(programs: Program[]): string {
  if (!programs || programs.length === 0) return 'No program yet';
  if (programs.length === 1) return programs[0].name;
  return `${programs[0].name} +${programs.length - 1} more`;
}

interface StudentDraft {
  status: 'present' | 'absent';
  level: LadderLevel | null;
  note: string;
  originalStatus: 'present' | 'absent';
  originalLevel: LadderLevel | null;
  originalNote: string;
}

export const GuideToday: React.FC<GuideTodayProps> = ({ onRemindSuccess }) => {
  const [data, setData] = useState<GuideTodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Remind Sheet state & 60s cooldown map
  const [remindSheetTarget, setRemindSheetTarget] = useState<{ id: string; name: string } | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [, setNow] = useState(Date.now());

  // Active expanded card
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [expandedMode, setExpandedMode] = useState<'present_score' | 'absent_note' | null>(null);

  // Per-student drafts
  const [drafts, setDrafts] = useState<Record<string, StudentDraft>>({});

  // Status flags
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [saveSuccessStudentId, setSaveSuccessStudentId] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string | null>>({});
  const [unsavedWarningStudentId, setUnsavedWarningStudentId] = useState<string | null>(null);

  useEffect(() => {
    loadTodayData();
  }, []);

  // Timer tick for 60-second cooldown badges
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTodayData = async () => {
    setLoading(true);
    try {
      const res = await api.getGuideToday();
      setData(res);

      // Initialize drafts for any student currently in State B (Needs score) so their card is ready
      const initialDrafts: Record<string, StudentDraft> = {};
      let firstNeedsScoreId: string | null = null;
      res.mentees.forEach((m) => {
        initialDrafts[m.student.id] = {
          status: m.attendance.status,
          level: m.attendance.level,
          note: m.attendance.note || '',
          originalStatus: m.attendance.status,
          originalLevel: m.attendance.level,
          originalNote: m.attendance.note || '',
        };
        if (m.attendance.status === 'present' && !m.attendance.level && !firstNeedsScoreId) {
          firstNeedsScoreId = m.student.id;
        }
      });
      setDrafts(initialDrafts);

      // If there is a student needing score, default expand them
      if (firstNeedsScoreId) {
        setExpandedStudentId(firstNeedsScoreId);
        setExpandedMode('present_score');
      }
    } catch {
      setError("Couldn't load students. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const getCooldownRemaining = (studentId: string): number => {
    const expireTime = cooldowns[studentId];
    if (!expireTime) return 0;
    const diff = Math.ceil((expireTime - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  };

  const handleSendReminder = async (message: string) => {
    if (!remindSheetTarget) return;
    const targetId = remindSheetTarget.id;
    const res = await api.remindStudent({
      studentId: targetId,
      message,
    });
    setCooldowns((prev) => ({
      ...prev,
      [targetId]: Date.now() + 60000,
    }));
    onRemindSuccess(res.message);
  };

  /**
   * Checks if an expanded student has unsaved draft changes.
   */
  const checkHasUnsavedChanges = (studentId: string): boolean => {
    const draft = drafts[studentId];
    if (!draft) return false;
    return (
      draft.status !== draft.originalStatus ||
      draft.level !== draft.originalLevel ||
      draft.note.trim() !== draft.originalNote.trim()
    );
  };

  /**
   * Safely switches expanded student, enforcing Rule 7 (unsaved changes guard).
   */
  const requestSwitchExpanded = (
    nextStudentId: string,
    nextMode: 'present_score' | 'absent_note'
  ): boolean => {
    if (expandedStudentId && expandedStudentId !== nextStudentId) {
      if (checkHasUnsavedChanges(expandedStudentId)) {
        setUnsavedWarningStudentId(expandedStudentId);
        return false;
      }
    }

    setUnsavedWarningStudentId(null);
    setExpandedStudentId(nextStudentId);
    setExpandedMode(nextMode);

    // Initialize or refresh draft for target student
    const mentee = data?.mentees.find((m) => m.student.id === nextStudentId);
    if (mentee) {
      const origStatus = mentee.attendance.status;
      const origLevel = mentee.attendance.level;
      const origNote = mentee.attendance.note || '';

      setDrafts((prev) => ({
        ...prev,
        [nextStudentId]: {
          status: nextMode === 'present_score' ? 'present' : 'absent',
          level: nextMode === 'present_score' ? origLevel : null,
          note: origNote,
          originalStatus: origStatus,
          originalLevel: origLevel,
          originalNote: origNote,
        },
      }));
    }
    return true;
  };

  /**
   * User taps "Mark present" on State A compact row.
   */
  const handleMarkPresent = (studentId: string) => {
    requestSwitchExpanded(studentId, 'present_score');
  };

  /**
   * User taps row body of State A (Note-only expanded card).
   */
  const handleRowClickStateA = (studentId: string) => {
    if (expandedStudentId === studentId && expandedMode === 'absent_note') {
      if (checkHasUnsavedChanges(studentId)) {
        setUnsavedWarningStudentId(studentId);
        return;
      }
      setExpandedStudentId(null);
      setExpandedMode(null);
      setUnsavedWarningStudentId(null);
      return;
    }
    requestSwitchExpanded(studentId, 'absent_note');
  };

  /**
   * User taps row body of State C (Done row).
   */
  const handleRowClickStateC = (studentId: string) => {
    if (expandedStudentId === studentId && expandedMode === 'present_score') {
      if (checkHasUnsavedChanges(studentId)) {
        setUnsavedWarningStudentId(studentId);
        return;
      }
      setExpandedStudentId(null);
      setExpandedMode(null);
      setUnsavedWarningStudentId(null);
      return;
    }
    requestSwitchExpanded(studentId, 'present_score');
  };

  /**
   * Update draft fields for active student.
   */
  const updateDraft = (studentId: string, updates: Partial<StudentDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        ...updates,
      },
    }));
    setSaveErrors((prev) => ({ ...prev, [studentId]: null }));
    setUnsavedWarningStudentId(null);
  };

  /**
   * Toggle to Absent from expanded card.
   * Prompts confirmation only if a level exists.
   */
  const handleToggleToAbsent = async (studentId: string) => {
    if (!data) return;
    const draft = drafts[studentId];
    const mentee = data.mentees.find((m) => m.student.id === studentId);
    if (!draft || !mentee) return;

    // Rule 6: ask "Mark absent? This clears today's score." only when a level exists.
    const hasLevel = Boolean(draft.level || mentee.attendance.level);
    if (hasLevel) {
      const ok = window.confirm("Mark absent? This clears today's score.");
      if (!ok) return;
    }

    setSavingStudentId(studentId);
    setSaveErrors((prev) => ({ ...prev, [studentId]: null }));

    try {
      const noteToSave = draft.note.trim() || null;
      await api.markGuideAttendance({
        studentId,
        date: data.date,
        status: 'absent',
        level: null,
        note: noteToSave,
      });

      // Update locally
      setData((prev) => {
        if (!prev) return prev;
        const updatedMentees = prev.mentees.map((m) => {
          if (m.student.id !== studentId) return m;
          return {
            ...m,
            attendance: {
              ...m.attendance,
              status: 'absent' as const,
              level: null,
              points: 0,
              note: noteToSave,
              isMarked: true,
            },
          };
        });
        const presentCount = updatedMentees.filter((m) => m.attendance.status === 'present').length;
        return {
          ...prev,
          presentCount,
          mentees: updatedMentees,
        };
      });

      setSaveSuccessStudentId(studentId);
      setTimeout(() => {
        setSaveSuccessStudentId(null);
        setExpandedStudentId(null);
        setExpandedMode(null);
        setUnsavedWarningStudentId(null);
      }, 500);

      // Refetch whole screen in background
      api.getGuideToday(data.date).then((refreshed) => {
        setData(refreshed);
      });
    } catch {
      setSaveErrors((prev) => ({ ...prev, [studentId]: "Couldn't save. Try again." }));
    } finally {
      setSavingStudentId(null);
    }
  };

  /**
   * Save Note only (from State A note-only card). Keeps student absent.
   */
  const handleSaveNoteOnly = async (studentId: string) => {
    if (!data) return;
    const draft = drafts[studentId];
    if (!draft) return;

    setSavingStudentId(studentId);
    setSaveErrors((prev) => ({ ...prev, [studentId]: null }));

    try {
      const noteToSave = draft.note.trim() || null;
      await api.markGuideAttendance({
        studentId,
        date: data.date,
        status: 'absent',
        level: null,
        note: noteToSave,
      });

      // Update locally
      setData((prev) => {
        if (!prev) return prev;
        const updatedMentees = prev.mentees.map((m) => {
          if (m.student.id !== studentId) return m;
          return {
            ...m,
            attendance: {
              ...m.attendance,
              status: 'absent' as const,
              note: noteToSave,
              isMarked: true,
            },
          };
        });
        return {
          ...prev,
          mentees: updatedMentees,
        };
      });

      setSaveSuccessStudentId(studentId);
      setTimeout(() => {
        setSaveSuccessStudentId(null);
        setExpandedStudentId(null);
        setExpandedMode(null);
        setUnsavedWarningStudentId(null);
      }, 500);

      // Refetch whole screen in background
      api.getGuideToday(data.date).then((refreshed) => {
        setData(refreshed);
      });
    } catch {
      setSaveErrors((prev) => ({ ...prev, [studentId]: "Couldn't save. Try again." }));
    } finally {
      setSavingStudentId(null);
    }
  };

  /**
   * Save full card: status 'present', score_level (5-10) and note together.
   * Shows short "Saved" message and collapses card after ~600ms into State C.
   */
  const handleSaveFull = async (studentId: string) => {
    if (!data) return;
    const draft = drafts[studentId];
    if (!draft || !draft.level) return;

    setSavingStudentId(studentId);
    setSaveErrors((prev) => ({ ...prev, [studentId]: null }));

    try {
      const noteToSave = draft.note.trim() || null;
      await api.markGuideAttendance({
        studentId,
        date: data.date,
        status: 'present',
        level: draft.level,
        note: noteToSave,
      });

      // Update locally
      const points = LADDER_POINTS[draft.level];
      setData((prev) => {
        if (!prev) return prev;
        const updatedMentees = prev.mentees.map((m) => {
          if (m.student.id !== studentId) return m;
          return {
            ...m,
            attendance: {
              ...m.attendance,
              status: 'present' as const,
              level: draft.level,
              points,
              note: noteToSave,
              isMarked: true,
            },
          };
        });
        const presentCount = updatedMentees.filter((m) => m.attendance.status === 'present').length;
        return {
          ...prev,
          presentCount,
          mentees: updatedMentees,
        };
      });

      setSaveSuccessStudentId(studentId);
      setTimeout(() => {
        setSaveSuccessStudentId(null);
        setExpandedStudentId(null);
        setExpandedMode(null);
        setUnsavedWarningStudentId(null);
      }, 600);

      // Refetch in background
      api.getGuideToday(data.date).then((refreshed) => {
        setData(refreshed);
      });
    } catch {
      setSaveErrors((prev) => ({ ...prev, [studentId]: "Couldn't save. Try again." }));
    } finally {
      setSavingStudentId(null);
    }
  };

  /**
   * Cancel expanded card.
   */
  const handleCancelExpanded = (studentId: string) => {
    if (checkHasUnsavedChanges(studentId)) {
      const ok = window.confirm('Discard unsaved changes?');
      if (!ok) return;
    }
    setExpandedStudentId(null);
    setExpandedMode(null);
    setUnsavedWarningStudentId(null);
  };

  // Filter students by search
  const filteredMentees = useMemo(() => {
    if (!data) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return data.mentees;
    return data.mentees.filter((m) => {
      const nameMatch = m.student.fullName.toLowerCase().includes(query);
      const programMatch = m.programs.some((p) => p.name.toLowerCase().includes(query));
      return nameMatch || programMatch;
    });
  }, [data, searchQuery]);

  // Group filtered students into the 3 groups
  const { needsScoreList, notMetYetList, doneList } = useMemo(() => {
    const needsScore: typeof filteredMentees = [];
    const notMetYet: typeof filteredMentees = [];
    const done: typeof filteredMentees = [];

    filteredMentees.forEach((m) => {
      if (m.attendance.status === 'absent') {
        notMetYet.push(m);
      } else if (m.attendance.status === 'present' && !m.attendance.level) {
        needsScore.push(m);
      } else if (m.attendance.status === 'present' && Boolean(m.attendance.level)) {
        done.push(m);
      }
    });

    return { needsScoreList: needsScore, notMetYetList: notMetYet, doneList: done };
  }, [filteredMentees]);

  if (loading) {
    return (
      <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
        Loading today's students...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] text-sm text-[#111111] flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
        <span>{error || 'Unable to load data.'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20">
      {/* Header with Date and Marked Present count */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
            Today
          </h2>
          <span className="text-sm font-semibold text-[#111111]">
            {formatDisplayDate(data.date)}
          </span>
        </div>
        <p className="text-[13px] sm:text-sm text-[#111111] mt-0.5">
          Marked present {data.presentCount} of {data.totalMentees} students
        </p>
      </div>

      {/* Search box if guide has more than 8 students */}
      {data.mentees.length > 8 && (
        <div className="relative">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students"
            className="w-full h-11 pl-10 pr-9 rounded-[10px] bg-[#F3F4F6] text-[#111111] text-xs sm:text-sm border border-transparent focus:border-[#D4202C] focus:bg-white outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6B7280] hover:text-[#111111]"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {data.mentees.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280] flex flex-col items-center justify-center">
          <Pentagon size={64} className="mb-2" />
          <p>No students assigned to you yet. Please contact the administrator.</p>
        </div>
      ) : filteredMentees.length === 0 ? (
        <div className="p-6 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          No students match your search.
        </div>
      ) : (
        <div className="space-y-6">
          {/* GROUP 1: Needs score (n) */}
          {needsScoreList.length > 0 && (
            <section aria-labelledby="heading-needs-score" className="space-y-2.5">
              <h3 id="heading-needs-score" className="text-sm font-bold text-[#111111]">
                Needs score ({needsScoreList.length})
              </h3>
              <div className="space-y-2.5">
                {needsScoreList.map((mentee) => {
                  const student = mentee.student;
                  const isExpanded = expandedStudentId === student.id;
                  const draft = drafts[student.id] || {
                    status: 'present',
                    level: null,
                    note: mentee.attendance.note || '',
                    originalStatus: 'present',
                    originalLevel: null,
                    originalNote: mentee.attendance.note || '',
                  };
                  const isSaving = savingStudentId === student.id;
                  const saveSuccess = saveSuccessStudentId === student.id;
                  const saveError = saveErrors[student.id];
                  const hasUnsavedWarning = unsavedWarningStudentId === student.id;
                  const remainingCooldown = getCooldownRemaining(student.id);
                  const isRemindDisabled = remainingCooldown > 0;

                  return (
                    <div
                      key={student.id}
                      className="rounded-2xl bg-[#F3F4F6] border border-transparent transition-all overflow-hidden"
                    >
                      {/* State B Expanded Card Layout */}
                      <div className="p-4 sm:p-5 space-y-3.5">
                        {/* Name and programs + Remind button */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="font-bold text-base text-[#111111] truncate">
                              {student.fullName}
                            </h4>
                            <p className="text-[13px] text-[#6B7280] truncate mt-0.5">
                              {formatProgramsOneLine(mentee.programs)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setRemindSheetTarget({ id: student.id, name: student.fullName })
                            }
                            disabled={isRemindDisabled}
                            className="w-[44px] h-[44px] rounded-[10px] bg-white border border-[#E5E7EB] text-[#111111] hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center shrink-0 transition-colors"
                            title={isRemindDisabled ? `Wait ${remainingCooldown}s to remind again` : 'Send reminder'}
                            aria-label={`Remind ${student.fullName}`}
                          >
                            <Bell className="w-4 h-4 text-[#D4202C]" />
                          </button>
                        </div>

                        {/* Present / Absent toggle (Present selected) */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => updateDraft(student.id, { status: 'present' })}
                            className="h-11 rounded-xl text-xs sm:text-sm font-semibold bg-[#D4202C] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Present</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleToAbsent(student.id)}
                            disabled={isSaving}
                            className="h-11 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#111111] hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <span>-</span>
                            <span>Absent</span>
                          </button>
                        </div>

                        {/* Label: Not scored yet */}
                        <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280] pt-0.5">
                          <span>Not scored yet</span>
                          {draft.level && (
                            <span className="text-[#111111] font-bold">
                              Selected: {draft.level}
                            </span>
                          )}
                        </div>

                        {/* Six levels in 2 cols on mobile, 3 on wide screens */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {LADDER_OPTIONS.map((opt) => {
                            const isSelected = draft.level === opt.level;
                            return (
                              <button
                                key={opt.level}
                                type="button"
                                onClick={() => updateDraft(student.id, { level: opt.level })}
                                disabled={isSaving}
                                className={`h-11 px-3 rounded-xl text-xs sm:text-sm font-semibold text-center transition-colors flex items-center justify-center cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#D4202C] text-white'
                                    : 'bg-white border border-[#E5E7EB] text-[#111111] hover:bg-gray-100'
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Note field with 500-char counter */}
                        <div className="space-y-1">
                          <textarea
                            value={draft.note}
                            maxLength={500}
                            onChange={(e) => updateDraft(student.id, { note: e.target.value })}
                            placeholder="Note about today's work (optional)"
                            rows={3}
                            disabled={isSaving}
                            className="w-full p-3 rounded-xl bg-white border border-[#E5E7EB] text-xs sm:text-sm text-[#111111] placeholder-[#6B7280] outline-none focus:border-[#D4202C] resize-none transition-colors"
                          />
                          <div className="flex justify-end text-xs text-[#6B7280]">
                            <span>{draft.note.length}/500</span>
                          </div>
                        </div>

                        {/* Feedback messages */}
                        {hasUnsavedWarning && (
                          <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
                            <span>You have unsaved changes</span>
                          </div>
                        )}
                        {saveError && (
                          <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#111111] flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
                            <span>{saveError}</span>
                          </div>
                        )}
                        {saveSuccess && (
                          <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                            <Check className="w-4 h-4 text-[#28B058] shrink-0 stroke-[3]" />
                            <span>Saved</span>
                          </div>
                        )}

                        {/* Red Save button (disabled until a level is chosen) */}
                        <button
                          type="button"
                          onClick={() => handleSaveFull(student.id)}
                          disabled={!draft.level || isSaving}
                          className="w-full h-12 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* GROUP 2: Not met yet (n) */}
          {notMetYetList.length > 0 && (
            <section aria-labelledby="heading-not-met-yet" className="space-y-2.5">
              <h3 id="heading-not-met-yet" className="text-sm font-bold text-[#111111]">
                Not met yet ({notMetYetList.length})
              </h3>
              <div className="space-y-2.5">
                {notMetYetList.map((mentee) => {
                  const student = mentee.student;
                  const isExpanded = expandedStudentId === student.id;
                  const mode = expandedMode;
                  const draft = drafts[student.id] || {
                    status: 'absent',
                    level: null,
                    note: mentee.attendance.note || '',
                    originalStatus: 'absent',
                    originalLevel: null,
                    originalNote: mentee.attendance.note || '',
                  };
                  const isSaving = savingStudentId === student.id;
                  const saveSuccess = saveSuccessStudentId === student.id;
                  const saveError = saveErrors[student.id];
                  const hasUnsavedWarning = unsavedWarningStudentId === student.id;
                  const remainingCooldown = getCooldownRemaining(student.id);
                  const isRemindDisabled = remainingCooldown > 0;

                  // Expanded into State B (Present & needs score) because user tapped "Mark present"
                  if (isExpanded && mode === 'present_score') {
                    return (
                      <div
                        key={student.id}
                        className="rounded-2xl bg-[#F3F4F6] border border-transparent transition-all overflow-hidden"
                      >
                        <div className="p-4 sm:p-5 space-y-3.5">
                          {/* Name and programs + Remind button */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="font-bold text-base text-[#111111] truncate">
                                {student.fullName}
                              </h4>
                              <p className="text-[13px] text-[#6B7280] truncate mt-0.5">
                                {formatProgramsOneLine(mentee.programs)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setRemindSheetTarget({ id: student.id, name: student.fullName })
                              }
                              disabled={isRemindDisabled}
                              className="w-[44px] h-[44px] rounded-[10px] bg-white border border-[#E5E7EB] text-[#111111] hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center shrink-0 transition-colors"
                              title={isRemindDisabled ? `Wait ${remainingCooldown}s to remind again` : 'Send reminder'}
                              aria-label={`Remind ${student.fullName}`}
                            >
                              <Bell className="w-4 h-4 text-[#D4202C]" />
                            </button>
                          </div>

                          {/* Present / Absent toggle */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => updateDraft(student.id, { status: 'present' })}
                              className="h-11 rounded-xl text-xs sm:text-sm font-semibold bg-[#D4202C] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>Present</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelExpanded(student.id)}
                              className="h-11 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#111111] hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <span>-</span>
                              <span>Absent</span>
                            </button>
                          </div>

                          {/* Label: Not scored yet */}
                          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280] pt-0.5">
                            <span>Not scored yet</span>
                            {draft.level && (
                              <span className="text-[#111111] font-bold">
                                Selected: {draft.level}
                              </span>
                            )}
                          </div>

                          {/* Six levels in 2 cols on mobile, 3 on wide screens */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {LADDER_OPTIONS.map((opt) => {
                              const isSelected = draft.level === opt.level;
                              return (
                                <button
                                  key={opt.level}
                                  type="button"
                                  onClick={() => updateDraft(student.id, { level: opt.level })}
                                  disabled={isSaving}
                                  className={`h-11 px-3 rounded-xl text-xs sm:text-sm font-semibold text-center transition-colors flex items-center justify-center cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#D4202C] text-white'
                                      : 'bg-white border border-[#E5E7EB] text-[#111111] hover:bg-gray-100'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Note field with 500-char counter */}
                          <div className="space-y-1">
                            <textarea
                              value={draft.note}
                              maxLength={500}
                              onChange={(e) => updateDraft(student.id, { note: e.target.value })}
                              placeholder="Note about today's work (optional)"
                              rows={3}
                              disabled={isSaving}
                              className="w-full p-3 rounded-xl bg-white border border-[#E5E7EB] text-xs sm:text-sm text-[#111111] placeholder-[#6B7280] outline-none focus:border-[#D4202C] resize-none transition-colors"
                            />
                            <div className="flex justify-end text-xs text-[#6B7280]">
                              <span>{draft.note.length}/500</span>
                            </div>
                          </div>

                          {/* Feedback messages */}
                          {hasUnsavedWarning && (
                            <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
                              <span>You have unsaved changes</span>
                            </div>
                          )}
                          {saveError && (
                            <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#111111] flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
                              <span>{saveError}</span>
                            </div>
                          )}
                          {saveSuccess && (
                            <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                              <Check className="w-4 h-4 text-[#28B058] shrink-0 stroke-[3]" />
                              <span>Saved</span>
                            </div>
                          )}

                          {/* Actions: Save button (disabled until a level is chosen) + Cancel link */}
                          <button
                            type="button"
                            onClick={() => handleSaveFull(student.id)}
                            disabled={!draft.level || isSaving}
                            className="w-full h-12 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <div className="text-center pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleCancelExpanded(student.id)}
                              className="text-xs text-[#6B7280] hover:text-[#111111] underline cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Expanded into Note-Only Card (tapping row itself while absent)
                  if (isExpanded && mode === 'absent_note') {
                    return (
                      <div
                        key={student.id}
                        className="rounded-2xl bg-[#F3F4F6] border border-transparent transition-all overflow-hidden"
                      >
                        <div className="p-4 sm:p-5 space-y-3.5">
                          {/* Name and programs + Remind button */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-base text-[#111111] truncate">
                                  {student.fullName}
                                </h4>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E5E7EB] text-[#6B7280] text-xs font-semibold">
                                  <span className="font-bold leading-none">-</span>
                                  <span>Absent</span>
                                </span>
                              </div>
                              <p className="text-[13px] text-[#6B7280] truncate mt-0.5">
                                {formatProgramsOneLine(mentee.programs)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setRemindSheetTarget({ id: student.id, name: student.fullName })
                              }
                              disabled={isRemindDisabled}
                              className="w-[44px] h-[44px] rounded-[10px] bg-white border border-[#E5E7EB] text-[#111111] hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center shrink-0 transition-colors"
                              title={isRemindDisabled ? `Wait ${remainingCooldown}s to remind again` : 'Send reminder'}
                              aria-label={`Remind ${student.fullName}`}
                            >
                              <Bell className="w-4 h-4 text-[#D4202C]" />
                            </button>
                          </div>

                          {/* Note field with 500-char counter */}
                          <div className="space-y-1">
                            <textarea
                              value={draft.note}
                              maxLength={500}
                              onChange={(e) => updateDraft(student.id, { note: e.target.value })}
                              placeholder="Note about today's work (optional)"
                              rows={3}
                              disabled={isSaving}
                              className="w-full p-3 rounded-xl bg-white border border-[#E5E7EB] text-xs sm:text-sm text-[#111111] placeholder-[#6B7280] outline-none focus:border-[#D4202C] resize-none transition-colors"
                            />
                            <div className="flex justify-end text-xs text-[#6B7280]">
                              <span>{draft.note.length}/500</span>
                            </div>
                          </div>

                          {/* Feedback messages */}
                          {hasUnsavedWarning && (
                            <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
                              <span>You have unsaved changes</span>
                            </div>
                          )}
                          {saveError && (
                            <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#111111] flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
                              <span>{saveError}</span>
                            </div>
                          )}
                          {saveSuccess && (
                            <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                              <Check className="w-4 h-4 text-[#28B058] shrink-0 stroke-[3]" />
                              <span>Saved</span>
                            </div>
                          )}

                          {/* Save note + Cancel */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveNoteOnly(student.id)}
                              disabled={isSaving}
                              className="flex-1 h-11 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
                            >
                              {isSaving ? 'Saving note...' : 'Save note'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelExpanded(student.id)}
                              disabled={isSaving}
                              className="px-4 h-11 rounded-[10px] bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Compact Row (Default State A)
                  return (
                    <div
                      key={student.id}
                      role="button"
                      tabIndex={0}
                      aria-expanded={false}
                      onClick={() => handleRowClickStateA(student.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClickStateA(student.id);
                        }
                      }}
                      className="min-h-[56px] p-3 sm:p-3.5 rounded-2xl bg-[#F3F4F6] flex items-center justify-between gap-3 hover:bg-gray-200/60 transition-colors cursor-pointer select-none"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#111111] truncate">
                            {student.fullName}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E5E7EB] text-[#6B7280] text-xs font-semibold shrink-0">
                            <span className="font-bold leading-none">-</span>
                            <span>Absent</span>
                          </span>
                        </div>
                        <p className="text-[13px] text-[#6B7280] truncate mt-0.5">
                          {formatProgramsOneLine(mentee.programs)}
                        </p>
                        {mentee.attendance.note && (
                          <p className="text-[13px] text-[#6B7280] italic truncate mt-0.5">
                            Note: {mentee.attendance.note}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkPresent(student.id);
                          }}
                          className="h-[44px] px-3 sm:px-4 rounded-[10px] bg-white border border-[#D4202C] text-[#D4202C] hover:bg-red-50 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                          aria-label={`Mark ${student.fullName} present`}
                        >
                          Mark present
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRemindSheetTarget({ id: student.id, name: student.fullName });
                          }}
                          disabled={isRemindDisabled}
                          className="w-[44px] h-[44px] rounded-[10px] bg-white border border-[#E5E7EB] text-[#111111] hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                          title={isRemindDisabled ? `Wait ${remainingCooldown}s to remind again` : 'Send reminder'}
                          aria-label={`Remind ${student.fullName}`}
                        >
                          <Bell className="w-4 h-4 text-[#D4202C]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* GROUP 3: Done (n) */}
          {doneList.length > 0 && (
            <section aria-labelledby="heading-done" className="space-y-2.5">
              <h3 id="heading-done" className="text-sm font-bold text-[#111111]">
                Done ({doneList.length})
              </h3>
              <div className="space-y-2.5">
                {doneList.map((mentee) => {
                  const student = mentee.student;
                  const isExpanded = expandedStudentId === student.id;
                  const draft = drafts[student.id] || {
                    status: 'present',
                    level: mentee.attendance.level,
                    note: mentee.attendance.note || '',
                    originalStatus: 'present',
                    originalLevel: mentee.attendance.level,
                    originalNote: mentee.attendance.note || '',
                  };
                  const isSaving = savingStudentId === student.id;
                  const saveSuccess = saveSuccessStudentId === student.id;
                  const saveError = saveErrors[student.id];
                  const hasUnsavedWarning = unsavedWarningStudentId === student.id;
                  const remainingCooldown = getCooldownRemaining(student.id);
                  const isRemindDisabled = remainingCooldown > 0;

                  const streakText = mentee.streak === 1 ? '1 day streak' : `${mentee.streak} days streak`;
                  const pointsText = mentee.totalPoints === 1 ? '1 point' : `${mentee.totalPoints} points`;
                  const marks = mentee.attendance.level ? LADDER_POINTS[mentee.attendance.level] : '';

                  if (isExpanded) {
                    return (
                      <div
                        key={student.id}
                        className="rounded-2xl bg-[#F3F4F6] border border-transparent transition-all overflow-hidden"
                      >
                        <div className="p-4 sm:p-5 space-y-3.5">
                          {/* Name and programs + Remind button */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="font-bold text-base text-[#111111] truncate">
                                {student.fullName}
                              </h4>
                              <p className="text-[13px] text-[#6B7280] truncate mt-0.5">
                                {formatProgramsOneLine(mentee.programs)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setRemindSheetTarget({ id: student.id, name: student.fullName })
                              }
                              disabled={isRemindDisabled}
                              className="w-[44px] h-[44px] rounded-[10px] bg-white border border-[#E5E7EB] text-[#111111] hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center shrink-0 transition-colors"
                              title={isRemindDisabled ? `Wait ${remainingCooldown}s to remind again` : 'Send reminder'}
                              aria-label={`Remind ${student.fullName}`}
                            >
                              <Bell className="w-4 h-4 text-[#D4202C]" />
                            </button>
                          </div>

                          {/* Present / Absent toggle */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => updateDraft(student.id, { status: 'present' })}
                              className="h-11 rounded-xl text-xs sm:text-sm font-semibold bg-[#D4202C] text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>Present</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleToAbsent(student.id)}
                              disabled={isSaving}
                              className="h-11 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#111111] hover:bg-gray-50 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <span>-</span>
                              <span>Absent</span>
                            </button>
                          </div>

                          {/* Level indicator */}
                          <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280] pt-0.5">
                            <span>Daily preparation score</span>
                            {draft.level && (
                              <span className="text-[#111111] font-bold">
                                {LADDER_POINTS[draft.level]} points ({draft.level})
                              </span>
                            )}
                          </div>

                          {/* Six levels in 2 cols on mobile, 3 on wide screens */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {LADDER_OPTIONS.map((opt) => {
                              const isSelected = draft.level === opt.level;
                              return (
                                <button
                                  key={opt.level}
                                  type="button"
                                  onClick={() => updateDraft(student.id, { level: opt.level })}
                                  disabled={isSaving}
                                  className={`h-11 px-3 rounded-xl text-xs sm:text-sm font-semibold text-center transition-colors flex items-center justify-center cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#D4202C] text-white'
                                      : 'bg-white border border-[#E5E7EB] text-[#111111] hover:bg-gray-100'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Note field with 500-char counter */}
                          <div className="space-y-1">
                            <textarea
                              value={draft.note}
                              maxLength={500}
                              onChange={(e) => updateDraft(student.id, { note: e.target.value })}
                              placeholder="Note about today's work (optional)"
                              rows={3}
                              disabled={isSaving}
                              className="w-full p-3 rounded-xl bg-white border border-[#E5E7EB] text-xs sm:text-sm text-[#111111] placeholder-[#6B7280] outline-none focus:border-[#D4202C] resize-none transition-colors"
                            />
                            <div className="flex justify-end text-xs text-[#6B7280]">
                              <span>{draft.note.length}/500</span>
                            </div>
                          </div>

                          {/* Feedback messages */}
                          {hasUnsavedWarning && (
                            <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
                              <span>You have unsaved changes</span>
                            </div>
                          )}
                          {saveError && (
                            <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#111111] flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
                              <span>{saveError}</span>
                            </div>
                          )}
                          {saveSuccess && (
                            <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] flex items-center gap-1.5">
                              <Check className="w-4 h-4 text-[#28B058] shrink-0 stroke-[3]" />
                              <span>Saved</span>
                            </div>
                          )}

                          {/* Actions: Save button + Cancel link */}
                          <button
                            type="button"
                            onClick={() => handleSaveFull(student.id)}
                            disabled={!draft.level || isSaving}
                            className="w-full h-12 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <div className="text-center pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleCancelExpanded(student.id)}
                              className="text-xs text-[#6B7280] hover:text-[#111111] underline cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // State C Compact Row
                  return (
                    <div
                      key={student.id}
                      role="button"
                      tabIndex={0}
                      aria-expanded={false}
                      onClick={() => handleRowClickStateC(student.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClickStateC(student.id);
                        }
                      }}
                      className="min-h-[56px] p-3 sm:p-3.5 rounded-2xl bg-[#F3F4F6] flex items-center justify-between gap-3 hover:bg-gray-200/60 transition-colors cursor-pointer select-none"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-sm text-[#111111] block truncate">
                          {student.fullName}
                        </span>
                        <p className="text-[13px] text-[#6B7280] truncate mt-0.5">
                          Present · {marks} {mentee.attendance.level} · {streakText} · {pointsText}
                        </p>
                        {mentee.attendance.note && (
                          <p className="text-[13px] text-[#6B7280] italic truncate mt-0.5">
                            Note: {mentee.attendance.note}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-[#6B7280]">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Remind Sheet */}
      {remindSheetTarget && (
        <RemindSheet
          isOpen={true}
          studentId={remindSheetTarget.id}
          studentName={remindSheetTarget.name}
          onClose={() => setRemindSheetTarget(null)}
          onSend={handleSendReminder}
        />
      )}
    </div>
  );
};
