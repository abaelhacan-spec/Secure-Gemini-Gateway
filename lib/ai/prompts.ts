/**
 * Prompt templates and result types for every Nabih AI operation.
 *
 * Ported as-is from the former backend gateway (artifacts/api-server) so the
 * app produces identical prompts and JSON shapes, now running on-device
 * against the user's own Gemini API key instead of a shared server.
 */

// ─── Shared types ──────────────────────────────────────────────────────────

export interface UserMemorySnapshot {
  userLevel: string;
  goal: string;
  recentWords: string[];
  frequentMistakes: string[];
  currentModule: string;
  lastSessionSummary: string | null;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function serializeMemory(memory: UserMemorySnapshot): string {
  const mistakes = memory.frequentMistakes.length > 0
    ? memory.frequentMistakes.join(', ')
    : 'none detected yet';

  const lastSession = memory.lastSessionSummary ?? 'first session';

  return `[Student Profile]
Level: ${memory.userLevel} | Goal: ${memory.goal}
Current Module: ${memory.currentModule}
Active Vocabulary: ${memory.recentWords.slice(0, 10).join(', ')}
Frequent Mistakes: ${mistakes}
Last Session: ${lastSession}`;
}

// ─── sentence.correct ───────────────────────────────────────────────────────

export interface SentenceCorrectResult {
  correctedText: string;
  explanation: string;
  matchedGrammarPattern: string | null;
  isCorrect: boolean;
}

export function buildSentenceCorrectPrompt(sentence: string, userMemory: UserMemorySnapshot): string {
  return `You are Nabih, a warm and encouraging personal English teacher.
${serializeMemory(userMemory)}

Task: Correct the student's English sentence below.

Student's sentence: "${sentence}"

Rules:
- If the sentence is already correct, set isCorrect to true and correctedText to the original.
- Keep your explanation simple and appropriate for ${userMemory.userLevel} level.
- If you detect a grammar pattern error, name it from common patterns (e.g. "Past Simple", "Subject-Verb Agreement", "Prepositions", "Articles").
- Keep explanation under 2 sentences.

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "correctedText": "the corrected sentence here",
  "explanation": "brief, encouraging explanation",
  "matchedGrammarPattern": "pattern name or null",
  "isCorrect": true or false
}`;
}

// ─── word.explain ───────────────────────────────────────────────────────────

export interface WordExplainResult {
  definition: string;
  arabicTranslation: string;
  examples: string[];
  tip: string | null;
}

export function buildWordExplainPrompt(word: string, userMemory: UserMemorySnapshot): string {
  return `You are Nabih, a warm personal English teacher for Arabic speakers.
${serializeMemory(userMemory)}

Task: Explain the word "${word}" to this student.

Rules:
- Definition must be simple, for ${userMemory.userLevel} level.
- Provide 2 example sentences using vocabulary no higher than ${userMemory.userLevel} level.
- Arabic translation should be short (1-3 words).
- Tip is optional — only include if there's something genuinely useful to remember.

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "definition": "simple definition in English",
  "arabicTranslation": "الترجمة العربية",
  "examples": ["example sentence 1", "example sentence 2"],
  "tip": "memory tip or null"
}`;
}

// ─── conversation.turn ──────────────────────────────────────────────────────

export interface ConversationTurnResult {
  reply: string;
  suggestedResponse: string | null;
}

export function buildConversationTurnPrompt(
  userMessage: string,
  history: ConversationMessage[],
  userMemory: UserMemorySnapshot
): string {
  const historyText = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Student' : 'Nabih'}: ${m.content}`)
    .join('\n');

  return `You are Nabih, a warm and patient personal English teacher.
${serializeMemory(userMemory)}

Goal: Practice English conversation with this student.

Rules:
- Respond in simple English appropriate for ${userMemory.userLevel} level.
- Keep your reply to 1-3 sentences maximum.
- Be warm, encouraging, and natural — not robotic.
- Do NOT use words above the student's level.
- If the student makes a grammar mistake, gently correct it in your reply naturally.
- Avoid the student's frequent mistakes: ${userMemory.frequentMistakes.join(', ') || 'none yet'}.
- Optionally suggest what the student could say next (in "suggestedResponse").

${historyText ? `Conversation so far:\n${historyText}\n` : ''}
Student: ${userMessage}

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "reply": "Nabih's reply here",
  "suggestedResponse": "a suggestion for what the student could say next, or null"
}`;
}

// ─── journal.dailyReport ────────────────────────────────────────────────────

export interface JournalReportResult {
  report: string;
}

export function buildJournalDailyReportPrompt(
  wordsLearnedToday: string[],
  mistakesMadeToday: string[],
  sentencesWritten: number,
  streakDays: number,
  userMemory: UserMemorySnapshot
): string {
  const wordsList = wordsLearnedToday.length > 0 ? wordsLearnedToday.join(', ') : 'no new words today';
  const mistakesList = mistakesMadeToday.length > 0 ? mistakesMadeToday.join(', ') : 'no major mistakes — great job';

  return `You are Nabih, a warm and encouraging personal English teacher writing in your student's daily learning journal.

${serializeMemory(userMemory)}

Today's learning summary:
- Words learned: ${wordsList}
- Mistakes made: ${mistakesList}
- Sentences written: ${sentencesWritten}
- Current streak: ${streakDays} day${streakDays !== 1 ? 's' : ''}

Write a short, personal daily report (3-5 sentences) as Nabih addressing the student directly.
Tone: warm, specific, encouraging — like a message from a caring teacher.
Include: what went well, one area to focus on, and a small encouragement.
Write in Arabic mixed with key English terms (the app audience is Arabic speakers learning English).
Keep it conversational and human — NOT robotic or generic.

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "report": "the complete report text here"
}`;
}

// ─── grammar.detect ─────────────────────────────────────────────────────────

export interface GrammarDetectResult {
  matchedPattern: string | null;
  description: string | null;
}

export function buildGrammarDetectPrompt(sentence: string, knownPatterns: string[]): string {
  const patternList = knownPatterns.map((p) => `- ${p}`).join('\n');

  return `You are a grammar error detector for an English learning app.

Task: Analyze the sentence below for grammar errors.

Sentence: "${sentence}"

Only check for errors from this EXACT list of patterns:
${patternList}

Rules:
- ONLY return a pattern from the list above. Do NOT invent new pattern names.
- If no error matches any pattern in the list, return null for both fields.
- Keep description under 1 sentence.

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "matchedPattern": "exact pattern name from the list, or null",
  "description": "brief description of the error, or null"
}`;
}

// ─── exercise.generate ──────────────────────────────────────────────────────

export interface GeneratedExercise {
  type: 'fill-blank' | 'multiple-choice' | 'translate' | 'reorder';
  question: string;
  options: string[] | null;
  answer: string;
}

export interface ExerciseGenerateResult {
  exercises: GeneratedExercise[];
}

export function buildExerciseGeneratePrompt(
  moduleTitle: string,
  targetWords: string[],
  grammarFocus: string | null,
  userMemory: UserMemorySnapshot
): string {
  return `You are Nabih, a personal English teacher creating practice exercises.
${serializeMemory(userMemory)}

Module: "${moduleTitle}"
Target vocabulary: ${targetWords.join(', ')}
${grammarFocus ? `Grammar focus: ${grammarFocus}` : 'No specific grammar focus'}

Generate 4 exercises for this student at ${userMemory.userLevel} level.
Mix exercise types: fill-blank, multiple-choice, translate (Arabic→English), reorder.
Use only the target vocabulary listed above.
Keep questions simple and directly useful for the module topic.

For "multiple-choice": provide exactly 4 options in the options array.
For "fill-blank": use ___ as the blank. Options should be null.
For "translate": the question is in Arabic. Options should be null.
For "reorder": the question contains shuffled words. Options should be null.

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "exercises": [
    {
      "type": "fill-blank",
      "question": "I have a ___ at 3pm.",
      "options": null,
      "answer": "meeting"
    }
  ]
}`;
}

// ─── exam.evaluate ──────────────────────────────────────────────────────────

export interface ExamEvaluateResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  feedback: string;
}

export function buildExamEvaluatePrompt(
  evaluationType: 'writing' | 'conversation',
  content: string,
  criteria: string,
  userMemory: UserMemorySnapshot
): string {
  const typeLabel = evaluationType === 'writing' ? 'writing sample' : 'conversation transcript';

  return `You are Nabih, evaluating a student's English ${typeLabel} for their ${userMemory.userLevel} level exam.

${serializeMemory(userMemory)}

Evaluation criteria for ${userMemory.userLevel}:
${criteria}

Student's ${typeLabel}:
"""
${content}
"""

Evaluate fairly and encouragingly. The score is out of 100.
Provide 2-3 specific strengths and 2-3 specific areas for improvement.
Feedback should be warm and actionable (2-3 sentences).

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "score": 75,
  "strengths": ["Good use of greeting phrases", "Clear sentence structure"],
  "weaknesses": ["Article usage needs work", "Past tense inconsistency"],
  "feedback": "Encouraging, specific feedback here."
}`;
}
