import React, { useState, useEffect, useMemo } from 'react';
import {
  GuideTodayData,
  GuideTodayProgramSection,
  LadderLevel,
  LADDER_POINTS,
  AttendanceRecord,
} from '../../types';
import { api, formatKolkataDisplayDate } from '../../api';
import { SCORE_LEVEL_MAP, ScoreLevelNumber } from '../../lib/schema';
import { Check, Bell, ChevronDown, ChevronUp, Search, X, AlertCircle, MessageSquare } from 'lucide-react';
import { RemindSheet } from './RemindSheet';
import { GuideMessageSheet } from './GuideMessageSheet';
import { Pentagon } from '../brand/Decorations';

interface GuideTodayProps {
  onRemindSuccess: (msg: string) => void;
}

const LADDER_OPTIONS: { level: LadderLevel; score: ScoreLevelNumber; label: string }[] = [
  { level: 'Poor', score: 5, label: '5 Poor' },
  { level: 'Average', score: 6, label: '6 Average' },
  { level: 'Good', score: 7, label: '7 Good' },
  { level: 'Very good', score: 8, label: '8 Very good' },
  { level: 'Excellent', score: 9, label: '9 Excellent' },
  { level: 'Outstanding', score: 10, label: '10 Outstanding' },
];

interface RowDraft {
  status: 'present' | 'absent';
  scoreLevel: number | null | undefined;
  note: string;
  originalStatus: 'present' | 'absent';
  originalScoreLevel: number | null | undefined;
  originalNote: string;
}

