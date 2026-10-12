import { db, getKolkataDateString } from './db';

export function runMidnightAbsentJob() {
  const today = getKolkataDateString();
  console.log(`[JOB] Running daily auto-absent initialization for date: ${today}`);
  db.ensureTodayAttendance(today);
}

export function runNightlyScreenshotPromptJob() {
  const today = getKolkataDateString();
  console.log(`[JOB] Running 10:00 PM IST nightly screenshot prompt for date: ${today}`);
  const students = db.getUsers().filter((u) => u.role === 'student');

  for (const student of students) {
    db.createNotification({
      userId: student.id,
      type: 'screenshot_prompt',
      title: 'Nightly Screen-Time Screenshot',
      message: 'Please upload a screenshot of your screen time for today to verify your preparation.',
    });
  }
}

export function runScreenshotPurgeJob() {
  console.log('[JOB] Running 48-hour screenshot purge check');
  const purgedCount = db.purgeOldScreenshots();
  if (purgedCount > 0) {
    console.log(`[JOB] Purged ${purgedCount} screenshot files older than 48 hours.`);
  }
}

let lastPromptDate = '';

export function startBackgroundJobs() {
  // Check every 60 seconds against Asia/Kolkata time
  setInterval(() => {
    try {
      const now = new Date();
      // Format current time in Asia/Kolkata
      const kolkataTimeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);

      const kolkataDateStr = getKolkataDateString(now);

      // Midnight job at 00:05 IST
      if (kolkataTimeStr === '00:05') {
        runMidnightAbsentJob();
      }

      // 10:00 PM IST screenshot prompt (22:00)
      if (kolkataTimeStr === '22:00' && lastPromptDate !== kolkataDateStr) {
        lastPromptDate = kolkataDateStr;
        runNightlyScreenshotPromptJob();
      }

      // Purge old screenshots every hour (at minute 30)
      if (now.getMinutes() === 30) {
        runScreenshotPurgeJob();
      }
    } catch (e) {
      console.error('Error in background job timer', e);
    }
  }, 60 * 1000);

  // Run initial checks on startup
  runMidnightAbsentJob();
  runScreenshotPurgeJob();
}
