import { Router } from 'express';
import { db } from '../db';
import { AuthenticatedRequest } from '../auth';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// Helper: Normalize names for matching
function normalizeName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u02bb\u02bc\u02bd\u02be\u02bf\u2018\u2019'`ʾʿ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * GET /api/program-guides
 * Fetch program-guide assignments with role-based access control.
 * Admins get all (or filtered).
 * Guides get only their own assignments.
 * Students get only their own assignments.
 */
router.get('/', async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { studentId, programId, guideId } = req.query as Record<string, string | undefined>;

  let filterStudentId = studentId;
  let filterGuideId = guideId;
  const filterProgramId = programId;

  // Role permissions enforcement
  if (user.role === 'student') {
    filterStudentId = user.id;
  } else if (user.role === 'guide') {
    filterGuideId = user.id;
  }

  const rawAssignments = db.getStudentProgramGuides({
    studentId: filterStudentId,
    programId: filterProgramId,
    guideId: filterGuideId,
  });

  // Enrich assignments with full profiles and program details from DB / Supabase
  let profilesMap = new Map<string, any>();
  let programsMap = new Map<string, any>();

  if (supabaseAdmin) {
    const { data: profs } = await supabaseAdmin.from('profiles').select('id, full_name, username, role, notification_email, guide_id');
    (profs || []).forEach((p: any) => profilesMap.set(p.id, p));

    const { data: progs } = await supabaseAdmin.from('programs').select('id, name, kind, category');
    (progs || []).forEach((p: any) => programsMap.set(p.id, p));
  } else {
    db.getUsers().forEach((u) => profilesMap.set(u.id, u));
    db.getPrograms().forEach((p) => programsMap.set(p.id, p));
  }

  // Include legacy guide_id assignments if not already present in rawAssignments
  const allAssignments = [...rawAssignments];
  profilesMap.forEach((p, sId) => {
    const legacyGuideId = p.guide_id || p.guideId;
    if (legacyGuideId && p.role === 'student') {
      if (filterStudentId && filterStudentId !== sId) return;
      if (filterGuideId && filterGuideId !== legacyGuideId) return;
      const alreadyHas = allAssignments.some(
        (a) => a.studentId === sId && a.guideId === legacyGuideId
      );
      if (!alreadyHas) {
        allAssignments.push({
          id: `legacy-${sId}-${legacyGuideId}`,
          studentId: sId,
          programId: 'general',
          guideId: legacyGuideId,
          createdAt: p.created_at || new Date().toISOString(),
          assignedBy: 'legacy_system',
        });
      }
    }
  });

  const enriched = allAssignments.map((a) => {
    const student = profilesMap.get(a.studentId);
    const guide = profilesMap.get(a.guideId);
    const prog = programsMap.get(a.programId);

    const isGeneral = !a.programId || a.programId === 'general';
    return {
      id: a.id,
      studentId: a.studentId,
      studentName: student?.full_name || student?.fullName || student?.username || 'Student',
      studentRoll: student?.username || '',
      programId: a.programId || 'general',
      programName: isGeneral ? 'General Guide' : (prog?.name || 'Program'),
      programCategory: isGeneral ? 'General' : (prog?.category || 'Stage'),
      guideId: a.guideId,
      guideName: guide?.full_name || guide?.fullName || guide?.username || 'Guide',
      guideUsername: guide?.username || '',
      guideEmail: guide?.notification_email || guide?.email || null,
      createdAt: a.createdAt,
      assignedBy: a.assignedBy,
    };
  });

  return res.json({ assignments: enriched });
});

/**
 * POST /api/program-guides/bulk-preview
 * Previews the effect of assigning guides to students before saving.
 * Admin only.
 */
