import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { Program, User } from '../../types';
import { X, Send, AlertCircle, Check, Users, Search, CheckSquare, Square, Bell } from 'lucide-react';

interface AdminSendNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent: (msg: string) => void;
}

type AudienceType =
  | 'all_students'
  | 'all_guides'
  | 'everyone'
  | 'students_of_program'
  | 'guides_of_program'
  | 'pick_people';

export const AdminSendNotificationModal: React.FC<AdminSendNotificationModalProps> = ({
  isOpen,
  onClose,
  onSent,
}) => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<User[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [studentProgramsMap, setStudentProgramsMap] = useState<Map<string, any[]>>(new Map());
  const [guideProgramsMap, setGuideProgramsMap] = useState<Map<string, any[]>>(new Map());

  // Form fields
  const [audience, setAudience] = useState<AudienceType>('all_students');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [optionalProgramTag, setOptionalProgramTag] = useState<string>('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [peopleSearch, setPeopleSearch] = useState('');

  // Confirmation step
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accRes, progRes] = await Promise.all([
        api.getAdminAccounts(),
        api.getAdminPrograms().catch(() => ({ programs: [] })),
      ]);

      const activeAccounts = (accRes.accounts || []).filter((a) => a.isActive !== false);
      setAccounts(activeAccounts);
      setPrograms((progRes.programs as any) || []);
      setStudentProgramsMap(accRes.studentProgramsMap || new Map());
      setGuideProgramsMap(accRes.guideProgramsMap || new Map());

      if (progRes.programs && progRes.programs.length > 0) {
        setSelectedProgramId(progRes.programs[0].id);
      }
    } catch (err: any) {
      console.error('[AdminSendNotificationModal] load error:', err);
      setError("Couldn't load recipients and programs.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Active students and guides
  const activeStudents = accounts.filter((a) => a.role === 'student');
  const activeGuides = accounts.filter((a) => a.role === 'guide');

  // Compute targeted recipients list based on audience
  const computeRecipients = (): User[] => {
    switch (audience) {
      case 'all_students':
        return activeStudents;
      case 'all_guides':
        return activeGuides;
      case 'everyone':
        return accounts.filter((a) => a.role === 'student' || a.role === 'guide');
      case 'students_of_program': {
        if (!selectedProgramId) return [];
        return activeStudents.filter((st) => {
          const progs = studentProgramsMap.get(st.id) || [];
          return progs.some((p: any) => p.id === selectedProgramId);
        });
      }
      case 'guides_of_program': {
        if (!selectedProgramId) return [];
        return activeGuides.filter((g) => {
          const progs = guideProgramsMap.get(g.id) || [];
          return progs.some((p: any) => p.id === selectedProgramId);
        });
      }
      case 'pick_people': {
        return accounts.filter((a) => selectedUserIds.includes(a.id));
      }
      default:
        return [];
    }
  };

  const targetedRecipients = computeRecipients();
  const recipientCount = targetedRecipients.length;

  const handleTogglePerson = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllFilteredPeople = (filtered: User[]) => {
    const ids = filtered.map((u) => u.id);
    const allSelected = ids.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleInitiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (recipientCount === 0) {
      setError('No recipients selected. Please adjust your audience.');
      return;
    }
    if (!message.trim()) {
      setError('Message cannot be empty.');
      return;
    }
    if (message.length > 500) {
      setError('Message cannot exceed 500 characters.');
      return;
    }
    if (title.length > 80) {
      setError('Title cannot exceed 80 characters.');
      return;
    }

    setShowConfirm(true);
  };

  const handleExecuteSend = async () => {
    setIsSending(true);
    setError(null);

    const recipientIds = targetedRecipients.map((u) => u.id);

    // Determine program tag
    let effectiveProgramId: string | undefined = undefined;
    if (audience === 'students_of_program' || audience === 'guides_of_program') {
      effectiveProgramId = selectedProgramId;
    } else if (optionalProgramTag) {
      effectiveProgramId = optionalProgramTag;
    }

    try {
      const res = await api.sendNotification({
        recipients: recipientIds,
        title: title.trim(),
        message: message.trim(),
        programId: effectiveProgramId,
      });

      setShowConfirm(false);
      onSent(`Sent to ${res.count || recipientCount} people.`);
      onClose();
    } catch (err: any) {
      console.error('[AdminSendNotificationModal] send error:', err);
      setError(err?.message || "Couldn't send notification. Try again.");
      setShowConfirm(false);
    } finally {
      setIsSending(false);
    }
  };

  // Filtered people for "Pick people" mode
  const filteredPeople = accounts.filter((u) => {
    if (u.role !== 'student' && u.role !== 'guide') return false;
    const q = peopleSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-gray-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-base sm:text-lg text-[#111111] flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#D4202C]" />
              <span>Send notification</span>
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Broadcast announcements and reminders to students and guides
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-xs text-[#6B7280]">
              Loading recipient options...
            </div>
          ) : (
            <form id="admin-notify-form" onSubmit={handleInitiateSend} className="space-y-4">
              {/* Audience choices */}
              <div>
                <label className="block text-xs font-bold text-[#111111] mb-1.5">
                  Audience
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'all_students', label: 'All students' },
                    { id: 'all_guides', label: 'All guides' },
                    { id: 'everyone', label: 'Everyone' },
                    { id: 'students_of_program', label: 'Students of one program' },
                    { id: 'guides_of_program', label: 'Guides of one program' },
                    { id: 'pick_people', label: 'Pick people' },
                  ].map((opt) => {
                    const isSelected = audience === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setAudience(opt.id as AudienceType);
                          setError(null);
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-red-50 border-[#D4202C] text-[#D4202C]'
                            : 'bg-white border-[#E5E7EB] text-[#111111] hover:bg-gray-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Program selector if audience is program-specific */}
              {(audience === 'students_of_program' || audience === 'guides_of_program') && (
                <div>
                  <label className="block text-xs font-bold text-[#111111] mb-1">
                    Select program
                  </label>
                  <select
                    value={selectedProgramId}
                    onChange={(e) => setSelectedProgramId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                    required
                  >
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.kind})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pick People list with search and check */}
              {audience === 'pick_people' && (
                <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#111111]">
                      Search and select people ({selectedUserIds.length} selected):
                    </span>
                    {filteredPeople.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSelectAllFilteredPeople(filteredPeople)}
                        className="text-xs text-[#D4202C] font-semibold hover:underline"
                      >
                        Toggle all
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by name, roll, or role..."
                      value={peopleSearch}
                      onChange={(e) => setPeopleSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-[#111111] focus:outline-none focus:border-[#D4202C]"
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 bg-white p-2 rounded-lg border border-gray-100">
                    {filteredPeople.length === 0 ? (
                      <p className="text-xs text-gray-500 py-2 text-center">No people match your search.</p>
                    ) : (
                      filteredPeople.map((u) => {
                        const isChecked = selectedUserIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => handleTogglePerson(u.id)}
                            className="flex items-center justify-between p-1.5 rounded hover:bg-gray-50 cursor-pointer text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-[#D4202C] shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400 shrink-0" />
                              )}
                              <span className="font-semibold text-[#111111] truncate">{u.fullName}</span>
                              <span className="text-gray-500 text-[11px]">@{u.username}</span>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                              {u.role}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Recipient summary badge */}
              <div className="text-xs font-semibold text-[#6B7280]">
                Recipients: <strong className="text-[#111111]">{recipientCount}</strong> {recipientCount === 1 ? 'person' : 'people'}
              </div>

              {/* Optional Title (up to 80 chars) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#111111]">
                    Title <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <span className="text-[11px] text-gray-400">{title.length} / 80</span>
                </div>
                <input
                  type="text"
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Schedule update or reminder"
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                />
              </div>

              {/* Message (up to 500 chars, with counter) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#111111]">
                    Message
                  </label>
                  <span className={`text-[11px] ${message.length > 500 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                    {message.length} / 500
                  </span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your announcement or guidance message..."
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C] resize-none"
                  required
                />
              </div>

              {/* Optional Program Tag (if not already selecting a program) */}
              {audience !== 'students_of_program' && audience !== 'guides_of_program' && (
                <div>
                  <label className="block text-xs font-bold text-[#111111] mb-1">
                    Program tag <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={optionalProgramTag}
                    onChange={(e) => setOptionalProgramTag(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                  >
                    <option value="">None (general notification)</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Preview line: "How it appears: Admin · title · message" */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                <span className="text-gray-400 block font-medium mb-1">Preview:</span>
                <p className="text-[#111111] leading-relaxed break-words">
                  How it appears:{' '}
                  <strong>Admin</strong>
                  {title.trim() ? ` · ${title.trim()}` : ''}
                  {message.trim() ? ` · ${message.trim()}` : ' · (your message here)'}
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111] rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="admin-notify-form"
            disabled={isSending || loading || recipientCount === 0 || !message.trim()}
            className="px-4 py-2 text-xs font-semibold bg-[#D4202C] text-white rounded-xl hover:bg-[#b01b24] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send notification</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal: "Send to X people?" */}
      {showConfirm && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <h3 className="font-bold text-base text-[#111111]">
              Send to {recipientCount} {recipientCount === 1 ? 'person' : 'people'}?
            </h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              This will deliver your notification to {recipientCount} recipients immediately across the platform.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isSending}
                className="px-3.5 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111] rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleExecuteSend}
                disabled={isSending}
                className="px-4 py-2 text-xs font-semibold bg-[#D4202C] text-white rounded-xl hover:bg-[#b01b24] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Sending...' : 'Confirm and send'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
