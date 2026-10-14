import React, { useEffect, useState } from 'react';
import { LeaderboardEntry } from '../types';
import { api } from '../api';
import { Flame } from 'lucide-react';
import { Pentagon } from './brand/Decorations';

interface LeaderboardViewProps {
  currentStudentId?: string;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ currentStudentId }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await api.getLeaderboard();
      setEntries(res.leaderboard);
    } catch (err: any) {
      setError(err.message || "Couldn't load leaderboard. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
          Leaderboard
        </h2>
        <p className="text-xs text-[#6B7280]">
          Total preparation points and active streaks across all students
        </p>
      </div>

      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading rankings...
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-[#F3F4F6] text-xs text-[#111111]">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280] flex flex-col items-center justify-center">
          <Pentagon size={64} className="mb-3" />
          <p>No participants scored yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isMe = entry.studentId === currentStudentId;
            return (
              <div
                key={entry.studentId}
                className={`p-3.5 sm:p-4 rounded-2xl flex items-center justify-between gap-2.5 sm:gap-3 transition-colors ${
                  isMe
                    ? 'bg-[#F3F4F6] border-2 border-[#D4202C]'
                    : 'bg-[#F3F4F6]'
                }`}
              >
                {/* Rank & Student Name */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      entry.rank === 1
                        ? 'bg-[#D4202C] text-white'
                        : entry.rank === 2
                        ? 'bg-[#111111] text-white'
                        : entry.rank === 3
                        ? 'bg-white text-[#111111] border border-gray-200'
                        : 'bg-transparent text-[#6B7280]'
                    }`}
                  >
                    {entry.rank === 1 ? (
                      <span className="flex items-center justify-center font-extrabold text-xs">1</span>
                    ) : (
                      entry.rank
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-[#111111] truncate flex items-center gap-1.5">
                      <span className="truncate">{entry.fullName}</span>
                      {isMe && (
                        <span className="text-xs font-semibold text-[#D4202C] shrink-0">
                          (You)
                        </span>
                      )}
                    </div>
                    {entry.programs.length > 0 && (
                      <div className="text-xs sm:text-[13px] text-[#6B7280] truncate mt-0.5">
                        {entry.programs.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Score & Streak */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-right">
                  {/* Streak */}
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-xs font-semibold text-[#111111]">
                    <Flame className="w-3.5 h-3.5 text-[#D4202C]" />
                    <span>{entry.streak}d</span>
                  </div>

                  {/* Points */}
                  <div className="min-w-12 sm:min-w-14">
                    <span className="font-extrabold text-sm sm:text-base text-[#111111]">
                      {entry.totalPoints}
                    </span>
                    <span className="text-xs text-[#6B7280] ml-0.5">pts</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
