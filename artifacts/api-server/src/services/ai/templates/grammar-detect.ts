export interface GrammarDetectResult {
  matchedPattern: string | null;
  description: string | null;
}

export function buildGrammarDetectPrompt(
  sentence: string,
  knownPatterns: string[]
): string {
  const patternList = knownPatterns.map((p) => `- ${p}`).join("\n");

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
