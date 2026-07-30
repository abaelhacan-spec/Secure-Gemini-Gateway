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
        generationConfig: {
          // Ask Gemini to return raw JSON directly — avoids markdown code
          // fences / preamble text that made client-side parsing fragile.
          responseMimeType: 'application/json',
          maxOutputTokens: 2048,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 403) {
        throw new Error('مفتاح Gemini API غير صالح أو غير مصرّح له. تحقق منه في الإعدادات.');
      }
      if (response.status === 429) {
        throw new Error('تم تجاوز حصة الاستخدام المسموحة لمفتاحك (Quota Exceeded). حاول لاحقًا أو تحقق من خطتك في Google AI Studio.');
      }
      if (response.status >= 500) {
        throw new Error('خادم Gemini يواجه مشكلة مؤقتة حاليًا. حاول بعد قليل.');
      }
      let bodyText = '';
      try { bodyText = await response.text(); } catch {}
      throw new Error(`خطأ من Gemini (HTTP ${response.status}): ${bodyText.slice(0, 200)}`);
    }

    const data = await response.json();

    if (data?.promptFeedback?.blockReason) {
      throw new Error(`تم حظر الرد من Gemini لأسباب تتعلق بالسلامة (${data.promptFeedback.blockReason}).`);
    }

    const candidate = data?.candidates?.[0];

    if (candidate?.finishReason === 'MAX_TOKENS') {
      throw new Error('انقطع رد Gemini قبل اكتماله (تجاوز الحد الأقصى للطول).');
    }
    if (candidate?.finishReason === 'SAFETY') {
      throw new Error('تم إيقاف الرد من Gemini بسبب فلاتر السلامة.');
    }

    const text: string | undefined = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('رد Gemini لم يحتوِ على نص قابل للقراءة.');
    }
    return text;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('انتهت مهلة الاتصال بـ Gemini. تحقق من اتصالك بالإنترنت.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function extractJSON(text: string): string {
  // Safety net: even with responseMimeType set, be lenient about stray
  // whitespace or an occasional wrapped response.
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) return candidate;
  return candidate.slice(firstBrace, lastBrace + 1);
}

async function generateJSON<T>(prompt: string, timeoutMs = 20_000): Promise<T | null> {
  const text = await callGemini(prompt, timeoutMs);
  if (!text) return null;
  try {
    return JSON.parse(extractJSON(text)) as T;
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
