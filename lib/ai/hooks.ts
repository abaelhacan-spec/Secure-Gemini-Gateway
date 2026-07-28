/**
 * Drop-in replacements for the old @workspace/api-client-react useAi* hooks.
 * Same names, same `.mutateAsync({ data: {...} })` call shape, same result
 * shape — but calling Gemini directly instead of going through a backend.
 */
import { useMutation } from '@tanstack/react-query';
import * as gateway from './geminiClient';
import type {
  UserMemorySnapshot,
  ConversationMessage,
  SentenceCorrectResult,
  WordExplainResult,
  ConversationTurnResult,
  JournalReportResult,
  GrammarDetectResult,
  ExerciseGenerateResult,
  ExamEvaluateResult,
} from './prompts';

export function useAiSentenceCorrect() {
  return useMutation({
    mutationFn: async ({ data }: { data: { sentence: string; userMemory: UserMemorySnapshot } }): Promise<SentenceCorrectResult> =>
      gateway.correctSentence(data.sentence, data.userMemory),
  });
}

export function useAiWordExplain() {
  return useMutation({
    mutationFn: async ({ data }: { data: { word: string; userMemory: UserMemorySnapshot } }): Promise<WordExplainResult> =>
      gateway.explainWord(data.word, data.userMemory),
  });
}

export function useAiConversationTurn() {
  return useMutation({
    mutationFn: async ({ data }: {
      data: { userMessage: string; conversationHistory: ConversationMessage[]; userMemory: UserMemorySnapshot };
    }): Promise<ConversationTurnResult> =>
      gateway.conversationTurn(data.userMessage, data.conversationHistory, data.userMemory),
  });
}

export function useAiJournalDailyReport() {
  return useMutation({
    mutationFn: async ({ data }: {
      data: {
        wordsLearnedToday: string[];
        mistakesMadeToday: string[];
        sentencesWritten: number;
        streakDays: number;
        userMemory: UserMemorySnapshot;
      };
    }): Promise<JournalReportResult> =>
      gateway.generateDailyReport(
        data.wordsLearnedToday, data.mistakesMadeToday, data.sentencesWritten, data.streakDays, data.userMemory
      ),
  });
}

export function useAiGrammarDetect() {
  return useMutation({
    mutationFn: async ({ data }: { data: { sentence: string; knownPatterns: string[] } }): Promise<GrammarDetectResult> =>
      gateway.detectGrammarPattern(data.sentence, data.knownPatterns),
  });
}

export function useAiExerciseGenerate() {
  return useMutation({
    mutationFn: async ({ data }: {
      data: { moduleTitle: string; targetWords: string[]; grammarFocus: string | null; userMemory: UserMemorySnapshot };
    }): Promise<ExerciseGenerateResult> =>
      gateway.generateExercises(data.moduleTitle, data.targetWords, data.grammarFocus, data.userMemory),
  });
}

export function useAiExamEvaluate() {
  return useMutation({
    mutationFn: async ({ data }: {
      data: { evaluationType: 'writing' | 'conversation'; content: string; criteria: string; userMemory: UserMemorySnapshot };
    }): Promise<ExamEvaluateResult> =>
      gateway.evaluateExam(data.evaluationType, data.content, data.criteria, data.userMemory),
  });
}

export type { UserMemorySnapshot, ConversationMessage } from './prompts';
