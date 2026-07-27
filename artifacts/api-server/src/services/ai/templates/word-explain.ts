import { serializeMemory, type UserMemorySnapshot } from "../memory.js";

export interface WordExplainResult {
  definition: string;
  arabicTranslation: string;
  examples: string[];
  tip: string | null;
}

export function buildWordExplainPrompt(
  word: string,
  userMemory: UserMemorySnapshot
): string {
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
