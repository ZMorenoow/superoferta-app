import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY = '#C21807';

const MOCK_PEDIDOS = [
  {
    id: 'P001',
    cliente: 'Juan Pérez',
    direccion: 'Av. caupolicán 5414',
    hora: '14:30',
    total: 18450,
    estado: 'pendiente',
    productos: [
      { id: '1', name: 'Manzana Roja', unit: 'kg', price: 1490, quantity: 2, image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400', encontrado: null },
      { id: '3', name: 'Leche Entera', unit: '1L', price: 990, quantity: 3, image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400', encontrado: null },
      { id: '5', name: 'Brócoli', unit: 'unidad', price: 990, quantity: 1, image_url: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=400', encontrado: null },
      { id: '6', name: 'Coca-Cola', unit: '1.5L', price: 1290, quantity: 2, image_url: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400', encontrado: null },
      { id: '7', name: 'Plátano', unit: 'kg', price: 890, quantity: 1, image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400', encontrado: null },
    ],
  },
  {
    id: 'P002',
    cliente: 'María González',
    direccion: 'Las Heras 567',
    hora: '15:00',
    total: 12990,
    estado: 'pendiente',
    productos: [
      { id: '2', name: 'Pechuga de Pollo', unit: 'kg', price: 4990, quantity: 1, image_url: 'https://images.unsplash.com/photo-1604503468506-a8da13d11d36?w=400', encontrado: null },
      { id: '9', name: 'Queso Gouda', unit: '250g', price: 2490, quantity: 2, image_url: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400', encontrado: null },
      { id: '4', name: 'Pan Marraqueta', unit: 'unidad', price: 150, quantity: 4, image_url: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc7b?w=400', encontrado: null },
    ],
  },
];

const ESTADO_CONFIG = {
  pendiente: { color: '#E67E22', bg: '#FFF3E0', label: 'Pendiente' },
  en_proceso: { color: '#1B6B3A', bg: '#E8F5E9', label: 'En proceso' },
  completado: { color: '#888', bg: '#f0f0f0', label: 'Completado' },
};

export default function PickerHome() {
  const router = useRouter();
  const [nombre, setNombre] = useState('Picker');

  useEffect(() => {
    AsyncStorage.getItem('@user_nombre').then((n) => { if (n) setNombre(n); });
  }, []);

  const renderPedido = ({ item }) => {
    const estado = ESTADO_CONFIG[item.estado];
    const progreso = item.productos.filter((p) => p.encontrado !== null).length;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/picker/pedido', params: { pedido: JSON.stringify(item) } })}
        activeOpacity={0.85}
      >
        {/* Header del card */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.pedidoId}>Pedido #{item.id}</Text>
            <Text style={styles.clienteName}>{item.cliente}</Text>
          </View>
          <View style={[styles.estadoBadge, { backgroundColor: estado.bg }]}>
            <Text style={[styles.estadoText, { color: estado.color }]}>{estado.label}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color="#888" />
            <Text style={styles.infoText}>{item.direccion}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={14} color="#888" />
            <Text style={styles.infoText}>Retiro: {item.hora}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={14} color="#888" />
            <Text style={styles.infoText}>{item.productos.length} productos</Text>
          </View>
        </View>

        {/* Progreso */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progreso</Text>
            <Text style={styles.progressCount}>{progreso}/{item.productos.length}</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(progreso / item.productos.length) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.totalText}>${item.total.toLocaleString('es-CL')}</Text>
          <View style={styles.startBtn}>
            <Text style={styles.startBtnText}>
              {progreso > 0 ? 'Continuar' : 'Iniciar picking'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={PRIMARY} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {nombre} 👋</Text>
          <Text style={styles.title}>Tus pedidos de hoy</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            await AsyncStorage.removeItem('@auth_token');
            await AsyncStorage.removeItem('@user_rol');
            router.replace('/login');
          }}
        >
          <Ionicons name="log-out-outline" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{MOCK_PEDIDOS.length}</Text>
          <Text style={styles.statLabel}>Pedidos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>
            {MOCK_PEDIDOS.reduce((s, p) => s + p.productos.length, 0)}
          </Text>
          <Text style={styles.statLabel}>Productos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>
            ${MOCK_PEDIDOS.reduce((s, p) => s + p.total, 0).toLocaleString('es-CL')}
          </Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <FlatList
        data={MOCK_PEDIDOS}
        renderItem={renderPedido}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 8, paddingBottom: 16,
  },
  greeting: { fontSize: 13, color: '#888' },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  logoutBtn: { padding: 8 },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: 16,
    gap: 10, marginBottom: 16,
  },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  statNum: { fontSize: 18, fontWeight: '800', color: PRIMARY },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 18,
    padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 14,
  },
  pedidoId: { fontSize: 12, color: '#888', fontWeight: '600' },
  clienteName: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginTop: 2 },
  estadoBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  estadoText: { fontSize: 12, fontWeight: '700' },
  cardInfo: { gap: 6, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: '#555' },
  progressContainer: { marginBottom: 16 },
  progressHeader: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6,
  },
  progressLabel: { fontSize: 12, color: '#888' },
  progressCount: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  progressBar: {
    height: 6, backgroundColor: '#f0f0f0', borderRadius: 3,
  },
  progressFill: {
    height: 6, backgroundColor: PRIMARY, borderRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  totalText: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  startBtnText: { fontSize: 14, fontWeight: '700', color: PRIMARY },
});