import React, { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';

interface RemindSheetProps {
  isOpen: boolean;
  studentName: string;
  studentId: string;
  programId: string;
  programName?: string;
  onClose: () => void;
  onSend: (message: string, programId: string) => Promise<void>;
}

export const RemindSheet: React.FC<RemindSheetProps> = ({
  isOpen,
  studentName,
  studentId,
  programId,
  programName,
  onClose,
  onSend,
}) => {
  const [selectedQuick, setSelectedQuick] = useState<'meet' | 'task' | null>('meet');
  const [customText, setCustomText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickChoice1 = 'Come and meet me';
  const quickChoice2 = 'Finish your task';

  const handleSend = async () => {
    setError(null);
    setIsSending(true);

    let messageToSend = '';
    if (selectedQuick === 'meet') {
      messageToSend = quickChoice1;
    } else if (selectedQuick === 'task') {
      messageToSend = quickChoice2;
    }

    if (customText.trim()) {
      if (messageToSend) {
        messageToSend = `${messageToSend} - ${customText.trim()}`;
      } else {
        messageToSend = customText.trim();
      }
    }

    if (!messageToSend) {
      setError('Please choose a reminder option or write a note.');
      setIsSending(false);
      return;
    }

    try {
      await onSend(messageToSend, programId);
      setCustomText('');
      setSelectedQuick('meet');
      onClose();
    } catch (err: any) {
      console.error('[RemindSheet] error:', err);
      setError(err?.message || "Couldn't send reminder. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={isSending ? undefined : onClose} />

      <div className="relative w-full max-w-lg mx-auto bg-white rounded-t-3xl border-t border-[#E5E7EB] p-5 sm:p-6 space-y-4 z-10 animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between pb-1 border-b border-[#F3F4F6]">
          <div>
            <h3 className="font-bold text-base text-[#111111]">
              Remind {studentName}
            </h3>
            <p className="text-[13px] text-[#6B7280]">
              {programName ? `Section: ${programName}` : 'Send an instant reminder'}
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

        <div className="space-y-2">
          <label className="block text-xs font-semibold text-[#111111]">
            Quick choice
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedQuick(selectedQuick === 'meet' ? null : 'meet')}
              className={`p-3 rounded-xl text-xs font-semibold border text-center transition-colors ${
                selectedQuick === 'meet'
                  ? 'border-[#D4202C] bg-red-50 text-[#D4202C]'
                  : 'border-[#E5E7EB] bg-white text-[#111111] hover:bg-gray-50'
              }`}
            >
              Come and meet me
            </button>
            <button
              type="button"
              onClick={() => setSelectedQuick(selectedQuick === 'task' ? null : 'task')}
              className={`p-3 rounded-xl text-xs font-semibold border text-center transition-colors ${
                selectedQuick === 'task'
                  ? 'border-[#D4202C] bg-red-50 text-[#D4202C]'
                  : 'border-[#E5E7EB] bg-white text-[#111111] hover:bg-gray-50'
              }`}
            >
              Finish your task
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-[#111111]">
              Optional note (max 500 characters)
            </label>
            <span className="text-[11px] text-[#6B7280]">
              {customText.length}/500
            </span>
          </div>
          <textarea
            rows={3}
            maxLength={500}
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Add any specific instruction..."
            className="w-full p-3 rounded-xl bg-[#F3F4F6] text-xs font-medium text-[#111111] placeholder:text-[#6B7280] border-0 focus:ring-2 focus:ring-[#D4202C] resize-none"
          />
        </div>

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
            type="button"
            onClick={handleSend}
            disabled={isSending || (!selectedQuick && !customText.trim())}
            className="h-10 px-5 rounded-xl bg-[#D4202C] hover:bg-[#B81B26] disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSending ? 'Sending...' : 'Send reminder'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
