import { Router } from 'express';
import { db, getKolkataDateString } from '../db';
import { requireGuide, AuthenticatedRequest } from '../auth';
import { LadderLevel } from '../../src/types';

const router = Router();
router.use(requireGuide);

// Today's mentee roster for the logged in guide
router.get('/today', (req: AuthenticatedRequest, res) => {
  const guideId = req.user!.id;
  const date = (req.query.date as string) || getKolkataDateString();

  // Find all mentees assigned to this guide (direct guideId OR program-specific assignments)
  const allUsers = db.getUsers();
  const spgAssignments = db.getStudentProgramGuides({ guideId });
  const spgStudentIds = new Set(spgAssignments.map((a) => a.studentId));
  const mentees = allUsers.filter(
    (u) => u.role === 'student' && (u.guideId === guideId || spgStudentIds.has(u.id))
  );

  const attendanceList = db.getAttendanceForDate(date);
  const attendanceMap = new Map(attendanceList.map((a) => [a.studentId, a]));

  let presentCount = 0;

  const menteeItems = mentees.map((student) => {
    const attendance = attendanceMap.get(student.id) || db.ensureStudentAttendance(student.id, date);
    if (attendance.status === 'present') {
      presentCount++;
    }
    const programs = db.getStudentPrograms(student.id);
    const streak = db.calculateStreak(student.id, date);
    const totalPoints = db.calculateTotalPoints(student.id);

    const { passwordHash: _, ...safeStudent } = student;

    return {
      student: safeStudent,
      programs,
      attendance,
      streak,
      totalPoints,
    };
  });

  res.json({
    date,
    totalMentees: mentees.length,
    presentCount,
    mentees: menteeItems,
  });
});

// Guide marks attendance & points ladder
router.post('/attendance', (req: AuthenticatedRequest, res) => {
  const guideId = req.user!.id;
  const { studentId, date, status, level, note } = req.body;

  if (!studentId || !status) {
    return res.status(400).json({ error: 'studentId and status are required.' });
  }

  // Security check: guide can mark their own mentees
  const student = db.findUserById(studentId);
  const isAssigned =
    student?.guideId === guideId ||
    db.getStudentProgramGuides({ studentId, guideId }).length > 0;

  if (!student || student.role !== 'student' || !isAssigned) {
    return res.status(403).json({ error: 'You are only permitted to mark attendance for your assigned mentees.' });
  }

  const markDate = date || getKolkataDateString();

  const record = db.updateAttendanceRecord(studentId, markDate, {
    status,
    level: level as LadderLevel | null,
    note,
    actorId: guideId,
    isAdminEdit: false,
  });

  res.json({ record });
});

// Guide mentees list with progress & remarks
router.get('/mentees', (req: AuthenticatedRequest, res) => {
  const guideId = req.user!.id;
  const today = getKolkataDateString();

  const allUsers = db.getUsers();
  const spgAssignments = db.getStudentProgramGuides({ guideId });
  const spgStudentIds = new Set(spgAssignments.map((a) => a.studentId));
  const mentees = allUsers.filter(
    (u) => u.role === 'student' && (u.guideId === guideId || spgStudentIds.has(u.id))
  );

  const list = mentees.map((student) => {
    const programs = db.getStudentPrograms(student.id);
    const streak = db.calculateStreak(student.id, today);
    const totalPoints = db.calculateTotalPoints(student.id);
    const remarks = db.getRemarksForStudent(student.id);
    const tasks = db.getTasksForStudent(student.id);

    const { passwordHash: _, ...safeStudent } = student;

    return {
      student: safeStudent,
      programs,
      streak,
      totalPoints,
      remarks,
      tasks,
    };
  });

  res.json({ mentees: list });
});

// Guide tasks: list tasks created by this guide
router.get('/tasks', (req: AuthenticatedRequest, res) => {
  const guideId = req.user!.id;
  const tasks = db.getTasksForGuide(guideId);
  res.json({ tasks });
});

// Guide tasks: create task
router.post('/tasks', (req: AuthenticatedRequest, res) => {
  const guideId = req.user!.id;
  const { studentId, title, description, dueDate, attachmentFileId, attachmentFileName } = req.body;

  if (!studentId || !title || !dueDate) {
    return res.status(400).json({ error: 'studentId, title, and dueDate are required.' });
  }

  const student = db.findUserById(studentId);
  if (!student || student.role !== 'student') {
    return res.status(403).json({ error: 'You can only assign tasks to students.' });
  }

  const task = db.createTask({
    guideId,
    studentId,
    title,
    description: description || '',
    dueDate,
    attachmentFileId,
    attachmentFileName,
  });

  res.json({ task });
});

// Guide tasks: mark completed ("Mark completed")
router.post('/tasks/:id/complete', (req: AuthenticatedRequest, res) => {
  const guideId = req.user!.id;
  const taskId = req.params.id;
  const { note } = req.body;

  const tasks = db.getTasksForGuide(guideId);
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found or not assigned by you.' });
  }

  try {
    const updated = db.completeTaskByGuideOrAdmin(taskId, guideId, note);
    res.json({ task: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Guide tasks: send back task ("Send back") with required note
router.post('/tasks/:id/send-back', (req: AuthenticatedRequest, res) => {
  const guideId = req.user!.id;
  const taskId = req.params.id;
  const { note } = req.body;

  if (!note || !note.trim()) {
    return res.status(400).json({ error: 'A note explaining why the task is being sent back is required.' });
  }

  const tasks = db.getTasksForGuide(guideId);
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found or not assigned by you.' });
  }

  try {
    const updated = db.sendBackTask(taskId, guideId, note.trim());
    res.json({ task: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Guide remarks: add remark for a mentee
router.post('/remarks', (req: AuthenticatedRequest, res) => {
  const guideId = req.user!.id;
  const { studentId, content } = req.body;

  if (!studentId || !content) {
    return res.status(400).json({ error: 'studentId and content are required.' });
  }

  const student = db.findUserById(studentId);
  if (!student || student.role !== 'student') {
    return res.status(403).json({ error: 'Student not found.' });
  }

  const remark = db.createRemark({
    guideId,
    studentId,
    content,
  });

  res.json({ remark });
});

// Remind mentee: "Remind to meet" or "Remind to do task"
router.post('/remind-student', (req: AuthenticatedRequest, res) => {
  const guideId = req.user!.id;
  const { studentId, type, taskTitle } = req.body;

  const student = db.findUserById(studentId);
  if (!student || student.role !== 'student') {
    return res.status(403).json({ error: 'Student not found.' });
  }

  const guide = db.findUserById(guideId);
  const title = type === 'task' ? 'Task reminder' : 'Meet your guide';
  const message =
    type === 'task'
      ? `${guide?.fullName || 'Your guide'} reminded you to complete your task: ${taskTitle || 'Pending task'}.`
      : `${guide?.fullName || 'Your guide'} wants to meet you today for arts fest preparation marking.`;

  db.createNotification({
    userId: studentId,
    senderId: guideId,
    type: 'guide_reminder',
    title,
    message,
  });

  res.json({ success: true, message: `Reminder sent to ${student.fullName}.` });
});

export default router;
