import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
  User,
  Program,
  AttendanceRecord,
  TaskRecord,
  RemarkRecord,
  AppNotification,
  ScreenshotRecord,
  AuditLogEntry,
  LadderLevel,
  LADDER_POINTS,
  LeaderboardEntry,
} from '../src/types';

export interface UploadedFileRecord {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  filePath: string;
  uploadedBy: string;
  purpose: 'task_attachment' | 'submission_attachment' | 'screenshot';
  createdAt: string;
}

export interface StudentProgramRecord {
  id: string;
  studentId: string;
  programId: string;
}

export interface StudentProgramGuideRecord {
  id: string;
  studentId: string;
  programId: string;
  guideId: string;
  createdAt: string;
  assignedBy?: string;
}

export interface DatabaseSchema {
  users: (User & { passwordHash: string })[];
  programs: Program[];
  studentPrograms: StudentProgramRecord[];
  studentProgramGuides: StudentProgramGuideRecord[];
  attendance: AttendanceRecord[];
  tasks: TaskRecord[];
  remarks: RemarkRecord[];
  notifications: AppNotification[];
  screenshots: ScreenshotRecord[];
  uploadedFiles: UploadedFileRecord[];
  auditLogs: AuditLogEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function getKolkataDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getPreviousDateString(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

class Database {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = this.loadData();
    this.ensureTodayAttendance();
  }

  private loadData(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
      const schema: DatabaseSchema = JSON.parse(content);
      // Migrate legacy 'pending' tasks to 'assigned'
      if (schema.tasks) {
        schema.tasks.forEach((t) => {
          if ((t.status as any) === 'pending') {
            t.status = 'assigned';
          }
        });
      }
      if (!schema.studentProgramGuides) {
        schema.studentProgramGuides = [];
      }
      return schema;
    } catch (e) {
      console.error('Failed to parse db.json, initializing empty db', e);
    }
  }
  return {
    users: [],
    programs: [],
    studentPrograms: [],
    studentProgramGuides: [],
    attendance: [],
    tasks: [],
    remarks: [],
    notifications: [],
    screenshots: [],
    uploadedFiles: [],
    auditLogs: [],
  };
  }

  private persist() {
    try {
      const tempPath = DB_FILE + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (e) {
      console.error('Failed to write db.json', e);
    }
  }

  public save() {
    this.persist();
  }

  // --- Users ---
  public getUsers() {
    return this.data.users;
  }

  public findUserById(id: string) {
    return this.data.users.find((u) => u.id === id);
  }

  public findUserByUsername(username: string) {
    return this.data.users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );
  }

  public async createUser(userData: {
    username: string;
    password: string;
    role: 'admin' | 'guide' | 'student';
    fullName: string;
    email?: string | null;
    guideId?: string | null;
  }) {
    const existing = this.findUserByUsername(userData.username);
    if (existing) {
      throw new Error(`Username ${userData.username} already exists`);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userData.password, salt);

    const newUser = {
      id: uuidv4(),
      username: userData.username.trim(),
      passwordHash,
      role: userData.role,
      fullName: userData.fullName.trim(),
      email: userData.email?.trim() || null,
      guideId: userData.guideId || null,
      createdAt: new Date().toISOString(),
    };

    this.data.users.push(newUser);
    this.save();

    // If new student, initialize today's attendance as absent
    if (newUser.role === 'student') {
      const today = getKolkataDateString();
      this.ensureStudentAttendance(newUser.id, today);
    }

    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser;
  }

  public async updateUser(
    id: string,
    updates: Partial<Omit<User, 'id' | 'createdAt'>>
  ) {
    const user = this.findUserById(id);
    if (!user) throw new Error('User not found');

    if (updates.fullName !== undefined) user.fullName = updates.fullName.trim();
    if (updates.email !== undefined) user.email = updates.email?.trim() || null;
    if (updates.guideId !== undefined) user.guideId = updates.guideId;
    if (updates.username !== undefined) {
      const existing = this.findUserByUsername(updates.username);
      if (existing && existing.id !== id) {
        throw new Error('Username already taken');
      }
      user.username = updates.username.trim();
    }

    this.save();
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  public async resetPassword(id: string, newPassword: string) {
    const user = this.findUserById(id);
    if (!user) throw new Error('User not found');
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    this.save();
    return true;
  }

  public async verifyPassword(user: User & { passwordHash: string }, pass: string) {
    return bcrypt.compare(pass, user.passwordHash);
  }

  // --- Programs ---
  public getPrograms() {
    return this.data.programs;
  }

  public findProgramById(id: string) {
    return this.data.programs.find((p) => p.id === id);
  }

  public createProgram(data: {
    name: string;
    category: string;
    type: 'solo' | 'group';
    description: string;
  }) {
    const program: Program = {
      id: uuidv4(),
      name: data.name.trim(),
      category: data.category.trim(),
      type: data.type,
      description: data.description?.trim() || '',
      createdAt: new Date().toISOString(),
    };
    this.data.programs.push(program);
    this.save();
    return program;
  }

  public updateProgram(
    id: string,
    data: Partial<Omit<Program, 'id' | 'createdAt'>>
  ) {
    const prog = this.findProgramById(id);
    if (!prog) throw new Error('Program not found');
    if (data.name !== undefined) prog.name = data.name.trim();
    if (data.category !== undefined) prog.category = data.category.trim();
    if (data.type !== undefined) prog.type = data.type;
    if (data.description !== undefined) prog.description = data.description.trim();
    this.save();
    return prog;
  }

  public deleteProgram(id: string) {
    this.data.programs = this.data.programs.filter((p) => p.id !== id);
    this.data.studentPrograms = this.data.studentPrograms.filter(
      (sp) => sp.programId !== id
    );
    this.save();
  }

  // --- Student Programs ---
  public getStudentPrograms(studentId: string): Program[] {
    const progIds = this.data.studentPrograms
      .filter((sp) => sp.studentId === studentId)
      .map((sp) => sp.programId);
    return this.data.programs.filter((p) => progIds.includes(p.id));
  }

  public getProgramStudents(programId: string): User[] {
    const studentIds = this.data.studentPrograms
      .filter((sp) => sp.programId === programId)
      .map((sp) => sp.studentId);
    return this.data.users
      .filter((u) => u.role === 'student' && studentIds.includes(u.id))
      .map(({ passwordHash: _, ...safe }) => safe);
  }

  public assignProgramsToStudent(studentId: string, programIds: string[]) {
    // Replace all program assignments for this student
    this.data.studentPrograms = this.data.studentPrograms.filter(
      (sp) => sp.studentId !== studentId
    );
    for (const pid of programIds) {
      if (this.findProgramById(pid)) {
        this.data.studentPrograms.push({
          id: uuidv4(),
          studentId,
          programId: pid,
        });
      }
    }
    this.save();
  }

  public bulkAssignProgram(programId: string, studentIds: string[]) {
    for (const sid of studentIds) {
      const exists = this.data.studentPrograms.some(
        (sp) => sp.studentId === sid && sp.programId === programId
      );
      if (!exists && this.findUserById(sid)) {
        this.data.studentPrograms.push({
          id: uuidv4(),
          studentId: sid,
          programId,
        });
      }
    }
    this.save();
  }

  // --- Attendance & Streaks ---
  public ensureStudentAttendance(studentId: string, date: string): AttendanceRecord {
    let rec = this.data.attendance.find(
      (a) => a.studentId === studentId && a.date === date
    );
    if (!rec) {
      rec = {
        id: uuidv4(),
        studentId,
        date,
        status: 'absent',
        isMarked: false,
        level: null,
        points: 0,
        note: null,
        markedBy: null,
        markedAt: null,
      };
      this.data.attendance.push(rec);
      this.save();
    }
    return rec;
  }

  public ensureTodayAttendance(date: string = getKolkataDateString()) {
    const students = this.data.users.filter((u) => u.role === 'student');
    let added = false;
    for (const student of students) {
      const rec = this.data.attendance.find(
        (a) => a.studentId === student.id && a.date === date
      );
      if (!rec) {
        this.data.attendance.push({
          id: uuidv4(),
          studentId: student.id,
          date,
          status: 'absent',
          isMarked: false,
          level: null,
          points: 0,
          note: null,
          markedBy: null,
          markedAt: null,
        });
        added = true;
      }
    }
    if (added) this.save();
  }

  public getAttendanceForDate(date: string): AttendanceRecord[] {
    this.ensureTodayAttendance(date);
    return this.data.attendance.filter((a) => a.date === date);
  }

  public getStudentAttendanceHistory(studentId: string): AttendanceRecord[] {
    return this.data.attendance
      .filter((a) => a.studentId === studentId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  public getAllAttendance(): AttendanceRecord[] {
    return this.data.attendance;
  }

  /**
   * Streak calculation following the exact spec:
   * "Daily attendance drives streaks. A streak is the number of consecutive days marked PRESENT.
   * Strict streaks: one missed day resets the streak to zero. A day off does not preserve the streak.
   * Until the guide has marked today, show the streak as it stood at the end of yesterday.
   * It resets only when a day ends as Absent."
   */
  public calculateStreak(studentId: string, todayDate: string = getKolkataDateString()): number {
    const records = this.data.attendance.filter((a) => a.studentId === studentId);
    const dateMap = new Map<string, AttendanceRecord>();
    for (const r of records) {
      dateMap.set(r.date, r);
    }

    // Step 1: calculate yesterday's consecutive streak
    let streakYesterday = 0;
    let checkDate = getPreviousDateString(todayDate);
    while (true) {
      const r = dateMap.get(checkDate);
      if (!r) {
        // No record on that previous day -> streak breaks
        break;
      }
      if (r.status === 'present') {
        streakYesterday++;
        checkDate = getPreviousDateString(checkDate);
      } else {
        // Missed day resets streak
        break;
      }
    }

    const todayRec = dateMap.get(todayDate);
    if (!todayRec || !todayRec.isMarked) {
      // Guide has not marked today yet -> show streak as it stood at end of yesterday
      return streakYesterday;
    }

    if (todayRec.status === 'present') {
      return streakYesterday + 1;
    }

    // Today was explicitly marked absent
    return 0;
  }

  public calculateTotalPoints(studentId: string): number {
    const records = this.data.attendance.filter(
      (a) => a.studentId === studentId && a.status === 'present' && a.points !== null
    );
    return records.reduce((sum, r) => sum + (r.points || 0), 0);
  }

  public updateAttendanceRecord(
    studentId: string,
    date: string,
    data: {
      status: 'present' | 'absent';
      level?: LadderLevel | null;
      note?: string | null;
      actorId: string;
      isAdminEdit?: boolean;
    }
  ): AttendanceRecord {
    const rec = this.ensureStudentAttendance(studentId, date);
    const oldStatus = rec.status;
    const oldLevel = rec.level;
    const oldPoints = rec.points;

    rec.isMarked = true;
    rec.status = data.status;
    rec.markedBy = data.actorId;
    rec.markedAt = new Date().toISOString();
    if (data.note !== undefined) {
      rec.note = data.note ? data.note.trim() : null;
    }

    if (data.status === 'absent') {
      rec.level = null;
      rec.points = 0;
    } else {
      // status === 'present'
      if (data.level && LADDER_POINTS[data.level]) {
        rec.level = data.level;
        rec.points = LADDER_POINTS[data.level];
      } else {
        // Present but unscored yet
        rec.level = null;
        rec.points = null;
      }
    }

    // If admin is modifying a past day, log to audit log
    const today = getKolkataDateString();
    if (data.isAdminEdit && date !== today) {
      const actor = this.findUserById(data.actorId);
      const student = this.findUserById(studentId);
      this.data.auditLogs.unshift({
        id: uuidv4(),
        actorId: data.actorId,
        actorName: actor?.fullName || 'Admin',
        studentId,
        studentName: student?.fullName || 'Student',
        date,
        action: 'edit_attendance',
        oldValue: `${oldStatus} (Level: ${oldLevel || 'none'}, Pts: ${oldPoints ?? 'unscored'})`,
        newValue: `${rec.status} (Level: ${rec.level || 'none'}, Pts: ${rec.points ?? 'unscored'})`,
        timestamp: new Date().toISOString(),
      });
    }

    this.save();
    return rec;
  }

  // --- Leaderboard ---
  public getLeaderboard(): LeaderboardEntry[] {
    const students = this.data.users.filter((u) => u.role === 'student');
    const today = getKolkataDateString();

    const entries: LeaderboardEntry[] = students.map((s) => {
      const programs = this.getStudentPrograms(s.id).map((p) => p.name);
      return {
        rank: 0,
        studentId: s.id,
        fullName: s.fullName,
        username: s.username,
        totalPoints: this.calculateTotalPoints(s.id),
        streak: this.calculateStreak(s.id, today),
        programs,
      };
    });

    // Rank descending by points, then by streak
    entries.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return b.streak - a.streak;
    });

    // Assign rank
    entries.forEach((e, i) => {
      e.rank = i + 1;
    });

    return entries;
  }

  // --- Tasks ---
  public getTasksForStudent(studentId: string): TaskRecord[] {
    return this.data.tasks.filter((t) => t.studentId === studentId);
  }

  public getTasksForGuide(guideId: string): TaskRecord[] {
    return this.data.tasks.filter((t) => t.guideId === guideId);
  }

  public createTask(data: {
    guideId: string;
    studentId: string;
    title: string;
    description: string;
    dueDate: string;
    attachmentFileId?: string | null;
    attachmentFileName?: string | null;
  }): TaskRecord {
    const task: TaskRecord = {
      id: uuidv4(),
      guideId: data.guideId,
      studentId: data.studentId,
      title: data.title.trim(),
      description: data.description.trim(),
      dueDate: data.dueDate,
      attachmentFileId: data.attachmentFileId || null,
      attachmentFileName: data.attachmentFileName || null,
      status: 'assigned',
      submittedAt: null,
      completedAt: null,
      submissionFileId: null,
      submissionFileName: null,
      submissionNote: null,
      reviewerNote: null,
      createdAt: new Date().toISOString(),
    };
    this.data.tasks.unshift(task);

    // Create notification for student
    const guide = this.findUserById(data.guideId);
    this.createNotification({
      userId: data.studentId,
      senderId: data.guideId,
      type: 'new_task',
      title: 'New task assigned',
      message: `${guide?.fullName || 'Your guide'} assigned a new task: "${task.title}"`,
    });

    this.save();
    return task;
  }

  // Student submits their assigned task for review
  public submitTaskForReview(
    taskId: string,
    studentId: string,
    data: {
      submissionFileId?: string | null;
      submissionFileName?: string | null;
      submissionNote?: string | null;
    }
  ): TaskRecord {
    const task = this.data.tasks.find(
      (t) => t.id === taskId && t.studentId === studentId
    );
    if (!task) throw new Error('Task not found');
    if (task.status === 'completed') {
      throw new Error('Task is already completed');
    }

    const submittedTime = new Date().toISOString();
    task.status = 'awaiting_review';
    task.submittedAt = submittedTime;
    task.submissionFileId = data.submissionFileId || null;
    task.submissionFileName = data.submissionFileName || null;
    task.submissionNote = data.submissionNote?.trim() || null;

    // Create notification for the assigned guide
    const student = this.findUserById(studentId);
    const guide = this.findUserById(task.guideId);
    const studentName = student?.fullName || 'Student';

    this.createNotification({
      userId: task.guideId,
      senderId: studentId,
      type: 'general',
      title: 'Task submitted for review',
      message: `${studentName} submitted "${task.title}" for review.`,
    });

    // Email dispatch (or console log if no SMTP configured)
    const guideEmail = guide?.email || 'guide@gmail.com';
    console.log(
      `[EMAIL DISPATCH] To: ${guideEmail} | Subject: New task submission: "${task.title}" | Body: ${studentName} has submitted "${task.title}" at ${submittedTime}. Please review or meet the student before completing.`
    );

    this.save();
    return task;
  }

  // Guide or Admin approves and completes the task
  public completeTaskByGuideOrAdmin(
    taskId: string,
    actorId: string,
    note?: string | null
  ): TaskRecord {
    const task = this.data.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found');

    const actor = this.findUserById(actorId);
    const student = this.findUserById(task.studentId);
    const completedTime = new Date().toISOString();

    task.status = 'completed';
    task.completedAt = completedTime;
    if (note && note.trim()) {
      task.reviewerNote = note.trim();
    }

    // Notify the student
    this.createNotification({
      userId: task.studentId,
      senderId: actorId,
      type: 'general',
      title: 'Task marked completed',
      message: `${actor?.fullName || 'Your reviewer'} marked your task "${task.title}" as completed.${task.reviewerNote ? ` Note: "${task.reviewerNote}"` : ''}`,
    });

    // Email dispatch to student
    const studentEmail = student?.email || `${student?.username || 'student'}@gmail.com`;
    console.log(
      `[EMAIL DISPATCH] To: ${studentEmail} | Subject: Task Completed: "${task.title}" | Body: Your task "${task.title}" was verified and marked completed by ${actor?.fullName || 'your reviewer'}.${task.reviewerNote ? ` Note: ${task.reviewerNote}` : ''}`
    );

    this.save();
    return task;
  }

  // Guide or Admin sends back the task with a required note
  public sendBackTask(
    taskId: string,
    actorId: string,
    note: string
  ): TaskRecord {
    const task = this.data.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found');
    if (!note || !note.trim()) {
      throw new Error('A note explaining why the task was sent back is required.');
    }

    const actor = this.findUserById(actorId);
    const student = this.findUserById(task.studentId);

    task.status = 'assigned';
    task.completedAt = null;
    task.reviewerNote = note.trim();

    // Notify the student with the guide's note
    this.createNotification({
      userId: task.studentId,
      senderId: actorId,
      type: 'general',
      title: 'Task sent back for revision',
      message: `${actor?.fullName || 'Your reviewer'} returned task "${task.title}": "${note.trim()}"`,
    });

    // Email dispatch to student
    const studentEmail = student?.email || `${student?.username || 'student'}@gmail.com`;
    console.log(
      `[EMAIL DISPATCH] To: ${studentEmail} | Subject: Task Returned: "${task.title}" | Body: Your task "${task.title}" was sent back by ${actor?.fullName || 'your reviewer'}. Feedback: "${note.trim()}". Please revise and mark as done.`
    );

    this.save();
    return task;
  }

  // Backward compatibility alias: redirects to submitTaskForReview
  public completeTask(
    taskId: string,
    studentId: string,
    data: {
      submissionFileId?: string | null;
      submissionFileName?: string | null;
      submissionNote?: string | null;
    }
  ): TaskRecord {
    return this.submitTaskForReview(taskId, studentId, data);
  }

  // --- Remarks ---
  public getRemarksForStudent(studentId: string): RemarkRecord[] {
    return this.data.remarks
      .filter((r) => r.studentId === studentId)
      .map((r) => {
        const guide = this.findUserById(r.guideId);
        return {
          ...r,
          guideName: guide?.fullName || 'Guide',
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getAllRemarks(): RemarkRecord[] {
    return this.data.remarks
      .map((r) => {
        const guide = this.findUserById(r.guideId);
        return {
          ...r,
          guideName: guide?.fullName || 'Guide',
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public createRemark(data: {
    guideId: string;
    studentId: string;
    content: string;
  }): RemarkRecord {
    const remark: RemarkRecord = {
      id: uuidv4(),
      guideId: data.guideId,
      studentId: data.studentId,
      content: data.content.trim(),
      createdAt: new Date().toISOString(),
    };
    this.data.remarks.unshift(remark);

    const guide = this.findUserById(data.guideId);
    this.createNotification({
      userId: data.studentId,
      senderId: data.guideId,
      type: 'new_remark',
      title: 'New remark from guide',
      message: `${guide?.fullName || 'Your guide'} added a remark: "${remark.content}"`,
    });

    this.save();
    return remark;
  }

  // --- Notifications ---
  public getNotificationsForUser(userId: string): AppNotification[] {
    return this.data.notifications
      .filter((n) => n.userId === userId)
      .map((n) => {
        if (n.senderId) {
          const sender = this.findUserById(n.senderId);
          return { ...n, senderName: sender?.fullName || 'System' };
        }
        return n;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public createNotification(data: {
    userId: string;
    senderId?: string | null;
    type: AppNotification['type'];
    title: string;
    message: string;
  }): AppNotification {
    const notification: AppNotification = {
      id: uuidv4(),
      userId: data.userId,
      senderId: data.senderId || null,
      type: data.type,
      title: data.title,
      message: data.message,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.data.notifications.unshift(notification);

    // Email simulation: if recipient user has Gmail address, log email sending
    const user = this.findUserById(data.userId);
    if (user?.email) {
      console.log(
        `[EMAIL NOTIFICATION TO: ${user.email}] Subject: ${notification.title} | Content: ${notification.message}`
      );
    }

    this.save();
    return notification;
  }

  public markNotificationsRead(userId: string) {
    let changed = false;
    for (const n of this.data.notifications) {
      if (n.userId === userId && !n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) this.save();
  }

  // --- Screenshots & 48-Hour Purge ---
  public recordScreenshot(data: {
    studentId: string;
    date: string;
    fileId: string;
    fileName: string;
    fileSize: number;
  }): ScreenshotRecord {
    // Check if record exists for this student on this date
    let rec = this.data.screenshots.find(
      (s) => s.studentId === data.studentId && s.date === data.date
    );
    if (rec) {
      rec.fileId = data.fileId;
      rec.fileName = data.fileName;
      rec.fileSize = data.fileSize;
      rec.submittedAt = new Date().toISOString();
      rec.status = 'submitted';
      rec.purgedAt = null;
    } else {
      rec = {
        id: uuidv4(),
        studentId: data.studentId,
        date: data.date,
        fileId: data.fileId,
        fileName: data.fileName,
        fileSize: data.fileSize,
        submittedAt: new Date().toISOString(),
        purgedAt: null,
        status: 'submitted',
      };
      this.data.screenshots.unshift(rec);
    }
    this.save();
    return rec;
  }

  public getScreenshotsForDate(date?: string): ScreenshotRecord[] {
    let list = this.data.screenshots;
    if (date) {
      list = list.filter((s) => s.date === date);
    }
    return list.map((s) => {
      const student = this.findUserById(s.studentId);
      return {
        ...s,
        studentName: student?.fullName || 'Student',
        studentRoll: student?.username || '',
      };
    });
  }

  public getStudentScreenshot(studentId: string, date: string): ScreenshotRecord | undefined {
    return this.data.screenshots.find(
      (s) => s.studentId === studentId && s.date === date
    );
  }

  /**
   * Purges screenshots uploaded more than 26 hours ago.
   * Deletes actual file from disk and updates record to status: 'purged'
   */
  public purgeOldScreenshots(): number {
    const cutoffMs = 26 * 60 * 60 * 1000;
    const nowMs = Date.now();
    let purgedCount = 0;

    for (const rec of this.data.screenshots) {
      if (rec.status === 'submitted' && rec.fileId) {
        const submittedMs = new Date(rec.submittedAt || rec.uploadedAt || rec.date).getTime();
        if (nowMs - submittedMs > cutoffMs) {
          // Delete file from disk
          const fileRecord = this.data.uploadedFiles.find((f) => f.id === rec.fileId);
          if (fileRecord && fs.existsSync(fileRecord.filePath)) {
            try {
              fs.unlinkSync(fileRecord.filePath);
            } catch (err) {
              console.error('Failed to unlink screenshot file', err);
            }
          }
          rec.status = 'purged';
          rec.purgedAt = new Date().toISOString();
          rec.fileId = null;
          purgedCount++;
        }
      }
    }

    if (purgedCount > 0) {
      this.save();
    }
    return purgedCount;
  }

  // --- Uploaded Files ---
  public addUploadedFile(file: UploadedFileRecord) {
    this.data.uploadedFiles.push(file);
    this.save();
  }

  public getUploadedFile(id: string): UploadedFileRecord | undefined {
    return this.data.uploadedFiles.find((f) => f.id === id);
  }

  // --- Student Program Guides ---
  public getStudentProgramGuides(filter?: {
    studentId?: string;
    programId?: string;
    guideId?: string;
  }): StudentProgramGuideRecord[] {
    if (!this.data.studentProgramGuides) {
      this.data.studentProgramGuides = [];
    }
    return this.data.studentProgramGuides.filter((spg) => {
      if (filter?.studentId && spg.studentId !== filter.studentId) return false;
      if (filter?.programId && spg.programId !== filter.programId) return false;
      if (filter?.guideId && spg.guideId !== filter.guideId) return false;
      return true;
    });
  }

  public assignStudentProgramGuides(
    assignments: Array<{
      studentId: string;
      programId: string;
      guideId: string;
      assignedBy?: string;
    }>,
    mode: 'add' | 'replace' = 'add',
    actor?: { id: string; name: string }
  ): { added: number; replaced: number; total: number } {
    if (!this.data.studentProgramGuides) {
      this.data.studentProgramGuides = [];
    }

    let added = 0;
    let replaced = 0;

    if (mode === 'replace') {
      const targetPairs = new Set(assignments.map((a) => `${a.studentId}:::${a.programId}`));
      const initialCount = this.data.studentProgramGuides.length;
      this.data.studentProgramGuides = this.data.studentProgramGuides.filter(
        (spg) => !targetPairs.has(`${spg.studentId}:::${spg.programId}`)
      );
      replaced = initialCount - this.data.studentProgramGuides.length;
    }

    for (const a of assignments) {
      const exists = this.data.studentProgramGuides.some(
        (spg) =>
          spg.studentId === a.studentId &&
          spg.programId === a.programId &&
          spg.guideId === a.guideId
      );

      if (!exists) {
        this.data.studentProgramGuides.push({
          id: uuidv4(),
          studentId: a.studentId,
          programId: a.programId,
          guideId: a.guideId,
          createdAt: new Date().toISOString(),
          assignedBy: a.assignedBy || actor?.id,
        });
        added++;
      }
    }

    this.save();

    if (actor && (added > 0 || replaced > 0)) {
      this.addAuditLogEntry({
        id: uuidv4(),
        actorId: actor.id,
        actorName: actor.name,
        studentId: assignments[0]?.studentId || '',
        studentName: assignments.length === 1 ? 'Single Student' : `${assignments.length} Students`,
        date: getKolkataDateString(),
        action: mode === 'replace' ? 'replace_program_guides' : 'assign_program_guides',
        oldValue: `${replaced} previous assignments`,
        newValue: `${added} added, mode: ${mode}`,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      added,
      replaced,
      total: this.data.studentProgramGuides.length,
    };
  }

  public removeStudentProgramGuide(
    studentId: string,
    programId: string,
    guideId: string,
    actor?: { id: string; name: string }
  ): boolean {
    if (!this.data.studentProgramGuides) {
      this.data.studentProgramGuides = [];
      return false;
    }

    const idx = this.data.studentProgramGuides.findIndex(
      (spg) =>
        spg.studentId === studentId &&
        spg.programId === programId &&
        spg.guideId === guideId
    );

    if (idx === -1) return false;

    this.data.studentProgramGuides.splice(idx, 1);
    this.save();

    if (actor) {
      const student = this.findUserById(studentId);
      this.addAuditLogEntry({
        id: uuidv4(),
        actorId: actor.id,
        actorName: actor.name,
        studentId,
        studentName: student?.fullName || 'Student',
        date: getKolkataDateString(),
        action: 'remove_program_guide',
        oldValue: `Guide: ${guideId}, Program: ${programId}`,
        newValue: 'Removed',
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  }

  public addAuditLogEntry(entry: AuditLogEntry) {
    if (!this.data.auditLogs) {
      this.data.auditLogs = [];
    }
    this.data.auditLogs.unshift(entry);
    this.save();
  }

  // --- Audit Log ---
  public getAuditLogs(): AuditLogEntry[] {
    return this.data.auditLogs;
  }
}

export const db = new Database();
