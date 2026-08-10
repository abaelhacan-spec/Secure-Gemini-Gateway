/**
 * Lessons — the Oxford 3000 list split into a fixed curriculum of 60 lessons
 * (≈50 words each) instead of a rotating "10 random words per day" pool.
 *
 * How it works:
 * 1. OXFORD_3000 is split once, in order, into TOTAL_LESSONS chunks of
 *    WORDS_PER_LESSON words (the last lessons get whatever remains — the
 *    list doesn't divide evenly by 50). This split is fully deterministic,
 *    so it never needs to be stored.
 * 2. Progress is measured in **usage days**, not calendar days: every
 *    calendar day the app is actually opened counts once toward the total,
 *    no matter how many times it's opened that day. Days the app isn't
 *    opened simply don't count — they're not lost or "missed", they just
 *    stay pending until the user opens the app again. Every
 *    UNLOCK_INTERVAL_DAYS usage days, one additional lesson unlocks, so
 *    lesson 1 is open immediately and lesson 60 opens once the user has
 *    opened the app on (60 - 1) * 7 = 413 distinct days.
 * 3. Finishing a lesson (Learn → Practice → Writing) marks it "completed"
 *    (also persisted), independent of the unlock schedule — a user can
 *    unlock a lesson without finishing it, or finish it late.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { OXFORD_3000, type OxfordWord } from './oxford3000';
import type { Module, SeedWord } from './seed';

export const TOTAL_LESSONS = 60;
export const WORDS_PER_LESSON = 50;
export const UNLOCK_INTERVAL_DAYS = 7;
export const LESSON_ID_PREFIX = 'lesson-';

const USAGE_DAYS_KEY = '@nabih/lessons/usageDays';
const COMPLETED_KEY = '@nabih/lessons/completedLessons';

export interface LessonChunk {
  number: number; // 1-indexed
  id: string; // e.g. 'lesson-1'
  words: OxfordWord[];
}

// Splits OXFORD_3000 into TOTAL_LESSONS consecutive chunks, distributing the
// remainder across the first lessons so no chunk differs from another by
// more than one word (e.g. 2994 words → 54 lessons of 50 + 6 lessons of 49).
function buildLessonChunks(): LessonChunk[] {
  const total = OXFORD_3000.length;
  const base = Math.floor(total / TOTAL_LESSONS);
  const remainder = total % TOTAL_LESSONS;

  const chunks: LessonChunk[] = [];
  let cursor = 0;
  for (let i = 0; i < TOTAL_LESSONS; i++) {
    const size = base + (i < remainder ? 1 : 0);
    chunks.push({
      number: i + 1,
      id: `${LESSON_ID_PREFIX}${i + 1}`,
      words: OXFORD_3000.slice(cursor, cursor + size),
    });
    cursor += size;
  }
  return chunks;
}

export const LESSON_CHUNKS: LessonChunk[] = buildLessonChunks();

export function lessonIdFromNumber(n: number): string {
  return `${LESSON_ID_PREFIX}${n}`;
}

export function lessonNumberFromId(id: string | null | undefined): number | null {
  if (!id || !id.startsWith(LESSON_ID_PREFIX)) return null;
  const n = parseInt(id.slice(LESSON_ID_PREFIX.length), 10);
  return Number.isFinite(n) && n >= 1 && n <= TOTAL_LESSONS ? n : null;
}

export function getLessonChunk(n: number): LessonChunk | undefined {
  return LESSON_CHUNKS[n - 1];
}

function toSeedWord(entry: OxfordWord): SeedWord {
  return {
    id: entry.id,
    word: entry.word,
    arabicTranslation: '',
    definition: `Oxford 3000 word — CEFR level ${entry.level}.`,
  };
}

/** Builds a full lesson Module so the existing lesson screen (which expects
 * a Module with a .words array) can use it unchanged. */
export function getLessonModule(n: number): Module | null {
  const chunk = getLessonChunk(n);
  if (!chunk) return null;
  return {
    id: chunk.id,
    title: `Lesson ${n}`,
    titleAr: `الدرس ${n}`,
    level: 'Oxford 3000',
    order: n,
    description: `${chunk.words.length} كلمة من Oxford 3000 (${n} / ${TOTAL_LESSONS})`,
    grammarFocus: null,
    words: chunk.words.map(toSeedWord),
  };
}

