/**
 * Supabase Database Schema Constants - Migration 0008 Contract
 *
 * All table names, column names, RPC function names, storage bucket names,
 * and status values must be imported from this file so they can be renamed
 * in one central location to match custom database definitions.
 */

// Table Names
export const TABLES = {
  PROFILES: 'profiles',
  PROGRAMS: 'programs',
  PROGRAM_MEMBERS: 'program_members',
  PROGRAM_GUIDES: 'program_guides',
  ATTENDANCE: 'attendance',
  ATTENDANCE_AUDIT: 'attendance_audit',
  TASKS: 'tasks',
  TASK_FILES: 'task_files',
  REMARKS: 'remarks',
  NOTIFICATIONS: 'notifications',
  SCREENSHOT_LOG: 'screenshot_log',
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

// Profiles Columns (guide_id is OBSOLETE; never read/write)
export const PROFILES_COLS = {
  ID: 'id',
  USERNAME: 'username',
  FULL_NAME: 'full_name',
  ROLE: 'role',
  NOTIFICATION_EMAIL: 'notification_email',
  IS_ACTIVE: 'is_active',
  CREATED_AT: 'created_at',
} as const;

// Programs Columns (no category column)
export const PROGRAMS_COLS = {
  ID: 'id',
  NAME: 'name',
  KIND: 'kind',
  DESCRIPTION: 'description',
  CREATED_AT: 'created_at',
} as const;

// Program Members Columns (no id column)
export const PROGRAM_MEMBERS_COLS = {
  PROGRAM_ID: 'program_id',
  STUDENT_ID: 'student_id',
  CREATED_AT: 'created_at',
} as const;

// Program Guides Columns (one or more guides per program)
export const PROGRAM_GUIDES_COLS = {
  PROGRAM_ID: 'program_id',
  GUIDE_ID: 'guide_id',
  CREATED_AT: 'created_at',
} as const;

// Attendance Columns
// Unique on (student_id, program_id, date).
// App only updates status, score_level, and note.
// Never insert/delete attendance, never write points, marked_by, marked_at, student_id, program_id, or date.
export const ATTENDANCE_COLS = {
  ID: 'id',
  STUDENT_ID: 'student_id',
  PROGRAM_ID: 'program_id',
  DATE: 'date',
  STATUS: 'status',
  SCORE_LEVEL: 'score_level',
  NOTE: 'note',
  POINTS: 'points',
  MARKED_BY: 'marked_by',
  MARKED_AT: 'marked_at',
  CREATED_AT: 'created_at',
} as const;

// Attendance Audit Columns (admin read only)
export const ATTENDANCE_AUDIT_COLS = {
  ID: 'id',
  ATTENDANCE_ID: 'attendance_id',
  CHANGED_BY: 'changed_by',
  CHANGED_AT: 'changed_at',
  OLD_ROW: 'old_row',
  NEW_ROW: 'new_row',
  IS_PAST_DAY: 'is_past_day',
} as const;

// Tasks Columns
export const TASKS_COLS = {
  ID: 'id',
  GUIDE_ID: 'guide_id',
  STUDENT_ID: 'student_id',
  PROGRAM_ID: 'program_id',
  TITLE: 'title',
  DESCRIPTION: 'description',
  DUE_DATE: 'due_date',
  STATUS: 'status',
  SUBMISSION_NOTE: 'submission_note',
  SUBMITTED_AT: 'submitted_at',
  REVIEW_NOTE: 'review_note',
  REVIEWED_AT: 'reviewed_at',
  REVIEWED_BY: 'reviewed_by',
  COMPLETED_AT: 'completed_at',
  CREATED_AT: 'created_at',
} as const;

// Task Files Columns
export const TASK_FILES_COLS = {
  ID: 'id',
  TASK_ID: 'task_id',
  UPLOADER_ID: 'uploader_id',
  KIND: 'kind',
  STORAGE_PATH: 'storage_path',
  FILE_NAME: 'file_name',
  SIZE_BYTES: 'size_bytes',
  CREATED_AT: 'created_at',
} as const;

export const TASK_FILE_KINDS = {
  GUIDE_ATTACHMENT: 'guide_attachment',
  SUBMISSION: 'submission',
} as const;

export type TaskFileKind = (typeof TASK_FILE_KINDS)[keyof typeof TASK_FILE_KINDS];

// Remarks Columns
export const REMARKS_COLS = {
  ID: 'id',
  GUIDE_ID: 'guide_id',
  STUDENT_ID: 'student_id',
  PROGRAM_ID: 'program_id',
  BODY: 'body',
  CREATED_AT: 'created_at',
} as const;

// Notifications Columns
export const NOTIFICATIONS_COLS = {
  ID: 'id',
  USER_ID: 'user_id',
  SENDER_ID: 'sender_id',
  SENDER_NAME: 'sender_name',
  TYPE: 'type',
  TITLE: 'title',
  BODY: 'body',
  PROGRAM_ID: 'program_id',
  PROGRAM_NAME: 'program_name',
  READ_AT: 'read_at',
  EMAILED_AT: 'emailed_at',
  CREATED_AT: 'created_at',
} as const;

export const NOTIFICATION_TYPES = {
  TASK: 'task',
  TASK_SUBMITTED: 'task_submitted',
  TASK_COMPLETED: 'task_completed',
  TASK_SENT_BACK: 'task_sent_back',
  REMARK: 'remark',
  REMINDER: 'reminder',
  ADMIN_REMINDER: 'admin_reminder',
  SCREENSHOT_PROMPT: 'screenshot_prompt',
} as const;

export type NotificationTypeValue = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// Screenshot Log Columns
export const SCREENSHOT_LOG_COLS = {
  ID: 'id',
  STUDENT_ID: 'student_id',
  DATE: 'date',
  STORAGE_PATH: 'storage_path',
  UPLOADED_AT: 'uploaded_at',
  FILE_DELETED_AT: 'file_deleted_at',
} as const;

// RPC (Function) Names and Argument Names (exact names per migration 0008 contract)
export const RPCS = {
  ENSURE_TODAY: 'ensure_today',
  GET_LEADERBOARD: 'get_leaderboard',
  CURRENT_STREAK: 'current_streak',
  STUDENT_POINTS: 'student_points',
  DAY_POINTS: 'day_points',
  MY_PROGRAMS: 'my_programs',
  MY_PROGRAM_GUIDES: 'my_program_guides',
  SET_PROGRAM_GUIDES: 'set_program_guides',
  SEND_NOTIFICATION: 'send_notification',
  SEND_REMINDER: 'send_reminder',
  SUBMIT_TASK: 'submit_task',
  REVIEW_TASK: 'review_task',
  RECORD_SCREENSHOT: 'record_screenshot',
} as const;

export type RpcName = (typeof RPCS)[keyof typeof RPCS];

export const RPC_ARGS = {
  CURRENT_STREAK: {
    STUDENT: 'p_student',
  },
  STUDENT_POINTS: {
    STUDENT: 'p_student',
  },
  DAY_POINTS: {
    STUDENT: 'p_student',
    DATE: 'p_date',
  },
  SET_PROGRAM_GUIDES: {
    PROGRAM: 'p_program',
    GUIDES: 'p_guides',
  },
  SEND_NOTIFICATION: {
    RECIPIENTS: 'p_recipients',
    TITLE: 'p_title',
    MESSAGE: 'p_message',
    PROGRAM: 'p_program',
  },
  SEND_REMINDER: {
    TARGET: 'p_target',
    MESSAGE: 'p_message',
    PROGRAM: 'p_program',
  },
  SUBMIT_TASK: {
    TASK: 'p_task',
    NOTE: 'p_note',
  },
  REVIEW_TASK: {
    TASK: 'p_task',
    ACTION: 'p_action',
    NOTE: 'p_note',
  },
  RECORD_SCREENSHOT: {
    PATH: 'p_path',
  },
} as const;

export const REVIEW_TASK_ACTIONS = {
  COMPLETE: 'complete',
  SEND_BACK: 'send_back',
} as const;

export type ReviewTaskAction = (typeof REVIEW_TASK_ACTIONS)[keyof typeof REVIEW_TASK_ACTIONS];

// Storage Bucket Names (private, signed URLs)
export const BUCKETS = {
  TASK_FILES: 'task-files',
  SCREENSHOTS: 'screenshots',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// Status Enums & Constants
export const TASK_STATUS = {
  ASSIGNED: 'assigned',
  SUBMITTED: 'submitted',
  COMPLETED: 'completed',
} as const;

export type TaskStatusValue = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
} as const;

export type AttendanceStatusValue = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

export const ROLES = {
  ADMIN: 'admin',
  GUIDE: 'guide',
  STUDENT: 'student',
} as const;

export type RoleValue = (typeof ROLES)[keyof typeof ROLES];

// Email Domain for Username to Email conversion
export const INTERNAL_EMAIL_DOMAIN = 'accounts.sibaq.internal';

// Score Level Smallint (5 to 10) Mappings
// Display only: 5 Poor, 6 Average, 7 Good, 8 Very good, 9 Excellent, 10 Outstanding.
// Always save the number.
export const SCORE_LEVEL_MAP = {
  5: 'Poor',
  6: 'Average',
  7: 'Good',
  8: 'Very good',
  9: 'Excellent',
  10: 'Outstanding',
} as const;

export type ScoreLevelNumber = 5 | 6 | 7 | 8 | 9 | 10;
export type ScoreLevelLabel = (typeof SCORE_LEVEL_MAP)[ScoreLevelNumber];

export const LABEL_TO_SCORE_LEVEL: Record<string, ScoreLevelNumber> = {
  'Poor': 5,
  'Average': 6,
  'Good': 7,
  'Very good': 8,
  'Excellent': 9,
  'Outstanding': 10,
};
