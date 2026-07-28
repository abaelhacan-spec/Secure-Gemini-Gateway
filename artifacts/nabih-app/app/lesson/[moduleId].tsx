import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, PanResponder,
  useColorScheme, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { getModuleById, type SeedWord } from '@/src/db/seed';
import { getDb, updateWordStage, upsertTodayJournal, getTodayJournal } from '@/src/db/database';
import { useApp } from '@/src/context/AppContext';
import { useAiWordExplain, useAiGrammarDetect } from '@workspace/api-client-react';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;

export default function LessonScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
  const { buildMemorySnapshot, updateStreak } = useApp();

  const module = getModuleById(moduleId ?? '');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'word' | 'reveal' | 'complete'>('word');
  const [explanation, setExplanation] = useState<{ definition: string; arabicTranslation: string; examples: string[]; tip: string | null } | null>(null);
  const [learnedToday, setLearnedToday] = useState<string[]>([]);

  const wordMutation = useAiWordExplain();

  const flipAnim = useRef(new Animated.Value(0)).current;
  const swipeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (module) {
      ensureWordsInDb(module.words);
    }
    updateStreak();
  }, []);

  const ensureWordsInDb = async (words: SeedWord[]) => {
    const db = getDb();
    for (const w of words) {
      await db.runAsync(
        `INSERT OR IGNORE INTO words (id, word, arabic_translation, definition, module_id, lifecycle_stage, created_at)
         VALUES (?, ?, ?, ?, ?, 'new', datetime('now'))`,
        [w.id, w.word, w.arabicTranslation, w.definition, moduleId ?? '']
      );
    }
  };

  const currentWord = module?.words[currentIndex];

  const handleReveal = useCallback(async () => {
    if (phase !== 'word' || !currentWord) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Flip animation
    Animated.timing(flipAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    setPhase('reveal');

    // Fetch AI explanation
    try {
      const memory = await buildMemorySnapshot();
      const result = await wordMutation.mutateAsync({
        data: { word: currentWord.word, userMemory: memory },
      });
      setExplanation(result);
    } catch {
      // Fallback to seed data
      setExplanation({
        definition: currentWord.definition,
        arabicTranslation: currentWord.arabicTranslation,
        examples: [`I use "${currentWord.word}" every day.`, `Can you help me with the ${currentWord.word}?`],
        tip: null,
      });
    }
  }, [phase, currentWord, buildMemorySnapshot]);

  const handleKnew = useCallback(async () => {
    if (!currentWord) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateWordStage(currentWord.id, 'learned');
    advanceWord(true);
  }, [currentWord]);

  const handleLearn = useCallback(async () => {
    if (!currentWord) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await updateWordStage(currentWord.id, 'learned');
    advanceWord(true);
  }, [currentWord]);

  const advanceWord = useCallback(async (learned: boolean) => {
    if (!module || !currentWord) return;

    const newLearned = learned ? [...learnedToday, currentWord.word] : learnedToday;
    setLearnedToday(newLearned);

    // Update journal
    const journal = await getTodayJournal();
    await upsertTodayJournal({
      wordsLearned: Array.from(new Set([...(journal?.wordsLearned ?? []), ...newLearned])),
    });

    // Reset for next word
    flipAnim.setValue(0);
    setExplanation(null);
    setPhase('word');

    if (currentIndex + 1 >= module.words.length) {
      setPhase('complete');
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [module, currentWord, learnedToday, currentIndex]);

  if (!module) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>الوحدة غير موجودة</Text>
      </View>
    );
  }

  if (phase === 'complete') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.completeWrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
          <Text style={{ fontSize: 64 }}>🎉</Text>
          <Text style={[styles.completeTitle, { color: theme.text }]}>أحسنت!</Text>
          <Text style={[styles.completeSub, { color: theme.textSecondary }]}>
            أنهيت وحدة "{module.titleAr}"{'\n'}
            تعلّمت {learnedToday.length} كلمة جديدة اليوم
          </Text>
          <View style={[styles.completeWords, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {learnedToday.map((w) => (
              <View key={w} style={[styles.wordTag, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.wordTagText, { color: theme.primary }]}>{w}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={[styles.doneBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneBtnText}>العودة للرئيسية</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const flipStyle = {
    transform: [{
      rotateY: flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
    }],
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.moduleTitle, { color: theme.text }]}>{module.titleAr}</Text>
          <Text style={[styles.progress, { color: theme.textSecondary }]}>
            {currentIndex + 1} / {module.words.length}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${((currentIndex) / module.words.length) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
        {/* Word card */}
        <Pressable onPress={handleReveal} style={styles.cardContainer}>
          <Animated.View style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
            phase === 'word' ? {} : flipStyle,
          ]}>
            {phase === 'word' ? (
              <View style={styles.cardFront}>
                <Text style={[styles.wordText, { color: theme.text }]}>{currentWord?.word}</Text>
                <Text style={[styles.tapHint, { color: theme.muted }]}>اضغط لرؤية المعنى</Text>
                <View style={[styles.tapIcon, { borderColor: theme.border }]}>
                  <Feather name="eye" size={20} color={theme.primary} />
                </View>
              </View>
            ) : (
              <View style={styles.cardBack}>
                {wordMutation.isPending ? (
                  <ActivityIndicator size="large" color={theme.primary} />
                ) : explanation ? (
                  <>
                    <Text style={[styles.wordBack, { color: theme.text }]}>{currentWord?.word}</Text>
                    <Text style={[styles.arabicTrans, { color: theme.primary }]}>{explanation.arabicTranslation}</Text>
                    <Text style={[styles.definition, { color: theme.textSecondary }]}>{explanation.definition}</Text>
                    {explanation.examples.slice(0, 2).map((ex, i) => (
                      <View key={i} style={[styles.exampleRow, { borderLeftColor: theme.primary }]}>
                        <Text style={[styles.exampleText, { color: theme.text }]}>"{ex}"</Text>
                      </View>
                    ))}
                    {explanation.tip && (
                      <View style={[styles.tipBox, { backgroundColor: theme.primarySoft }]}>
                        <Text style={[styles.tipText, { color: theme.primary }]}>💡 {explanation.tip}</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <ActivityIndicator size="large" color={theme.primary} />
                )}
              </View>
            )}
          </Animated.View>
        </Pressable>

        {/* Action buttons */}
        {phase === 'reveal' && !wordMutation.isPending && (
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn, styles.actionBtnLearn,
                { backgroundColor: theme.dangerSoft, borderColor: theme.danger, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleLearn}
            >
              <Feather name="refresh-cw" size={20} color={theme.danger} />
              <Text style={[styles.actionBtnText, { color: theme.danger }]}>سأراجعها</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn, styles.actionBtnKnew,
                { backgroundColor: theme.successSoft, borderColor: theme.success, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleKnew}
            >
              <Feather name="check" size={20} color={theme.success} />
              <Text style={[styles.actionBtnText, { color: theme.success }]}>أعرفها ✓</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  moduleTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  progress: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  progressBar: { height: 3 },
  progressFill: { height: '100%' },
  scroll: { paddingHorizontal: 24, paddingTop: 32, gap: 24 },
  cardContainer: { alignItems: 'center' },
  card: {
    width: CARD_WIDTH, minHeight: 280, borderRadius: 20,
    borderWidth: 1, padding: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  cardFront: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  wordText: { fontSize: 44, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  tapHint: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  tapIcon: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBack: { gap: 14 },
  wordBack: { fontSize: 28, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  arabicTrans: { fontSize: 22, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  definition: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'right', lineHeight: 22 },
  exampleRow: { borderLeftWidth: 3, paddingLeft: 12 },
  exampleText: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 20 },
  tipBox: { padding: 12, borderRadius: colors.radius },
  tipText: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: colors.radius, borderWidth: 1.5,
  },
  actionBtnLearn: {},
  actionBtnKnew: {},
  actionBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  errorText: { textAlign: 'center', marginTop: 100, fontSize: 16 },
  completeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 },
  completeTitle: { fontSize: 36, fontFamily: 'Inter_700Bold' },
  completeSub: { fontSize: 16, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 26 },
  completeWords: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
    borderWidth: 1, borderRadius: colors.radius, padding: 16,
  },
  wordTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  wordTagText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  doneBtn: {
    paddingVertical: 16, paddingHorizontal: 48, borderRadius: colors.radius,
  },
  doneBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
