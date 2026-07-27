/**
 * AITeacherGateway — the single entry point for all AI operations.
 *
 * Security: This module never exposes the Gemini API key.
 * All calls go through gemini-client.ts which reads key from process.env only.
 *
 * Each function corresponds to one Prompt Template from the architecture doc:
 *   sentence.correct, word.explain, conversation.turn, journal.dailyReport,
 *   grammar.detect, exercise.generate, exam.evaluate
 */

import { generateJSON, generateText } from "./gemini-client.js";
import { type UserMemorySnapshot } from "./memory.js";
import {
  buildSentenceCorrectPrompt,
  type SentenceCorrectResult,
} from "./templates/sentence-correct.js";
import {
  buildWordExplainPrompt,
  type WordExplainResult,
} from "./templates/word-explain.js";
import {
  buildConversationTurnPrompt,
  type ConversationTurnResult,
} from "./templates/conversation-turn.js";
import {
  buildJournalDailyReportPrompt,
  type JournalReportResult,
} from "./templates/journal-daily-report.js";
import {
  buildGrammarDetectPrompt,
  type GrammarDetectResult,
} from "./templates/grammar-detect.js";
import {
  buildExerciseGeneratePrompt,
  type ExerciseGenerateResult,
} from "./templates/exercise-generate.js";
import {
  buildExamEvaluatePrompt,
  type ExamEvaluateResult,
} from "./templates/exam-evaluate.js";

export type { UserMemorySnapshot };

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Fallback messages (shown when AI is unavailable) ────────────────────────

const FALLBACKS = {
  sentenceCorrect: "لم أتمكن من التحقق الآن، حاول مجدداً بعد قليل.",
  wordExplain: "لم أتمكن من شرح الكلمة الآن، حاول مجدداً.",
  conversationTurn: "لم أتمكن من الرد الآن. أعد المحاولة بعد لحظة.",
  journalReport: "لم يتمكن نبيه من كتابة تقريرك اليوم، سيظهر تلقائياً عند عودة الاتصال.",
  grammarDetect: null, // Graceful: just skip detection
  exerciseGenerate: "لم أتمكن من توليد التمارين الآن، حاول مجدداً.",
  examEvaluate: "لم أتمكن من تقييم إجابتك الآن، حاول مجدداً بعد قليل.",
} as const;

// ─── Gateway Functions ────────────────────────────────────────────────────────

export async function correctSentence(
  sentence: string,
  userMemory: UserMemorySnapshot
): Promise<{ result: SentenceCorrectResult | null; fallback: string | null }> {
  const prompt = buildSentenceCorrectPrompt(sentence, userMemory);
  const result = await generateJSON<SentenceCorrectResult>(prompt);
  return { result, fallback: result ? null : FALLBACKS.sentenceCorrect };
}

export async function explainWord(
  word: string,
  userMemory: UserMemorySnapshot
): Promise<{ result: WordExplainResult | null; fallback: string | null }> {
  const prompt = buildWordExplainPrompt(word, userMemory);
  const result = await generateJSON<WordExplainResult>(prompt);
  return { result, fallback: result ? null : FALLBACKS.wordExplain };
}

export async function conversationTurn(
  userMessage: string,
  history: ConversationMessage[],
  userMemory: UserMemorySnapshot
): Promise<{ result: ConversationTurnResult | null; fallback: string | null }> {
  const prompt = buildConversationTurnPrompt(userMessage, history, userMemory);
  const result = await generateJSON<ConversationTurnResult>(prompt);
  return { result, fallback: result ? null : FALLBACKS.conversationTurn };
}

export async function generateDailyReport(
  wordsLearnedToday: string[],
  mistakesMadeToday: string[],
  sentencesWritten: number,
  streakDays: number,
  userMemory: UserMemorySnapshot
): Promise<{ result: JournalReportResult | null; fallback: string | null }> {
  const prompt = buildJournalDailyReportPrompt(
    wordsLearnedToday,
    mistakesMadeToday,
    sentencesWritten,
    streakDays,
    userMemory
  );
  const result = await generateJSON<JournalReportResult>(prompt);
  return { result, fallback: result ? null : FALLBACKS.journalReport };
}

export async function detectGrammarPattern(
  sentence: string,
  knownPatterns: string[]
): Promise<{ result: GrammarDetectResult | null; fallback: null }> {
  const prompt = buildGrammarDetectPrompt(sentence, knownPatterns);
  const result = await generateJSON<GrammarDetectResult>(prompt);
  return { result, fallback: null };
}

export async function generateExercises(
  moduleTitle: string,
  targetWords: string[],
  grammarFocus: string | null,
  userMemory: UserMemorySnapshot
): Promise<{ result: ExerciseGenerateResult | null; fallback: string | null }> {
  const prompt = buildExerciseGeneratePrompt(moduleTitle, targetWords, grammarFocus, userMemory);
  const result = await generateJSON<ExerciseGenerateResult>(prompt);
  return { result, fallback: result ? null : FALLBACKS.exerciseGenerate };
}

export async function evaluateExam(
  evaluationType: "writing" | "conversation",
  content: string,
  criteria: string,
  userMemory: UserMemorySnapshot
): Promise<{ result: ExamEvaluateResult | null; fallback: string | null }> {
  const prompt = buildExamEvaluatePrompt(evaluationType, content, criteria, userMemory);
  const result = await generateJSON<ExamEvaluateResult>(prompt);
  return { result, fallback: result ? null : FALLBACKS.examEvaluate };
}