export const GuideToday: React.FC<GuideTodayProps> = ({ onRemindSuccess }) => {
  const [data, setData] = useState<GuideTodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Collapsed sections by programId
  const [collapsedPrograms, setCollapsedPrograms] = useState<Record<string, boolean>>({});

  // Active expanded row: keyed by attendance row ID
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedMode, setExpandedMode] = useState<'score' | 'note_only'>('score');

  // Draft state keyed by attendance ID
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});

  // Saving / error state
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});
  const [unsavedWarningRowId, setUnsavedWarningRowId] = useState<string | null>(null);

  // Remind Sheet state & 60s cooldown map
  const [remindTarget, setRemindTarget] = useState<{
    studentId: string;
    studentName: string;
    programId: string;
    programName: string;
  } | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [, setNow] = useState(Date.now());

  // Message Sheet state
  const [messageTarget, setMessageTarget] = useState<{
    programId: string;
    programName: string;
    students: Array<{ id: string; name: string }>;
    initialRecipientIds?: string[];
  } | null>(null);

  useEffect(() => {
    loadTodayData();
  }, []);

  // Tick for 60s cooldown badges
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadTodayData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getGuideToday();
      setData(res);

      // Initialize drafts for rows
      const initDrafts: Record<string, RowDraft> = {};
      res.programs.forEach((prog) => {
        prog.students.forEach((s) => {
          const att = s.attendance;
          initDrafts[att.id] = {
            status: att.status,
            scoreLevel: att.scoreLevel,
            note: att.note || '',
            originalStatus: att.status,
            originalScoreLevel: att.scoreLevel,
            originalNote: att.note || '',
          };
        });
      });
      setDrafts(initDrafts);
    } catch (err: any) {
      console.error('[loadTodayData] error:', err);
      setError(err?.message || "Couldn't load today's sessions.");
    } finally {
      setLoading(false);
    }
  };

  const isDraftDirty = (rowId: string): boolean => {
    const d = drafts[rowId];
    if (!d) return false;
    return (
      d.status !== d.originalStatus ||
      d.scoreLevel !== d.originalScoreLevel ||
      d.note !== d.originalNote
    );
  };

  const handleRowClick = (rowId: string, att: AttendanceRecord, mode: 'score' | 'note_only' = 'score') => {
    if (expandedRowId === rowId) {
      // Toggle close if not dirty
      if (isDraftDirty(rowId)) {
        setUnsavedWarningRowId(rowId);
        return;
      }
      setExpandedRowId(null);
      setUnsavedWarningRowId(null);
      return;
    }

    if (expandedRowId && isDraftDirty(expandedRowId)) {
      setUnsavedWarningRowId(expandedRowId);
      return;
    }

    setUnsavedWarningRowId(null);
    setExpandedRowId(rowId);
    setExpandedMode(mode);

    // Reset draft to current server state
    setDrafts((prev) => ({
      ...prev,
      [rowId]: {
        status: att.status,
        scoreLevel: att.scoreLevel,
        note: att.note || '',
        originalStatus: att.status,
        originalScoreLevel: att.scoreLevel,
        originalNote: att.note || '',
      },
    }));
  };

  const handleMarkPresentQuick = async (e: React.MouseEvent, rowId: string) => {
    e.stopPropagation();
    if (expandedRowId && isDraftDirty(expandedRowId)) {
      setUnsavedWarningRowId(expandedRowId);
      return;
    }

    const currentDraft = drafts[rowId];
    const currentNote = currentDraft ? currentDraft.note : '';

    // Mark as present in state B (Needs score)
    setDrafts((prev) => ({
      ...prev,
      [rowId]: {
        status: 'present',
        scoreLevel: null,
        note: currentNote,
        originalStatus: 'present',
        originalScoreLevel: null,
        originalNote: currentNote,
      },
    }));

    setExpandedRowId(rowId);
    setExpandedMode('score');
    setUnsavedWarningRowId(null);

    // Save immediate transition to present (score_level null)
    try {
      await api.updateAttendanceRow(rowId, {
        status: 'present',
        score_level: null,
        note: currentNote || null,
      });
      await loadTodayData();
    } catch (err: any) {
      console.error('[handleMarkPresentQuick] error:', err);
    }
  };

  const handleTogglePresentAbsent = (rowId: string, targetStatus: 'present' | 'absent') => {
    const draft = drafts[rowId];
    if (!draft) return;

    if (targetStatus === 'absent' && draft.scoreLevel !== null) {
      const confirmAbsent = window.confirm(
        "Mark absent? This clears today's score."
      );
      if (!confirmAbsent) return;

      setDrafts((prev) => ({
        ...prev,
        [rowId]: {
          ...draft,
          status: 'absent',
          scoreLevel: null,
        },
      }));
      return;
    }

    setDrafts((prev) => ({
      ...prev,
      [rowId]: {
        ...draft,
        status: targetStatus,
        scoreLevel: targetStatus === 'absent' ? null : draft.scoreLevel,
      },
    }));
  };

  const handleSaveRow = async (rowId: string) => {
    const draft = drafts[rowId];
    if (!draft) return;

    if (draft.status === 'present' && draft.scoreLevel === null && expandedMode === 'score') {
      return; // Save button disabled until score chosen
    }

    setSavingRowId(rowId);
    setRowErrors((prev) => ({ ...prev, [rowId]: null }));

    try {
      await api.updateAttendanceRow(rowId, {
        status: draft.status,
        score_level: draft.status === 'absent' ? null : (draft.scoreLevel ?? null),
        note: draft.note.trim() || null,
      });

      setSavedRowId(rowId);
      setTimeout(() => setSavedRowId(null), 2500);

      // Collapse card
      setExpandedRowId(null);
      setUnsavedWarningRowId(null);

      // Reload fresh data from database
      await loadTodayData();
    } catch (err: any) {
      console.error('[handleSaveRow] error:', err);
      setRowErrors((prev) => ({
        ...prev,
        [rowId]: err?.message || "Couldn't save. Try again.",
      }));
    } finally {
      setSavingRowId(null);
    }
  };

  const handleSendReminderFromSheet = async (message: string, programId: string) => {
    if (!remindTarget) return;
    await api.sendReminder(remindTarget.studentId, message, programId);
    onRemindSuccess(`Reminder sent to ${remindTarget.studentName}.`);
    // 60-second cooldown per student
    setCooldowns((prev) => ({
      ...prev,
      [remindTarget.studentId]: Date.now() + 60000,
    }));
  };

  const toggleProgramCollapse = (progId: string) => {
    setCollapsedPrograms((prev) => ({ ...prev, [progId]: !prev[progId] }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-32 bg-[#F3F4F6] rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center space-y-3">
        <Pentagon size={48} className="mx-auto" />
        <p className="text-sm font-semibold text-[#111111]">{error || "Couldn't load today's sessions."}</p>
        <button
          onClick={loadTodayData}
          className="px-4 py-2 bg-[#D4202C] text-white text-xs font-semibold rounded-xl"
        >
          Try again
        </button>
      </div>
    );
  }

  const { date, totalStudents, presentCount, programs } = data;
  const showSearch = totalStudents > 8;

  // Filter sections by search query
  const cleanSearch = searchQuery.trim().toLowerCase();
  const filteredPrograms = programs.map((prog) => {
    const matchingStudents = prog.students.filter((s) => {
      if (!cleanSearch) return true;
      return (
        s.studentName.toLowerCase().includes(cleanSearch) ||
        s.username.toLowerCase().includes(cleanSearch)
      );
    });

    // Group rows: Needs score (n), Not met yet (n), Done (n)
    const needsScore = matchingStudents.filter(
      (s) => s.attendance.status === 'present' && (s.attendance.scoreLevel === null || s.attendance.scoreLevel === undefined)
    );
    const notMetYet = matchingStudents.filter(
      (s) => s.attendance.status === 'absent'
    );
    const done = matchingStudents.filter(
      (s) => s.attendance.status === 'present' && s.attendance.scoreLevel !== null && s.attendance.scoreLevel !== undefined
    );

    return {
      ...prog,
      matchingStudents,
      groups: {
        needsScore,
        notMetYet,
        done,
      },
    };
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Top line: Normal text color, Marked present x of y students & Date */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F3F4F6] pb-3">
        <div>
          <h1 className="font-serif text-[24px] sm:text-[28px] font-normal text-[#111111]">
            Today's sessions
          </h1>
          <p className="text-sm text-[#111111] mt-0.5">
            Marked present {presentCount} of {totalStudents} {totalStudents === 1 ? 'student' : 'students'}
          </p>
        </div>
        <div className="text-xs font-semibold text-[#6B7280]">
          {formatKolkataDisplayDate(date)}
        </div>
      </div>

      {/* Search box (when more than 8 rows across programs) */}
      {showSearch && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search students"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-9 pr-8 rounded-xl bg-[#F3F4F6] text-xs font-medium text-[#111111] placeholder:text-[#6B7280] border-0 focus:ring-2 focus:ring-[#D4202C]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6B7280] hover:text-[#111111]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {programs.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center space-y-2">
          <Pentagon size={48} className="mx-auto text-[#6B7280]" />
          <h3 className="font-bold text-base text-[#111111]">No programs assigned</h3>
          <p className="text-xs text-[#6B7280]">
            You have not been assigned to guide any competition programs yet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredPrograms.map((prog) => {
            const isCollapsed = Boolean(collapsedPrograms[prog.programId]);
            const allProgStudents = prog.students.map((s) => ({
              id: s.studentId,
              name: s.studentName,
            }));

            return (
              <div
                key={prog.programId}
                className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs"
              >
                {/* Program Section Heading */}
                <div className="p-4 sm:p-5 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center justify-between gap-3">
                  <div
                    onClick={() => programs.length > 1 && toggleProgramCollapse(prog.programId)}
                    className={`flex items-center gap-2 min-w-0 ${programs.length > 1 ? 'cursor-pointer select-none' : ''}`}
                  >
                    <h2 className="font-bold text-base sm:text-lg text-[#111111] truncate">
                      {prog.programName} ({prog.studentsCount} {prog.studentsCount === 1 ? 'student' : 'students'})
                    </h2>
                    {programs.length > 1 && (
                      <button type="button" className="p-1 text-[#6B7280] hover:text-[#111111]">
                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Message button for this program */}
                    <button
                      type="button"
                      onClick={() =>
                        setMessageTarget({
                          programId: prog.programId,
                          programName: prog.programName,
                          students: allProgStudents,
                        })
                      }
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 text-xs font-semibold text-[#111111] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#D4202C]" />
                      <span>Message</span>
                    </button>
                  </div>
                </div>

                {/* Program Section Content */}
                {!isCollapsed && (
                  <div className="p-4 sm:p-5 space-y-5">
                    {prog.matchingStudents.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[#6B7280] bg-[#F9FAFB] rounded-xl">
                        {searchQuery ? `No students matching "${searchQuery}" in ${prog.programName}.` : 'No students enrolled in this program.'}
                      </div>
                    ) : (
                      <>
                        {/* Group: Needs score (n) */}
                        {prog.groups.needsScore.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-bold text-[#D4202C] tracking-wide">
                              Needs score ({prog.groups.needsScore.length})
                            </div>
                            <div className="space-y-2">
                              {prog.groups.needsScore.map((s) =>
                                renderStudentCard(s, prog.programId, prog.programName)
                              )}
                            </div>
                          </div>
                        )}

                        {/* Group: Not met yet (n) */}
                        {prog.groups.notMetYet.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-bold text-[#6B7280] tracking-wide">
                              Not met yet ({prog.groups.notMetYet.length})
                            </div>
                            <div className="space-y-2">
                              {prog.groups.notMetYet.map((s) =>
                                renderStudentCard(s, prog.programId, prog.programName)
                              )}
                            </div>
                          </div>
                        )}

                        {/* Group: Done (n) */}
                        {prog.groups.done.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-bold text-[#111111] tracking-wide">
                              Done ({prog.groups.done.length})
                            </div>
                            <div className="space-y-2">
                              {prog.groups.done.map((s) =>
                                renderStudentCard(s, prog.programId, prog.programName)
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Remind Sheet */}
      {remindTarget && (
        <RemindSheet
          isOpen={Boolean(remindTarget)}
          studentName={remindTarget.studentName}
          studentId={remindTarget.studentId}
          programId={remindTarget.programId}
          programName={remindTarget.programName}
          onClose={() => setRemindTarget(null)}
          onSend={handleSendReminderFromSheet}
        />
      )}

      {/* Message Sheet */}
      {messageTarget && (
        <GuideMessageSheet
          isOpen={Boolean(messageTarget)}
          programId={messageTarget.programId}
          programName={messageTarget.programName}
          students={messageTarget.students}
          initialRecipientIds={messageTarget.initialRecipientIds}
          onClose={() => setMessageTarget(null)}
          onSent={(msg) => onRemindSuccess(msg)}
        />
      )}
    </div>
  );

  // -------------------------------------------------------------
  // RENDER STUDENT ROW / CARD
  // -------------------------------------------------------------
  function renderStudentCard(
    s: { studentId: string; studentName: string; username: string; attendance: AttendanceRecord; note: string | null },
    programId: string,
    programName: string
  ) {
    const rowId = s.attendance.id;
    const isExpanded = expandedRowId === rowId;
    const isSaving = savingRowId === rowId;
    const isSaved = savedRowId === rowId;
    const rowError = rowErrors[rowId];
    const hasUnsavedWarning = unsavedWarningRowId === rowId;

    const draft = drafts[rowId] || {
      status: s.attendance.status,
      scoreLevel: s.attendance.scoreLevel,
      note: s.attendance.note || '',
      originalStatus: s.attendance.status,
      originalScoreLevel: s.attendance.scoreLevel,
      originalNote: s.attendance.note || '',
    };

    const isCooldownActive = Boolean(cooldowns[s.studentId] && cooldowns[s.studentId] > Date.now());
    const cooldownRemainingSec = isCooldownActive
      ? Math.ceil((cooldowns[s.studentId] - Date.now()) / 1000)
      : 0;

    // Derived states
    const isAbsent = s.attendance.status === 'absent';
    const isNeedsScore = s.attendance.status === 'present' && (s.attendance.scoreLevel === null || s.attendance.scoreLevel === undefined);
    const isDone = s.attendance.status === 'present' && s.attendance.scoreLevel !== null && s.attendance.scoreLevel !== undefined;

    // A) Not met yet (absent): compact row
    if (isAbsent && !isExpanded) {
      return (
        <div
          key={rowId}
          onClick={() => handleRowClick(rowId, s.attendance, 'note_only')}
          className="p-3.5 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-[#111111]">{s.studentName}</span>
              <span className="px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[#6B7280] text-xs font-semibold">
                Absent
              </span>
            </div>
            {s.attendance.note && (
              <p className="text-xs text-[#6B7280] truncate mt-1">
                {s.attendance.note}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Red-outline Mark Present button */}
            <button
              type="button"
              onClick={(e) => handleMarkPresentQuick(e, rowId)}
              className="h-10 px-4 rounded-xl border-2 border-[#D4202C] text-[#D4202C] hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              Mark present
            </button>

            {/* Bell button */}
            <button
              type="button"
              disabled={isCooldownActive}
              onClick={(e) => {
                e.stopPropagation();
                setRemindTarget({
                  studentId: s.studentId,
                  studentName: s.studentName,
                  programId,
                  programName,
                });
              }}
              className="h-10 w-10 rounded-xl border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#111111] hover:bg-gray-50 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer shrink-0"
              title={isCooldownActive ? `Wait ${cooldownRemainingSec}s` : 'Send reminder'}
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    // C) Done: compact row
    if (isDone && !isExpanded) {
      const levelLabel = s.attendance.scoreLevel && s.attendance.scoreLevel in SCORE_LEVEL_MAP
        ? (SCORE_LEVEL_MAP as any)[s.attendance.scoreLevel]
        : '';

      return (
        <div
          key={rowId}
          onClick={() => handleRowClick(rowId, s.attendance, 'score')}
          className="p-3.5 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-[#111111]">{s.studentName}</span>
              <span className="text-xs font-semibold text-[#111111]">
                Present · {s.attendance.scoreLevel} {levelLabel}
              </span>
            </div>
            {s.attendance.note && (
              <p className="text-xs text-[#6B7280] truncate mt-1">
                {s.attendance.note}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-[#D4202C] hover:underline">
              Edit
            </span>
          </div>
        </div>
      );
    }

    // B) Expanded card (Needs score or editing)
    return (
      <div
        key={rowId}
        className="p-4 sm:p-5 rounded-2xl border-2 border-[#D4202C] bg-white space-y-4 shadow-sm"
      >
        <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-[#111111]">
              {s.studentName}
            </h3>
            <span className="text-xs text-[#6B7280]">
              {draft.status === 'present'
                ? draft.scoreLevel !== null && draft.scoreLevel !== undefined
                  ? `Present · ${draft.scoreLevel} ${(SCORE_LEVEL_MAP as any)[draft.scoreLevel]}`
                  : 'Not scored yet'
                : 'Absent'}
            </span>
          </div>

          {/* Present / Absent toggle */}
          <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-xl">
            <button
              type="button"
              onClick={() => handleTogglePresentAbsent(rowId, 'present')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                draft.status === 'present'
                  ? 'bg-white text-[#D4202C] shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              Present
            </button>
            <button
              type="button"
              onClick={() => handleTogglePresentAbsent(rowId, 'absent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                draft.status === 'absent'
                  ? 'bg-white text-[#111111] shadow-2xs'
                  : 'text-[#6B7280] hover:text-[#111111]'
              }`}
            >
              Absent
            </button>
          </div>
        </div>

        {/* Warning if trying to navigate away with unsaved changes */}
        {hasUnsavedWarning && (
          <div className="p-3 rounded-xl bg-amber-50 text-xs font-semibold text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>You have unsaved changes. Save or cancel first.</span>
          </div>
        )}

        {/* Error message */}
        {rowError && (
          <div className="p-3 rounded-xl bg-red-50 text-xs font-semibold text-[#D4202C] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{rowError}</span>
          </div>
        )}

        {/* Score Levels: 2 columns on phones, 6 levels, only when Present */}
        {draft.status === 'present' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#111111]">
              Score level {draft.scoreLevel === null ? '(choose one)' : ''}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LADDER_OPTIONS.map((opt) => {
                const isSelected = draft.scoreLevel === opt.score;
                return (
                  <button
                    key={opt.score}
                    type="button"
                    onClick={() => {
                      setDrafts((prev) => ({
                        ...prev,
                        [rowId]: {
                          ...draft,
                          scoreLevel: opt.score,
                        },
                      }));
                    }}
                    className={`h-11 px-3 rounded-xl text-xs font-semibold border text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#D4202C] bg-red-50 text-[#D4202C]'
                        : 'border-[#E5E7EB] bg-white text-[#111111] hover:bg-gray-50'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-[#D4202C]" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Note box: ALWAYS VISIBLE */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-[#111111]">
              Note about today's work (optional)
            </label>
            <span className={`text-[11px] ${draft.note.length > 500 ? 'text-[#D4202C] font-bold' : 'text-[#6B7280]'}`}>
              {draft.note.length}/500
            </span>
          </div>
          <textarea
            rows={2}
            maxLength={500}
            value={draft.note}
            onChange={(e) => {
              const val = e.target.value;
              setDrafts((prev) => ({
                ...prev,
                [rowId]: {
                  ...draft,
                  note: val,
                },
              }));
            }}
            placeholder="Feedback, memorisation progress, practice points..."
            className="w-full p-3 rounded-xl bg-[#F3F4F6] text-xs font-medium text-[#111111] placeholder:text-[#6B7280] border-0 focus:ring-2 focus:ring-[#D4202C] resize-none"
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#F3F4F6]">
          <button
            type="button"
            onClick={() => {
              setExpandedRowId(null);
              setUnsavedWarningRowId(null);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6B7280] hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSaveRow(rowId)}
            disabled={
              isSaving ||
              (draft.status === 'present' && draft.scoreLevel === null && expandedMode === 'score')
            }
            className="h-10 px-6 rounded-xl bg-[#D4202C] hover:bg-[#B81B26] disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    );
  }
};
