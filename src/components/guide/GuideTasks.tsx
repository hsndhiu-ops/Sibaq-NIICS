import React, { useState, useEffect } from 'react';
import { TaskRecord } from '../../types';
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
  CheckSquare,
  Square,
  ChevronDown,
} from 'lucide-react';
import { Pentagon } from '../brand/Decorations';

interface GuideTasksProps {
  onNotify?: (msg: string) => void;
}

interface ProgramWithStudents {
  programId: string;
  programName: string;
  kind: 'solo' | 'group';
  students: Array<{
    id: string;
    fullName: string;
    username: string;
  }>;
}

export const GuideTasks: React.FC<GuideTasksProps> = ({ onNotify }) => {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [programs, setPrograms] = useState<ProgramWithStudents[]>([]);
  const [loading, setLoading] = useState(true);

  // Task creation modal state
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
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
      setTasks(tasksRes.tasks || []);

      const progs: ProgramWithStudents[] = (menteesRes.programs || []).map((p: any) => ({
        programId: p.programId,
        programName: p.programName,
        kind: p.kind,
        students: (p.students || []).map((s: any) => ({
          id: s.id,
          fullName: s.fullName,
          username: s.username,
        })),
      }));

      setPrograms(progs);

      if (progs.length > 0 && !selectedProgramId) {
        setSelectedProgramId(progs[0].programId);
        setSelectedStudentIds(progs[0].students.map((s) => s.id));
      }
    } catch (err: any) {
      console.error('[loadData] error:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentProgramStudents =
    programs.find((p) => p.programId === selectedProgramId)?.students || [];

  const handleProgramChange = (progId: string) => {
    setSelectedProgramId(progId);
    const prog = programs.find((p) => p.programId === progId);
    if (prog) {
      // Default to selecting all students in this program
      setSelectedStudentIds(prog.students.map((s) => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const toggleStudentSelection = (stId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(stId) ? prev.filter((id) => id !== stId) : [...prev, stId]
    );
  };

  const selectAllStudentsInProgram = () => {
    setSelectedStudentIds(currentProgramStudents.map((s) => s.id));
  };

  const deselectAllStudentsInProgram = () => {
    setSelectedStudentIds([]);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgramId) {
      setTaskError('Please select a program.');
      return;
    }
    if (selectedStudentIds.length === 0) {
      setTaskError('Please select at least one student.');
      return;
    }
    if (!title.trim()) {
      setTaskError('Please provide a task title.');
      return;
    }
    if (!dueDate) {
      setTaskError('Please specify a due date.');
      return;
    }

    setSavingTask(true);
    setTaskError(null);

    try {
      const res = await api.createGuideTask({
        programId: selectedProgramId,
        studentIds: selectedStudentIds,
        title: title.trim(),
        description: description.trim(),
        dueDate,
        file: taskFile || undefined,
      });

      setTitle('');
      setDescription('');
      setDueDate('');
      setTaskFile(null);
      setIsCreatingTask(false);

      if (onNotify) onNotify(res.message || 'Task assigned successfully.');
      await loadData();
    } catch (err: any) {
      console.error('[createGuideTask] error:', err);
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
      setReviewError('A note explaining why the task is sent back is required.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      const res = await api.reviewTask(
        reviewTask.id,
        reviewAction,
        reviewNote.trim()
      );
      if (onNotify) onNotify(res.message);

      closeReviewModal();
      await loadData();
    } catch (err: any) {
      console.error('[reviewTask] error:', err);
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

  const formatCleanDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  };

  // Group tasks into lists:
  // Awaiting review (submitted tasks)
  const awaitingReviewTasks = tasks.filter((t) => t.status === 'submitted');
  const assignedTasks = tasks.filter((t) => t.status === 'assigned');
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
            Assign preparation tasks per program and review submitted student work
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (programs.length > 0 && !selectedProgramId) {
                setSelectedProgramId(programs[0].programId);
                setSelectedStudentIds(programs[0].students.map((s) => s.id));
              }
              setTaskError(null);
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
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-xs text-[#6B7280]">
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
                            Program: <strong className="text-[#111111]">{task.programName || 'Program'}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Student: <strong className="text-[#111111]">{task.studentName || 'Student'}</strong>
                          </span>
                          <span>•</span>
                          <span>Due date: {formatCleanDate(task.dueDate)}</span>
                          {task.submittedAt && (
                            <>
                              <span>•</span>
                              <span className="text-[#111111] font-medium">
                                Submitted {formatCleanDate(task.submittedAt)}
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

                      {task.files && task.files.length > 0 && (
                        <div className="pt-1 flex flex-wrap gap-2">
                          {task.files
                            .filter((f) => f.kind === 'submission')
                            .map((f) => (
                              <div
                                key={f.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F4F6] text-xs font-medium text-[#111111]"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#6B7280]" />
                                <span>{f.fileName}</span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: Active / Assigned tasks */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#111111]">
                Assigned tasks ({assignedTasks.length})
              </h3>
            </div>

            {assignedTasks.length === 0 ? (
              <div className="p-4 rounded-2xl bg-[#F3F4F6] text-center text-xs text-[#6B7280]">
                No assigned tasks currently pending student submission.
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
                            Program: <strong className="text-[#111111]">{task.programName || 'Program'}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Student: <strong className="text-[#111111]">{task.studentName || 'Student'}</strong>
                          </span>
                          <span>•</span>
                          <span>Due date: {formatCleanDate(task.dueDate)}</span>
                        </div>
                      </div>

                      <div className="shrink-0">
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

                    {task.reviewNote && (
                      <div className="p-2.5 rounded-xl bg-white border border-gray-200 text-xs text-[#111111]">
                        <span className="font-semibold text-[#111111] block text-xs">
                          Note sent with returned task:
                        </span>
                        <p className="mt-0.5">{task.reviewNote}</p>
                      </div>
                    )}

                    {task.files && task.files.length > 0 && (
                      <div className="pt-0.5 flex flex-wrap gap-2">
                        {task.files
                          .filter((f) => f.kind === 'guide_attachment')
                          .map((f) => (
                            <div
                              key={f.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-xs font-medium text-[#111111] shadow-2xs"
                            >
                              <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                              <span>Guide attachment ({f.fileName})</span>
                            </div>
                          ))}
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
                  const hasDetails = !!(task.submissionNote || (task.files && task.files.length > 0) || task.reviewNote);

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
                              Program: <strong className="text-[#111111]">{task.programName || 'Program'}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Student: <strong className="text-[#111111]">{task.studentName || 'Student'}</strong>
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

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-[#111111] text-xs font-semibold border border-gray-200">
                            <Check className="w-3 h-3 text-[#D4202C]" />
                            Completed
                          </span>
                          {hasDetails && (
                            <button
                              type="button"
                              onClick={() => toggleSubmission(task.id)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 transition-colors"
                            >
                              {isSubmissionOpen ? 'Hide work' : 'View work'}
                            </button>
                          )}
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-xs sm:text-sm text-[#111111] leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Dropdown with Student Submission & Review note */}
                      {isSubmissionOpen && hasDetails && (
                        <div className="p-3.5 rounded-xl bg-white space-y-2 text-xs border border-gray-200 mt-2">
                          {task.submissionNote && (
                            <div className="p-2.5 rounded-lg bg-[#F3F4F6] text-[#111111]">
                              <span className="text-[#6B7280] font-medium block text-xs mb-0.5">
                                Student submission note:
                              </span>
                              <p className="leading-relaxed whitespace-pre-wrap">{task.submissionNote}</p>
                            </div>
                          )}

                          {task.reviewNote && (
                            <div className="p-2.5 rounded-lg bg-[#F3F4F6] text-[#111111]">
                              <span className="text-[#6B7280] font-medium block text-xs mb-0.5">
                                Mentor review note:
                              </span>
                              <p className="leading-relaxed whitespace-pre-wrap">{task.reviewNote}</p>
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

      {/* ================= REVIEW MODAL (Send back or Complete) ================= */}
      {reviewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-[#E5E7EB] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  {reviewAction === 'complete' ? 'Mark task completed' : 'Send task back'}
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {reviewTask.studentName} • {reviewTask.programName || 'Program'}
                </p>
              </div>
              <button
                onClick={closeReviewModal}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  {reviewAction === 'send_back' ? (
                    <span>
                      Reason note <span className="text-[#D4202C]">*</span>
                    </span>
                  ) : (
                    'Review note (optional)'
                  )}
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder={
                    reviewAction === 'send_back'
                      ? 'Explain what needs correction or re-submission...'
                      : 'Add feedback or closing remarks...'
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
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  Assign new task
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Select program and students to assign
                </p>
              </div>
              <button
                onClick={() => setIsCreatingTask(false)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {/* Choose Program */}
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Program <span className="text-[#D4202C]">*</span>
                </label>
                <select
                  value={selectedProgramId}
                  onChange={(e) => handleProgramChange(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] border border-transparent focus:border-[#D4202C] focus:outline-none"
                >
                  {programs.map((p) => (
                    <option key={p.programId} value={p.programId}>
                      {p.programName} ({p.students.length} students)
                    </option>
                  ))}
                </select>
              </div>

              {/* Choose Students */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#111111]">
                    Students ({selectedStudentIds.length} of {currentProgramStudents.length} selected) <span className="text-[#D4202C]">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllStudentsInProgram}
                      className="text-xs text-[#D4202C] hover:underline font-medium"
                    >
                      All
                    </button>
                    <span className="text-xs text-[#9CA3AF]">|</span>
                    <button
                      type="button"
                      onClick={deselectAllStudentsInProgram}
                      className="text-xs text-[#6B7280] hover:underline font-medium"
                    >
                      None
                    </button>
                  </div>
                </div>

                {currentProgramStudents.length === 0 ? (
                  <p className="text-xs text-[#6B7280] italic p-3 bg-[#F3F4F6] rounded-xl">
                    No students currently enrolled in this program.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto p-2 bg-[#F3F4F6] rounded-xl space-y-1">
                    {currentProgramStudents.map((st) => {
                      const isChecked = selectedStudentIds.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white text-xs text-[#111111] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleStudentSelection(st.id)}
                            className="accent-[#D4202C] rounded w-4 h-4"
                          />
                          <span className="font-medium">{st.fullName}</span>
                          <span className="text-[11px] text-[#6B7280]">({st.username})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Task title <span className="text-[#D4202C]">*</span>
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

              {/* Description */}
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

              {/* Due Date */}
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Due date <span className="text-[#D4202C]">*</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] border border-transparent focus:border-[#D4202C] focus:outline-none"
                />
              </div>

              {/* Optional attachment */}
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
