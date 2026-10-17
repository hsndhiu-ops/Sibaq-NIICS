import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { Program } from '../../types';
import { Bell, Check, Search, AlertCircle, RefreshCw, X, BookOpen, Plus, Trash2 } from 'lucide-react';
import { Pentagon } from '../brand/Decorations';

interface AdminGuidesProps {
  onSelectStudent?: (studentId: string) => void;
  onNotify: (msg: string) => void;
}

interface GuideItem {
  id: string;
  fullName: string;
  username: string;
  programs: Array<{ id: string; name: string; kind: string }>;
  programsCount: number;
  sessionsCount: number;
  markedCount: number;
  unmarkedCount: number;
  allMarked: boolean;
}

export const AdminGuides: React.FC<AdminGuidesProps> = ({ onNotify }) => {
  const [guides, setGuides] = useState<GuideItem[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [date, setDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Remind cooldown per guide: guideId -> expiry timestamp
  const [remindCooldowns, setRemindCooldowns] = useState<Record<string, number>>({});
  const [remindingGuideId, setRemindingGuideId] = useState<string | null>(null);

  // Replace guide tool modal state
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [guideAId, setGuideAId] = useState<string>('');
  const [guideBId, setGuideBId] = useState<string>('');
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  // Remove single program from a guide confirmation modal
  const [removeProgramTarget, setRemoveProgramTarget] = useState<{
    guideId: string;
    guideName: string;
    programId: string;
    programName: string;
  } | null>(null);
  const [isRemovingProgram, setIsRemovingProgram] = useState(false);
  const [removeProgramError, setRemoveProgramError] = useState<string | null>(null);

  // Assign program to guide modal
  const [assignProgramTarget, setAssignProgramTarget] = useState<GuideItem | null>(null);
  const [selectedProgramToAssign, setSelectedProgramToAssign] = useState<string>('');
  const [isAssigningProgram, setIsAssigningProgram] = useState(false);
  const [assignProgramError, setAssignProgramError] = useState<string | null>(null);

  useEffect(() => {
    loadGuides();

    // Auto-refresh every 25 seconds for live guide updates
    const timer = setInterval(() => {
      loadGuides(true);
    }, 25000);

    return () => clearInterval(timer);
  }, []);

  const loadGuides = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const [res, progRes] = await Promise.all([
        api.getAdminGuides(),
        api.getAdminPrograms().catch(() => ({ programs: [] })),
      ]);
      setGuides(res.guides);
      setDate(res.date);
      setAllPrograms(progRes.programs || []);
    } catch (err: any) {
      console.error('[AdminGuides] error loading guides:', err);
      if (!isSilent) setError("Couldn't load guides. Please try again.");
    } finally {
      if (!isSilent) setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRemind = async (guideId: string, guideName: string) => {
    if (remindCooldowns[guideId] && remindCooldowns[guideId] > Date.now()) {
      return;
    }

    setRemindingGuideId(guideId);
    try {
      await api.remindGuide(guideId);
      setRemindCooldowns((prev) => ({
        ...prev,
        [guideId]: Date.now() + 60 * 1000,
      }));
      onNotify(`Reminder sent to ${guideName}.`);
    } catch (err: any) {
      console.error('[remindGuide] error:', err);
      onNotify("Couldn't send reminder. Try again.");
    } finally {
      setRemindingGuideId(null);
    }
  };

  // --- Remove specific program from guide ---
  const handleExecuteRemoveProgram = async () => {
    if (!removeProgramTarget) return;
    setIsRemovingProgram(true);
    setRemoveProgramError(null);

    try {
      await api.removeProgramGuide(removeProgramTarget.programId, removeProgramTarget.guideId);
      const { guideName, programName } = removeProgramTarget;
      setRemoveProgramTarget(null);
      await loadGuides();
      onNotify(`Removed "${programName}" from ${guideName}.`);
    } catch (err: any) {
      console.error('[removeProgramGuide] error:', err);
      setRemoveProgramError(err.message || "Couldn't remove program from guide. Try again.");
    } finally {
      setIsRemovingProgram(false);
    }
  };

  // --- Assign program to guide ---
  const handleOpenAssignProgramModal = (guide: GuideItem) => {
    setAssignProgramTarget(guide);
    // Find first program not already assigned
    const assignedIds = new Set(guide.programs.map((p) => p.id));
    const unassigned = allPrograms.filter((p) => !assignedIds.has(p.id));
    setSelectedProgramToAssign(unassigned.length > 0 ? unassigned[0].id : '');
    setAssignProgramError(null);
  };

  const handleExecuteAssignProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignProgramTarget || !selectedProgramToAssign) {
      setAssignProgramError('Please select a program to assign.');
      return;
    }

    setIsAssigningProgram(true);
    setAssignProgramError(null);

    try {
      await api.addProgramGuide(selectedProgramToAssign, assignProgramTarget.id);
      const chosenProg = allPrograms.find((p) => p.id === selectedProgramToAssign);
      const guideName = assignProgramTarget.fullName;
      setAssignProgramTarget(null);
      setSelectedProgramToAssign('');
      await loadGuides();
      onNotify(`Assigned "${chosenProg?.name || 'Program'}" to ${guideName}.`);
    } catch (err: any) {
      console.error('[addProgramGuide] error:', err);
      setAssignProgramError(err.message || "Couldn't assign program to guide. Try again.");
    } finally {
      setIsAssigningProgram(false);
    }
  };

  // --- Replace all programs of Guide A with Guide B ---
  const handleOpenReplaceModal = (initialGuideAId?: string) => {
    setGuideAId(initialGuideAId || (guides.length > 0 ? guides[0].id : ''));
    setGuideBId('');
    setReplaceError(null);
    setShowReplaceModal(true);
  };

  const handleExecuteReplaceGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guideAId || !guideBId) {
      setReplaceError('Please choose both Guide A and Guide B.');
      return;
    }
    if (guideAId === guideBId) {
      setReplaceError('Guide A and Guide B must be different persons.');
      return;
    }

    const sourceGuide = guides.find((g) => g.id === guideAId);
    const targetGuide = guides.find((g) => g.id === guideBId);

    setIsReplacing(true);
    setReplaceError(null);

    try {
      const results = await api.replaceGuide(guideAId, guideBId);
      const failed = results.filter((r) => !r.success);

      if (failed.length > 0) {
        console.error('[replaceGuide] some programs failed:', failed);
        setReplaceError(`Updated ${results.length - failed.length} programs, but ${failed.length} failed.`);
      } else {
        setShowReplaceModal(false);
        setGuideAId('');
        setGuideBId('');
        await loadGuides();
        onNotify(`Switched all programs from ${sourceGuide?.fullName || 'Guide A'} to ${targetGuide?.fullName || 'Guide B'}.`);
      }
    } catch (err: any) {
      console.error('[replaceGuide] error:', err);
      setReplaceError(err.message || "Couldn't replace guide. Try again.");
    } finally {
      setIsReplacing(false);
    }
  };

  const selectedSourceGuide = guides.find((g) => g.id === guideAId);
  const eligibleTargets = guides.filter((g) => g.id !== guideAId);

  const filteredGuides = guides.filter((g) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = g.fullName.toLowerCase().includes(q) || g.username.toLowerCase().includes(q);
    const progMatch = (g.programs || []).some((p) => p.name.toLowerCase().includes(q));
    return nameMatch || progMatch;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#111111]">Guides</h1>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-1">
            Program supervision and today&apos;s attendance progress {date ? `· ${date}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => loadGuides()}
            disabled={loading || isRefreshing}
            className="p-2 rounded-xl bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 transition-colors cursor-pointer"
            title="Refresh guides and progress"
            aria-label="Refresh guides and progress"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing || loading ? 'animate-spin text-[#D4202C]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => handleOpenReplaceModal()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#D4202C] text-white text-xs sm:text-sm font-semibold hover:bg-[#b01b24] transition-colors cursor-pointer shadow-xs"
          >
            <span>Switch all programs</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      {guides.length > 5 && (
        <div className="relative">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides or programs..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#D4202C]"
          />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadGuides()}
            className="font-semibold underline hover:no-underline ml-4 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="p-12 text-center text-xs sm:text-sm text-[#6B7280]">
          Loading guides and program assignments...
        </div>
      ) : filteredGuides.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-xs sm:text-sm text-[#6B7280] flex flex-col items-center justify-center">
          <Pentagon size={56} className="mb-3" />
          <p>
            {searchQuery
              ? 'No guides match your search criteria.'
              : 'No guides found. Create guide accounts in the Accounts tab.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGuides.map((guide) => {
            const hasCooldown = Boolean(
              remindCooldowns[guide.id] && remindCooldowns[guide.id] > Date.now()
            );
            const isReminding = remindingGuideId === guide.id;

            return (
              <div
                key={guide.id}
                className="p-5 rounded-2xl bg-[#F3F4F6] border border-gray-100/80 flex flex-col justify-between space-y-4 hover:shadow-xs transition-shadow"
              >
                {/* Guide header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base text-[#111111] truncate">
                        {guide.fullName}
                      </h3>
                      <span className="text-xs text-[#6B7280] font-normal">
                        @{guide.username}
                      </span>
                    </div>

                    {/* Progress summary */}
                    <div className="text-xs text-[#4B5563] mt-1 flex items-center gap-2 flex-wrap">
                      <span>Sessions today: <strong>{guide.sessionsCount}</strong></span>
                      <span>·</span>
                      <span className={guide.allMarked && guide.sessionsCount > 0 ? 'text-green-700 font-semibold' : ''}>
                        {guide.markedCount} marked
                      </span>
                      <span>·</span>
                      <span className={guide.unmarkedCount > 0 ? 'text-[#D4202C] font-semibold' : ''}>
                        {guide.unmarkedCount} unmarked
                      </span>
                    </div>
                  </div>

                  {/* Status chip / Remind button */}
                  <div className="shrink-0 flex items-center gap-2">
                    {guide.sessionsCount > 0 ? (
                      guide.allMarked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-white text-green-700 border border-green-200">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>All marked</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRemind(guide.id, guide.fullName)}
                          disabled={hasCooldown || isReminding}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                            hasCooldown
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-white text-[#111111] hover:bg-gray-100 border border-[#E5E7EB]'
                          }`}
                          title="Send attendance reminder"
                        >
                          <Bell className="w-3.5 h-3.5 text-[#D4202C]" />
                          <span>{hasCooldown ? 'Sent' : isReminding ? 'Sending...' : 'Remind'}</span>
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-[#6B7280] px-2.5 py-1 rounded-lg bg-gray-100 font-medium">
                        No sessions
                      </span>
                    )}
                  </div>
                </div>

                {/* Programs list */}
                <div className="pt-2 border-t border-gray-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#6B7280]">
                      Programs guided ({guide.programs.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenAssignProgramModal(guide)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#D4202C] hover:text-[#b01b24] cursor-pointer transition-colors"
                      title={`Assign a program to ${guide.fullName}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Assign program</span>
                    </button>
                  </div>

                  {guide.programs.length === 0 ? (
                    <div className="text-xs text-[#6B7280] italic py-1">
                      No programs assigned yet. Click &quot;Assign program&quot; above to add one.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {guide.programs.map((prog) => (
                        <span
                          key={prog.id}
                          className="inline-flex items-center gap-1.5 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-lg bg-white text-[#111111] border border-gray-200 shadow-2xs hover:border-red-200 transition-colors group"
                        >
                          <BookOpen className="w-3 h-3 text-[#D4202C] shrink-0" />
                          <span>{prog.name}</span>
                          <span className="text-[11px] text-[#6B7280] font-normal uppercase">
                            ({prog.kind})
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemoveProgramTarget({
                                guideId: guide.id,
                                guideName: guide.fullName,
                                programId: prog.id,
                                programName: prog.name,
                              });
                              setRemoveProgramError(null);
                            }}
                            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#D4202C] transition-colors ml-0.5 cursor-pointer"
                            title={`Remove ${prog.name} from ${guide.fullName}`}
                            aria-label={`Remove ${prog.name} from ${guide.fullName}`}
                          >
                            <X className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card footer: quick replace link */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleOpenReplaceModal(guide.id)}
                    className="text-xs text-[#6B7280] hover:text-[#D4202C] font-semibold transition-colors cursor-pointer"
                  >
                    Switch programs to another guide →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- MODAL 1: Remove Specific Program Confirmation Modal --- */}
      {removeProgramTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#D4202C] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => setRemoveProgramTarget(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h2 className="font-bold text-base sm:text-lg text-[#111111]">
                Remove program from guide
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-1.5 leading-relaxed">
                Are you sure you want to remove <strong className="text-[#111111]">{removeProgramTarget.programName}</strong> from <strong className="text-[#111111]">{removeProgramTarget.guideName}</strong>?
              </p>
              <p className="text-xs text-[#6B7280] mt-1">
                This mentor will no longer guide or mark attendance for this program.
              </p>
            </div>

            {removeProgramError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{removeProgramError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRemoveProgramTarget(null)}
                disabled={isRemovingProgram}
                className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111] rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRemoveProgram}
                disabled={isRemovingProgram}
                className="px-4 py-2 text-xs font-semibold bg-[#D4202C] text-white rounded-xl hover:bg-[#b01b24] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isRemovingProgram ? 'Removing...' : 'Remove program'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Assign Program to Guide Modal --- */}
      {assignProgramTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h2 className="font-bold text-base sm:text-lg text-[#111111]">
                  Assign program
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Assign a program to <strong className="text-[#111111]">{assignProgramTarget.fullName}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignProgramTarget(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {assignProgramError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{assignProgramError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteAssignProgram} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#111111] mb-1">
                  Select program
                </label>
                {(() => {
                  const assignedIds = new Set(assignProgramTarget.programs.map((p) => p.id));
                  const available = allPrograms.filter((p) => !assignedIds.has(p.id));

                  if (available.length === 0) {
                    return (
                      <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-xl">
                        This guide is already assigned to all configured programs.
                      </p>
                    );
                  }

                  return (
                    <select
                      value={selectedProgramToAssign}
                      onChange={(e) => setSelectedProgramToAssign(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                      required
                    >
                      <option value="" disabled>Select a program</option>
                      {available.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.kind})
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAssignProgramTarget(null)}
                  disabled={isAssigningProgram}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111] rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigningProgram || !selectedProgramToAssign}
                  className="px-4 py-2 text-xs font-semibold bg-[#D4202C] text-white rounded-xl hover:bg-[#b01b24] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAssigningProgram ? 'Assigning...' : 'Assign program'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Replace Guide across all programs --- */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 space-y-5 animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h2 className="font-bold text-base sm:text-lg text-[#111111]">
                  Switch all programs to another guide
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Switches all program assignments of Guide A to Guide B across every program.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {replaceError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-[#D4202C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{replaceError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteReplaceGuide} className="space-y-4">
              {/* Guide A (Current) */}
              <div>
                <label className="block text-xs font-bold text-[#111111] mb-1">
                  Guide A (current guide)
                </label>
                <select
                  value={guideAId}
                  onChange={(e) => {
                    setGuideAId(e.target.value);
                    if (guideBId === e.target.value) setGuideBId('');
                  }}
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                  required
                >
                  <option value="" disabled>Select current guide</option>
                  {guides.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.fullName} ({g.programs.length} programs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Programs affected preview */}
              {selectedSourceGuide && (
                <div className="p-3 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] space-y-1">
                  <div className="font-semibold text-[#6B7280]">
                    Programs currently guided by {selectedSourceGuide.fullName} ({selectedSourceGuide.programs.length}):
                  </div>
                  {selectedSourceGuide.programs.length === 0 ? (
                    <div className="text-gray-500 italic">No programs currently assigned.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedSourceGuide.programs.map((p) => (
                        <span key={p.id} className="px-2 py-0.5 bg-white rounded text-[11px] font-medium border border-gray-200">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Guide B (Replacement) */}
              <div>
                <label className="block text-xs font-bold text-[#111111] mb-1">
                  Guide B (replacement guide)
                </label>
                <select
                  value={guideBId}
                  onChange={(e) => setGuideBId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs sm:text-sm text-[#111111] focus:outline-none focus:border-[#D4202C]"
                  required
                >
                  <option value="" disabled>Select replacement guide</option>
                  {eligibleTargets.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.fullName} ({g.programs.length} programs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowReplaceModal(false)}
                  disabled={isReplacing}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111] rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReplacing || !guideAId || !guideBId}
                  className="px-4 py-2 text-xs font-semibold bg-[#D4202C] text-white rounded-xl hover:bg-[#b01b24] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isReplacing ? 'animate-spin' : ''}`} />
                  <span>{isReplacing ? 'Switching...' : 'Switch programs'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
