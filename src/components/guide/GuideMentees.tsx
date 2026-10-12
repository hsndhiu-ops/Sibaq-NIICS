import React, { useState, useEffect } from 'react';
import { Program, TaskRecord, User } from '../../types';
import { api } from '../../api';
import { Flame, Bell } from 'lucide-react';

interface GuideMenteeItem {
  student: User;
  programs: Program[];
  streak: number;
  totalPoints: number;
  tasks: TaskRecord[];
}

interface GuideMenteesProps {
  onNotify: (msg: string) => void;
}

export const GuideMentees: React.FC<GuideMenteesProps> = ({ onNotify }) => {
  const [mentees, setMentees] = useState<GuideMenteeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  useEffect(() => {
    loadMentees();
  }, []);

  const loadMentees = async () => {
    setLoading(true);
    try {
      const res = await api.getGuideMentees();
      setMentees(res.mentees);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (studentId: string, type: 'meet' | 'task') => {
    setRemindingId(`${studentId}-${type}`);
    try {
      const res = await api.remindStudent({ studentId, type });
      onNotify(res.message);
    } catch (err: any) {
      alert(err.message || 'Failed to send reminder');
    } finally {
      setRemindingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
          Assigned Mentees
        </h2>
        <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
          Candidate Profiles, Allocated Competition Items, and Engagement Tracking
        </p>
      </div>

      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading candidate profiles...
        </div>
      ) : mentees.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          No candidates currently assigned to you.
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {mentees.map(({ student, programs, streak, totalPoints }) => (
            <div
              key={student.id}
              className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-3.5 transition-all"
            >
              {/* Header: Student Name & Streak/Points + Reminder Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-base sm:text-lg text-[#111111] truncate">
                    {student.fullName}
                  </h3>

                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className="flex items-center gap-1 font-semibold text-[#111111]">
                      <Flame className="w-3.5 h-3.5 text-[#EF4B47]" />
                      {streak}d Streak
                    </span>
                    <span className="text-[#6B7280]">•</span>
                    <span className="font-semibold text-[#111111]">
                      {totalPoints} Total Points
                    </span>
                  </div>
                </div>

                {/* Reminder Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleSendReminder(student.id, 'meet')}
                    disabled={remindingId === `${student.id}-meet`}
                    className="px-3 py-1.5 rounded-xl bg-white text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center gap-1.5 shadow-2xs transition-colors"
                    title="Send in-app reminder to meet"
                  >
                    <Bell className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span>
                      {remindingId === `${student.id}-meet` ? 'Sending...' : 'Remind Meet'}
                    </span>
                  </button>

                  <button
                    onClick={() => handleSendReminder(student.id, 'task')}
                    disabled={remindingId === `${student.id}-task`}
                    className="px-3 py-1.5 rounded-xl bg-white text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center gap-1.5 shadow-2xs transition-colors"
                    title="Send in-app reminder to complete preparation task"
                  >
                    <Bell className="w-3.5 h-3.5 text-[#EF4B47]" />
                    <span>
                      {remindingId === `${student.id}-task` ? 'Sending...' : 'Remind Task'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Competition Programs Section */}
              <div className="pt-1 border-t border-gray-200/60">
                <span className="text-xs font-semibold text-[#6B7280] block mb-1.5">
                  Allocated Programs ({programs.length})
                </span>
                {programs.length === 0 ? (
                  <span className="text-xs text-[#9CA3AF] italic">No competition items allocated</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {programs.map((p) => (
                      <span
                        key={p.id}
                        className="px-2.5 py-1 rounded-lg bg-white text-xs font-medium text-[#111111] shadow-2xs"
                      >
                        {p.name} <span className="text-[#6B7280]">({p.category})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
