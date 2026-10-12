import React, { useState, useEffect } from 'react';
import { GuideTodayData, LadderLevel, LADDER_POINTS } from '../../types';
import { api } from '../../api';
import { Check, Bell, Flame, Pencil, X } from 'lucide-react';

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

export const GuideToday: React.FC<GuideTodayProps> = ({ onRemindSuccess }) => {
  const [data, setData] = useState<GuideTodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  // Local card state: pending selections before submit
  const [localStatus, setLocalStatus] = useState<Record<string, 'present' | 'absent'>>({});
  const [localLevel, setLocalLevel] = useState<Record<string, LadderLevel | null>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [editingMap, setEditingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadTodayData();
  }, []);

  const loadTodayData = async () => {
    setLoading(true);
    try {
      const res = await api.getGuideToday();
      setData(res);

      const initStatus: Record<string, 'present' | 'absent'> = {};
      const initLevel: Record<string, LadderLevel | null> = {};
      const initNotes: Record<string, string> = {};
      const initEditing: Record<string, boolean> = {};

      res.mentees.forEach((m) => {
        const studentId = m.student.id;
        initStatus[studentId] = m.attendance.status || 'absent';
        initLevel[studentId] = m.attendance.level || null;
        initNotes[studentId] = m.attendance.note || '';
        // If already marked, start collapsed; if not marked yet, start open for entry
        initEditing[studentId] = !m.attendance.isMarked;
      });

      setLocalStatus(initStatus);
      setLocalLevel(initLevel);
      setLocalNotes(initNotes);
      setEditingMap(initEditing);
    } catch {
      setError("Couldn't load mentees. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStatus = (studentId: string, status: 'present' | 'absent') => {
    setLocalStatus((prev) => ({ ...prev, [studentId]: status }));
    if (status === 'absent') {
      setLocalLevel((prev) => ({ ...prev, [studentId]: null }));
    }
  };

  const handleSelectLadder = (studentId: string, level: LadderLevel) => {
    setLocalLevel((prev) => ({ ...prev, [studentId]: level }));
  };

  const handleSubmit = async (studentId: string) => {
    if (!data) return;
    setSavingId(studentId);

    const status = localStatus[studentId] || 'absent';
    const level = status === 'present' ? localLevel[studentId] || null : null;
    const note = (localNotes[studentId] || '').trim() || null;

    try {
      const res = await api.markGuideAttendance({
        studentId,
        date: data.date,
        status,
        level,
        note,
      });

      // Update state in place
      setData((prev) => {
        if (!prev) return prev;
        const updatedMentees = prev.mentees.map((m) => {
          if (m.student.id === studentId) {
            return {
              ...m,
              attendance: res.record,
            };
          }
          return m;
        });
        const presentCount = updatedMentees.filter(
          (m) => m.attendance.status === 'present'
        ).length;
        return {
          ...prev,
          presentCount,
          mentees: updatedMentees,
        };
      });

      // Collapse card after successful submit
      setEditingMap((prev) => ({ ...prev, [studentId]: false }));
    } catch (err: any) {
      alert(err.message || 'Failed to save attendance');
    } finally {
      setSavingId(null);
    }
  };

  const handleCancelEdit = (studentId: string) => {
    if (!data) return;
    const mentee = data.mentees.find((m) => m.student.id === studentId);
    if (mentee) {
      // Revert local values to saved attendance record
      setLocalStatus((prev) => ({ ...prev, [studentId]: mentee.attendance.status }));
      setLocalLevel((prev) => ({ ...prev, [studentId]: mentee.attendance.level }));
      setLocalNotes((prev) => ({ ...prev, [studentId]: mentee.attendance.note || '' }));
    }
    setEditingMap((prev) => ({ ...prev, [studentId]: false }));
  };

  const handleRemindMentee = async (studentId: string) => {
    setRemindingId(studentId);
    try {
      const res = await api.remindStudent({ studentId, type: 'meet' });
      onRemindSuccess(res.message);
    } catch (err: any) {
      onRemindSuccess(err.message || 'Failed to send reminder');
    } finally {
      setRemindingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
        Loading today's mentees...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 rounded-2xl bg-[#F3F4F6] text-sm text-[#111111]">
        {error || 'Unable to load data.'}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header with Date and Marked Present count */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            Today
          </h2>
          <span className="text-sm font-semibold text-[#111111]">
            {data.date}
          </span>
        </div>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Marked Present: <span className="font-semibold text-[#111111]">{data.presentCount}</span> of {data.totalMentees} Mentees
        </p>
      </div>

      {data.mentees.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          No mentees assigned to you yet. Please contact the administrator.
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {data.mentees.map(({ student, programs, attendance, streak, totalPoints }) => {
            const isEditing = editingMap[student.id];
            const isSaving = savingId === student.id;

            // If card is already marked and not currently in edit mode: Collapsed Summary View
            if (attendance.isMarked && !isEditing) {
              const isPresentSaved = attendance.status === 'present';
              return (
                <div
                  key={student.id}
                  className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-[#111111] truncate">
                        {student.fullName}
                      </h3>
                      {programs.length > 0 && (
                        <p className="text-xs text-[#6B7280] truncate mt-0.5">
                          {programs.map((p) => p.name).join(', ')}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#6B7280]">
                        <span className="flex items-center gap-0.5 text-[#111111] font-semibold">
                          <Flame className="w-3.5 h-3.5 text-[#EF4B47]" />
                          {streak}d streak
                        </span>
                        <span>•</span>
                        <span>{totalPoints} pts</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRemindMentee(student.id)}
                        disabled={remindingId === student.id}
                        className="px-2.5 py-1.5 rounded-xl bg-white text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center gap-1.5 shadow-2xs"
                        title="Send in-app reminder to meet"
                      >
                        <Bell className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span className="hidden sm:inline">
                          {remindingId === student.id ? 'Sending...' : 'Remind'}
                        </span>
                      </button>

                      {/* Pencil Edit Icon to re-open the card for editing */}
                      <button
                        onClick={() => {
                          setLocalStatus((prev) => ({
                            ...prev,
                            [student.id]: attendance.status,
                          }));
                          setLocalLevel((prev) => ({
                            ...prev,
                            [student.id]: attendance.level,
                          }));
                          setLocalNotes((prev) => ({
                            ...prev,
                            [student.id]: attendance.note || '',
                          }));
                          setEditingMap((prev) => ({ ...prev, [student.id]: true }));
                        }}
                        className="p-2 rounded-xl bg-white text-[#111111] hover:bg-gray-100 transition-colors shadow-2xs"
                        title="Edit attendance and score"
                        aria-label="Edit attendance and score"
                      >
                        <Pencil className="w-4 h-4 text-[#EF4B47]" />
                      </button>
                    </div>
                  </div>

                  {/* Summary badges: Status & Score (Notes are hidden by default per specification) */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {isPresentSaved ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#EF4B47] text-white text-xs font-semibold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        Present
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white text-[#6B7280] text-xs font-semibold">
                        <span className="font-bold leading-none">-</span>
                        Absent
                      </span>
                    )}

                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white text-[#111111]">
                      {isPresentSaved
                        ? attendance.level
                          ? `${attendance.points} marks (${attendance.level})`
                          : 'Not scored yet'
                        : '0 marks'}
                    </span>
                  </div>
                </div>
              );
            }

            // Expanded Edit Mode (Unmarked or Currently Editing)
            const curStatus = localStatus[student.id] || 'absent';
            const curLevel = localLevel[student.id] || null;
            const curNote = localNotes[student.id] ?? '';
            const isPresent = curStatus === 'present';

            return (
              <div
                key={student.id}
                className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-4 transition-all"
              >
                {/* Mentee info row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-[#111111] truncate">
                      {student.fullName}
                    </h3>
                    {programs.length > 0 && (
                      <p className="text-xs text-[#6B7280] truncate mt-0.5">
                        {programs.map((p) => p.name).join(', ')}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-[#6B7280]">
                      <span className="flex items-center gap-0.5 text-[#111111] font-semibold">
                        <Flame className="w-3.5 h-3.5 text-[#EF4B47]" />
                        {streak}d streak
                      </span>
                      <span>•</span>
                      <span>{totalPoints} pts</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleRemindMentee(student.id)}
                      disabled={remindingId === student.id}
                      className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center gap-1.5 shadow-2xs"
                      title="Send in-app reminder to meet"
                    >
                      <Bell className="w-3.5 h-3.5 text-[#6B7280]" />
                      <span>{remindingId === student.id ? 'Sending...' : 'Remind'}</span>
                    </button>

                    {attendance.isMarked && (
                      <button
                        onClick={() => handleCancelEdit(student.id)}
                        className="p-1.5 rounded-xl bg-white text-[#6B7280] hover:text-[#111111] shadow-2xs"
                        title="Cancel editing"
                        aria-label="Cancel editing"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Two-Button Toggle: Present / Absent */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectStatus(student.id, 'present')}
                    disabled={isSaving}
                    className={`h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      isPresent
                        ? 'bg-[#EF4B47] text-white shadow-2xs'
                        : 'bg-white text-[#6B7280] hover:text-[#111111]'
                    }`}
                  >
                    {isPresent && <Check className="w-4 h-4 stroke-[3]" />}
                    <span>Present</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectStatus(student.id, 'absent')}
                    disabled={isSaving}
                    className={`h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      !isPresent
                        ? 'bg-[#111111] text-white shadow-2xs'
                        : 'bg-white text-[#6B7280] hover:text-[#111111]'
                    }`}
                  >
                    {!isPresent && <span className="font-bold leading-none">-</span>}
                    <span>Absent</span>
                  </button>
                </div>

                {/* Points Ladder: Appears ONLY after Present is selected */}
                {isPresent && (
                  <div className="pt-1 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280]">
                      <span>Daily Preparation Score</span>
                      <span>
                        {curLevel ? (
                          <span className="text-[#111111] font-bold">
                            {LADDER_POINTS[curLevel]} marks ({curLevel})
                          </span>
                        ) : (
                          <span className="text-[#EF4B47]">Select Score</span>
                        )}
                      </span>
                    </div>

                    {/* 2-column grid on phones with full name and number never truncated */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {LADDER_OPTIONS.map((opt) => {
                        const isSelected = curLevel === opt.level;
                        return (
                          <button
                            key={opt.level}
                            type="button"
                            onClick={() => handleSelectLadder(student.id, opt.level)}
                            disabled={isSaving}
                            className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-center transition-all ${
                              isSelected
                                ? 'bg-[#EF4B47] text-white shadow-2xs'
                                : 'bg-white text-[#111111] hover:bg-gray-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Optional note input */}
                <div>
                  <label className="block text-xs font-semibold text-[#6B7280] mb-1">
                    Daily Preparation Note
                  </label>
                  <input
                    type="text"
                    value={curNote}
                    onChange={(e) =>
                      setLocalNotes((prev) => ({
                        ...prev,
                        [student.id]: e.target.value,
                      }))
                    }
                    placeholder="Enter an optional observation or note..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white text-xs text-[#111111] border border-transparent focus:border-[#EF4B47] focus:outline-none placeholder-[#9CA3AF]"
                  />
                </div>

                {/* Action Buttons: Submit button to finalize and save data */}
                <div className="pt-1 flex items-center justify-end gap-2">
                  {attendance.isMarked && (
                    <button
                      type="button"
                      onClick={() => handleCancelEdit(student.id)}
                      disabled={isSaving}
                      className="px-4 py-2.5 rounded-xl bg-white text-xs font-semibold text-[#6B7280] hover:text-[#111111]"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSubmit(student.id)}
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-[#EF4B47] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50 transition-opacity flex items-center gap-1.5 shadow-2xs"
                  >
                    {isSaving ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
