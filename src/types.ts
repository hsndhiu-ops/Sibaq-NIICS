export type UserRole = 'admin' | 'guide' | 'student';

export type LadderLevel = 'Poor' | 'Average' | 'Good' | 'Very good' | 'Excellent' | 'Outstanding';

export const LADDER_POINTS: Record<LadderLevel, number> = {
  'Poor': 5,
  'Average': 6,
  'Good': 7,
  'Very good': 8,
  'Excellent': 9,
  'Outstanding': 10,
};

export interface User {
  id: string;
  username: string;
  role: UserRole;
  fullName: string;
  email: string | null;
  guideId?: string | null;
  isActive?: boolean;
  createdAt: string;
}

export interface Program {
  id: string;
  name: string;
  kind?: 'solo' | 'group';
  description: string;
  category?: string; // compatibility alias
  type?: 'solo' | 'group';     // compatibility alias
  createdAt: string;
  memberCount?: number;
  guides?: Array<{ id: string; fullName: string; username: string }>;
  students?: Array<{ id: string; fullName: string; username: string }>;
}

export interface StudentAssignedGuide {
  id: string;
  fullName: string;
  username: string;
  email?: string;
}

export interface StudentProgramGuidesGroup {
  program: Program;
  guides: StudentAssignedGuide[];
}

export interface ProgramMember {
  programId: string;
  studentId: string;
  createdAt: string;
}

export interface ProgramGuide {
  programId: string;
  guideId: string;
  createdAt: string;
}

export interface StudentProgramGuideAssignment {
  id: string;
  studentId: string;
  programId: string;
  programName?: string;
  guideId: string;
  guideName?: string;
  guideUsername?: string;
  createdAt: string;
}

export interface MyProgramGuideItem {
  programId: string;
  programName: string;
  guideId: string;
  guideName: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName?: string;
  programId?: string;
  programName?: string;
  date: string; // YYYY-MM-DD (Asia/Kolkata)
  status: 'present' | 'absent';
  isMarked?: boolean;
  scoreLevel?: number | null; // smallint 5..10 or null
  level: LadderLevel | null;
  points: number | null; // 0 for absent, 5 to 10 when scored, null when present but not scored
  note: string | null;
  markedBy?: string | null;
  markedAt?: string | null;
  createdAt?: string;
}

export type TaskStatus = 'assigned' | 'submitted' | 'completed' | 'awaiting_review';

export interface TaskFileRecord {
  id: string;
  taskId: string;
  uploaderId: string;
  kind: 'guide_attachment' | 'submission';
  storagePath: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export interface TaskRecord {
  id: string;
  guideId: string;
  guideName?: string;
  studentId: string;
  studentName?: string;
  programId?: string;
  programName?: string;
  title: string;
  description: string;
  dueDate: string;
  status: TaskStatus;
  submissionNote: string | null;
  submittedAt?: string | null;
  reviewNote?: string | null;
  reviewerNote?: string | null; // compatibility alias
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  completedAt: string | null;
  createdAt: string;
  files?: TaskFileRecord[];
  attachmentFileId?: string | null;
  attachmentFileName?: string | null;
  submissionFileId?: string | null;
  submissionFileName?: string | null;
}

export interface RemarkRecord {
  id: string;
  guideId: string;
  guideName?: string;
  studentId: string;
  studentName?: string;
  programId?: string;
  programName?: string;
  body?: string;
  content?: string; // compatibility alias
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  senderId: string | null;
  senderName?: string;
  type: string;
  title: string;
  body?: string;
  message?: string; // compatibility alias
  programId?: string | null;
  programName?: string | null;
  readAt?: string | null;
  read?: boolean; // compatibility alias
  emailedAt?: string | null;
  createdAt: string;
}

export interface ScreenshotRecord {
  id: string;
  studentId: string;
  studentName?: string;
  studentRoll?: string;
  date: string;
  storagePath?: string;
  uploadedAt?: string;
  fileDeletedAt?: string | null;
  fileId?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  submittedAt?: string;
  purgedAt?: string | null;
  status?: 'submitted' | 'purged';
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  studentId: string;
  studentName: string;
  date: string;
  action: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  fullName: string;
  username?: string;
  totalPoints: number; // formatted with one decimal
  streak: number;
  programs?: string[];
}

export interface StudentDashboardProgramToday {
  programId: string;
  programName: string;
  guideNames: string[];
  status: 'present' | 'absent' | 'unmarked';
  level: LadderLevel | null;
  scoreLevel: number | null;
  points: number | null;
  note: string | null;
}

export interface StudentDashboardData {
  student: User;
  streak: number;
  totalPoints: number; // one decimal number
  rank: number;
  totalStudents: number;
  todayPrograms: StudentDashboardProgramToday[];
  todayRecord?: AttendanceRecord | null; // compatibility alias
  allGuides?: Array<{ id: string; fullName: string; username: string; email?: string; programs: string[] }>; // compatibility alias
  guide?: { id: string; fullName: string; username: string; email?: string } | null; // compatibility alias
  programs: Program[];
  programGuides: MyProgramGuideItem[];
  pendingTasks: TaskRecord[];
  completedTasks: TaskRecord[];
  remarks: RemarkRecord[];
  hasUploadedScreenshotToday: boolean;
  attendanceHistory: AttendanceRecord[];
}

export interface GuideTodayProgramSection {
  programId: string;
  programName: string;
  kind: 'solo' | 'group';
  studentsCount: number;
  markedCount: number;
  students: Array<{
    studentId: string;
    studentName: string;
    username: string;
    attendance: AttendanceRecord;
    note: string | null;
  }>;
}

export interface GuideTodayData {
  date: string;
  totalStudents: number;
  presentCount: number;
  markedCount: number;
  programs: GuideTodayProgramSection[];
}

export interface AdminTodayData {
  date: string;
  stats: {
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    unscoredCount: number;
    unmarkedGuidesCount: number;
  };
  studentsRoster: Array<{
    studentId: string;
    studentName: string;
    studentRoll: string;
    sessions: Array<{
      programId: string;
      programName: string;
      guideName?: string;
      status: 'present' | 'absent';
      scoreLevel: number | null;
      level: LadderLevel | null;
      points: number | null;
      note: string | null;
    }>;
    streak: number;
    totalPoints: number;
    hasScreenshot: boolean;
  }>;
  guidesProgress: Array<{
    guideId: string;
    guideName: string;
    username: string;
    programsCount: number;
    sessionsCount: number;
    markedCount: number;
    allMarked: boolean;
  }>;
  roster?: any[]; // compatibility alias for studentsRoster
  guidesStatus?: any[]; // compatibility alias for guidesProgress
}
