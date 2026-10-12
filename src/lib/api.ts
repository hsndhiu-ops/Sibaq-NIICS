import { supabase, isSupabaseConfigured } from './supabase';
import {
  TABLES,
  PROFILES_COLS,
  PROGRAMS_COLS,
  PROGRAM_MEMBERS_COLS,
  ATTENDANCE_COLS,
  ATTENDANCE_AUDIT_COLS,
  TASKS_COLS,
  TASK_FILES_COLS,
  TASK_FILE_KINDS,
  REMARKS_COLS,
  NOTIFICATIONS_COLS,
  NOTIFICATION_TYPES,
  SCREENSHOT_LOG_COLS,
  RPCS,
  RPC_ARGS,
  REVIEW_TASK_ACTIONS,
  BUCKETS,
  TASK_STATUS,
  ATTENDANCE_STATUS,
  INTERNAL_EMAIL_DOMAIN,
  SCORE_LEVEL_MAP,
  ScoreLevelNumber,
  LABEL_TO_SCORE_LEVEL,
} from './schema';
import {
  User,
  Program,
  AttendanceRecord,
  TaskRecord,
  RemarkRecord,
  AppNotification,
  ScreenshotRecord,
  AuditLogEntry,
  LeaderboardEntry,
  StudentDashboardData,
  GuideTodayData,
  AdminTodayData,
  LadderLevel,
  LADDER_POINTS,
} from '../types';

/**
 * Returns today's date in YYYY-MM-DD format (Asia/Kolkata timezone).
 */
export function getKolkataDateString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Compatibility helpers for existing code
 */
export function getStoredToken(): string | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
      try {
        const item = JSON.parse(localStorage.getItem(key) || '{}');
        if (item?.access_token) return item.access_token;
      } catch {
        // continue
      }
    }
  }
  return localStorage.getItem('dhiu_auth_token');
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem('dhiu_auth_token', token);
  } else {
    localStorage.removeItem('dhiu_auth_token');
  }
}

/**
 * Map Supabase profile row to User domain object
 */
function mapProfileToUser(row: any): User {
  return {
    id: row[PROFILES_COLS.ID],
    username: row[PROFILES_COLS.USERNAME] || '',
    role: row[PROFILES_COLS.ROLE] || 'student',
    fullName: row[PROFILES_COLS.FULL_NAME] || row[PROFILES_COLS.USERNAME] || 'User',
    email: row[PROFILES_COLS.NOTIFICATION_EMAIL] || null,
    guideId: row[PROFILES_COLS.GUIDE_ID] || null,
    createdAt: row[PROFILES_COLS.CREATED_AT] || new Date().toISOString(),
  };
}

/**
 * Map attendance row to AttendanceRecord
 *
 * Rules:
 * - points is read-only generated column (0 absent, 5-10 scored, null if present unscored)
 * - absent is default and 0 points
 * - present with no level shows "Not scored yet" (points = null)
 */
function mapAttendanceRow(row: any): AttendanceRecord {
  const status = (row[ATTENDANCE_COLS.STATUS] as 'present' | 'absent') || 'absent';
  const rawScore = row[ATTENDANCE_COLS.SCORE_LEVEL];

  // Convert rawScore (smallint 5..10 or string like '5' or existing label) to display LadderLevel
  let level: LadderLevel | null = null;
  if (status === 'present' && rawScore !== null && rawScore !== undefined) {
    const num = Number(rawScore);
    if (!isNaN(num) && num in SCORE_LEVEL_MAP) {
      level = (SCORE_LEVEL_MAP as Record<number, LadderLevel>)[num] || null;
    } else if (typeof rawScore === 'string' && rawScore in LABEL_TO_SCORE_LEVEL) {
      level = rawScore as LadderLevel;
    }
  } else {
    // Absent always has null level
    level = null;
  }

  let points = row[ATTENDANCE_COLS.POINTS];

  if (points === undefined || points === null) {
    if (status === 'absent') {
      points = 0;
    } else if (status === 'present') {
      points = level ? LADDER_POINTS[level] ?? null : null;
    }
  }

  // Row is marked if score_level or note is present or points is computed
  const isMarked = Boolean(level || row[ATTENDANCE_COLS.NOTE] || (status === 'present' && points !== null));

  return {
    id: row[ATTENDANCE_COLS.ID] || '',
    studentId: row[ATTENDANCE_COLS.STUDENT_ID],
    date: row[ATTENDANCE_COLS.DATE],
    status,
    isMarked,
    level,
    points,
    note: row[ATTENDANCE_COLS.NOTE] || null,
    markedBy: null,
    markedAt: null,
  };
}

/**
 * Map task row to TaskRecord
 *
 * Columns:
 * - review_note (TASKS_COLS.REVIEW_NOTE)
 * - reviewed_at (TASKS_COLS.REVIEWED_AT)
 * - reviewed_by (TASKS_COLS.REVIEWED_BY)
 * - task_files: storage_path, size_bytes, kind ('guide_attachment' | 'submission'), uploader_id
 */
function mapTaskRow(row: any, files?: any[]): TaskRecord {
  const guideFiles = files?.filter(
    (f) =>
      f[TASK_FILES_COLS.KIND] === TASK_FILE_KINDS.GUIDE_ATTACHMENT ||
      f['purpose'] === 'attachment' ||
      f['purpose'] === 'guide_attachment'
  );
  const submissionFiles = files?.filter(
    (f) =>
      f[TASK_FILES_COLS.KIND] === TASK_FILE_KINDS.SUBMISSION ||
      f['purpose'] === 'submission'
  );

  const attachedFile = guideFiles?.[0];
  const submissionFile = submissionFiles?.[0];

  let status: 'assigned' | 'awaiting_review' | 'completed' = 'assigned';
  const rawStatus = row[TASKS_COLS.STATUS];
  if (rawStatus === TASK_STATUS.COMPLETED || rawStatus === 'completed') {
    status = 'completed';
  } else if (
    rawStatus === TASK_STATUS.SUBMITTED ||
    rawStatus === 'submitted' ||
    rawStatus === 'awaiting_review'
  ) {
    status = 'awaiting_review';
  } else {
    status = 'assigned';
  }

  return {
    id: row[TASKS_COLS.ID],
    guideId: row[TASKS_COLS.GUIDE_ID],
    studentId: row[TASKS_COLS.STUDENT_ID],
    title: row[TASKS_COLS.TITLE] || 'Untitled Task',
    description: row[TASKS_COLS.DESCRIPTION] || '',
    dueDate: row[TASKS_COLS.DUE_DATE] || '',
    attachmentFileId: attachedFile ? attachedFile[TASK_FILES_COLS.STORAGE_PATH] || attachedFile['file_path'] : null,
    attachmentFileName: attachedFile ? attachedFile[TASK_FILES_COLS.FILE_NAME] : null,
    status,
    submittedAt: row[TASKS_COLS.SUBMITTED_AT] || null,
    completedAt: row[TASKS_COLS.COMPLETED_AT] || null,
    submissionFileId: submissionFile ? submissionFile[TASK_FILES_COLS.STORAGE_PATH] || submissionFile['file_path'] : null,
    submissionFileName: submissionFile ? submissionFile[TASK_FILES_COLS.FILE_NAME] : null,
    submissionNote: row[TASKS_COLS.SUBMISSION_NOTE] || null,
    reviewerNote: row[TASKS_COLS.REVIEW_NOTE] || null,
    createdAt: row[TASKS_COLS.CREATED_AT] || new Date().toISOString(),
  };
}

/**
 * Calculate streak from attendance history
 */
function calculateStreakFromRecords(records: AttendanceRecord[], targetDate: string): number {
  if (!records || records.length === 0) return 0;
  const sorted = [...records]
    .filter((r) => r.date <= targetDate)
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;
  for (const rec of sorted) {
    if (rec.status === 'present') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Call server-side secret endpoint (e.g. /api/admin/create-user, /api/admin/reset-password).
 * If the endpoint does not exist, throws "Not available yet".
 */
async function callSecretServerEndpoint<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || getStoredToken();
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(endpoint, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 404 || response.status === 501) {
        throw new Error(data.error || 'Endpoint not available on this server');
      }
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data as T;
  } catch (err: any) {
    if (err.message && err.message !== 'Failed to fetch') {
      throw err;
    }
    throw new Error('Network error or server unreachable');
  }
}

/**
 * Central API object providing all data access.
 * Screens import and interact strictly through this API layer.
 */