router.post('/bulk-preview', async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin permission required' });
  }

  const { programId, studentIds, guideIds, mode = 'add' } = req.body || {};

  if (!programId || !Array.isArray(studentIds) || !Array.isArray(guideIds)) {
    return res.status(400).json({ error: 'programId, studentIds array, and guideIds array are required.' });
  }

  let profilesMap = new Map<string, any>();
  let programName = 'Program';

  if (supabaseAdmin) {
    const { data: profs } = await supabaseAdmin.from('profiles').select('id, full_name, username, role, notification_email');
    (profs || []).forEach((p: any) => profilesMap.set(p.id, p));

    const { data: prog } = await supabaseAdmin.from('programs').select('name').eq('id', programId).maybeSingle();
    if (prog) programName = prog.name;
  } else {
    db.getUsers().forEach((u) => profilesMap.set(u.id, u));
    const p = db.findProgramById(programId);
    if (p) programName = p.name;
  }

  const existingAssignments = db.getStudentProgramGuides({ programId });
  const preview = studentIds.map((sId) => {
    const student = profilesMap.get(sId);
    const currentForStudent = existingAssignments.filter((a) => a.studentId === sId);
    const currentGuideIds = currentForStudent.map((a) => a.guideId);

    const guidesToAdd = guideIds.filter((gId) => !currentGuideIds.includes(gId));
    const guidesToRemove = mode === 'replace'
      ? currentGuideIds.filter((gId) => !guideIds.includes(gId))
      : [];
    const guidesToKeep = currentGuideIds.filter((gId) => !guidesToRemove.includes(gId));

    return {
      studentId: sId,
      studentName: student?.full_name || student?.fullName || student?.username || 'Student',
      studentRoll: student?.username || '',
      currentGuides: currentForStudent.map((a) => {
        const g = profilesMap.get(a.guideId);
        return {
          id: a.guideId,
          name: g?.full_name || g?.fullName || g?.username || 'Guide',
          email: g?.notification_email || g?.email || null,
        };
      }),
      proposedGuides: [
        ...guidesToKeep.map((id) => profilesMap.get(id)),
        ...guidesToAdd.map((id) => profilesMap.get(id)),
      ]
        .filter(Boolean)
        .map((g) => ({
          id: g.id,
          name: g.full_name || g.fullName || g.username || 'Guide',
          email: g.notification_email || g.email || null,
        })),
      addCount: guidesToAdd.length,
      removeCount: guidesToRemove.length,
      guidesToAddNames: guidesToAdd.map((id) => profilesMap.get(id)?.full_name || profilesMap.get(id)?.fullName || 'Guide'),
      guidesToRemoveNames: guidesToRemove.map((id) => profilesMap.get(id)?.full_name || profilesMap.get(id)?.fullName || 'Guide'),
    };
  });

  return res.json({
    programId,
    programName,
    mode,
    affectedStudentsCount: preview.length,
    students: preview,
  });
});

/**
 * POST /api/program-guides/assign
 * Assign guides to students for a program.
 * Admin only.
 */
router.post('/assign', async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin permission required' });
  }

  const {
    programId: rawProgramId,
    studentIds: rawStudentIds,
    guideIds: rawGuideIds,
    studentId,
    guideId,
    mode = 'add',
  } = req.body || {};

  const programId = rawProgramId || 'general';
  const studentIds: string[] = Array.isArray(rawStudentIds)
    ? rawStudentIds
    : (studentId ? [studentId] : []);
  const guideIds: string[] = Array.isArray(rawGuideIds)
    ? rawGuideIds
    : (guideId ? [guideId] : []);

  if (studentIds.length === 0 || guideIds.length === 0) {
    return res.status(400).json({ error: 'studentIds (or studentId) and guideIds (or guideId) are required.' });
  }

  const assignmentsToMake: Array<{ studentId: string; programId: string; guideId: string }> = [];
  for (const sId of studentIds) {
    for (const gId of guideIds) {
      assignmentsToMake.push({
        studentId: sId,
        programId,
        guideId: gId,
      });
    }
  }

  const result = db.assignStudentProgramGuides(
    assignmentsToMake,
    mode === 'replace' ? 'replace' : 'add',
    { id: user.id, name: user.fullName }
  );

  // Sync Supabase profiles.guide_id for backward compatibility
  if (supabaseAdmin && guideIds.length > 0) {
    try {
      await supabaseAdmin
        .from('profiles')
        .update({ guide_id: guideIds[0] })
        .in('id', studentIds);
    } catch (sbErr) {
      console.warn('Non-fatal: could not sync profiles.guide_id in Supabase:', sbErr);
    }
  }

  const studentCount = studentIds.length;
  const guideCount = guideIds.length;
  const message = mode === 'replace'
    ? `Replaced guides for ${studentCount} ${studentCount === 1 ? 'student' : 'students'} (${guideCount} ${guideCount === 1 ? 'guide' : 'guides'} assigned).`
    : `Assigned ${guideCount} ${guideCount === 1 ? 'guide' : 'guides'} to ${studentCount} ${studentCount === 1 ? 'student' : 'students'}.`;

  return res.json({
    success: true,
    message,
    result,
  });
});

