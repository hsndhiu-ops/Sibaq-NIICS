import { Router } from 'express';
import * as XLSX from 'xlsx';
import { db, getKolkataDateString, getPreviousDateString } from '../db';
import { requireAdmin, AuthenticatedRequest } from '../auth';
import createUserHandler from '../../api/create-user';
import resetPasswordHandler from '../../api/reset-password';
import updateUserHandler from '../../api/update-user';
import assignGuideHandler from '../../api/assign-guide';

const router = Router();

// Strictly enforce admin session authentication for all routes
router.use(requireAdmin);

// Mount serverless endpoints with direct handler support
router.post('/create-user', createUserHandler);
router.post('/reset-password', resetPasswordHandler);
router.post('/update-user', updateUserHandler);

// Today overview & date picker data
router.get('/overview', (req, res) => {
  const date = (req.query.date as string) || getKolkataDateString();
  const allUsers = db.getUsers();
  const students = allUsers.filter((u) => u.role === 'student');
  const guides = allUsers.filter((u) => u.role === 'guide');

  const attendanceList = db.getAttendanceForDate(date);
  const attendanceMap = new Map(attendanceList.map((a) => [a.studentId, a]));

  let presentCount = 0;
  let absentCount = 0;
  let unscoredCount = 0;

  const roster = students.map((s) => {
    const guide = s.guideId ? db.findUserById(s.guideId) : null;
    const att = attendanceMap.get(s.id) || {
      id: '',
      studentId: s.id,
      date,
      status: 'absent' as const,
      isMarked: false,
      level: null,
      points: 0,
      note: null,
      markedBy: null,
      markedAt: null,
    };

    if (att.status === 'present') {
      presentCount++;
      if (att.points === null) {
        unscoredCount++;
      }
    } else {
      absentCount++;
    }

    const streak = db.calculateStreak(s.id, date);
    const totalPoints = db.calculateTotalPoints(s.id);
    const screenshot = db.getStudentScreenshot(s.id, date);

    return {
      studentId: s.id,
      studentName: s.fullName,
      studentRoll: s.username,
      guideId: s.guideId,
      guideName: guide ? guide.fullName : 'Unassigned',
      status: att.status,
      isMarked: att.isMarked,
      level: att.level,
      points: att.points,
      note: att.note,
      streak,
      totalPoints,
      hasScreenshot: !!screenshot,
    };
  });

  // Check guides' marking status for today
  let unmarkedGuidesCount = 0;
  const guidesStatus = guides.map((g) => {
    const mentees = students.filter((s) => s.guideId === g.id);
    const markedCount = mentees.filter((m) => {
      const att = attendanceMap.get(m.id);
      return att && att.isMarked;
    }).length;
    const allMarked = mentees.length > 0 && markedCount === mentees.length;
    if (mentees.length > 0 && markedCount < mentees.length) {
      unmarkedGuidesCount++;
    }
    return {
      guideId: g.id,
      guideName: g.fullName,
      menteesCount: mentees.length,
      markedCount,
      allMarked,
    };
  });

  res.json({
    date,
    stats: {
      totalStudents: students.length,
      presentCount,
      absentCount,
      unscoredCount,
      unmarkedGuidesCount,
    },
    roster,
    guidesStatus,
  });
});

// Guides view: detail per guide with their mentees
router.get('/guides', (req, res) => {
  const date = (req.query.date as string) || getKolkataDateString();
  const allUsers = db.getUsers();
  const guides = allUsers.filter((u) => u.role === 'guide');
  const students = allUsers.filter((u) => u.role === 'student');
  const attendanceList = db.getAttendanceForDate(date);
  const attendanceMap = new Map(attendanceList.map((a) => [a.studentId, a]));

  const result = guides.map((guide) => {
    const mentees = students.filter((s) => s.guideId === guide.id).map((m) => {
      const att = attendanceMap.get(m.id);
      const programs = db.getStudentPrograms(m.id);
      return {
        id: m.id,
        fullName: m.fullName,
        username: m.username,
        email: m.email,
        programs: programs.map((p) => p.name),
        attendance: att || null,
        streak: db.calculateStreak(m.id, date),
        totalPoints: db.calculateTotalPoints(m.id),
      };
    });

    const markedCount = mentees.filter((m) => m.attendance?.isMarked).length;
    const allMarked = mentees.length > 0 && markedCount === mentees.length;

    return {
      id: guide.id,
      fullName: guide.fullName,
      username: guide.username,
      email: guide.email,
      menteesCount: mentees.length,
      markedCount,
      allMarked,
      mentees,
    };
  });

  res.json({ guides: result, date });
});

