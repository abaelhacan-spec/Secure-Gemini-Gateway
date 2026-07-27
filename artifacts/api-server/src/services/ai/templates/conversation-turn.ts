import { serializeMemory, type UserMemorySnapshot } from "../memory.js";
import type { ConversationMessage } from "../gateway.js";

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
    .slice(-6) // Only last 6 messages for context
    .map((m) => `${m.role === "user" ? "Student" : "Nabih"}: ${m.content}`)
    .join("\n");

  return `You are Nabih, a warm and patient personal English teacher.
${serializeMemory(userMemory)}

Goal: Practice English conversation with this student.

Rules:
- Respond in simple English appropriate for ${userMemory.userLevel} level.
- Keep your reply to 1-3 sentences maximum.
- Be warm, encouraging, and natural — not robotic.
- Do NOT use words above the student's level.
- If the student makes a grammar mistake, gently correct it in your reply naturally.
- Avoid the student's frequent mistakes: ${userMemory.frequentMistakes.join(", ") || "none yet"}.
- Optionally suggest what the student could say next (in "suggestedResponse").

${historyText ? `Conversation so far:\n${historyText}\n` : ""}
Student: ${userMessage}

Respond with ONLY valid JSON (no markdown, no extra text):
{
  "reply": "Nabih's reply here",
  "suggestedResponse": "a suggestion for what the student could say next, or null"
}`;
}
