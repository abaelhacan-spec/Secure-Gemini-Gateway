import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, useColorScheme,
  KeyboardAvoidingView, Platform, Linking, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import colors from '@/constants/colors';
import { getGeminiApiKey, setGeminiApiKey, clearGeminiApiKey } from '@/lib/ai/apiKey';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [apiKey, setApiKeyState] = useState('');
  const [savedKeyExists, setSavedKeyExists] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const existing = await getGeminiApiKey();
      if (existing) {
        setApiKeyState(existing);
        setSavedKeyExists(true);
      }
    })();
  }, []);

  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) {
      Alert.alert('مطلوب', 'الرجاء إدخال مفتاح API صالح.');
      return;
    }
    setSaving(true);
    await setGeminiApiKey(apiKey.trim());
    setSaving(false);
    setSavedKeyExists(true);
    Alert.alert('تم الحفظ', 'تم حفظ مفتاح Gemini API بنجاح.');
  }, [apiKey]);

  const handleClear = useCallback(() => {
    Alert.alert('حذف المفتاح', 'هل أنت متأكد من حذف مفتاح API؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await clearGeminiApiKey();
          setApiKeyState('');
          setSavedKeyExists(false);
        },
      },
    ]);
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>الإعدادات</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>مفتاح Gemini API</Text>
        <Text style={[styles.sectionDesc, { color: theme.textSecondary }]}>
          يستخدم نبيه مفتاحك الخاص للتواصل مباشرة مع Gemini من هاتفك. لا يمر أي طلب عبر أي خادم وسيط، والمفتاح يُحفظ بشكل مشفّر على جهازك فقط.
        </Text>

        <View style={[styles.inputRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            value={apiKey}
            onChangeText={setApiKeyState}
            placeholder="ألصق مفتاح API هنا"
            placeholderTextColor={theme.muted}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: theme.text }]}
          />
          <Pressable onPress={() => setShowKey((s) => !s)} style={styles.eyeBtn}>
            <Feather name={showKey ? 'eye-off' : 'eye'} size={20} color={theme.muted} />
          </Pressable>
        </View>

        <Pressable
          style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'جارٍ الحفظ...' : 'حفظ المفتاح'}</Text>
        </Pressable>

        {savedKeyExists && (
          <Pressable style={styles.clearBtn} onPress={handleClear}>
            <Text style={[styles.clearBtnText, { color: theme.danger }]}>حذف المفتاح المحفوظ</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.linkBtn}
          onPress={() => Linking.openURL('https://aistudio.google.com/app/apikey')}
        >
          <Feather name="external-link" size={16} color={theme.primary} />
          <Text style={[styles.linkText, { color: theme.primary }]}>
            احصل على مفتاح مجاني من Google AI Studio
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 20, paddingTop: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 8, textAlign: 'right' },
  sectionDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, marginBottom: 20, textAlign: 'right' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'left' },
  eyeBtn: { padding: 6 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  clearBtn: { alignItems: 'center', paddingVertical: 8, marginBottom: 20 },
  clearBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  linkText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
