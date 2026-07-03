import { Ionicons } from '@expo/vector-icons';
import {
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBar } from '../../context/TabBarContext';

const CATEGORIES = [
  { id: 'frutas', name: 'Frutas', emoji: '🍎', color: '#fff0f0' },
  { id: 'verduras', name: 'Verduras', emoji: '🥦', color: '#f0fff4' },
  { id: 'lacteos', name: 'Lácteos', emoji: '🥛', color: '#f0f8ff' },
  { id: 'carnes', name: 'Carnes', emoji: '🥩', color: '#fff5f5' },
  { id: 'panaderia', name: 'Panadería', emoji: '🍞', color: '#fffbf0' },
  { id: 'bebidas', name: 'Bebidas', emoji: '🥤', color: '#f0f0ff' },
  { id: 'limpieza', name: 'Limpieza', emoji: '🧹', color: '#f5f0ff' },
  { id: 'congelados', name: 'Congelados', emoji: '🧊', color: '#f0fbff' },
  { id: 'snacks', name: 'Snacks', emoji: '🍿', color: '#fffff0' },
  { id: 'mascotas', name: 'Mascotas', emoji: '🐾', color: '#fff8f0' },
];

export default function CategoriasScreen() {
  const { handleScroll } = useTabBar();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Categorías</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.card, { backgroundColor: cat.color }]}
            activeOpacity={0.8}
          >
            <Text style={styles.emoji}>{cat.emoji}</Text>
            <Text style={styles.cardName}>{cat.name}</Text>
            <Ionicons name="chevron-forward" size={16} color="#aaa" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
  },
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