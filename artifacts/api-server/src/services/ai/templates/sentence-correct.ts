import { serializeMemory, type UserMemorySnapshot } from "../memory.js";

export interface SentenceCorrectResult {
  correctedText: string;
  explanation: string;
  matchedGrammarPattern: string | null;
  isCorrect: boolean;
}

export function buildSentenceCorrectPrompt(
  sentence: string,
  userMemory: UserMemorySnapshot
): string {
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
