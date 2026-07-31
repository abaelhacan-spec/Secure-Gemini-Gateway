/**
 * Daily Words — picks a fresh batch of words every day from the Oxford 3000
 * list instead of the app always showing the same fixed 10 words.
 *
 * How it works:
 * 1. The full Oxford 3000 list is shuffled once, using a fixed seed, into a
 *    stable random order (SHUFFLED_ORDER). This order never changes between
 *    app runs, so it's fully deterministic and doesn't need to be stored.
 * 2. A "cursor" (an index into SHUFFLED_ORDER) is persisted in AsyncStorage.
 *    Every new calendar day, the app takes the next DAILY_WORD_COUNT words
 *    starting at the cursor, then advances the cursor by that count.
 * 3. When the cursor reaches the end of the list it wraps back to 0, so the
 *    cycle restarts (after ~300 days of daily practice at 10 words/day for
 *    the ~3000-word list) instead of ever repeating within a cycle.
 * 4. The batch chosen "today" is cached, so re-opening the app or the lesson
 *    screen on the same day always shows the same 10 words (no shuffling
 *    mid-day), while opening it tomorrow gives a new batch.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { OXFORD_3000, type OxfordWord } from './oxford3000';
import type { Module, SeedWord } from './seed';

export const DAILY_WORD_COUNT = 10;
export const DAILY_MODULE_ID = 'module-daily-oxford';

const CURSOR_KEY = '@nabih/dailyWords/cursor';
const DATE_KEY = '@nabih/dailyWords/date';
const CACHE_KEY = '@nabih/dailyWords/cache';

// Fixed-seed shuffle so the "random" order is identical every time the app
// runs, without needing to store all 3000 words in AsyncStorage.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildShuffledOrder(): number[] {
  const rand = mulberry32(20240614); // arbitrary fixed seed
  const order = OXFORD_3000.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Computed once per app session.
const SHUFFLED_ORDER = buildShuffledOrder();

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function toSeedWord(entry: OxfordWord): SeedWord {
  return {
    id: entry.id,
    word: entry.word,
    arabicTranslation: '',
    definition: `Oxford 3000 word — CEFR level ${entry.level}.`,
  };
}

/**
 * Returns today's batch of Oxford words (creating and persisting it the
 * first time it's requested on a given day, reusing it afterward).
 */
export async function getDailyOxfordWords(): Promise<OxfordWord[]> {
  const today = todayKey();

  try {
    const [storedDate, storedCache] = await Promise.all([
      AsyncStorage.getItem(DATE_KEY),
      AsyncStorage.getItem(CACHE_KEY),
    ]);

    if (storedDate === today && storedCache) {
      const ids: string[] = JSON.parse(storedCache);
      const byId = new Map(OXFORD_3000.map((w) => [w.id, w]));
      const words = ids.map((id) => byId.get(id)).filter((w): w is OxfordWord => !!w);
      if (words.length === DAILY_WORD_COUNT) return words;
    }

    const storedCursorRaw = await AsyncStorage.getItem(CURSOR_KEY);
    const cursor = storedCursorRaw ? parseInt(storedCursorRaw, 10) : 0;
    const safeCursor = Number.isFinite(cursor) ? cursor % SHUFFLED_ORDER.length : 0;

    const batchIndexes: number[] = [];
    for (let i = 0; i < DAILY_WORD_COUNT; i++) {
      batchIndexes.push(SHUFFLED_ORDER[(safeCursor + i) % SHUFFLED_ORDER.length]);
    }
    const words = batchIndexes.map((idx) => OXFORD_3000[idx]);

    const newCursor = (safeCursor + DAILY_WORD_COUNT) % SHUFFLED_ORDER.length;
    await Promise.all([
      AsyncStorage.setItem(CURSOR_KEY, String(newCursor)),
      AsyncStorage.setItem(DATE_KEY, today),
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(words.map((w) => w.id))),
    ]);

    return words;
  } catch (error) {
    console.error('Failed to compute daily words, falling back to a static slice:', error);
    // Offline/storage-failure fallback: still show *some* words rather than crashing.
    return OXFORD_3000.slice(0, DAILY_WORD_COUNT);
  }
}

/**
 * Builds a full lesson Module for "today", so the existing lesson screen
 * (which expects a Module with a .words array) can use it unchanged.
 */
export async function getDailyModule(): Promise<Module> {
  const oxfordWords = await getDailyOxfordWords();
  const dateLabel = new Date().toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' });

  return {
    id: DAILY_MODULE_ID,
    title: 'Word of the Day',
    titleAr: 'كلمات اليوم',
    level: 'Oxford 3000',
    order: 0,
    description: `10 كلمات جديدة مختارة لك اليوم (${dateLabel})`,
    grammarFocus: null,
    words: oxfordWords.map(toSeedWord),
  };
}
