import React, { useState } from 'react';
import { X, Send, AlertCircle, Users, Check } from 'lucide-react';
import { api } from '../../api';

interface GuideMessageSheetProps {
  isOpen: boolean;
  programId: string;
  programName: string;
  students: Array<{ id: string; name: string }>;
  initialRecipientIds?: string[];
  onClose: () => void;
  onSent: (msg: string) => void;
}

export const GuideMessageSheet: React.FC<GuideMessageSheetProps> = ({
  isOpen,
  programId,
  programName,
  students,
  initialRecipientIds,
  onClose,
  onSent,
}) => {
  const [targetMode, setTargetMode] = useState<'all' | 'pick'>(
    initialRecipientIds && initialRecipientIds.length > 0 && initialRecipientIds.length < students.length
      ? 'pick'
      : 'all'
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialRecipientIds && initialRecipientIds.length > 0
      ? initialRecipientIds
      : students.map((s) => s.id)
  );
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const recipientIds = targetMode === 'all' ? students.map((s) => s.id) : selectedIds;

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (recipientIds.length === 0) {
      setError('Please select at least one student.');
      return;
    }
    if (!message.trim()) {
      setError('Message cannot be empty.');
      return;
    }
    if (message.length > 500) {
      setError('Message cannot exceed 500 characters.');
      return;
    }

    setIsSending(true);
    try {
      const res = await api.sendNotification({
        recipients: recipientIds,
        title: title.trim(),
        message: message.trim(),
        programId,
      });
      onSent(res.message);
      onClose();
    } catch (err: any) {
      console.error('[GuideMessageSheet] send error:', err);
      setError(err?.message || "Couldn't send message. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={isSending ? undefined : onClose} />

      <div className="relative w-full max-w-lg mx-auto bg-white rounded-t-3xl border-t border-[#E5E7EB] p-5 sm:p-6 space-y-4 z-10 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
          <div>
            <h3 className="font-bold text-base text-[#111111]">
              Message · {programName}
            </h3>
            <p className="text-xs text-[#6B7280]">
              Send a notification to students of this program
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSending}
            className="p-1.5 rounded-xl text-[#6B7280] hover:text-[#111111] hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[#111111] text-xs font-medium py-1">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#D4202C]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          {/* Audience selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#111111]">
              Audience
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetMode('all')}
                className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition-colors ${
                  targetMode === 'all'
                    ? 'border-[#D4202C] bg-red-50 text-[#D4202C]'
                    : 'border-[#E5E7EB] bg-white text-[#111111] hover:bg-gray-50'
                }`}
              >
                All {students.length} students
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('pick')}
                className={`p-2.5 rounded-xl text-xs font-semibold border text-center transition-colors ${
                  targetMode === 'pick'
                    ? 'border-[#D4202C] bg-red-50 text-[#D4202C]'
                    : 'border-[#E5E7EB] bg-white text-[#111111] hover:bg-gray-50'
                }`}
              >
                Choose students ({selectedIds.length})
              </button>
            </div>

            {targetMode === 'pick' && (
              <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]">
                {students.map((s) => {
                  const isChecked = selectedIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white cursor-pointer text-xs text-[#111111]"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleStudent(s.id)}
                        className="w-4 h-4 rounded text-[#D4202C] focus:ring-[#D4202C] border-gray-300 accent-[#D4202C]"
                      />
                      <span>{s.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Optional Title */}
          <div>
            <label className="block text-xs font-semibold text-[#111111] mb-1">
              Title (optional, max 80)
            </label>
            <input
              type="text"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Rehearsal timing"
              className="w-full h-10 px-3 rounded-xl bg-[#F3F4F6] text-xs font-medium text-[#111111] placeholder:text-[#6B7280] border-0 focus:ring-2 focus:ring-[#D4202C]"
            />
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#111111]">
                Message (max 500)
              </label>
              <span className={`text-[11px] ${message.length > 500 ? 'text-[#D4202C] font-bold' : 'text-[#6B7280]'}`}>
                {message.length}/500
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message to students..."
              className="w-full p-3 rounded-xl bg-[#F3F4F6] text-xs font-medium text-[#111111] placeholder:text-[#6B7280] border-0 focus:ring-2 focus:ring-[#D4202C] resize-none"
            />
          </div>

          {/* Preview */}
          <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] text-xs text-[#6B7280] space-y-1">
            <span className="font-semibold text-[#111111] block text-[11px]">Preview:</span>
            <p className="italic text-[#111111]">
              Guide · {programName} · {title.trim() ? `${title.trim()} · ` : ''}{message.trim() || 'Your message text'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#6B7280] hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending || !message.trim() || recipientIds.length === 0}
              className="h-10 px-5 rounded-xl bg-[#D4202C] hover:bg-[#B81B26] disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending...' : `Send to ${recipientIds.length}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
