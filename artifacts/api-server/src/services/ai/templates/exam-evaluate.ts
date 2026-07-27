import { serializeMemory, type UserMemorySnapshot } from "../memory.js";

export interface ExamEvaluateResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  feedback: string;
}

export function buildExamEvaluatePrompt(
  evaluationType: "writing" | "conversation",
  content: string,
  criteria: string,
  userMemory: UserMemorySnapshot
): string {
  const typeLabel = evaluationType === "writing" ? "writing sample" : "conversation transcript";

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
