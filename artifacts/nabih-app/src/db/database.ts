/**
 * Local SQLite database for Nabih — Offline-First architecture.
 * All user data lives here. The backend is only called for AI features.
 */

import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('nabih.db');
  }
  return _db;
}

export async function initDatabase(): Promise<void> {
  const db = getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      level TEXT NOT NULL DEFAULT 'A0',
      goal TEXT NOT NULL DEFAULT 'general',
      streak_days INTEGER NOT NULL DEFAULT 0,
      last_session_date TEXT,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS words (
      id TEXT PRIMARY KEY,
      word TEXT NOT NULL,
      arabic_translation TEXT,
      definition TEXT,
      examples TEXT,
      module_id TEXT NOT NULL,
      lifecycle_stage TEXT NOT NULL DEFAULT 'new',
      used_in_sentence_count INTEGER NOT NULL DEFAULT 0,
      used_in_conversation_count INTEGER NOT NULL DEFAULT 0,
      review_interval_days INTEGER NOT NULL DEFAULT 0,
      next_review_at TEXT,
      learned_at TEXT,
      last_mistake_at TEXT,
      reviewed_after_mistake INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS word_reviews (
      id TEXT PRIMARY KEY,
      word_id TEXT NOT NULL,
      reviewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      result TEXT NOT NULL CHECK(result IN ('correct', 'incorrect'))
    );

    CREATE TABLE IF NOT EXISTS mistake_patterns (
      id TEXT PRIMARY KEY,
      pattern_name TEXT NOT NULL UNIQUE,
      occurrences INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_journal (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      words_learned TEXT NOT NULL DEFAULT '[]',
      mistakes_made TEXT NOT NULL DEFAULT '[]',
      sentences_written INTEGER NOT NULL DEFAULT 0,
      ai_report TEXT,
      ai_report_pending INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pending_ai_requests (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS conversation_history (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrate existing installs (columns above only apply to brand-new DBs).
  // Each ALTER TABLE is wrapped individually since SQLite errors if the
  // column already exists, and there's no portable "ADD COLUMN IF NOT EXISTS".
  const migrations = [
    `ALTER TABLE words ADD COLUMN examples TEXT`,
    `ALTER TABLE words ADD COLUMN review_interval_days INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE words ADD COLUMN next_review_at TEXT`,
  ];
  for (const migration of migrations) {
    try {
      await db.execAsync(migration);
    } catch {
      // Column already exists — safe to ignore.
    }
  }

  // Ensure user profile row exists
  await db.runAsync(
    `INSERT OR IGNORE INTO user_profile (id, level, goal) VALUES (1, 'A0', 'general')`
  );
}

// ─── User Profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: number;
  level: string;
  goal: string;
  streakDays: number;
  lastSessionDate: string | null;
  onboardingCompleted: boolean;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const db = getDb();
  const row = await db.getFirstAsync<{
    id: number;
    level: string;
    goal: string;
    streak_days: number;
    last_session_date: string | null;
    onboarding_completed: number;
  }>('SELECT * FROM user_profile WHERE id = 1');

  if (!row) return null;
  return {
    id: row.id,
    level: row.level,
    goal: row.goal,
    streakDays: row.streak_days,
    lastSessionDate: row.last_session_date,
    onboardingCompleted: row.onboarding_completed === 1,
  };
}

export async function updateUserProfile(
  data: Partial<Omit<UserProfile, 'id'>>
): Promise<void> {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.level !== undefined) { fields.push('level = ?'); values.push(data.level); }
  if (data.goal !== undefined) { fields.push('goal = ?'); values.push(data.goal); }
  if (data.streakDays !== undefined) { fields.push('streak_days = ?'); values.push(data.streakDays); }
  if (data.lastSessionDate !== undefined) { fields.push('last_session_date = ?'); values.push(data.lastSessionDate); }
  if (data.onboardingCompleted !== undefined) { fields.push('onboarding_completed = ?'); values.push(data.onboardingCompleted ? 1 : 0); }

  if (fields.length === 0) return;
  values.push(1);
  await db.runAsync(`UPDATE user_profile SET ${fields.join(', ')} WHERE id = ?`, values);
}

// ─── Words ───────────────────────────────────────────────────────────────────

export interface Word {
  id: string;
  word: string;
  arabicTranslation: string | null;
  definition: string | null;
  examples: string[];
  moduleId: string;
  lifecycleStage: 'new' | 'learned' | 'reviewed' | 'usedInSentence' | 'usedInConversation' | 'mastered' | 'needsReview';
  usedInSentenceCount: number;
  usedInConversationCount: number;
  learnedAt: string | null;
  reviewIntervalDays: number;
  nextReviewAt: string | null;
}

export async function getWords(moduleId?: string): Promise<Word[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string; word: string; arabic_translation: string | null;
    definition: string | null; examples: string | null; module_id: string; lifecycle_stage: string;
    used_in_sentence_count: number; used_in_conversation_count: number;
    learned_at: string | null; review_interval_days: number; next_review_at: string | null;
  }>(
    moduleId
      ? 'SELECT * FROM words WHERE module_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM words ORDER BY lifecycle_stage, created_at DESC',
    moduleId ? [moduleId] : []
  );

  return rows.map(rowToWord);
}

function rowToWord(r: {
  id: string; word: string; arabic_translation: string | null;
  definition: string | null; examples: string | null; module_id: string; lifecycle_stage: string;
  used_in_sentence_count: number; used_in_conversation_count: number;
  learned_at: string | null; review_interval_days: number; next_review_at: string | null;
}): Word {
  let examples: string[] = [];
  try {
    examples = r.examples ? JSON.parse(r.examples) : [];
  } catch {
    examples = [];
  }
  return {
    id: r.id, word: r.word, arabicTranslation: r.arabic_translation,
    definition: r.definition, examples, moduleId: r.module_id,
    lifecycleStage: r.lifecycle_stage as Word['lifecycleStage'],
    usedInSentenceCount: r.used_in_sentence_count,
    usedInConversationCount: r.used_in_conversation_count,
    learnedAt: r.learned_at,
    reviewIntervalDays: r.review_interval_days ?? 0,
    nextReviewAt: r.next_review_at,
  };
}

/** Fetches DB rows for a specific set of word ids (e.g. today's 10 daily words). */
export async function getWordsByIds(ids: string[]): Promise<Word[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{
    id: string; word: string; arabic_translation: string | null;
    definition: string | null; examples: string | null; module_id: string; lifecycle_stage: string;
    used_in_sentence_count: number; used_in_conversation_count: number;
    learned_at: string | null; review_interval_days: number; next_review_at: string | null;
  }>(`SELECT * FROM words WHERE id IN (${placeholders})`, ids);
  return rows.map(rowToWord);
}

export async function updateWordStage(wordId: string, stage: Word['lifecycleStage']): Promise<void> {
  const db = getDb();
  const learnedAt = stage === 'learned' ? new Date().toISOString() : undefined;
  if (learnedAt) {
    await db.runAsync('UPDATE words SET lifecycle_stage = ?, learned_at = ? WHERE id = ?', [stage, learnedAt, wordId]);
  } else {
    await db.runAsync('UPDATE words SET lifecycle_stage = ? WHERE id = ?', [stage, wordId]);
  }
}

/** Caches the AI-generated definition/translation/examples for a word so
 * later stages (Practice) can build exercises locally without another
 * Gemini call. */
export async function saveWordExplanation(
  wordId: string,
  data: { definition: string; arabicTranslation: string; examples: string[] }
): Promise<void> {
  const db = getDb();
  await db.runAsync(
    'UPDATE words SET definition = ?, arabic_translation = ?, examples = ? WHERE id = ?',
    [data.definition, data.arabicTranslation, JSON.stringify(data.examples), wordId]
  );
}

// ─── Spaced Repetition (word_reviews + lifecycle_stage) ──────────────────────
// Fixed review schedule: day 1 → day 3 → day 7 → day 14 → day 30.
// A word that passes the day-30 review is marked "mastered". Any incorrect
// review resets it back to the first interval instead of removing it.
export const SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30];

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

/** Called once, when a word finishes today's Learn → Practice → Writing
 * flow for the first time. Enrolls it in the spaced-repetition queue. */
export async function completeInitialLearning(wordId: string): Promise<void> {
  const db = getDb();
  const firstInterval = SRS_INTERVALS_DAYS[0];
  await db.runAsync(
    `UPDATE words
     SET lifecycle_stage = 'learned', learned_at = datetime('now'),
         review_interval_days = ?, next_review_at = ?
     WHERE id = ?`,
    [firstInterval, addDaysIso(firstInterval), wordId]
  );
}

/** Records the result of a spaced-repetition review and schedules the next one. */
export async function recordWordReview(
  wordId: string,
  result: 'correct' | 'incorrect'
): Promise<{ lifecycleStage: Word['lifecycleStage']; nextReviewAt: string }> {
  const db = getDb();
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  await db.runAsync(
    'INSERT INTO word_reviews (id, word_id, result) VALUES (?, ?, ?)',
    [id, wordId, result]
  );

  const row = await db.getFirstAsync<{ review_interval_days: number }>(
    'SELECT review_interval_days FROM words WHERE id = ?',
    [wordId]
  );
  const currentIndex = SRS_INTERVALS_DAYS.indexOf(row?.review_interval_days ?? 0);

  let nextIntervalDays: number;
  let lifecycleStage: Word['lifecycleStage'];

  if (result === 'correct') {
    const nextIndex = Math.min(currentIndex + 1, SRS_INTERVALS_DAYS.length - 1);
    const reachedFinalInterval = currentIndex >= SRS_INTERVALS_DAYS.length - 1;
    nextIntervalDays = SRS_INTERVALS_DAYS[nextIndex];
    lifecycleStage = reachedFinalInterval ? 'mastered' : 'learned';
  } else {
    nextIntervalDays = SRS_INTERVALS_DAYS[0];
    lifecycleStage = 'learned';
  }

  const nextReviewAt = addDaysIso(nextIntervalDays);
  await db.runAsync(
    'UPDATE words SET review_interval_days = ?, next_review_at = ?, lifecycle_stage = ? WHERE id = ?',
    [nextIntervalDays, nextReviewAt, lifecycleStage, wordId]
  );

  return { lifecycleStage, nextReviewAt };
}

/** Words whose next scheduled review is due (today or overdue). */
export async function getDueReviewWords(limit = 30): Promise<Word[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string; word: string; arabic_translation: string | null;
    definition: string | null; examples: string | null; module_id: string; lifecycle_stage: string;
    used_in_sentence_count: number; used_in_conversation_count: number;
    learned_at: string | null; review_interval_days: number; next_review_at: string | null;
  }>(
    `SELECT * FROM words
     WHERE lifecycle_stage = 'learned' AND next_review_at IS NOT NULL AND next_review_at <= datetime('now')
     ORDER BY next_review_at ASC LIMIT ?`,
    [limit]
  );
  return rows.map(rowToWord);
}

