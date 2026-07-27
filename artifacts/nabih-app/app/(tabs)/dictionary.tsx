import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, useColorScheme, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import colors from '@/constants/colors';
import { getWords, type Word } from '@/src/db/database';

const STAGE_LABELS: Record<string, string> = {
  new: 'جديدة',
  learned: 'تعلّمتها',
  reviewed: 'راجعتها',
  usedInSentence: 'استخدمتها',
  usedInConversation: 'تحدّثت بها',
  mastered: 'أتقنتها',
  needsReview: 'تحتاج مراجعة',
};

const STAGE_ORDER = ['mastered', 'usedInConversation', 'usedInSentence', 'reviewed', 'learned', 'needsReview', 'new'];

export default function DictionaryScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? colors.dark : colors.light;

  const [words, setWords] = useState<Word[]>([]);
  const [filtered, setFiltered] = useState<Word[]>([]);
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const loadWords = useCallback(async () => {
    const all = await getWords();
    const sorted = [...all].sort((a, b) =>
      STAGE_ORDER.indexOf(a.lifecycleStage) - STAGE_ORDER.indexOf(b.lifecycleStage)
    );
    setWords(sorted);
    applyFilter(sorted, search, selectedFilter);
  }, [search, selectedFilter]);

  useEffect(() => { loadWords(); }, []);

  const applyFilter = (allWords: Word[], q: string, stage: string) => {
    let result = allWords;
    if (q.trim()) {
      result = result.filter((w) =>
        w.word.toLowerCase().includes(q.toLowerCase()) ||
        (w.arabicTranslation ?? '').includes(q)
      );
    }
    if (stage !== 'all') {
      result = result.filter((w) => w.lifecycleStage === stage);
    }
    setFiltered(result);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    applyFilter(words, q, selectedFilter);
  };

  const handleFilter = (stage: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFilter(stage);
    applyFilter(words, search, stage);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWords();
    setRefreshing(false);
  };

  const stageColor = (stage: Word['lifecycleStage']): string => {
    const map: Record<string, string> = {
      new: theme.stageNew,
      learned: theme.stageLearned,
      reviewed: theme.stageReviewed,
      usedInSentence: theme.stageReviewed,
      usedInConversation: theme.stageMastered,
      mastered: theme.stageMastered,
      needsReview: theme.stageNeedsReview,
    };
    return map[stage] ?? theme.stageNew;
  };

  const FILTERS = [
    { id: 'all', label: 'الكل' },
    { id: 'mastered', label: '⭐ أتقنتها' },
    { id: 'needsReview', label: '🔁 مراجعة' },
    { id: 'learned', label: '📘 تعلّمتها' },
    { id: 'new', label: '🆕 جديدة' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>قاموسي</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>
          {words.length} كلمة • {words.filter((w) => w.lifecycleStage === 'mastered').length} أُتقنت
        </Text>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="ابحث عن كلمة..."
            placeholderTextColor={theme.muted}
            value={search}
            onChangeText={handleSearch}
            textAlign="right"
          />
        </View>
      </View>

      {/* Stage filter chips */}
      <View style={[styles.filterWrap, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedFilter === item.id ? theme.primary : theme.background,
                  borderColor: selectedFilter === item.id ? theme.primary : theme.border,
                },
              ]}
              onPress={() => handleFilter(item.id)}
            >
              <Text style={[
                styles.filterLabel,
                { color: selectedFilter === item.id ? '#FFFFFF' : theme.textSecondary },
              ]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Words list */}
      <FlatList
        data={filtered}
        keyExtractor={(w) => w.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="book" size={40} color={theme.muted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {words.length === 0
                ? 'لم تتعلّم كلمات بعد\nابدأ أول درس!'
                : 'لا توجد نتائج للبحث'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.wordCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.wordCardContent}>
              <View style={[styles.stageIndicator, { backgroundColor: stageColor(item.lifecycleStage) }]} />
              <View style={styles.wordInfo}>
                <View style={styles.wordRow}>
                  <View style={[styles.stageBadge, { backgroundColor: stageColor(item.lifecycleStage) + '22' }]}>
                    <Text style={[styles.stageBadgeText, { color: stageColor(item.lifecycleStage) }]}>
                      {STAGE_LABELS[item.lifecycleStage] ?? item.lifecycleStage}
                    </Text>
                  </View>
                  <Text style={[styles.wordText, { color: theme.text }]}>{item.word}</Text>
                </View>
                <Text style={[styles.wordAr, { color: theme.textSecondary }]}>
                  {item.arabicTranslation ?? ''}
                </Text>
                {item.definition && (
                  <Text style={[styles.wordDef, { color: theme.muted }]} numberOfLines={2}>
                    {item.definition}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingBottom: 16, gap: 10,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  sub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'right' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: colors.radius,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  filterWrap: { borderBottomWidth: 1 },
  filterList: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  filterLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  list: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 24 },
  wordCard: { borderWidth: 1, borderRadius: colors.radius, overflow: 'hidden' },
  wordCardContent: { flexDirection: 'row' },
  stageIndicator: { width: 4 },
  wordInfo: { flex: 1, padding: 14, gap: 6 },
  wordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  stageBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  stageBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  wordText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  wordAr: { fontSize: 15, fontFamily: 'Inter_500Medium', textAlign: 'right' },
  wordDef: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'right', lineHeight: 18 },
});
