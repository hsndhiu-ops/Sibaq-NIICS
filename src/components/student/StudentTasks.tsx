import React, { useState } from 'react';
import { TaskRecord } from '../../types';
import { api } from '../../api';
import {
  Download,
  X,
  Calendar,
  Clock,
  Check,
} from 'lucide-react';
import { Pentagon } from '../brand/Decorations';

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

      await api.submitStudentTask(
        selectedTask.id,
        submissionNote || '',
        selectedFile || undefined
      );

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
        <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
          Tasks
        </h2>
        <p className="text-[13px] text-[#6B7280]">
          Preparation assignments and submissions allocated by your guide
        </p>
      </div>

      {/* Tabs: Active Tasks / Works Done */}
      <div className="flex bg-[#F3F4F6] p-1 rounded-xl max-w-xs">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'pending'
              ? 'bg-white text-[#111111]'
              : 'text-[#6B7280] hover:text-[#111111]'
          }`}
        >
          Tasks ({pendingTasks.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'completed'
              ? 'bg-white text-[#111111]'
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
            <div className="p-6 sm:p-8 rounded-2xl bg-[#F3F4F6] flex flex-col items-center justify-center text-center text-sm text-[#6B7280]">
              <Pentagon size={64} className="mb-3" />
              <p>No active tasks right now. Keep up the great preparation!</p>
            </div>
          ) : (
            pendingTasks.map((task) => {
              const isAwaitingReview = task.status === 'submitted';
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-[#111111] border border-gray-200 text-xs font-semibold shrink-0">
                            <Clock className="w-3 h-3 text-[#D4202C]" />
                            Awaiting review
                          </span>
                        )}
                        {!isAwaitingReview && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white text-[#6B7280] border border-gray-200 text-xs font-semibold shrink-0">
                            Assigned
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#6B7280] mt-1 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#D4202C]" />
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
                        className="px-3.5 py-1.5 rounded-[10px] bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#B81B26] active:bg-[#B81B26] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                      >
                        Mark as done
                      </button>
                    )}
                  </div>

                  {task.description && (
                    <p className="text-xs sm:text-sm text-[#111111] leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {/* Previous reviewer remark if sent back */}
                  {task.reviewerNote && !isAwaitingReview && (
                    <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs text-[#111111] space-y-1">
                      <span className="font-semibold text-[#111111] block text-xs">
                        Feedback from guide (sent back for revision):
                      </span>
                      <p className="leading-relaxed mt-0.5">{task.reviewerNote}</p>
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
                    <div className="mt-2 p-3 rounded-xl bg-white border border-gray-200 text-xs space-y-1.5">
                      <span className="font-semibold text-[#6B7280] block text-xs">
                        Your submitted work:
                      </span>
                      {task.submissionNote && (
                        <p className="text-[#111111] italic leading-relaxed whitespace-pre-wrap">
                          "{task.submissionNote}"
                        </p>
                      )}
                      {task.submissionFileId && (
                        <a
                          href={getDownloadUrl(task.submissionFileId)}
                          download
                          className="inline-flex items-center gap-1.5 text-xs text-[#D4202C] font-semibold hover:underline pt-0.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download your submitted file ({task.submissionFileName || 'File'})</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Completed Works Tab */}
      {activeTab === 'completed' && (
        <div className="space-y-3">
          {completedTasks.length === 0 ? (
            <div className="p-6 sm:p-8 rounded-2xl bg-[#F3F4F6] flex flex-col items-center justify-center text-center text-sm text-[#6B7280]">
              <Pentagon size={64} className="mb-3" />
              <p>No completed tasks recorded yet. Complete assigned tasks to track them here!</p>
            </div>
          ) : (
            completedTasks.map((task) => {
              const isExpanded = !!expandedCompletedTasks[task.id];
              const hasDetails = !!(
                task.description ||
                task.attachmentFileId ||
                task.submissionNote ||
                task.submissionFileId ||
                task.reviewerNote
              );

              return (
                <div
                  key={task.id}
                  className="rounded-2xl bg-[#F3F4F6] overflow-hidden transition-all space-y-0"
                >
                  <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-[#111111]">
                          {task.title}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white text-[#111111] border border-gray-200 text-xs font-semibold">
                          <Check className="w-3.5 h-3.5 text-[#D4202C] stroke-[3]" />
                          Completed
                        </span>
                      </div>
                      <div className="text-xs text-[#6B7280] mt-1">
                        Completed on {new Date(task.completedAt || task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>

                    {hasDetails && (
                      <button
                        onClick={() => toggleTaskExpanded(task.id)}
                        className="text-xs font-semibold text-[#111111] hover:underline shrink-0"
                      >
                        {isExpanded ? 'Hide details' : 'View details'}
                      </button>
                    )}
                  </div>

                  {/* Expandable Submission Details & File Attachments */}
                  {isExpanded && hasDetails && (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-200 space-y-3">
                      {task.description && (
                        <div>
                          <span className="text-xs font-semibold text-[#6B7280] block mb-0.5">
                            Task instructions:
                          </span>
                          <p className="text-xs sm:text-sm text-[#111111] leading-relaxed">
                            {task.description}
                          </p>
                        </div>
                      )}

                      {task.attachmentFileId && (
                        <div>
                          <span className="text-xs font-semibold text-[#6B7280] block mb-1">
                            Guide resource:
                          </span>
                          <a
                            href={getDownloadUrl(task.attachmentFileId)}
                            download
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] text-xs font-medium text-[#111111] hover:bg-gray-100"
                          >
                            <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span>Download ({task.attachmentFileName || 'Attachment'})</span>
                          </a>
                        </div>
                      )}

                      {task.submissionNote && (
                        <div className="p-3 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#111111]">
                          <span className="font-semibold text-[#6B7280] block text-xs mb-1">
                            Your submission note:
                          </span>
                          <p className="leading-relaxed">{task.submissionNote}</p>
                        </div>
                      )}

                      {task.submissionFileId && (
                        <div>
                          <span className="text-xs font-semibold text-[#6B7280] block mb-1">
                            Your submitted file:
                          </span>
                          <a
                            href={getDownloadUrl(task.submissionFileId)}
                            download
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] text-xs font-medium text-[#111111] hover:bg-gray-100"
                          >
                            <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span>Download ({task.submissionFileName || 'File'})</span>
                          </a>
                        </div>
                      )}

                      {task.reviewerNote && (
                        <div className="p-3 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#111111]">
                          <span className="font-semibold text-[#6B7280] block text-xs mb-1">
                            Guide review remarks:
                          </span>
                          <p className="leading-relaxed">{task.reviewerNote}</p>
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
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col border border-[#E5E7EB] overflow-hidden">
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
                  className="w-full p-3 rounded-xl bg-[#F3F4F6] text-xs sm:text-sm text-[#111111] border border-transparent focus:border-[#D4202C] focus:outline-none"
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
                <p className="text-xs text-[#D4202C] font-medium">{error}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-[10px] bg-[#D4202C] text-xs font-semibold text-white hover:bg-[#B81B26] active:bg-[#B81B26] disabled:opacity-50 transition-colors cursor-pointer"
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
