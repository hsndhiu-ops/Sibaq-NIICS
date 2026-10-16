import React, { useState } from 'react';
import { AttendanceRecord, RemarkRecord, Program, StudentProgramGuidesGroup, StudentAssignedGuide } from '../../types';
import { api } from '../../api';
import { Check, Clock, Users, Mail } from 'lucide-react';
import { Pentagon } from '../brand/Decorations';

interface StudentProgressProps {
  attendanceHistory: AttendanceRecord[];
  remarks: RemarkRecord[];
  programs: Program[];
  programGuides?: StudentProgramGuidesGroup[];
  allGuides?: StudentAssignedGuide[];
  hasUploadedScreenshotToday: boolean;
  onRefresh: () => void;
}

export const StudentProgress: React.FC<StudentProgressProps> = ({
  attendanceHistory,
  remarks,
  programs,
  programGuides = [],
  allGuides = [],
  hasUploadedScreenshotToday,
  onRefresh,
}) => {
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [screenshotSuccess, setScreenshotSuccess] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [submittedTime, setSubmittedTime] = useState<string | null>(null);

  // Resize and compress screenshot image to max 1280px wide
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 1280;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(file);
          }
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else resolve(file);
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => resolve(file);
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleUploadScreenshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotFile) return;

    setUploadingScreenshot(true);
    setScreenshotError(null);
    setScreenshotSuccess(null);

    try {
      const compressedBlob = await compressImage(screenshotFile);
      const compressedFile = new File([compressedBlob], screenshotFile.name, {
        type: 'image/jpeg',
      });

      const uploadRes = await api.uploadFile(compressedFile, 'screenshot');
      await api.uploadScreenshotRecord({
        fileId: uploadRes.fileId,
        fileName: uploadRes.originalName,
        fileSize: uploadRes.size,
      });

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSubmittedTime(timeStr);
      setScreenshotSuccess(`Screenshot submitted at ${timeStr}.`);
      setScreenshotFile(null);
      onRefresh();
    } catch (err: any) {
      const msg = err?.message || 'Failed to upload screenshot.';
      if (msg.includes('already')) {
        setScreenshotError("You already submitted today's screenshot.");
      } else {
        setScreenshotError(msg);
      }
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const isSubmittedToday = hasUploadedScreenshotToday || Boolean(submittedTime);

  // Last 7 days attendance progression for compact scan
  const recentAttendance = attendanceHistory.slice(0, 7);
  const presentDaysCount = attendanceHistory.filter((a) => a.status === 'present').length;

  return (
    <div className="space-y-5 sm:space-y-6 pb-20">
      <div>
        <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
          Progress
        </h2>
        <p className="text-[13px] text-[#6B7280]">
          Daily attendance records, guidance remarks, and allocated competition programs
        </p>
      </div>

      {/* Nightly Screen-Time Verification Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-4 h-4 text-[#D4202C] shrink-0" />
            <h3 className="font-bold text-sm sm:text-base text-[#111111] leading-tight">
              Nightly screen-time verification
            </h3>
          </div>
          {isSubmittedToday ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[#111111] border border-gray-200 text-xs font-semibold shrink-0">
              <Check className="w-3.5 h-3.5 text-[#D4202C] stroke-[3]" />
              Submitted {submittedTime ? `at ${submittedTime}` : 'today'}
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white text-[#6B7280] text-xs font-semibold shrink-0 border border-gray-200">
              Pending
            </span>
          )}
        </div>

        <p className="text-[13px] text-[#6B7280] leading-relaxed">
          Upload daily device screen-time verification. Admin review only; automatically purged after 48 hours.
        </p>

        {/* Hide file chooser for the rest of the day after successful upload */}
        {isSubmittedToday ? (
          <div className="p-3.5 rounded-xl bg-white text-xs text-[#111111] space-y-1">
            <p className="font-semibold">
              Today's screenshot is recorded.
            </p>
            <p className="text-[13px] text-[#6B7280]">
              You have already submitted your verification for today. The submission box will reopen tomorrow.
            </p>
          </div>
        ) : (
          <form onSubmit={handleUploadScreenshot} className="space-y-3 pt-1">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-[#6B7280] file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#111111] file:text-white hover:file:bg-black"
            />

            {screenshotError && (
              <p className="text-xs text-[#111111] font-medium">{screenshotError}</p>
            )}

            {screenshotSuccess && (
              <p className="text-xs text-[#111111] font-medium">{screenshotSuccess}</p>
            )}

            {screenshotFile && (
              <button
                type="submit"
                disabled={uploadingScreenshot}
                className="px-4 py-2 rounded-[10px] bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#B81B26] active:bg-[#B81B26] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {uploadingScreenshot ? 'Compressing & uploading...' : 'Upload screenshot'}
              </button>
            )}
          </form>
        )}
      </div>

      {/* Allocated Competition Programs */}
      <div className="space-y-3">
        <h3 className="font-bold text-base text-[#111111]">
          Competition programs ({programs.length})
        </h3>
        {programs.length === 0 ? (
          <div className="p-6 sm:p-8 rounded-2xl bg-[#F3F4F6] flex flex-col items-center justify-center text-center text-xs sm:text-sm text-[#6B7280]">
            <Pentagon size={64} className="mb-3" />
            <p>No competition programs allocated yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {programs.map((p) => {
              // Safely look up guides for this program across all possible representations
              const matchingNames: string[] = [];

              if (Array.isArray(p.guides)) {
                for (const g of p.guides as any[]) {
                  const name = g?.fullName || g?.name || g?.username;
                  if (name) matchingNames.push(name);
                }
              }

              if (Array.isArray(programGuides)) {
                for (const pg of programGuides as any[]) {
                  if (!pg) continue;
                  const pgId = pg.programId || pg.program_id || (pg.program && pg.program.id);
                  if (pgId === p.id) {
                    if (pg.guideName) matchingNames.push(pg.guideName);
                    else if (pg.guide_name) matchingNames.push(pg.guide_name);
                    else if (Array.isArray(pg.guides)) {
                      for (const g of pg.guides) {
                        const name = g?.fullName || g?.name || g?.username;
                        if (name) matchingNames.push(name);
                      }
                    }
                  }
                }
              }

              const guideNames = Array.from(new Set(matchingNames)).filter(Boolean).join(', ');

              return (
                <div
                  key={p.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] flex items-start justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-[#111111] truncate">{p.name}</div>
                    <div className="text-[13px] text-[#6B7280] mt-0.5 truncate capitalize">
                      {p.kind === 'solo'
                        ? 'Solo'
                        : `Group with ${Math.max(0, (p.memberCount || 1) - 1)} others`}
                    </div>
                    {guideNames.length > 0 ? (
                      <div className="text-xs text-[#D4202C] font-semibold mt-1.5 truncate">
                        Guide: {guideNames}
                      </div>
                    ) : (
                      <div className="text-xs text-[#9CA3AF] mt-1.5">
                        No guide assigned yet
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white text-[#111111] capitalize shrink-0">
                    {p.kind}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Guidance Remarks */}
      <div className="space-y-3">
        <h3 className="font-bold text-base text-[#111111]">
          Guidance remarks ({remarks.length})
        </h3>
        {remarks.length === 0 ? (
          <div className="p-6 sm:p-8 rounded-2xl bg-[#F3F4F6] flex flex-col items-center justify-center text-center text-xs sm:text-sm text-[#6B7280]">
            <Pentagon size={64} className="mb-3" />
            <p>No guidance remarks logged yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {remarks.map((r) => (
              <div key={r.id} className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#6B7280]">
                  <span className="font-bold text-[#111111]">{r.guideName}</span>
                  <span className="font-medium">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs sm:text-sm text-[#111111] leading-relaxed whitespace-pre-wrap">{r.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attendance History Progression */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-[#111111]">
            Attendance history ({attendanceHistory.length === 1 ? '1 day' : `${attendanceHistory.length} days`})
          </h3>
          <span className="text-[13px] text-[#6B7280] font-medium">
            {presentDaysCount} present / {attendanceHistory.length} total
          </span>
        </div>

        {/* 7-Day Progression Bar Overview */}
        {recentAttendance.length > 0 && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280]">
              <span>Recent 7-day progression</span>
              <span>{Math.round((recentAttendance.filter(a => a.status === 'present').length / recentAttendance.length) * 100)}% present</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 pt-1">
              {recentAttendance.slice().reverse().map((rec) => {
                const isPresent = rec.status === 'present';
                return (
                  <div key={rec.id || rec.date} className="text-center space-y-1">
                    <div
                      className={`h-7 rounded-lg flex items-center justify-center transition-all ${
                        isPresent
                          ? 'bg-[#D4202C] text-white font-bold'
                          : 'bg-[#E5E7EB] text-[#111111]'
                      }`}
                      title={`${rec.date}: ${isPresent ? 'Present' : 'Absent'}`}
                    >
                      {isPresent ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <span className="text-xs">-</span>}
                    </div>
                    <span className="block text-xs text-[#6B7280] truncate">
                      {rec.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detailed Daily Attendance Records */}
        {attendanceHistory.length === 0 ? (
          <div className="p-6 sm:p-8 rounded-2xl bg-[#F3F4F6] flex flex-col items-center justify-center text-center text-xs sm:text-sm text-[#6B7280]">
            <Pentagon size={64} className="mb-3" />
            <p>No attendance history recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attendanceHistory.map((rec) => {
              const isPresent = rec.status === 'present';
              const ptsText = rec.points === 1 ? '1 point' : `${rec.points ?? 0} points`;
              return (
                <div
                  key={rec.id || rec.date}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-[#111111]">{rec.date}</div>
                    {rec.note && (
                      <div className="text-xs text-[#6B7280] truncate">
                        Note: {rec.note}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {isPresent ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#D4202C] text-white text-xs font-semibold">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        Present
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E5E7EB] text-[#111111] text-xs font-semibold">
                        <span>-</span>
                        Absent
                      </span>
                    )}

                    <span className="text-xs sm:text-sm font-bold text-[#111111] min-w-16 text-right">
                      {isPresent
                        ? rec.points !== null
                          ? ptsText
                          : 'Not scored yet'
                        : '0 points'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
