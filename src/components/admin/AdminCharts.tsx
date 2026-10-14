import React, { useState, useEffect } from 'react';
import { api } from '../../api';

export const AdminCharts: React.FC = () => {
  const [data, setData] = useState<{
    trend: { date: string; present: number; absent: number }[];
    streakDistribution: Record<string, number>;
    pointsDistribution: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCharts();
  }, []);

  const loadCharts = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminChartsData();
      setData(res);
    } catch (_err) {
      // Graceful error handling
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
        Loading Analytics Reports...
      </div>
    );
  }

  // Streamlined 7-day progression (most recent 7 days in chronological order)
  const recentTrend = data.trend.slice(-7);

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <div>
        <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
          Preparation Analytics
        </h2>
        <p className="text-[13px] text-[#6B7280] mt-0.5">
          Comprehensive Attendance Progression, Student Streaks, and Evaluation Distributions
        </p>
      </div>

      {/* 7-Day Attendance Progression */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-[#111111]">
              Seven-Day Attendance Progression
            </h3>
            <p className="text-[13px] text-[#6B7280]">
              Daily Attendance Ratios for the Past Week
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs self-start sm:self-auto">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D4202C]" />
              <span className="text-[#111111] font-semibold text-xs">Present</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB]" />
              <span className="text-[#6B7280] font-medium text-xs">Absent</span>
            </span>
          </div>
        </div>

        {/* Stacked Bar Progression List */}
        <div className="space-y-2.5 pt-1">
          {recentTrend.map((d) => {
            const total = d.present + d.absent || 1;
            const presentPct = (d.present / total) * 100;
            const absentPct = (d.absent / total) * 100;
            return (
              <div key={d.date} className="flex items-center gap-2 sm:gap-3 text-xs">
                <span className="w-14 sm:w-16 font-medium text-[#6B7280] text-xs shrink-0">
                  {d.date.slice(5)}
                </span>
                <div className="flex-1 h-5 sm:h-6 rounded-lg bg-[#E5E7EB] flex overflow-hidden">
                  <div
                    style={{ width: `${presentPct}%` }}
                    className="bg-[#D4202C] transition-all"
                  />
                  <div
                    style={{ width: `${absentPct}%` }}
                    className="bg-[#E5E7EB] transition-all"
                  />
                </div>
                <span className="w-14 sm:w-16 text-right font-bold text-[#111111] text-xs shrink-0">
                  {d.present} / {total}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Student Streak Distribution */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-4">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-[#111111]">
            Student Streak Distribution
          </h3>
          <p className="text-[13px] text-[#6B7280]">
            Consecutive Days of Active Preparation Across Students
          </p>
        </div>

        {/* Responsive Grid: 2 cols on small phones, 3 cols on medium, 5 cols on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5 pt-1">
          {Object.entries(data.streakDistribution).map(([bin, count]) => {
            // Show unit once: e.g. "0 Days" instead of "0 days Days"
            const label = bin.toLowerCase().includes('day')
              ? bin.replace(/days/i, 'Days')
              : `${bin} Days`;

            return (
              <div
                key={bin}
                className="p-3 rounded-xl bg-white text-center flex flex-col justify-between space-y-1"
              >
                <span className="text-xs font-semibold text-[#6B7280] block">
                  {label}
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-[#D4202C] block my-0.5">
                  {count}
                </span>
                <span className="text-xs text-[#6B7280] block">
                  {count === 1 ? 'Student' : 'Students'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preparation Points Distribution */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#F3F4F6] space-y-4">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-[#111111]">
            Preparation Points Distribution
          </h3>
          <p className="text-[13px] text-[#6B7280]">
            Accumulated Evaluation Marks Across All Daily Evaluations
          </p>
        </div>

        {/* Responsive Grid: 2 cols on small phones, 3 cols on medium, 5 cols on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5 pt-1">
          {Object.entries(data.pointsDistribution).map(([bin, count]) => {
            const label = bin.toLowerCase().includes('mark')
              ? bin
              : `${bin} Marks`;

            return (
              <div
                key={bin}
                className="p-3 rounded-xl bg-white text-center flex flex-col justify-between space-y-1"
              >
                <span className="text-xs font-semibold text-[#6B7280] block">
                  {label}
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-[#111111] block my-0.5">
                  {count}
                </span>
                <span className="text-xs text-[#6B7280] block">
                  {count === 1 ? 'Student' : 'Students'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
