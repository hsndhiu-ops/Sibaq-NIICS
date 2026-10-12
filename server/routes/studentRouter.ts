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
  // Assigned and awaiting_review tasks appear under pending/active tasks
  const pendingTasks = allTasks.filter((t) => t.status === 'assigned' || t.status === 'awaiting_review' || (t.status as any) === 'pending');
  const completedTasks = allTasks.filter((t) => t.status === 'completed');

  const programs = db.getStudentPrograms(studentId);
  const guide = req.user!.guideId ? db.findUserById(req.user!.guideId) : null;
  const remarks = db.getRemarksForStudent(studentId);
  const screenshot = db.getStudentScreenshot(studentId, today);

  res.json({
    student: req.user,
    guide: guide ? { id: guide.id, fullName: guide.fullName, username: guide.username } : null,
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

  res.json({
    attendanceHistory,
    remarks,
    programs,
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
