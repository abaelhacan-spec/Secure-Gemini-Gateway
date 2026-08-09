import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  useColorScheme, Dimensions, ScrollView, ActivityIndicator, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { getModuleById, type SeedWord, type Module } from '@/src/db/seed';
import { getDailyModule, DAILY_MODULE_ID } from '@/src/db/dailyWords';
import {
  getDb, getWordsByIds, saveWordExplanation, completeInitialLearning,
  recordWordUsedInSentence, upsertTodayJournal, getTodayJournal,
  type Word,
} from '@/src/db/database';
import {
  buildPracticeSet, wordsNeedingAiFallback, checkAnswer,
  type PracticeExercise,
} from '@/src/db/practiceExercises';
import { useApp } from '@/src/context/AppContext';
import { useAiWordExplain, useAiSentenceCorrect, useAiExerciseGenerate } from '@/lib/ai/hooks';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;
const MIN_SENTENCES = 3;
const MAX_SENTENCES = 4;

type Stage = 'learn' | 'practice' | 'writing' | 'complete';

interface Explanation {
  definition: string;
  arabicTranslation: string;
  pronunciation: string;
  examples: string[];
  tip: string | null;
}

interface SentenceResult {
  sentence: string;
  correctedText: string;
  explanation: string;
  isCorrect: boolean;
}

export default function LessonScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
  const { buildMemorySnapshot, updateStreak } = useApp();

  const isDaily = moduleId === DAILY_MODULE_ID;
  const [module, setModule] = useState<Module | null | undefined>(
    isDaily ? undefined : getModuleById(moduleId ?? '')
  );
  const [stage, setStage] = useState<Stage>('learn');

  useEffect(() => {
    let cancelled = false;
    async function loadModule() {
      const resolved = isDaily ? await getDailyModule() : getModuleById(moduleId ?? '');
      if (cancelled) return;
      setModule(resolved ?? null);
      if (resolved) ensureWordsInDb(resolved.words, moduleId ?? '');
    }
    loadModule();
    updateStreak();
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  if (module === undefined) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }
  if (!module) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.text }]}>الوحدة غير موجودة</Text>
      </View>
    );
  }

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
            {stageLabel(stage)}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Stage indicator */}
      <View style={styles.stagesRow}>
        {(['learn', 'practice', 'writing'] as Stage[]).map((s, i) => (
          <View key={s} style={styles.stageStepWrap}>
            <View style={[
              styles.stageDot,
              {
                backgroundColor: stage === s ? theme.primary : stageDone(stage, s) ? theme.success : theme.border,
              },
            ]} />
            {i < 2 && <View style={[styles.stageLine, { backgroundColor: stageDone(stage, (['learn', 'practice', 'writing'] as Stage[])[i + 1]) || stage === (['learn', 'practice', 'writing'] as Stage[])[i + 1] ? theme.success : theme.border }]} />}
          </View>
        ))}
      </View>

      {stage === 'learn' && (
        <LearnStage
          theme={theme}
          module={module}
          insets={insets}
          onDone={() => setStage('practice')}
        />
      )}
      {stage === 'practice' && (
        <PracticeStage
          theme={theme}
          module={module}
          insets={insets}
          buildMemorySnapshot={buildMemorySnapshot}
          onDone={() => setStage('writing')}
        />
      )}
      {stage === 'writing' && (
        <WritingStage
          theme={theme}
          module={module}
          insets={insets}
          buildMemorySnapshot={buildMemorySnapshot}
          onDone={() => setStage('complete')}
        />
      )}
      {stage === 'complete' && (
        <CompleteStage theme={theme} module={module} insets={insets} />
      )}
    </View>
  );
}

function stageLabel(stage: Stage): string {
  switch (stage) {
    case 'learn': return 'التعلّم';
    case 'practice': return 'التدريب';
    case 'writing': return 'الكتابة';
    case 'complete': return 'اكتمل الدرس';
  }
}

function stageDone(current: Stage, check: Stage): boolean {
  const order: Stage[] = ['learn', 'practice', 'writing', 'complete'];
  return order.indexOf(current) > order.indexOf(check);
}

