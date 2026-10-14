import React, { useState } from 'react';
import { X, Send, Clock, AlertCircle } from 'lucide-react';

interface RemindSheetProps {
  isOpen: boolean;
  studentName: string;
  studentId: string;
  onClose: () => void;
  onSend: (message: string) => Promise<void>;
}

export const RemindSheet: React.FC<RemindSheetProps> = ({
  isOpen,
  studentName,
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
      await onSend(messageToSend);
      setCustomText('');
      setSelectedQuick('meet');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to send reminder.');
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
              Send an instant notification to this student
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

        {/* Errors: dark text with small icon, never a red background */}
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
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-center transition-all ${
                selectedQuick === 'meet'
                  ? 'bg-[#D4202C] text-white'
                  : 'bg-[#F3F4F6] text-[#111111] hover:bg-gray-200'
              }`}
            >
              {quickChoice1}
            </button>
            <button
              type="button"
              onClick={() => setSelectedQuick(selectedQuick === 'task' ? null : 'task')}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-center transition-all ${
                selectedQuick === 'task'
                  ? 'bg-[#D4202C] text-white'
                  : 'bg-[#F3F4F6] text-[#111111] hover:bg-gray-200'
              }`}
            >
              {quickChoice2}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-[#111111]">
              Optional note
            </label>
            <span className="text-xs text-[#6B7280]">
              {customText.length}/500
            </span>
          </div>
          <textarea
            value={customText}
            maxLength={500}
            onChange={(e) => setCustomText(e.target.value)}
            rows={3}
            placeholder="Add an optional message (max 500 characters)..."
            className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] border border-transparent focus:border-[#D4202C] focus:outline-none placeholder-[#9CA3AF] resize-none"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="h-[48px] px-4 rounded-[10px] bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-[#F3F4F6]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="h-[48px] px-5 rounded-[10px] bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#B81B26] active:bg-[#B81B26] disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {isSending ? (
              <>
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
