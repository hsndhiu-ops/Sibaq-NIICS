import React, { useState, useEffect } from 'react';
import { api } from '../../api';
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

  // Admin task review action state
  const [reviewTask, setReviewTask] = useState<TaskRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<'complete' | 'send_back'>('complete');
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    loadStudentDetail();
  }, [studentId]);

  const loadStudentDetail = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminStudentDetail(studentId);
      setData(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
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
            <p className="text-[11px] sm:text-xs text-[#6B7280] truncate mt-0.5">
              Roll: {student.username} • Guide: {guide ? guide.fullName : 'Unassigned'}
              {student.email ? ` • ${student.email}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          {/* Top Metric Cards: Responsive 3 columns with mobile spacing */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F3F4F6] text-center flex flex-col justify-center">
              <div className="text-[11px] sm:text-xs font-semibold text-[#6B7280]">Streak</div>
              <div className="text-lg sm:text-xl font-extrabold text-[#EF4B47] flex items-center justify-center gap-1 my-0.5 sm:my-1">
                <Flame className="w-4 h-4 shrink-0" />
                <span>{streak}d</span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-[#6B7280]">consecutive</div>
            </div>

            <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F3F4F6] text-center flex flex-col justify-center">
              <div className="text-[11px] sm:text-xs font-semibold text-[#6B7280]">Total Points</div>
              <div className="text-lg sm:text-xl font-extrabold text-[#111111] my-0.5 sm:my-1">
                {totalPoints} pts
              </div>
              <div className="text-[10px] sm:text-[11px] text-[#6B7280]">earned marks</div>
            </div>

            <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F3F4F6] text-center flex flex-col justify-center">
              <div className="text-[11px] sm:text-xs font-semibold text-[#6B7280]">Programs</div>
              <div className="text-lg sm:text-xl font-extrabold text-[#111111] my-0.5 sm:my-1">
                {programs.length}
              </div>
              <div className="text-[10px] sm:text-[11px] text-[#6B7280]">assigned items</div>
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
                <p className="text-[11px] sm:text-xs text-[#6B7280]">
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
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EF4B47] text-white text-[11px] font-semibold">
                              <Check className="w-3 h-3 stroke-[3]" />
                              Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-[#6B7280] text-[11px] font-semibold">
                              <span>-</span>
                              Absent
                            </span>
                          )}
                        </div>

                        {a.note && (
                          <p className="text-[11px] text-[#6B7280] italic break-words">
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
              <p className="text-[11px] sm:text-xs text-[#6B7280]">
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
                          ? 'bg-amber-50/70 border border-amber-200/80'
                          : 'bg-[#F3F4F6]'
                      }`}
                    >
                      {/* Task header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-[#111111] break-words">
                            {task.title}
                          </h4>
                          <span className="text-[11px] text-[#6B7280] block mt-0.5">
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
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Completed
                            </span>
                          )}
                          {isAwaitingReview && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              <Clock className="w-3.5 h-3.5" />
                              Awaiting review
                            </span>
                          )}
                          {isAssigned && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
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
                                  className="px-2 py-0.5 sm:py-1 rounded-lg bg-white border border-[#E5E7EB] text-[11px] font-semibold text-[#111111] hover:bg-gray-100 flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3 text-amber-600" />
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
                                className="px-2 py-0.5 sm:py-1 rounded-lg bg-emerald-600 text-[11px] font-semibold text-white hover:bg-emerald-700 flex items-center gap-1 shadow-2xs"
                              >
                                <Check className="w-3 h-3" />
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
                            href={`/api/files/download/${task.attachmentFileId}`}
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
                          <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider block">
                            Student submission
                          </span>

                          {task.submissionNote && (
                            <p className="text-xs text-[#111111] italic leading-relaxed break-words">
                              "{task.submissionNote}"
                            </p>
                          )}

                          {task.submissionFileId && (
                            <a
                              href={`/api/files/download/${task.submissionFileId}`}
                              download
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3F4F6] text-xs font-semibold text-[#D93F3B] hover:bg-gray-200 transition-colors max-w-full truncate"
                            >
                              <Download className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Submission file: {task.submissionFileName || 'Download'}</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Reviewer note if present */}
                      {task.reviewerNote && (
                        <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs">
                          <span className="font-semibold block text-[11px]">Feedback / review note:</span>
                          <p>{task.reviewerNote}</p>
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
              <p className="text-[11px] sm:text-xs text-[#6B7280]">
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
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              isPurged
                                ? 'bg-white text-[#6B7280]'
                                : 'bg-[#111111] text-white'
                            }`}
                          >
                            {isPurged ? 'File purged' : 'Active image'}
                          </span>
                        </div>

                        <span className="text-[11px] text-[#6B7280] block mt-1">
                          Submitted: {new Date(s.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {!isPurged && s.fileId ? (
                        <button
                          onClick={() => setViewingScreenshotId(s.fileId)}
                          className="w-full py-2 rounded-xl bg-white text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#EF4B47]" />
                          <span>Review screenshot</span>
                        </button>
                      ) : (
                        <div className="p-1.5 rounded-lg bg-white text-[11px] text-[#6B7280] text-center italic">
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
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-[#F3F4F6] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#111111] truncate pr-2">
                {student.fullName} • Screen Time Screenshot
              </span>
              <button
                onClick={() => setViewingScreenshotId(null)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 sm:p-4 flex-1 overflow-auto flex items-center justify-center bg-gray-50">
              <img
                src={`/api/files/download/${viewingScreenshotId}`}
                alt="Student screen time verification"
                className="max-h-[70vh] w-auto rounded-xl object-contain shadow-sm"
              />
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
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Complete verification</span>
                  </div>
                  <p>
                    Review the work or meet the student before completing. The student will be notified of completion.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Return for revision</span>
                  </div>
                  <p>
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
                  className="w-full p-3 rounded-xl bg-[#F9FAFB] text-xs sm:text-sm text-[#111111] border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D93F3B]"
                />
              </div>

              {reviewError && (
                <p className="text-xs text-[#D93F3B] font-medium">{reviewError}</p>
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
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50 ${
                    reviewAction === 'complete' ? 'bg-emerald-600' : 'bg-[#D93F3B]'
                  }`}
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
    </div>
  );
};
