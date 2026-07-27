import { serializeMemory, type UserMemorySnapshot } from "../memory.js";

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
  const wordsList = wordsLearnedToday.length > 0
    ? wordsLearnedToday.join(", ")
    : "no new words today";

  const mistakesList = mistakesMadeToday.length > 0
    ? mistakesMadeToday.join(", ")
    : "no major mistakes — great job";

  return `You are Nabih, a warm and encouraging personal English teacher writing in your student's daily learning journal.

${serializeMemory(userMemory)}

Today's learning summary:
- Words learned: ${wordsList}
- Mistakes made: ${mistakesList}
- Sentences written: ${sentencesWritten}
- Current streak: ${streakDays} day${streakDays !== 1 ? "s" : ""}

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
