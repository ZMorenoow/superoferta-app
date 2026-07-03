import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBar } from '../../context/TabBarContext';
import { useCartStore } from '../../store/cartStore';

const PRIMARY = '#C21807';

const OFERTAS = [
  { id: '1', name: 'Manzana Roja', unit: 'kg', price: 1490, original_price: 1990, discount: 25, image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400', stock: 10 },
  { id: '2', name: 'Pechuga de Pollo', unit: 'kg', price: 4990, original_price: 6490, discount: 23, image_url: 'https://media.istockphoto.com/id/1400102034/es/foto/pechuga-de-pollo-aislada-filete-de-pollo-crudo-sobre-fondo-blanco-aves-de-corral-crudas-carne.jpg?s=612x612&w=0&k=20&c=GGfkxPe4W0qLPRuygj9WPm7wP5IlB_g-26K0IPHpp3g=', stock: 5 },
  { id: '5', name: 'Brócoli', unit: 'unidad', price: 990, original_price: 1290, discount: 23, image_url: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400', stock: 8 },
  { id: '6', name: 'Coca-Cola', unit: '1.5L', price: 1290, original_price: 1590, discount: 19, image_url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400', stock: 15 },
  { id: '8', name: 'Detergente Omo', unit: '2,7kg', price: 2990, original_price: 3990, discount: 25, image_url: 'https://media.falabella.com/tottusCL/20548530_1/w=1200,h=1200,fit=pad', stock: 6 },
];

export default function OfertasScreen() {
  const { addItem } = useCartStore();
  const { handleScroll } = useTabBar();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ofertas</Text>
        <Text style={styles.subtitle}>Precios rebajados por tiempo limitado 🔥</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {OFERTAS.map((item) => (
          <View key={item.id} style={styles.card}>
            <Image source={{ uri: item.image_url }} style={styles.image} />
            <View style={styles.info}>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{item.discount}%</Text>
              </View>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.unit}>{item.unit}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>${item.price.toLocaleString('es-CL')}</Text>
                <Text style={styles.originalPrice}>${item.original_price.toLocaleString('es-CL')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, item.stock === 0 && styles.addBtnDisabled]}
              onPress={() => addItem(item)}
              disabled={item.stock === 0}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  image: { width: 90, height: 90, resizeMode: 'cover' },
  info: { flex: 1, padding: 12 },
  discountBadge: {
    backgroundColor: PRIMARY, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, marginBottom: 6,
  },
  discountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  name: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  unit: { fontSize: 11, color: '#aaa', marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  price: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  originalPrice: { fontSize: 12, color: '#aaa', textDecorationLine: 'line-through' },
  addBtn: {
    backgroundColor: PRIMARY, width: 40, height: 40,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  addBtnDisabled: { backgroundColor: '#ccc' },
});