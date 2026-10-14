import React, { useState, useEffect } from 'react';
import { Program, User } from '../../types';
import { api } from '../../api';
import { supabase } from '../../lib/supabase';
import { TABLES, PROGRAM_MEMBERS_COLS, PROGRAMS_COLS, PROFILES_COLS } from '../../lib/schema';
import { Plus, Edit2, Trash2, Users, UserCheck, X, Search, Loader2, AlertCircle } from 'lucide-react';
import { Pentagon } from '../brand/Decorations';

interface AdminProgramsProps {
  onNotify: (msg: string) => void;
}

const formatChangeMessage = (added: number, removed: number): string => {
  if (added === 0 && removed === 0) {
    return 'No changes';
  }
  const parts: string[] = [];
  if (added > 0) {
    parts.push(`Added ${added} ${added === 1 ? 'student' : 'students'}`);
  }
  if (removed > 0) {
    if (parts.length > 0) {
      parts.push(`removed ${removed} ${removed === 1 ? 'student' : 'students'}`);
    } else {
      parts.push(`Removed ${removed} ${removed === 1 ? 'student' : 'students'}`);
    }
  }
  return parts.join(', ') + '.';
};

export const AdminPrograms: React.FC<AdminProgramsProps> = ({ onNotify }) => {
  const [programs, setPrograms] = useState<any[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [guides, setGuides] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit Program modal
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [isCreatingProgram, setIsCreatingProgram] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('Stage');
  const [type, setType] = useState<'solo' | 'group'>('solo');
  const [description, setDescription] = useState('');

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Stage' | 'Non-Stage' | 'Off-Stage'>('All');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Assign students to program modal
  const [assigningProgram, setAssigningProgram] = useState<any | null>(null);
  const [originalStudentIds, setOriginalStudentIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isAssignSaving, setIsAssignSaving] = useState(false);

  // Quick remove student confirmation modal (from chip "x")
  const [studentToRemove, setStudentToRemove] = useState<{
    studentId: string;
    studentName: string;
    programId: string;
    programName: string;
  } | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemovingStudent, setIsRemovingStudent] = useState(false);

  // Assign guide to students modal
  const [isAssigningGuide, setIsAssigningGuide] = useState(false);
  const [guideStudentIds, setGuideStudentIds] = useState<string[]>([]);
  const [selectedGuideId, setSelectedGuideId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [progRes, accountsRes] = await Promise.all([
        api.getAdminPrograms(),
        api.getAdminAccounts(),
      ]);
      setPrograms(progRes.programs);
      setStudents(accountsRes.accounts.filter((u) => u.role === 'student'));
      const gList = accountsRes.accounts.filter((u) => u.role === 'guide');
      setGuides(gList);
      if (gList.length > 0) setSelectedGuideId(gList[0].id);
    } catch (err: any) {
      console.error(`[${TABLES.PROGRAMS}] loadData error:`, err?.message || err);
      onNotify("Couldn't load programs. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const refetchPrograms = async () => {
    try {
      const progRes = await api.getAdminPrograms();
      setPrograms(progRes.programs);
    } catch (err: any) {
      console.error(`[${TABLES.PROGRAMS}] refetch error:`, err?.message || err);
      onNotify("Couldn't refresh programs.");
    }
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedCategory = category || 'Stage';
      if (editingProgram) {
        await api.updateProgram(editingProgram.id, { name, category: selectedCategory, type, description });
        onNotify('Program updated successfully.');
      } else {
        await api.createProgram({ name, category: selectedCategory, type, description });
        onNotify('Program created successfully.');
      }
      setIsCreatingProgram(false);
      setEditingProgram(null);
      setName('');
      setCategory('Stage');
      setDescription('');
      await refetchPrograms();
    } catch (err: any) {
      console.error(`[${TABLES.PROGRAMS}] save error:`, err?.message || err);
      onNotify(err.message || 'Failed to save program');
    }
  };

  const handleDeleteProgram = async (id: string) => {
    if (!confirm('Are you sure you want to delete this program?')) return;
    try {
      await api.deleteProgram(id);
      onNotify('Program deleted.');
      await refetchPrograms();
    } catch (err: any) {
      console.error(`[${TABLES.PROGRAMS}] delete error:`, err?.message || err);
      onNotify(err.message || 'Failed to delete program');
    }
  };

  const handleOpenAssignProgram = (prog: any) => {
    setAssigningProgram(prog);
    const currentAssigned: string[] = (prog.students || []).map((s: any) => s.id);
    setOriginalStudentIds(currentAssigned);
    setSelectedStudentIds(currentAssigned);
    setAssignError(null);
    setAssignSearch('');
  };

  const handleSaveProgramAssignment = async () => {
    if (!assigningProgram) return;

    // 1. Compare original member list with new selection
    const toAdd = selectedStudentIds.filter((id) => !originalStudentIds.includes(id));
    const toRemove = originalStudentIds.filter((id) => !selectedStudentIds.includes(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      onNotify('No changes');
      setAssigningProgram(null);
      return;
    }

    setIsAssignSaving(true);
    setAssignError(null);

    try {
      // Delete rows for toRemove with program_members delete filtered by program_id and student_id in toRemove
      if (toRemove.length > 0) {
        const { data: deletedRows, error: deleteError } = await supabase
          .from(TABLES.PROGRAM_MEMBERS)
          .delete()
          .eq(PROGRAM_MEMBERS_COLS.PROGRAM_ID, assigningProgram.id)
          .in(PROGRAM_MEMBERS_COLS.STUDENT_ID, toRemove)
          .select();

        if (deleteError) {
          console.error(`[${TABLES.PROGRAM_MEMBERS}] delete error:`, deleteError.message, deleteError);
          setAssignError("Couldn't remove some students. Try again.");
          setIsAssignSaving(false);
          return;
        }

        const deletedCount = (deletedRows || []).length;
        if (deletedCount !== toRemove.length) {
          console.error(
            `[${TABLES.PROGRAM_MEMBERS}] delete count mismatch: expected ${toRemove.length}, got ${deletedCount}`
          );
          setAssignError("Couldn't remove some students. Try again.");
          setIsAssignSaving(false);
          return;
        }
      }

      // Insert rows for toAdd into program_members (program_id, student_id)
      if (toAdd.length > 0) {
        const inserts = toAdd.map((sid) => ({
          [PROGRAM_MEMBERS_COLS.PROGRAM_ID]: assigningProgram.id,
          [PROGRAM_MEMBERS_COLS.STUDENT_ID]: sid,
        }));

        const { data: insertedRows, error: insertError } = await supabase
          .from(TABLES.PROGRAM_MEMBERS)
          .insert(inserts)
          .select();

        if (insertError) {
          console.error(`[${TABLES.PROGRAM_MEMBERS}] insert error:`, insertError.message, insertError);
          setAssignError(insertError.message || "Couldn't add some students. Try again.");
          setIsAssignSaving(false);
          return;
        }

        const insertedCount = (insertedRows || []).length;
        if (insertedCount !== toAdd.length) {
          console.error(
            `[${TABLES.PROGRAM_MEMBERS}] insert count mismatch: expected ${toAdd.length}, got ${insertedCount}`
          );
          setAssignError("Couldn't add some students. Try again.");
          setIsAssignSaving(false);
          return;
        }
      }

      // Refetch the program's students so the card shows the real list at once
      await refetchPrograms();

      // Show formatted message: "Added 1, removed 1." with correct plurals
      const message = formatChangeMessage(toAdd.length, toRemove.length);
      onNotify(message);

      // Close modal on successful save
      setAssigningProgram(null);
      setAssignError(null);
    } catch (err: any) {
      console.error(`[${TABLES.PROGRAM_MEMBERS}] save assignment error:`, err?.message || err);
      setAssignError(err?.message || "Couldn't remove some students. Try again.");
    } finally {
      setIsAssignSaving(false);
    }
  };

  const handleConfirmRemoveStudent = async () => {
    if (!studentToRemove) return;
    setIsRemovingStudent(true);
    setRemoveError(null);

    try {
      const { data: deletedRows, error } = await supabase
        .from(TABLES.PROGRAM_MEMBERS)
        .delete()
        .eq(PROGRAM_MEMBERS_COLS.PROGRAM_ID, studentToRemove.programId)
        .eq(PROGRAM_MEMBERS_COLS.STUDENT_ID, studentToRemove.studentId)
        .select();

      if (error) {
        console.error(`[${TABLES.PROGRAM_MEMBERS}] delete single student error:`, error.message, error);
        setRemoveError(error.message || `Couldn't remove ${studentToRemove.studentName}. Try again.`);
        return;
      }

      const deletedCount = (deletedRows || []).length;
      if (deletedCount === 0) {
        console.error(
          `[${TABLES.PROGRAM_MEMBERS}] delete failed: 0 rows deleted for program ${studentToRemove.programId} and student ${studentToRemove.studentId}`
        );
        setRemoveError(`Couldn't remove ${studentToRemove.studentName}. Try again.`);
        return;
      }

      const removedStudentName = studentToRemove.studentName;
      setStudentToRemove(null);
      await refetchPrograms();
      onNotify(`Removed ${removedStudentName}.`);
    } catch (err: any) {
      console.error(`[${TABLES.PROGRAM_MEMBERS}] delete error:`, err?.message || err);
      setRemoveError(err?.message || `Couldn't remove student. Try again.`);
    } finally {
      setIsRemovingStudent(false);
    }
  };

  const handleSaveGuideAssignment = async () => {
    if (!selectedGuideId || guideStudentIds.length === 0) return;
    try {
      const res = await api.assignGuide(guideStudentIds, selectedGuideId);
      onNotify(res.message);
      setIsAssigningGuide(false);
      setGuideStudentIds([]);
      await loadData();
    } catch (err: any) {
      console.error(`[${TABLES.PROFILES}] assign guide error:`, err?.message || err);
      onNotify(err.message || 'Failed to assign guide');
    }
  };

  const toggleStudentSelect = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((s) => s !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const toggleGuideStudentSelect = (id: string) => {
    if (guideStudentIds.includes(id)) {
      setGuideStudentIds(guideStudentIds.filter((s) => s !== id));
    } else {
      setGuideStudentIds([...guideStudentIds, id]);
    }
  };

  const normalizeText = (text: string): string => {
    return (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u02bb\u02bc\u02bd\u02be\u02bf\u2018\u2019'`ʾʿ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  };

  const matchesSearch = (text: string, query: string): boolean => {
    const cleanQuery = normalizeText(query);
    if (!cleanQuery) return true;
    const cleanText = normalizeText(text);
    return cleanText.includes(cleanQuery);
  };

  const isProgramMatched = (prog: any): boolean => {
    if (!searchQuery.trim()) return true;
    const matchProgName = matchesSearch(prog.name, searchQuery);
    const matchProgDesc = matchesSearch(prog.description || '', searchQuery);
    const matchStudent = (prog.students || []).some(
      (s: any) => matchesSearch(s.fullName, searchQuery) || matchesSearch(s.username || '', searchQuery)
    );
    return matchProgName || matchProgDesc || matchStudent;
  };

  const isCategoryMatched = (prog: any): boolean => {
    if (categoryFilter === 'All') return true;
    return (prog.category || 'Stage').toLowerCase() === categoryFilter.toLowerCase();
  };

  const filteredPrograms = programs.filter(
    (prog) => isCategoryMatched(prog) && isProgramMatched(prog)
  );

  const getCategoryCount = (cat: 'All' | 'Stage' | 'Non-Stage' | 'Off-Stage') => {
    if (cat === 'All') return programs.length;
    return programs.filter(
      (p) => (p.category || 'Stage').toLowerCase() === cat.toLowerCase()
    ).length;
  };

  // Determine if student assignment modal has changes compared to original list
  const hasAssignmentChanges = (() => {
    if (!assigningProgram) return false;
    if (selectedStudentIds.length !== originalStudentIds.length) return true;
    const origSet = new Set(originalStudentIds);
    return selectedStudentIds.some((id) => !origSet.has(id));
  })();

  const filteredAssignStudents = students.filter((s) => {
    if (!assignSearch.trim()) return true;
    const q = assignSearch.toLowerCase();
    return s.fullName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-[28px] sm:text-[34px] font-normal text-[#111111] leading-tight">
            Programs
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAssigningGuide(true)}
            className="px-3 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 cursor-pointer"
          >
            Assign Guides
          </button>
          <button
            onClick={() => {
              setEditingProgram(null);
              setName('');
              setCategory('Stage');
              setType('solo');
              setDescription('');
              setIsCreatingProgram(true);
            }}
            className="px-3.5 py-2 rounded-[10px] bg-[#D4202C] text-white text-xs font-semibold hover:bg-[#B81B26] active:bg-[#B81B26] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New program</span>
          </button>
        </div>
      </div>

      {/* Search box and Category dropdown - No horizontal scrollbar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
          {/* Search box: 44px high, 10px radius, red focus outline, visible label for screen readers, no autofocus */}
          <div className="relative flex-1">
            <label htmlFor="programs-search" className="sr-only">
              Search programs or students
            </label>
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
            <input
              id="programs-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search programs or students"
              className="w-full h-[44px] pl-10 pr-10 rounded-[10px] bg-[#F3F4F6] text-xs sm:text-sm text-[#111111] placeholder:text-[#6B7280] border border-transparent focus:border-[#D4202C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4202C]/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#6B7280] hover:text-[#111111] hover:bg-gray-200 transition-colors cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category dropdown: All categories, Stage, Non-Stage, Off-Stage with counts */}
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="programs-category" className="text-xs font-semibold text-[#6B7280] whitespace-nowrap">
              Category:
            </label>
            <select
              id="programs-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="h-[44px] px-3.5 rounded-[10px] bg-[#F3F4F6] text-xs font-semibold text-[#111111] border border-transparent focus:border-[#D4202C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D4202C]/20 cursor-pointer"
            >
              <option value="All">All categories ({getCategoryCount('All')})</option>
              <option value="Stage">Stage ({getCategoryCount('Stage')})</option>
              <option value="Non-Stage">Non-Stage ({getCategoryCount('Non-Stage')})</option>
              <option value="Off-Stage">Off-Stage ({getCategoryCount('Off-Stage')})</option>
            </select>
          </div>
        </div>

        {/* Result count when searching */}
        {searchQuery.trim() && (
          <div className="text-xs text-[#6B7280] px-0.5">
            {filteredPrograms.length} {filteredPrograms.length === 1 ? 'result' : 'results'}
          </div>
        )}
      </div>

      {/* Program Cards */}
      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading programs...
        </div>
      ) : filteredPrograms.length === 0 ? (
        searchQuery.trim() ? (
          <div className="p-8 rounded-2xl bg-[#F3F4F6] flex flex-col items-center justify-center text-center space-y-3">
            <Pentagon size={64} className="text-[#6B7280]" />
            <p className="text-sm text-[#111111]">
              No results for "{searchQuery}"
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-[10px] bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-[#F3F4F6] flex flex-col items-center justify-center text-center text-sm text-[#6B7280]">
            <Pentagon size={64} className="mb-3" />
            <p>
              {programs.length === 0
                ? 'No competition programs created yet.'
                : `No programs found under "${categoryFilter}".`}
            </p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPrograms.map((prog) => (
            <div
              key={prog.id}
              className="p-5 rounded-2xl bg-[#F3F4F6] flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-[#111111]">
                      {prog.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-gray-200 text-xs font-semibold text-[#111111]">
                        {prog.category || 'Stage'}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#E5E7EB] text-xs font-semibold text-[#111111] capitalize">
                        {prog.type}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingProgram(prog);
                        setName(prog.name);
                        setCategory(prog.category || 'Stage');
                        setType(prog.type);
                        setDescription(prog.description || '');
                        setIsCreatingProgram(true);
                      }}
                      className="p-1.5 rounded-lg bg-white text-[#111111] hover:bg-gray-100 cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProgram(prog.id)}
                      className="p-1.5 rounded-lg bg-white text-[#111111] hover:bg-gray-100 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#D4202C]" />
                    </button>
                  </div>
                </div>

                {prog.description && (
                  <p className="text-[13px] text-[#6B7280] mt-2 leading-relaxed">
                    {prog.description}
                  </p>
                )}

                <div className="mt-3">
                  <span className="text-xs font-semibold text-[#6B7280] block mb-1.5">
                    Students ({prog.studentCount}):
                  </span>
                  {prog.studentCount === 0 ? (
                    <span className="text-xs text-[#6B7280]">No students assigned</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {prog.students.map((s: any) => {
                        const isStudentHighlighted = Boolean(
                          searchQuery.trim() &&
                            (matchesSearch(s.fullName, searchQuery) ||
                              matchesSearch(s.username || '', searchQuery))
                        );
                        return (
                          <span
                            key={s.id}
                            className={`inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-lg border text-xs transition-colors ${
                              isStudentHighlighted
                                ? 'bg-[#E5E7EB] border-gray-300 font-bold text-[#111111]'
                                : 'bg-white border-[#E5E7EB] font-medium text-[#111111]'
                            }`}
                          >
                            <span>{s.fullName}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRemoveError(null);
                                setStudentToRemove({
                                  studentId: s.id,
                                  studentName: s.fullName,
                                  programId: prog.id,
                                  programName: prog.name,
                                });
                              }}
                              className="p-0.5 rounded text-[#9CA3AF] hover:text-[#D4202C] hover:bg-gray-100 transition-colors cursor-pointer"
                              title={`Remove ${s.fullName}`}
                              aria-label={`Remove ${s.fullName} from ${prog.name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <button
                  onClick={() => handleOpenAssignProgram(prog)}
                  className="w-full py-2 rounded-xl bg-white text-xs font-semibold text-[#111111] hover:bg-gray-100 cursor-pointer"
                >
                  Manage students ({prog.studentCount})
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Program Create / Edit Modal */}
      {isCreatingProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-[#E5E7EB] overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <h3 className="font-bold text-base text-[#111111]">
                {editingProgram ? 'Edit Program' : 'New Competition Program'}
              </h3>
              <button
                onClick={() => setIsCreatingProgram(false)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProgram} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Program name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Qawwali, Gazal"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0 focus:outline-none focus:ring-2 focus:ring-[#D4202C]/20 cursor-pointer"
                >
                  <option value="Stage">Stage</option>
                  <option value="Non-Stage">Non-Stage</option>
                  <option value="Off-Stage">Off-Stage</option>
                  {category && !['Stage', 'Non-Stage', 'Off-Stage'].includes(category) && (
                    <option value={category}>{category}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('solo')}
                    className={`py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                      type === 'solo'
                        ? 'bg-[#D4202C] text-white'
                        : 'bg-[#F3F4F6] text-[#111111]'
                    }`}
                  >
                    Solo
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('group')}
                    className={`py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                      type === 'group'
                        ? 'bg-[#D4202C] text-white'
                        : 'bg-[#F3F4F6] text-[#111111]'
                    }`}
                  >
                    Group
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Rules, time limits, rounds..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] border-0"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingProgram(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Save program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Students to Program Modal */}
      {assigningProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col border border-[#E5E7EB] overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  Assign to {assigningProgram.name}
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Select students for this competition item
                </p>
              </div>
              <button
                onClick={() => {
                  setAssigningProgram(null);
                  setAssignError(null);
                }}
                disabled={isAssignSaving}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] hover:bg-gray-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Student Search */}
            <div className="px-4 pt-3 pb-1 border-b border-gray-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="text"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Search students..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#F3F4F6] text-xs text-[#111111] placeholder:text-[#9CA3AF] border-0 focus:outline-none focus:ring-1 focus:ring-[#D4202C]"
                />
              </div>
            </div>

            {assignError && (
              <div className="mx-4 mt-3 p-2.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-[#D4202C]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{assignError}</span>
              </div>
            )}

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {filteredAssignStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#6B7280]">
                  No matching students.
                </div>
              ) : (
                filteredAssignStudents.map((s) => {
                  const isSelected = selectedStudentIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleStudentSelect(s.id)}
                      className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#F3F4F6] border-2 border-[#D4202C]'
                          : 'bg-[#F3F4F6] border-2 border-transparent'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-[#111111]">
                          {s.fullName}
                        </div>
                        <div className="text-[11px] text-[#6B7280]">
                          @{s.username}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="accent-[#D4202C] w-4 h-4 cursor-pointer"
                      />
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-[#F3F4F6] flex justify-end gap-2 bg-gray-50/50">
              <button
                type="button"
                onClick={() => {
                  setAssigningProgram(null);
                  setAssignError(null);
                }}
                disabled={isAssignSaving}
                className="px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProgramAssignment}
                disabled={!hasAssignmentChanges || isAssignSaving}
                className="px-4 py-2 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                {isAssignSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save assignments ({selectedStudentIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Remove student via "x" on chip */}
      {studentToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm border border-[#E5E7EB] overflow-hidden p-5 space-y-4 shadow-xl">
            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-[#111111]">
                Remove student?
              </h3>
              <p className="text-sm text-[#374151] leading-relaxed">
                Remove <span className="font-semibold text-[#111111]">{studentToRemove.studentName}</span> from <span className="font-semibold text-[#111111]">{studentToRemove.programName}</span>?
              </p>
            </div>

            {removeError && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-[#D4202C]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{removeError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setStudentToRemove(null);
                  setRemoveError(null);
                }}
                disabled={isRemovingStudent}
                className="px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveStudent}
                disabled={isRemovingStudent}
                className="px-4 py-2 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isRemovingStudent && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Students to Guide Modal */}
      {isAssigningGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col border border-[#E5E7EB] overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  Assign Students to Guide
                </h3>
                <p className="text-[13px] text-[#6B7280]">
                  Select supervisor and assign mentees
                </p>
              </div>
              <button
                onClick={() => setIsAssigningGuide(false)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Choose guide
                </label>
                <select
                  value={selectedGuideId}
                  onChange={(e) => setSelectedGuideId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] border-0"
                >
                  {guides.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Select students ({guideStudentIds.length} selected)
                </label>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {students.map((s) => {
                    const isSelected = guideStudentIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleGuideStudentSelect(s.id)}
                        className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer ${
                          isSelected ? 'bg-gray-200' : 'bg-[#F3F4F6]'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs text-[#111111]">
                            {s.fullName}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="accent-[#D4202C] w-4 h-4"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-[#F3F4F6] flex justify-end gap-2">
              <button
                onClick={() => setIsAssigningGuide(false)}
                className="px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold text-[#111111] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGuideAssignment}
                disabled={guideStudentIds.length === 0}
                className="px-4 py-2 rounded-[10px] bg-[#D4202C] hover:bg-[#B81B26] active:bg-[#B81B26] text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                Assign {guideStudentIds.length} students
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