/**
 * POST /api/program-guides/remove
 * Remove a single guide from a student's program mentorship.
 * Admin only.
 */
router.post('/remove', async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin permission required' });
  }

  const { studentId, programId = 'general', guideId } = req.body || {};
  if (!studentId || !guideId) {
    return res.status(400).json({ error: 'studentId and guideId are required.' });
  }

  // Remove specific program or general
  let removed = db.removeStudentProgramGuide(studentId, programId, guideId, {
    id: user.id,
    name: user.fullName,
  });

  // If not found under specified program, try 'general' or try any matching program
  if (!removed) {
    removed = db.removeStudentProgramGuide(studentId, 'general', guideId, {
      id: user.id,
      name: user.fullName,
    });
  }

  // Check remaining guides for student
  const remaining = db.getStudentProgramGuides({ studentId });
  const remainingGuideIds = Array.from(new Set(remaining.map(r => r.guideId)));

  if (supabaseAdmin) {
    try {
      await supabaseAdmin
        .from('profiles')
        .update({ guide_id: remainingGuideIds[0] || null })
        .eq('id', studentId);
    } catch (sbErr) {
      console.warn('Non-fatal: could not sync profiles.guide_id on remove:', sbErr);
    }
  }

  return res.json({
    success: true,
    message: 'Guide assignment removed successfully.',
    remainingGuidesCount: remainingGuideIds.length,
  });
});

/**
 * Coach List PDF canonical parsed data (from attached PDF)
 */
