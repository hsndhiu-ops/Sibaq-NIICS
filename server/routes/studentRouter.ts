import { Router } from 'express';
import { db, getKolkataDateString } from '../db';
import { requireStudent, AuthenticatedRequest } from '../auth';

const router = Router();
router.use(requireStudent);

// Student Home: greeting, exactly three numbers (streak, total points, rank), today's status, tasks due
router.get('/home', (req: AuthenticatedRequest, res) => {
  const studentId = req.user!.id;
  const today = getKolkataDateString();

  const streak = db.calculateStreak(studentId, today);
  const totalPoints = db.calculateTotalPoints(studentId);

  // Compute rank from leaderboard
  const leaderboard = db.getLeaderboard();
  const myEntry = leaderboard.find((e) => e.studentId === studentId);
  const rank = myEntry ? myEntry.rank : leaderboard.length;

  const todayRecord = db.ensureStudentAttendance(studentId, today);

  const allTasks = db.getTasksForStudent(studentId);
  // Assigned and submitted tasks appear under pending/active tasks
  const pendingTasks = allTasks.filter((t) => t.status === 'assigned' || t.status === 'submitted');
  const completedTasks = allTasks.filter((t) => t.status === 'completed');

  const programs = db.getStudentPrograms(studentId);
  const guide = null;
  const remarks = db.getRemarksForStudent(studentId);
  const screenshot = db.getStudentScreenshot(studentId, today);

  // Compute all assigned guides (multiple guides per student, program-linked)
  const rawAssignments = db.getStudentProgramGuides({ studentId });
  const allUsers = db.getUsers();
  const allPrograms = db.getPrograms();

  const userMap = new Map<string, any>();
  allUsers.forEach((u) => userMap.set(u.id, u));

  const progMap = new Map<string, any>();
  allPrograms.forEach((p) => progMap.set(p.id, p));

  const assignments = [...rawAssignments];

  const guideMap = new Map<string, { id: string; fullName: string; username: string; email: string | null; programs: string[]; isGeneral: boolean }>();

  for (const a of assignments) {
    const gUser = userMap.get(a.guideId);
    if (!gUser) continue;
    const isGen = !a.programId || a.programId === 'general';
    const prog = progMap.get(a.programId);
    const progName = isGen ? 'General Guide' : (prog?.name || 'Program');

    const existing = guideMap.get(a.guideId);
    if (existing) {
      if (!isGen && progName && !existing.programs.includes(progName)) {
        existing.programs.push(progName);
      }
      if (gUser.email && !existing.email) existing.email = gUser.email;
    } else {
      guideMap.set(a.guideId, {
        id: a.guideId,
        fullName: gUser.fullName || gUser.username || 'Guide',
        username: gUser.username || '',
        email: gUser.email || null,
        programs: isGen ? [] : [progName],
        isGeneral: isGen,
      });
    }
  }

  const allGuides = Array.from(guideMap.values());

  const programGuides = programs.map((prog) => {
    const matching = assignments.filter((a) => a.programId === prog.id);
    return {
      program: prog,
      guides: matching.map((a) => {
        const gu = userMap.get(a.guideId);
        return {
          id: a.guideId,
          fullName: gu?.fullName || gu?.username || 'Guide',
          username: gu?.username || '',
          email: gu?.email || null,
          assignmentId: a.id,
        };
      }),
    };
  });

  res.json({
    student: req.user,
    guide: null,
    generalGuide: null,
    allGuides,
    programGuides,
    streak,
    totalPoints,
    rank,
    totalStudents: leaderboard.length,
    todayRecord,
    pendingTasks,
    completedTasks,
    remarks,
    programs,
    hasUploadedScreenshotToday: !!screenshot,
  });
});

// Student Progress: attendance history, remarks, programs, screenshot record
router.get('/progress', (req: AuthenticatedRequest, res) => {
  const studentId = req.user!.id;
  const today = getKolkataDateString();

  const attendanceHistory = db.getStudentAttendanceHistory(studentId);
  const remarks = db.getRemarksForStudent(studentId);
  const programs = db.getStudentPrograms(studentId);
  const streak = db.calculateStreak(studentId, today);
  const totalPoints = db.calculateTotalPoints(studentId);
  const screenshotToday = db.getStudentScreenshot(studentId, today);

  const rawAssignments = db.getStudentProgramGuides({ studentId });
  const allUsers = db.getUsers();
  const allPrograms = db.getPrograms();
  const userMap = new Map<string, any>();
  allUsers.forEach((u) => userMap.set(u.id, u));
  const progMap = new Map<string, any>();
  allPrograms.forEach((p) => progMap.set(p.id, p));

  const assignments = [...rawAssignments];

  const programGuides = programs.map((prog) => {
    const matching = assignments.filter((a) => a.programId === prog.id);
    return {
      program: prog,
      guides: matching.map((a) => {
        const gu = userMap.get(a.guideId);
        return {
          id: a.guideId,
          fullName: gu?.fullName || gu?.username || 'Guide',
          username: gu?.username || '',
          email: gu?.email || null,
          assignmentId: a.id,
        };
      }),
    };
  });

  res.json({
    attendanceHistory,
    remarks,
    programs,
    programGuides,
    streak,
    totalPoints,
    hasUploadedScreenshotToday: !!screenshotToday,
  });
});

// Student Tasks: all tasks for student
router.get('/tasks', (req: AuthenticatedRequest, res) => {
  const studentId = req.user!.id;
  const tasks = db.getTasksForStudent(studentId);
  res.json({ tasks });
});

// Student submits task ("Mark as done"): changes status to 'awaiting_review'
router.post('/tasks/:id/submit', (req: AuthenticatedRequest, res) => {
  const studentId = req.user!.id;
  const taskId = req.params.id;
  const { submissionFileId, submissionFileName, submissionNote } = req.body;

  try {
    const task = db.submitTaskForReview(taskId, studentId, {
      submissionFileId,
      submissionFileName,
      submissionNote,
    });
    res.json({ task });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Backward compatibility: student complete endpoint routes to submission
router.post('/tasks/:id/complete', (req: AuthenticatedRequest, res) => {
  const studentId = req.user!.id;
  const taskId = req.params.id;
  const { submissionFileId, submissionFileName, submissionNote } = req.body;

  try {
    const task = db.submitTaskForReview(taskId, studentId, {
      submissionFileId,
      submissionFileName,
      submissionNote,
    });
    res.json({ task });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Student records screenshot upload
router.post('/screenshot', (req: AuthenticatedRequest, res) => {
  const studentId = req.user!.id;
  const today = getKolkataDateString();
  const { fileId, fileName, fileSize } = req.body;

  if (!fileId || !fileName) {
    return res.status(400).json({ error: 'fileId and fileName are required.' });
  }

  const record = db.recordScreenshot({
    studentId,
    date: today,
    fileId,
    fileName,
    fileSize: fileSize || 0,
  });

  res.json({ record, message: 'Screen time screenshot uploaded successfully.' });
});

export default router;