// All students overview
router.get('/students', (req, res) => {
  const allUsers = db.getUsers();
  const students = allUsers.filter((u) => u.role === 'student');
  const today = getKolkataDateString();

  const list = students.map((s) => {
    const guide = s.guideId ? db.findUserById(s.guideId) : null;
    const programs = db.getStudentPrograms(s.id);
    return {
      id: s.id,
      fullName: s.fullName,
      username: s.username,
      email: s.email,
      guideId: s.guideId,
      guideName: guide ? guide.fullName : 'Unassigned',
      programs: programs.map((p) => p.name),
      streak: db.calculateStreak(s.id, today),
      totalPoints: db.calculateTotalPoints(s.id),
      createdAt: s.createdAt,
    };
  });

  res.json({ students: list });
});

// Drill-down on any individual student
router.get('/students/:id', (req, res) => {
  const student = db.findUserById(req.params.id);
  if (!student || student.role !== 'student') {
    return res.status(404).json({ error: 'Student not found.' });
  }

  const today = getKolkataDateString();
  const guide = student.guideId ? db.findUserById(student.guideId) : null;
  const programs = db.getStudentPrograms(student.id);
  const attendanceHistory = db.getStudentAttendanceHistory(student.id);
  const tasks = db.getTasksForStudent(student.id);
  const remarks = db.getRemarksForStudent(student.id);
  const screenshots = db.getScreenshotsForDate().filter((s) => s.studentId === student.id);
  const streak = db.calculateStreak(student.id, today);
  const totalPoints = db.calculateTotalPoints(student.id);

  // Program guides & all unique guides
  const studentProgGuides = db.getStudentProgramGuides({ studentId: student.id });
  const allUsers = db.getUsers();
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const progMap = new Map(programs.map((p) => [p.id, p]));

  const guideMap = new Map<string, { id: string; fullName: string; username: string; email?: string; programs: string[] }>();
  if (guide) {
    guideMap.set(guide.id, {
      id: guide.id,
      fullName: guide.fullName,
      username: guide.username,
      email: guide.email || undefined,
      programs: ['General'],
    });
  }
  studentProgGuides.forEach((g) => {
    const u = userMap.get(g.guideId);
    if (!u) return;
    const prog = progMap.get(g.programId);
    const progName = prog ? prog.name : (g.programId === 'general' ? 'General' : g.programId);
    if (guideMap.has(u.id)) {
      const existing = guideMap.get(u.id)!;
      if (!existing.programs.includes(progName)) existing.programs.push(progName);
    } else {
      guideMap.set(u.id, {
        id: u.id,
        fullName: u.fullName,
        username: u.username,
        email: u.email || undefined,
        programs: [progName],
      });
    }
  });

  const allGuides = Array.from(guideMap.values());
  const programGuides = studentProgGuides.map((g) => {
    const u = userMap.get(g.guideId);
    const prog = progMap.get(g.programId);
    return {
      id: g.id,
      programId: g.programId,
      programName: prog ? prog.name : (g.programId === 'general' ? 'General' : g.programId),
      guideId: g.guideId,
      guideName: u ? u.fullName : 'Unknown Guide',
      guideUsername: u ? u.username : '',
      guideEmail: u?.email || undefined,
      assignedAt: g.createdAt,
    };
  });

  const { passwordHash: _, ...safeStudent } = student;

  res.json({
    student: safeStudent,
    guide: guide ? { id: guide.id, fullName: guide.fullName, username: guide.username } : null,
    allGuides,
    programGuides,
    programs,
    streak,
    totalPoints,
    attendanceHistory,
    tasks,
    remarks,
    screenshots,
  });
});

// Accounts: list all
router.get('/accounts', (req, res) => {
  const users = db.getUsers().map(({ passwordHash: _, ...safe }) => safe);
  res.json({ accounts: users });
});

