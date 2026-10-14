import React, { useState, useEffect } from 'react';
import { User, Program, RemarkRecord, TaskRecord } from '../../types';
import { api } from '../../api';
import { Flame, Bell, MessageSquare, Send, AlertCircle } from 'lucide-react';
import { RemindSheet } from './RemindSheet';
import { Pentagon } from '../brand/Decorations';

export interface GuideMenteeItem {
  student: User;
  programs: Program[];
  streak: number;
  totalPoints: number;
  remarks: RemarkRecord[];
  tasks: TaskRecord[];
}

interface GuideMenteesProps {
  onNotify: (msg: string) => void;
}

export const GuideMentees: React.FC<GuideMenteesProps> = ({ onNotify }) => {
  const [mentees, setMentees] = useState<GuideMenteeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Remind Sheet state & 60s cooldown map
  const [remindSheetTarget, setRemindSheetTarget] = useState<{ id: string; name: string } | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [, setNow] = useState(Date.now());

  // In-line Remark state per student
  const [activeRemarkStudentId, setActiveRemarkStudentId] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);
  const [remarkError, setRemarkError] = useState<string | null>(null);

  useEffect(() => {
    loadMentees();
  }, []);

  // Timer tick for 60-second cooldown badges
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadMentees = async () => {
    setLoading(true);
    try {
      const res = await api.getGuideMentees();
      setMentees(res.mentees);
    } catch (_err) {
      // Graceful error handling
    } finally {
      setLoading(false);
    }
  };

  const getCooldownRemaining = (studentId: string): number => {
    const expireTime = cooldowns[studentId];
    if (!expireTime) return 0;
    const diff = Math.ceil((expireTime - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  };

  const handleSendReminder = async (message: string) => {
    if (!remindSheetTarget) return;
    const targetId = remindSheetTarget.id;
    const res = await api.remindStudent({
      studentId: targetId,
      message,
    });
    setCooldowns((prev) => ({
      ...prev,
      [targetId]: Date.now() + 60000,
    }));
    onNotify(res.message);
  };

  const handleSaveRemark = async (studentId: string) => {
    if (!remarkText.trim()) return;
    setSavingRemark(true);
    setRemarkError(null);
    try {
      await api.createGuideRemark({
        studentId,
        content: remarkText.trim(),
      });
      setRemarkText('');
      setActiveRemarkStudentId(null);
      onNotify('Remark logged successfully.');
      await loadMentees();
    } catch (err: any) {
      setRemarkError(err.message || 'Failed to save remark.');
    } finally {
      setSavingRemark(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
          Assigned mentees
        </h2>
        <p className="text-[13px] text-[#6B7280] mt-0.5">
          Student profiles, competition programs, guidance remarks, and progress
        </p>
      </div>

      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading student profiles...
        </div>
      ) : mentees.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280] flex flex-col items-center justify-center">
          <Pentagon size={64} className="mb-2" />
          <p>No students currently assigned to you.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mentees.map(({ student, programs, streak, totalPoints, remarks }) => {
            const remainingCooldown = getCooldownRemaining(student.id);
            const isRemindDisabled = remainingCooldown > 0;
            const streakText = streak === 1 ? '1 day streak' : `${streak} days streak`;
            const pointsText = totalPoints === 1 ? '1 point' : `${totalPoints} points`;
            const isAddingRemark = activeRemarkStudentId === student.id;

            return (
              <div
                key={student.id}
                className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-4 transition-all"
              >
                {/* Header: Student Name & Streak/Points + Reminder Button */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-base sm:text-lg text-[#111111] truncate">
                      {student.fullName}
                    </h3>

                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className="flex items-center gap-1 font-semibold text-[#111111]">
                        <Flame className="w-3.5 h-3.5 text-[#D4202C]" />
                        {streakText}
                      </span>
                      <span className="text-[#6B7280]">•</span>
                      <span className="font-semibold text-[#111111]">
                        {pointsText}
                      </span>
                    </div>
                  </div>

                  {/* Remind Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setRemindSheetTarget({ id: student.id, name: student.fullName })}
                      disabled={isRemindDisabled}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                      title={isRemindDisabled ? `Wait ${remainingCooldown}s to remind again` : 'Send reminder'}
                    >
                      <Bell className="w-3.5 h-3.5 text-[#D4202C]" />
                      <span>
                        {isRemindDisabled ? `${remainingCooldown}s` : 'Remind'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Competition Programs Section */}
                <div className="pt-2 border-t border-gray-200">
                  <span className="text-xs font-semibold text-[#6B7280] block mb-1.5">
                    Programs ({programs.length})
                  </span>
                  {programs.length === 0 ? (
                    <span className="text-xs text-[#6B7280]">No program yet</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {programs.map((p: Program) => (
                        <span
                          key={p.id}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E7EB] text-xs font-medium text-[#111111]"
                        >
                          {p.name} <span className="text-[#6B7280]">({p.category || 'Stage'})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Remarks Section: List + Add Remark Box */}
                <div className="pt-2 border-t border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#6B7280]">
                      Remarks ({remarks.length})
                    </span>
                    {!isAddingRemark && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRemarkStudentId(student.id);
                          setRemarkText('');
                          setRemarkError(null);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center gap-1 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3 text-[#D4202C]" />
                        <span>Add remark</span>
                      </button>
                    )}
                  </div>

                  {/* Add Remark Form */}
                  {isAddingRemark && (
                    <div className="p-3 rounded-xl bg-white space-y-2 border border-gray-200">
                      {remarkError && (
                        <div className="flex items-center gap-1.5 text-xs text-[#111111]">
                          <AlertCircle className="w-3.5 h-3.5 text-[#D4202C] shrink-0" />
                          <span>{remarkError}</span>
                        </div>
                      )}
                      <textarea
                        value={remarkText}
                        onChange={(e) => setRemarkText(e.target.value)}
                        rows={2}
                        placeholder={`Write an observation or guidance remark for ${student.fullName}...`}
                        className="w-full p-2.5 rounded-lg bg-[#F3F4F6] text-xs text-[#111111] border border-transparent focus:border-[#D4202C] focus:outline-none resize-none placeholder-[#9CA3AF]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRemarkStudentId(null);
                            setRemarkText('');
                          }}
                          disabled={savingRemark}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#6B7280] hover:text-[#111111]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveRemark(student.id)}
                          disabled={savingRemark || !remarkText.trim()}
                          className="px-3.5 py-1.5 rounded-lg bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#B81B26] active:bg-[#B81B26] disabled:opacity-50 flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>{savingRemark ? 'Saving...' : 'Save remark'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Remarks List */}
                  {remarks.length === 0 ? (
                    <p className="text-xs text-[#6B7280]">No remarks recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {remarks.map((r: RemarkRecord) => (
                        <div
                          key={r.id}
                          className="p-3 rounded-xl bg-white border border-[#E5E7EB] text-xs text-[#111111] space-y-1"
                        >
                          <div className="flex items-center justify-between text-[#6B7280]">
                            <span className="font-semibold text-[#111111]">{r.guideName}</span>
                            <span>
                              {new Date(r.createdAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Remind Sheet */}
      {remindSheetTarget && (
        <RemindSheet
          isOpen={true}
          studentId={remindSheetTarget.id}
          studentName={remindSheetTarget.name}
          onClose={() => setRemindSheetTarget(null)}
          onSend={handleSendReminder}
        />
      )}
    </div>
  );
};
