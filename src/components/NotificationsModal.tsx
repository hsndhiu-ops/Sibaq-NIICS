import React, { useState } from 'react';
import { AppNotification } from '../types';
import { X, User, BookOpen, Bell, BellRing, Smartphone, Check, Loader2 } from 'lucide-react';
import { Pentagon } from './brand/Decorations';
import { usePushNotifications } from '../hooks/usePushNotifications';

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
  const {
    isSupported,
    permission,
    isSubscribed,
    loading: pushLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    sendTest: sendTestPush,
  } = usePushNotifications();

  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  if (!isOpen) return null;

  const handleTestPush = async () => {
    setTesting(true);
    setTestStatus(null);
    try {
      const res = await sendTestPush();
      if (res.success) {
        setTestStatus('Test alert sent! Check your phone.');
      } else {
        setTestStatus(res.message || 'Failed to send test push.');
      }
    } catch {
      setTestStatus('Failed to send test push.');
    } finally {
      setTesting(false);
      setTimeout(() => setTestStatus(null), 4000);
    }
  };

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

        {/* Native Web Push Notification Banner */}
        {isSupported && (
          <div className="bg-[#FAF7F2] p-3.5 border-b border-[#E5E7EB] text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isSubscribed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-[#D4202C]'}`}>
                  {isSubscribed ? <Smartphone className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
                </div>
                <div>
                  <p className="font-bold text-[#111111]">
                    {isSubscribed ? 'Mobile Push Alerts Active' : 'Enable Mobile Push Alerts'}
                  </p>
                  <p className="text-[11px] text-[#6B7280]">
                    {isSubscribed
                      ? 'Alerts pop up on your device even when closed'
                      : 'Get WhatsApp-like alerts when backgrounded'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isSubscribed ? (
                  <>
                    <button
                      type="button"
                      onClick={handleTestPush}
                      disabled={testing}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-[#E5E7EB] text-[#111111] hover:bg-gray-50 font-semibold text-[11px] cursor-pointer flex items-center gap-1"
                      title="Send a sample push to this device"
                    >
                      {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                      <span>Test</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => unsubscribePush()}
                      disabled={pushLoading}
                      className="text-[11px] text-[#6B7280] hover:text-[#D4202C] px-1 cursor-pointer"
                    >
                      Turn off
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => subscribePush()}
                    disabled={pushLoading}
                    className="px-3 py-1.5 rounded-lg bg-[#D4202C] text-white hover:bg-red-700 font-bold text-[11px] cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    {pushLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    <span>Enable</span>
                  </button>
                )}
              </div>
            </div>

            {testStatus && (
              <p className="mt-1.5 text-[11px] font-medium text-[#D4202C]">{testStatus}</p>
            )}
            {permission === 'denied' && (
              <p className="mt-1.5 text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                Notifications are blocked in your browser. Tap site settings to allow notifications.
              </p>
            )}
          </div>
        )}

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
