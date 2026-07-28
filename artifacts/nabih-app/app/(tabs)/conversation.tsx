import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  useColorScheme, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { useApp } from '@/src/context/AppContext';
import {
  getConversationHistory, addConversationMessage,
  type ConversationMessage,
} from '@/src/db/database';
import { useAiConversationTurn } from '@/lib/ai/hooks';

const SESSION_ID = `session-${new Date().toISOString().split('T')[0]}`;

const WELCOME_MESSAGE: ConversationMessage = {
  id: 'welcome',
  sessionId: SESSION_ID,
  role: 'assistant',
  content: "Hello! I'm Nabih, your personal English teacher. 🦉\nLet's practice together! You can talk to me about anything. I'll keep it simple for your level. What's on your mind today?",
  createdAt: new Date().toISOString(),
};

export default function ConversationScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;
  const { buildMemorySnapshot } = useApp();

  const [messages, setMessages] = useState<ConversationMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const conversationMutation = useAiConversationTurn();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const history = await getConversationHistory(SESSION_ID, 50);
    if (history.length > 0) {
      setMessages([WELCOME_MESSAGE, ...history]);
    }
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    setIsThinking(true);

    // Add user message immediately
    const userMsg: ConversationMessage = {
      id: Date.now().toString(),
      sessionId: SESSION_ID,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [userMsg, ...prev]);
    await addConversationMessage(SESSION_ID, 'user', text);

    try {
      const memory = await buildMemorySnapshot();
      const history = messages.slice(0, 10).reverse().map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const result = await conversationMutation.mutateAsync({
        data: {
          userMessage: text,
          conversationHistory: history,
          userMemory: memory,
        },
      });

      const aiMsg: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        sessionId: SESSION_ID,
        role: 'assistant',
        content: result.reply,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [aiMsg, ...prev]);
      await addConversationMessage(SESSION_ID, 'assistant', result.reply);

      // Show suggested response if available
      if (result.suggestedResponse) {
        const suggestionMsg: ConversationMessage = {
          id: (Date.now() + 2).toString(),
          sessionId: SESSION_ID,
          role: 'assistant',
          content: `💡 يمكنك أن تقول: "${result.suggestedResponse}"`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [suggestionMsg, ...prev]);
      }
    } catch {
      const errMsg: ConversationMessage = {
        id: (Date.now() + 1).toString(),
        sessionId: SESSION_ID,
        role: 'assistant',
        content: 'أنت غير متصل الآن. سأرد عليك فور عودة الاتصال 🔌',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [errMsg, ...prev]);
    } finally {
      setIsThinking(false);
    }
  }, [input, isThinking, messages, buildMemorySnapshot]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.headerInner}>
          <View style={[styles.nabihAvatar, { backgroundColor: theme.primarySoft }]}>
            <Text style={{ fontSize: 24 }}>🦉</Text>
          </View>
          <View style={styles.nabihInfo}>
            <Text style={[styles.nabihName, { color: theme.text }]}>نبيه</Text>
            <Text style={[styles.nabihSub, { color: theme.success }]}>● متاح الآن</Text>
          </View>
        </View>
      </View>

      {/* Messages — inverted FlatList */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        inverted
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.messagesList, { paddingTop: 12, paddingBottom: 12 }]}
        ListHeaderComponent={
          isThinking ? (
            <View style={[styles.thinkingBubble, { backgroundColor: theme.primarySoft }]}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.thinkingText, { color: theme.primary }]}>نبيه يفكر...</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isAI = item.role === 'assistant';
          return (
            <View style={[styles.messageRow, isAI ? styles.messageRowAI : styles.messageRowUser]}>
              {isAI && <Text style={styles.messageAvatar}>🦉</Text>}
              <View
                style={[
                  styles.bubble,
                  isAI
                    ? [styles.bubbleAI, { backgroundColor: theme.surface, borderColor: theme.border }]
                    : [styles.bubbleUser, { backgroundColor: theme.primary }],
                ]}
              >
                <Text style={[
                  styles.bubbleText,
                  { color: isAI ? theme.text : '#FFFFFF' },
                ]}>
                  {item.content}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Input bar */}
      <View style={[
        styles.inputBar,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingBottom: insets.bottom + 8,
        },
      ]}>
        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: input.trim() ? theme.primary : theme.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          onPress={handleSend}
          disabled={!input.trim() || isThinking}
        >
          <Feather name="send" size={18} color={input.trim() ? '#FFFFFF' : theme.muted} />
        </Pressable>
        <TextInput
          style={[styles.textInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
          placeholder="اكتب بالإنجليزية..."
          placeholderTextColor={theme.muted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          textAlign="right"
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nabihAvatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  nabihInfo: { flex: 1 },
  nabihName: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  nabihSub: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  messagesList: { paddingHorizontal: 16 },
  messageRow: { marginBottom: 12 },
  messageRowAI: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  messageRowUser: { flexDirection: 'row-reverse' },
  messageAvatar: { fontSize: 20, marginBottom: 4 },
  bubble: {
    maxWidth: '80%', borderRadius: 16, padding: 12,
  },
  bubbleAI: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  thinkingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', marginLeft: 52, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
  },
  thinkingText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1, borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, fontFamily: 'Inter_400Regular',
    maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
});