/** Overall progress across the whole Oxford 3000 list. */
export async function getMasteryStats(): Promise<{
  masteredCount: number;
  inProgressCount: number;
  dueReviewCount: number;
}> {
  const db = getDb();
  const mastered = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM words WHERE lifecycle_stage = 'mastered'`
  );
  const inProgress = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM words WHERE lifecycle_stage = 'learned'`
  );
  const due = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM words
     WHERE lifecycle_stage = 'learned' AND next_review_at IS NOT NULL AND next_review_at <= datetime('now')`
  );
  return {
    masteredCount: mastered?.c ?? 0,
    inProgressCount: inProgress?.c ?? 0,
    dueReviewCount: due?.c ?? 0,
  };
}

/** Increments the "used in a sentence" counter for a word (Writing stage). */
export async function recordWordUsedInSentence(wordId: string): Promise<void> {
  const db = getDb();
  await db.runAsync('UPDATE words SET used_in_sentence_count = used_in_sentence_count + 1 WHERE id = ?', [wordId]);
}

// ─── Mistake Patterns ────────────────────────────────────────────────────────

export interface MistakePattern {
  id: string;
  patternName: string;
  occurrences: number;
  resolved: boolean;
}

export async function getMistakePatterns(onlyActive = true): Promise<MistakePattern[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string; pattern_name: string; occurrences: number; resolved: number;
  }>(
    onlyActive
      ? 'SELECT * FROM mistake_patterns WHERE resolved = 0 AND occurrences >= 2 ORDER BY occurrences DESC'
      : 'SELECT * FROM mistake_patterns ORDER BY occurrences DESC'
  );
  return rows.map((r) => ({
    id: r.id, patternName: r.pattern_name,
    occurrences: r.occurrences, resolved: r.resolved === 1,
  }));
}

export async function recordMistakePattern(patternName: string): Promise<void> {
  const db = getDb();
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  await db.runAsync(`
    INSERT INTO mistake_patterns (id, pattern_name, last_seen_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(pattern_name) DO UPDATE SET
      occurrences = occurrences + 1,
      last_seen_at = datetime('now'),
      resolved = 0
  `, [id, patternName]);
}

// ─── Daily Journal ───────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  date: string;
  wordsLearned: string[];
  mistakesMade: string[];
  sentencesWritten: number;
  aiReport: string | null;
  aiReportPending: boolean;
}

export async function getTodayJournal(): Promise<JournalEntry | null> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const row = await db.getFirstAsync<{
    id: string; date: string; words_learned: string;
    mistakes_made: string; sentences_written: number;
    ai_report: string | null; ai_report_pending: number;
  }>('SELECT * FROM daily_journal WHERE date = ?', [today]);

  if (!row) return null;
  return {
    id: row.id, date: row.date,
    wordsLearned: JSON.parse(row.words_learned),
    mistakesMade: JSON.parse(row.mistakes_made),
    sentencesWritten: row.sentences_written,
    aiReport: row.ai_report,
    aiReportPending: row.ai_report_pending === 1,
  };
}

export async function getJournalEntries(limit = 30): Promise<JournalEntry[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string; date: string; words_learned: string;
    mistakes_made: string; sentences_written: number;
    ai_report: string | null; ai_report_pending: number;
  }>('SELECT * FROM daily_journal ORDER BY date DESC LIMIT ?', [limit]);

  return rows.map((r) => ({
    id: r.id, date: r.date,
    wordsLearned: JSON.parse(r.words_learned),
    mistakesMade: JSON.parse(r.mistakes_made),
    sentencesWritten: r.sentences_written,
    aiReport: r.ai_report,
    aiReportPending: r.ai_report_pending === 1,
  }));
}

export async function upsertTodayJournal(
  data: Partial<Omit<JournalEntry, 'id' | 'date'>>
): Promise<void> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

  const existing = await getTodayJournal();
  if (!existing) {
    await db.runAsync(
      `INSERT INTO daily_journal (id, date, words_learned, mistakes_made, sentences_written, ai_report, ai_report_pending)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id, today,
        JSON.stringify(data.wordsLearned ?? []),
        JSON.stringify(data.mistakesMade ?? []),
        data.sentencesWritten ?? 0,
        data.aiReport ?? null,
        data.aiReportPending ? 1 : 0,
      ]
    );
  } else {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.wordsLearned !== undefined) { fields.push('words_learned = ?'); values.push(JSON.stringify(data.wordsLearned)); }
    if (data.mistakesMade !== undefined) { fields.push('mistakes_made = ?'); values.push(JSON.stringify(data.mistakesMade)); }
    if (data.sentencesWritten !== undefined) { fields.push('sentences_written = ?'); values.push(data.sentencesWritten); }
    if (data.aiReport !== undefined) { fields.push('ai_report = ?'); values.push(data.aiReport); }
    if (data.aiReportPending !== undefined) { fields.push('ai_report_pending = ?'); values.push(data.aiReportPending ? 1 : 0); }
    if (fields.length > 0) {
      values.push(today);
      await db.runAsync(`UPDATE daily_journal SET ${fields.join(', ')} WHERE date = ?`, values);
    }
  }
}

// ─── Conversation History ─────────────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export async function getConversationHistory(sessionId: string, limit = 20): Promise<ConversationMessage[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    id: string; session_id: string; role: string; content: string; created_at: string;
  }>('SELECT * FROM conversation_history WHERE session_id = ? ORDER BY created_at ASC LIMIT ?', [sessionId, limit]);
  return rows.map((r) => ({
    id: r.id, sessionId: r.session_id,
    role: r.role as 'user' | 'assistant',
    content: r.content, createdAt: r.created_at,
  }));
}

export async function addConversationMessage(
  sessionId: string, role: 'user' | 'assistant', content: string
): Promise<void> {
  const db = getDb();
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  await db.runAsync(
    'INSERT INTO conversation_history (id, session_id, role, content) VALUES (?, ?, ?, ?)',
    [id, sessionId, role, content]
  );
}
