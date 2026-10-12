import React from 'react';
import { StudentDashboardData, TaskRecord } from '../../types';
import { Check, Flame } from 'lucide-react';

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
  const { student, streak, totalPoints, rank, totalStudents, todayRecord, pendingTasks } = data;

  const isPresent = todayRecord.status === 'present';

  return (
    <div className="space-y-6 pb-20">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
          Assalamu Alaikum, {student.fullName}
        </h2>
      </div>

      {/* Exactly three numbers: Streak, Total Points, Rank */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* Streak */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] text-center flex flex-col justify-between">
          <div className="text-[11px] sm:text-xs font-semibold text-[#6B7280]">Streak</div>
          <div className="my-1 sm:my-1.5 flex items-center justify-center gap-1">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-[#EF4B47]" />
            <span className="text-2xl sm:text-3xl font-extrabold text-[#EF4B47]">
              {streak}
            </span>
          </div>
          <div className="text-[11px] sm:text-xs text-[#6B7280]">
            {streak === 1 ? 'Day' : 'Days'}
          </div>
        </div>

        {/* Total Points */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] text-center flex flex-col justify-between">
          <div className="text-[11px] sm:text-xs font-semibold text-[#6B7280]">Points</div>
          <div className="my-1 sm:my-1.5 text-2xl sm:text-3xl font-extrabold text-[#111111]">
            {totalPoints}
          </div>
          <div className="text-[11px] sm:text-xs text-[#6B7280]">Total Earned</div>
        </div>

        {/* Rank */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#F3F4F6] text-center flex flex-col justify-between">
          <div className="text-[11px] sm:text-xs font-semibold text-[#6B7280]">Rank</div>
          <div className="my-1 sm:my-1.5 text-2xl sm:text-3xl font-extrabold text-[#111111]">
            #{rank}
          </div>
          <div className="text-[11px] sm:text-xs text-[#6B7280]">Of {totalStudents}</div>
        </div>
      </div>

      {/* Today's status */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-bold tracking-wider text-[#6B7280]">
            Today's Status
          </span>
          <span className="text-xs text-[#6B7280] font-medium">{todayRecord.date}</span>
        </div>

        <div className="flex items-center gap-3">
          {!todayRecord.isMarked && !todayRecord.id ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#6B7280] font-semibold text-xs sm:text-sm">
              <span className="font-bold text-base leading-none">•</span>
              Not marked yet
            </span>
          ) : isPresent ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EF4B47] text-white font-semibold text-xs sm:text-sm">
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
              Present
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#6B7280] font-semibold text-xs sm:text-sm">
              <span className="font-bold text-base leading-none">-</span>
              Absent
            </span>
          )}

          {/* Points score once scored */}
          {!todayRecord.isMarked && !todayRecord.id ? null : isPresent ? (
            todayRecord.points !== null ? (
              <span className="text-xs sm:text-sm font-bold text-[#111111]">
                {todayRecord.points} Points ({todayRecord.level})
              </span>
            ) : (
              <span className="text-xs sm:text-sm text-[#6B7280] font-medium">
                Not Scored Yet
              </span>
            )
          ) : (
            <span className="text-xs sm:text-sm text-[#6B7280]">0 Points</span>
          )}
        </div>

        {todayRecord.note && (
          <p className="text-xs text-[#111111] bg-white p-2.5 rounded-xl">
            <span className="font-semibold text-[#6B7280] block text-[11px] mb-0.5">
              Guide Note:
            </span>
            {todayRecord.note}
          </p>
        )}
      </div>

      {/* Tasks Due */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#111111]">Tasks Due</h3>
          <button
            onClick={() => onNavigateToTab('tasks')}
            className="text-xs text-[#EF4B47] font-semibold hover:underline"
          >
            View All ({pendingTasks.length})
          </button>
        </div>

        {pendingTasks.length === 0 ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] text-center text-xs sm:text-sm text-[#6B7280]">
            No pending tasks. Keep preparing!
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
                    Due Date: <span className="text-[#111111] font-medium">{task.dueDate}</span>
                  </div>
                </div>

                {task.status === 'awaiting_review' ? (
                  <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold whitespace-nowrap shrink-0">
                    Awaiting review
                  </span>
                ) : (
                  <button
                    onClick={() => onOpenTaskModal(task)}
                    className="px-3 py-1.5 rounded-xl bg-[#D93F3B] text-white text-xs font-semibold hover:opacity-90 whitespace-nowrap shrink-0 transition-opacity"
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
              Nightly Screen-Time Verification
            </div>
            <div className="text-[11px] sm:text-xs text-[#6B7280] mt-0.5 truncate">
              Upload your screen time screenshot for today
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('progress')}
            className="px-3 py-1.5 rounded-xl bg-[#EF4B47] text-white text-xs font-semibold hover:opacity-90 whitespace-nowrap shrink-0"
          >
            Upload
          </button>
        </div>
      )}
    </div>
  );
};