// Accounts: create student or guide
router.post('/accounts', async (req, res) => {
  const { username, password, role, fullName, email, guideId } = req.body;
  if (!username || !password || !role || !fullName) {
    return res.status(400).json({ error: 'Username, password, role, and full name are required.' });
  }
  if (!['guide', 'student'].includes(role)) {
    return res.status(400).json({ error: 'Role must be guide or student.' });
  }

  try {
    const user = await db.createUser({
      username,
      password,
      role,
      fullName,
      email: email || null,
      guideId: role === 'student' ? guideId || null : null,
    });
    res.json({ user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Accounts: edit account
router.put('/accounts/:id', async (req, res) => {
  const { fullName, email, guideId, username } = req.body;
  try {
    const updated = await db.updateUser(req.params.id, {
      fullName,
      email,
      guideId,
      username,
    });
    res.json({ user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Accounts: reset password
router.post('/accounts/:id/reset-password', async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }
  try {
    await db.resetPassword(req.params.id, newPassword);
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Attendance raw export data (Admin only)
router.get('/attendance-export', (req, res) => {
  const users = db.getUsers();
  const userMap = new Map(users.map((u) => [u.id, u]));
  const att = db.getAllAttendance();
  const rows = att.map((a) => {
    const student = userMap.get(a.studentId);
    const guide = student?.guideId ? userMap.get(student.guideId) : null;
    return {
      student: student?.fullName || student?.username || a.studentId,
      guide: guide?.fullName || guide?.username || 'Unassigned',
      date: a.date,
      status: a.status,
      level: a.level || '',
      points: a.points ?? 0,
    };
  });
  res.json({ rows });
});

// Programs: list
router.get('/programs', (req, res) => {
  const programs = db.getPrograms();
  const result = programs.map((p) => {
    const students = db.getProgramStudents(p.id);
    return {
      ...p,
      studentCount: students.length,
      students: students.map((s) => ({ id: s.id, fullName: s.fullName, username: s.username })),
    };
  });
  res.json({ programs: result });
});

// Programs: create
router.post('/programs', (req, res) => {
  const { name, category, type, description } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'Program name and category are required.' });
  }
  const prog = db.createProgram({
    name,
    category,
    type: type === 'group' ? 'group' : 'solo',
    description: description || '',
  });
  res.json({ program: prog });
});

// Programs: edit
router.put('/programs/:id', (req, res) => {
  const { name, category, type, description } = req.body;
  try {
    const updated = db.updateProgram(req.params.id, { name, category, type, description });
    res.json({ program: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Programs: delete
router.delete('/programs/:id', (req, res) => {
  db.deleteProgram(req.params.id);
  res.json({ success: true });
});

// Assign guide to students
router.post('/assign-guide', assignGuideHandler);

// Assign programs to student(s)
router.post('/assign-programs', (req, res) => {
  const { studentId, programIds, bulkStudentIds, programId } = req.body;

  // Single student -> multiple programs
  if (studentId && Array.isArray(programIds)) {
    db.assignProgramsToStudent(studentId, programIds);
    return res.json({ success: true });
  }

  // Bulk students -> single program
  if (programId && Array.isArray(bulkStudentIds)) {
    db.bulkAssignProgram(programId, bulkStudentIds);
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'Invalid assignment parameters.' });
});

// Admin edit attendance with audit log
router.post('/attendance', (req: AuthenticatedRequest, res) => {
  const { studentId, date, status, level, note } = req.body;
  if (!studentId || !date || !status) {
    return res.status(400).json({ error: 'studentId, date, and status are required.' });
  }

  const rec = db.updateAttendanceRecord(studentId, date, {
    status,
    level,
    note,
    actorId: req.user!.id,
    isAdminEdit: true,
  });

  res.json({ record: rec });
});

// Admin complete task
router.post('/tasks/:id/complete', (req: AuthenticatedRequest, res) => {
  const taskId = req.params.id;
  const { note } = req.body;
  try {
    const updated = db.completeTaskByGuideOrAdmin(taskId, req.user!.id, note);
    res.json({ task: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin send back task
router.post('/tasks/:id/send-back', (req: AuthenticatedRequest, res) => {
  const taskId = req.params.id;
  const { note } = req.body;
  if (!note || !note.trim()) {
    return res.status(400).json({ error: 'A note explaining why the task was sent back is required.' });
  }
  try {
    const updated = db.sendBackTask(taskId, req.user!.id, note.trim());
    res.json({ task: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Audit log
router.get('/audit-log', (req, res) => {
  res.json({ logs: db.getAuditLogs() });
});

// Send reminder to guide
router.post('/remind-guide', (req: AuthenticatedRequest, res) => {
  const { guideId, message } = req.body;
  const guide = db.findUserById(guideId);
  if (!guide) {
    return res.status(404).json({ error: 'Guide not found.' });
  }

  db.createNotification({
    userId: guideId,
    senderId: req.user!.id,
    type: 'admin_reminder',
    title: 'Reminder: Daily attendance & scoring',
    message: message || 'Please complete marking attendance and scores for your mentees today.',
  });

  res.json({ success: true, message: `Reminder sent to ${guide.fullName}.` });
});

// Charts data (attendance trend, points distribution, streaks)
router.get('/charts-data', (req, res) => {
  const today = getKolkataDateString();
  const students = db.getUsers().filter((u) => u.role === 'student');

  // Last 14 days trend
  const days: { date: string; present: number; absent: number }[] = [];
  let curr = today;
  for (let i = 0; i < 14; i++) {
    const list = db.getAttendanceForDate(curr);
    const present = list.filter((a) => a.status === 'present').length;
    const absent = list.filter((a) => a.status === 'absent').length;
    days.unshift({ date: curr, present, absent });
    curr = getPreviousDateString(curr);
  }

  // Streaks distribution
  const streakBins = { '0': 0, '1-3': 0, '4-7': 0, '8-14': 0, '15+': 0 };
  for (const s of students) {
    const st = db.calculateStreak(s.id, today);
    if (st === 0) streakBins['0']++;
    else if (st <= 3) streakBins['1-3']++;
    else if (st <= 7) streakBins['4-7']++;
    else if (st <= 14) streakBins['8-14']++;
    else streakBins['15+']++;
  }

  // Points distribution
  const pointsBins = { '0': 0, '1-25': 0, '26-50': 0, '51-100': 0, '100+': 0 };
  for (const s of students) {
    const pts = db.calculateTotalPoints(s.id);
    if (pts === 0) pointsBins['0']++;
    else if (pts <= 25) pointsBins['1-25']++;
    else if (pts <= 50) pointsBins['26-50']++;
    else if (pts <= 100) pointsBins['51-100']++;
    else pointsBins['100+']++;
  }

  res.json({
    trend: days,
    streakDistribution: streakBins,
    pointsDistribution: pointsBins,
  });
});

// Export to Excel
router.get('/export-excel', (req, res) => {
  const today = getKolkataDateString();
  const students = db.getUsers().filter((u) => u.role === 'student');

  // Sheet 1: Master Student Status
  const studentRows = students.map((s) => {
    const guide = s.guideId ? db.findUserById(s.guideId) : null;
    const progs = db.getStudentPrograms(s.id).map((p) => p.name).join(', ');
    const streak = db.calculateStreak(s.id, today);
    const totalPoints = db.calculateTotalPoints(s.id);
    const todayAtt = db.getAttendanceForDate(today).find((a) => a.studentId === s.id);

    return {
      'Roll / Username': s.username,
      'Full Name': s.fullName,
      'Assigned Guide': guide?.fullName || 'Unassigned',
      'Programs': progs,
      'Streak (Days)': streak,
      'Total Points': totalPoints,
      "Today's Status": todayAtt?.status || 'absent',
      "Today's Level": todayAtt?.level || 'None',
      "Today's Points": todayAtt?.points ?? 'Unscored',
    };
  });

  // Sheet 2: Audit Logs
  const auditLogs = db.getAuditLogs().map((a) => ({
    'Timestamp': a.timestamp,
    'Actor': a.actorName,
    'Student': a.studentName,
    'Date Modified': a.date,
    'Previous State': a.oldValue,
    'New State': a.newValue,
  }));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(studentRows);
  const ws2 = XLSX.utils.json_to_sheet(auditLogs);

  XLSX.utils.book_append_sheet(wb, ws1, 'Students Overview');
  XLSX.utils.book_append_sheet(wb, ws2, 'Audit Log');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=SIBAQ26_Report_${today}.xlsx`);
  res.send(buf);
});

// Screenshots list (Admin only)
router.get('/screenshots', (req, res) => {
  const date = (req.query.date as string) || getKolkataDateString();
  const records = db.getScreenshotsForDate(date);
  res.json({ screenshots: records, date });
});

// Trigger 48h purge
router.delete('/purge-screenshots', (req, res) => {
  const purgedCount = db.purgeOldScreenshots();
  res.json({ purgedCount, message: `Purged ${purgedCount} screenshots older than 48 hours.` });
});

export default router;
