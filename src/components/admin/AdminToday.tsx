import React, { useState, useEffect, useRef } from 'react';
import { AdminTodayData, LadderLevel, LADDER_POINTS } from '../../types';
import { api } from '../../api';
import { Check, Flame, Edit3, X, Calendar, ChevronLeft, ChevronRight, AlertCircle, Search, RefreshCw } from 'lucide-react';
import { Pentagon } from '../brand/Decorations';

interface AdminTodayProps {
  onSelectStudent: (studentId: string) => void;
  onNotify: (msg: string) => void;
}

const LADDER_OPTIONS: LadderLevel[] = [
  'Poor',
  'Average',
  'Good',
  'Very good',
  'Excellent',
  'Outstanding',
];

export const AdminToday: React.FC<AdminTodayProps> = ({
  onSelectStudent,
  onNotify,
}) => {
  const [data, setData] = useState<AdminTodayData | null>(null);
  const [date, setDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Edit attendance modal state
  const [editingStudent, setEditingStudent] = useState<{
    studentId: string;
    studentName: string;
    status: 'present' | 'absent';
    level: LadderLevel | null;
    note: string | null;
    programId?: string;
    programs?: any[];
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadData(date || undefined);

    // Auto-refresh every 25 seconds for live attendance updates
    const timer = setInterval(() => {
      loadData(date || undefined, true);
    }, 25000);

    return () => clearInterval(timer);
  }, [date]);

  const loadData = async (selectedDate?: string, isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);
    setLoadError(null);
    try {
      const res = await api.getAdminOverview(selectedDate);
      setData(res);
      if (!date) {
        setDate(res.date);
      }
    } catch {
      if (!isSilent) setLoadError("Couldn't load students. Try again.");
    } finally {
      if (!isSilent) setLoading(false);
      setIsRefreshing(false);
    }
  };

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    try {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const dt = new Date(year, month - 1, day);
        return dt.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    } catch {}
    return dStr;
  };

  const handleShiftDate = (days: number) => {
    if (!date) return;
    const parts = date.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const dt = new Date(year, month - 1, day);
      dt.setDate(dt.getDate() + days);
      const yStr = dt.getFullYear();
      const mStr = String(dt.getMonth() + 1).padStart(2, '0');
      const dStr = String(dt.getDate()).padStart(2, '0');
      setDate(`${yStr}-${mStr}-${dStr}`);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !data) return;

    setEditSaving(true);
    try {
      await api.adminEditAttendance({
        studentId: editingStudent.studentId,
        programId: editingStudent.programId,
        date: data.date,
        status: editingStudent.status,
        level: editingStudent.status === 'present' ? editingStudent.level : null,
        note: editingStudent.note,
      });

      setEditingStudent(null);
      onNotify('Attendance updated. Past date changes logged to audit log.');
      loadData(data.date);
    } catch (err: any) {
      onNotify(err.message || "Couldn't update attendance. Try again.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleRemindGuide = async (guideId: string) => {
    try {
      const res = await api.remindGuide(guideId);
      onNotify(res.message);
    } catch (err: any) {
      onNotify(err.message || 'Failed to send reminder');
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-xs text-[#6B7280]">
        Loading today's roster...
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center gap-2 text-center text-xs text-[#111111]">
        <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
        <span>{loadError}</span>
      </div>
    );
  }

  if (!data) return null;

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

  const isSearching = Boolean(searchQuery.trim());

  const roster = data?.studentsRoster || (data as any)?.roster || [];
  const guidesList = data?.guidesProgress || (data as any)?.guidesStatus || [];

  // Filter roster by student name or roll
  const filteredRoster = roster.filter((row: any) => {
    if (!isSearching) return true;
    return (
      matchesSearch(row.studentName, searchQuery) ||
      matchesSearch(row.studentRoll, searchQuery) ||
      (row.sessions || []).some((s: any) => matchesSearch(s.guideName || s.programName || '', searchQuery))
    );
  });

  // Filter guides' progress list by guide name
  const filteredGuidesStatus = guidesList.filter((g: any) => {
    if (!isSearching) return true;
    return matchesSearch(g.guideName, searchQuery);
  });

  const hasAnyResults = filteredRoster.length > 0 || filteredGuidesStatus.length > 0;

  return (
    <div className="space-y-6 pb-20">
      {/* Title Area: "Today" title only (no subtitle), text date display with prev/next arrows and calendar popup */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
          Today
        </h2>

        {/* Text-based date display with prev/next arrows and tap-to-open calendar popup */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleShiftDate(-1)}
            className="p-2 rounded-xl bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 transition-colors cursor-pointer"
            title="Previous day"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (dateInputRef.current) {
                  try {
                    dateInputRef.current.showPicker();
                  } catch {
                    dateInputRef.current.focus();
                  }
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] hover:bg-gray-200 transition-colors select-none cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-[#D4202C]" />
              <span>{formatDisplayDate(date) || 'Select date'}</span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Select date"
              aria-label="Select date"
            />
          </div>

          <button
            type="button"
            onClick={() => handleShiftDate(1)}
            className="p-2 rounded-xl bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 transition-colors cursor-pointer"
            title="Next day"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => loadData(date || undefined)}
            className="p-2 rounded-xl bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 transition-colors cursor-pointer"
            title="Refresh attendance data"
            aria-label="Refresh attendance data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing || loading ? 'animate-spin text-[#D4202C]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stat Cards: Exactly four summary cards labeled 'Present', 'Absent', 'Not scored', 'Guides pending' */}
      {/* Do not change the four number cards; they always count all students, not just the search results. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Present: large number in brand red exclusively, sub-label 'of N students' */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#F3F4F6] text-center flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#6B7280]">Present</div>
          <div className="my-1.5 text-2xl sm:text-3xl font-extrabold text-[#D4202C]">
            {data.stats.presentCount}
          </div>
          <div className="text-[13px] text-[#6B7280]">
            of {data.stats.totalStudents} students
          </div>
        </div>

        {/* Absent */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#F3F4F6] text-center flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#6B7280]">Absent</div>
          <div className="my-1.5 text-2xl sm:text-3xl font-extrabold text-[#111111]">
            {data.stats.absentCount}
          </div>
          <div className="text-xs text-transparent select-none">-</div>
        </div>

        {/* Not scored */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#F3F4F6] text-center flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#6B7280]">Not scored</div>
          <div className="my-1.5 text-2xl sm:text-3xl font-extrabold text-[#111111]">
            {data.stats.unscoredCount}
          </div>
          <div className="text-xs text-transparent select-none">-</div>
        </div>

        {/* Guides pending */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#F3F4F6] text-center flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#6B7280]">Guides pending</div>
          <div className="my-1.5 text-2xl sm:text-3xl font-extrabold text-[#111111]">
            {data.stats.unmarkedGuidesCount}
          </div>
          <div className="text-xs text-transparent select-none">-</div>
        </div>
      </div>

      {/* Search box when more than 8 students */}
      {roster.length > 8 && (
        <div className="space-y-2">
          <div className="relative">
            <label htmlFor="today-search" className="sr-only">
              Search students or guides
            </label>
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
            <input
              id="today-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students or guides"
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

          {/* Result count when searching */}
          {isSearching && (
            <div className="text-xs text-[#6B7280] px-0.5">
              {filteredRoster.length} {filteredRoster.length === 1 ? 'result' : 'results'}
            </div>
          )}
        </div>
      )}

      {/* When searching and nothing matches, show empty state */}
      {isSearching && !hasAnyResults ? (
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
        <>
          {/* Guides' progress */}
          {filteredGuidesStatus.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-3">
              <h3 className="font-bold text-sm sm:text-base text-[#111111]">
                Guides' progress
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {filteredGuidesStatus.map((g: any) => {
                  const hasSessions = (g.sessionsCount ?? 0) > 0;
                  const isAllMarked = hasSessions && Boolean(g.allMarked);

                  return (
                    <div
                      key={g.guideId}
                      className="p-3 rounded-xl bg-white flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-[#111111] truncate">{g.guideName}</div>
                        <div className="text-[#6B7280] text-xs mt-0.5">
                          {hasSessions ? (
                            <span>{g.markedCount} of {g.sessionsCount} marked</span>
                          ) : (
                            <span className="italic text-gray-400">No sessions today</span>
                          )}
                        </div>
                      </div>
                      {hasSessions ? (
                        isAllMarked ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-white text-green-700 border border-green-200 shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>All marked</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemindGuide(g.guideId)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E7EB] text-[#111111] font-semibold hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
                          >
                            Remind
                          </button>
                        )
                      ) : (
                        <span className="text-[#6B7280] text-[11px] px-2 py-0.5 rounded bg-gray-100 shrink-0 font-medium">
                          No programs
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Students */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-[#111111]">
                Students
              </h3>
              <span className="text-[13px] text-[#6B7280]">
                Tap student to inspect
              </span>
            </div>

            {filteredRoster.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#F3F4F6] text-xs text-[#6B7280] text-center">
                No students match "{searchQuery}"
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRoster.map((row: any) => {
                  const isPresent = row.sessions
                    ? row.sessions.some((s: any) => s.status === 'present')
                    : row.status === 'present';

                  const hasMarkedAbsent = row.sessions
                    ? row.sessions.some((s: any) => s.isMarked && s.status === 'absent')
                    : Boolean(row.isMarked && row.status === 'absent');

                  const isPending = !isPresent && !hasMarkedAbsent;

                  const sessionsSummary = row.sessions && row.sessions.length > 0
                    ? row.sessions
                        .map(
                          (s: any) =>
                            `${s.programName}: ${
                              s.status === 'present'
                                ? s.scoreLevel !== null
                                  ? `Present (${s.scoreLevel})`
                                  : 'Present'
                                : s.isMarked
                                ? 'Absent'
                                : 'Not marked yet'
                            }`
                        )
                        .join(' • ')
                    : 'No sessions';

                  return (
                    <div
                      key={row.studentId}
                      className="p-3.5 sm:p-4 rounded-xl bg-[#F3F4F6] flex items-center justify-between gap-2.5 hover:bg-gray-200/60 transition-colors"
                    >
                      {/* Clean student name & program status */}
                      <div
                        onClick={() => onSelectStudent(row.studentId)}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="font-bold text-xs sm:text-sm text-[#111111] truncate">
                          {row.studentName}
                        </div>
                        <div className="text-xs text-[#6B7280] truncate mt-0.5">
                          {sessionsSummary}
                        </div>
                      </div>

                      {/* Status, numeric score, streak & edit action */}
                      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                        {/* Status badge */}
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#D4202C] text-white text-xs font-semibold shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            Present
                          </span>
                        ) : hasMarkedAbsent ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-[#6B7280] border border-[#E5E7EB] text-xs font-semibold shrink-0">
                            <span className="font-bold leading-none">-</span>
                            Absent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-amber-700 border border-amber-200/80 text-xs font-semibold shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            Pending
                          </span>
                        )}

                        {/* Numeric score or points */}
                        <div className="text-xs font-semibold min-w-12 text-right shrink-0">
                          {row.totalPoints !== undefined ? (
                            <span className="text-[#111111]">
                              {Number(row.totalPoints).toFixed(1)} pts
                            </span>
                          ) : isPresent && row.points !== null ? (
                            <span className="text-[#111111]">{row.points} pts</span>
                          ) : (
                            <span className="text-[#6B7280]">{isPresent ? 'Pending' : '0 pts'}</span>
                          )}
                        </div>

                        {/* Streak */}
                        <div className="hidden sm:flex items-center gap-1 text-xs text-[#111111] font-semibold bg-white px-2 py-1 rounded-lg shrink-0">
                          <Flame className="w-3.5 h-3.5 text-[#D4202C]" />
                          <span>{row.streak || 0}d</span>
                        </div>

                        {/* Edit button */}
                        <button
                          type="button"
                          onClick={() =>
                            setEditingStudent({
                              studentId: row.studentId,
                              studentName: row.studentName,
                              status: isPresent ? 'present' : (hasMarkedAbsent ? 'absent' : 'present'),
                              level: row.sessions?.[0]?.level || row.level || null,
                              note: row.sessions?.[0]?.note || row.note || '',
                              programId: row.sessions?.[0]?.programId || '',
                              programs: row.sessions || [],
                            })
                          }
                          className="p-1.5 sm:p-2 rounded-xl bg-white text-[#111111] hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
                          title="Edit today's attendance"
                          aria-label="Edit today's attendance"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#D4202C]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Admin edit attendance modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-[#111111]">
                  Edit attendance ({date})
                </h3>
                <p className="text-xs text-[#6B7280]">
                  {editingStudent.studentName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingStudent({ ...editingStudent, status: 'present' })
                    }
                    className={`py-2 rounded-xl text-xs font-semibold ${
                      editingStudent.status === 'present'
                        ? 'bg-[#D4202C] text-white'
                        : 'bg-[#F3F4F6] text-[#111111]'
                    }`}
                  >
                    Present
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingStudent({
                        ...editingStudent,
                        status: 'absent',
                        level: null,
                      })
                    }
                    className={`py-2 rounded-xl text-xs font-semibold ${
                      editingStudent.status === 'absent'
                        ? 'bg-[#111111] text-white'
                        : 'bg-[#F3F4F6] text-[#111111]'
                    }`}
                  >
                    Absent
                  </button>
                </div>
              </div>

              {editingStudent.status === 'present' && (
                <div>
                  <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                    Points ladder level
                  </label>
                  <select
                    value={editingStudent.level || ''}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        level: (e.target.value as LadderLevel) || null,
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] border-0"
                  >
                    <option value="">Unscored (pending)</option>
                    {LADDER_OPTIONS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {LADDER_POINTS[lvl]} marks - {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                  Optional note
                </label>
                <input
                  type="text"
                  value={editingStudent.note || ''}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, note: e.target.value })
                  }
                  placeholder="Reason for change..."
                  className="w-full px-3 py-2 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] border-0"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-[#F3F4F6] text-xs text-[#6B7280]">
                Note: Modifications to past dates are permanently recorded in the audit log.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-xs font-semibold disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
