import React from 'react';
import { AppNotification } from '../types';
import { X, User, BookOpen } from 'lucide-react';
import { Pentagon } from './brand/Decorations';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
}) => {
  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const time = d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata',
      });
      const date = d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
      return `${time} · ${date}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col border border-[#E5E7EB] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#F3F4F6] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#111111]">Notifications</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {notifications.length} message{notifications.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.read) && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs font-semibold text-[#D4202C] hover:underline px-2 py-1 cursor-pointer"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-[#6B7280] text-sm flex flex-col items-center justify-center">
              <Pentagon size={64} className="mb-3 text-[#6B7280]" />
              <p>No notifications yet.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 sm:p-4 rounded-xl transition-all space-y-1.5 ${
                  n.read
                    ? 'bg-[#F3F4F6] border border-gray-100'
                    : 'bg-white border-l-4 border-l-[#D4202C] border-y border-r border-[#E5E7EB] shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-[#111111] leading-snug">
                    {n.title}
                  </h4>
                  <span className="text-[11px] text-[#6B7280] whitespace-nowrap shrink-0">
                    {formatDate(n.createdAt)}
                  </span>
                </div>

                {/* Sender name and optional program tag */}
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#D4202C]">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span>From: {n.senderName || 'Admin'}</span>
                  </span>
                  {n.programName && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="inline-flex items-center gap-1 text-[#6B7280] font-medium">
                        <BookOpen className="w-3 h-3 text-gray-400 shrink-0" />
                        <span>{n.programName}</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Message body */}
                <p className="text-xs sm:text-sm text-[#4B5563] leading-relaxed whitespace-pre-wrap pt-0.5">
                  {n.message}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#F3F4F6] bg-white text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#F3F4F6] text-[#111111] font-semibold text-xs sm:text-sm hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
