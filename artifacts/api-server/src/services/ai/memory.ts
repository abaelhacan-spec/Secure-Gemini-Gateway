/**
 * UserMemorySnapshot — the compressed user context passed to every AI call.
 *
 * This is built by the Expo app from local SQLite data and sent with each
 * AI request. Maximum ~500 tokens. The backend never stores user data.
 */
export interface UserMemorySnapshot {
  userLevel: string;          // e.g. "A1", "A2", "B1"
  goal: string;               // e.g. "Work English", "Travel"
  recentWords: string[];      // Last 20 active vocabulary words
  frequentMistakes: string[]; // Recurring grammar patterns (occurrences >= 2)
  currentModule: string;      // Active module name
  lastSessionSummary: string | null; // Brief summary of last session
}

/**
 * Serialize UserMemorySnapshot to a compact string for prompt injection.
 * Keeps token count low while preserving all relevant context.
 */
export function serializeMemory(memory: UserMemorySnapshot): string {
  const mistakes = memory.frequentMistakes.length > 0
    ? memory.frequentMistakes.join(", ")
    : "none detected yet";

  const lastSession = memory.lastSessionSummary ?? "first session";

  return `[Student Profile]
Level: ${memory.userLevel} | Goal: ${memory.goal}
Current Module: ${memory.currentModule}
Active Vocabulary: ${memory.recentWords.slice(0, 10).join(", ")}
Frequent Mistakes: ${mistakes}
Last Session: ${lastSession}`;
}
