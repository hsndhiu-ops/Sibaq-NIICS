import React from 'react';
import { StudentDashboardData, TaskRecord } from '../../types';
import { Check, Flame, Users } from 'lucide-react';
import { Pentagon } from '../brand/Decorations';

interface StudentHomeProps {
  data: StudentDashboardData;
  onOpenTaskModal: (task: TaskRecord) => void;
  onNavigateToTab: (tab: string) => void;
}

export const StudentHome: React.FC<StudentHomeProps> = ({
  data,
  onOpenTaskModal,
  onNavigateToTab,
}) => {
  const { student, streak, totalPoints, rank, totalStudents, todayPrograms, pendingTasks } = data;

  const streakText = streak === 1 ? '1 day' : `${streak} days`;
  const pointsFormatted = Number(totalPoints).toFixed(1);

  return (
    <div className="space-y-6 pb-20">
      {/* Greeting */}
      <div>
        <h1 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
          Assalamu Alaikum, {student.fullName}
        </h1>
      </div>

      {/* Exactly three numbers: Streak, Total Points, Rank */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* Streak */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] text-center flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#6B7280]">Streak</div>
          <div className="my-1 sm:my-1.5 flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4202C]" />
            <span className="text-2xl sm:text-3xl font-extrabold text-[#D4202C]">
              {streak}
            </span>
          </div>
          <div className="text-xs text-[#6B7280]">{streakText}</div>
        </div>

        {/* Total Points (formatted with one decimal) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] text-center flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#6B7280]">Points</div>
          <div className="my-1 sm:my-1.5 text-2xl sm:text-3xl font-extrabold text-[#111111]">
            {pointsFormatted}
          </div>
          <div className="text-xs text-[#6B7280]">
            {totalPoints === 1 ? '1.0 point' : `${pointsFormatted} points`}
          </div>
        </div>

        {/* Rank */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] text-center flex flex-col justify-between">
          <div className="text-xs font-semibold text-[#6B7280]">Rank</div>
          <div className="my-1 sm:my-1.5 text-2xl sm:text-3xl font-extrabold text-[#111111]">
            #{rank}
          </div>
          <div className="text-xs text-[#6B7280]">Of {totalStudents} students</div>
        </div>
      </div>

      {/* Today's status list of student's programs */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#6B7280]">
            Today's sessions
          </span>
          <span className="text-xs text-[#6B7280] font-medium">
            {new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              timeZone: 'Asia/Kolkata',
            })}
          </span>
        </div>

        {!todayPrograms || todayPrograms.length === 0 ? (
          <div className="p-4 rounded-xl bg-white text-center text-xs text-[#6B7280]">
            No competition programs enrolled yet.
          </div>
        ) : (
          <div className="space-y-2">
            {todayPrograms.map((p) => {
              const guideStr = (p.guideNames && p.guideNames.length > 0)
                ? p.guideNames.join(', ')
                : 'Guide not assigned';

              let statusText = 'Not marked yet';
              let badgeColor = 'bg-[#F3F4F6] text-[#6B7280]';

              if (p.status === 'present') {
                if (p.scoreLevel !== null && p.level) {
                  statusText = `Present · ${p.level} (${p.scoreLevel})`;
                  badgeColor = 'bg-[#D4202C] text-white';
                } else {
                  statusText = 'Present · Not scored yet';
                  badgeColor = 'bg-[#D4202C] text-white';
                }
              } else if (p.status === 'absent') {
                statusText = 'Absent';
                badgeColor = 'bg-[#E5E7EB] text-[#111111]';
              }

              return (
                <div
                  key={p.programId}
                  className="p-3.5 rounded-xl bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs border border-gray-100"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-[#111111]">
                      {p.programName}
                    </div>
                    <div className="text-xs text-[#6B7280] mt-0.5">
                      {guideStr}
                    </div>
                    {p.note && (
                      <p className="text-xs text-[#111111] bg-[#F9FAFB] p-2 rounded-lg mt-1.5 border border-gray-100">
                        <span className="text-[#6B7280] font-medium">Note: </span>
                        {p.note}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 self-start sm:self-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs ${badgeColor}`}
                    >
                      {p.status === 'present' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      <span>{statusText}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tasks Due */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#111111]">Tasks due</h3>
          <button
            onClick={() => onNavigateToTab('tasks')}
            className="text-xs text-[#D4202C] font-semibold hover:underline cursor-pointer"
          >
            View all ({pendingTasks.length})
          </button>
        </div>

        {pendingTasks.length === 0 ? (
          <div className="p-6 sm:p-8 rounded-2xl bg-[#F3F4F6] flex flex-col items-center justify-center text-center text-xs sm:text-sm text-[#6B7280]">
            <Pentagon size={64} className="mb-3" />
            <p>No pending tasks. Keep preparing!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingTasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] flex items-start justify-between gap-3"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[#111111] truncate">
                    {task.title}
                  </div>
                  {task.description && (
                    <p className="text-xs text-[#6B7280] line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="text-xs text-[#6B7280] pt-0.5">
                    {task.programName && (
                      <>
                        <span className="font-medium text-[#111111]">{task.programName}</span>
                        <span> • </span>
                      </>
                    )}
                    Due date: <span className="text-[#111111] font-medium">{task.dueDate}</span>
                  </div>
                </div>

                {task.status === 'submitted' ? (
                  <span className="px-2.5 py-1 rounded-xl bg-white text-[#111111] border border-gray-200 text-xs font-semibold whitespace-nowrap shrink-0">
                    Awaiting review
                  </span>
                ) : (
                  <button
                    onClick={() => onOpenTaskModal(task)}
                    className="px-3.5 py-2 rounded-[10px] bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#B81B26] active:bg-[#B81B26] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    Mark as done
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nightly screen time prompt banner if not uploaded today */}
      {!data.hasUploadedScreenshotToday && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#111111]">
              Nightly screen-time verification
            </div>
            <div className="text-[13px] text-[#6B7280] mt-0.5 truncate">
              Upload your screen time screenshot for today
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('progress')}
            className="px-3.5 py-2 rounded-[10px] bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#B81B26] active:bg-[#B81B26] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            Upload
          </button>
        </div>
      )}
    </div>
  );
};
