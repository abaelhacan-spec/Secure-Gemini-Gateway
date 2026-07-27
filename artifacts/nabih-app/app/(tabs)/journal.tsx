import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, useColorScheme, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { getJournalEntries, upsertTodayJournal, type JournalEntry } from '@/src/db/database';
import { useApp } from '@/src/context/AppContext';
import { useAiJournalDailyReport } from '@workspace/api-client-react';

export default function JournalScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const { userProfile, streakDays, buildMemorySnapshot } = useApp();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const journalMutation = useAiJournalDailyReport();

  const loadEntries = useCallback(async () => {
    const data = await getJournalEntries(30);
    setEntries(data);
  }, []);

  useEffect(() => { loadEntries(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEntries();
    setRefreshing(false);
  };

  const handleGenerateReport = async (entry: JournalEntry) => {
    if (entry.aiReport || journalMutation.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const memory = await buildMemorySnapshot();
      const result = await journalMutation.mutateAsync({
        data: {
          wordsLearnedToday: entry.wordsLearned,
          mistakesMadeToday: entry.mistakesMade,
          sentencesWritten: entry.sentencesWritten,
          streakDays,
          userMemory: memory,
        },
      });

      await upsertTodayJournal({ aiReport: result.report, aiReportPending: false });
      await loadEntries();
    } catch {
      // Network unavailable — mark as pending for background sync
      await upsertTodayJournal({ aiReportPending: true });
      await loadEntries();
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>يومياتي</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          سجل رحلتك مع نبيه — {entries.length} يوم
        </Text>

        {/* Streak banner */}
        <View style={[styles.streakBanner, { backgroundColor: theme.primarySoft }]}>
          <Feather name="zap" size={16} color={theme.primary} />
          <Text style={[styles.streakText, { color: theme.primary }]}>
            {streakDays > 0
              ? `${streakDays} يوم متواصل 🔥 — استمر هكذا!`
              : 'ابدأ سلسلتك اليوم!'}
          </Text>
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="edit-3" size={40} color={theme.muted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {'لا توجد سجلات بعد\nأكمل أول درس لتبدأ يومياتك!'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isToday = item.date === today;
          return (
            <View style={[styles.entryCard, { backgroundColor: theme.surface, borderColor: isToday ? theme.primary : theme.border, borderWidth: isToday ? 2 : 1 }]}>
              {/* Date row */}
              <View style={styles.entryHeader}>
                {isToday && (
                  <View style={[styles.todayBadge, { backgroundColor: theme.primary }]}>
                    <Text style={styles.todayBadgeText}>اليوم</Text>
                  </View>
                )}
                <Text style={[styles.entryDate, { color: theme.text }]}>{formatDate(item.date)}</Text>
              </View>

              {/* Stats */}
              <View style={styles.entryStats}>
                {[
                  { label: 'كلمات', value: item.wordsLearned.length, icon: 'book-open' },
                  { label: 'جمل', value: item.sentencesWritten, icon: 'edit-2' },
                  { label: 'أخطاء', value: item.mistakesMade.length, icon: 'alert-circle' },
                ].map((stat) => (
                  <View key={stat.label} style={[styles.statItem, { backgroundColor: theme.background }]}>
                    <Feather name={stat.icon as any} size={14} color={theme.primary} />
                    <Text style={[styles.statVal, { color: theme.text }]}>{stat.value}</Text>
                    <Text style={[styles.statLbl, { color: theme.textSecondary }]}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              {/* Words learned */}
              {item.wordsLearned.length > 0 && (
                <View style={styles.wordTags}>
                  {item.wordsLearned.slice(0, 5).map((w) => (
                    <View key={w} style={[styles.wordTag, { backgroundColor: theme.primarySoft }]}>
                      <Text style={[styles.wordTagText, { color: theme.primary }]}>{w}</Text>
                    </View>
                  ))}
                  {item.wordsLearned.length > 5 && (
                    <View style={[styles.wordTag, { backgroundColor: theme.background }]}>
                      <Text style={[styles.wordTagText, { color: theme.muted }]}>+{item.wordsLearned.length - 5}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* AI Report */}
              {item.aiReport ? (
                <View style={[styles.reportBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <View style={styles.reportHeader}>
                    <Text style={{ fontSize: 16 }}>🦉</Text>
                    <Text style={[styles.reportLabel, { color: theme.primary }]}>نبيه يقول:</Text>
                  </View>
                  <Text style={[styles.reportText, { color: theme.text }]}>{item.aiReport}</Text>
                </View>
              ) : item.aiReportPending ? (
                <View style={[styles.pendingBox, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
                  <Feather name="clock" size={14} color={theme.warning} />
                  <Text style={[styles.pendingText, { color: theme.warning }]}>
                    سيُكتب التقرير عند عودة الاتصال
                  </Text>
                </View>
              ) : isToday ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.generateBtn,
                    {
                      backgroundColor: journalMutation.isPending ? theme.border : theme.primarySoft,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  onPress={() => handleGenerateReport(item)}
                  disabled={journalMutation.isPending}
                >
                  {journalMutation.isPending ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Feather name="zap" size={14} color={theme.primary} />
                  )}
                  <Text style={[styles.generateBtnText, { color: theme.primary }]}>
                    {journalMutation.isPending ? 'نبيه يكتب...' : 'اطلب تقرير نبيه اليومي'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingBottom: 16, gap: 8,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  sub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  streakBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: colors.radius,
  },
  streakText: { fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'right', flex: 1 },
  list: { padding: 16, gap: 14 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 24 },
  entryCard: { borderRadius: colors.radius, padding: 16, gap: 14 },
  entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  todayBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  todayBadgeText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter_700Bold' },
  entryDate: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  entryStats: { flexDirection: 'row', gap: 8 },
  statItem: {
    flex: 1, alignItems: 'center', gap: 4,
    padding: 10, borderRadius: 8,
  },
  statVal: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLbl: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  wordTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wordTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  wordTagText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  reportBox: { borderWidth: 1, borderRadius: colors.radius, padding: 14, gap: 8 },
  reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  reportText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, textAlign: 'right' },
  pendingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: colors.radius, padding: 12,
  },
  pendingText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1, textAlign: 'right' },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 12, borderRadius: colors.radius,
  },
  generateBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
