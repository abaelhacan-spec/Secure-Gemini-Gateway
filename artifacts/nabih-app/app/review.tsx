import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, useColorScheme, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { getDueReviewWords, recordWordReview, type Word } from '@/src/db/database';
import { buildPracticeSet, checkAnswer, type PracticeExercise } from '@/src/db/practiceExercises';

/**
 * A short spaced-repetition review session: one quick recall exercise per
 * due word (built the same way as the daily lesson's Practice stage — no
 * AI calls needed, since these words already have cached explanations).
 * On completion, updates each word's next review date (1 → 3 → 7 → 14 → 30
 * days, or back to day 1 on a miss).
 */
export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<PracticeExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [masteredCount, setMasteredCount] = useState(0);
  const [dueWords, setDueWords] = useState<Word[]>([]);

  useEffect(() => {
    async function load() {
      const words = await getDueReviewWords(30);
      setDueWords(words);
      setExercises(buildPracticeSet(words));
      setLoading(false);
    }
    load();
  }, []);

  const current = exercises[index];

  const advance = useCallback(async (wordId: string, correct: boolean) => {
    const result = await recordWordReview(wordId, correct ? 'correct' : 'incorrect');
    if (result.lifecycleStage === 'mastered') setMasteredCount((c) => c + 1);
    setSelected(null);
    setFeedback(null);
    setIndex((i) => i + 1);
  }, []);

  const submitChoice = useCallback((choice: string) => {
    if (feedback || !current) return;
    setSelected(choice);
    const isCorrect = checkAnswer(current, choice);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    Haptics.notificationAsync(isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    setTimeout(() => advance(current.wordId, isCorrect), 900);
  }, [current, feedback, advance]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (dueWords.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.completeWrap}>
          <Text style={{ fontSize: 56 }}>✅</Text>
          <Text style={[styles.completeTitle, { color: theme.text }]}>لا توجد مراجعات مستحقة الآن</Text>
          <Text style={[styles.completeSub, { color: theme.textSecondary }]}>
            عد لاحقًا عندما تصبح إحدى كلماتك مستحقة للمراجعة
          </Text>
          <Pressable style={[styles.nextBtn, { backgroundColor: theme.primary }]} onPress={() => router.back()}>
            <Text style={styles.nextBtnText}>العودة للرئيسية</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (index >= exercises.length) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.completeWrap}>
          <Text style={{ fontSize: 56 }}>🎉</Text>
          <Text style={[styles.completeTitle, { color: theme.text }]}>أحسنت في المراجعة!</Text>
          <Text style={[styles.completeSub, { color: theme.textSecondary }]}>
            راجعت {exercises.length} كلمة{masteredCount > 0 ? `\nأتقنت ${masteredCount} كلمة بالكامل 🏆` : ''}
          </Text>
          <Pressable style={[styles.nextBtn, { backgroundColor: theme.primary }]} onPress={() => router.back()}>
            <Text style={styles.nextBtnText}>العودة للرئيسية</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>مراجعة اليوم</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.stageCounter, { color: theme.textSecondary }]}>{index + 1} / {exercises.length}</Text>

        {current && (
          <View style={[styles.exerciseCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.exercisePrompt, { color: theme.text }]}>{current.prompt}</Text>

            {current.options ? (
              <View style={styles.optionsWrap}>
                {current.options.map((opt) => {
                  const isSelected = selected === opt;
                  const isCorrectOpt = feedback && opt === current.correctAnswer;
                  const isWrongSelected = feedback === 'incorrect' && isSelected;
                  return (
                    <Pressable
                      key={opt}
                      disabled={!!feedback}
                      onPress={() => submitChoice(opt)}
                      style={[
                        styles.optionBtn,
                        {
                          backgroundColor: isCorrectOpt ? theme.successSoft : isWrongSelected ? theme.dangerSoft : theme.background,
                          borderColor: isCorrectOpt ? theme.success : isWrongSelected ? theme.danger : theme.border,
                        },
                      ]}
                    >
                      <Text style={{ color: isCorrectOpt ? theme.success : isWrongSelected ? theme.danger : theme.text, fontFamily: 'Inter_600SemiBold' }}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              // fill-blank / reorder fallbacks inside a review session: treat as
              // a simple reveal-and-self-grade card to keep reviews quick.
              <View style={{ gap: 12, alignItems: 'center' }}>
                {feedback ? (
                  <Text style={{ color: theme.primary, fontSize: 18, fontFamily: 'Inter_700Bold' }}>{current.correctAnswer}</Text>
                ) : (
                  <Pressable style={[styles.checkBtn, { backgroundColor: theme.primarySoft }]} onPress={() => setFeedback('correct')}>
                    <Text style={{ color: theme.primary, fontFamily: 'Inter_600SemiBold' }}>اضغط لكشف الإجابة</Text>
                  </Pressable>
                )}
                {feedback && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable style={[styles.checkBtn, { backgroundColor: theme.dangerSoft }]} onPress={() => advance(current.wordId, false)}>
                      <Text style={{ color: theme.danger, fontFamily: 'Inter_600SemiBold' }}>لم أكن أعرفها</Text>
                    </Pressable>
                    <Pressable style={[styles.checkBtn, { backgroundColor: theme.successSoft }]} onPress={() => advance(current.wordId, true)}>
                      <Text style={{ color: theme.success, fontFamily: 'Inter_600SemiBold' }}>كنت أعرفها</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  scroll: { paddingHorizontal: 24, paddingTop: 16, gap: 20 },
  stageCounter: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  exerciseCard: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 18 },
  exercisePrompt: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center', lineHeight: 30 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  optionBtn: { borderWidth: 1.5, borderRadius: colors.radius, paddingHorizontal: 16, paddingVertical: 12, minWidth: '45%', alignItems: 'center' },
  checkBtn: { borderRadius: colors.radius, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  completeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 },
  completeTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  completeSub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 24 },
  nextBtn: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: colors.radius },
  nextBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
