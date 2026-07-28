/**
 * Direct on-device Gemini client.
 *
 * Calls the Gemini REST API using the user's own API key (entered in
 * Settings and stored via expo-secure-store). No backend server is
 * involved — the app talks to Google directly.
 *
 * If you need to change the model later (e.g. after a Google deprecation),
 * this is the only place to edit.
 */
import { getGeminiApiKey, MissingApiKeyError } from './apiKey';
import {
  buildSentenceCorrectPrompt, type SentenceCorrectResult,
  buildWordExplainPrompt, type WordExplainResult,
  buildConversationTurnPrompt, type ConversationTurnResult,
  buildJournalDailyReportPrompt, type JournalReportResult,
  buildGrammarDetectPrompt, type GrammarDetectResult,
  buildExerciseGeneratePrompt, type ExerciseGenerateResult,
  buildExamEvaluatePrompt, type ExamEvaluateResult,
  type UserMemorySnapshot,
  type ConversationMessage,
} from './prompts';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const FALLBACKS = {
  sentenceCorrect: 'لم أتمكن من التحقق الآن، حاول مجدداً بعد قليل.',
  wordExplain: 'لم أتمكن من شرح الكلمة الآن، حاول مجدداً.',
  conversationTurn: 'لم أتمكن من الرد الآن. أعد المحاولة بعد لحظة.',
  journalReport: 'لم يتمكن نبيه من كتابة تقريرك اليوم، حاول مجدداً بعد قليل.',
  exerciseGenerate: 'لم أتمكن من توليد التمارين الآن، حاول مجدداً.',
  examEvaluate: 'لم أتمكن من تقييم إجابتك الآن، حاول مجدداً بعد قليل.',
} as const;

class AIUnavailableError extends Error {
  fallback: string;
  constructor(fallback: string) {
    super(fallback);
    this.name = 'AIUnavailableError';
    this.fallback = fallback;
  }
}

async function callGemini(prompt: string, timeoutMs: number): Promise<string | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // 400 with API_KEY_INVALID is Google's way of saying the key is bad
      if (response.status === 400 || response.status === 403) {
        throw new Error('مفتاح Gemini API غير صالح. تحقق منه في الإعدادات.');
      }
      return null;
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ?? null;
  } catch (err) {
    if (err instanceof Error && err.message.includes('غير صالح')) throw err;
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateJSON<T>(prompt: string, timeoutMs = 20_000): Promise<T | null> {
  const text = await callGemini(prompt, timeoutMs);
  if (!text) return null;
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// ─── Gateway functions (same contract as the old backend) ─────────────────

export async function correctSentence(sentence: string, userMemory: UserMemorySnapshot) {
  const prompt = buildSentenceCorrectPrompt(sentence, userMemory);
  const result = await generateJSON<SentenceCorrectResult>(prompt);
  if (!result) throw new AIUnavailableError(FALLBACKS.sentenceCorrect);
  return result;
}

export async function explainWord(word: string, userMemory: UserMemorySnapshot) {
  const prompt = buildWordExplainPrompt(word, userMemory);
  const result = await generateJSON<WordExplainResult>(prompt);
  if (!result) throw new AIUnavailableError(FALLBACKS.wordExplain);
  return result;
}

export async function conversationTurn(
  userMessage: string,
  history: ConversationMessage[],
  userMemory: UserMemorySnapshot
) {
  const prompt = buildConversationTurnPrompt(userMessage, history, userMemory);
  const result = await generateJSON<ConversationTurnResult>(prompt);
  if (!result) throw new AIUnavailableError(FALLBACKS.conversationTurn);
  return result;
}

export async function generateDailyReport(
  wordsLearnedToday: string[],
  mistakesMadeToday: string[],
  sentencesWritten: number,
  streakDays: number,
  userMemory: UserMemorySnapshot
) {
  const prompt = buildJournalDailyReportPrompt(
    wordsLearnedToday, mistakesMadeToday, sentencesWritten, streakDays, userMemory
  );
  const result = await generateJSON<JournalReportResult>(prompt);
  if (!result) throw new AIUnavailableError(FALLBACKS.journalReport);
  return result;
}

export async function detectGrammarPattern(
  sentence: string,
  knownPatterns: string[]
): Promise<GrammarDetectResult> {
  const prompt = buildGrammarDetectPrompt(sentence, knownPatterns);
  const result = await generateJSON<GrammarDetectResult>(prompt);
  // Matches old behavior: this one never throws, null pattern is valid.
  return result ?? { matchedPattern: null, description: null };
}

export async function generateExercises(
  moduleTitle: string,
  targetWords: string[],
  grammarFocus: string | null,
  userMemory: UserMemorySnapshot
) {
  const prompt = buildExerciseGeneratePrompt(moduleTitle, targetWords, grammarFocus, userMemory);
  const result = await generateJSON<ExerciseGenerateResult>(prompt);
  if (!result) throw new AIUnavailableError(FALLBACKS.exerciseGenerate);
  return result;
}

export async function evaluateExam(
  evaluationType: 'writing' | 'conversation',
  content: string,
  criteria: string,
  userMemory: UserMemorySnapshot
) {
  const prompt = buildExamEvaluatePrompt(evaluationType, content, criteria, userMemory);
  const result = await generateJSON<ExamEvaluateResult>(prompt);
  if (!result) throw new AIUnavailableError(FALLBACKS.examEvaluate);
  return result;
}
