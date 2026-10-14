import React, { useState, useEffect } from 'react';
import { AuditLogEntry } from '../../types';
import { api, getKolkataDateString } from '../../api';
import { FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import { Pentagon } from '../brand/Decorations';

export const AdminAuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminAuditLog();
      setLogs(res.logs);
    } catch (_err) {
      // Graceful error handling
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    setExportError(null);

    try {
      // 1. Fetch export data in browser from database
      const rows = await api.getAdminAttendanceExportData();

      if (!rows || rows.length === 0) {
        throw new Error('No attendance records found to export.');
      }

      // 2. Format rows with exact required columns: student, guide, date, status, level, points
      const exportRows = rows.map((r) => ({
        student: r.student,
        guide: r.guide,
        date: r.date,
        status: r.status,
        level: r.level || '',
        points: r.points ?? 0,
      }));

      // 3. Lazy-load SheetJS (xlsx) only when export button is pressed
      const XLSX = await import('xlsx');

      // 4. Build worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(exportRows, {
        header: ['student', 'guide', 'date', 'status', 'level', 'points'],
      });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

      // 5. Download file named "sibaq-attendance-YYYY-MM-DD.xlsx"
      const dateStr = getKolkataDateString();
      const fileName = `sibaq-attendance-${dateStr}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err: any) {
      setExportError(err?.message || 'Failed to load attendance export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
            Audit Log & Export
          </h2>
          <p className="text-[13px] text-[#6B7280]">
            Immutable record of admin modifications to historical attendance and Excel reporting
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="px-4 py-2.5 rounded-xl bg-[#111111] text-white text-xs font-semibold hover:bg-black flex items-center gap-1.5 shrink-0 disabled:opacity-50 transition-colors"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 text-[#D4202C] animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 text-[#D4202C]" />
          )}
          <span>{exporting ? 'Generating Excel...' : 'Export Excel (.xlsx)'}</span>
        </button>
      </div>

      {/* Export Plain Error Message */}
      {exportError && (
        <div
          className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] flex items-center gap-2.5 text-[#111111] text-xs font-medium leading-relaxed"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-[#D4202C]" />
          <div className="flex-1">
            <span>{exportError}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading audit entries...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280] flex flex-col items-center justify-center">
          <Pentagon size={64} className="mb-3" />
          <p>No administrative manual changes logged. Historical records are pristine.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-4 rounded-2xl bg-[#F3F4F6] space-y-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-[#111111]">
                    {log.actorName}
                  </span>{' '}
                  <span className="text-[#6B7280]">modified attendance for</span>{' '}
                  <span className="font-bold text-[#111111]">
                    {log.studentName}
                  </span>
                </div>
                <span className="text-[#6B7280] text-xs shrink-0">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>

              <div className="text-xs text-[#6B7280]">
                Target Date: <span className="font-semibold text-[#111111]">{log.date}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white space-y-1">
                <div className="text-[#6B7280]">
                  Previous: <span className="text-[#111111] font-mono">{log.oldValue}</span>
                </div>
                <div className="text-[#D4202C] font-semibold">
                  New: <span className="text-[#111111] font-mono">{log.newValue}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
