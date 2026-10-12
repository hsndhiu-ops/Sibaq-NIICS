import React, { useState } from 'react';
import { TaskRecord } from '../../types';
import { api } from '../../api';
import {
  CheckCircle2,
  Download,
  Upload,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  FileText,
} from 'lucide-react';

interface StudentTasksProps {
  pendingTasks: TaskRecord[];
  completedTasks: TaskRecord[];
  onRefresh: () => void;
  activeTaskToComplete?: TaskRecord | null;
  onClearActiveTask?: () => void;
}

export const StudentTasks: React.FC<StudentTasksProps> = ({
  pendingTasks,
  completedTasks,
  onRefresh,
  activeTaskToComplete,
  onClearActiveTask,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(
    activeTaskToComplete || null
  );

  // Expanded state for completed tasks (collapsed by default)
  const [expandedCompletedTasks, setExpandedCompletedTasks] = useState<Record<string, boolean>>({});

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedCompletedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  // Complete task form state
  const [submissionNote, setSubmissionNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenComplete = (task: TaskRecord) => {
    setSelectedTask(task);
    setSubmissionNote('');
    setSelectedFile(null);
    setError(null);
  };

  const handleCloseModal = () => {
    setSelectedTask(null);
    if (onClearActiveTask) onClearActiveTask();
  };

  const handleSubmitComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let submissionFileId: string | null = null;
      let submissionFileName: string | null = null;

      if (selectedFile) {
        const uploadRes = await api.uploadFile(selectedFile, 'submission_attachment');
        submissionFileId = uploadRes.fileId;
        submissionFileName = uploadRes.originalName;
      }

      await api.submitStudentTask(selectedTask.id, {
        submissionFileId,
        submissionFileName,
        submissionNote: submissionNote || null,
      });

      handleCloseModal();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to submit task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDownloadUrl = (fileId: string) => {
    if (!fileId) return '#';
    return fileId.startsWith('http') ? fileId : `/api/files/download/${fileId}`;
  };

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-[#111111] tracking-tight">Tasks</h2>
        <p className="text-xs text-[#6B7280]">
          Preparation assignments and submissions allocated by your guide
        </p>
      </div>

      {/* Tabs: Active Tasks / Works Done */}
      <div className="flex bg-[#F3F4F6] p-1 rounded-xl max-w-xs">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'pending'
              ? 'bg-white text-[#111111] shadow-xs'
              : 'text-[#6B7280] hover:text-[#111111]'
          }`}
        >
          Tasks ({pendingTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'completed'
              ? 'bg-white text-[#111111] shadow-xs'
              : 'text-[#6B7280] hover:text-[#111111]'
          }`}
        >
          Works done ({completedTasks.length})
        </button>
      </div>

      {/* Tasks Tab: Lists Assigned and Awaiting Review tasks */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingTasks.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
              No active tasks right now. Keep up the great preparation!
            </div>
          ) : (
            pendingTasks.map((task) => {
              const isAwaitingReview = task.status === 'awaiting_review';
              return (
                <div
                  key={task.id}
                  className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-[#111111]">
                          {task.title}
                        </h3>
                        {isAwaitingReview && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold shrink-0">
                            <Clock className="w-3 h-3" />
                            Awaiting review
                          </span>
                        )}
                        {!isAwaitingReview && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold shrink-0">
                            Assigned
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#6B7280] mt-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#D93F3B]" />
                          <span>
                            Due date: <span className="text-[#111111] font-semibold">{task.dueDate}</span>
                          </span>
                        </div>
                        {isAwaitingReview && task.submittedAt && (
                          <>
                            <span>•</span>
                            <span className="text-[#6B7280]">
                              Submitted on {new Date(task.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(task.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {isAwaitingReview ? (
                      <span className="px-3 py-1.5 rounded-xl bg-white text-[#6B7280] text-xs font-medium border border-gray-200 whitespace-nowrap shrink-0">
                        Under guide review
                      </span>
                    ) : (
                      <button
                        onClick={() => handleOpenComplete(task)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#D93F3B] text-white text-xs font-semibold hover:opacity-90 whitespace-nowrap shrink-0 transition-opacity"
                      >
                        Mark as done
                      </button>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-sm text-[#111111] leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {/* Previous reviewer remark if sent back */}
                  {task.reviewerNote && !isAwaitingReview && (
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-[#111111] space-y-1">
                      <span className="font-semibold text-amber-800 block text-[11px]">
                        Feedback from guide (sent back for revision):
                      </span>
                      <p className="leading-relaxed">{task.reviewerNote}</p>
                    </div>
                  )}

                  {/* Guide attachment if any */}
                  {task.attachmentFileId && (
                    <div className="pt-1">
                      <a
                        href={getDownloadUrl(task.attachmentFileId)}
                        download
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-xs font-medium text-[#111111] hover:bg-gray-100 transition-colors shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span>Download resource ({task.attachmentFileName || 'File'})</span>
                      </a>
                    </div>
                  )}

                  {/* If awaiting review, show the submitted note/file in read-only view */}
                  {isAwaitingReview && (task.submissionNote || task.submissionFileId) && (
                    <div className="mt-2 p-3 rounded-xl bg-white border border-gray-200/60 text-xs space-y-1.5">
                      <span className="font-semibold text-[#6B7280] block text-[11px]">
                        Your submitted work:
                      </span>
                      {task.submissionNote && (
                        <p className="text-[#111111] leading-relaxed">{task.submissionNote}</p>
                      )}
                      {task.submissionFileId && (
                        <div className="pt-1">
                          <a
                            href={getDownloadUrl(task.submissionFileId)}
                            download
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F3F4F6] text-xs font-medium text-[#111111] hover:bg-gray-200"
                          >
                            <Download className="w-3 h-3 text-[#6B7280]" />
                            <span>Download submission ({task.submissionFileName || 'File'})</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Completed Tasks (Compressed by default, collapsible details) */}
      {activeTab === 'completed' && (
        <div className="space-y-2.5">
          {completedTasks.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
              No completed tasks recorded yet.
            </div>
          ) : (
            completedTasks.map((task) => {
              const isExpanded = !!expandedCompletedTasks[task.id];
              const hasDetails = !!(task.description || task.submissionNote || task.submissionFileId || task.attachmentFileId);

              return (
                <div
                  key={task.id}
                  className="rounded-2xl bg-[#F3F4F6] overflow-hidden transition-all"
                >
                  {/* Compressed Header Row */}
                  <div
                    onClick={() => hasDetails && toggleTaskExpanded(task.id)}
                    className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 ${
                      hasDetails ? 'cursor-pointer hover:bg-gray-200/60 transition-colors' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm sm:text-base text-[#111111] truncate">
                          {task.title}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EF4B47]/10 text-[#EF4B47] text-[11px] font-semibold shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[#6B7280] mt-0.5">
                        <Calendar className="w-3 h-3 text-[#6B7280]" />
                        <span>Completed on due date: {task.dueDate}</span>
                      </div>
                    </div>

                    {hasDetails && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskExpanded(task.id);
                        }}
                        className="p-1 rounded-lg text-[#6B7280] hover:text-[#111111] hover:bg-white transition-all shrink-0"
                        title={isExpanded ? 'Collapse Details' : 'Expand Details'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expandable Submission Details & File Attachments */}
                  {isExpanded && hasDetails && (
                    <div className="px-3.5 sm:px-4 pb-4 pt-1 border-t border-gray-200/60 space-y-3">
                      {task.description && (
                        <div>
                          <span className="text-[11px] font-semibold text-[#6B7280] block mb-0.5">
                            Task Instructions:
                          </span>
                          <p className="text-xs text-[#111111] leading-relaxed">
                            {task.description}
                          </p>
                        </div>
                      )}

                      {task.attachmentFileId && (
                        <div>
                          <span className="text-[11px] font-semibold text-[#6B7280] block mb-1">
                            Guide Resource:
                          </span>
                          <a
                            href={getDownloadUrl(task.attachmentFileId)}
                            download
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-xs font-medium text-[#111111] hover:bg-gray-100 shadow-2xs"
                          >
                            <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span>Download ({task.attachmentFileName || 'Attachment'})</span>
                          </a>
                        </div>
                      )}

                      {task.submissionNote && (
                        <div className="p-3 rounded-xl bg-white text-xs text-[#111111] shadow-2xs">
                          <span className="font-semibold text-[#6B7280] block text-[11px] mb-1">
                            Your Submission Note:
                          </span>
                          <p className="leading-relaxed">{task.submissionNote}</p>
                        </div>
                      )}

                      {task.submissionFileId && (
                        <div>
                          <span className="text-[11px] font-semibold text-[#6B7280] block mb-1">
                            Your Submitted File:
                          </span>
                          <a
                            href={getDownloadUrl(task.submissionFileId)}
                            download
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-xs font-medium text-[#111111] hover:bg-gray-100 shadow-2xs"
                          >
                            <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span>Download ({task.submissionFileName || 'File'})</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Complete Task Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  Mark as done
                </h3>
                <p className="text-xs text-[#6B7280] truncate max-w-xs">
                  {selectedTask.title}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitComplete} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              <p className="text-xs text-[#6B7280]">
                Add optional notes or attachments. Once submitted, your guide or admin will review and complete the task.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Submission note (optional)
                </label>
                <textarea
                  value={submissionNote}
                  onChange={(e) => setSubmissionNote(e.target.value)}
                  placeholder="Summary of what was prepared or practiced..."
                  rows={3}
                  className="w-full p-3 rounded-xl bg-[#F3F4F6] text-xs sm:text-sm text-[#111111] border-0 focus:outline-[#D93F3B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Attach work file (optional: audio, notes, PDF, image)
                </label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#6B7280] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#111111] file:text-white hover:file:bg-black"
                />
              </div>

              {error && (
                <p className="text-xs text-[#D93F3B] font-medium">{error}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#D93F3B] text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit for review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
