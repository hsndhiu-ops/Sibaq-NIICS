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
  guideId: string | null;
  createdAt: string;
}

export type ProgramCategory = 'Stage' | 'Non-Stage' | 'Off-Stage' | string;

export interface Program {
  id: string;
  name: string;
  category: ProgramCategory;
  type: 'solo' | 'group';
  description: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD (Asia/Kolkata)
  status: 'present' | 'absent';
  isMarked: boolean;
  level: LadderLevel | null;
  points: number | null; // null if present but not scored yet, 0 if absent, 5-10 if present with level
  note: string | null;
  markedBy: string | null;
  markedAt: string | null;
}

export type TaskStatus = 'assigned' | 'awaiting_review' | 'completed';

export interface TaskRecord {
  id: string;
  guideId: string;
  studentId: string;
  title: string;
  description: string;
  dueDate: string;
  attachmentFileId: string | null;
  attachmentFileName: string | null;
  status: TaskStatus;
  submittedAt?: string | null;
  completedAt: string | null;
  submissionFileId: string | null;
  submissionFileName: string | null;
  submissionNote: string | null;
  reviewerNote?: string | null;
  createdAt: string;
}

export interface RemarkRecord {
  id: string;
  guideId: string;
  guideName?: string;
  studentId: string;
  content: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  senderId: string | null;
  senderName?: string;
  type: 'guide_reminder' | 'admin_reminder' | 'new_task' | 'new_remark' | 'screenshot_prompt' | 'general';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ScreenshotRecord {
  id: string;
  studentId: string;
  studentName?: string;
  studentRoll?: string;
  date: string;
  fileId: string | null;
  fileName: string | null;
  fileSize: number | null;
  submittedAt: string;
  purgedAt: string | null;
  status: 'submitted' | 'purged';
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
  username: string;
  totalPoints: number;
  streak: number;
  programs: string[];
}

export interface StudentDashboardData {
  student: User;
  guide: { id: string; fullName: string; username: string } | null;
  streak: number;
  totalPoints: number;
  rank: number;
  totalStudents: number;
  todayRecord: AttendanceRecord;
  pendingTasks: TaskRecord[];
  completedTasks: TaskRecord[];
  remarks: RemarkRecord[];
  programs: Program[];
  hasUploadedScreenshotToday: boolean;
  attendanceHistory: AttendanceRecord[];
}

export interface GuideTodayMenteeItem {
  student: User;
  programs: Program[];
  attendance: AttendanceRecord;
  streak: number;
  totalPoints: number;
}

export interface GuideTodayData {
  date: string;
  totalMentees: number;
  presentCount: number;
  mentees: GuideTodayMenteeItem[];
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
  roster: {
    studentId: string;
    studentName: string;
    studentRoll: string;
    guideId: string | null;
    guideName: string;
    status: 'present' | 'absent';
    isMarked: boolean;
    level: LadderLevel | null;
    points: number | null;
    note: string | null;
    streak: number;
    totalPoints: number;
    hasScreenshot: boolean;
  }[];
  guidesStatus: {
    guideId: string;
    guideName: string;
    menteesCount: number;
    markedCount: number;
    allMarked: boolean;
  }[];
}