export function getModuleByLessonId(id: string): Module | null {
  const n = lessonNumberFromId(id);
  return n ? getLessonModule(n) : null;
}

// ─── Usage-day tracking ─────────────────────────────────────────────────────
// A "usage day" is any calendar day (YYYY-MM-DD, device-local) on which the
// user opened the app at least once. Stored as a sorted array of date
// strings so the count is exact and idempotent (opening the app twice in
// one day doesn't count twice, and a day never spent in the app is just
// absent from the array rather than "missed").

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

async function getUsageDays(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(USAGE_DAYS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Call once per app session (e.g. on app init) to record "today" as a used
 * day if it isn't already. Safe to call multiple times per day. */
export async function recordAppOpenToday(): Promise<void> {
  const days = await getUsageDays();
  const today = todayKey();
  if (!days.includes(today)) {
    days.push(today);
    days.sort();
    await AsyncStorage.setItem(USAGE_DAYS_KEY, JSON.stringify(days));
  }
}

export async function getUsageDaysCount(): Promise<number> {
  const days = await getUsageDays();
  return days.length;
}

// ─── Unlock schedule (usage-day based) ─────────────────────────────────────

export async function getUnlockedLessonCount(): Promise<number> {
  const usageDays = await getUsageDaysCount();
  const intervalsCompleted = Math.floor(usageDays / UNLOCK_INTERVAL_DAYS);
  return Math.min(TOTAL_LESSONS, Math.max(1, intervalsCompleted + 1));
}

export async function isLessonUnlocked(n: number): Promise<boolean> {
  const unlockedCount = await getUnlockedLessonCount();
  return n <= unlockedCount;
}

/** How many more days the app needs to be opened before lesson `n` unlocks.
 * Returns 0 if it's already unlocked. */
export async function getUsageDaysRemainingForLesson(n: number): Promise<number> {
  const usageDays = await getUsageDaysCount();
  const requiredUsageDays = (n - 1) * UNLOCK_INTERVAL_DAYS;
  return Math.max(0, requiredUsageDays - usageDays);
}

// ─── Completion tracking ────────────────────────────────────────────────────

export async function getCompletedLessons(): Promise<number[]> {
  const raw = await AsyncStorage.getItem(COMPLETED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function markLessonCompleted(n: number): Promise<void> {
  const completed = await getCompletedLessons();
  if (!completed.includes(n)) {
    completed.push(n);
    await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(completed));
  }
}

// ─── Combined view for the lessons list screen ─────────────────────────────

export interface LessonStatus {
  number: number;
  id: string;
  titleAr: string;
  wordCount: number;
  unlocked: boolean;
  completed: boolean;
  /** Only meaningful when the lesson is still locked: how many more days
   * the app needs to be opened before it unlocks. */
  usageDaysRemaining: number;
}

export async function getLessonsWithStatus(): Promise<LessonStatus[]> {
  const [unlockedCount, completed, usageDays] = await Promise.all([
    getUnlockedLessonCount(),
    getCompletedLessons(),
    getUsageDaysCount(),
  ]);

  return LESSON_CHUNKS.map((chunk) => {
    const unlocked = chunk.number <= unlockedCount;
    const requiredUsageDays = (chunk.number - 1) * UNLOCK_INTERVAL_DAYS;
    return {
      number: chunk.number,
      id: chunk.id,
      titleAr: `الدرس ${chunk.number}`,
      wordCount: chunk.words.length,
      unlocked,
      completed: completed.includes(chunk.number),
      usageDaysRemaining: unlocked ? 0 : Math.max(0, requiredUsageDays - usageDays),
    };
  });
}

/** The lesson the "continue learning" card on Home should point to: the
 * first unlocked-but-not-completed lesson, or the last unlocked lesson if
 * everything currently open has been completed. */
export async function getCurrentLessonNumber(): Promise<number> {
  const statuses = await getLessonsWithStatus();
  const next = statuses.find((s) => s.unlocked && !s.completed);
  if (next) return next.number;
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i].unlocked) return statuses[i].number;
  }
  return 1;
}
