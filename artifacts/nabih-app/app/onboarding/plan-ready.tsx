import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, useColorScheme,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { useApp } from '@/src/context/AppContext';

const GOAL_LABELS: Record<string, string> = {
  work: 'English للعمل',
  travel: 'English للسفر',
  daily: 'الحياة اليومية',
  academic: 'Academic English',
};

export default function PlanReadyScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const { goal } = useLocalSearchParams<{ goal: string }>();
  const { completeOnboarding } = useApp();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(checkAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleStart = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await completeOnboarding(goal ?? 'general');
    router.replace('/(tabs)/home');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>

        {/* Check animation */}
        <Animated.View style={[styles.checkWrap, { transform: [{ scale: checkAnim }] }]}>
          <View style={[styles.checkCircle, { backgroundColor: theme.primarySoft }]}>
            <Feather name="check" size={48} color={theme.primary} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.textWrap, { opacity: fadeAnim }]}>
          <Text style={[styles.title, { color: theme.text }]}>خطّتك جاهزة! 🎯</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            بناءً على هدفك:{' '}
            <Text style={{ color: theme.primary, fontFamily: 'Inter_600SemiBold' }}>
              {GOAL_LABELS[goal ?? 'general'] ?? goal}
            </Text>
          </Text>

          {/* Plan preview */}
          <View style={[styles.planCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.planLabel, { color: theme.textSecondary }]}>كيف يعمل نبيه:</Text>
            {[
              { icon: '📖', title: '10 كلمات يوميًا', sub: 'من قائمة Oxford 3000 الأساسية' },
              { icon: '🎯', title: 'تعلّم وتدرّب واكتب', sub: 'أربع مراحل قصيرة لكل دفعة كلمات' },
              { icon: '🔁', title: 'مراجعة ذكية متباعدة', sub: 'تعود لكل كلمة في الوقت الأمثل لتثبيتها' },
            ].map((item, index) => (
              <View key={item.title} style={styles.planRow}>
                <View style={[styles.planDot, { backgroundColor: theme.primary }]}>
                  <Text style={styles.planDotText}>{item.icon}</Text>
                </View>
                <View style={styles.planRowText}>
                  <Text style={[styles.planModuleTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.planModuleCount, { color: theme.textSecondary }]}>
                    {item.sub}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.tip, { backgroundColor: theme.primarySoft }]}>
            <Feather name="zap" size={16} color={theme.primary} />
            <Text style={[styles.tipText, { color: theme.primary }]}>
              سنبدأ بـ 10 كلمات فقط — التعلّم التدريجي يُثبّت المعرفة
            </Text>
          </View>
        </Animated.View>

        {/* Start button */}
        <Animated.View style={[styles.btnWrap, { opacity: fadeAnim }]}>
          <Pressable
            style={({ pressed }) => [
              styles.startBtn,
              { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={handleStart}
          >
            <Text style={styles.startBtnText}>ابدأ مع نبيه ✨</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1, paddingHorizontal: 24, alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkWrap: { alignItems: 'center', marginTop: 20 },
  checkCircle: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  textWrap: { width: '100%', gap: 16 },
  title: {
    fontSize: 30, fontFamily: 'Inter_700Bold',
    textAlign: 'center', marginBottom: 4,
  },
  subtitle: { fontSize: 16, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  planCard: {
    borderWidth: 1, borderRadius: colors.radius,
    padding: 20, gap: 16,
  },
  planLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', textAlign: 'right' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  planDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  planDotText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
  planRowText: { flex: 1 },
  planModuleTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  planModuleCount: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  tip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: colors.radius,
  },
  tipText: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 20, textAlign: 'right' },
  btnWrap: { width: '100%' },
  startBtn: {
    paddingVertical: 18, borderRadius: colors.radius,
    alignItems: 'center', justifyContent: 'center',
  },
  startBtnText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
});
