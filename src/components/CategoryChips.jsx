import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';

export default function CategoryChips() {
  const router = useRouter();
  const [cats, setCats] = useState([]);

  useEffect(() => {
    supabase
      .from('categorias')
      .select('id, nombre, emoji')
      .is('id_padre', null)
      .order('nombre')
      .then(({ data, error }) => {
        if (error) console.log('ERROR CHIPS:', error.message);
        setCats(data ?? []);
      });
  }, []);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <TouchableOpacity style={[styles.chip, styles.chipActive]} activeOpacity={0.8}>
        <Text style={styles.emoji}>🛒</Text>
        <Text style={[styles.text, styles.textActive]}>Todo</Text>
      </TouchableOpacity>

      {cats.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={styles.chip}
          activeOpacity={0.8}
          onPress={() => router.push(`/categoria/${cat.id}`)}
        >
          <Text style={styles.emoji}>{cat.emoji || '🛒'}</Text>
          <Text style={styles.text}>{cat.nombre}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, paddingVertical: 8, gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  chipActive: { borderColor: PRIMARY, backgroundColor: '#fff0ee' },
  emoji: { fontSize: 16 },
  text: { fontSize: 13, fontWeight: '600', color: '#444' },
  textActive: { color: PRIMARY },
});