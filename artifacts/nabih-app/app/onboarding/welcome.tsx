import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Dimensions, useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import colors from '@/constants/colors';

const { height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const avatarAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.spring(avatarAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      {/* Background circles */}
      <View style={[styles.circle1, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
      <View style={[styles.circle2, { backgroundColor: 'rgba(255,255,255,0.04)' }]} />

      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
        {/* Avatar */}
        <Animated.View style={[styles.avatarWrap, { transform: [{ scale: avatarAnim }] }]}>
          <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Text style={styles.avatarEmoji}>🦉</Text>
          </View>
        </Animated.View>

        {/* Text content */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={styles.greeting}>مرحباً، أنا</Text>
          <Text style={styles.name}>نبيه</Text>
          <Text style={styles.tagline}>معلّمك الشخصي للإنجليزية</Text>

          <View style={styles.divider} />

          <Text style={styles.description}>
            لن أعلّمك كلمات فقط.{'\n'}
            سأفهم مستواك وأهدافك{'\n'}
            وأُرافقك في كل خطوة.
          </Text>

          <Text style={[styles.quote, { color: 'rgba(255,255,255,0.7)' }]}>
            "هذا التطبيق يعرفني، يتذكرني،{'\n'}ويتابعني كل يوم."
          </Text>
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[styles.ctaWrap, { opacity: fadeAnim }]}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: '#FFFFFF', opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => router.push('/onboarding/goal')}
          >
            <Text style={[styles.buttonText, { color: theme.primary }]}>ابدأ رحلتك</Text>
            <Feather name="arrow-left" size={20} color={theme.primary} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  circle1: {
    position: 'absolute', width: height * 0.7, height: height * 0.7,
    borderRadius: height * 0.35, top: -height * 0.25, right: -height * 0.2,
  },
  circle2: {
    position: 'absolute', width: height * 0.5, height: height * 0.5,
    borderRadius: height * 0.25, bottom: -height * 0.1, left: -height * 0.15,
  },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32,
  },
  avatarWrap: { alignItems: 'center', marginTop: 20 },
  avatar: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 60 },
  greeting: { fontSize: 22, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontFamily: 'Inter_400Regular' },
  name: { fontSize: 56, color: '#FFFFFF', textAlign: 'center', fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  tagline: { fontSize: 18, color: 'rgba(255,255,255,0.9)', textAlign: 'center', fontFamily: 'Inter_500Medium', marginTop: 4 },
  divider: { width: 40, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginVertical: 24 },
  description: {
    fontSize: 17, color: '#FFFFFF', textAlign: 'center',
    lineHeight: 28, fontFamily: 'Inter_400Regular',
  },
  quote: {
    fontSize: 14, textAlign: 'center', marginTop: 20,
    fontFamily: 'Inter_400Regular', fontStyle: 'italic',
  },
  ctaWrap: { width: '100%' },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18, borderRadius: colors.radius,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
  },
  buttonText: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
});
