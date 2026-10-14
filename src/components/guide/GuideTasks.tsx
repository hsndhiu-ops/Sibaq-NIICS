import React, { useState, useEffect } from 'react';
import { TaskRecord, User } from '../../types';
import { api } from '../../api';
import {
  Plus,
  Download,
  Clock,
  X,
  FileText,
  AlertCircle,
  RotateCcw,
  Check,
} from 'lucide-react';
import { Pentagon } from '../brand/Decorations';

interface GuideTasksProps {
  onNotify?: (msg: string) => void;
}

export const GuideTasks: React.FC<GuideTasksProps> = ({ onNotify }) => {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [mentees, setMentees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Task creation modal state
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [taskFile, setTaskFile] = useState<File | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  // Expanded submission states for tasks
  const [expandedSubmissions, setExpandedSubmissions] = useState<Record<string, boolean>>({});

  // Review modal state: Send back with note or Complete with note
  const [reviewTask, setReviewTask] = useState<TaskRecord | null>(null);
  const [reviewAction, setReviewAction] = useState<'complete' | 'send_back'>('complete');
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasksRes, menteesRes] = await Promise.all([
        api.getGuideTasks(),
        api.getGuideMentees(),
      ]);
      setTasks(tasksRes.tasks);
      const menteeUsers = menteesRes.mentees.map((m) => m.student);
      setMentees(menteeUsers);

      if (menteeUsers.length > 0 && !selectedStudentId) {
        setSelectedStudentId(menteeUsers[0].id);
      }
    } catch (_err) {
      // Graceful error handling
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !title.trim()) {
      setTaskError('Please select a student and provide a task title.');
      return;
    }

    setSavingTask(true);
    setTaskError(null);

    try {
      await api.createGuideTask({
        studentId: selectedStudentId,
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate || undefined,
        attachmentFile: taskFile || undefined,
      });

      setTitle('');
      setDescription('');
      setDueDate('');
      setTaskFile(null);
      setIsCreatingTask(false);

      if (onNotify) onNotify('Task assigned to student successfully.');
      loadData();
    } catch (err: any) {
      setTaskError(err.message || 'Failed to create task.');
    } finally {
      setSavingTask(false);
    }
  };

  const openReviewModal = (task: TaskRecord, action: 'complete' | 'send_back') => {
    setReviewTask(task);
    setReviewAction(action);
    setReviewNote('');
    setReviewError(null);
  };

  const closeReviewModal = () => {
    setReviewTask(null);
    setReviewNote('');
    setReviewError(null);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTask) return;

    if (reviewAction === 'send_back' && !reviewNote.trim()) {
      setReviewError('A reason note is required when sending back a task.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      if (reviewAction === 'complete') {
        // Calls review_task RPC
        await api.completeGuideTask(reviewTask.id, reviewNote.trim() || null);
        if (onNotify) onNotify(`Task "${reviewTask.title}" marked completed.`);
      } else {
        // Calls review_task RPC
        await api.sendBackGuideTask(reviewTask.id, reviewNote.trim());
        if (onNotify) onNotify(`Task "${reviewTask.title}" sent back to student with note.`);
      }

      closeReviewModal();
      loadData();
    } catch (err: any) {
      setReviewError(err.message || 'Failed to update task review.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const toggleSubmission = (taskId: string) => {
    setExpandedSubmissions((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const getStudentName = (id: string) => {
    const s = mentees.find((m) => m.id === id);
    return s ? s.fullName : 'Student';
  };

  const formatCleanDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Group tasks into three workflow lists
  // Status 'awaiting_review' is the submitted state
  const awaitingReviewTasks = tasks.filter((t) => t.status === 'awaiting_review');
  const assignedTasks = tasks.filter((t) => t.status === 'assigned' || (t.status as any) === 'pending');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-6 pb-20">
      {/* Header with Title and Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
            Tasks
          </h2>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Assign preparation tasks and review submitted student work
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (mentees.length > 0 && !selectedStudentId) {
                setSelectedStudentId(mentees[0].id);
              }
              setIsCreatingTask(true);
            }}
            className="px-4 py-2 rounded-[10px] bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#B81B26] active:bg-[#B81B26] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New task</span>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading tasks...
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: Awaiting review (At the very top with count badge) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#111111]">Awaiting review</h3>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#111111] text-white text-xs font-bold shrink-0">
                  {awaitingReviewTasks.length}
                </span>
              </div>
              <p className="text-xs text-[#6B7280]">
                Submitted tasks awaiting verification
              </p>
            </div>

            {awaitingReviewTasks.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#F3F4F6] text-center text-xs text-[#6B7280] flex flex-col items-center justify-center">
                <Pentagon size={64} className="mb-2" />
                <p>No student submissions awaiting review right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {awaitingReviewTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-3 transition-all"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-base text-[#111111]">{task.title}</h4>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-[#111111] text-xs font-semibold border border-gray-200">
                            <Clock className="w-3 h-3 text-[#D4202C]" />
                            Awaiting review
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6B7280] mt-1">
                          <span>
                            Student: <strong className="text-[#111111]">{getStudentName(task.studentId)}</strong>
                          </span>
                          <span>•</span>
                          <span>Due date: {formatCleanDate(task.dueDate)}</span>
                          {task.submittedAt && (
                            <>
                              <span>•</span>
                              <span className="text-[#111111] font-medium">
                                Submitted {new Date(task.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(task.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions: ONLY on submitted/awaiting review tasks */}
                      <div className="flex items-center gap-2 shrink-0 self-start pt-1 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => openReviewModal(task, 'send_back')}
                          className="px-3 py-1.5 rounded-[10px] bg-white border border-[#E5E7EB] text-[#111111] text-xs font-semibold hover:bg-gray-100 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#D4202C]" />
                          <span>Send back</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openReviewModal(task, 'complete')}
                          className="px-3.5 py-1.5 rounded-[10px] bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#B81B26] active:bg-[#B81B26] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark completed</span>
                        </button>
                      </div>
                    </div>

                    {/* Task Description */}
                    {task.description && (
                      <p className="text-xs sm:text-sm text-[#111111] leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {/* Student Submission Box: Notes & Attached Files */}
                    <div className="p-3.5 rounded-xl bg-white space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111111] block">
                          Student submission
                        </span>
                        <span className="text-xs text-[#6B7280]">
                          Verify work before completing
                        </span>
                      </div>

                      {task.submissionNote ? (
                        <div className="p-2.5 rounded-lg bg-[#F3F4F6] text-[#111111]">
                          <span className="text-[#6B7280] font-medium block text-xs mb-0.5">
                            Student note:
                          </span>
                          <p className="leading-relaxed whitespace-pre-wrap">{task.submissionNote}</p>
                        </div>
                      ) : (
                        <p className="text-[#6B7280] italic">No submission note provided.</p>
                      )}

                      {task.submissionFileId && (
                        <div className="pt-1">
                          <a
                            href={task.submissionFileId.startsWith('http') ? task.submissionFileId : `/api/files/download/${task.submissionFileId}`}
                            download
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] hover:bg-gray-200 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 text-[#D4202C]" />
                            <span>
                              Download submitted file ({task.submissionFileName || 'File'})
                            </span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: Assigned tasks (NO COMPLETE BUTTON) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#111111]">
                Assigned tasks ({assignedTasks.length})
              </h3>
            </div>

            {assignedTasks.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#F3F4F6] text-center text-xs text-[#6B7280]">
                No pending assigned tasks.
              </div>
            ) : (
              <div className="space-y-3">
                {assignedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-2.5 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-base text-[#111111]">{task.title}</h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6B7280] mt-1">
                          <span>
                            Student: <strong className="text-[#111111]">{getStudentName(task.studentId)}</strong>
                          </span>
                          <span>•</span>
                          <span>Due date: {formatCleanDate(task.dueDate)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-start">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white text-[#6B7280] text-xs font-semibold border border-gray-200">
                          Assigned
                        </span>
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-xs sm:text-sm text-[#111111] leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {task.reviewerNote && (
                      <div className="p-2.5 rounded-xl bg-white border border-gray-200 text-xs text-[#111111]">
                        <span className="font-semibold text-[#111111] block text-xs">
                          Note sent with returned task:
                        </span>
                        <p className="mt-0.5">{task.reviewerNote}</p>
                      </div>
                    )}

                    {task.attachmentFileId && (
                      <div className="pt-0.5">
                        <a
                          href={task.attachmentFileId.startsWith('http') ? task.attachmentFileId : `/api/files/download/${task.attachmentFileId}`}
                          download
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-xs font-medium text-[#111111] hover:bg-gray-100 transition-colors shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                          <span>Guide attachment ({task.attachmentFileName || 'Download'})</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: Completed tasks */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#111111]">
                Completed tasks ({completedTasks.length})
              </h3>
            </div>

            {completedTasks.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#F3F4F6] text-center text-xs text-[#6B7280]">
                No completed tasks recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {completedTasks.map((task) => {
                  const isSubmissionOpen = !!expandedSubmissions[task.id];
                  const hasDetails = !!(task.submissionNote || task.submissionFileId || task.reviewerNote);

                  return (
                    <div
                      key={task.id}
                      className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-2.5 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-base text-[#111111]">{task.title}</h4>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6B7280] mt-1">
                            <span>
                              Student: <strong className="text-[#111111]">{getStudentName(task.studentId)}</strong>
                            </span>
                            <span>•</span>
                            <span>Due date: {formatCleanDate(task.dueDate)}</span>
                            {task.completedAt && (
                              <>
                                <span>•</span>
                                <span className="text-[#111111] font-medium">
                                  Completed {formatCleanDate(task.completedAt)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#111111] border border-gray-200 text-xs font-semibold self-start">
                          <Check className="w-3.5 h-3.5 text-[#D4202C] stroke-[3]" />
                          <span>Completed</span>
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-xs sm:text-sm text-[#111111] leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Expandable Submission & Review Details */}
                      {hasDetails && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => toggleSubmission(task.id)}
                            className="text-xs font-semibold text-[#111111] hover:underline flex items-center gap-1"
                          >
                            <span>{isSubmissionOpen ? 'Hide submission details' : 'View submission details'}</span>
                          </button>

                          {isSubmissionOpen && (
                            <div className="mt-2 p-3 rounded-xl bg-white space-y-2 text-xs border border-gray-200">
                              {task.submissionNote && (
                                <div>
                                  <span className="text-[#6B7280] font-medium block text-xs">
                                    Student note:
                                  </span>
                                  <p className="text-[#111111] mt-0.5">{task.submissionNote}</p>
                                </div>
                              )}

                              {task.submissionFileId && (
                                <a
                                  href={task.submissionFileId.startsWith('http') ? task.submissionFileId : `/api/files/download/${task.submissionFileId}`}
                                  download
                                  className="inline-flex items-center gap-1.5 text-xs text-[#D4202C] font-semibold hover:underline"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download student file ({task.submissionFileName || 'File'})</span>
                                </a>
                              )}

                              {task.reviewerNote && (
                                <div className="pt-1 border-t border-gray-100">
                                  <span className="text-[#6B7280] font-medium block text-xs">
                                    Guide review note:
                                  </span>
                                  <p className="text-[#111111] mt-0.5">{task.reviewerNote}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= REVIEW ACTION MODAL (Complete or Send Back) ================= */}
      {reviewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  {reviewAction === 'complete' ? 'Mark task completed' : 'Send back task'}
                </h3>
                <p className="text-xs text-[#6B7280] truncate max-w-xs">
                  {reviewTask.title} • {getStudentName(reviewTask.studentId)}
                </p>
              </div>
              <button
                onClick={closeReviewModal}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {reviewAction === 'complete' ? (
                <div className="p-3 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-[#D4202C] stroke-[3]" />
                    <span>Complete verification</span>
                  </div>
                  <p className="text-[#6B7280]">
                    Review the work before completing. The student will be notified that this task is marked completed.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-[#D4202C]" />
                    <span>Return for revision</span>
                  </div>
                  <p className="text-[#6B7280]">
                    Returning will switch the status back to Assigned with your required revision note.
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
                      : 'Add praise or closing remarks...'
                  }
                  rows={3}
                  required={reviewAction === 'send_back'}
                  className="w-full p-3 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] border border-transparent focus:border-[#D4202C] focus:outline-none"
                />
              </div>

              {reviewError && (
                <p className="text-xs text-[#D4202C] font-medium">{reviewError}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeReviewModal}
                  className="px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#6B7280] hover:text-[#111111]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="px-4 py-2 rounded-[10px] text-xs font-semibold text-white bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] disabled:opacity-50 transition-colors cursor-pointer"
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

      {/* ================= CREATE TASK MODAL ================= */}
      {isCreatingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col border border-[#E5E7EB] overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <h3 className="font-bold text-base text-[#111111]">
                Assign new task
              </h3>
              <button
                onClick={() => setIsCreatingTask(false)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Assign student
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] border border-transparent focus:border-[#D4202C] focus:outline-none"
                >
                  {mentees.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Task title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Memorize speech draft Part 1"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] border border-transparent focus:border-[#D4202C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Description / instructions (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed guidelines, reference notes, or expectations..."
                  rows={3}
                  className="w-full p-3 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] border border-transparent focus:border-[#D4202C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Due date (optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] border border-transparent focus:border-[#D4202C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Attach reference file (optional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setTaskFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#6B7280] file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#111111] file:text-white hover:file:bg-black"
                />
              </div>

              {taskError && (
                <p className="text-xs text-[#D4202C] font-medium">{taskError}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingTask(false)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#6B7280] hover:text-[#111111]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTask}
                  className="px-5 py-2.5 rounded-[10px] bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#B81B26] active:bg-[#B81B26] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {savingTask ? 'Assigning...' : 'Assign task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
