import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY = '#C21807';

const MOCK_CARRITO = [
  {
    id: '1',
    nombre: 'Manzana Roja',
    precio: 990,
    cantidad: 2,
    imagen: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400',
  },
  {
    id: '2',
    nombre: 'Pechuga de pollo',
    precio: 5290,
    cantidad: 2,
    imagen: 'https://media.istockphoto.com/id/1400102034/es/foto/pechuga-de-pollo-aislada-filete-de-pollo-crudo-sobre-fondo-blanco-aves-de-corral-crudas-carne.jpg?s=612x612&w=0&k=20&c=GGfkxPe4W0qLPRuygj9WPm7wP5IlB_g-26K0IPHpp3g=',
  },
  {
    id: '3',
    nombre: 'Detergente Omo',
    precio: 2990,
    cantidad: 3,
    imagen: 'https://media.falabella.com/tottusCL/20548530_1/w=1200,h=1200,fit=pad',
  },
  {
    id: '4',
    nombre: 'Aceite El Monarca 900ML',
    precio: 3490,
    cantidad: 1,
    imagen: 'https://mantilhuealimentos.cl/wp-content/uploads/2023/10/Aceite-El-Monarca.png',
  },
];

export default function CarritoScreen() {
  const [items, setItems] = useState(MOCK_CARRITO);

  const updateCantidad = (id, delta) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, cantidad: item.cantidad + delta } : item
        )
        .filter((item) => item.cantidad > 0)
    );
  };

  const vaciarCarrito = () => {
    Alert.alert('Vaciar carrito', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Vaciar', style: 'destructive', onPress: () => setItems([]) },
    ]);
  };

  const subtotal = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const delivery = 0; // gratis
  const total = subtotal + delivery;

  const formatCLP = (n) => `$${n.toLocaleString('es-CL')}`;

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.imagen }} style={styles.img} />
      <View style={styles.info}>
        <Text style={styles.nombre} numberOfLines={2}>{item.nombre}</Text>
        <Text style={styles.precio}>{formatCLP(item.precio)}</Text>
      </View>
      <View style={styles.qtyBox}>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => updateCantidad(item.id, -1)}
        >
          <Ionicons
            name={item.cantidad === 1 ? 'trash-outline' : 'remove'}
            size={16}
            color={PRIMARY}
          />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.cantidad}</Text>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => updateCantidad(item.id, 1)}
        >
          <Ionicons name="add" size={16} color={PRIMARY} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Mi carrito</Text>
        </View>
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={80} color="#e0e0e0" />
          <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
          <Text style={styles.emptySubtitle}>Agrega productos para comenzar</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mi carrito</Text>
        <TouchableOpacity onPress={vaciarCarrito}>
          <Text style={styles.vaciar}>Vaciar</Text>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 220 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Resumen fijo abajo */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatCLP(subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Punto Retiro</Text>
          <Text style={[styles.summaryValue, { color: '#1B6B3A' }]}>Gratis</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCLP(total)}</Text>
        </View>

        <TouchableOpacity
          style={styles.btnConfirmar}
          onPress={() => Alert.alert('Pedido', '¡Pedido confirmado! 🎉')}
        >
          <Text style={styles.btnConfirmarText}>Confirmar pedido</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  vaciar: { fontSize: 14, fontWeight: '600', color: PRIMARY },

  // Card producto
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 16,
    padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  img: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#f0f0f0' },
  info: { flex: 1, paddingHorizontal: 12 },
  nombre: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  precio: { fontSize: 16, fontWeight: '800', color: PRIMARY },

  // Cantidad
  qtyBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#f0f0f0',
    borderRadius: 10, overflow: 'hidden',
  },
  qtyBtn: {
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: '#fdecea',
  },
  qtyText: {
    paddingHorizontal: 12, fontSize: 15,
    fontWeight: '800', color: '#1a1a1a',
  },

  separator: { height: 10 },

  // Resumen
  summary: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 10,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 14, color: '#888' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  totalRow: {
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    paddingTop: 12, marginTop: 4, marginBottom: 16,
  },
  totalLabel: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  totalValue: { fontSize: 17, fontWeight: '900', color: PRIMARY },

  btnConfirmar: {
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  btnConfirmarText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  emptySubtitle: { fontSize: 14, color: '#aaa' },
});