import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  useColorScheme, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import colors from '@/constants/colors';
import { useApp } from '@/src/context/AppContext';
import { recordMistakePattern, upsertTodayJournal, getTodayJournal } from '@/src/db/database';
import { useAiSentenceCorrect } from '@workspace/api-client-react';

interface CorrectionResult {
  correctedText: string;
  explanation: string;
  matchedGrammarPattern: string | null;
  isCorrect: boolean;
}

export default function SentenceBuilderScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const { buildMemorySnapshot, recordSentenceWritten } = useApp();

  const [sentence, setSentence] = useState('');
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [history, setHistory] = useState<Array<{ sentence: string; result: CorrectionResult }>>([]);
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null);

  const correctMutation = useAiSentenceCorrect();

  const handleCorrect = useCallback(async () => {
    const text = sentence.trim();
    if (!text || correctMutation.isPending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResult(null);
    setOfflineMsg(null);

    await recordSentenceWritten();

    try {
      const memory = await buildMemorySnapshot();
      const res = await correctMutation.mutateAsync({
        data: { sentence: text, userMemory: memory },
      });

      setResult(res);

      // Record mistake pattern if detected
      if (res.matchedGrammarPattern && !res.isCorrect) {
        await recordMistakePattern(res.matchedGrammarPattern);
      }

      // Update journal
      const journal = await getTodayJournal();
      if (res.matchedGrammarPattern && !res.isCorrect) {
        const existing = journal?.mistakesMade ?? [];
        if (!existing.includes(res.matchedGrammarPattern)) {
          await upsertTodayJournal({
            mistakesMade: [...existing, res.matchedGrammarPattern],
          });
        }
      }

      // Add to local history
      setHistory((prev) => [{ sentence: text, result: res }, ...prev.slice(0, 9)]);
      setSentence('');
      Haptics.notificationAsync(
        res.isCorrect
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
    } catch {
      setOfflineMsg('أنت غير متصل الآن. سيتم تصحيح الجملة عند عودة الاتصال. ✓');
    }
  }, [sentence, correctMutation, buildMemorySnapshot, recordSentenceWritten]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>بنّاء الجمل</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Input section */}
        <View style={[styles.inputSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>اكتب جملتك بالإنجليزية:</Text>
          <TextInput
            style={[styles.textInput, { color: theme.text, borderColor: theme.border }]}
            placeholder="I go to work yesterday..."
            placeholderTextColor={theme.muted}
            value={sentence}
            onChangeText={setSentence}
            multiline
            maxLength={300}
            textAlign="left"
            autoCapitalize="sentences"
          />
          <Pressable
            style={({ pressed }) => [
              styles.correctBtn,
              {
                backgroundColor: sentence.trim() ? theme.primary : theme.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={handleCorrect}
            disabled={!sentence.trim() || correctMutation.isPending}
          >
            {correctMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="check-circle" size={18} color={sentence.trim() ? '#FFFFFF' : theme.muted} />
            )}
            <Text style={[styles.correctBtnText, { color: sentence.trim() ? '#FFFFFF' : theme.muted }]}>
              {correctMutation.isPending ? 'نبيه يصحّح...' : 'صحّح مع نبيه'}
            </Text>
          </Pressable>
        </View>

        {/* Offline notice */}
        {offlineMsg && (
          <View style={[styles.offlineBox, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
            <Feather name="wifi-off" size={16} color={theme.warning} />
            <Text style={[styles.offlineText, { color: theme.warning }]}>{offlineMsg}</Text>
          </View>
        )}

        {/* Correction result */}
        {result && (
          <View style={[styles.resultCard, { backgroundColor: theme.surface, borderColor: result.isCorrect ? theme.success : theme.warning }]}>
            {result.isCorrect ? (
              <>
                <View style={styles.resultHeader}>
                  <Text style={[styles.resultStatusText, { color: theme.success }]}>ممتاز! الجملة صحيحة 🎉</Text>
                  <Feather name="check-circle" size={22} color={theme.success} />
                </View>
                <View style={[styles.correctedBox, { backgroundColor: theme.successSoft }]}>
                  <Text style={[styles.correctedText, { color: theme.text }]}>{result.correctedText}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.resultHeader}>
                  <Text style={[styles.resultStatusText, { color: theme.warning }]}>نبيه صحّح لك ✏️</Text>
                  <Feather name="edit-2" size={22} color={theme.warning} />
                </View>
                <View style={[styles.correctedBox, { backgroundColor: theme.warningSoft }]}>
                  <Text style={[styles.correctedLabel, { color: theme.warning }]}>التصحيح:</Text>
                  <Text style={[styles.correctedText, { color: theme.text }]}>{result.correctedText}</Text>
                </View>
                <Text style={[styles.explanation, { color: theme.textSecondary }]}>{result.explanation}</Text>
                {result.matchedGrammarPattern && (
                  <View style={[styles.patternBadge, { backgroundColor: theme.dangerSoft }]}>
                    <Feather name="alert-circle" size={14} color={theme.danger} />
                    <Text style={[styles.patternText, { color: theme.danger }]}>
                      {result.matchedGrammarPattern}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* History */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={[styles.historyTitle, { color: theme.text }]}>جملك السابقة</Text>
            {history.map((item, i) => (
              <View key={i} style={[styles.historyItem, { backgroundColor: theme.surface, borderColor: item.result.isCorrect ? theme.successSoft : theme.warningSoft }]}>
                <Feather
                  name={item.result.isCorrect ? 'check-circle' : 'edit-2'}
                  size={14}
                  color={item.result.isCorrect ? theme.success : theme.warning}
                />
                <View style={styles.historyText}>
                  <Text style={[styles.historyOriginal, { color: theme.muted }]} numberOfLines={1}>
                    {item.sentence}
                  </Text>
                  {!item.result.isCorrect && (
                    <Text style={[styles.historyCorrected, { color: theme.text }]} numberOfLines={1}>
                      → {item.result.correctedText}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  scroll: { paddingHorizontal: 20, paddingTop: 24, gap: 20 },
  inputSection: {
    borderWidth: 1, borderRadius: colors.radius, padding: 16, gap: 12,
  },
  inputLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  textInput: {
    borderWidth: 1, borderRadius: 10,
    padding: 14, fontSize: 16, fontFamily: 'Inter_400Regular',
    minHeight: 100, textAlignVertical: 'top',
  },
  correctBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: colors.radius,
  },
  correctBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  offlineBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: colors.radius, padding: 12,
  },
  offlineText: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1, textAlign: 'right' },
  resultCard: { borderWidth: 2, borderRadius: colors.radius, padding: 16, gap: 12 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultStatusText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  correctedBox: { borderRadius: 8, padding: 12, gap: 4 },
  correctedLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  correctedText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  explanation: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, textAlign: 'right' },
  patternBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
  },
  patternText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  historySection: { gap: 10 },
  historyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  historyItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1, borderRadius: colors.radius, padding: 12,
  },
  historyText: { flex: 1 },
  historyOriginal: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  historyCorrected: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
});
