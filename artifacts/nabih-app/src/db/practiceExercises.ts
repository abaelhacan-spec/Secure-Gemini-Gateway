/**
 * Practice stage — generates the 4 exercise types locally from data already
 * fetched during the Learn stage (word.definition / arabicTranslation /
 * examples, cached via saveWordExplanation). No extra Gemini calls needed.
 *
 * Only words missing a cached explanation + example (e.g. Learn stage
 * failed offline) can't get a local exercise — the lesson screen falls back
 * to useAiExerciseGenerate for just those few words.
 */

import type { Word } from './database';

export type PracticeExerciseType = 'choose-meaning' | 'match' | 'fill-blank' | 'reorder';

export interface PracticeExercise {
  id: string;
  type: PracticeExerciseType;
  wordId: string;
  word: string;
  prompt: string;
  options?: string[];
  tokens?: string[];
  correctAnswer: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[.,!?"']/g, '');
}

/** A word is "practice-ready" if the Learn stage successfully cached an
 * explanation for it (translation + at least one example sentence). */
export function isPracticeReady(word: Word): boolean {
  return !!word.arabicTranslation && word.examples.length > 0;
}

function pickDistractors(pool: Word[], exclude: Word, count: number): string[] {
  const candidates = pool.filter((w) => w.id !== exclude.id && w.arabicTranslation);
  return shuffle(candidates)
    .slice(0, count)
    .map((w) => w.arabicTranslation as string);
}

function buildChooseMeaning(word: Word, pool: Word[]): PracticeExercise | null {
  if (!word.arabicTranslation) return null;
  const distractors = pickDistractors(pool, word, 3);
  if (distractors.length < 3) return null;
  return {
    id: `${word.id}-choose-meaning`,
    type: 'choose-meaning',
    wordId: word.id,
    word: word.word,
    prompt: word.word,
    options: shuffle([word.arabicTranslation, ...distractors]),
    correctAnswer: word.arabicTranslation,
  };
}

function buildMatch(word: Word, pool: Word[]): PracticeExercise | null {
  // Reversed direction from choose-meaning: Arabic → English, for variety.
  if (!word.arabicTranslation) return null;
  const distractors = shuffle(pool.filter((w) => w.id !== word.id)).slice(0, 3).map((w) => w.word);
  if (distractors.length < 3) return null;
  return {
    id: `${word.id}-match`,
    type: 'match',
    wordId: word.id,
    word: word.word,
    prompt: word.arabicTranslation,
    options: shuffle([word.word, ...distractors]),
    correctAnswer: word.word,
  };
}

function buildFillBlank(word: Word): PracticeExercise | null {
  const example = word.examples.find((ex) =>
    new RegExp(`\\b${word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(ex)
  );
  if (!example) return null;
  const blanked = example.replace(
    new RegExp(`\\b${word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
    '____'
  );
  return {
    id: `${word.id}-fill-blank`,
    type: 'fill-blank',
    wordId: word.id,
    word: word.word,
    prompt: blanked,
    correctAnswer: word.word,
  };
}

function buildReorder(word: Word): PracticeExercise | null {
  const example = word.examples[0];
  if (!example) return null;
  const words = example.split(/\s+/).filter(Boolean);
  if (words.length < 3) return null;
  return {
    id: `${word.id}-reorder`,
    type: 'reorder',
    wordId: word.id,
    word: word.word,
    prompt: 'رتب الكلمات لتكوين جملة صحيحة',
    tokens: shuffle(words),
    correctAnswer: words.join(' '),
  };
}

const TYPE_ORDER: PracticeExerciseType[] = ['choose-meaning', 'reorder', 'fill-blank', 'match'];

/** Builds one practice exercise per word, cycling through the 4 exercise
 * types so the set feels varied. Falls back to "choose-meaning" for any
 * word where the preferred type can't be built from cached data (e.g. no
 * example sentence containing the word for fill-blank/reorder). */
export function buildPracticeSet(words: Word[]): PracticeExercise[] {
  const readyWords = words.filter(isPracticeReady);
  const exercises: PracticeExercise[] = [];

  readyWords.forEach((word, i) => {
    const preferredType = TYPE_ORDER[i % TYPE_ORDER.length];
    let exercise: PracticeExercise | null = null;

    switch (preferredType) {
      case 'choose-meaning':
        exercise = buildChooseMeaning(word, readyWords);
        break;
      case 'match':
        exercise = buildMatch(word, readyWords);
        break;
      case 'fill-blank':
        exercise = buildFillBlank(word);
        break;
      case 'reorder':
        exercise = buildReorder(word);
        break;
    }

    // Fall back to whichever type can actually be built for this word.
    if (!exercise) exercise = buildChooseMeaning(word, readyWords);
    if (!exercise) exercise = buildFillBlank(word);
    if (!exercise) exercise = buildReorder(word);
    if (!exercise) exercise = buildMatch(word, readyWords);

    if (exercise) exercises.push(exercise);
  });

  return shuffle(exercises);
}

/** Checks a user's answer for a given exercise. */
export function checkAnswer(exercise: PracticeExercise, userAnswer: string): boolean {
  if (exercise.type === 'reorder') {
    return normalize(userAnswer) === normalize(exercise.correctAnswer);
  }
  return normalize(userAnswer) === normalize(exercise.correctAnswer);
}

/** Words that couldn't get a local exercise (missing cached explanation) —
 * these are the only ones that should go through useAiExerciseGenerate. */
export function wordsNeedingAiFallback(words: Word[]): Word[] {
  return words.filter((w) => !isPracticeReady(w));
}