const COACH_LIST_PDF_RECORDS = [
  // Page 1: Non Stage
  { sl: 'ANN1', program: 'ACADEMIC ESSAY URD', category: 'Non-Stage', isTeam: false, pairings: [
    { candidate: 'MUSHARRAF RAZA', mentor: 'ASHRAF ALIMI USTAD' },
    { candidate: 'SARFRAZ ANSARI', mentor: 'HASAN NAWAZ USTAD' },
  ]},
  { sl: 'ANN2', program: 'ACADEMIC ESSAY ENG', category: 'Non-Stage', isTeam: false, pairings: [
    { candidate: 'NOOR HASAN', mentor: 'SIDDIQUE USTAD' },
    { candidate: 'UMAR ATEEQUE', mentor: 'UZAIR' },
  ]},
  { sl: 'ANN3', program: 'ESSAY ARB', category: 'Non-Stage', isTeam: false, pairings: [
    { candidate: 'SAIDUZZAMA', mentor: 'AJMAL USTAD' },
    { candidate: 'SADAF ZIYA', mentor: 'AJMAL USTAD' },
  ]},
  { sl: 'ANN4', program: 'TAHLEEL AL-\'IBARAH', altProgram: 'HAL AL-’IBARAH', category: 'Non-Stage', isTeam: false, pairings: [
    { candidate: 'SAIDUZZAMA', mentor: 'SHUHAIB USTAD' },
  ]},
  { sl: 'ANN5', program: 'TAZMEEN WRITING URD', category: 'Non-Stage', isTeam: false, pairings: [
    { candidate: 'MOHD RAZA', mentor: 'HASSAN NAWAZ USTAD' },
    { candidate: 'MUHAMMED RAZA', mentor: 'HASSAN NAWAZ USTAD' },
    { candidate: 'BASHARAT KARIM', mentor: 'HASSAN NAWAZ USTAD' },
  ]},
  { sl: 'ANN6', program: 'POEM ENG', category: 'Non-Stage', isTeam: false, pairings: [
    { candidate: 'GULAM DASTAGIR', mentor: 'SIDDIQUE USTAD' },
    { candidate: 'KAUNAIN', mentor: 'ZAIN ABD' },
  ]},
  { sl: 'ANN7', program: 'POEM ARB', category: 'Non-Stage', isTeam: false, pairings: [
    { candidate: 'SADAF ZIYA', mentor: 'AJMAL USTAD' },
    { candidate: 'KHAYUF DAKANI', altCandidate: 'Khayuf', mentor: 'AJMAL USTAD' },
  ]},
  { sl: 'ANN8', program: 'ABSTRACT WRITING ENG', category: 'Non-Stage', isTeam: false, pairings: [
    { candidate: 'NOOR HASAN', mentor: 'MUNAWWAR USTAD' },
    { candidate: 'SUFIYAN AHMED', mentor: 'YOUSUF KAMAL' },
  ]},
  { sl: 'ANN9', program: 'FICTION STORY ENG', category: 'Non-Stage', isTeam: false, pairings: [
    { candidate: 'MD ZAID', mentor: 'ASWIM SAEED USTAD' },
    { candidate: 'UMAR ATEEQUE', mentor: 'MUZZAMIL' },
  ]},
  { sl: 'ANN10', program: 'CARICATURE', category: 'Non-Stage', isTeam: false, pairings: [
    { candidate: 'ZEESHAN SHAIKH', mentor: 'MUNAWWAR USTAD' },
    { candidate: 'THAJUDDIN', altCandidate: 'Tajuddin', mentor: 'FADHI(10)' },
  ]},

  // Page 1: Off Stage
  { sl: 'ANO11', program: 'VIDEO EDITING', category: 'Off-Stage', isTeam: false, pairings: [
    { candidate: 'ZEESHAN', altCandidate: 'Zeeshan Shaikh', mentor: 'RABEEH KT' },
  ]},
  { sl: 'ANO12', program: 'LOGICAL REASONING', category: 'Off-Stage', isTeam: false, pairings: [
    { candidate: 'MOHD RAZA', mentor: 'SHANID USTAD' },
  ]},
  { sl: 'ANO13', program: 'MR.ENGLISH', category: 'Off-Stage', isTeam: false, pairings: [
    { candidate: 'SYED FAZAL', mentor: 'SIDDIQUE USTAD' },
  ]},
  { sl: 'ANO14', program: 'AL\'ARABI', altProgram: 'AL ʿARABI', category: 'Off-Stage', isTeam: false, pairings: [
    { candidate: 'SAIDUZZAMA', mentor: 'SHUHAIB USTAD' },
  ]},
  { sl: 'ANO15', program: 'BIZ QUIZ', category: 'Off-Stage', isTeam: false, pairings: [
    { candidate: 'MUNEEBBUR RAHEMAN', mentor: 'SHARFU USTAD' },
  ]},
  { sl: 'ANO16', program: 'CIVIC QUEST', category: 'Off-Stage', isTeam: false, pairings: [
    { candidate: 'NOOR HASAN', mentor: 'MUNAWAR USTAD' },
  ]},
  { sl: 'ANO17', program: 'PHOTOGRAPHY', category: 'Off-Stage', isTeam: false, pairings: [
    { candidate: 'MOHAMMD GUKSHAD', altCandidate: 'Muhammed Gulshad', mentor: 'ASLAM USTAD(STUDIO)' },
  ]},
  { sl: 'ANO18', program: 'DIGITAL TABLOID ARB', category: 'Off-Stage', isTeam: false, pairings: [
    { candidate: 'SYED FAZAL', mentor: 'AFSAL USTAD' },
    { candidate: 'SAIDUZZAMA', mentor: 'AFSAL USTAD' },
    { candidate: 'NOOR HASAN', mentor: 'AFSAL USTAD' },
    { candidate: 'SAJID', altCandidate: 'Sajid Ansari', mentor: 'AFSAL USTAD' },
  ]},
  { sl: 'ANO19', program: 'COVER DESIGNING', altProgram: 'COVER DESIGNING ENG', category: 'Off-Stage', isTeam: false, pairings: [
    { candidate: 'ZEESHAN SHAIKH', mentor: 'MISHAL USTAD' },
  ]},

  // Page 1: Stage
  { sl: 'ANS20', program: 'QURAN TALENT', altProgram: 'QURʾĀN TALENT', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'SAMDANI', mentor: 'NIYAS USTAD' },
    { candidate: 'SAMDANI', mentor: 'ANAS U' },
  ]},
  { sl: 'ANS21', program: 'KHUTBAH', altProgram: 'KHUṬBAH', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'SWABIR RAZA', altCandidate: 'Swabir', mentor: 'MUHAMMED USTAD' },
    { candidate: 'SWABIR RAZA', altCandidate: 'Swabir', mentor: 'ANAS U' },
  ]},

  // Page 2: Stage
  { sl: 'ANS22', program: 'LECTURE ENG', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'FARHAN KHAN', mentor: 'ASWIM USTAD' },
    { candidate: 'FARHAN KHAN', mentor: 'SAHAL ZAKARIYA' },
  ]},
  { sl: 'ANS23', program: 'GAZAL URDU', altProgram: 'GAZAL URD', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'MAHBUB RAZA', altCandidate: 'Mahboob', mentor: 'JAVED RAZA' },
  ]},
  { sl: 'ANS24', program: 'SIYASI TAQREER URDU', altProgram: 'SIYASI THAQREER URD', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'SARFRAZ ANSARI', mentor: 'AJMAL USTAD (CHS)' },
  ]},
  { sl: 'ANS25', program: 'ACADEMIC TALK ENG', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'SUFIYAN AHMED', mentor: 'ASWIM USTAD' },
  ]},
  { sl: 'ANS26', program: 'MOTIVATION TALK ENG', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'FARHAN KHAN', mentor: 'SIDDIQUE USTAD' },
  ]},
  { sl: 'ANS27', program: 'DOCU NARRATION ARB', altProgram: 'DOCUMENTARY NARRATION ARB', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'SAMDANI', mentor: 'AJMAL USTAD' },
    { candidate: 'SAMDANI', mentor: 'SHAKEEB' },
  ]},
  { sl: 'ANS28', program: 'MR. TRANSLATOR', altProgram: 'Mr.TRASNSLATOR', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'SADAF ZIYA', mentor: 'MUZZAMIL USTAD' },
    { candidate: 'SADAF ZIYA', mentor: 'FAHEEM KHAN' },
  ]},
  { sl: 'ANS29', program: 'AL FAQIH', altProgram: 'AL FAQĪH', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'TARIQUE ATHAR', mentor: 'ASHRAF ALIMI USTAD' },
    { candidate: 'TARIQUE ATHAR', mentor: 'MUSTAQEEM USTAD' },
  ]},
  { sl: 'ANS30', program: 'PROUD MUSLIM', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'IMTIYAZ AHMED', mentor: 'MUNAWAR USTAD' },
  ]},
  { sl: 'ANS31', program: 'MOCK INTERVIEW', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'NOOR HASAN', mentor: 'SHAHJAHAN USTAD' },
  ]},
  { sl: 'ANS32', program: 'SADA E IQBAL', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'HASAN', mentor: 'AJMAL' },
    { candidate: 'FAISAL', mentor: 'AJMAL' },
    { candidate: 'SABIR', mentor: 'AJMAL' },
    { candidate: 'HASAN', mentor: 'JAVED RAZA' },
  ]},
  { sl: 'ANS33', program: 'NAHREER', altProgram: 'NAHAREER', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'SAEED', mentor: 'HOD USTAD' },
    { candidate: 'MUBEEN', mentor: 'HOD USTAD' },
    { candidate: 'ARSALAN', mentor: 'HOD USTAD' },
  ]},
  { sl: 'ANS34', program: 'LENGUA', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'MASOOD ANSARI', altCandidate: 'Masood', mentor: 'AJMAL USTAD' },
  ]},

  // Page 2: Kulliyyah General Non Stage
  { sl: 'KN1', program: 'DIGITAL MAGAZINE', category: 'Non-Stage', isTeam: true, teamLeader: 'SHAYAQUE', pairings: [
    { candidate: 'SHAYAQUE', mentor: 'SHAHJAHAN USTAD' },
  ]},
  { sl: 'KN2', program: 'HERITAGE DOCUMENTARY', category: 'Non-Stage', isTeam: true, teamLeader: 'UBAIDULLAH', pairings: [
    { candidate: 'UBAIDULLAH', mentor: 'MUNAWAR USTAD' },
  ]},
  { sl: 'KN3', program: 'PODCAST', category: 'Non-Stage', isTeam: true, teamLeader: 'FARHAN KHAN', pairings: [
    { candidate: 'FARHAN KHAN', mentor: 'NIYAS USTAD' },
  ]},

  // Page 2: Kulliyyah General Stage
  { sl: 'KNS4', program: 'QAWWALI URD', category: 'Stage', isTeam: true, teamLeader: 'WALLAIL', pairings: [
    { candidate: 'WALLAIL', mentor: 'JAVED' },
    { candidate: 'WALLAIL', mentor: 'TANVEER' },
    { candidate: 'WALLAIL', mentor: 'GULAM' },
  ]},
  { sl: 'KNS5', program: 'DEBATE URD', altProgram: 'DEBATE URDU', category: 'Stage', isTeam: true, pairings: [
    { candidate: 'SHAYAQUE', mentor: 'AJMAL' },
    { candidate: 'SARFRAZ', mentor: 'AJMAL' },
    { candidate: 'MUSHARRAF', mentor: 'AJMAL' },
    { candidate: 'SABIR', mentor: 'AJMAL' },
  ]},
  { sl: 'KNS6', program: 'BP DEBATE', altProgram: 'DEBATE ENGLISH', category: 'Stage', isTeam: false, pairings: [
    { candidate: 'NOOR HASAN', mentor: 'SIDDIQUE USTD' },
    { candidate: 'SUFIYAN', mentor: 'SAHAL ZAKARIYA' },
  ]},
  { sl: 'KNS7', program: 'MUNAZARAH', altProgram: 'MUNĀẒARAH', category: 'Stage', isTeam: true, pairings: [
    { candidate: 'SAIDUZZAMA', mentor: 'SHAKEEB T' },
    { candidate: 'SADAF', mentor: 'SHAKEEB T' },
    { candidate: 'ARIF', mentor: 'SHAKEEB T' },
  ]},
  { sl: 'KNS8', program: 'TAHADI AL SHIR', category: 'Stage', isTeam: true, pairings: [
    { candidate: 'MASOOD', mentor: 'YOUNUS USTAD' },
    { candidate: 'AYAN', mentor: 'YOUNUS USTAD' },
    { candidate: 'FAHAD', mentor: 'YOUNUS USTAD' },
  ]},
  { sl: 'KNS9', program: 'BAITH BAZI', category: 'Stage', isTeam: true, pairings: [
    { candidate: 'BASHARAT', mentor: 'HASAN USTD' },
    { candidate: 'ANAS', mentor: 'AJMAL USTD' },
    { candidate: 'SHAHBAZ', mentor: 'TANVEER' },
  ]},
];

