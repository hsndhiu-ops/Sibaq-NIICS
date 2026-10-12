import React, { useState, useEffect } from 'react';
import { ScreenshotRecord } from '../../types';
import { api } from '../../api';
import { Trash2, Image, Calendar, X, Eye } from 'lucide-react';

interface AdminScreenshotsProps {
  onNotify: (msg: string) => void;
}

export const AdminScreenshots: React.FC<AdminScreenshotsProps> = ({ onNotify }) => {
  const [screenshots, setScreenshots] = useState<ScreenshotRecord[]>([]);
  const [date, setDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [viewingImageId, setViewingImageId] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadScreenshots(date || undefined);
  }, [date]);

  const loadScreenshots = async (selectedDate?: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.getAdminScreenshots(selectedDate);
      setScreenshots(res.screenshots);
      if (!date) setDate(res.date);
    } catch {
      setLoadError("Couldn't load screenshots. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualPurge = async () => {
    setPurging(true);
    try {
      const res = await api.purgeOldScreenshots();
      onNotify(res.message);
      loadScreenshots(date);
    } catch (err: any) {
      onNotify(err.message || 'Not available yet');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            Screen Time
          </h2>
          <p className="text-xs text-[#6B7280]">
            Nightly Student Screen-Time Screenshots
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] border-0"
          />
          <button
            onClick={handleManualPurge}
            disabled={purging}
            className="px-3 py-1.5 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] hover:bg-gray-200 flex items-center gap-1.5"
            title="Clean files older than 48 hours"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#EF4B47]" />
            <span>Purge &gt;48h</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5]/60 text-[#B91C1C] text-sm text-center">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading screenshot submissions...
        </div>
      ) : screenshots.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          No screenshots recorded for {date}.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {screenshots.map((item) => {
            const isPurged = item.status === 'purged' || !item.fileId;
            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-[#F3F4F6] space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#111111]">
                        {item.studentName || 'Student'}
                      </h4>
                      <p className="text-[11px] text-[#6B7280]">
                        Roll: {item.studentRoll || 'N/A'} • {item.date}
                      </p>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        isPurged
                          ? 'bg-white text-[#6B7280]'
                          : 'bg-[#111111] text-white'
                      }`}
                    >
                      {isPurged ? 'File purged' : 'Active file'}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#6B7280] mt-2">
                    Submitted: {new Date(item.submittedAt).toLocaleTimeString()}
                  </div>
                </div>

                {!isPurged && item.fileId ? (
                  <button
                    onClick={() => setViewingImageId(item.fileId)}
                    className="w-full py-2 rounded-xl bg-white text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#EF4B47]" />
                    <span>View screenshot</span>
                  </button>
                ) : (
                  <div className="text-[11px] text-[#6B7280] italic p-2 bg-white rounded-xl text-center">
                    Image file deleted per 48-hour privacy rule
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Screenshot Viewer Modal */}
      {viewingImageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-[#F3F4F6] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#111111]">
                Student Screen Time Screenshot
              </span>
              <button
                onClick={() => setViewingImageId(null)}
                className="p-1 rounded-lg bg-[#F3F4F6] text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-gray-50">
              <img
                src={`/api/files/download/${viewingImageId}`}
                alt="Screen time screenshot"
                className="max-h-[70vh] w-auto rounded-xl object-contain shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
