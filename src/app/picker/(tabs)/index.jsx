import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../utils/supabase';

const PRIMARY = '#C21807';

const ESTADO_CONFIG = {
  asignado: { color: '#2563EB', bg: '#DBEAFE', label: 'Por preparar' },
  en_proceso: { color: '#7C3AED', bg: '#EDE9FE', label: 'En preparación' },
};

const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

export default function PickerHome() {
  const router = useRouter();
  const [nombre, setNombre] = useState('Picker');
  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const cargarNombre = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('perfiles')
        .select('nombre')
        .eq('id', user.id)
        .single();
      if (data?.nombre) setNombre(data.nombre);
    };
    cargarNombre();
  }, []);

  const cargar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }

    // RLS ya limita esto a los pedidos asignados a este picker.
    const { data, error } = await supabase
      .from('pedido_picker')
      .select(`
        id,
        estado,
        fecha_asignacion,
        pedidos (
          id,
          total,
          direccion_entrega,
          created_at,
          pedido_items ( id, cantidad, cantidad_escaneada )
        )
      `)
      .eq('id_picker', user.id)
      .neq('estado', 'completado')
      .order('fecha_asignacion', { ascending: true });

    if (error) {
      console.error('Error cargando pedidos del picker', error);
    } else {
      setAsignaciones((data || []).filter((a) => a.pedidos));
    }
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  // Se actualiza al volver a la pantalla y cada 30 s para ver pedidos nuevos.
  useFocusEffect(
    useCallback(() => {
      cargar();
      const t = setInterval(cargar, 30000);
      return () => clearInterval(t);
    }, [cargar])
  );

  const totalUnidades = asignaciones.reduce(
    (s, a) => s + (a.pedidos.pedido_items || []).reduce((x, i) => x + i.cantidad, 0),
    0
  );
  const totalDinero = asignaciones.reduce((s, a) => s + Number(a.pedidos.total || 0), 0);

  const renderPedido = ({ item }) => {
    const pedido = item.pedidos;
    const items = pedido.pedido_items || [];
    const estado = ESTADO_CONFIG[item.estado] ?? ESTADO_CONFIG.asignado;
    const listos = items.filter((i) => (i.cantidad_escaneada || 0) >= i.cantidad).length;
    const hora = new Date(pedido.created_at).toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/picker/pedido', params: { id: pedido.id } })}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.pedidoId}>Pedido</Text>
            <Text style={styles.clienteName}>
              #{String(pedido.id).slice(0, 8).toUpperCase()}
            </Text>
          </View>
          <View style={[styles.estadoBadge, { backgroundColor: estado.bg }]}>
            <Text style={[styles.estadoText, { color: estado.color }]}>{estado.label}</Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color="#888" />
            <Text style={styles.infoText}>{pedido.direccion_entrega || 'Retiro en tienda'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={14} color="#888" />
            <Text style={styles.infoText}>Pagado a las {hora}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={14} color="#888" />
            <Text style={styles.infoText}>
              {items.length} {items.length === 1 ? 'producto' : 'productos'}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progreso</Text>
            <Text style={styles.progressCount}>{listos}/{items.length}</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${items.length ? (listos / items.length) * 100 : 0}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.totalText}>{formatCLP(pedido.total)}</Text>
          <View style={styles.startBtn}>
            <Text style={styles.startBtnText}>
              {listos > 0 || item.estado === 'en_proceso' ? 'Continuar' : 'Iniciar picking'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={PRIMARY} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {nombre} 👋</Text>
          <Text style={styles.title}>Tus pedidos de hoy</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          }}
        >
          <Ionicons name="log-out-outline" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{asignaciones.length}</Text>
          <Text style={styles.statLabel}>Pedidos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{totalUnidades}</Text>
          <Text style={styles.statLabel}>Unidades</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{formatCLP(totalDinero)}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={asignaciones}
          renderItem={renderPedido}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                cargar();
              }}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-outline" size={64} color="#d8d8d8" />
              <Text style={styles.emptyTitle}>No tienes pedidos pendientes</Text>
              <Text style={styles.emptyText}>
                Los pedidos pagados de tu sucursal aparecerán aquí.
              </Text>
            </View>
          }
        />
      )}
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
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
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
    backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 14,
  },
  pedidoId: { fontSize: 12, color: '#888', fontWeight: '600' },
  clienteName: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginTop: 2 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  estadoText: { fontSize: 12, fontWeight: '700' },
  cardInfo: { gap: 6, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: '#555' },
  progressContainer: { marginBottom: 16 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12, color: '#888' },
  progressCount: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  progressBar: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: PRIMARY, borderRadius: 3 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalText: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  startBtnText: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 30, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center' },
});