/**
 * GET /api/program-guides/coach-list-preview
 * Parse and match coach list PDF entries against actual database records.
 * Admin only.
 */
router.get('/coach-list-preview', async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin permission required' });
  }

  // Load programs, profiles, and program_members
  let allProfiles: any[] = [];
  let allPrograms: any[] = [];
  let allMembers: any[] = [];

  if (supabaseAdmin) {
    const { data: profs } = await supabaseAdmin.from('profiles').select('id, full_name, username, role, notification_email');
    allProfiles = profs || [];

    const { data: progs } = await supabaseAdmin.from('programs').select('id, name, kind, category');
    allPrograms = progs || [];

    const { data: mems } = await supabaseAdmin.from('program_members').select('program_id, student_id');
    allMembers = mems || [];
  } else {
    allProfiles = db.getUsers();
    allPrograms = db.getPrograms();
  }

  const students = allProfiles.filter((p) => p.role === 'student');
  const guides = allProfiles.filter((p) => p.role === 'guide');

  // Helper matching functions
  const matchStudent = (name: string, altName?: string) => {
    const clean = normalizeName(name);
    const cleanAlt = altName ? normalizeName(altName) : '';

    return students.find((s) => {
      const sFull = normalizeName(s.full_name || s.fullName || '');
      const sUser = normalizeName(s.username || '');
      if (sFull === clean || sUser === clean) return true;
      if (cleanAlt && (sFull === cleanAlt || sUser === cleanAlt)) return true;
      if (clean.length > 3 && sFull.includes(clean)) return true;
      if (cleanAlt.length > 3 && sFull.includes(cleanAlt)) return true;
      return false;
    });
  };

  const matchGuide = (mentorName: string) => {
    const clean = normalizeName(mentorName)
      .replace(/\bustad\b/g, '')
      .replace(/\bustd\b/g, '')
      .replace(/\(chs\)/g, '')
      .replace(/\(studio\)/g, '')
      .replace(/\(10\)/g, '')
      .trim();

    return guides.find((g) => {
      const gFull = normalizeName(g.full_name || g.fullName || '')
        .replace(/\bhudawi\b/g, '')
        .replace(/\balimi\b/g, '')
        .replace(/\bsir\b/g, '')
        .trim();
      const gUser = normalizeName(g.username || '');

      if (gFull === clean || gUser === clean) return true;
      if (clean === 'siddique' && (gFull.includes('sidheeq') || gUser.includes('aboobacker'))) return true;
      if (clean === 'munawwar' || clean === 'munawar') {
        if (gFull.includes('munavir') || gUser.includes('munavir')) return true;
      }
      if (clean === 'hasan nawaz' || clean === 'hasan') {
        if (gFull.includes('hassan nawaz') || gFull.includes('hasan')) return true;
      }
      if (clean === 'aswim' || clean === 'aswim saeed') {
        if (gFull.includes('aswim') || gUser.includes('aswim')) return true;
      }
      if (clean === 'sharfu') {
        if (gFull.includes('sharafudheen') || gUser.includes('sharafudheen')) return true;
      }
      if (clean === 'shuhaib') {
        if (gFull.includes('shuaib') || gUser.includes('shuaib')) return true;
      }
      if (clean === 'younus') {
        if (gFull.includes('yoonus') || gUser.includes('yoonus')) return true;
      }
      if (clean.length > 3 && gFull.includes(clean)) return true;
      return false;
    });
  };

  const matchProgram = (progName: string, altProgName?: string) => {
    const clean = normalizeName(progName);
    const cleanAlt = altProgName ? normalizeName(altProgName) : '';

    return allPrograms.find((p) => {
      const pName = normalizeName(p.name);
      if (pName === clean) return true;
      if (cleanAlt && pName === cleanAlt) return true;
      if (clean === 'tahleel al-\'ibarah' && (pName.includes('ibarah') || pName.includes('hal'))) return true;
      if (clean === 'mr.english' && pName.includes('english')) return true;
      if (clean === 'bp debate' && (pName.includes('debate english') || pName.includes('debate'))) return true;
      return false;
    });
  };

  const existingAssignments = db.getStudentProgramGuides();

  const previewItems = COACH_LIST_PDF_RECORDS.map((rec) => {
    const dbProg = matchProgram(rec.program, rec.altProgram);
    const resolvedProgId = dbProg?.id || null;

    let hasMissingGuide = false;
    let hasMissingStudent = false;

    const analyzedPairings = rec.pairings.map((pair) => {
      const student = matchStudent(pair.candidate, (pair as any).altCandidate);
      const guide = matchGuide(pair.mentor);

      let status: 'ready' | 'missing_guide' | 'missing_student' | 'unclear' | 'team' = 'ready';
      let note: string | undefined = undefined;

      if (!guide) {
        status = 'missing_guide';
        hasMissingGuide = true;
        note = `No existing guide account found for "${pair.mentor}". Account creation required.`;
      } else if (!student) {
        status = 'missing_student';
        hasMissingStudent = true;
        note = `Student "${pair.candidate}" not found in registered accounts.`;
      } else if (resolvedProgId) {
        // Check if student is enrolled in this program
        const isEnrolled = allMembers.some((m) => m.program_id === resolvedProgId && m.student_id === student.id);
        const isAssignedAlready = existingAssignments.some(
          (a) => a.programId === resolvedProgId && a.studentId === student.id && a.guideId === guide.id
        );

        if (isAssignedAlready) {
          note = 'Already assigned';
        } else if (!isEnrolled) {
          note = `Candidate enrolled in different roster; enrollment approval needed.`;
        }
      }

      if (rec.isTeam) {
        status = guide ? 'team' : 'missing_guide';
      }

      return {
        candidateName: pair.candidate,
        studentId: student?.id || null,
        studentName: student?.full_name || student?.fullName || undefined,
        studentRoll: student?.username || undefined,
        mentorName: pair.mentor,
        guideId: guide?.id || null,
        guideName: guide?.full_name || guide?.fullName || undefined,
        guideUsername: guide?.username || undefined,
        status,
        note,
      };
    });

    let overallStatus: 'ready' | 'partial' | 'review_required' = 'ready';
    if (!dbProg || hasMissingStudent) {
      overallStatus = 'review_required';
    } else if (hasMissingGuide) {
      overallStatus = 'partial';
    }

    return {
      slNo: rec.sl,
      programName: rec.program,
      dbProgramId: resolvedProgId,
      matchedProgramName: dbProg?.name || null,
      category: rec.category,
      isTeam: rec.isTeam,
      pairings: analyzedPairings,
      status: overallStatus,
      notes: !dbProg ? 'Program not found in DB.' : undefined,
    };
  });

  return res.json({
    totalRows: previewItems.length,
    readyCount: previewItems.filter((p) => p.status === 'ready').length,
    partialCount: previewItems.filter((p) => p.status === 'partial').length,
    reviewCount: previewItems.filter((p) => p.status === 'review_required').length,
    items: previewItems,
  });
});

