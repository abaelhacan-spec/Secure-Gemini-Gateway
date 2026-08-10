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
import { getMasteryStats } from '@/src/db/database';
import { OXFORD_3000 } from '@/src/db/oxford3000';
import {
  getCurrentLessonNumber, lessonIdFromNumber, getUnlockedLessonCount, TOTAL_LESSONS,
} from '@/src/db/lessons';

const TOTAL_OXFORD_WORDS = OXFORD_3000.length;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const { currentModule, streakDays, updateStreak, refreshProfile } = useApp();

  const [masteredCount, setMasteredCount] = useState(0);
  const [dueReviewCount, setDueReviewCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLessonNumber, setCurrentLessonNumber] = useState(1);
  const [unlockedLessonCount, setUnlockedLessonCount] = useState(1);

  const loadStats = useCallback(async () => {
    const stats = await getMasteryStats();
    setMasteredCount(stats.masteredCount);
    setDueReviewCount(stats.dueReviewCount);
  }, []);

  const loadLessonProgress = useCallback(async () => {
    const [current, unlocked] = await Promise.all([
      getCurrentLessonNumber(),
      getUnlockedLessonCount(),
    ]);
    setCurrentLessonNumber(current);
    setUnlockedLessonCount(unlocked);
  }, []);

  useEffect(() => {
    loadStats();
    loadLessonProgress();
    updateStreak();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadLessonProgress(), refreshProfile()]);
    setRefreshing(false);
  }, [loadStats, loadLessonProgress, refreshProfile]);

  const handleStartLesson = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/lesson/[moduleId]', params: { moduleId: lessonIdFromNumber(currentLessonNumber) } });
  };

  const handleViewAllLessons = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/lessons');
  };

  const handleStartReview = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/review');
  };

  const masteryPercent = TOTAL_OXFORD_WORDS > 0 ? Math.round((masteredCount / TOTAL_OXFORD_WORDS) * 1000) / 10 : 0;
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
            {/* Daily Streak */}
            <View style={[styles.streakBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakNum}>{streakDays}</Text>
            </View>
          </View>

          {/* Continue with the current unlocked lesson */}
          <Pressable
            style={({ pressed }) => [
              styles.lessonCard,
              { backgroundColor: '#FFFFFF', opacity: pressed ? 0.95 : 1 },
            ]}
            onPress={handleStartLesson}
          >
            <View style={styles.lessonCardLeft}>
              <Text style={[styles.lessonLabel, { color: theme.primary }]}>
                الدرس {currentLessonNumber} من {TOTAL_LESSONS}
              </Text>
              <Text style={[styles.lessonTitle, { color: theme.text }]}>
                {currentModule?.words.length ?? 50} كلمة من Oxford 3000
              </Text>
              <Text style={[styles.lessonSub, { color: theme.textSecondary }]}>
                تعلّم • تدرّب • اكتب • تحدّث
              </Text>
            </View>
            <View style={[styles.lessonBtn, { backgroundColor: theme.primary }]}>
              <Feather name="play" size={20} color="#FFFFFF" />
            </View>
          </Pressable>

          {/* Link to the full 60-lesson roadmap */}
          <Pressable
            style={({ pressed }) => [styles.allLessonsRow, { opacity: pressed ? 0.8 : 1 }]}
            onPress={handleViewAllLessons}
          >
            <Text style={styles.allLessonsText}>
              {unlockedLessonCount} من {TOTAL_LESSONS} درس مفتوح — عرض كل الدروس
            </Text>
            <Feather name="chevron-left" size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Today's reviews (spaced repetition) */}
        <Pressable
          style={({ pressed }) => [
            styles.reviewCard,
            {
              backgroundColor: dueReviewCount > 0 ? theme.primarySoft : theme.surface,
              borderColor: dueReviewCount > 0 ? theme.primary : theme.border,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleStartReview}
        >
          <View style={[styles.reviewIconWrap, { backgroundColor: dueReviewCount > 0 ? theme.primary : theme.border }]}>
            <Feather name="rotate-cw" size={18} color={dueReviewCount > 0 ? '#FFFFFF' : theme.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.reviewTitle, { color: theme.text }]}>مراجعات اليوم</Text>
            <Text style={[styles.reviewSub, { color: theme.textSecondary }]}>
              {dueReviewCount > 0 ? `${dueReviewCount} كلمة بحاجة لمراجعة سريعة` : 'لا توجد مراجعات مستحقة الآن'}
            </Text>
          </View>
          {dueReviewCount > 0 && <Feather name="chevron-left" size={20} color={theme.primary} />}
        </Pressable>

        {/* Oxford 3000 mastery stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Feather name="trending-up" size={20} color={theme.primary} />
            <Text style={[styles.statValue, { color: theme.text }]}>{masteryPercent}%</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>نسبة إتقان Oxford 3000</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Feather name="award" size={20} color={theme.warning} />
            <Text style={[styles.statValue, { color: theme.text }]}>{masteredCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>كلمة متقنة من {TOTAL_OXFORD_WORDS}</Text>
          </View>
        </View>

        {/* Quick actions — unchanged */}
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
  lessonLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 4, textAlign: 'right' },
  lessonTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  lessonSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2, textAlign: 'right' },
  lessonBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  allLessonsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 6,
  },
  allLessonsText: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter_500Medium' },
  reviewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginTop: 16, padding: 14,
    borderWidth: 1, borderRadius: colors.radius,
  },
  reviewIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  reviewTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  reviewSub: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'right', marginTop: 2 },
  statsRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 16,
  },
  statCard: {
    flex: 1, borderWidth: 1, borderRadius: colors.radius,
    padding: 14, alignItems: 'center', gap: 6,
  },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  section: { paddingHorizontal: 20, marginTop: 28, gap: 12 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  quickRow: { flexDirection: 'row', gap: 12 },
  quickCard: {
    flex: 1, borderWidth: 1, borderRadius: colors.radius,
    padding: 16, gap: 8, alignItems: 'center',
  },
  quickLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  quickSub: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
