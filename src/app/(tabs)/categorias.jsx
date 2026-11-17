import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBar } from '../../context/TabBarContext';
import { supabase } from '../../utils/supabase';

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
      </View>
      {loading ? (
        <ActivityIndicator color="#C21807" style={{ marginTop: 40 }} />
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
              style={[styles.card, { backgroundColor: cat.color || '#f5f5f5' }]}
              activeOpacity={0.8}
              onPress={() => router.push(`/categoria/${cat.id}`)}
            >
              <Text style={styles.emoji}>{cat.emoji || '🛒'}</Text>
              <Text style={styles.cardName}>{cat.nombre}</Text>
              <Ionicons name="chevron-forward" size={16} color="#aaa" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  grid: { paddingHorizontal: 16, paddingBottom: 80 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, padding: 18, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  emoji: { fontSize: 28, marginRight: 14 },
  cardName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
});