/**
 * POST /api/program-guides/import-coach-list
 * Commits approved pairings from coach list into student_program_guides.
 * Admin only.
 */
router.post('/import-coach-list', async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin permission required' });
  }

  const { approvedPairings } = req.body || {};
  if (!Array.isArray(approvedPairings) || approvedPairings.length === 0) {
    return res.status(400).json({ error: 'approvedPairings array is required.' });
  }

  // Filter out any without valid studentId, programId, guideId
  const validAssignments = approvedPairings.filter(
    (p: any) => p.studentId && p.programId && p.guideId
  ).map((p: any) => ({
    studentId: p.studentId,
    programId: p.programId,
    guideId: p.guideId,
    assignedBy: user.id,
  }));

  if (validAssignments.length === 0) {
    return res.status(400).json({ error: 'No valid assignments provided to import.' });
  }

  const result = db.assignStudentProgramGuides(validAssignments, 'add', {
    id: user.id,
    name: user.fullName,
  });

  return res.json({
    success: true,
    message: `Imported ${result.added} mentor assignments successfully.`,
    result,
  });
});

/**
 * GET /api/program-guides/audit-logs
 * Returns audit log entries of assignment changes.
 * Admin only.
 */
router.get('/audit-logs', (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin permission required' });
  }

  const logs = db.getAuditLogs().filter(
    (l) => l.action.includes('program_guide') || l.action.includes('assign') || l.action.includes('remove')
  );

  return res.json({ logs });
});

export default router;
