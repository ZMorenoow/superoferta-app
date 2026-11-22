import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBar } from '../../context/TabBarContext';
import { supabase } from '../../utils/supabase';

const PRIMARY = '#C21807';
const BG = '#F5F5F7';
const INK = '#1a1a1a';

const { width } = Dimensions.get('window');
const GAP = 12;
const SIDE = 16;
const CARD_W = (width - SIDE * 2 - GAP) / 2;

export default function CategoriasScreen() {
  const { handleScroll } = useTabBar();
  const router = useRouter();
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('categorias')
      .select('id, nombre, emoji, color')
      .is('id_padre', null)
      .order('nombre')
      .then(({ data, error }) => {
        if (error) console.log('ERROR CATEGORIAS:', error.message);
        setCats(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Categorías</Text>
        {!loading && cats.length > 0 && (
          <Text style={styles.subtitle}>
            {cats.length} {cats.length === 1 ? 'categoría' : 'categorías'} para explorar
          </Text>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {cats.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.card, { backgroundColor: cat.color || '#f0f0f2' }]}
              activeOpacity={0.85}
              onPress={() => router.push(`/categoria/${cat.id}`)}
            >
              <View style={styles.emojiCircle}>
                <Text style={styles.emoji}>{cat.emoji || '🛒'}</Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.cardName} numberOfLines={2}>{cat.nombre}</Text>
                <View style={styles.arrow}>
                  <Ionicons name="arrow-forward" size={14} color={INK} />
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {cats.length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="grid-outline" size={64} color="#d8d8d8" />
              <Text style={styles.emptyText}>No hay categorías por ahora</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: INK, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#8a8a8a', fontWeight: '500', marginTop: 2 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GAP,
    paddingHorizontal: SIDE, paddingBottom: 120,
  },
  card: {
    width: CARD_W, minHeight: 140, borderRadius: 24, padding: 14,
    justifyContent: 'space-between',
    boxShadow: '0px 3px 12px rgba(0,0,0,0.06)',
  },
  emojiCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 28 },
  cardFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 16 },
  cardName: { flex: 1, fontSize: 15, fontWeight: '800', color: INK, lineHeight: 19, letterSpacing: -0.2 },
  arrow: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },

  emptyBox: { width: '100%', alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { fontSize: 15, color: '#aaa' },
});