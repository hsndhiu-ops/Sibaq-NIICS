import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { Bell, MessageSquare, Send, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { RemindSheet } from './RemindSheet';
import { Pentagon } from '../brand/Decorations';

interface MenteeStudent {
  id: string;
  fullName: string;
  username: string;
  daysPresent: number;
  averageLevel: string | null;
  lastNote: string | null;
  remarks: Array<{
    id: string;
    guideId: string;
    studentId: string;
    programId: string;
    body: string;
    createdAt: string;
  }>;
}

interface MenteeProgramGroup {
  programId: string;
  programName: string;
  kind: 'solo' | 'group';
  description: string | null;
  students: MenteeStudent[];
}

interface GuideMenteesProps {
  onNotify: (msg: string) => void;
}

export const GuideMentees: React.FC<GuideMenteesProps> = ({ onNotify }) => {
  const [programs, setPrograms] = useState<MenteeProgramGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Remind Sheet state & 60s cooldown map: key is `${studentId}-${programId}`
  const [remindSheetTarget, setRemindSheetTarget] = useState<{
    studentId: string;
    studentName: string;
    programId: string;
    programName: string;
  } | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [, setNow] = useState(Date.now());

  // In-line Remark state per (student, program)
  const [activeRemarkKey, setActiveRemarkKey] = useState<string | null>(null); // `${studentId}-${programId}`
  const [remarkText, setRemarkText] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);
  const [remarkError, setRemarkError] = useState<string | null>(null);

  // Collapsible programs
  const [collapsedPrograms, setCollapsedPrograms] = useState<Record<string, boolean>>({});

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
      setPrograms(res.programs || []);
    } catch (err: any) {
      console.error('[getGuideMentees] error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCooldownRemaining = (key: string): number => {
    const expireTime = cooldowns[key];
    if (!expireTime) return 0;
    const diff = Math.ceil((expireTime - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  };

  const handleSendReminder = async (message: string, programId: string) => {
    if (!remindSheetTarget) return;
    const key = `${remindSheetTarget.studentId}-${programId}`;
    try {
      const res = await api.sendReminder(remindSheetTarget.studentId, message, programId);
      setCooldowns((prev) => ({
        ...prev,
        [key]: Date.now() + 60000,
      }));
      onNotify(res.message);
    } catch (err: any) {
      console.error('[sendReminder] error:', err);
      throw err;
    }
  };

  const handleSaveRemark = async (studentId: string, programId: string) => {
    if (!remarkText.trim()) return;
    setSavingRemark(true);
    setRemarkError(null);
    try {
      const res = await api.addRemark({
        studentId,
        programId,
        body: remarkText.trim(),
      });
      setRemarkText('');
      setActiveRemarkKey(null);
      onNotify(res.message || 'Guidance remark saved.');
      await loadMentees();
    } catch (err: any) {
      console.error('[addRemark] error:', err);
      setRemarkError(err.message || "Couldn't save remark. Try again.");
    } finally {
      setSavingRemark(false);
    }
  };

  const toggleProgramCollapse = (progId: string) => {
    setCollapsedPrograms((prev) => ({
      ...prev,
      [progId]: !prev[progId],
    }));
  };

  const totalStudentsCount = programs.reduce(
    (acc, p) => acc + (p.students ? p.students.length : 0),
    0
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
          Mentees
        </h2>
        <p className="text-[13px] text-[#6B7280] mt-0.5">
          Student performance and remarks per program ({totalStudentsCount} {totalStudentsCount === 1 ? 'student' : 'students'})
        </p>
      </div>

      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-xs text-[#6B7280]">
          Loading mentees...
        </div>
      ) : programs.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-xs text-[#6B7280] flex flex-col items-center justify-center">
          <Pentagon size={64} className="mb-2" />
          <p>No programs assigned to guide yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {programs.map((prog) => {
            const isCollapsed = Boolean(collapsedPrograms[prog.programId]);
            const students = prog.students || [];

            return (
              <div
                key={prog.programId}
                className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs"
              >
                {/* Program Header */}
                <div
                  onClick={() => toggleProgramCollapse(prog.programId)}
                  className="p-4 sm:p-5 bg-[#FAFAFA] border-b border-[#E5E7EB] flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <h3 className="font-bold text-base text-[#111111]">
                      {prog.programName}
                    </h3>
                    <div className="text-xs text-[#6B7280] mt-0.5">
                      {prog.kind === 'solo' ? 'Solo' : 'Group'} • {students.length} {students.length === 1 ? 'student' : 'students'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6B7280]">
                      {isCollapsed ? 'Expand' : 'Collapse'}
                    </span>
                    {isCollapsed ? (
                      <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                    )}
                  </div>
                </div>

                {/* Students list inside this program */}
                {!isCollapsed && (
                  <div className="p-4 sm:p-5 space-y-4">
                    {students.length === 0 ? (
                      <p className="text-xs text-[#6B7280] italic">
                        No students enrolled in this program yet.
                      </p>
                    ) : (
                      students.map((student) => {
                        const key = `${student.id}-${prog.programId}`;
                        const cooldown = getCooldownRemaining(key);
                        const isAddingRemark = activeRemarkKey === key;
                        const remarks = student.remarks || [];

                        return (
                          <div
                            key={student.id}
                            className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-3"
                          >
                            {/* Student Row Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-bold text-sm text-[#111111]">
                                  {student.fullName}
                                </h4>
                                <div className="text-xs text-[#6B7280]">
                                  Roll: <span className="font-medium text-[#111111]">{student.username}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-start sm:self-center">
                                {/* Remind Bell Button with 60s cooldown */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRemindSheetTarget({
                                      studentId: student.id,
                                      studentName: student.fullName,
                                      programId: prog.programId,
                                      programName: prog.programName,
                                    })
                                  }
                                  disabled={cooldown > 0}
                                  title={
                                    cooldown > 0
                                      ? `Reminded. Wait ${cooldown}s`
                                      : `Send reminder to ${student.fullName}`
                                  }
                                  className="p-2 rounded-lg bg-white border border-[#E5E7EB] text-[#111111] hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
                                >
                                  <Bell className="w-3.5 h-3.5 text-[#D4202C]" />
                                  <span>{cooldown > 0 ? `${cooldown}s` : 'Remind'}</span>
                                </button>
                              </div>
                            </div>

                            {/* Performance in THIS Program only (Never total points, streak or rank!) */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                              <div className="p-2.5 rounded-lg bg-white border border-[#E5E7EB]">
                                <span className="text-[#6B7280] block text-[11px]">Days present</span>
                                <span className="font-bold text-[#111111] text-sm mt-0.5 block">
                                  {student.daysPresent}
                                </span>
                              </div>

                              <div className="p-2.5 rounded-lg bg-white border border-[#E5E7EB]">
                                <span className="text-[#6B7280] block text-[11px]">Average level</span>
                                <span className="font-bold text-[#111111] text-sm mt-0.5 block">
                                  {student.averageLevel || '—'}
                                </span>
                              </div>

                              <div className="col-span-2 sm:col-span-1 p-2.5 rounded-lg bg-white border border-[#E5E7EB]">
                                <span className="text-[#6B7280] block text-[11px]">Last note</span>
                                <span className="text-[#111111] font-medium text-xs mt-0.5 block truncate">
                                  {student.lastNote || 'None'}
                                </span>
                              </div>
                            </div>

                            {/* Remarks Section inside this program */}
                            <div className="pt-2 border-t border-[#E5E7EB] space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-[#6B7280]">
                                  Remarks in {prog.programName} ({remarks.length})
                                </span>
                                {!isAddingRemark && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveRemarkKey(key);
                                      setRemarkText('');
                                      setRemarkError(null);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <MessageSquare className="w-3 h-3 text-[#D4202C]" />
                                    <span>Add remark</span>
                                  </button>
                                )}
                              </div>

                              {/* In-line Remark form */}
                              {isAddingRemark && (
                                <div className="p-3 rounded-xl bg-white border border-[#E5E7EB] space-y-2">
                                  {remarkError && (
                                    <div className="flex items-center gap-1.5 text-xs text-[#D4202C]">
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                      <span>{remarkError}</span>
                                    </div>
                                  )}
                                  <textarea
                                    value={remarkText}
                                    onChange={(e) => setRemarkText(e.target.value)}
                                    rows={2}
                                    placeholder={`Write guidance remark for ${student.fullName} in ${prog.programName}...`}
                                    className="w-full p-2.5 rounded-lg bg-[#F3F4F6] text-xs text-[#111111] border border-transparent focus:border-[#D4202C] focus:outline-none resize-none"
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveRemarkKey(null);
                                        setRemarkText('');
                                      }}
                                      disabled={savingRemark}
                                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#6B7280] hover:text-[#111111]"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveRemark(student.id, prog.programId)}
                                      disabled={savingRemark || !remarkText.trim()}
                                      className="px-3.5 py-1.5 rounded-lg bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#B81B26] active:bg-[#B81B26] disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                    >
                                      <Send className="w-3 h-3" />
                                      <span>{savingRemark ? 'Saving...' : 'Save remark'}</span>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Remarks list */}
                              {remarks.length === 0 ? (
                                <p className="text-xs text-[#6B7280] italic">
                                  No remarks written for this program yet.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {remarks.map((r) => (
                                    <div
                                      key={r.id}
                                      className="p-2.5 rounded-lg bg-white border border-[#E5E7EB] text-xs space-y-1"
                                    >
                                      <div className="flex items-center justify-between text-[#6B7280] text-[11px]">
                                        <span>
                                          {new Date(r.createdAt).toLocaleDateString('en-GB', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                            timeZone: 'Asia/Kolkata',
                                          })}
                                        </span>
                                      </div>
                                      <p className="text-[#111111] leading-relaxed whitespace-pre-wrap">
                                        {r.body}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Remind Sheet */}
      {remindSheetTarget && (
        <RemindSheet
          isOpen={true}
          studentId={remindSheetTarget.studentId}
          studentName={remindSheetTarget.studentName}
          programId={remindSheetTarget.programId}
          programName={remindSheetTarget.programName}
          onClose={() => setRemindSheetTarget(null)}
          onSend={handleSendReminder}
        />
      )}
    </div>
  );
};
