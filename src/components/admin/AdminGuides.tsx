import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { Check, Bell, Flame } from 'lucide-react';
import { Pentagon } from '../brand/Decorations';

interface AdminGuidesProps {
  onSelectStudent: (studentId: string) => void;
  onNotify: (msg: string) => void;
}

export const AdminGuides: React.FC<AdminGuidesProps> = ({
  onSelectStudent,
  onNotify,
}) => {
  const [guides, setGuides] = useState<any[]>([]);
  const [date, setDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGuides();
  }, []);

  const loadGuides = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminGuides();
      setGuides(res.guides);
      setDate(res.date);
    } catch (_err) {
      // Graceful error handling
    } finally {
      setLoading(false);
    }
  };

  const handleRemind = async (guideId: string) => {
    try {
      const res = await api.remindGuide(guideId);
      onNotify(res.message);
    } catch (err: any) {
      alert(err.message || 'Failed to send reminder');
    }
  };

  if (loading) {
    return (
      <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
        Loading guides overview...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
          Guides
        </h2>
      </div>

      {guides.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280] flex flex-col items-center justify-center">
          <Pentagon size={64} className="mb-3" />
          <p>No guides configured yet. Create guide accounts in the Accounts tab.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {guides.map((g) => (
            <div
              key={g.id}
              className="p-5 rounded-2xl bg-[#F3F4F6] space-y-4"
            >
              {/* Guide header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base text-[#111111]">
                    {g.fullName}
                  </h3>
                  <div className="text-xs font-medium text-[#111111] mt-1">
                    Marked {g.markedCount} of {g.menteesCount} mentees today
                  </div>
                </div>

                {!g.allMarked && g.menteesCount > 0 ? (
                  <button
                    onClick={() => handleRemind(g.id)}
                    className="px-3 py-1.5 rounded-xl bg-white text-xs font-semibold text-[#111111] hover:bg-gray-100 flex items-center gap-1.5"
                  >
                    <Bell className="w-3.5 h-3.5 text-[#6B7280]" />
                    <span>Send reminder</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-white text-[#111111]">
                    <Check className="w-3.5 h-3.5 text-[#D4202C]" />
                    All marked
                  </span>
                )}
              </div>

              {/* Mentees list under this guide */}
              <div className="space-y-2 pt-1 border-t border-gray-200">
                <span className="text-xs font-semibold text-[#6B7280] block mb-2">
                  Assigned mentees ({g.mentees.length}):
                </span>
                {g.mentees.length === 0 ? (
                  <div className="text-xs text-[#6B7280] p-2 bg-white rounded-xl">
                    No students currently assigned to this guide.
                  </div>
                ) : (
                  g.mentees.map((m: any) => {
                    const isPresent = m.attendance?.status === 'present';
                    return (
                      <div
                        key={m.id}
                        onClick={() => onSelectStudent(m.id)}
                        className="p-3 rounded-xl bg-white flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-[#111111] truncate">
                            {m.fullName}
                          </div>
                          {m.programs.length > 0 && (
                            <div className="text-xs text-[#6B7280] truncate mt-0.5">
                              {m.programs.join(', ')}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isPresent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#D4202C] text-white text-xs font-semibold">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280] text-xs font-semibold">
                              <span>-</span>
                              Absent
                            </span>
                          )}

                          <div className="text-xs font-semibold text-[#111111] min-w-12 text-right">
                            {isPresent
                              ? m.attendance?.points !== null
                                ? `${m.attendance?.points} pts`
                                : 'Pending'
                              : '0 pts'}
                          </div>

                          <div className="flex items-center gap-0.5 text-xs text-[#111111] font-semibold bg-[#F3F4F6] px-2 py-0.5 rounded-lg">
                            <Flame className="w-3.5 h-3.5 text-[#D4202C]" />
                            <span>{m.streak}d</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
