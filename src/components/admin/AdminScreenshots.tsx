import React, { useState, useEffect } from 'react';
import { ScreenshotRecord } from '../../types';
import { api } from '../../api';
import {
  Trash2,
  Calendar,
  X,
  Eye,
  ExternalLink,
  Download,
  AlertCircle,
  Loader2,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
} from 'lucide-react';
import { Pentagon } from '../brand/Decorations';

interface AdminScreenshotsProps {
  onNotify: (msg: string) => void;
}

export const AdminScreenshots: React.FC<AdminScreenshotsProps> = ({ onNotify }) => {
  const [screenshots, setScreenshots] = useState<ScreenshotRecord[]>([]);
  const [date, setDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Viewing modal state
  const [selectedItem, setSelectedItem] = useState<ScreenshotRecord | null>(null);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    loadScreenshots(date || undefined);
  }, [date]);

  // When a screenshot is selected, resolve its URL robustly
  useEffect(() => {
    const raw = selectedItem?.fileId || selectedItem?.storagePath;
    if (!raw) {
      setResolvedImageUrl(null);
      setImageLoading(false);
      setImageError(false);
      setIsZoomed(false);
      return;
    }

    setImageLoading(true);
    setImageError(false);
    setIsZoomed(false);

    // If it is already a complete URL, use it directly
    if (
      raw.startsWith('http://') ||
      raw.startsWith('https://') ||
      raw.startsWith('data:') ||
      raw.startsWith('blob:')
    ) {
      setResolvedImageUrl(raw);
      setIsResolving(false);
      return;
    }

    // Otherwise resolve via signed URL with fallback to reliable server proxy
    let cancelled = false;
    setIsResolving(true);

    api
      .resolveScreenshotUrl(raw)
      .then((url) => {
        if (!cancelled) {
          setResolvedImageUrl(url || `/api/screenshot-image?path=${encodeURIComponent(raw)}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedImageUrl(`/api/screenshot-image?path=${encodeURIComponent(raw)}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsResolving(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedItem]);

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

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const handleDeleteScreenshot = async (item: ScreenshotRecord, e?: React.MouseEvent, force = false) => {
    if (e) e.stopPropagation();
    const rawPath = item.fileId || item.storagePath;

    // Fast action confirmation without blocking window.confirm (works in iframes & all devices)
    if (!force && confirmingDeleteId !== item.id) {
      setConfirmingDeleteId(item.id);
      setTimeout(() => {
        setConfirmingDeleteId((prev) => (prev === item.id ? null : prev));
      }, 4000);
      return;
    }

    setConfirmingDeleteId(null);
    setDeletingId(item.id);
    try {
      await api.deleteScreenshot(item.id, rawPath);
      // Remove from active list immediately
      setScreenshots((prev) => prev.filter((s) => s.id !== item.id));
      if (selectedItem?.id === item.id) {
        closeModal();
      }
      onNotify('Screenshot deleted successfully. Student may now resubmit.');
    } catch (err: any) {
      onNotify(err?.message || "Couldn't delete screenshot.");
    } finally {
      setDeletingId(null);
    }
  };

  const closeModal = () => {
    setSelectedItem(null);
    setResolvedImageUrl(null);
    setImageError(false);
    setIsZoomed(false);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
            Screen Time
          </h2>
          <p className="text-[13px] text-[#6B7280]">
            Nightly student screen-time screenshots
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
            title="Clean files older than 26 hours"
          >
            <Trash2 className="w-3.5 h-3.5 text-[#D4202C]" />
            <span>Purge &gt;26h</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] text-[#111111] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#D4202C] shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading screenshot submissions...
        </div>
      ) : screenshots.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280] flex flex-col items-center justify-center">
          <Pentagon size={64} className="mb-3" />
          <p>No screenshots recorded for {date}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {screenshots.map((item) => {
            const rawPath = item.fileId || item.storagePath;
            const isPurged = item.status === 'purged' || Boolean(item.fileDeletedAt) || !rawPath;
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
                      <p className="text-xs text-[#6B7280]">
                        Roll: {item.studentRoll || 'N/A'} • {item.date}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isPurged
                          ? 'bg-white text-[#6B7280]'
                          : 'bg-[#111111] text-white'
                      }`}
                    >
                      {isPurged ? 'File purged' : 'Active file'}
                    </span>
                  </div>

                  <div className="text-xs text-[#6B7280] mt-2">
                    Submitted: {new Date(item.submittedAt || item.uploadedAt || item.date).toLocaleTimeString()}
                  </div>
                </div>

                {!isPurged && rawPath ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="flex-1 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#D4202C]" />
                      <span>View screenshot</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteScreenshot(item, e)}
                      disabled={deletingId === item.id}
                      title={confirmingDeleteId === item.id ? "Click again to permanently delete" : "Delete screenshot"}
                      className={`px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all shrink-0 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                        confirmingDeleteId === item.id
                          ? 'bg-[#D4202C] text-white border-[#D4202C]'
                          : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:text-[#D4202C] hover:bg-red-50'
                      }`}
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4202C]" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>{confirmingDeleteId === item.id ? 'Confirm?' : 'Delete'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-[#6B7280] italic p-2 bg-white rounded-xl text-center">
                    Image file deleted per 26-hour privacy rule
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Enhanced Screenshot Viewer Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with full metadata and controls */}
            <div className="p-3.5 border-b border-[#F3F4F6] flex items-center justify-between gap-2 bg-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#111111] truncate">
                    {selectedItem.studentName || 'Student'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[#6B7280] font-medium">
                    Roll: {selectedItem.studentRoll || 'N/A'}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Screen Time Verification • {selectedItem.date} at{' '}
                  {new Date(selectedItem.submittedAt || selectedItem.uploadedAt || selectedItem.date).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {resolvedImageUrl && !imageError && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsZoomed(!isZoomed)}
                      className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors"
                      title={isZoomed ? 'Fit to screen' : 'Zoom in to inspect'}
                    >
                      {isZoomed ? (
                        <ZoomOut className="w-4 h-4" />
                      ) : (
                        <ZoomIn className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={resolvedImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors"
                      title="Open full image in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <a
                      href={resolvedImageUrl}
                      download={`screentime_${selectedItem.studentRoll || 'student'}_${selectedItem.date}.jpg`}
                      className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] transition-colors"
                      title="Download screenshot"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteScreenshot(selectedItem)}
                      disabled={deletingId === selectedItem.id}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        confirmingDeleteId === selectedItem.id
                          ? 'bg-[#D4202C] text-white border-[#D4202C]'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200'
                      }`}
                      title={confirmingDeleteId === selectedItem.id ? "Click again to delete permanently" : "Delete this screenshot"}
                    >
                      {deletingId === selectedItem.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>{confirmingDeleteId === selectedItem.id ? 'Confirm Delete?' : 'Delete'}</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 transition-colors ml-1"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Viewer area */}
            <div className="p-3 sm:p-4 flex-1 overflow-auto flex items-center justify-center bg-[#F9FAFB] min-h-[300px] relative">
              {/* Spinner while loading */}
              {(isResolving || imageLoading) && !imageError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#F9FAFB]/80 z-10">
                  <Loader2 className="w-6 h-6 animate-spin text-[#D4202C]" />
                  <span className="text-xs text-[#6B7280] font-medium">
                    Loading screenshot image...
                  </span>
                </div>
              )}

              {/* Error fallback state */}
              {imageError ? (
                <div className="p-6 max-w-sm text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#F3F4F6] text-[#D4202C] flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#111111]">
                      Unable to display screenshot
                    </h4>
                    <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">
                      The screenshot image could not be loaded. It may have been
                      purged after the 26-hour privacy window, or the storage
                      link needs renewal.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const raw = selectedItem?.fileId || selectedItem?.storagePath;
                        if (raw) {
                          setImageError(false);
                          setImageLoading(true);
                          api.resolveScreenshotUrl(raw).then((url) => {
                            setResolvedImageUrl(url || `/api/screenshot-image?path=${encodeURIComponent(raw)}`);
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-50"
                    >
                      Retry
                    </button>
                    {resolvedImageUrl && (
                      <a
                        href={resolvedImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-1.5 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-xs font-semibold text-white"
                      >
                        Open raw link
                      </a>
                    )}
                  </div>
                </div>
              ) : resolvedImageUrl ? (
                <img
                  src={resolvedImageUrl}
                  alt={`Screen time for ${selectedItem.studentName || 'Student'} on ${selectedItem.date}`}
                  onLoad={() => setImageLoading(false)}
                  onError={() => {
                    const raw = selectedItem?.fileId || selectedItem?.storagePath;
                    const proxyUrl = raw ? `/api/screenshot-image?path=${encodeURIComponent(raw)}` : '';
                    if (resolvedImageUrl && proxyUrl && resolvedImageUrl !== proxyUrl) {
                      setResolvedImageUrl(proxyUrl);
                    } else {
                      setImageLoading(false);
                      setImageError(true);
                    }
                  }}
                  onClick={() => setIsZoomed(!isZoomed)}
                  className={`rounded-xl object-contain shadow-sm transition-all select-none ${
                    isZoomed
                      ? 'max-h-none max-w-none w-auto cursor-zoom-out'
                      : 'max-h-[70vh] w-auto max-w-full cursor-zoom-in'
                  }`}
                />
              ) : null}
            </div>

            {/* Footer with tips */}
            <div className="px-4 py-2 border-t border-[#F3F4F6] bg-white flex items-center justify-between text-xs text-[#6B7280]">
              <span>Click image or zoom button to toggle full size inspection</span>
              <span>Daily verification</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
