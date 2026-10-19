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
  Trash2,
} from 'lucide-react';

interface AdminStudentDrillDownProps {
  studentId: string;
  onClose: () => void;
  onNotify?: (msg: string) => void;
}

export const AdminStudentDrillDown: React.FC<AdminStudentDrillDownProps> = ({
  studentId,
  onClose,
  onNotify,
}) => {
  const [data, setData] = useState<{
    student: User;
    guide: { id: string; fullName: string; username: string } | null;
    allGuides?: Array<{ id: string; fullName: string; username: string; email?: string; programs: string[] }>;
    programGuides?: Array<{ id: string; programId: string; programName: string; guideId: string; guideName: string; guideUsername: string; guideEmail?: string; assignedAt: string }>;
    programs: any[];
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
        if (!cancelled) setResolvedScreenshotUrl(url || `/api/screenshot-image?path=${encodeURIComponent(viewingScreenshotId)}`);
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedScreenshotUrl(`/api/screenshot-image?path=${encodeURIComponent(viewingScreenshotId)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [viewingScreenshotId]);

  const [deletingScreenshotId, setDeletingScreenshotId] = useState<string | null>(null);
  const [confirmingScreenshotDeleteId, setConfirmingScreenshotDeleteId] = useState<string | null>(null);

  const handleDeleteScreenshot = async (screenshotId: string, storagePath?: string | null, force = false) => {
    if (!force && confirmingScreenshotDeleteId !== screenshotId) {
      setConfirmingScreenshotDeleteId(screenshotId);
      setTimeout(() => {
        setConfirmingScreenshotDeleteId((prev) => (prev === screenshotId ? null : prev));
      }, 4000);
      return;
    }

    setConfirmingScreenshotDeleteId(null);
    setDeletingScreenshotId(screenshotId);
    try {
      await api.deleteScreenshot(screenshotId, storagePath);
      setData((prev) =>
        prev
          ? {
              ...prev,
              screenshots: prev.screenshots.filter((s) => s.id !== screenshotId),
            }
          : prev
      );
      if (viewingScreenshotId === storagePath || viewingScreenshotId === screenshotId) {
        setViewingScreenshotId(null);
      }
      onNotify?.('Screenshot deleted successfully. Student may now resubmit.');
    } catch (err: any) {
      onNotify?.(err?.message || "Couldn't delete screenshot.");
    } finally {
      setDeletingScreenshotId(null);
    }
  };

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
  const [selectedGuideIds, setSelectedGuideIds] = useState<string[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('general');
  const [assignMode, setAssignMode] = useState<'add' | 'replace'>('add');
  const [guideSearchQuery, setGuideSearchQuery] = useState('');
  const [isGuideSubmitting, setIsGuideSubmitting] = useState(false);
  const [guideModalError, setGuideModalError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removeTargetGuideId, setRemoveTargetGuideId] = useState<string | null>(null);
  const [actionNotification, setActionNotification] = useState<string | null>(null);

  // Delete student confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteStudent = async () => {
    if (!data?.student) return;
    setIsDeletingStudent(true);
    setDeleteError(null);

    const studentName = data.student.fullName;
    try {
      await api.deleteAccount(data.student.id);
      setIsDeletingStudent(false);
      setShowDeleteConfirm(false);
      onNotify?.(`${studentName} has been deleted!`);
      onClose();
    } catch (err: any) {
      console.error('[deleteAccount] error:', err.message || err);
      setDeleteError(err.message || "Couldn't delete student. Try again.");
      setIsDeletingStudent(false);
    }
  };

  useEffect(() => {
    loadStudentDetail();
  }, [studentId]);

  const loadAvailableGuides = async () => {
    try {
      const { data: allProfiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, role')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('[profiles] error loading guides:', error.message || error);
        return;
      }

      const guideList = (allProfiles || []).filter((p) => p.role === 'guide');

      setAvailableGuides(
        guideList.map((g) => ({
          id: g.id,
          fullName: g.full_name || g.username,
          username: g.username,
          studentCount: 0,
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
    if (!data || selectedGuideIds.length === 0) return;
    setIsGuideSubmitting(true);
    setGuideModalError(null);

    try {
      const res = await api.assignStudentGuides(
        data.student.id,
        selectedGuideIds,
        selectedProgramId,
        assignMode
      );
      setIsGuideSubmitting(false);
      setIsChangingGuide(false);
      setActionNotification(res.message || `Updated guide assignments for ${data.student.fullName}.`);
      await loadStudentDetail();
      onNotify?.(res.message || `Updated guide assignments for ${data.student.fullName}.`);
    } catch (err: any) {
      console.error('[assignStudentGuides] error:', err);
      setGuideModalError(err.message || "Couldn't assign guides. Try again.");
      setIsGuideSubmitting(false);
    }
  };

  const handleExecuteRemoveGuide = async (guideIdToRemove?: string) => {
    if (!data) return;
    const gId = guideIdToRemove || removeTargetGuideId || (data.guide ? data.guide.id : null);
    if (!gId) return;
    setIsGuideSubmitting(true);
    setGuideModalError(null);

    try {
      const res = await api.removeStudentGuide(data.student.id, gId, selectedProgramId || 'general');
      setIsGuideSubmitting(false);
      setShowRemoveConfirm(false);
      setRemoveTargetGuideId(null);
      setSelectedGuideIds((prev) => prev.filter((id) => id !== gId));
      setActionNotification(res.message || 'Removed guide assignment.');
      await loadStudentDetail();
      onNotify?.(res.message || 'Removed guide assignment.');
    } catch (err: any) {
      console.error('[removeStudentGuide] error:', err);
      setGuideModalError(err.message || "Couldn't remove guide. Try again.");
      setIsGuideSubmitting(false);
    }
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
  const awaitingReviewTasks = tasks.filter((t) => t.status === 'submitted');
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
              {(() => {
                const currentGuides = data.allGuides && data.allGuides.length > 0
                  ? data.allGuides
                  : (guide ? [{ id: guide.id, fullName: guide.fullName, username: guide.username, programs: ['General'] }] : []);

                return (
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <span>Guides:</span>
                    {currentGuides.length > 0 ? (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {currentGuides.map((cg) => (
                            <span
                              key={cg.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F3F4F6] text-xs font-semibold text-[#111111]"
                            >
                              <span>{cg.fullName}</span>
                              {cg.programs && cg.programs.length > 0 && (
                                <span className="text-[10px] text-[#6B7280] font-normal">
                                  ({cg.programs.join(', ')})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsChangingGuide(true);
                            setSelectedGuideIds(currentGuides.map((cg) => cg.id));
                            setSelectedProgramId('general');
                            setAssignMode('add');
                            setGuideSearchQuery('');
                            setGuideModalError(null);
                            setShowRemoveConfirm(false);
                          }}
                          className="px-2 py-0.5 rounded-md bg-[#F3F4F6] hover:bg-gray-200 text-xs font-semibold text-[#111111] transition-colors cursor-pointer"
                        >
                          Manage
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-[#D4202C] font-semibold">No guide</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsChangingGuide(true);
                            setSelectedGuideIds([]);
                            setSelectedProgramId('general');
                            setAssignMode('add');
                            setGuideSearchQuery('');
                            setGuideModalError(null);
                            setShowRemoveConfirm(false);
                          }}
                          className="px-2 py-0.5 rounded-md bg-[#D4202C] hover:bg-[#B81B26] text-xs font-semibold text-white transition-colors cursor-pointer"
                        >
                          Assign guides
                        </button>
                      </>
                    )}
                  </span>
                );
              })()}
              {student.email && (
                <>
                  <span>•</span>
                  <span>{student.email}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowDeleteConfirm(true);
                setDeleteError(null);
              }}
              className="p-1.5 rounded-xl bg-white border border-[#E5E7EB] hover:bg-red-50 hover:border-red-200 text-[#D4202C] transition-colors cursor-pointer"
              title="Delete student"
              aria-label="Delete student"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 transition-colors shrink-0 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
                {tasks.filter((t) => t.status === 'completed').length} completed • {tasks.filter((t) => t.status === 'submitted').length} awaiting review • {tasks.filter((t) => t.status === 'assigned').length} assigned
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
                  const isAwaitingReview = task.status === 'submitted';
                  const isAssigned = task.status === 'assigned';

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
                  const rawPath = s.fileId || s.storagePath;
                  const isPurged = s.status === 'purged' || Boolean(s.fileDeletedAt) || !rawPath;
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
                          Submitted: {new Date(s.submittedAt || s.uploadedAt || s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {!isPurged && rawPath ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewingScreenshotId(rawPath)}
                            className="flex-1 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#D4202C]" />
                            <span>Review screenshot</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteScreenshot(s.id, rawPath)}
                            disabled={deletingScreenshotId === s.id}
                            title={confirmingScreenshotDeleteId === s.id ? "Click again to delete" : "Delete screenshot"}
                            className={`px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                              confirmingScreenshotDeleteId === s.id
                                ? 'bg-[#D4202C] text-white border-[#D4202C]'
                                : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:text-[#D4202C] hover:bg-red-50'
                            }`}
                          >
                            {deletingScreenshotId === s.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4202C]" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span>{confirmingScreenshotDeleteId === s.id ? 'Confirm?' : 'Delete'}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="p-1.5 rounded-lg bg-white text-xs text-[#6B7280] text-center italic">
                          File deleted per 26-hour privacy rule
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
                    <button
                      type="button"
                      onClick={() => {
                        const s = screenshots.find((x) => x.fileId === viewingScreenshotId || x.storagePath === viewingScreenshotId || x.id === viewingScreenshotId);
                        if (s) handleDeleteScreenshot(s.id, s.storagePath || s.fileId, true);
                      }}
                      className="px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                      title="Delete this screenshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Screenshot</span>
                    </button>
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
                      purged after the 26-hour privacy window.
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
                    const proxyUrl = viewingScreenshotId ? `/api/screenshot-image?path=${encodeURIComponent(viewingScreenshotId)}` : '';
                    if (resolvedScreenshotUrl && proxyUrl && resolvedScreenshotUrl !== proxyUrl) {
                      setResolvedScreenshotUrl(proxyUrl);
                    } else {
                      setScreenshotLoading(false);
                      setScreenshotError(true);
                    }
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

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {/* Currently Assigned Guides */}
              {(() => {
                const currentGuides = data.allGuides && data.allGuides.length > 0
                  ? data.allGuides
                  : (guide ? [{ id: guide.id, fullName: guide.fullName, username: guide.username, programs: ['General'] }] : []);

                if (currentGuides.length === 0) return null;

                return (
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
                          {cg.programs && cg.programs.length > 0 && cg.programs[0] !== 'General' && (
                            <span className="text-[10px] text-[#6B7280] font-normal">
                              ({cg.programs.join(', ')})
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleExecuteRemoveGuide(cg.id)}
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
                );
              })()}

              {/* Assignment settings: Program & Mode */}
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
                    {programs.map((prog) => (
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
                        name="drilldownAssignMode"
                        checked={assignMode === 'add'}
                        onChange={() => setAssignMode('add')}
                        className="accent-[#D4202C]"
                      />
                      <span>Add (keep others)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-[#111111] cursor-pointer ml-2">
                      <input
                        type="radio"
                        name="drilldownAssignMode"
                        checked={assignMode === 'replace'}
                        onChange={() => setAssignMode('replace')}
                        className="accent-[#D4202C]"
                      />
                      <span>Replace all</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Search box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-[#111111]">
                    Select Guides ({selectedGuideIds.length} selected)
                  </label>
                  {selectedGuideIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedGuideIds([])}
                      className="text-xs text-[#6B7280] font-semibold hover:underline cursor-pointer"
                    >
                      Clear selection
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
                  <input
                    id="drilldown-guide-search"
                    type="text"
                    value={guideSearchQuery}
                    onChange={(e) => setGuideSearchQuery(e.target.value)}
                    placeholder="Search guides by name or username"
                    className="w-full h-10 pl-9 pr-9 rounded-xl bg-[#F3F4F6] text-xs font-medium text-[#111111] placeholder:text-[#6B7280] border-0 focus:ring-2 focus:ring-[#D4202C]"
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
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {availableGuides
                  .filter((g) => {
                    if (!guideSearchQuery.trim()) return true;
                    return (
                      matchesSearch(g.fullName, guideSearchQuery) ||
                      matchesSearch(g.username, guideSearchQuery)
                    );
                  })
                  .map((g) => {
                    const isSelected = selectedGuideIds.includes(g.id);
                    return (
                      <div
                        key={g.id}
                        onClick={() => {
                          setSelectedGuideIds((prev) =>
                            prev.includes(g.id)
                              ? prev.filter((id) => id !== g.id)
                              : [...prev, g.id]
                          );
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#D4202C] bg-red-50/40 shadow-xs'
                            : 'border-[#E5E7EB] bg-white hover:bg-gray-50'
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
                              {g.fullName}
                            </div>
                            <div className="text-[11px] text-[#6B7280]">
                              @{g.username}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#111111]">
                            {g.studentCount} {g.studentCount === 1 ? 'student' : 'students'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="p-4 border-t border-[#F3F4F6] flex items-center justify-between gap-2">
              <span className="text-xs text-[#6B7280]">
                {selectedGuideIds.length === 0
                  ? 'No guides selected'
                  : `${selectedGuideIds.length} ${selectedGuideIds.length === 1 ? 'guide' : 'guides'} selected`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangingGuide(false)}
                  className="px-4 py-2 rounded-[10px] text-xs font-semibold text-[#6B7280] hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteChangeGuide}
                  disabled={selectedGuideIds.length === 0 || isGuideSubmitting}
                  className="h-[42px] px-5 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer flex items-center gap-2 transition-colors"
                >
                  {isGuideSubmitting
                    ? 'Saving...'
                    : `Assign ${selectedGuideIds.length} ${
                        selectedGuideIds.length === 1 ? 'Guide' : 'Guides'
                      }`}
                </button>
              </div>
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
                onClick={() => handleExecuteRemoveGuide()}
                disabled={isGuideSubmitting}
                className="px-4 py-2 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isGuideSubmitting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      {showDeleteConfirm && data?.student && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-[#D4202C] shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={() => {
                  setShowDeleteConfirm(false);
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
                Delete Student?
              </h3>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1.5 leading-relaxed">
                Are you sure you want to delete <strong className="text-[#111111]">{data.student.fullName}</strong> ({data.student.username})? All attendance records, submitted tasks, and program enrollments for this student will be permanently deleted. This action cannot be undone.
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
                disabled={isDeletingStudent}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                className="px-4 py-2.5 rounded-[10px] text-xs sm:text-sm font-semibold text-[#6B7280] hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStudent}
                disabled={isDeletingStudent}
                className="px-5 py-2.5 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] text-white text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {isDeletingStudent ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
