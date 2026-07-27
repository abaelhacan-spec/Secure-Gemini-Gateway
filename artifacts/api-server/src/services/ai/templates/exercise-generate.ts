import { serializeMemory, type UserMemorySnapshot } from "../memory.js";

export interface GeneratedExercise {
  type: "fill-blank" | "multiple-choice" | "translate" | "reorder";
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
Target vocabulary: ${targetWords.join(", ")}
${grammarFocus ? `Grammar focus: ${grammarFocus}` : "No specific grammar focus"}

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
