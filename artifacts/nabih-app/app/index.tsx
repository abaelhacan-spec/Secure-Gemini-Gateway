import { useEffect } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '@/src/context/AppContext';
import colors from '@/constants/colors';

export default function Index() {
  const { isReady, isOnboarded } = useApp();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  useEffect(() => {
    if (!isReady) return;

    if (isOnboarded) {
      router.replace('/(tabs)/home');
    } else {
      router.replace('/onboarding/welcome');
    }
  }, [isReady, isOnboarded]);

  return <View style={[styles.container, { backgroundColor: theme.primary }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
