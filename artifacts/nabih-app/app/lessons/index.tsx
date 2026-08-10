import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, useColorScheme, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { getLessonsWithStatus, TOTAL_LESSONS, type LessonStatus } from '@/src/db/lessons';

export default function LessonsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [lessons, setLessons] = useState<LessonStatus[] | null>(null);

  const load = useCallback(async () => {
    const statuses = await getLessonsWithStatus();
    setLessons(statuses);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenLesson = (lesson: LessonStatus) => {
    if (!lesson.unlocked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/lesson/[moduleId]', params: { moduleId: lesson.id } });
  };

  const unlockedCount = lessons?.filter((l) => l.unlocked).length ?? 0;
  const completedCount = lessons?.filter((l) => l.completed).length ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: theme.primary }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>خارطة الدروس</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.summaryRow, { backgroundColor: theme.primary }]}>
        <Text style={styles.summaryText}>
          {completedCount} مكتمل • {unlockedCount} من {TOTAL_LESSONS} مفتوح
        </Text>
        <Text style={styles.summarySub}>
          يُفتح درس جديد كل 7 أيام استخدام فعلية للتطبيق — الأيام التي لا تفتح فيها التطبيق لا تُحتسب
        </Text>
      </View>

      {!lessons ? (
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={lessons}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
          renderItem={({ item }) => (
            <LessonRow lesson={item} theme={theme} onPress={() => handleOpenLesson(item)} />
          )}
        />
      )}
    </View>
  );
}

function LessonRow({
  lesson, theme, onPress,
}: {
  lesson: LessonStatus; theme: any; onPress: () => void;
}) {
  const statusIcon = lesson.completed
    ? { name: 'check-circle' as const, color: theme.success }
    : lesson.unlocked
    ? { name: 'play-circle' as const, color: theme.primary }
    : { name: 'lock' as const, color: theme.muted };

  const subLabel = lesson.completed
    ? 'مكتمل'
    : lesson.unlocked
    ? `${lesson.wordCount} كلمة`
    : lesson.usageDaysRemaining > 0
    ? `بعد ${lesson.usageDaysRemaining} ${lesson.usageDaysRemaining === 1 ? 'يوم استخدام' : 'أيام استخدام'}`
    : 'مقفل';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.surface,
          borderColor: lesson.completed ? theme.success : lesson.unlocked ? theme.border : theme.border,
          opacity: lesson.unlocked ? (pressed ? 0.9 : 1) : 0.6,
        },
      ]}
    >
      <View style={[styles.numberBadge, { backgroundColor: lesson.unlocked ? theme.primarySoft : theme.border }]}>
        <Text style={[styles.numberText, { color: lesson.unlocked ? theme.primary : theme.muted }]}>{lesson.number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{lesson.titleAr}</Text>
        <Text style={[styles.rowSub, { color: theme.textSecondary }]}>{subLabel}</Text>
      </View>
      <Feather name={statusIcon.name} size={22} color={statusIcon.color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  summaryRow: { paddingHorizontal: 20, paddingBottom: 16, gap: 4 },
  summaryText: { fontSize: 14, color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  summarySub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_400Regular', textAlign: 'right' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: colors.radius, padding: 14,
  },
  numberBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  rowTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  rowSub: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'right', marginTop: 2 },
});