export const api = {
  // -------------------------------------------------------------
  // AUTHENTICATION
  // -------------------------------------------------------------

  login: async (credentials: { username: string; password: string }): Promise<{ token: string; user: User }> => {
    const rawUsername = credentials.username.trim().toLowerCase();
    const email = rawUsername.includes('@')
      ? rawUsername
      : `${rawUsername}@${INTERNAL_EMAIL_DOMAIN}`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: credentials.password,
    });

    if (error || !data.user || !data.session) {
      throw new Error('Wrong username or password. Check and try again.');
    }

    // Fetch user profile from profiles table
    const { data: profile, error: profileErr } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .eq(PROFILES_COLS.ID, data.user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      const { data: profileByUsername } = await supabase
        .from(TABLES.PROFILES)
        .select('*')
        .eq(PROFILES_COLS.USERNAME, rawUsername)
        .maybeSingle();

      if (profileByUsername) {
        const user = mapProfileToUser(profileByUsername);
        setStoredToken(data.session.access_token);
        return { token: data.session.access_token, user };
      }

      throw new Error("Couldn't load user profile. Try again.");
    }

    const user = mapProfileToUser(profile);
    setStoredToken(data.session.access_token);
    return { token: data.session.access_token, user };
  },

  logout: async (): Promise<{ success: boolean }> => {
    await supabase.auth.signOut();
    setStoredToken(null);
    return { success: true };
  },

  getMe: async (): Promise<{ user: User }> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      throw new Error('Session expired. Please sign in again.');
    }

    const { data: profile, error } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .eq(PROFILES_COLS.ID, session.user.id)
      .maybeSingle();

    if (error || !profile) {
      throw new Error("Couldn't load profile. Try again.");
    }

    return { user: mapProfileToUser(profile) };
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> => {
    const { error } = await supabase.auth.updateUser({
      password: data.newPassword,
    });

    if (error) {
      throw new Error(error.message || "Couldn't change password. Try again.");
    }
    return { success: true, message: 'Password updated successfully.' };
  },

  /**
   * Profiles rule: a user may update only their own notification_email
   */
  updateProfile: async (data: { email?: string }): Promise<{ user: User }> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      throw new Error('Session expired. Please sign in again.');
    }

    const updatePayload: Record<string, any> = {};
    if (data.email !== undefined) {
      updatePayload[PROFILES_COLS.NOTIFICATION_EMAIL] = data.email;
    }

    const { data: updated, error } = await supabase
      .from(TABLES.PROFILES)
      .update(updatePayload)
      .eq(PROFILES_COLS.ID, session.user.id)
      .select()
      .single();

    if (error || !updated) {
      throw new Error("Couldn't update profile. Try again.");
    }

    return { user: mapProfileToUser(updated) };
  },

  // -------------------------------------------------------------
  // STUDENT APIS
  // -------------------------------------------------------------

  getStudentHome: async (): Promise<StudentDashboardData> => {
    const meRes = await api.getMe();
    const student = meRes.user;
    const today = getKolkataDateString();

    // Note: ensure_today() is called only on guide and admin screens, never on student screens.
    // Students only read their own attendance rows.

    // 1. Fetch guide info
    let guide: { id: string; fullName: string; username: string } | null = null;
    if (student.guideId) {
      const { data: guideProfile } = await supabase
        .from(TABLES.PROFILES)
        .select('*')
        .eq(PROFILES_COLS.ID, student.guideId)
        .maybeSingle();

      if (guideProfile) {
        guide = {
          id: guideProfile[PROFILES_COLS.ID],
          fullName: guideProfile[PROFILES_COLS.FULL_NAME] || guideProfile[PROFILES_COLS.USERNAME],
          username: guideProfile[PROFILES_COLS.USERNAME],
        };
      }
    }

    // 2. Fetch today's attendance record
    const { data: todayAttRow } = await supabase
      .from(TABLES.ATTENDANCE)
      .select('*')
      .eq(ATTENDANCE_COLS.STUDENT_ID, student.id)
      .eq(ATTENDANCE_COLS.DATE, today)
      .maybeSingle();

    const todayRecord: AttendanceRecord = todayAttRow
      ? mapAttendanceRow(todayAttRow)
      : {
          id: '',
          studentId: student.id,
          date: today,
          status: 'absent',
          isMarked: false,
          level: null,
          points: 0,
          note: null,
          markedBy: null,
          markedAt: null,
        };

    // 3. Fetch attendance history
    const { data: attendanceHistoryRows, error: attError } = await supabase
      .from(TABLES.ATTENDANCE)
      .select('*')
      .eq(ATTENDANCE_COLS.STUDENT_ID, student.id)
      .order(ATTENDANCE_COLS.DATE, { ascending: false });

    if (attError) {
      throw new Error("Couldn't load attendance history. Try again.");
    }

    const attendanceHistory: AttendanceRecord[] = (attendanceHistoryRows || []).map(mapAttendanceRow);

    // 4. Calculate streak using current_streak(p_student) RPC
    let streak = 0;
    try {
      const { data: streakData, error: streakErr } = await supabase.rpc(RPCS.CURRENT_STREAK, {
        [RPC_ARGS.CURRENT_STREAK.STUDENT]: student.id,
      });
      if (!streakErr && typeof streakData === 'number') {
        streak = streakData;
      } else {
        streak = calculateStreakFromRecords(attendanceHistory, today);
      }
    } catch {
      streak = calculateStreakFromRecords(attendanceHistory, today);
    }

    const totalPoints = attendanceHistory.reduce((sum, r) => sum + (r.points || 0), 0);

    // 5. Fetch tasks
    const { data: taskRows, error: tasksError } = await supabase
      .from(TABLES.TASKS)
      .select('*')
      .eq(TASKS_COLS.STUDENT_ID, student.id)
      .order(TASKS_COLS.CREATED_AT, { ascending: false });

    if (tasksError) {
      throw new Error("Couldn't load tasks. Try again.");
    }

    const taskIds = (taskRows || []).map((t) => t[TASKS_COLS.ID]);
    let taskFiles: any[] = [];
    if (taskIds.length > 0) {
      const { data: filesData } = await supabase
        .from(TABLES.TASK_FILES)
        .select('*')
        .in(TASK_FILES_COLS.TASK_ID, taskIds);
      taskFiles = filesData || [];
    }

    const allTasks: TaskRecord[] = (taskRows || []).map((t) => mapTaskRow(t, taskFiles));
    const pendingTasks = allTasks.filter((t) => t.status === 'assigned' || t.status === 'awaiting_review');
    const completedTasks = allTasks.filter((t) => t.status === 'completed');

    // 6. Fetch remarks (remarks: body column)
    const { data: remarkRows, error: remarksErr } = await supabase
      .from(TABLES.REMARKS)
      .select('*')
      .eq(REMARKS_COLS.STUDENT_ID, student.id)
      .order(REMARKS_COLS.CREATED_AT, { ascending: false });

    if (remarksErr) {
      throw new Error("Couldn't load remarks. Try again.");
    }

    const remarks: RemarkRecord[] = (remarkRows || []).map((r) => ({
      id: r[REMARKS_COLS.ID],
      guideId: r[REMARKS_COLS.GUIDE_ID],
      guideName: guide?.fullName,
      studentId: r[REMARKS_COLS.STUDENT_ID],
      content: r[REMARKS_COLS.BODY] || '',
      createdAt: r[REMARKS_COLS.CREATED_AT],
    }));

    // 7. Fetch programs (try my_programs() RPC first)
    let programs: Program[] = [];
    try {
      const { data: myProgs, error: myProgsErr } = await supabase.rpc(RPCS.MY_PROGRAMS);
      if (!myProgsErr && Array.isArray(myProgs)) {
        programs = myProgs.map((p: any) => ({
          id: p.program_id || p.id,
          name: p.name,
          category: p.kind || '',
          type: p.kind === 'group' ? 'group' : 'solo',
          description: p.description || '',
          createdAt: new Date().toISOString(),
        }));
      }
    } catch {
      // Fallback to table query
    }

    if (programs.length === 0) {
      const { data: memberRows } = await supabase
        .from(TABLES.PROGRAM_MEMBERS)
        .select(`${PROGRAM_MEMBERS_COLS.PROGRAM_ID}, ${TABLES.PROGRAMS} (*)`)
        .eq(PROGRAM_MEMBERS_COLS.STUDENT_ID, student.id);

      programs = (memberRows || [])
        .map((m: any) => m[TABLES.PROGRAMS])
        .filter(Boolean)
        .map((p: any) => ({
          id: p[PROGRAMS_COLS.ID],
          name: p[PROGRAMS_COLS.NAME],
          category: p[PROGRAMS_COLS.KIND] || '',
          type: p[PROGRAMS_COLS.KIND] === 'group' ? 'group' : 'solo',
          description: p[PROGRAMS_COLS.DESCRIPTION] || '',
          createdAt: p[PROGRAMS_COLS.CREATED_AT],
        }));
    }

    // 8. Check screenshot today
    const { data: screenshotToday } = await supabase
      .from(TABLES.SCREENSHOT_LOG)
      .select('*')
      .eq(SCREENSHOT_LOG_COLS.STUDENT_ID, student.id)
      .eq(SCREENSHOT_LOG_COLS.DATE, today)
      .maybeSingle();

    const hasUploadedScreenshotToday = Boolean(screenshotToday);

    // 9. Leaderboard rank & total students
    let rank = 1;
    let totalStudents = 1;
    try {
      const { data: lbData } = await supabase.rpc(RPCS.GET_LEADERBOARD);
      if (Array.isArray(lbData) && lbData.length > 0) {
        totalStudents = lbData.length;
        const myIndex = lbData.findIndex((entry: any) => entry.student_id === student.id || entry.id === student.id);
        if (myIndex !== -1) {
          rank = lbData[myIndex].rank || myIndex + 1;
        }
      }
    } catch {
      rank = 1;
      totalStudents = 1;
    }

    return {
      student,
      guide,
      streak,
      totalPoints,
      rank,
      totalStudents,
      todayRecord,
      pendingTasks,
      completedTasks,
      remarks,
      programs,
      hasUploadedScreenshotToday,
      attendanceHistory,
    };
  },

  getStudentProgress: async () => {
    const homeData = await api.getStudentHome();
    return {
      attendanceHistory: homeData.attendanceHistory,
      remarks: homeData.remarks,
      programs: homeData.programs,
      streak: homeData.streak,
      totalPoints: homeData.totalPoints,
      hasUploadedScreenshotToday: homeData.hasUploadedScreenshotToday,
    };
  },

  getStudentTasks: async (): Promise<{ tasks: TaskRecord[] }> => {
    const meRes = await api.getMe();
    const { data: taskRows, error } = await supabase
      .from(TABLES.TASKS)
      .select('*')
      .eq(TASKS_COLS.STUDENT_ID, meRes.user.id)
      .order(TASKS_COLS.CREATED_AT, { ascending: false });

    if (error) {
      throw new Error("Couldn't load tasks. Try again.");
    }

    const taskIds = (taskRows || []).map((t) => t[TASKS_COLS.ID]);
    let taskFiles: any[] = [];
    if (taskIds.length > 0) {
      const { data: filesData } = await supabase
        .from(TABLES.TASK_FILES)
        .select('*')
        .in(TASK_FILES_COLS.TASK_ID, taskIds);
      taskFiles = filesData || [];
    }

    return { tasks: (taskRows || []).map((t) => mapTaskRow(t, taskFiles)) };
  },

  /**
   * Submit student task for review.
   * Calls submit_task(p_task, p_note) RPC.
   * Upload file first to task-files bucket, then insert into task_files table.
   */
  submitStudentTask: async (
    taskId: string,
    data: { submissionFileId?: string | null; submissionFileName?: string | null; submissionNote?: string | null }
  ): Promise<{ task: TaskRecord }> => {
    const me = (await api.getMe()).user;

    // Call submit_task(p_task, p_note)
    const { error: rpcErr } = await supabase.rpc(RPCS.SUBMIT_TASK, {
      [RPC_ARGS.SUBMIT_TASK.TASK]: taskId,
      [RPC_ARGS.SUBMIT_TASK.NOTE]: data.submissionNote || null,
    });

    if (rpcErr) {
      throw new Error("Couldn't submit task. Try again.");
    }

    // Insert submission file if attached
    if (data.submissionFileId) {
      await supabase.from(TABLES.TASK_FILES).insert({
        [TASK_FILES_COLS.TASK_ID]: taskId,
        [TASK_FILES_COLS.STORAGE_PATH]: data.submissionFileId,
        [TASK_FILES_COLS.FILE_NAME]: data.submissionFileName || 'submission_file',
        [TASK_FILES_COLS.KIND]: TASK_FILE_KINDS.SUBMISSION,
        [TASK_FILES_COLS.UPLOADER_ID]: me.id,
      });
    }

    const { data: freshTask } = await supabase
      .from(TABLES.TASKS)
      .select('*')
      .eq(TASKS_COLS.ID, taskId)
      .single();

    return { task: mapTaskRow(freshTask) };
  },

  completeStudentTask: async (
    taskId: string,
    data: { submissionFileId?: string | null; submissionFileName?: string | null; submissionNote?: string | null }
  ) => {
    return api.submitStudentTask(taskId, data);
  },

  /**
   * Record screenshot using record_screenshot(p_path) RPC.
   * Upload the file first to screenshots bucket at {student_id}/{yyyy-mm-dd}.jpg,
   * then call record_screenshot with the exact same path.
   */
  uploadScreenshotRecord: async (data: { fileId: string; fileName: string; fileSize: number }): Promise<{ record: ScreenshotRecord; message: string }> => {
    const me = (await api.getMe()).user;
    const today = getKolkataDateString();

    const { error: rpcErr } = await supabase.rpc(RPCS.RECORD_SCREENSHOT, {
      [RPC_ARGS.RECORD_SCREENSHOT.PATH]: data.fileId,
    });

    if (rpcErr) {
      throw new Error("Couldn't save screenshot record. Try again.");
    }

    const record: ScreenshotRecord = {
      id: `${me.id}_${today}`,
      studentId: me.id,
      studentName: me.fullName,
      studentRoll: me.username,
      date: today,
      fileId: data.fileId,
      fileName: data.fileName,
      fileSize: data.fileSize,
      submittedAt: new Date().toISOString(),
      purgedAt: null,
      status: 'submitted',
    };

    return { record, message: 'Screenshot uploaded and verified.' };
  },

  // -------------------------------------------------------------
  // GUIDE APIS
  // -------------------------------------------------------------

  getGuideToday: async (dateParam?: string): Promise<GuideTodayData> => {
    const me = (await api.getMe()).user;
    const date = dateParam || getKolkataDateString();

    // Call ensure_today() RPC when guide screen loads
    try {
      await supabase.rpc(RPCS.ENSURE_TODAY);
    } catch {
      // ignore
    }

    // Load mentees assigned to this guide
    const { data: menteeProfiles, error: menteesErr } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .eq(PROFILES_COLS.GUIDE_ID, me.id)
      .eq(PROFILES_COLS.ROLE, 'student')
      .order(PROFILES_COLS.FULL_NAME, { ascending: true });

    if (menteesErr) {
      throw new Error("Couldn't load mentees. Try again.");
    }

    const menteeIds = (menteeProfiles || []).map((m) => m[PROFILES_COLS.ID]);

    // Load attendance for these mentees for this date
    let attendanceMap = new Map<string, any>();
    if (menteeIds.length > 0) {
      const { data: attRows } = await supabase
        .from(TABLES.ATTENDANCE)
        .select('*')
        .in(ATTENDANCE_COLS.STUDENT_ID, menteeIds)
        .eq(ATTENDANCE_COLS.DATE, date);

      (attRows || []).forEach((row) => attendanceMap.set(row[ATTENDANCE_COLS.STUDENT_ID], row));
    }

    // Historical attendance for streaks & points
    let historyByStudent = new Map<string, AttendanceRecord[]>();
    if (menteeIds.length > 0) {
      const { data: histRows } = await supabase
        .from(TABLES.ATTENDANCE)
        .select('*')
        .in(ATTENDANCE_COLS.STUDENT_ID, menteeIds);

      (histRows || []).forEach((row) => {
        const studentId = row[ATTENDANCE_COLS.STUDENT_ID];
        const existing = historyByStudent.get(studentId) || [];
        existing.push(mapAttendanceRow(row));
        historyByStudent.set(studentId, existing);
      });
    }

    // Programs for mentees
    let programsByStudent = new Map<string, Program[]>();
    if (menteeIds.length > 0) {
      const { data: memberRows } = await supabase
        .from(TABLES.PROGRAM_MEMBERS)
        .select(`${PROGRAM_MEMBERS_COLS.STUDENT_ID}, ${TABLES.PROGRAMS} (*)`)
        .in(PROGRAM_MEMBERS_COLS.STUDENT_ID, menteeIds);

      (memberRows || []).forEach((m: any) => {
        const studentId = m[PROGRAM_MEMBERS_COLS.STUDENT_ID];
        const prog = m[TABLES.PROGRAMS];
        if (prog) {
          const list = programsByStudent.get(studentId) || [];
          list.push({
            id: prog[PROGRAMS_COLS.ID],
            name: prog[PROGRAMS_COLS.NAME],
            category: prog[PROGRAMS_COLS.KIND] || '',
            type: prog[PROGRAMS_COLS.KIND] === 'group' ? 'group' : 'solo',
            description: prog[PROGRAMS_COLS.DESCRIPTION] || '',
            createdAt: prog[PROGRAMS_COLS.CREATED_AT],
          });
          programsByStudent.set(studentId, list);
        }
      });
    }

    let presentCount = 0;
    const mentees = (menteeProfiles || []).map((m) => {
      const student = mapProfileToUser(m);
      const attRow = attendanceMap.get(student.id);
      const studentHistory = historyByStudent.get(student.id) || [];

      const attRecord: AttendanceRecord = attRow
        ? mapAttendanceRow(attRow)
        : {
            id: '',
            studentId: student.id,
            date,
            status: 'absent',
            isMarked: false,
            level: null,
            points: 0,
            note: null,
            markedBy: null,
            markedAt: null,
          };

      if (attRecord.status === 'present') presentCount++;

      const streak = calculateStreakFromRecords(studentHistory, date);
      const totalPoints = studentHistory.reduce((sum, r) => sum + (r.points || 0), 0);

      return {
        student,
        programs: programsByStudent.get(student.id) || [],
        attendance: attRecord,
        streak,
        totalPoints,
      };
    });

    return {
      date,
      totalMentees: mentees.length,
      presentCount,
      mentees,
    };
  },

  /**
   * Mark attendance by Guide.
   * Direct UPDATE only on status, score_level, note on existing rows.
   * Never writes points, marked_by, or marked_at.
   */
  markGuideAttendance: async (data: {
    studentId: string;
    date: string;
    status: 'present' | 'absent';
    level?: LadderLevel | null;
    note?: string | null;
  }): Promise<{ record: AttendanceRecord }> => {
    // attendance.score_level is a smallint, 5 to 10, or null.
    // Never send or expect text. Absent always has null level.
    let numericLevel: number | null = null;
    if (data.status === 'present' && data.level) {
      numericLevel = LABEL_TO_SCORE_LEVEL[data.level] || (typeof data.level === 'number' ? data.level : null);
    }

    const { data: updated, error } = await supabase
      .from(TABLES.ATTENDANCE)
      .update({
        [ATTENDANCE_COLS.STATUS]: data.status,
        [ATTENDANCE_COLS.SCORE_LEVEL]: numericLevel,
        [ATTENDANCE_COLS.NOTE]: data.note || null,
      })
      .eq(ATTENDANCE_COLS.STUDENT_ID, data.studentId)
      .eq(ATTENDANCE_COLS.DATE, data.date)
      .select()
      .single();

    if (error || !updated) {
      throw new Error("Couldn't save attendance. Try again.");
    }

    return { record: mapAttendanceRow(updated) };
  },

  getGuideMentees: async () => {
    const today = getKolkataDateString();
    const todayData = await api.getGuideToday(today);
    const me = (await api.getMe()).user;

    const { data: remarkRows } = await supabase
      .from(TABLES.REMARKS)
      .select('*')
      .eq(REMARKS_COLS.GUIDE_ID, me.id);

    const { data: taskRows } = await supabase
      .from(TABLES.TASKS)
      .select('*')
      .eq(TASKS_COLS.GUIDE_ID, me.id);

    const remarksByStudent = new Map<string, RemarkRecord[]>();
    (remarkRows || []).forEach((r) => {
      const list = remarksByStudent.get(r[REMARKS_COLS.STUDENT_ID]) || [];
      list.push({
        id: r[REMARKS_COLS.ID],
        guideId: r[REMARKS_COLS.GUIDE_ID],
        studentId: r[REMARKS_COLS.STUDENT_ID],
        content: r[REMARKS_COLS.BODY] || '',
        createdAt: r[REMARKS_COLS.CREATED_AT],
      });
      remarksByStudent.set(r[REMARKS_COLS.STUDENT_ID], list);
    });

    const tasksByStudent = new Map<string, TaskRecord[]>();
    (taskRows || []).forEach((t) => {
      const list = tasksByStudent.get(t[TASKS_COLS.STUDENT_ID]) || [];
      list.push(mapTaskRow(t));
      tasksByStudent.set(t[TASKS_COLS.STUDENT_ID], list);
    });

    const mentees = todayData.mentees.map((m) => ({
      student: m.student,
      programs: m.programs,
      streak: m.streak,
      totalPoints: m.totalPoints,
      remarks: remarksByStudent.get(m.student.id) || [],
      tasks: tasksByStudent.get(m.student.id) || [],
    }));

    return { mentees };
  },

  getGuideTasks: async (): Promise<{ tasks: TaskRecord[] }> => {
    const me = (await api.getMe()).user;
    const { data: taskRows, error } = await supabase
      .from(TABLES.TASKS)
      .select('*')
      .eq(TASKS_COLS.GUIDE_ID, me.id)
      .order(TASKS_COLS.CREATED_AT, { ascending: false });

    if (error) {
      throw new Error("Couldn't load guide tasks. Try again.");
    }

    const taskIds = (taskRows || []).map((t) => t[TASKS_COLS.ID]);
    let taskFiles: any[] = [];
    if (taskIds.length > 0) {
      const { data: filesData } = await supabase
        .from(TABLES.TASK_FILES)
        .select('*')
        .in(TASK_FILES_COLS.TASK_ID, taskIds);
      taskFiles = filesData || [];
    }

    return { tasks: (taskRows || []).map((t) => mapTaskRow(t, taskFiles)) };
  },

  /**
   * Guide inserts new task with guide_id = own id.
   * Status defaults to 'assigned'.
   */
  createGuideTask: async (data: {
    studentId: string;
    title: string;
    description: string;
    dueDate: string;
    attachmentFileId?: string | null;
    attachmentFileName?: string | null;
  }): Promise<{ task: TaskRecord }> => {
    const me = (await api.getMe()).user;

    const { data: taskRow, error } = await supabase
      .from(TABLES.TASKS)
      .insert({
        [TASKS_COLS.GUIDE_ID]: me.id,
        [TASKS_COLS.STUDENT_ID]: data.studentId,
        [TASKS_COLS.TITLE]: data.title,
        [TASKS_COLS.DESCRIPTION]: data.description || '',
        [TASKS_COLS.DUE_DATE]: data.dueDate,
        [TASKS_COLS.STATUS]: TASK_STATUS.ASSIGNED,
      })
      .select()
      .single();

    if (error || !taskRow) {
      throw new Error("Couldn't create task. Try again.");
    }

    if (data.attachmentFileId) {
      await supabase.from(TABLES.TASK_FILES).insert({
        [TASK_FILES_COLS.TASK_ID]: taskRow[TASKS_COLS.ID],
        [TASK_FILES_COLS.STORAGE_PATH]: data.attachmentFileId,
        [TASK_FILES_COLS.FILE_NAME]: data.attachmentFileName || 'attachment',
        [TASK_FILES_COLS.KIND]: TASK_FILE_KINDS.GUIDE_ATTACHMENT,
        [TASK_FILES_COLS.UPLOADER_ID]: me.id,
      });
    }

    return { task: mapTaskRow(taskRow) };
  },

  /**
   * Complete task by Guide or Admin.
   * Calls review_task(p_task, p_action, p_note) RPC with p_action: 'complete'.
   */
  completeGuideTask: async (taskId: string, note?: string | null): Promise<{ task: TaskRecord }> => {
    const { error: rpcErr } = await supabase.rpc(RPCS.REVIEW_TASK, {
      [RPC_ARGS.REVIEW_TASK.TASK]: taskId,
      [RPC_ARGS.REVIEW_TASK.ACTION]: REVIEW_TASK_ACTIONS.COMPLETE,
      [RPC_ARGS.REVIEW_TASK.NOTE]: note || null,
    });

    if (rpcErr) {
      throw new Error("Couldn't complete task. Try again.");
    }

    const { data: updatedTask } = await supabase
      .from(TABLES.TASKS)
      .select('*')
      .eq(TASKS_COLS.ID, taskId)
      .single();

    return { task: mapTaskRow(updatedTask) };
  },

  /**
   * Send back task to student with required note.
   * Calls review_task(p_task, p_action, p_note) RPC with p_action: 'send_back'.
   */
  sendBackGuideTask: async (taskId: string, note: string): Promise<{ task: TaskRecord }> => {
    if (!note || !note.trim()) {
      throw new Error('A reason note explaining why the task is sent back is required.');
    }

    const { error: rpcErr } = await supabase.rpc(RPCS.REVIEW_TASK, {
      [RPC_ARGS.REVIEW_TASK.TASK]: taskId,
      [RPC_ARGS.REVIEW_TASK.ACTION]: REVIEW_TASK_ACTIONS.SEND_BACK,
      [RPC_ARGS.REVIEW_TASK.NOTE]: note.trim(),
    });

    if (rpcErr) {
      throw new Error("Couldn't send back task. Try again.");
    }

    const { data: updatedTask } = await supabase
      .from(TABLES.TASKS)
      .select('*')
      .eq(TASKS_COLS.ID, taskId)
      .single();

    return { task: mapTaskRow(updatedTask) };
  },

  /**
   * Insert remark for student.
   * Column is body.
   */
  createGuideRemark: async (data: { studentId: string; content: string }): Promise<{ remark: RemarkRecord }> => {
    const me = (await api.getMe()).user;

    const { data: remarkRow, error } = await supabase
      .from(TABLES.REMARKS)
      .insert({
        [REMARKS_COLS.GUIDE_ID]: me.id,
        [REMARKS_COLS.STUDENT_ID]: data.studentId,
        [REMARKS_COLS.BODY]: data.content,
      })
      .select()
      .single();

    if (error || !remarkRow) {
      throw new Error("Couldn't add remark. Try again.");
    }

    return {
      remark: {
        id: remarkRow[REMARKS_COLS.ID],
        guideId: me.id,
        guideName: me.fullName,
        studentId: data.studentId,
        content: remarkRow[REMARKS_COLS.BODY],
        createdAt: remarkRow[REMARKS_COLS.CREATED_AT],
      },
    };
  },

  /**
   * Send reminder to student.
   * Calls send_reminder(p_target, p_message) RPC.
   */
  remindStudent: async (data: { studentId: string; type: 'meet' | 'task'; taskTitle?: string }): Promise<{ success: boolean; message: string }> => {
    const me = (await api.getMe()).user;
    const message =
      data.type === 'meet'
        ? `${me.fullName} has requested you to meet with them today regarding your preparations.`
        : `Reminder from ${me.fullName}: Please complete task "${data.taskTitle || 'Pending task'}".`;

    const { error } = await supabase.rpc(RPCS.SEND_REMINDER, {
      [RPC_ARGS.SEND_REMINDER.TARGET]: data.studentId,
      [RPC_ARGS.SEND_REMINDER.MESSAGE]: message,
    });

    if (error) {
      throw new Error("Couldn't send reminder. Try again.");
    }

    return { success: true, message: 'Reminder sent to student.' };
  },

  // -------------------------------------------------------------
  // ADMIN APIS
  // -------------------------------------------------------------

  completeAdminTask: (taskId: string, note?: string | null) => api.completeGuideTask(taskId, note),
  sendBackAdminTask: (taskId: string, note: string) => api.sendBackGuideTask(taskId, note),

  getAdminOverview: async (dateParam?: string): Promise<AdminTodayData> => {
    const date = dateParam || getKolkataDateString();

    // Call ensure_today() RPC when admin screen loads
    try {
      await supabase.rpc(RPCS.ENSURE_TODAY);
    } catch {
      // ignore
    }

    // Load students and guides
    const { data: allProfiles, error: profErr } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .order(PROFILES_COLS.FULL_NAME, { ascending: true });

    if (profErr) {
      throw new Error("Couldn't load students. Try again.");
    }

    const students = (allProfiles || []).filter((p) => p[PROFILES_COLS.ROLE] === 'student');
    const guides = (allProfiles || []).filter((p) => p[PROFILES_COLS.ROLE] === 'guide');
    const guideMap = new Map(guides.map((g) => [g[PROFILES_COLS.ID], g]));

    // Load attendance for this date
    const { data: attRows } = await supabase
      .from(TABLES.ATTENDANCE)
      .select('*')
      .eq(ATTENDANCE_COLS.DATE, date);

    const attMap = new Map((attRows || []).map((a) => [a[ATTENDANCE_COLS.STUDENT_ID], a]));

    // Load screenshots for this date
    const { data: scRows } = await supabase
      .from(TABLES.SCREENSHOT_LOG)
      .select('*')
      .eq(SCREENSHOT_LOG_COLS.DATE, date);

    const scMap = new Map((scRows || []).map((s) => [s[SCREENSHOT_LOG_COLS.STUDENT_ID], s]));

    // Historical attendance for streaks & points
    const { data: allAttRows } = await supabase.from(TABLES.ATTENDANCE).select('*');
    const historyByStudent = new Map<string, AttendanceRecord[]>();
    (allAttRows || []).forEach((row) => {
      const studentId = row[ATTENDANCE_COLS.STUDENT_ID];
      const list = historyByStudent.get(studentId) || [];
      list.push(mapAttendanceRow(row));
      historyByStudent.set(studentId, list);
    });

    let presentCount = 0;
    let absentCount = 0;
    let unscoredCount = 0;

    const roster = students.map((s) => {
      const guide = s[PROFILES_COLS.GUIDE_ID] ? guideMap.get(s[PROFILES_COLS.GUIDE_ID]) : null;
      const attRow = attMap.get(s[PROFILES_COLS.ID]);
      const att = attRow
        ? mapAttendanceRow(attRow)
        : {
            id: '',
            studentId: s[PROFILES_COLS.ID],
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
        if (att.points === null) unscoredCount++;
      } else {
        absentCount++;
      }

      const studentHistory = historyByStudent.get(s[PROFILES_COLS.ID]) || [];
      const streak = calculateStreakFromRecords(studentHistory, date);
      const totalPoints = studentHistory.reduce((sum, r) => sum + (r.points || 0), 0);
      const hasScreenshot = scMap.has(s[PROFILES_COLS.ID]);

      return {
        studentId: s[PROFILES_COLS.ID],
        studentName: s[PROFILES_COLS.FULL_NAME] || s[PROFILES_COLS.USERNAME],
        studentRoll: s[PROFILES_COLS.USERNAME],
        guideId: s[PROFILES_COLS.GUIDE_ID],
        guideName: guide ? guide[PROFILES_COLS.FULL_NAME] : 'Unassigned',
        status: att.status,
        isMarked: att.isMarked,
        level: att.level,
        points: att.points,
        note: att.note,
        streak,
        totalPoints,
        hasScreenshot,
      };
    });

    let unmarkedGuidesCount = 0;
    const guidesStatus = guides.map((g) => {
      const mentees = students.filter((s) => s[PROFILES_COLS.GUIDE_ID] === g[PROFILES_COLS.ID]);
      const markedCount = mentees.filter((m) => {
        const att = attMap.get(m[PROFILES_COLS.ID]);
        return att && Boolean(att[ATTENDANCE_COLS.SCORE_LEVEL] || att[ATTENDANCE_COLS.NOTE]);
      }).length;
      const allMarked = mentees.length > 0 && markedCount === mentees.length;
      if (mentees.length > 0 && markedCount < mentees.length) {
        unmarkedGuidesCount++;
      }
      return {
        guideId: g[PROFILES_COLS.ID],
        guideName: g[PROFILES_COLS.FULL_NAME] || g[PROFILES_COLS.USERNAME],
        menteesCount: mentees.length,
        markedCount,
        allMarked,
      };
    });

    return {
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
    };
  },

  getAdminGuides: async (dateParam?: string) => {
    const date = dateParam || getKolkataDateString();

    const { data: allProfiles, error } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .order(PROFILES_COLS.FULL_NAME, { ascending: true });

    if (error) {
      throw new Error("Couldn't load guides. Try again.");
    }

    const guides = (allProfiles || []).filter((p) => p[PROFILES_COLS.ROLE] === 'guide');
    const students = (allProfiles || []).filter((p) => p[PROFILES_COLS.ROLE] === 'student');

    const { data: attRows } = await supabase
      .from(TABLES.ATTENDANCE)
      .select('*')
      .eq(ATTENDANCE_COLS.DATE, date);

    const attMap = new Map((attRows || []).map((a) => [a[ATTENDANCE_COLS.STUDENT_ID], mapAttendanceRow(a)]));

    const { data: allAttRows } = await supabase.from(TABLES.ATTENDANCE).select('*');
    const historyByStudent = new Map<string, AttendanceRecord[]>();
    (allAttRows || []).forEach((row) => {
      const studentId = row[ATTENDANCE_COLS.STUDENT_ID];
      const list = historyByStudent.get(studentId) || [];
      list.push(mapAttendanceRow(row));
      historyByStudent.set(studentId, list);
    });

    const { data: memberRows } = await supabase
      .from(TABLES.PROGRAM_MEMBERS)
      .select(`${PROGRAM_MEMBERS_COLS.STUDENT_ID}, ${TABLES.PROGRAMS} (*)`);

    const programsByStudent = new Map<string, string[]>();
    (memberRows || []).forEach((m: any) => {
      const studentId = m[PROGRAM_MEMBERS_COLS.STUDENT_ID];
      const p = m[TABLES.PROGRAMS];
      if (p) {
        const list = programsByStudent.get(studentId) || [];
        list.push(p[PROGRAMS_COLS.NAME]);
        programsByStudent.set(studentId, list);
      }
    });

    const result = guides.map((guide) => {
      const mentees = students
        .filter((s) => s[PROFILES_COLS.GUIDE_ID] === guide[PROFILES_COLS.ID])
        .map((m) => {
          const studentAtt = attMap.get(m[PROFILES_COLS.ID]) || null;
          const hist = historyByStudent.get(m[PROFILES_COLS.ID]) || [];
          return {
            id: m[PROFILES_COLS.ID],
            fullName: m[PROFILES_COLS.FULL_NAME],
            username: m[PROFILES_COLS.USERNAME],
            email: m[PROFILES_COLS.NOTIFICATION_EMAIL],
            programs: programsByStudent.get(m[PROFILES_COLS.ID]) || [],
            attendance: studentAtt,
            streak: calculateStreakFromRecords(hist, date),
            totalPoints: hist.reduce((sum, r) => sum + (r.points || 0), 0),
          };
        });

      const markedCount = mentees.filter((m) => m.attendance?.isMarked).length;
      const allMarked = mentees.length > 0 && markedCount === mentees.length;

      return {
        id: guide[PROFILES_COLS.ID],
        fullName: guide[PROFILES_COLS.FULL_NAME],
        username: guide[PROFILES_COLS.USERNAME],
        email: guide[PROFILES_COLS.NOTIFICATION_EMAIL],
        menteesCount: mentees.length,
        markedCount,
        allMarked,
        mentees,
      };
    });

    return { guides: result, date };
  },

  getAdminStudents: async () => {
    const today = getKolkataDateString();
    const { data: allProfiles, error } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .order(PROFILES_COLS.FULL_NAME, { ascending: true });

    if (error) {
      throw new Error("Couldn't load students. Try again.");
    }

    const students = (allProfiles || []).filter((p) => p[PROFILES_COLS.ROLE] === 'student');
    const guides = (allProfiles || []).filter((p) => p[PROFILES_COLS.ROLE] === 'guide');
    const guideMap = new Map(guides.map((g) => [g[PROFILES_COLS.ID], g]));

    const { data: allAttRows } = await supabase.from(TABLES.ATTENDANCE).select('*');
    const historyByStudent = new Map<string, AttendanceRecord[]>();
    (allAttRows || []).forEach((row) => {
      const studentId = row[ATTENDANCE_COLS.STUDENT_ID];
      const list = historyByStudent.get(studentId) || [];
      list.push(mapAttendanceRow(row));
      historyByStudent.set(studentId, list);
    });

    const { data: memberRows } = await supabase
      .from(TABLES.PROGRAM_MEMBERS)
      .select(`${PROGRAM_MEMBERS_COLS.STUDENT_ID}, ${TABLES.PROGRAMS} (*)`);

    const programsByStudent = new Map<string, string[]>();
    (memberRows || []).forEach((m: any) => {
      const studentId = m[PROGRAM_MEMBERS_COLS.STUDENT_ID];
      const p = m[TABLES.PROGRAMS];
      if (p) {
        const list = programsByStudent.get(studentId) || [];
        list.push(p[PROGRAMS_COLS.NAME]);
        programsByStudent.set(studentId, list);
      }
    });

    const list = students.map((s) => {
      const guide = s[PROFILES_COLS.GUIDE_ID] ? guideMap.get(s[PROFILES_COLS.GUIDE_ID]) : null;
      const hist = historyByStudent.get(s[PROFILES_COLS.ID]) || [];
      const user = mapProfileToUser(s);
      return {
        ...user,
        guideName: guide ? guide[PROFILES_COLS.FULL_NAME] : 'Unassigned',
        programs: programsByStudent.get(s[PROFILES_COLS.ID]) || [],
        streak: calculateStreakFromRecords(hist, today),
        totalPoints: hist.reduce((sum, r) => sum + (r.points || 0), 0),
      };
    });

    return { students: list };
  },

  getAdminStudentDetail: async (id: string) => {
    const today = getKolkataDateString();

    const { data: profile, error: profErr } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .eq(PROFILES_COLS.ID, id)
      .single();

    if (profErr || !profile) {
      throw new Error("Couldn't load student detail. Try again.");
    }

    const student = mapProfileToUser(profile);

    let guide: { id: string; fullName: string; username: string } | null = null;
    if (student.guideId) {
      const { data: guideRow } = await supabase
        .from(TABLES.PROFILES)
        .select('*')
        .eq(PROFILES_COLS.ID, student.guideId)
        .maybeSingle();
      if (guideRow) {
        guide = {
          id: guideRow[PROFILES_COLS.ID],
          fullName: guideRow[PROFILES_COLS.FULL_NAME],
          username: guideRow[PROFILES_COLS.USERNAME],
        };
      }
    }

    // Programs
    const { data: memberRows } = await supabase
      .from(TABLES.PROGRAM_MEMBERS)
      .select(`${PROGRAM_MEMBERS_COLS.PROGRAM_ID}, ${TABLES.PROGRAMS} (*)`)
      .eq(PROGRAM_MEMBERS_COLS.STUDENT_ID, id);

    const programs: Program[] = (memberRows || [])
      .map((m: any) => m[TABLES.PROGRAMS])
      .filter(Boolean)
      .map((p: any) => ({
        id: p[PROGRAMS_COLS.ID],
        name: p[PROGRAMS_COLS.NAME],
        category: p[PROGRAMS_COLS.KIND] || '',
        type: p[PROGRAMS_COLS.KIND] === 'group' ? 'group' : 'solo',
        description: p[PROGRAMS_COLS.DESCRIPTION] || '',
        createdAt: p[PROGRAMS_COLS.CREATED_AT],
      }));

    // Attendance history
    const { data: attRows } = await supabase
      .from(TABLES.ATTENDANCE)
      .select('*')
      .eq(ATTENDANCE_COLS.STUDENT_ID, id)
      .order(ATTENDANCE_COLS.DATE, { ascending: false });

    const attendanceHistory: AttendanceRecord[] = (attRows || []).map(mapAttendanceRow);
    const streak = calculateStreakFromRecords(attendanceHistory, today);
    const totalPoints = attendanceHistory.reduce((sum, r) => sum + (r.points || 0), 0);

    // Tasks and task_files
    const { data: taskRows } = await supabase
      .from(TABLES.TASKS)
      .select('*')
      .eq(TASKS_COLS.STUDENT_ID, id)
      .order(TASKS_COLS.CREATED_AT, { ascending: false });

    const taskIds = (taskRows || []).map((t) => t[TASKS_COLS.ID]);
    let taskFiles: any[] = [];
    if (taskIds.length > 0) {
      const { data: filesData } = await supabase
        .from(TABLES.TASK_FILES)
        .select('*')
        .in(TASK_FILES_COLS.TASK_ID, taskIds);
      taskFiles = filesData || [];
    }

    const tasks: TaskRecord[] = (taskRows || []).map((t) => mapTaskRow(t, taskFiles));

    // Remarks
    const { data: remarkRows } = await supabase
      .from(TABLES.REMARKS)
      .select('*')
      .eq(REMARKS_COLS.STUDENT_ID, id)
      .order(REMARKS_COLS.CREATED_AT, { ascending: false });

    const remarks: RemarkRecord[] = (remarkRows || []).map((r) => ({
      id: r[REMARKS_COLS.ID],
      guideId: r[REMARKS_COLS.GUIDE_ID],
      studentId: r[REMARKS_COLS.STUDENT_ID],
      content: r[REMARKS_COLS.BODY] || '',
      createdAt: r[REMARKS_COLS.CREATED_AT],
    }));

    // Screenshots
    // Columns: storage_path, uploaded_at, file_deleted_at (null = active, not null = purged)
    const { data: scRows } = await supabase
      .from(TABLES.SCREENSHOT_LOG)
      .select('*')
      .eq(SCREENSHOT_LOG_COLS.STUDENT_ID, id)
      .order(SCREENSHOT_LOG_COLS.DATE, { ascending: false });

    const screenshots: ScreenshotRecord[] = [];
    for (const sc of scRows || []) {
      const storagePath = sc[SCREENSHOT_LOG_COLS.STORAGE_PATH];
      const isPurged = sc[SCREENSHOT_LOG_COLS.FILE_DELETED_AT] !== null && sc[SCREENSHOT_LOG_COLS.FILE_DELETED_AT] !== undefined;

      let signedUrl = storagePath;
      if (!isPurged && storagePath && !storagePath.startsWith('http')) {
        try {
          const { data: signed } = await supabase.storage
            .from(BUCKETS.SCREENSHOTS)
            .createSignedUrl(storagePath, 3600);
          if (signed?.signedUrl) signedUrl = signed.signedUrl;
        } catch {
          // ignore
        }
      }

      screenshots.push({
        id: sc[SCREENSHOT_LOG_COLS.ID],
        studentId: sc[SCREENSHOT_LOG_COLS.STUDENT_ID],
        studentName: student.fullName,
        studentRoll: student.username,
        date: sc[SCREENSHOT_LOG_COLS.DATE],
        fileId: isPurged ? null : signedUrl,
        fileName: storagePath ? storagePath.split('/').pop() || null : null,
        fileSize: null,
        submittedAt: sc[SCREENSHOT_LOG_COLS.UPLOADED_AT] || new Date().toISOString(),
        purgedAt: sc[SCREENSHOT_LOG_COLS.FILE_DELETED_AT] || null,
        status: isPurged ? 'purged' : 'submitted',
      });
    }

    return {
      student,
      guide,
      programs,
      streak,
      totalPoints,
      attendanceHistory,
      tasks,
      remarks,
      screenshots,
    };
  },

  getAdminAccounts: async (): Promise<{ accounts: User[] }> => {
    const { data: rows, error } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .order(PROFILES_COLS.CREATED_AT, { ascending: false });

    if (error) {
      throw new Error("Couldn't load accounts. Try again.");
    }

    return { accounts: (rows || []).map(mapProfileToUser) };
  },

  /**
   * Secret server endpoints (Requirement 7)
   */
  createAccount: async (data: {
    username: string;
    password: string;
    role: 'guide' | 'student';
    fullName: string;
    email?: string | null;
    guideId?: string | null;
    notificationEmail?: string | null;
    assignedGuideId?: string | null;
  }): Promise<{ user: User }> => {
    return callSecretServerEndpoint<{ user: User }>('/api/create-user', {
      method: 'POST',
      body: JSON.stringify({
        username: data.username,
        password: data.password,
        role: data.role,
        fullName: data.fullName,
        notificationEmail: data.notificationEmail ?? data.email ?? null,
        assignedGuideId: data.assignedGuideId ?? data.guideId ?? null,
      }),
    });
  },

  updateAccount: async (
    id: string,
    data: { fullName?: string; email?: string | null; guideId?: string | null; username?: string }
  ): Promise<{ user: User }> => {
    try {
      const res = await callSecretServerEndpoint<{ success: boolean; user: any }>('/api/update-user', {
        method: 'POST',
        body: JSON.stringify({
          userId: id,
          fullName: data.fullName,
          email: data.email,
          guideId: data.guideId,
          username: data.username,
        }),
      });
      return { user: res.user };
    } catch (serverErr: any) {
      // If serverless endpoint threw an explicit error message, propagate it
      if (serverErr.message && !serverErr.message.includes('Endpoint not available') && !serverErr.message.includes('Network error')) {
        throw serverErr;
      }

      // Fallback: try direct client update (if permitted by policy)
      const updatePayload: Record<string, any> = {};
      if (data.fullName !== undefined) updatePayload[PROFILES_COLS.FULL_NAME] = data.fullName;
      if (data.email !== undefined) updatePayload[PROFILES_COLS.NOTIFICATION_EMAIL] = data.email;
      if (data.guideId !== undefined) updatePayload[PROFILES_COLS.GUIDE_ID] = data.guideId;
      if (data.username !== undefined) updatePayload[PROFILES_COLS.USERNAME] = data.username;

      const { data: updated, error } = await supabase
        .from(TABLES.PROFILES)
        .update(updatePayload)
        .eq(PROFILES_COLS.ID, id)
        .select()
        .single();

      if (error || !updated) {
        throw new Error(serverErr.message || error?.message || "Couldn't update account. Try again.");
      }

      return { user: mapProfileToUser(updated) };
    }
  },

  resetPassword: async (id: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    return callSecretServerEndpoint<{ success: boolean; message: string }>('/api/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId: id, newPassword }),
    });
  },

  getAdminPrograms: async () => {
    const { data: programRows, error } = await supabase
      .from(TABLES.PROGRAMS)
      .select('*')
      .order(PROGRAMS_COLS.NAME, { ascending: true });

    if (error) {
      throw new Error("Couldn't load programs. Try again.");
    }

    const { data: memberRows } = await supabase
      .from(TABLES.PROGRAM_MEMBERS)
      .select(`${PROGRAM_MEMBERS_COLS.PROGRAM_ID}, ${TABLES.PROFILES} (*)`);

    const studentsByProgram = new Map<string, { id: string; fullName: string; username: string }[]>();
    (memberRows || []).forEach((m: any) => {
      const pid = m[PROGRAM_MEMBERS_COLS.PROGRAM_ID];
      const prof = m[TABLES.PROFILES];
      if (prof) {
        const list = studentsByProgram.get(pid) || [];
        list.push({
          id: prof[PROFILES_COLS.ID],
          fullName: prof[PROFILES_COLS.FULL_NAME],
          username: prof[PROFILES_COLS.USERNAME],
        });
        studentsByProgram.set(pid, list);
      }
    });

    const programs = (programRows || []).map((p) => {
      const studs = studentsByProgram.get(p[PROGRAMS_COLS.ID]) || [];
      return {
        id: p[PROGRAMS_COLS.ID],
        name: p[PROGRAMS_COLS.NAME],
        category: p[PROGRAMS_COLS.KIND] || '',
        type: p[PROGRAMS_COLS.KIND] === 'group' ? 'group' : 'solo',
        description: p[PROGRAMS_COLS.DESCRIPTION] || '',
        createdAt: p[PROGRAMS_COLS.CREATED_AT],
        studentCount: studs.length,
        students: studs,
      };
    });

    return { programs };
  },

  createProgram: async (data: { name: string; category?: string; type: 'solo' | 'group'; description?: string }): Promise<{ program: Program }> => {
    const { data: created, error } = await supabase
      .from(TABLES.PROGRAMS)
      .insert({
        [PROGRAMS_COLS.NAME]: data.name,
        [PROGRAMS_COLS.KIND]: data.type,
        [PROGRAMS_COLS.DESCRIPTION]: data.description || '',
      })
      .select()
      .single();

    if (error || !created) {
      throw new Error("Couldn't create program. Try again.");
    }

    return {
      program: {
        id: created[PROGRAMS_COLS.ID],
        name: created[PROGRAMS_COLS.NAME],
        category: created[PROGRAMS_COLS.KIND] || '',
        type: created[PROGRAMS_COLS.KIND] === 'group' ? 'group' : 'solo',
        description: created[PROGRAMS_COLS.DESCRIPTION] || '',
        createdAt: created[PROGRAMS_COLS.CREATED_AT],
      },
    };
  },

  updateProgram: async (
    id: string,
    data: { name?: string; category?: string; type?: 'solo' | 'group'; description?: string }
  ): Promise<{ program: Program }> => {
    const updatePayload: Record<string, any> = {};
    if (data.name !== undefined) updatePayload[PROGRAMS_COLS.NAME] = data.name;
    if (data.type !== undefined) updatePayload[PROGRAMS_COLS.KIND] = data.type;
    if (data.description !== undefined) updatePayload[PROGRAMS_COLS.DESCRIPTION] = data.description;

    const { data: updated, error } = await supabase
      .from(TABLES.PROGRAMS)
      .update(updatePayload)
      .eq(PROGRAMS_COLS.ID, id)
      .select()
      .single();

    if (error || !updated) {
      throw new Error("Couldn't update program. Try again.");
    }

    return {
      program: {
        id: updated[PROGRAMS_COLS.ID],
        name: updated[PROGRAMS_COLS.NAME],
        category: updated[PROGRAMS_COLS.KIND] || '',
        type: updated[PROGRAMS_COLS.KIND] === 'group' ? 'group' : 'solo',
        description: updated[PROGRAMS_COLS.DESCRIPTION] || '',
        createdAt: updated[PROGRAMS_COLS.CREATED_AT],
      },
    };
  },

  deleteProgram: async (id: string): Promise<{ success: boolean }> => {
    await supabase.from(TABLES.PROGRAM_MEMBERS).delete().eq(PROGRAM_MEMBERS_COLS.PROGRAM_ID, id);
    const { error } = await supabase.from(TABLES.PROGRAMS).delete().eq(PROGRAMS_COLS.ID, id);
    if (error) {
      throw new Error("Couldn't delete program. Try again.");
    }
    return { success: true };
  },

  assignGuide: async (studentIds: string[], guideId: string): Promise<{ success: boolean; message: string }> => {
    const { error } = await supabase
      .from(TABLES.PROFILES)
      .update({ [PROFILES_COLS.GUIDE_ID]: guideId })
      .in(PROFILES_COLS.ID, studentIds);

    if (error) {
      throw new Error("Couldn't assign guide. Try again.");
    }
    return { success: true, message: 'Guide assigned successfully.' };
  },

  assignProgramsToStudent: async (studentId: string, programIds: string[]): Promise<{ success: boolean }> => {
    await supabase.from(TABLES.PROGRAM_MEMBERS).delete().eq(PROGRAM_MEMBERS_COLS.STUDENT_ID, studentId);
    if (programIds.length > 0) {
      const inserts = programIds.map((pid) => ({
        [PROGRAM_MEMBERS_COLS.STUDENT_ID]: studentId,
        [PROGRAM_MEMBERS_COLS.PROGRAM_ID]: pid,
      }));
      await supabase.from(TABLES.PROGRAM_MEMBERS).insert(inserts);
    }
    return { success: true };
  },

  bulkAssignProgram: async (programId: string, bulkStudentIds: string[]): Promise<{ success: boolean }> => {
    if (bulkStudentIds.length > 0) {
      const inserts = bulkStudentIds.map((sid) => ({
        [PROGRAM_MEMBERS_COLS.PROGRAM_ID]: programId,
        [PROGRAM_MEMBERS_COLS.STUDENT_ID]: sid,
      }));
      await supabase.from(TABLES.PROGRAM_MEMBERS).upsert(inserts);
    }
    return { success: true };
  },

  /**
   * Admin edit attendance:
   * UPDATE only status, score_level, note on existing row.
   * Never writes points, marked_by, or marked_at.
   */
  adminEditAttendance: async (data: {
    studentId: string;
    date: string;
    status: 'present' | 'absent';
    level?: LadderLevel | null;
    note?: string | null;
  }): Promise<{ record: AttendanceRecord }> => {
    // attendance.score_level is a smallint, 5 to 10, or null.
    // Never send or expect text. Absent always has null level.
    let numericLevel: number | null = null;
    if (data.status === 'present' && data.level) {
      numericLevel = LABEL_TO_SCORE_LEVEL[data.level] || (typeof data.level === 'number' ? data.level : null);
    }

    const { data: updated, error } = await supabase
      .from(TABLES.ATTENDANCE)
      .update({
        [ATTENDANCE_COLS.STATUS]: data.status,
        [ATTENDANCE_COLS.SCORE_LEVEL]: numericLevel,
        [ATTENDANCE_COLS.NOTE]: data.note || null,
      })
      .eq(ATTENDANCE_COLS.STUDENT_ID, data.studentId)
      .eq(ATTENDANCE_COLS.DATE, data.date)
      .select()
      .single();

    if (error || !updated) {
      throw new Error("Couldn't update attendance. Try again.");
    }

    return { record: mapAttendanceRow(updated) };
  },

  /**
   * attendance_audit: read-only.
   * Columns: id, attendance_id, changed_by, changed_at, old_row (json), new_row (json), is_past_day.
   * Read student, date, status, level from old_row / new_row.
   */
  getAdminAuditLog: async (): Promise<{ logs: AuditLogEntry[] }> => {
    const { data: rows, error } = await supabase
      .from(TABLES.ATTENDANCE_AUDIT)
      .select('*')
      .order(ATTENDANCE_AUDIT_COLS.CHANGED_AT, { ascending: false });

    if (error) {
      throw new Error("Couldn't load audit log. Try again.");
    }

    // Collect changed_by and student_ids from old_row/new_row to lookup profile names
    const actorIds: string[] = [];
    const studentIds: string[] = [];

    (rows || []).forEach((r) => {
      if (r[ATTENDANCE_AUDIT_COLS.CHANGED_BY]) {
        actorIds.push(r[ATTENDANCE_AUDIT_COLS.CHANGED_BY]);
      }
      const oldRow = typeof r[ATTENDANCE_AUDIT_COLS.OLD_ROW] === 'string'
        ? JSON.parse(r[ATTENDANCE_AUDIT_COLS.OLD_ROW] || '{}')
        : r[ATTENDANCE_AUDIT_COLS.OLD_ROW] || {};
      const newRow = typeof r[ATTENDANCE_AUDIT_COLS.NEW_ROW] === 'string'
        ? JSON.parse(r[ATTENDANCE_AUDIT_COLS.NEW_ROW] || '{}')
        : r[ATTENDANCE_AUDIT_COLS.NEW_ROW] || {};

      const sid = newRow.student_id || oldRow.student_id;
      if (sid) studentIds.push(sid);
    });

    const allIds = Array.from(new Set([...actorIds, ...studentIds]));
    let nameMap = new Map<string, string>();
    if (allIds.length > 0) {
      const { data: profs } = await supabase
        .from(TABLES.PROFILES)
        .select(`${PROFILES_COLS.ID}, ${PROFILES_COLS.FULL_NAME}`)
        .in(PROFILES_COLS.ID, allIds);
      (profs || []).forEach((p) => nameMap.set(p[PROFILES_COLS.ID], p[PROFILES_COLS.FULL_NAME]));
    }

    const logs: AuditLogEntry[] = (rows || []).map((r) => {
      const oldRow = typeof r[ATTENDANCE_AUDIT_COLS.OLD_ROW] === 'string'
        ? JSON.parse(r[ATTENDANCE_AUDIT_COLS.OLD_ROW] || '{}')
        : r[ATTENDANCE_AUDIT_COLS.OLD_ROW] || {};
      const newRow = typeof r[ATTENDANCE_AUDIT_COLS.NEW_ROW] === 'string'
        ? JSON.parse(r[ATTENDANCE_AUDIT_COLS.NEW_ROW] || '{}')
        : r[ATTENDANCE_AUDIT_COLS.NEW_ROW] || {};

      const studentId = newRow.student_id || oldRow.student_id || '';
      const date = newRow.date || oldRow.date || '';

      const formatRowScore = (row: any) => {
        if (!row.status) return 'none';
        if (row.status === 'absent') return 'absent';
        if (row.score_level !== null && row.score_level !== undefined) {
          const num = Number(row.score_level);
          const label = (!isNaN(num) && num in SCORE_LEVEL_MAP)
            ? (SCORE_LEVEL_MAP as Record<number, string>)[num]
            : row.score_level;
          return `present (${num} - ${label})`;
        }
        return 'present (unscored)';
      };

      const oldDesc = formatRowScore(oldRow);
      const newDesc = formatRowScore(newRow);

      return {
        id: r[ATTENDANCE_AUDIT_COLS.ID],
        actorId: r[ATTENDANCE_AUDIT_COLS.CHANGED_BY],
        actorName: nameMap.get(r[ATTENDANCE_AUDIT_COLS.CHANGED_BY]) || 'Admin',
        studentId,
        studentName: nameMap.get(studentId) || 'Student',
        date,
        action: r[ATTENDANCE_AUDIT_COLS.IS_PAST_DAY] ? 'modified past day' : 'modified attendance',
        oldValue: oldDesc,
        newValue: newDesc,
        timestamp: r[ATTENDANCE_AUDIT_COLS.CHANGED_AT],
      };
    });

    return { logs };
  },

  remindGuide: async (guideId: string, message?: string): Promise<{ success: boolean; message: string }> => {
    const text = message || 'Please submit daily attendance and progress evaluations for your assigned students.';
    const { error } = await supabase.rpc(RPCS.SEND_REMINDER, {
      [RPC_ARGS.SEND_REMINDER.TARGET]: guideId,
      [RPC_ARGS.SEND_REMINDER.MESSAGE]: text,
    });

    if (error) {
      throw new Error("Couldn't send reminder to guide. Try again.");
    }

    return { success: true, message: 'Reminder sent to guide.' };
  },

  getAdminChartsData: async () => {
    const { data: attRows } = await supabase.from(TABLES.ATTENDANCE).select('*');
    const { data: allProfiles } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .eq(PROFILES_COLS.ROLE, 'student');

    const students = allProfiles || [];
    const historyByStudent = new Map<string, AttendanceRecord[]>();
    const dateAttendanceMap = new Map<string, { present: number; absent: number }>();

    (attRows || []).forEach((row) => {
      const rec = mapAttendanceRow(row);
      const studentList = historyByStudent.get(rec.studentId) || [];
      studentList.push(rec);
      historyByStudent.set(rec.studentId, studentList);

      const dateStats = dateAttendanceMap.get(rec.date) || { present: 0, absent: 0 };
      if (rec.status === 'present') dateStats.present++;
      else dateStats.absent++;
      dateAttendanceMap.set(rec.date, dateStats);
    });

    const dates = Array.from(dateAttendanceMap.keys()).sort();
    const trend = dates.map((d) => ({
      date: d,
      present: dateAttendanceMap.get(d)!.present,
      absent: dateAttendanceMap.get(d)!.absent,
    }));

    const today = getKolkataDateString();
    const streakDistribution: Record<string, number> = {
      '0 days': 0,
      '1-3 days': 0,
      '4-7 days': 0,
      '8+ days': 0,
    };
    const pointsDistribution: Record<string, number> = {
      '0-20': 0,
      '21-50': 0,
      '51-100': 0,
      '100+': 0,
    };

    students.forEach((s) => {
      const hist = historyByStudent.get(s[PROFILES_COLS.ID]) || [];
      const streak = calculateStreakFromRecords(hist, today);
      const pts = hist.reduce((sum, r) => sum + (r.points || 0), 0);

      if (streak === 0) streakDistribution['0 days']++;
      else if (streak <= 3) streakDistribution['1-3 days']++;
      else if (streak <= 7) streakDistribution['4-7 days']++;
      else streakDistribution['8+ days']++;

      if (pts <= 20) pointsDistribution['0-20']++;
      else if (pts <= 50) pointsDistribution['21-50']++;
      else if (pts <= 100) pointsDistribution['51-100']++;
      else pointsDistribution['100+']++;
    });

    return {
      trend,
      streakDistribution,
      pointsDistribution,
    };
  },

  /**
   * Admin screenshots:
   * Columns: id, student_id, date, storage_path, uploaded_at, file_deleted_at.
   * Purged when file_deleted_at is not null.
   */
  getAdminScreenshots: async (dateParam?: string): Promise<{ screenshots: ScreenshotRecord[]; date: string }> => {
    const date = dateParam || getKolkataDateString();

    const { data: rows, error } = await supabase
      .from(TABLES.SCREENSHOT_LOG)
      .select('*')
      .eq(SCREENSHOT_LOG_COLS.DATE, date)
      .order(SCREENSHOT_LOG_COLS.UPLOADED_AT, { ascending: false });

    if (error) {
      throw new Error("Couldn't load screenshots. Try again.");
    }

    const studentIds = (rows || []).map((r) => r[SCREENSHOT_LOG_COLS.STUDENT_ID]);
    let studentMap = new Map<string, { name: string; roll: string }>();
    if (studentIds.length > 0) {
      const { data: profs } = await supabase
        .from(TABLES.PROFILES)
        .select(`${PROFILES_COLS.ID}, ${PROFILES_COLS.FULL_NAME}, ${PROFILES_COLS.USERNAME}`)
        .in(PROFILES_COLS.ID, studentIds);

      (profs || []).forEach((p) => {
        studentMap.set(p[PROFILES_COLS.ID], {
          name: p[PROFILES_COLS.FULL_NAME],
          roll: p[PROFILES_COLS.USERNAME],
        });
      });
    }

    const screenshots: ScreenshotRecord[] = [];
    for (const r of rows || []) {
      const storagePath = r[SCREENSHOT_LOG_COLS.STORAGE_PATH];
      const isPurged = r[SCREENSHOT_LOG_COLS.FILE_DELETED_AT] !== null && r[SCREENSHOT_LOG_COLS.FILE_DELETED_AT] !== undefined;

      let fileUrl = storagePath;
      if (!isPurged && fileUrl && !fileUrl.startsWith('http')) {
        try {
          const { data: signed } = await supabase.storage
            .from(BUCKETS.SCREENSHOTS)
            .createSignedUrl(fileUrl, 3600);
          if (signed?.signedUrl) fileUrl = signed.signedUrl;
        } catch {
          // ignore
        }
      }

      const st = studentMap.get(r[SCREENSHOT_LOG_COLS.STUDENT_ID]);
      screenshots.push({
        id: r[SCREENSHOT_LOG_COLS.ID],
        studentId: r[SCREENSHOT_LOG_COLS.STUDENT_ID],
        studentName: st?.name || 'Student',
        studentRoll: st?.roll || '',
        date: r[SCREENSHOT_LOG_COLS.DATE],
        fileId: isPurged ? null : fileUrl,
        fileName: storagePath ? storagePath.split('/').pop() || null : null,
        fileSize: null,
        submittedAt: r[SCREENSHOT_LOG_COLS.UPLOADED_AT] || new Date().toISOString(),
        purgedAt: r[SCREENSHOT_LOG_COLS.FILE_DELETED_AT] || null,
        status: isPurged ? 'purged' : 'submitted',
      });
    }

    return { screenshots, date };
  },

  resolveScreenshotUrl: async (pathOrUrl?: string | null): Promise<string> => {
    if (!pathOrUrl) return '';
    if (
      pathOrUrl.startsWith('http://') ||
      pathOrUrl.startsWith('https://') ||
      pathOrUrl.startsWith('data:') ||
      pathOrUrl.startsWith('blob:')
    ) {
      return pathOrUrl;
    }

    try {
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKETS.SCREENSHOTS)
        .createSignedUrl(pathOrUrl, 3600);
      if (signed?.signedUrl) return signed.signedUrl;
      if (signErr) console.warn('Supabase createSignedUrl error:', signErr.message);
    } catch (e) {
      console.warn('Failed to sign screenshot URL:', e);
    }

    try {
      const { data: pub } = supabase.storage
        .from(BUCKETS.SCREENSHOTS)
        .getPublicUrl(pathOrUrl);
      if (pub?.publicUrl) return pub.publicUrl;
    } catch {
      // ignore
    }

    return `/api/files/download/${encodeURIComponent(pathOrUrl)}`;
  },

  purgeOldScreenshots: async (): Promise<{ purgedCount: number; message: string }> => {
    return callSecretServerEndpoint<{ purgedCount: number; message: string }>('/api/admin/purge-screenshots', {
      method: 'DELETE',
    });
  },

  // -------------------------------------------------------------
  // LEADERBOARD (Guides NEVER see the leaderboard!)
  // Returns: student_id, full_name, total_points, streak, rank
  // -------------------------------------------------------------

  getLeaderboard: async (): Promise<{ leaderboard: LeaderboardEntry[] }> => {
    try {
      const me = (await api.getMe()).user;
      if (me.role === 'guide') {
        throw new Error('Access denied. Guides do not have access to the leaderboard.');
      }
    } catch (e: any) {
      if (e.message?.includes('Guides do not have access')) throw e;
    }

    // Call get_leaderboard() RPC
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc(RPCS.GET_LEADERBOARD);
      if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
        const mapped: LeaderboardEntry[] = rpcData.map((row: any, idx: number) => ({
          rank: row.rank || idx + 1,
          studentId: row.student_id || row.id,
          fullName: row.full_name || 'Student',
          username: row.username || '',
          totalPoints: row.total_points ?? 0,
          streak: row.streak ?? 0,
          programs: row.programs || [],
        }));
        return { leaderboard: mapped };
      }
    } catch {
      // Fallback
    }

    // Fallback calculation from attendance & profiles
    const today = getKolkataDateString();
    const { data: studentProfiles, error: profErr } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .eq(PROFILES_COLS.ROLE, 'student');

    if (profErr) {
      throw new Error("Couldn't load leaderboard. Try again.");
    }

    const { data: attRows } = await supabase.from(TABLES.ATTENDANCE).select('*');
    const historyByStudent = new Map<string, AttendanceRecord[]>();
    (attRows || []).forEach((row) => {
      const studentId = row[ATTENDANCE_COLS.STUDENT_ID];
      const list = historyByStudent.get(studentId) || [];
      list.push(mapAttendanceRow(row));
      historyByStudent.set(studentId, list);
    });

    const { data: memberRows } = await supabase
      .from(TABLES.PROGRAM_MEMBERS)
      .select(`${PROGRAM_MEMBERS_COLS.STUDENT_ID}, ${TABLES.PROGRAMS} (*)`);

    const programsByStudent = new Map<string, string[]>();
    (memberRows || []).forEach((m: any) => {
      const sid = m[PROGRAM_MEMBERS_COLS.STUDENT_ID];
      const prog = m[TABLES.PROGRAMS];
      if (prog) {
        const list = programsByStudent.get(sid) || [];
        list.push(prog[PROGRAMS_COLS.NAME]);
        programsByStudent.set(sid, list);
      }
    });

    const unsorted = (studentProfiles || []).map((s) => {
      const hist = historyByStudent.get(s[PROFILES_COLS.ID]) || [];
      const totalPoints = hist.reduce((sum, r) => sum + (r.points || 0), 0);
      const streak = calculateStreakFromRecords(hist, today);
      return {
        studentId: s[PROFILES_COLS.ID],
        fullName: s[PROFILES_COLS.FULL_NAME],
        username: s[PROFILES_COLS.USERNAME],
        totalPoints,
        streak,
        programs: programsByStudent.get(s[PROFILES_COLS.ID]) || [],
      };
    });

    unsorted.sort((a, b) => b.totalPoints - a.totalPoints || b.streak - a.streak);
    const leaderboard: LeaderboardEntry[] = unsorted.map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

    return { leaderboard };
  },

  // -------------------------------------------------------------
  // NOTIFICATIONS
  // Columns: body, read_at (null = unread)
  // App only UPDATES read_at on own rows. Never inserts.
  // -------------------------------------------------------------

  getNotifications: async (): Promise<{ notifications: AppNotification[]; unreadCount: number }> => {
    const me = (await api.getMe()).user;

    const { data: rows, error } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .select('*')
      .eq(NOTIFICATIONS_COLS.USER_ID, me.id)
      .order(NOTIFICATIONS_COLS.CREATED_AT, { ascending: false });

    if (error) {
      throw new Error("Couldn't load notifications. Try again.");
    }

    const notifications: AppNotification[] = (rows || []).map((r) => ({
      id: r[NOTIFICATIONS_COLS.ID],
      userId: r[NOTIFICATIONS_COLS.USER_ID],
      senderId: r[NOTIFICATIONS_COLS.SENDER_ID],
      type: r[NOTIFICATIONS_COLS.TYPE] || 'general',
      title: r[NOTIFICATIONS_COLS.TITLE] || 'Notification',
      message: r[NOTIFICATIONS_COLS.BODY] || '',
      read: Boolean(r[NOTIFICATIONS_COLS.READ_AT]),
      createdAt: r[NOTIFICATIONS_COLS.CREATED_AT],
    }));

    const unreadCount = notifications.filter((n) => !n.read).length;
    return { notifications, unreadCount };
  },

  markNotificationsRead: async (): Promise<{ success: boolean }> => {
    const me = (await api.getMe()).user;

    const { error } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .update({ [NOTIFICATIONS_COLS.READ_AT]: new Date().toISOString() })
      .eq(NOTIFICATIONS_COLS.USER_ID, me.id)
      .is(NOTIFICATIONS_COLS.READ_AT, null);

    if (error) {
      throw new Error("Couldn't mark notifications as read. Try again.");
    }
    return { success: true };
  },

  // -------------------------------------------------------------
  // STORAGE & FILE UPLOAD
  // Buckets:
  // - task-files: path {student_id}/{task_id}/{file_name}
  // - screenshots: path {student_id}/{yyyy-mm-dd}.{png|jpg|jpeg|webp} (Asia/Kolkata date)
  // Private buckets; signed URLs only.
  // -------------------------------------------------------------

  uploadFile: async (
    file: File,
    purpose: 'task_attachment' | 'submission_attachment' | 'screenshot',
    context?: { taskId?: string; studentId?: string }
  ): Promise<{ fileId: string; originalName: string; size: number; mimeType: string }> => {
    const me = (await api.getMe()).user;

    if (purpose === 'screenshot') {
      const today = getKolkataDateString();
      const extMatch = file.name.match(/\.(png|jpg|jpeg|webp)$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
      const filePath = `${me.id}/${today}.${ext}`;

      const { error } = await supabase.storage
        .from(BUCKETS.SCREENSHOTS)
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        });

      if (error) {
        throw new Error("Couldn't upload screenshot. Try again.");
      }

      // Generate signed URL
      const { data: signedData } = await supabase.storage
        .from(BUCKETS.SCREENSHOTS)
        .createSignedUrl(filePath, 3600);

      return {
        fileId: filePath,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
      };
    } else {
      // task-files: path {student_id}/{task_id}/{file_name}
      const studentId = context?.studentId || me.id;
      const taskId = context?.taskId || 'draft';
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${studentId}/${taskId}/${cleanName}`;

      const { error } = await supabase.storage
        .from(BUCKETS.TASK_FILES)
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || 'application/octet-stream',
        });

      if (error) {
        throw new Error("Couldn't upload file. Try again.");
      }

      const { data: signedData } = await supabase.storage
        .from(BUCKETS.TASK_FILES)
        .createSignedUrl(filePath, 3600 * 24);

      return {
        fileId: signedData?.signedUrl || filePath,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
      };
    }
  },
};
