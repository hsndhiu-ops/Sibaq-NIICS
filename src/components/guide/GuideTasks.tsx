import React, { useState, useEffect } from 'react';
import { RemarkRecord, TaskRecord, User } from '../../types';
import { api } from '../../api';
import {
  Plus,
  Download,
  CheckCircle2,
  Clock,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FileText,
  AlertCircle,
  RotateCcw,
  Check,
} from 'lucide-react';

interface GuideTasksProps {
  onNotify?: (msg: string) => void;
}

export const GuideTasks: React.FC<GuideTasksProps> = ({ onNotify }) => {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [mentees, setMentees] = useState<User[]>([]);
  const [remarks, setRemarks] = useState<(RemarkRecord & { studentName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view tab: Tasks or Remarks
  const [activeTab, setActiveTab] = useState<'tasks' | 'remarks'>('tasks');

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

  // Remark creation modal state
  const [isCreatingRemark, setIsCreatingRemark] = useState(false);
  const [selectedRemarkStudentId, setSelectedRemarkStudentId] = useState('');
  const [remarkContent, setRemarkContent] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);
  const [remarkError, setRemarkError] = useState<string | null>(null);

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
        setSelectedRemarkStudentId(menteeUsers[0].id);
      }

      // Collect all remarks from mentees
      const allRemarks: (RemarkRecord & { studentName: string })[] = [];
      menteesRes.mentees.forEach((m) => {
        (m.remarks || []).forEach((r) => {
          allRemarks.push({
            ...r,
            studentName: m.student.fullName,
          });
        });
      });
      allRemarks.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRemarks(allRemarks);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !title || !dueDate) return;

    setSavingTask(true);
    setTaskError(null);

    try {
      let attachmentFileId: string | null = null;
      let attachmentFileName: string | null = null;

      if (taskFile) {
        const uploadRes = await api.uploadFile(taskFile, 'task_attachment');
        attachmentFileId = uploadRes.fileId;
        attachmentFileName = uploadRes.originalName;
      }

      await api.createGuideTask({
        studentId: selectedStudentId,
        title: title.trim(),
        description: description.trim(),
        dueDate,
        attachmentFileId,
        attachmentFileName,
      });

      setTitle('');
      setDescription('');
      setDueDate('');
      setTaskFile(null);
      setIsCreatingTask(false);
      if (onNotify) onNotify('Task assigned to mentee.');
      loadData();
    } catch (err: any) {
      setTaskError(err.message || 'Failed to create task');
    } finally {
      setSavingTask(false);
    }
  };

  const handleCreateRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRemarkStudentId || !remarkContent.trim()) return;

    setSavingRemark(true);
    setRemarkError(null);

    try {
      await api.createGuideRemark({
        studentId: selectedRemarkStudentId,
        content: remarkContent.trim(),
      });

      setRemarkContent('');
      setIsCreatingRemark(false);
      if (onNotify) onNotify('Remark recorded for mentee.');
      loadData();
    } catch (err: any) {
      setRemarkError(err.message || 'Failed to save remark');
    } finally {
      setSavingRemark(false);
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
      setReviewError('A short note explaining why the task is sent back is required.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      if (reviewAction === 'complete') {
        await api.completeGuideTask(reviewTask.id, reviewNote.trim() || null);
        if (onNotify) onNotify(`Task "${reviewTask.title}" marked completed.`);
      } else {
        await api.sendBackGuideTask(reviewTask.id, reviewNote.trim());
        if (onNotify) onNotify(`Task "${reviewTask.title}" sent back to mentee with note.`);
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
    return s ? s.fullName : 'Mentee';
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
  const awaitingReviewTasks = tasks.filter((t) => t.status === 'awaiting_review');
  const assignedTasks = tasks.filter((t) => t.status === 'assigned' || (t.status as any) === 'pending');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-6 pb-20">
      {/* Header with Title and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            Tasks & guidance
          </h2>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Assign preparation tasks, inspect submissions, and log mentee remarks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (mentees.length > 0 && !selectedRemarkStudentId) {
                setSelectedRemarkStudentId(mentees[0].id);
              }
              setIsCreatingRemark(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#E5E7EB] text-[#111111] text-xs font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#D93F3B]" />
            <span>Add remark</span>
          </button>

          <button
            onClick={() => {
              if (mentees.length > 0 && !selectedStudentId) {
                setSelectedStudentId(mentees[0].id);
              }
              setIsCreatingTask(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#D93F3B] text-white text-xs font-semibold hover:opacity-95 flex items-center gap-1.5 transition-opacity shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>New task</span>
          </button>
        </div>
      </div>

      {/* Segmented View Controls: Tasks vs Remarks */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'tasks'
              ? 'bg-[#111111] text-white shadow-2xs'
              : 'bg-white text-[#6B7280] hover:text-[#111111]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Tasks ({tasks.length})</span>
          {awaitingReviewTasks.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-[#D93F3B] text-white text-[10px] font-bold">
              {awaitingReviewTasks.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('remarks')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'remarks'
              ? 'bg-[#111111] text-white shadow-2xs'
              : 'bg-white text-[#6B7280] hover:text-[#111111]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Candidate remarks ({remarks.length})</span>
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading task and remark records...
        </div>
      ) : activeTab === 'tasks' ? (
        /* ================= TASKS VIEW ================= */
        <div className="space-y-6">
          {/* SECTION 1: Awaiting review (positioned at top with count badge) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#111111]">Awaiting review</h3>
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                  {awaitingReviewTasks.length}
                </span>
              </div>
              <span className="text-xs text-[#6B7280]">
                Review the work or meet the student before completing.
              </span>
            </div>

            {awaitingReviewTasks.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] text-center text-xs text-[#6B7280]">
                No student submissions awaiting review right now.
              </div>
            ) : (
              <div className="space-y-3">
                {awaitingReviewTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 sm:p-5 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3 transition-all"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-base text-[#111111]">{task.title}</h4>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                            <Clock className="w-3 h-3" />
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
                              <span className="text-amber-900 font-medium">
                                Submitted {new Date(task.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(task.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Two primary actions: Mark completed & Send back */}
                      <div className="flex items-center gap-2 shrink-0 self-start pt-1 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => openReviewModal(task, 'send_back')}
                          className="px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-[#111111] text-xs font-semibold hover:bg-gray-50 flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                          <span>Send back</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openReviewModal(task, 'complete')}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1 transition-colors shadow-2xs"
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

                    {/* Mentee Submission Box: Notes & Attached Files */}
                    <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                          Student submission details
                        </span>
                        <span className="text-[11px] text-[#6B7280]">
                          Review the work or meet the student before completing.
                        </span>
                      </div>

                      {task.submissionNote ? (
                        <div className="p-2.5 rounded-lg bg-[#F9FAFB] border border-gray-100 text-[#111111]">
                          <span className="text-[#6B7280] font-medium block text-[11px] mb-0.5">
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-xs font-semibold text-[#D93F3B] hover:bg-red-100 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
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

          {/* SECTION 2: Assigned tasks */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#111111]">
                Assigned tasks ({assignedTasks.length})
              </h3>
            </div>

            {assignedTasks.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] text-center text-xs text-[#6B7280]">
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
                          Assigned
                        </span>
                        <button
                          type="button"
                          onClick={() => openReviewModal(task, 'complete')}
                          className="px-3 py-1 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100"
                        >
                          Complete
                        </button>
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-xs sm:text-sm text-[#111111] leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {task.reviewerNote && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-[#111111]">
                        <span className="font-semibold text-amber-800 block text-[11px]">
                          Note sent with returned task:
                        </span>
                        <p>{task.reviewerNote}</p>
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
              <div className="p-4 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] text-center text-xs text-[#6B7280]">
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
                                <span className="text-emerald-700 font-medium">
                                  Completed {formatCleanDate(task.completedAt)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold shadow-2xs self-start">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Completed</span>
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-xs sm:text-sm text-[#111111] leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Clean collapsible review button */}
                      {hasDetails && (
                        <div className="pt-1 border-t border-gray-200/70 space-y-2">
                          <button
                            type="button"
                            onClick={() => toggleSubmission(task.id)}
                            className="text-xs font-semibold text-[#111111] hover:text-[#D93F3B] flex items-center gap-1.5 transition-colors py-0.5"
                          >
                            <span>
                              {isSubmissionOpen
                                ? 'Hide submission details'
                                : 'Review student submission'}
                            </span>
                            {isSubmissionOpen ? (
                              <ChevronUp className="w-3.5 h-3.5 text-[#6B7280]" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-[#6B7280]" />
                            )}
                          </button>

                          {isSubmissionOpen && (
                            <div className="p-3.5 rounded-xl bg-white space-y-2.5 text-xs border border-gray-100 shadow-2xs">
                              {task.submissionNote && (
                                <div className="bg-[#F9FAFB] p-2.5 rounded-lg text-[#111111] border border-gray-100">
                                  <span className="text-[#6B7280] font-medium block text-[11px] mb-0.5">
                                    Student note:
                                  </span>
                                  <p className="leading-relaxed whitespace-pre-wrap">{task.submissionNote}</p>
                                </div>
                              )}

                              {task.submissionFileId && (
                                <div>
                                  <a
                                    href={task.submissionFileId.startsWith('http') ? task.submissionFileId : `/api/files/download/${task.submissionFileId}`}
                                    download
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-xs font-semibold text-[#D93F3B] hover:bg-red-100 transition-colors"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>
                                      Download submission file ({task.submissionFileName || 'File'})
                                    </span>
                                  </a>
                                </div>
                              )}

                              {task.reviewerNote && (
                                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-100">
                                  <span className="font-semibold block text-[11px] mb-0.5">
                                    Review note:
                                  </span>
                                  <p>{task.reviewerNote}</p>
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
      ) : (
        /* ================= REMARKS VIEW ================= */
        <div className="space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#111111] flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-[#D93F3B]" />
                <span>Log performance remark</span>
              </h3>
            </div>
            <p className="text-xs text-[#6B7280]">
              Remarks logged here are saved to the student record and are immediately visible to administrators in the audit log and student drill-down.
            </p>

            <form onSubmit={handleCreateRemark} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Select mentee
                </label>
                <select
                  value={selectedRemarkStudentId}
                  onChange={(e) => setSelectedRemarkStudentId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-white text-xs sm:text-sm text-[#111111] border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D93F3B]"
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
                  Remark & feedback content
                </label>
                <textarea
                  value={remarkContent}
                  onChange={(e) => setRemarkContent(e.target.value)}
                  placeholder="Record praise, preparation notes, or specific areas of improvement..."
                  rows={3}
                  required
                  className="w-full p-3 rounded-xl bg-white text-xs sm:text-sm text-[#111111] border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D93F3B]"
                />
              </div>

              {remarkError && (
                <p className="text-xs text-[#D93F3B] font-medium">{remarkError}</p>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingRemark || !remarkContent.trim()}
                  className="px-4 py-2 rounded-xl bg-[#D93F3B] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50 transition-opacity shadow-2xs"
                >
                  {savingRemark ? 'Saving...' : 'Save remark'}
                </button>
              </div>
            </form>
          </div>

          {/* Past Remarks List */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-[#111111]">
              Recent recorded remarks ({remarks.length})
            </h4>

            {remarks.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#F3F4F6] text-center text-xs text-[#6B7280]">
                No remarks recorded yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {remarks.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] space-y-1.5 text-xs transition-all"
                  >
                    <div className="flex items-center justify-between text-[#6B7280]">
                      <span className="font-bold text-[#111111]">{r.studentName}</span>
                      <span>{formatCleanDate(r.createdAt)}</span>
                    </div>
                    <p className="text-[#111111] leading-relaxed whitespace-pre-wrap">{r.content}</p>
                  </div>
                ))}
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
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Complete verification</span>
                  </div>
                  <p>
                    Review the work or meet the student before completing. The student will be notified that this task is marked completed.
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
                      : 'Add praise or closing remarks...'
                  }
                  rows={3}
                  required={reviewAction === 'send_back'}
                  className="w-full p-3 rounded-xl bg-[#F9FAFB] text-xs sm:text-sm text-[#111111] border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D93F3B]"
                />
              </div>

              {reviewError && (
                <p className="text-xs text-[#D93F3B] font-medium">{reviewError}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeReviewModal}
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

      {/* ================= CREATE TASK MODAL ================= */}
      {isCreatingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
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
                  Assign mentee
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F9FAFB] text-sm text-[#111111] border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D93F3B]"
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
                  placeholder="e.g. Speech delivery practice / rehearsal audio"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F9FAFB] text-sm text-[#111111] border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D93F3B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Instructions & guidelines
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Outline the preparation requirements..."
                  rows={3}
                  className="w-full p-3 rounded-xl bg-[#F9FAFB] text-sm text-[#111111] border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D93F3B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Due date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F9FAFB] text-sm text-[#111111] border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D93F3B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Guide attachment (optional: notes, audio, PDF)
                </label>
                <input
                  type="file"
                  onChange={(e) => setTaskFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#6B7280] file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#111111] file:text-white hover:file:bg-black"
                />
              </div>

              {taskError && (
                <p className="text-xs text-[#D93F3B] font-medium">{taskError}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingTask(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTask}
                  className="px-4 py-2.5 rounded-xl bg-[#D93F3B] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50 shadow-2xs"
                >
                  {savingTask ? 'Assigning task...' : 'Assign task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= CREATE REMARK MODAL ================= */}
      {isCreatingRemark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <h3 className="font-bold text-base text-[#111111]">
                Record mentee remark
              </h3>
              <button
                onClick={() => setIsCreatingRemark(false)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRemark} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Select mentee
                </label>
                <select
                  value={selectedRemarkStudentId}
                  onChange={(e) => setSelectedRemarkStudentId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F9FAFB] text-sm text-[#111111] border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D93F3B]"
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
                  Remark & feedback
                </label>
                <textarea
                  value={remarkContent}
                  onChange={(e) => setRemarkContent(e.target.value)}
                  placeholder="Record praise, preparation notes, or specific areas of improvement..."
                  rows={4}
                  required
                  className="w-full p-3 rounded-xl bg-[#F9FAFB] text-sm text-[#111111] border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#D93F3B]"
                />
              </div>

              {remarkError && (
                <p className="text-xs text-[#D93F3B] font-medium">{remarkError}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingRemark(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRemark || !remarkContent.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#D93F3B] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50 shadow-2xs"
                >
                  {savingRemark ? 'Saving remark...' : 'Save remark'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
