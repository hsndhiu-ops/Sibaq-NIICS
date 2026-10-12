import React, { useState, useEffect } from 'react';
import { AuditLogEntry } from '../../types';
import { api } from '../../api';
import { Download, FileSpreadsheet, Shield, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const AdminAuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminAuditLog();
      setLogs(res.logs);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';

      const res = await fetch('/api/admin/export-excel', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error(`Export request failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sibaq_master_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || '';
      window.location.href = `/api/admin/export-excel?token=${encodeURIComponent(token)}`;
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            Audit Log & Export
          </h2>
          <p className="text-xs text-[#6B7280]">
            Immutable record of admin modifications to historical attendance and Excel reporting
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={exporting}
          className="px-4 py-2 rounded-xl bg-[#111111] text-white text-xs font-semibold hover:bg-black flex items-center gap-1.5 shrink-0 disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 text-[#EF4B47] animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 text-[#EF4B47]" />
          )}
          <span>{exporting ? 'Generating Excel...' : 'Export Excel (.xlsx)'}</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading audit entries...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          No administrative manual changes logged. Historical records are pristine.
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
                <span className="text-[#6B7280] text-[11px] shrink-0">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>

              <div className="text-[11px] text-[#6B7280]">
                Target Date: <span className="font-semibold text-[#111111]">{log.date}</span>
              </div>

              <div className="p-2.5 rounded-xl bg-white space-y-1">
                <div className="text-[#6B7280]">
                  Previous: <span className="text-[#111111] font-mono">{log.oldValue}</span>
                </div>
                <div className="text-[#EF4B47] font-semibold">
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
