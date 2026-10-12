import React from 'react';
import { AppNotification } from '../types';
import { X, Check } from 'lucide-react';

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
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#111111]">Notifications</h2>
            <p className="text-xs text-[#6B7280]">
              {notifications.length} message{notifications.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.read) && (
              <button
                onClick={onMarkAllRead}
                className="text-xs font-semibold text-[#EF4B47] hover:underline px-2 py-1"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {notifications.length === 0 ? (
            <div className="text-center py-10 text-[#6B7280] text-sm">
              No notifications yet.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-xl transition-colors ${
                  n.read ? 'bg-[#F3F4F6]' : 'bg-[#F3F4F6] border-l-4 border-[#EF4B47]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-[#111111]">
                    {n.title}
                  </h4>
                  <span className="text-[11px] text-[#6B7280] whitespace-nowrap">
                    {formatDate(n.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  {n.message}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#F3F4F6] bg-white text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#F3F4F6] text-[#111111] font-medium text-sm hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
