import React, { useState, useEffect } from 'react';
import { Program, User } from '../../types';
import { api } from '../../api';
import { Plus, Edit2, Trash2, Users, UserCheck, X } from 'lucide-react';

interface AdminProgramsProps {
  onNotify: (msg: string) => void;
}

export const AdminPrograms: React.FC<AdminProgramsProps> = ({ onNotify }) => {
  const [programs, setPrograms] = useState<any[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [guides, setGuides] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit Program modal
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [isCreatingProgram, setIsCreatingProgram] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'solo' | 'group'>('solo');
  const [description, setDescription] = useState('');

  // Assign students to program modal
  const [assigningProgram, setAssigningProgram] = useState<any | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProgram) {
        await api.updateProgram(editingProgram.id, { name, category, type, description });
        onNotify('Program updated successfully.');
      } else {
        await api.createProgram({ name, category, type, description });
        onNotify('Program created successfully.');
      }
      setIsCreatingProgram(false);
      setEditingProgram(null);
      setName('');
      setCategory('');
      setDescription('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save program');
    }
  };

  const handleDeleteProgram = async (id: string) => {
    if (!confirm('Are you sure you want to delete this program?')) return;
    try {
      await api.deleteProgram(id);
      onNotify('Program deleted.');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete program');
    }
  };

  const handleOpenAssignProgram = (prog: any) => {
    setAssigningProgram(prog);
    const currentAssigned = prog.students.map((s: any) => s.id);
    setSelectedStudentIds(currentAssigned);
  };

  const handleSaveProgramAssignment = async () => {
    if (!assigningProgram) return;
    try {
      await api.bulkAssignProgram(assigningProgram.id, selectedStudentIds);
      onNotify(`Assigned ${selectedStudentIds.length} students to ${assigningProgram.name}.`);
      setAssigningProgram(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to assign students');
    }
  };

  const handleSaveGuideAssignment = async () => {
    if (!selectedGuideId || guideStudentIds.length === 0) return;
    try {
      const res = await api.assignGuide(guideStudentIds, selectedGuideId);
      onNotify(res.message);
      setIsAssigningGuide(false);
      setGuideStudentIds([]);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to assign guide');
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

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#111111] tracking-tight">
            Programs
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAssigningGuide(true)}
            className="px-3 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111] hover:bg-gray-200"
          >
            Assign Guides
          </button>
          <button
            onClick={() => {
              setEditingProgram(null);
              setName('');
              setCategory('');
              setType('solo');
              setDescription('');
              setIsCreatingProgram(true);
            }}
            className="px-3 py-2 rounded-xl bg-[#EF4B47] text-white text-xs font-semibold hover:opacity-95 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New program</span>
          </button>
        </div>
      </div>

      {/* Program Cards */}
      {loading ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          Loading programs...
        </div>
      ) : programs.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F3F4F6] text-center text-sm text-[#6B7280]">
          No competition programs created yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programs.map((prog) => (
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
                    <p className="text-xs text-[#6B7280]">
                      {prog.category} • <span className="capitalize">{prog.type}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingProgram(prog);
                        setName(prog.name);
                        setCategory(prog.category);
                        setType(prog.type);
                        setDescription(prog.description);
                        setIsCreatingProgram(true);
                      }}
                      className="p-1.5 rounded-lg bg-white text-[#111111] hover:bg-gray-100"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProgram(prog.id)}
                      className="p-1.5 rounded-lg bg-white text-[#111111] hover:bg-gray-100"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#EF4B47]" />
                    </button>
                  </div>
                </div>

                {prog.description && (
                  <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
                    {prog.description}
                  </p>
                )}

                <div className="mt-3">
                  <span className="text-xs font-semibold text-[#6B7280] block mb-1">
                    Candidates ({prog.studentCount}):
                  </span>
                  {prog.studentCount === 0 ? (
                    <span className="text-xs text-[#6B7280]">No students assigned</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {prog.students.map((s: any) => (
                        <span
                          key={s.id}
                          className="px-2 py-0.5 rounded bg-white text-[11px] font-medium text-[#111111]"
                        >
                          {s.fullName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <button
                  onClick={() => handleOpenAssignProgram(prog)}
                  className="w-full py-2 rounded-xl bg-white text-xs font-semibold text-[#111111] hover:bg-gray-100"
                >
                  Manage candidates ({prog.studentCount})
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Program Create / Edit Modal */}
      {isCreatingProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <h3 className="font-bold text-base text-[#111111]">
                {editingProgram ? 'Edit Program' : 'New Competition Program'}
              </h3>
              <button
                onClick={() => setIsCreatingProgram(false)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111]"
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
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Stage, Non Stage , Off Stage"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-sm text-[#111111] border-0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] mb-1">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('solo')}
                    className={`py-2 rounded-xl text-xs font-semibold ${
                      type === 'solo'
                        ? 'bg-[#EF4B47] text-white'
                        : 'bg-[#F3F4F6] text-[#111111]'
                    }`}
                  >
                    Solo
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('group')}
                    className={`py-2 rounded-xl text-xs font-semibold ${
                      type === 'group'
                        ? 'bg-[#EF4B47] text-white'
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
                  className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#EF4B47] text-white text-xs font-semibold hover:opacity-95"
                >
                  Save program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Candidates to Program Modal */}
      {assigningProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  Assign to {assigningProgram.name}
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Select candidates for this competition item
                </p>
              </div>
              <button
                onClick={() => setAssigningProgram(null)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {students.map((s) => {
                const isSelected = selectedStudentIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleStudentSelect(s.id)}
                    className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#F3F4F6] border-2 border-[#EF4B47]'
                        : 'bg-[#F3F4F6]'
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
                      className="accent-[#EF4B47] w-4 h-4"
                    />
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-[#F3F4F6] flex justify-end gap-2">
              <button
                onClick={() => setAssigningProgram(null)}
                className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProgramAssignment}
                className="px-4 py-2 rounded-xl bg-[#EF4B47] text-white text-xs font-semibold hover:opacity-95"
              >
                Save assignments ({selectedStudentIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Students to Guide Modal */}
      {isAssigningGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[#F3F4F6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#111111]">
                  Assign Students to Guide
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Select supervisor and assign mentees
                </p>
              </div>
              <button
                onClick={() => setIsAssigningGuide(false)}
                className="p-1.5 rounded-lg bg-[#F3F4F6] text-[#111111]"
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
                  Select candidates ({guideStudentIds.length} selected)
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
                          className="accent-[#EF4B47] w-4 h-4"
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
                className="px-4 py-2 rounded-xl bg-[#F3F4F6] text-xs font-semibold text-[#111111]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGuideAssignment}
                disabled={guideStudentIds.length === 0}
                className="px-4 py-2 rounded-xl bg-[#EF4B47] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50"
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
