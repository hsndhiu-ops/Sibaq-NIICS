import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { supabase } from '../../lib/supabase';
import { AttendanceRecord, Program, RemarkRecord, ScreenshotRecord, TaskRecord, User } from '../../types';
import {
  X,
  Check,
  Flame,
  Download,
  CheckCircle2,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  Loader2,
  ZoomIn,
  ZoomOut,
  Search,
  UserMinus,
} from 'lucide-react';

interface AdminStudentDrillDownProps {
  studentId: string;
  onClose: () => void;
}

export const AdminStudentDrillDown: React.FC<AdminStudentDrillDownProps> = ({
  studentId,
  onClose,
}) => {
  const [data, setData] = useState<{
    student: User;
    guide: { id: string; fullName: string; username: string } | null;
    programs: Program[];
    streak: number;
    totalPoints: number;
    attendanceHistory: AttendanceRecord[];
    tasks: TaskRecord[];
    remarks: RemarkRecord[];
    screenshots: ScreenshotRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Attendance history toggle: 7 days vs full history
  const [showFullAttendance, setShowFullAttendance] = useState(false);

  // Screenshot viewer modal
  const [viewingScreenshotId, setViewingScreenshotId] = useState<string | null>(null);
  const [resolvedScreenshotUrl, setResolvedScreenshotUrl] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(true);
  const [screenshotError, setScreenshotError] = useState(false);
  const [isScreenshotZoomed, setIsScreenshotZoomed] = useState(false);

  useEffect(() => {
    if (!viewingScreenshotId) {
      setResolvedScreenshotUrl(null);
      setScreenshotLoading(false);
      setScreenshotError(false);
      setIsScreenshotZoomed(false);
      return;
    }

    setScreenshotLoading(true);
    setScreenshotError(false);
    setIsScreenshotZoomed(false);

    if (
      viewingScreenshotId.startsWith('http://') ||
      viewingScreenshotId.startsWith('https://') ||
      viewingScreenshotId.startsWith('data:') ||
      viewingScreenshotId.startsWith('blob:')
    ) {
      setResolvedScreenshotUrl(viewingScreenshotId);
      return;
    }

    let cancelled = false;
    api
      .resolveScreenshotUrl(viewingScreenshotId)
      .then((url) => {
        if (!cancelled) setResolvedScreenshotUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedScreenshotUrl(`/api/files/download/${encodeURIComponent(viewingScreenshotId)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [viewingScreenshotId]);

  // Admin task review action state
  const [reviewTask, setReviewTask] = useState<TaskRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<'complete' | 'send_back'>('complete');
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Guide reassignment state
  const [availableGuides, setAvailableGuides] = useState<
    Array<{ id: string; fullName: string; username: string; studentCount: number }>
  >([]);
  const [isChangingGuide, setIsChangingGuide] = useState(false);
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [guideSearchQuery, setGuideSearchQuery] = useState('');
  const [isGuideSubmitting, setIsGuideSubmitting] = useState(false);
  const [guideModalError, setGuideModalError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [actionNotification, setActionNotification] = useState<string | null>(null);

  useEffect(() => {
    loadStudentDetail();
  }, [studentId]);

  const loadAvailableGuides = async () => {
    try {
      const { data: allProfiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, role, guide_id')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('[profiles] error loading guides:', error.message || error);
        return;
      }

      const guideList = (allProfiles || []).filter((p) => p.role === 'guide');
      const students = (allProfiles || []).filter((p) => p.role === 'student');
      const counts = new Map<string, number>();
      students.forEach((s) => {
        if (s.guide_id) {
          counts.set(s.guide_id, (counts.get(s.guide_id) || 0) + 1);
        }
      });

      setAvailableGuides(
        guideList.map((g) => ({
          id: g.id,
          fullName: g.full_name || g.username,
          username: g.username,
          studentCount: counts.get(g.id) || 0,
        }))
      );
    } catch (err: any) {
      console.error('[profiles] error:', err.message || err);
    }
  };

  const loadStudentDetail = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminStudentDetail(studentId);
      setData(res);
      await loadAvailableGuides();
    } catch (_err) {
      // Graceful error handling
    } finally {
      setLoading(false);
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

  const handleExecuteChangeGuide = async () => {
    if (!data || !selectedGuideId) return;
    setIsGuideSubmitting(true);
    setGuideModalError(null);

    const targetGuide = availableGuides.find((g) => g.id === selectedGuideId);
    const targetName = targetGuide ? targetGuide.fullName : 'guide';

    const { error } = await supabase.rpc('set_student_guide', {
      p_student: data.student.id,
      p_guide: selectedGuideId,
    });

    if (error) {
      console.error('[set_student_guide] error:', error.message || error);
      setGuideModalError(error.message || "Couldn't assign guide. Try again.");
      setIsGuideSubmitting(false);
      return;
    }

    setIsGuideSubmitting(false);
    setIsChangingGuide(false);
    setSelectedGuideId(null);
    setGuideSearchQuery('');
    setActionNotification(`Moved ${data.student.fullName} to ${targetName}.`);
    await loadStudentDetail();
  };

  const handleExecuteRemoveGuide = async () => {
    if (!data || !data.guide) return;
    setIsGuideSubmitting(true);
    setGuideModalError(null);

    const oldGuideName = data.guide.fullName;

    const { error } = await supabase.rpc('set_student_guide', {
      p_student: data.student.id,
      p_guide: null,
    });

    if (error) {
      console.error('[set_student_guide] error:', error.message || error);
      setGuideModalError(error.message || "Couldn't remove student. Try again.");
      setIsGuideSubmitting(false);
      return;
    }

    setIsGuideSubmitting(false);
    setIsChangingGuide(false);
    setShowRemoveConfirm(false);
    setActionNotification(`Removed ${data.student.fullName} from ${oldGuideName}.`);
    await loadStudentDetail();
  };

  const handleAdminReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTask) return;

    if (reviewAction === 'send_back' && !reviewNote.trim()) {
      setReviewError('A reason note explaining why the task is sent back is required.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      if (reviewAction === 'complete') {
        await api.completeAdminTask(reviewTask.id, reviewNote.trim() || null);
      } else {
        await api.sendBackAdminTask(reviewTask.id, reviewNote.trim());
      }
      setReviewTask(null);
      setReviewNote('');
      loadStudentDetail();
    } catch (err: any) {
      setReviewError(err.message || 'Failed to update task.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl p-6 text-sm text-[#6B7280]">
          Loading student record...
        </div>
      </div>
    );
  }

  const {
    student,
    guide,
    programs,
    streak,
    totalPoints,
    attendanceHistory,
    tasks,
    remarks,
    screenshots,
  } = data;

  const assignedTasks = tasks.filter((t) => t.status === 'assigned');
  const awaitingReviewTasks = tasks.filter((t) => t.status === 'awaiting_review');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // Show only 7 most recent days by default
  const displayedAttendance = showFullAttendance
    ? attendanceHistory
    : attendanceHistory.slice(0, 7);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-[#F3F4F6] flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="text-base sm:text-lg font-bold text-[#111111] truncate">
              {student.fullName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[#6B7280] mt-1">
              <span>
                Roll: <strong className="text-[#111111] font-semibold">{student.username}</strong>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5">
                Guide:{' '}
                {guide ? (
                  <>
                    <strong className="text-[#111111] font-semibold">{guide.fullName}</strong>
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingGuide(true);
                        setSelectedGuideId(null);
                        setGuideSearchQuery('');
                        setGuideModalError(null);
                        setShowRemoveConfirm(false);
                      }}
                      className="px-2 py-0.5 rounded-md bg-[#F3F4F6] hover:bg-gray-200 text-xs font-semibold text-[#111111] transition-colors cursor-pointer"
                    >
                      Change
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[#D4202C] font-semibold">No guide</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingGuide(true);
                        setSelectedGuideId(null);
                        setGuideSearchQuery('');
                        setGuideModalError(null);
                        setShowRemoveConfirm(false);
                      }}
                      className="px-2 py-0.5 rounded-md bg-[#D4202C] hover:bg-[#B81B26] text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      Assign guide
                    </button>
                  </>
                )}
              </span>
              {student.email && (
                <>
                  <span>•</span>
                  <span>{student.email}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Notification Banner */}
        {actionNotification && (
          <div className="mx-3.5 sm:mx-5 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between">
            <span>{actionNotification}</span>
            <button
              type="button"
              onClick={() => setActionNotification(null)}
              className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F3F4F6] text-center flex flex-col justify-center">
              <div className="text-xs font-semibold text-[#6B7280]">Streak</div>
              <div className="text-lg sm:text-xl font-extrabold text-[#D4202C] flex items-center justify-center gap-1 my-0.5 sm:my-1">
                <Flame className="w-4 h-4 shrink-0" />
                <span>{streak}d</span>
              </div>
              <div className="text-xs text-[#6B7280]">consecutive</div>
            </div>

            <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F3F4F6] text-center flex flex-col justify-center">
              <div className="text-xs font-semibold text-[#6B7280]">Total Points</div>
              <div className="text-lg sm:text-xl font-extrabold text-[#111111] my-0.5 sm:my-1">
                {totalPoints} pts
              </div>
              <div className="text-xs text-[#6B7280]">earned marks</div>
            </div>

            <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F3F4F6] text-center flex flex-col justify-center">
              <div className="text-xs font-semibold text-[#6B7280]">Programs</div>
              <div className="text-lg sm:text-xl font-extrabold text-[#111111] my-0.5 sm:my-1">
                {programs.length}
              </div>
              <div className="text-xs text-[#6B7280]">assigned items</div>
            </div>
          </div>

          {/* Enrolled Programs */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs sm:text-sm text-[#111111]">
              Assigned Programs ({programs.length})
            </h3>
            {programs.length === 0 ? (
              <p className="text-xs text-[#6B7280]">No competition items assigned yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {programs.map((p) => (
                  <span
                    key={p.id}
                    className="px-2.5 py-1 rounded-lg bg-[#F3F4F6] text-xs font-medium text-[#111111] max-w-full truncate"
                  >
                    {p.name} <span className="text-[#6B7280]">({p.category} • {p.type})</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Attendance Section (7 Days + Full Details Option) */}
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-[#111111]">
                  Attendance Records
                </h3>
                <p className="text-[13px] text-[#6B7280]">
                  {showFullAttendance
                    ? `Showing all ${attendanceHistory.length} days of history`
                    : `Showing recent 7 days (${attendanceHistory.length} total logged)`}
                </p>
              </div>

              {attendanceHistory.length > 7 && (
                <button
                  onClick={() => setShowFullAttendance(!showFullAttendance)}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] hover:bg-gray-200 flex items-center gap-1 transition-colors"
                >
                  <span>{showFullAttendance ? 'Show recent 7 days' : 'View full history'}</span>
                  {showFullAttendance ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#6B7280]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
                  )}
                </button>
              )}
            </div>

            {attendanceHistory.length === 0 ? (
              <div className="p-4 rounded-xl sm:rounded-2xl bg-[#F3F4F6] text-xs text-[#6B7280] text-center">
                No attendance records found.
              </div>
            ) : (
              <div className="space-y-2">
                {displayedAttendance.map((a) => {
                  const isPresent = a.status === 'present';
                  return (
                    <div
                      key={a.id || a.date}
                      className="p-3 rounded-xl sm:rounded-2xl bg-[#F3F4F6] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#111111]">{a.date}</span>
                          {isPresent ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D4202C] text-white text-xs font-semibold">
                              <Check className="w-3 h-3 stroke-[3]" />
                              Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[#6B7280] text-xs font-semibold">
                              <span>-</span>
                              Absent
                            </span>
                          )}
                        </div>

                        {a.note && (
                          <p className="text-xs text-[#6B7280] italic break-words">
                            Note: {a.note}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-semibold text-xs text-[#111111]">
                          {isPresent
                            ? a.points !== null
                              ? `${a.points} marks (${a.level || 'Scored'})`
                              : 'Not scored yet'
                            : '0 marks'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tasks Section: All three statuses, with admin actions to complete or send back */}
          <div className="space-y-2.5 sm:space-y-3">
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-[#111111]">
                Tasks ({tasks.length})
              </h3>
              <p className="text-[13px] text-[#6B7280]">
                {tasks.filter((t) => t.status === 'completed').length} completed • {tasks.filter((t) => t.status === 'awaiting_review').length} awaiting review • {tasks.filter((t) => t.status === 'assigned' || (t.status as any) === 'pending').length} assigned
              </p>
            </div>

            {tasks.length === 0 ? (
              <div className="p-4 rounded-xl sm:rounded-2xl bg-[#F3F4F6] text-xs text-[#6B7280] text-center">
                No preparation tasks have been assigned to this student.
              </div>
            ) : (
              <div className="space-y-2.5 sm:space-y-3">
                {tasks.map((task) => {
                  const isDone = task.status === 'completed';
                  const isAwaitingReview = task.status === 'awaiting_review';
                  const isAssigned = task.status === 'assigned' || (task.status as any) === 'pending';

                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl space-y-2.5 sm:space-y-3 text-xs transition-all ${
                        isAwaitingReview
                          ? 'bg-white border border-[#E5E7EB] shadow-2xs'
                          : 'bg-[#F3F4F6]'
                      }`}
                    >
                      {/* Task header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-[#111111] break-words">
                            {task.title}
                          </h4>
                          <span className="text-xs text-[#6B7280] block mt-0.5">
                            Due: <strong className="text-[#111111]">{task.dueDate}</strong>
                            {task.submittedAt && (
                              <span> • Submitted {new Date(task.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(task.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                            {task.completedAt && (
                              <span> • Completed {new Date(task.completedAt).toLocaleDateString()}</span>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 self-start shrink-0">
                          {isDone && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold bg-[#111111] text-white">
                              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              Completed
                            </span>
                          )}
                          {isAwaitingReview && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold bg-white text-[#111111] border border-[#E5E7EB]">
                              <Clock className="w-3.5 h-3.5 text-[#111111]" />
                              Awaiting review
                            </span>
                          )}
                          {isAssigned && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold bg-white text-[#6B7280] border border-[#E5E7EB]">
                              Assigned
                            </span>
                          )}

                          {/* Admin actions: complete or send back */}
                          {!isDone && (
                            <div className="flex items-center gap-1 ml-1">
                              {isAwaitingReview && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewTask(task);
                                    setReviewAction('send_back');
                                    setReviewNote('');
                                    setReviewError(null);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3 text-[#6B7280]" />
                                  <span>Send back</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewTask(task);
                                  setReviewAction('complete');
                                  setReviewNote('');
                                  setReviewError(null);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#111111] text-xs font-semibold text-white hover:bg-black flex items-center gap-1 shadow-2xs"
                              >
                                <Check className="w-3 h-3 text-white" />
                                <span>Complete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Task description */}
                      {task.description && (
                        <p className="text-xs text-[#111111] leading-relaxed break-words">
                          {task.description}
                        </p>
                      )}

                      {/* Guide attachment if provided */}
                      {task.attachmentFileId && (
                        <div className="pt-0.5">
                          <a
                            href={
                              task.attachmentFileId.startsWith('http')
                                ? task.attachmentFileId
                                : `/api/files/download/${task.attachmentFileId}`
                            }
                            download
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-xs font-medium text-[#111111] hover:bg-gray-100 transition-colors max-w-full truncate"
                          >
                            <Download className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                            <span className="truncate">Guide file: {task.attachmentFileName || 'Download'}</span>
                          </a>
                        </div>
                      )}

                      {/* Mentee submission details */}
                      {(task.submissionNote || task.submissionFileId) && (
                        <div className="p-3 rounded-xl bg-white space-y-2 border border-gray-100">
                          <span className="text-xs font-bold text-[#6B7280] block">
                            Student submission
                          </span>

                          {task.submissionNote && (
                            <p className="text-xs text-[#111111] italic leading-relaxed break-words">
                              "{task.submissionNote}"
                            </p>
                          )}

                          {task.submissionFileId && (
                            <a
                              href={
                                task.submissionFileId.startsWith('http')
                                ? task.submissionFileId
                                : `/api/files/download/${task.submissionFileId}`
                              }
                              download
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3F4F6] text-xs font-semibold text-[#111111] hover:bg-gray-200 transition-colors max-w-full truncate"
                            >
                              <Download className="w-3.5 h-3.5 shrink-0 text-[#D4202C]" />
                              <span className="truncate">Submission file: {task.submissionFileName || 'Download'}</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Reviewer note if present */}
                      {task.reviewerNote && (
                        <div className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#111111]">
                          <span className="font-semibold block text-xs">Feedback / review note:</span>
                          <p className="mt-0.5">{task.reviewerNote}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Screenshot Section: Nightly screen time reviews */}
          <div className="space-y-2.5 sm:space-y-3">
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-[#111111]">
                Nightly Screen-Time Verification ({screenshots.length})
              </h3>
              <p className="text-[13px] text-[#6B7280]">
                Daily Mobile Usage Submissions
              </p>
            </div>

            {screenshots.length === 0 ? (
              <div className="p-4 rounded-xl sm:rounded-2xl bg-[#F3F4F6] text-xs text-[#6B7280] text-center">
                No screen-time screenshots submitted yet by this student.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                {screenshots.map((s) => {
                  const isPurged = s.status === 'purged' || !s.fileId;
                  return (
                    <div
                      key={s.id}
                      className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F3F4F6] space-y-2 flex flex-col justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[#111111]">{s.date}</span>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              isPurged
                                ? 'bg-white text-[#6B7280]'
                                : 'bg-[#111111] text-white'
                            }`}
                          >
                            {isPurged ? 'File purged' : 'Active image'}
                          </span>
                        </div>

                        <span className="text-xs text-[#6B7280] block mt-1">
                          Submitted: {new Date(s.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {!isPurged && s.fileId ? (
                        <button
                          onClick={() => setViewingScreenshotId(s.fileId)}
                          className="w-full py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#D4202C]" />
                          <span>Review screenshot</span>
                        </button>
                      ) : (
                        <div className="p-1.5 rounded-lg bg-white text-xs text-[#6B7280] text-center italic">
                          File deleted per 48-hour privacy rule
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Guide Remarks Section */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs sm:text-sm text-[#111111]">
              Guide Remarks ({remarks.length})
            </h3>
            {remarks.length === 0 ? (
              <p className="text-xs text-[#6B7280]">No remarks logged.</p>
            ) : (
              <div className="space-y-1.5">
                {remarks.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl sm:rounded-2xl bg-[#F3F4F6] text-xs space-y-0.5">
                    <div className="flex items-center justify-between text-[#6B7280]">
                      <span className="font-semibold text-[#111111]">{r.guideName}</span>
                      <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[#111111] font-medium leading-relaxed break-words">{r.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-3.5 border-t border-[#F3F4F6] bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Screenshot Review Modal */}
      {viewingScreenshotId && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-3 sm:p-4"
          onClick={() => setViewingScreenshotId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-[#F3F4F6] flex items-center justify-between gap-2 bg-white">
              <span className="text-xs font-semibold text-[#111111] truncate pr-2">
                {student.fullName} • Screen Time Screenshot
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {resolvedScreenshotUrl && !screenshotError && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsScreenshotZoomed(!isScreenshotZoomed)}
                      className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors"
                      title={isScreenshotZoomed ? 'Fit to screen' : 'Zoom in to inspect'}
                    >
                      {isScreenshotZoomed ? (
                        <ZoomOut className="w-4 h-4" />
                      ) : (
                        <ZoomIn className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={resolvedScreenshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors"
                      title="Open full image in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </>
                )}
                <button
                  onClick={() => setViewingScreenshotId(null)}
                  className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3 sm:p-4 flex-1 overflow-auto flex items-center justify-center bg-[#F9FAFB] min-h-[260px] relative">
              {screenshotLoading && !screenshotError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#F9FAFB]/80 z-10">
                  <Loader2 className="w-6 h-6 animate-spin text-[#D4202C]" />
                  <span className="text-xs text-[#6B7280] font-medium">
                    Loading screenshot image...
                  </span>
                </div>
              )}

              {screenshotError ? (
                <div className="p-6 max-w-sm text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-[#F3F4F6] text-[#D4202C] flex items-center justify-center mx-auto">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#111111]">
                      Unable to display screenshot
                    </h4>
                    <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                      Image could not be retrieved from storage. It may have been
                      purged after the 48-hour privacy window.
                    </p>
                  </div>
                  {resolvedScreenshotUrl && (
                    <a
                      href={resolvedScreenshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-3.5 py-1.5 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-xs font-semibold text-white"
                    >
                      Open direct link
                    </a>
                  )}
                </div>
              ) : resolvedScreenshotUrl ? (
                <img
                  src={resolvedScreenshotUrl}
                  alt="Student screen time verification"
                  onLoad={() => setScreenshotLoading(false)}
                  onError={() => {
                    setScreenshotLoading(false);
                    setScreenshotError(true);
                  }}
                  onClick={() => setIsScreenshotZoomed(!isScreenshotZoomed)}
                  className={`rounded-xl object-contain shadow-sm transition-all select-none ${
                    isScreenshotZoomed
                      ? 'max-h-none max-w-none w-auto cursor-zoom-out'
                      : 'max-h-[70vh] w-auto max-w-full cursor-zoom-in'
                  }`}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
      {/* Admin Task Review Modal (Complete or Send Back) */}
      {reviewTask && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-[#111111]">
                  {reviewAction === 'complete' ? 'Mark task completed' : 'Send back task'}
                </h3>
                <p className="text-xs text-[#6B7280] truncate max-w-xs mt-0.5">
                  {reviewTask.title} • {student.fullName}
                </p>
              </div>
              <button
                onClick={() => setReviewTask(null)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdminReviewSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
              {reviewAction === 'complete' ? (
                <div className="p-3 rounded-xl bg-[#F3F4F6] border border-[#E5E7EB] text-xs text-[#111111] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#D4202C]" />
                    <span>Complete verification</span>
                  </div>
                  <p className="text-[#6B7280]">
                    Review the work or meet the student before completing. The student will be notified of completion.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#F3F4F6] border border-[#E5E7EB] text-xs text-[#111111] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-[#D4202C]" />
                    <span>Return for revision</span>
                  </div>
                  <p className="text-[#6B7280]">
                    Review the work or meet the student before completing. Returning will switch status back to Assigned with your required note.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  {reviewAction === 'send_back' ? 'Reason / revision note (required)' : 'Review note (optional)'}
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={
                    reviewAction === 'send_back'
                      ? 'Explain what needs correction or re-submission...'
                      : 'Add administrative or guide remarks...'
                  }
                  rows={3}
                  required={reviewAction === 'send_back'}
                  className="w-full p-3 rounded-xl bg-[#F9FAFB] text-xs sm:text-sm text-[#111111] border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D4202C]"
                />
              </div>

              {reviewError && (
                <div className="flex items-center gap-1.5 text-xs text-[#111111] font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-[#D4202C] shrink-0" />
                  <span>{reviewError}</span>
                </div>
              )}

              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReviewTask(null)}
                  className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="px-4 py-2 rounded-[10px] text-xs font-semibold text-white bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] disabled:opacity-50 transition-colors"
                >
                  {isSubmittingReview
                    ? 'Saving...'
                    : reviewAction === 'complete'
                    ? 'Confirm complete'
                    : 'Send back'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guide Picker Modal */}
      {isChangingGuide && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  {guide ? 'Change guide' : 'Assign guide'}
                </h3>
                <p className="text-xs text-[#6B7280]">
                  {student.fullName} ({student.username})
                  {guide && ` • Current: ${guide.fullName}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsChangingGuide(false)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {guideModalError && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-red-50 text-xs font-semibold text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{guideModalError}</span>
              </div>
            )}

            {/* If currently assigned, allow Remove from this guide option */}
            {guide && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-between gap-3">
                <div className="text-xs text-[#6B7280]">
                  Currently with <strong className="text-[#111111]">{guide.fullName}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#D4202C] hover:bg-red-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>Remove from guide</span>
                </button>
              </div>
            )}

            {/* Search box */}
            <div className="p-4 pb-2">
              <div className="relative">
                <label htmlFor="drilldown-guide-search" className="sr-only">
                  Search guides
                </label>
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
                <input
                  id="drilldown-guide-search"
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
              {availableGuides
                .filter((g) => {
                  if (guide && g.id === guide.id) return false;
                  if (!guideSearchQuery.trim()) return true;
                  return (
                    matchesSearch(g.fullName, guideSearchQuery) ||
                    matchesSearch(g.username, guideSearchQuery)
                  );
                })
                .map((g) => {
                  const isSelected = selectedGuideId === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGuideId(g.id)}
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
                          {g.studentCount} {g.studentCount === 1 ? 'student' : 'students'}
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
                onClick={() => setIsChangingGuide(false)}
                className="px-4 py-2 rounded-[10px] text-xs font-semibold text-[#6B7280] hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteChangeGuide}
                disabled={!selectedGuideId || isGuideSubmitting}
                className="h-[44px] px-5 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {isGuideSubmitting ? 'Saving...' : guide ? 'Move' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove from guide confirmation dialog */}
      {showRemoveConfirm && guide && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <h3 className="font-bold text-base text-[#111111]">
              Remove from guide
            </h3>
            <p className="text-xs sm:text-sm text-[#111111] leading-relaxed">
              Remove {student.fullName} from {guide.fullName}'s list? {guide.fullName} will no longer see this student. Open tasks stay with {guide.fullName}.
            </p>

            {guideModalError && (
              <div className="p-3 rounded-xl bg-red-50 text-xs font-semibold text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{guideModalError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(false)}
                className="px-4 py-2 rounded-[10px] text-xs font-semibold text-[#6B7280] hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRemoveGuide}
                disabled={isGuideSubmitting}
                className="px-4 py-2 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isGuideSubmitting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
