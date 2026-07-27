import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';

interface Goal {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  emoji: string;
}

const GOALS: Goal[] = [
  { id: 'work', icon: 'briefcase', emoji: '💼', title: 'English للعمل', subtitle: 'اجتماعات، إيميلات، تقديم عروض' },
  { id: 'travel', icon: 'map', emoji: '✈️', title: 'English للسفر', subtitle: 'مطارات، فنادق، مطاعم' },
  { id: 'daily', icon: 'sun', emoji: '☀️', title: 'الحياة اليومية', subtitle: 'محادثات عامة ومواقف يومية' },
  { id: 'academic', icon: 'book-open', emoji: '🎓', title: 'Academic English', subtitle: 'دراسة، بحث، جامعة' },
];

export default function GoalScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (goalId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(goalId);
  };

  const handleContinue = () => {
    if (!selected) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/onboarding/plan-ready', params: { goal: selected } });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
            <View style={[styles.progressFill, { backgroundColor: theme.primary, width: '50%' }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.textSecondary }]}>خطوة 1 من 2</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: theme.text }]}>ما هدفك من تعلّم الإنجليزية؟</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            اختر هدفك الأساسي — سأبني لك منهجاً مخصصاً
          </Text>
        </View>

        <View style={styles.goals}>
          {GOALS.map((goal) => {
            const isSelected = selected === goal.id;
            return (
              <Pressable
                key={goal.id}
                style={({ pressed }) => [
                  styles.goalCard,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.surface,
                    borderColor: isSelected ? theme.primary : theme.border,
                    borderWidth: 2,
                    opacity: pressed ? 0.85 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
                onPress={() => handleSelect(goal.id)}
              >
                <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                <View style={styles.goalText}>
                  <Text style={[styles.goalTitle, { color: isSelected ? '#FFFFFF' : theme.text }]}>
                    {goal.title}
                  </Text>
                  <Text style={[styles.goalSubtitle, { color: isSelected ? 'rgba(255,255,255,0.75)' : theme.textSecondary }]}>
                    {goal.subtitle}
                  </Text>
                </View>
                {isSelected && <Feather name="check-circle" size={22} color="#FFFFFF" />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Continue button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.continueBtn,
            {
              backgroundColor: selected ? theme.primary : theme.border,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={[styles.continueBtnText, { color: selected ? '#FFFFFF' : theme.muted }]}>
            استمر
          </Text>
          <Feather name="arrow-left" size={20} color={selected ? '#FFFFFF' : theme.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  progressWrap: { gap: 8 },
  progressBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  scroll: { paddingHorizontal: 20 },
  titleWrap: { marginBottom: 28 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', marginBottom: 8, textAlign: 'right' },
  subtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22, textAlign: 'right' },
  goals: { gap: 12 },
  goalCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 18, borderRadius: colors.radius,
  },
  goalEmoji: { fontSize: 30, width: 44, textAlign: 'center' },
  goalText: { flex: 1 },
  goalTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  goalSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2, textAlign: 'right' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 16,
  },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18, borderRadius: colors.radius,
  },
  continueBtnText: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
});
