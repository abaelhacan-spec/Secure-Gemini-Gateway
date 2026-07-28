/**
 * AppContext — shared application state for Nabih.
 * Manages user profile, current module, and builds UserMemorySnapshot for AI calls.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initDatabase,
  getUserProfile,
  updateUserProfile,
  getMistakePatterns,
  getWords,
  getTodayJournal,
  upsertTodayJournal,
  type UserProfile,
} from '../db/database';
import { CURRICULUM, type Module } from '../db/seed';
import type { UserMemorySnapshot } from '@/lib/ai/prompts';

const CURRENT_MODULE_KEY = '@nabih/currentModuleId';
const TODAY_WORDS_KEY = '@nabih/todayWords';

interface AppState {
  isReady: boolean;
  userProfile: UserProfile | null;
  currentModule: Module | null;
  streakDays: number;
  todayWordCount: number;
  isOnboarded: boolean;

  // Actions
  completeOnboarding: (goal: string) => Promise<void>;
  setCurrentModule: (moduleId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  buildMemorySnapshot: () => Promise<UserMemorySnapshot>;
  recordSentenceWritten: () => Promise<void>;
  updateStreak: () => Promise<void>;
}

const AppContext = createContext<AppState>({
  isReady: false,
  userProfile: null,
  currentModule: null,
  streakDays: 0,
  todayWordCount: 0,
  isOnboarded: false,
  completeOnboarding: async () => {},
  setCurrentModule: async () => {},
  refreshProfile: async () => {},
  buildMemorySnapshot: async () => ({
    userLevel: 'A0', goal: 'general', recentWords: [],
    frequentMistakes: [], currentModule: 'Greetings', lastSessionSummary: null,
  }),
  recordSentenceWritten: async () => {},
  updateStreak: async () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentModule, setCurrentModuleState] = useState<Module | null>(null);
  const [todayWordCount, setTodayWordCount] = useState(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initialize();
  }, []);

  async function initialize() {
    try {
      await initDatabase();
      const profile = await getUserProfile();
      setUserProfile(profile);

      // Load current module
      const moduleId = await AsyncStorage.getItem(CURRENT_MODULE_KEY);
      const module = CURRICULUM.find((m) => m.id === moduleId) ?? CURRICULUM[0] ?? null;
      setCurrentModuleState(module);

      // Load today word count
      const today = new Date().toISOString().split('T')[0];
      const journalEntry = await getTodayJournal();
      setTodayWordCount(journalEntry?.wordsLearned.length ?? 0);

      // Update streak
      if (profile?.lastSessionDate) {
        const lastDate = new Date(profile.lastSessionDate);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 1) {
          await updateUserProfile({ streakDays: 0 });
        }
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
    } finally {
      setIsReady(true);
    }
  }

  const refreshProfile = useCallback(async () => {
    const profile = await getUserProfile();
    setUserProfile(profile);
  }, []);

  const completeOnboarding = useCallback(async (goal: string) => {
    await updateUserProfile({
      goal,
      onboardingCompleted: true,
      lastSessionDate: new Date().toISOString(),
    });
    await AsyncStorage.setItem(CURRENT_MODULE_KEY, CURRICULUM[0]?.id ?? '');
    setCurrentModuleState(CURRICULUM[0] ?? null);
    await refreshProfile();
  }, [refreshProfile]);

  const setCurrentModule = useCallback(async (moduleId: string) => {
    await AsyncStorage.setItem(CURRENT_MODULE_KEY, moduleId);
    const module = CURRICULUM.find((m) => m.id === moduleId) ?? null;
    setCurrentModuleState(module);
  }, []);

  const buildMemorySnapshot = useCallback(async (): Promise<UserMemorySnapshot> => {
    const profile = await getUserProfile();
    const words = await getWords();
    const mistakes = await getMistakePatterns(true);
    const journal = await getTodayJournal();

    const recentWords = words
      .filter((w) => w.lifecycleStage !== 'new')
      .slice(0, 20)
      .map((w) => w.word);

    const frequentMistakes = mistakes
      .filter((m) => m.occurrences >= 2)
      .map((m) => m.patternName);

    return {
      userLevel: profile?.level ?? 'A0',
      goal: profile?.goal ?? 'general',
      recentWords,
      frequentMistakes,
      currentModule: currentModule?.title ?? 'Greetings',
      lastSessionSummary: journal?.aiReport ?? null,
    };
  }, [currentModule]);

  const recordSentenceWritten = useCallback(async () => {
    const journal = await getTodayJournal();
    await upsertTodayJournal({
      sentencesWritten: (journal?.sentencesWritten ?? 0) + 1,
    });
  }, []);

  const updateStreak = useCallback(async () => {
    const profile = await getUserProfile();
    const today = new Date().toISOString().split('T')[0];

    if (profile?.lastSessionDate === today) return;

    const newStreak = profile?.lastSessionDate
      ? (() => {
          const last = new Date(profile.lastSessionDate!);
          const now = new Date();
          const diff = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
          return diff === 1 ? (profile.streakDays + 1) : 1;
        })()
      : 1;

    await updateUserProfile({
      streakDays: newStreak,
      lastSessionDate: today,
    });
    await refreshProfile();
  }, [refreshProfile]);

  return (
    <AppContext.Provider
      value={{
        isReady,
        userProfile,
        currentModule,
        streakDays: userProfile?.streakDays ?? 0,
        todayWordCount,
        isOnboarded: userProfile?.onboardingCompleted ?? false,
        completeOnboarding,
        setCurrentModule,
        refreshProfile,
        buildMemorySnapshot,
        recordSentenceWritten,
        updateStreak,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
