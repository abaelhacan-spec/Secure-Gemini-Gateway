import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, useColorScheme, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { useApp } from '@/src/context/AppContext';
import { getWords, getTodayJournal } from '@/src/db/database';
import { CURRICULUM } from '@/src/db/seed';
import { DAILY_MODULE_ID } from '@/src/db/dailyWords';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const { userProfile, currentModule, streakDays, updateStreak, refreshProfile } = useApp();

  const [wordCount, setWordCount] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [todayWordCount, setTodayWordCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    const words = await getWords();
    setWordCount(words.length);
    setMasteredCount(words.filter((w) => w.lifecycleStage === 'mastered').length);
    const journal = await getTodayJournal();
    setTodayWordCount(journal?.wordsLearned.length ?? 0);
  }, []);

  useEffect(() => {
    loadStats();
    updateStreak();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), refreshProfile()]);
    setRefreshing(false);
  }, [loadStats, refreshProfile]);

  const handleStartLesson = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentModule) {
      router.push({ pathname: '/lesson/[moduleId]', params: { moduleId: currentModule.id } });
    }
  };

  const todayDate = new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: theme.primary }]}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => router.push('/settings')} style={[styles.avatarBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Text style={styles.avatarText}>🦉</Text>
            </Pressable>
            <View style={styles.headerGreeting}>
              <Text style={styles.headerDate}>{todayDate}</Text>
              <Text style={styles.headerWelcome}>صباح التعلّم! ☀️</Text>
            </View>
            {/* Streak */}
            <View style={[styles.streakBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakNum}>{streakDays}</Text>
            </View>
          </View>

          {/* Main lesson card */}
          <Pressable
            style={({ pressed }) => [
              styles.lessonCard,
              { backgroundColor: '#FFFFFF', opacity: pressed ? 0.95 : 1 },
            ]}
            onPress={handleStartLesson}
          >
            <View style={styles.lessonCardLeft}>
              <Text style={[styles.lessonLabel, { color: theme.primary }]}>الدرس الحالي</Text>
              <Text style={[styles.lessonTitle, { color: theme.text }]}>
                {currentModule?.titleAr ?? 'التحيات'}
              </Text>
              <Text style={[styles.lessonSub, { color: theme.textSecondary }]}>
                {currentModule?.words.length ?? 10} كلمة • {currentModule?.description}
              </Text>
            </View>
            <View style={[styles.lessonBtn, { backgroundColor: theme.primary }]}>
              <Feather name="play" size={20} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'كلمات تعلّمتها', value: wordCount, icon: 'book-open', color: theme.primary },
            { label: 'تعلّمتها اليوم', value: todayWordCount, icon: 'star', color: theme.success },
            { label: 'أتقنتها', value: masteredCount, icon: 'award', color: theme.warning },
          ].map((stat) => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Feather name={stat.icon as any} size={20} color={stat.color} />
              <Text style={[styles.statValue, { color: theme.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* All modules */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>وحدات المنهج</Text>

          {/* Daily Oxford 3000 words — a new batch of 10 words every day */}
          <Pressable
            style={({ pressed }) => [
              styles.moduleCard,
              {
                backgroundColor: currentModule?.id === DAILY_MODULE_ID ? theme.primarySoft : theme.surface,
                borderColor: currentModule?.id === DAILY_MODULE_ID ? theme.primary : theme.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/lesson/[moduleId]', params: { moduleId: DAILY_MODULE_ID } });
            }}
          >
            <View style={styles.moduleCardContent}>
              <View style={styles.moduleCardRight}>
                {currentModule?.id === DAILY_MODULE_ID && (
                  <View style={[styles.currentBadge, { backgroundColor: theme.primary }]}>
                    <Text style={styles.currentBadgeText}>الحالي</Text>
                  </View>
                )}
                <Text style={[styles.moduleTitle, { color: theme.text }]}>🔄 كلمات اليوم</Text>
                <Text style={[styles.moduleSub, { color: theme.textSecondary }]}>
                  10 كلمات جديدة من قائمة Oxford 3000 • تتجدد كل يوم
                </Text>
              </View>
              <Feather name="chevron-left" size={20} color={currentModule?.id === DAILY_MODULE_ID ? theme.primary : theme.muted} />
            </View>
          </Pressable>

          {CURRICULUM.map((module) => {
            const isCurrent = module.id === currentModule?.id;
            return (
              <Pressable
                key={module.id}
                style={({ pressed }) => [
                  styles.moduleCard,
                  {
                    backgroundColor: isCurrent ? theme.primarySoft : theme.surface,
                    borderColor: isCurrent ? theme.primary : theme.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: '/lesson/[moduleId]', params: { moduleId: module.id } });
                }}
              >
                <View style={styles.moduleCardContent}>
                  <View style={styles.moduleCardRight}>
                    {isCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: theme.primary }]}>
                        <Text style={styles.currentBadgeText}>الحالي</Text>
                      </View>
                    )}
                    <Text style={[styles.moduleTitle, { color: theme.text }]}>{module.titleAr}</Text>
                    <Text style={[styles.moduleSub, { color: theme.textSecondary }]}>
                      {module.words.length} كلمة
                    </Text>
                  </View>
                  <Feather name="chevron-left" size={20} color={isCurrent ? theme.primary : theme.muted} />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>أدوات سريعة</Text>
          <View style={styles.quickRow}>
            <Pressable
              style={[styles.quickCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push('/sentence-builder')}
            >
              <Feather name="edit-2" size={22} color={theme.primary} />
              <Text style={[styles.quickLabel, { color: theme.text }]}>بنّاء الجمل</Text>
              <Text style={[styles.quickSub, { color: theme.textSecondary }]}>اكتب وصحّح</Text>
            </Pressable>
            <Pressable
              style={[styles.quickCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push('/(tabs)/conversation')}
            >
              <Text style={{ fontSize: 22 }}>🦉</Text>
              <Text style={[styles.quickLabel, { color: theme.text }]}>تحدّث مع نبيه</Text>
              <Text style={[styles.quickSub, { color: theme.textSecondary }]}>محادثة مجانية</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22 },
  headerGreeting: { flex: 1 },
  headerDate: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_400Regular' },
  headerWelcome: { fontSize: 18, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  streakFire: { fontSize: 16 },
  streakNum: { fontSize: 16, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  lessonCard: {
    borderRadius: colors.radius, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  lessonCardLeft: { flex: 1 },
  lessonLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  lessonTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  lessonSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2, textAlign: 'right' },
  lessonBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 20,
  },
  statCard: {
    flex: 1, borderWidth: 1, borderRadius: colors.radius,
    padding: 14, alignItems: 'center', gap: 6,
  },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  section: { paddingHorizontal: 20, marginTop: 28, gap: 12 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  moduleCard: {
    borderWidth: 1, borderRadius: colors.radius, padding: 16,
  },
  moduleCardContent: { flexDirection: 'row', alignItems: 'center' },
  moduleCardRight: { flex: 1, gap: 4 },
  currentBadge: {
    alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, marginBottom: 4,
  },
  currentBadgeText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  moduleTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  moduleSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  quickRow: { flexDirection: 'row', gap: 12 },
  quickCard: {
    flex: 1, borderWidth: 1, borderRadius: colors.radius,
    padding: 16, gap: 8, alignItems: 'center',
  },
  quickLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  quickSub: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