async function ensureWordsInDb(words: SeedWord[], moduleId: string) {
  const db = getDb();
  for (const w of words) {
    await db.runAsync(
      `INSERT OR IGNORE INTO words (id, word, arabic_translation, definition, module_id, lifecycle_stage, created_at)
       VALUES (?, ?, ?, ?, ?, 'new', datetime('now'))`,
      [w.id, w.word, w.arabicTranslation, w.definition, moduleId]
    );
  }
}

// ─── Stage 1: Learn ───────────────────────────────────────────────────────────

function LearnStage({
  theme, module, insets, onDone,
}: {
  theme: any; module: Module; insets: any; onDone: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'word' | 'reveal'>('word');
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const { buildMemorySnapshot } = useApp();
  const wordMutation = useAiWordExplain();
  const flipAnim = useRef(new Animated.Value(0)).current;
  const currentWord = module.words[currentIndex];

  const handleReveal = useCallback(async () => {
    if (phase !== 'word' || !currentWord) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(flipAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    setPhase('reveal');

    try {
      const memory = await buildMemorySnapshot();
      const result = await wordMutation.mutateAsync({ data: { word: currentWord.word, userMemory: memory } });
      setExplanation(result);
      // Cache it so the Practice stage can build exercises locally, without another AI call.
      await saveWordExplanation(currentWord.id, result);
    } catch {
      setExplanation({
        definition: currentWord.definition,
        arabicTranslation: currentWord.arabicTranslation,
        pronunciation: '',
        examples: [`I use "${currentWord.word}" every day.`, `Can you help me with the ${currentWord.word}?`],
        tip: null,
      });
    }
  }, [phase, currentWord, buildMemorySnapshot]);

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flipAnim.setValue(0);
    setExplanation(null);
    setPhase('word');
    if (currentIndex + 1 >= module.words.length) {
      onDone();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, module.words.length, onDone]);

  const flipStyle = {
    transform: [{ rotateY: flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
  };

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stageCounter, { color: theme.textSecondary }]}>
        كلمة {currentIndex + 1} من {module.words.length}
      </Text>
      <Pressable onPress={handleReveal} style={styles.cardContainer}>
        <Animated.View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, phase === 'word' ? {} : flipStyle]}>
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
                  {!!explanation.pronunciation && (
                    <View style={[styles.pronunciationBadge, { backgroundColor: theme.primarySoft }]}>
                      <Feather name="volume-2" size={14} color={theme.primary} />
                      <Text style={[styles.pronunciationText, { color: theme.primary }]}>{explanation.pronunciation}</Text>
                    </View>
                  )}
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

      {phase === 'reveal' && !wordMutation.isPending && explanation && (
        <Pressable
          style={({ pressed }) => [styles.nextBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 }]}
          onPress={handleNext}
        >
          <Text style={styles.nextBtnText}>
            {currentIndex + 1 >= module.words.length ? 'ابدأ التدريب' : 'التالي'}
          </Text>
          <Feather name="arrow-left" size={18} color="#FFFFFF" />
        </Pressable>
      )}
    </ScrollView>
  );
}

// ─── Stage 2: Practice ─────────────────────────────────────────────────────────

function PracticeStage({
  theme, module, insets, buildMemorySnapshot, onDone,
}: {
  theme: any; module: Module; insets: any;
  buildMemorySnapshot: () => Promise<any>; onDone: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<PracticeExercise[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [reorderTokens, setReorderTokens] = useState<string[]>([]);
  const [reorderPicked, setReorderPicked] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const exerciseGenMutation = useAiExerciseGenerate();

  useEffect(() => {
    let cancelled = false;
    async function build() {
      setLoading(true);
      const dbWords = await getWordsByIds(module.words.map((w) => w.id));
      let set = buildPracticeSet(dbWords);

      // Only fall back to Gemini for the few words that couldn't get a
      // locally-built exercise (e.g. Learn stage failed offline).
      const missing = wordsNeedingAiFallback(dbWords);
      if (missing.length > 0) {
        try {
          const memory = await buildMemorySnapshot();
          const res = await exerciseGenMutation.mutateAsync({
            data: {
              moduleTitle: module.title,
              targetWords: missing.map((w) => w.word),
              grammarFocus: module.grammarFocus,
              userMemory: memory,
            },
          });
          const adapted = res.exercises.map((ex, i) => adaptAiExercise(ex, missing[i % missing.length]?.id ?? 'ai-fallback', i));
          set = [...set, ...adapted];
        } catch {
          // Offline and no cached explanation for these words — skip them for practice.
        }
      }

      if (!cancelled) {
        setExercises(set);
        setLoading(false);
      }
    }
    build();
    return () => {
      cancelled = true;
    };
  }, [module]);

  const current = exercises[index];

  useEffect(() => {
    if (current?.type === 'reorder' && current.tokens) {
      setReorderTokens(current.tokens);
      setReorderPicked([]);
    }
  }, [current?.id]);

  const advance = useCallback(() => {
    setSelected(null);
    setTextAnswer('');
    setFeedback(null);
    if (index + 1 >= exercises.length) {
      onDone();
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, exercises.length, onDone]);

  const submitChoice = useCallback((choice: string) => {
    if (feedback || !current) return;
    setSelected(choice);
    const isCorrect = checkAnswer(current, choice);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    Haptics.notificationAsync(isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    setTimeout(advance, 1100);
  }, [current, feedback, advance]);

  const submitText = useCallback(() => {
    if (feedback || !current || !textAnswer.trim()) return;
    const isCorrect = checkAnswer(current, textAnswer);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    Haptics.notificationAsync(isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    setTimeout(advance, 1400);
  }, [current, feedback, textAnswer, advance]);

  const submitReorder = useCallback(() => {
    if (feedback || !current) return;
    const answer = reorderPicked.join(' ');
    const isCorrect = checkAnswer(current, answer);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    Haptics.notificationAsync(isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    setTimeout(advance, 1400);
  }, [current, feedback, reorderPicked, advance]);

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.textSecondary, marginTop: 12 }}>تحضير التمارين...</Text>
      </View>
    );
  }

  if (exercises.length === 0 || !current) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }]}>
        <Text style={{ color: theme.textSecondary, textAlign: 'center', marginBottom: 16 }}>
          تعذّر تحضير تمارين الآن (تحقق من الاتصال بالإنترنت). يمكنك المتابعة للكتابة.
        </Text>
        <Pressable style={[styles.nextBtn, { backgroundColor: theme.primary }]} onPress={onDone}>
          <Text style={styles.nextBtnText}>متابعة</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.stageCounter, { color: theme.textSecondary }]}>
        تمرين {index + 1} من {exercises.length}
      </Text>

      <View style={[styles.exerciseCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.exerciseTypeLabel, { color: theme.primary }]}>{exerciseTypeLabel(current.type)}</Text>
        <Text style={[styles.exercisePrompt, { color: theme.text }]}>{current.prompt}</Text>

        {(current.type === 'choose-meaning' || current.type === 'match') && current.options && (
          <View style={styles.optionsWrap}>
            {current.options.map((opt) => {
              const isSelected = selected === opt;
              const isCorrectOpt = feedback && opt === current.correctAnswer;
              const isWrongSelected = feedback === 'incorrect' && isSelected;
              return (
                <Pressable
                  key={opt}
                  onPress={() => submitChoice(opt)}
                  disabled={!!feedback}
                  style={[
                    styles.optionBtn,
                    {
                      backgroundColor: isCorrectOpt ? theme.successSoft : isWrongSelected ? theme.dangerSoft : theme.background,
                      borderColor: isCorrectOpt ? theme.success : isWrongSelected ? theme.danger : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionText, { color: isCorrectOpt ? theme.success : isWrongSelected ? theme.danger : theme.text }]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {current.type === 'fill-blank' && (
          <View style={{ gap: 12 }}>
            <TextInput
              style={[styles.textInput, { color: theme.text, borderColor: feedback ? (feedback === 'correct' ? theme.success : theme.danger) : theme.border }]}
              placeholder="اكتب الكلمة المفقودة..."
              placeholderTextColor={theme.muted}
              value={textAnswer}
              onChangeText={setTextAnswer}
              editable={!feedback}
              autoCapitalize="none"
              onSubmitEditing={submitText}
            />
            {!feedback && (
              <Pressable style={[styles.checkBtn, { backgroundColor: theme.primary }]} onPress={submitText}>
                <Text style={styles.nextBtnText}>تحقق</Text>
              </Pressable>
            )}
            {feedback === 'incorrect' && (
              <Text style={{ color: theme.danger, textAlign: 'right' }}>الإجابة الصحيحة: {current.correctAnswer}</Text>
            )}
          </View>
        )}

        {current.type === 'reorder' && (
          <View style={{ gap: 12 }}>
            <View style={[styles.reorderTarget, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <Text style={{ color: theme.text, fontSize: 16 }}>{reorderPicked.join(' ') || ' '}</Text>
            </View>
            <View style={styles.optionsWrap}>
              {reorderTokens.map((tok, i) => {
                const used = reorderPicked.includes(tok) && reorderPicked.indexOf(tok) < reorderPicked.length;
                return (
                  <Pressable
                    key={`${tok}-${i}`}
                    disabled={!!feedback || reorderPicked.includes(tok)}
                    onPress={() => setReorderPicked((p) => [...p, tok])}
                    style={[styles.chip, { backgroundColor: theme.background, borderColor: theme.border, opacity: reorderPicked.includes(tok) ? 0.35 : 1 }]}
                  >
                    <Text style={{ color: theme.text }}>{tok}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[styles.checkBtn, { flex: 1, backgroundColor: theme.border }]} onPress={() => setReorderPicked([])} disabled={!!feedback}>
                <Text style={[styles.nextBtnText, { color: theme.text }]}>مسح</Text>
              </Pressable>
              <Pressable style={[styles.checkBtn, { flex: 1, backgroundColor: theme.primary }]} onPress={submitReorder} disabled={!!feedback || reorderPicked.length === 0}>
                <Text style={styles.nextBtnText}>تحقق</Text>
              </Pressable>
            </View>
            {feedback === 'incorrect' && (
              <Text style={{ color: theme.danger, textAlign: 'right' }}>الإجابة الصحيحة: {current.correctAnswer}</Text>
            )}
          </View>
        )}

        {feedback && (
          <View style={[styles.feedbackBadge, { backgroundColor: feedback === 'correct' ? theme.successSoft : theme.dangerSoft }]}>
            <Feather name={feedback === 'correct' ? 'check-circle' : 'x-circle'} size={16} color={feedback === 'correct' ? theme.success : theme.danger} />
            <Text style={{ color: feedback === 'correct' ? theme.success : theme.danger, fontFamily: 'Inter_600SemiBold' }}>
              {feedback === 'correct' ? 'صحيح!' : 'غير صحيح'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function exerciseTypeLabel(type: PracticeExercise['type']): string {
  switch (type) {
    case 'choose-meaning': return 'اختر المعنى الصحيح';
    case 'match': return 'اختر الكلمة الصحيحة';
    case 'fill-blank': return 'أكمل الفراغ';
    case 'reorder': return 'رتّب الجملة';
  }
}

function adaptAiExercise(
  ex: { type: string; question: string; options: string[] | null; answer: string },
  wordId: string,
  i: number
): PracticeExercise {
  if (ex.type === 'multiple-choice' && ex.options) {
    return { id: `ai-${i}`, type: 'choose-meaning', wordId, word: ex.answer, prompt: ex.question, options: ex.options, correctAnswer: ex.answer };
  }
  if (ex.type === 'reorder') {
    return { id: `ai-${i}`, type: 'reorder', wordId, word: ex.answer, prompt: 'رتب الكلمات لتكوين جملة صحيحة', tokens: ex.question.split(/\s+/), correctAnswer: ex.answer };
  }
  // fill-blank or translate both render as a text-input question.
  return { id: `ai-${i}`, type: 'fill-blank', wordId, word: ex.answer, prompt: ex.question, correctAnswer: ex.answer };
}

// ─── Stage 3: Writing ──────────────────────────────────────────────────────────

function WritingStage({
  theme, module, insets, buildMemorySnapshot, onDone,
}: {
  theme: any; module: Module; insets: any;
  buildMemorySnapshot: () => Promise<any>; onDone: () => void;
}) {
  const [sentence, setSentence] = useState('');
  const [results, setResults] = useState<SentenceResult[]>([]);
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null);
  const { recordSentenceWritten } = useApp();
  const correctMutation = useAiSentenceCorrect();

  const targetWords = useMemo(() => module.words.map((w) => w.word.toLowerCase()), [module]);

  const handleSubmit = useCallback(async () => {
    const text = sentence.trim();
    if (!text || correctMutation.isPending || results.length >= MAX_SENTENCES) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOfflineMsg(null);

    try {
      const memory = await buildMemorySnapshot();
      const res = await correctMutation.mutateAsync({ data: { sentence: text, userMemory: memory } });
      setResults((prev) => [...prev, { sentence: text, correctedText: res.correctedText, explanation: res.explanation, isCorrect: res.isCorrect }]);
      await recordSentenceWritten();

      // Credit any of today's target words used in this sentence.
      const lower = text.toLowerCase();
      for (const w of module.words) {
        if (targetWords.includes(w.word.toLowerCase()) && new RegExp(`\\b${w.word}\\b`, 'i').test(lower)) {
          await recordWordUsedInSentence(w.id);
        }
      }

      setSentence('');
      Haptics.notificationAsync(res.isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    } catch {
      setOfflineMsg('أنت غير متصل الآن. حاول مرة أخرى عند عودة الاتصال.');
    }
  }, [sentence, correctMutation, buildMemorySnapshot, recordSentenceWritten, results.length, module, targetWords]);

  const canFinish = results.length >= MIN_SENTENCES;

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.stageCounter, { color: theme.textSecondary }]}>
        اكتب {MIN_SENTENCES} إلى {MAX_SENTENCES} جمل باستخدام كلمات اليوم ({results.length}/{MAX_SENTENCES})
      </Text>

      <View style={[styles.wordChipsRow]}>
        {module.words.map((w) => (
          <View key={w.id} style={[styles.wordTag, { backgroundColor: theme.primarySoft }]}>
            <Text style={[styles.wordTagText, { color: theme.primary }]}>{w.word}</Text>
          </View>
        ))}
      </View>

      {results.length < MAX_SENTENCES && (
        <View style={[styles.inputSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            style={[styles.textInput, { color: theme.text, borderColor: theme.border, minHeight: 90 }]}
            placeholder="I felt very happy when I received the gift..."
            placeholderTextColor={theme.muted}
            value={sentence}
            onChangeText={setSentence}
            multiline
            maxLength={300}
            autoCapitalize="sentences"
          />
          <Pressable
            style={[styles.checkBtn, { backgroundColor: sentence.trim() ? theme.primary : theme.border }]}
            onPress={handleSubmit}
            disabled={!sentence.trim() || correctMutation.isPending}
          >
            {correctMutation.isPending ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
              <Text style={[styles.nextBtnText, { color: sentence.trim() ? '#FFFFFF' : theme.muted }]}>صحّح مع نبيه</Text>
            )}
          </Pressable>
        </View>
      )}

      {offlineMsg && (
        <View style={[styles.offlineBox, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
          <Feather name="wifi-off" size={16} color={theme.warning} />
          <Text style={{ color: theme.warning, flex: 1, textAlign: 'right' }}>{offlineMsg}</Text>
        </View>
      )}

      {results.map((r, i) => (
        <View key={i} style={[styles.resultCard, { backgroundColor: theme.surface, borderColor: r.isCorrect ? theme.success : theme.warning }]}>
          <Text style={[styles.definition, { color: theme.muted }]}>{r.sentence}</Text>
          {!r.isCorrect && (
            <>
              <Text style={{ color: theme.text, fontFamily: 'Inter_600SemiBold' }}>{r.correctedText}</Text>
              <Text style={{ color: theme.textSecondary, textAlign: 'right' }}>{r.explanation}</Text>
            </>
          )}
          {r.isCorrect && <Text style={{ color: theme.success, fontFamily: 'Inter_600SemiBold' }}>ممتاز! ✓</Text>}
        </View>
      ))}

      <Pressable
        style={[styles.nextBtn, { backgroundColor: canFinish ? theme.primary : theme.border, marginTop: 8 }]}
        onPress={onDone}
        disabled={!canFinish}
      >
        <Text style={[styles.nextBtnText, { color: canFinish ? '#FFFFFF' : theme.muted }]}>
          {canFinish ? 'إنهاء الدرس' : `اكتب ${MIN_SENTENCES - results.length} جملة أخرى على الأقل`}
        </Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

// ─── Stage 4: Complete ──────────────────────────────────────────────────────────

function CompleteStage({ theme, module, insets }: { theme: any; module: Module; insets: any }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function finish() {
      // Every word from today's lesson enters the spaced-repetition queue now,
      // regardless of practice performance — first review is tomorrow.
      for (const w of module.words) {
        await completeInitialLearning(w.id);
      }
      const journal = await getTodayJournal();
      await upsertTodayJournal({
        wordsLearned: Array.from(new Set([...(journal?.wordsLearned ?? []), ...module.words.map((w) => w.word)])),
      });
      if (!cancelled) setDone(true);
    }
    finish();
    return () => {
      cancelled = true;
    };
  }, [module]);

  return (
    <View style={[styles.completeWrap, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}>
      <Text style={{ fontSize: 64 }}>🎉</Text>
      <Text style={[styles.completeTitle, { color: theme.text }]}>أحسنت!</Text>
      <Text style={[styles.completeSub, { color: theme.textSecondary }]}>
        أتممت مراحل التعلّم والتدريب والكتابة لكلمات اليوم{'\n'}
        دخلت {module.words.length} كلمات في جدول المراجعة الذكي
      </Text>
      <View style={[styles.completeWords, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {module.words.map((w) => (
          <View key={w.id} style={[styles.wordTag, { backgroundColor: theme.primarySoft }]}>
            <Text style={[styles.wordTagText, { color: theme.primary }]}>{w.word}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.nextBtn, { backgroundColor: theme.primary, opacity: done ? 1 : 0.6 }]}
        disabled={!done}
        onPress={() => router.push('/(tabs)/conversation')}
      >
        <Feather name="message-circle" size={18} color="#FFFFFF" />
        <Text style={styles.nextBtnText}>ابدأ محادثة قصيرة مع نبيه</Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
        <Text style={{ color: theme.textSecondary, fontFamily: 'Inter_500Medium' }}>العودة للرئيسية</Text>
      </Pressable>
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
  stagesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 16, gap: 4 },
  stageStepWrap: { flexDirection: 'row', alignItems: 'center' },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  stageLine: { width: 36, height: 2, marginHorizontal: 4 },
  scroll: { paddingHorizontal: 24, paddingTop: 12, gap: 20 },
  stageCounter: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'center' },
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
  pronunciationBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
  },
  pronunciationText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  arabicTrans: { fontSize: 22, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  definition: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'right', lineHeight: 22 },
  exampleRow: { borderLeftWidth: 3, paddingLeft: 12 },
  exampleText: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 20, flex: 1 },
  tipBox: { padding: 12, borderRadius: colors.radius },
  tipText: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'right' },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: colors.radius,
  },
  nextBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
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

  // Practice stage
  exerciseCard: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 16 },
  exerciseTypeLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  exercisePrompt: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center', lineHeight: 30 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  optionBtn: { borderWidth: 1.5, borderRadius: colors.radius, paddingHorizontal: 16, paddingVertical: 12, minWidth: '45%', alignItems: 'center' },
  optionText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  reorderTarget: { minHeight: 48, borderWidth: 1, borderRadius: 12, padding: 12, justifyContent: 'center' },
  checkBtn: { borderRadius: colors.radius, paddingVertical: 14, alignItems: 'center' },
  feedbackBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },

  // Writing stage
  wordChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  inputSection: { borderWidth: 1, borderRadius: colors.radius, padding: 16, gap: 12 },
  textInput: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16, fontFamily: 'Inter_400Regular', textAlignVertical: 'top' },
  offlineBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: colors.radius, padding: 12 },
  resultCard: { borderWidth: 1.5, borderRadius: colors.radius, padding: 14, gap: 6 },
});
