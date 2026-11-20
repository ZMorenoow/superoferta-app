import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
const VERDE = '#1B6B3A';

const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

const formatFecha = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const fecha = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
  const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} · ${hora}`;
};

const resumenEntrega = (items) => {
  const entregados = items.filter((i) => i.estado !== 'faltante');
  const unidades = entregados.reduce((s, i) => s + (Number(i.cantidad_escaneada) || 0), 0);
  const monto = entregados.reduce(
    (s, i) => s + (Number(i.cantidad_escaneada) || 0) * Number(i.precio_unitario || 0),
    0
  );
  const faltantes = items.filter((i) => i.estado === 'faltante').length;
  return { productos: entregados.length, unidades, monto, faltantes };
};

export default function HistorialScreen() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);

  const cargar = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }

    const { data, error } = await supabase
      .from('pedido_picker')
      .select(`
        id,
        id_pedido,
        estado,
        fecha_asignacion,
        fecha_completado,
        pedidos (
          id,
          total,
          direccion_entrega,
          created_at,
          pedido_items (
            id,
            cantidad,
            cantidad_escaneada,
            precio_unitario,
            estado
          )
        )
      `)
      .eq('id_picker', user.id)
      .eq('estado', 'completado')
      .order('fecha_completado', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error cargando el historial del picker', error);
      setErrorCarga(true);
      setPedidos([]);
    } else {
      setErrorCarga(false);
      setPedidos(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const totalDinero = pedidos.reduce(
    (s, a) => s + resumenEntrega(a.pedidos?.pedido_items ?? []).monto,
    0
  );

  const abrirDetalle = (idPedido, cuando) => {
    router.push({
      pathname: '/picker/detalle',
      params: { id: idPedido, fecha: cuando ?? '' },
    });
  };

  const renderPedido = ({ item }) => {
    const pedido = item.pedidos;
    const idPedido = pedido?.id ?? item.id_pedido;
    const items = pedido?.pedido_items ?? [];
    const r = resumenEntrega(items);
    const cuando = item.fecha_completado ?? item.fecha_asignacion;
    const hayDiferencia = pedido && Number(pedido.total) !== r.monto;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => abrirDetalle(idPedido, cuando)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pedidoLabel}>Pedido</Text>
            <Text style={styles.pedidoId}>#{String(idPedido).slice(0, 8).toUpperCase()}</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="checkmark-done-outline" size={14} color={VERDE} />
            <Text style={styles.badgeText}>Completado</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color="#888" />
          <Text style={styles.infoText}>{formatFecha(cuando)}</Text>
        </View>

        {pedido ? (
          <>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={14} color="#888" />
              <Text style={styles.infoText}>{pedido.direccion_entrega || 'Retiro en tienda'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="cube-outline" size={14} color="#888" />
              <Text style={styles.infoText}>
                {r.productos} {r.productos === 1 ? 'producto' : 'productos'} · {r.unidades}{' '}
                {r.unidades === 1 ? 'unidad' : 'unidades'}
                {r.faltantes > 0
                  ? ` · ${r.faltantes} ${r.faltantes === 1 ? 'faltante' : 'faltantes'}`
                  : ''}
              </Text>
            </View>
            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.totalLabel}>Total entregado</Text>
                {hayDiferencia && (
                  <Text style={styles.pagadoText}>Pagado: {formatCLP(pedido.total)}</Text>
                )}
              </View>
              <View style={styles.totalRight}>
                <Text style={styles.totalText}>{formatCLP(r.monto)}</Text>
                <Ionicons name="chevron-forward" size={18} color="#bbb" />
              </View>
            </View>
          </>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Historial</Text>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historial</Text>
        {pedidos.length > 0 && (
          <Text style={styles.subtitle}>
            {pedidos.length} {pedidos.length === 1 ? 'pedido completado' : 'pedidos completados'}
            {totalDinero > 0 ? ` · ${formatCLP(totalDinero)}` : ''}
          </Text>
        )}
      </View>

      <FlatList
        data={pedidos}
        keyExtractor={(item) => item.id}
        renderItem={renderPedido}
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
            <Ionicons
              name={errorCarga ? 'alert-circle-outline' : 'checkmark-done-outline'}
              size={44}
              color="#bbb"
            />
            <Text style={styles.emptyText}>
              {errorCarga
                ? 'No se pudo cargar el historial. Desliza hacia abajo para reintentar.'
                : 'Aún no hay pedidos completados'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', paddingHorizontal: 0 },
  subtitle: { fontSize: 13, color: '#888', marginTop: 4 },
  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  pedidoLabel: { fontSize: 12, color: '#888' },
  pedidoId: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: VERDE },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, color: '#666', flex: 1 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f2f2f2',
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: { fontSize: 13, color: '#777', fontWeight: '600' },
  pagadoText: { fontSize: 11, color: '#aaa', marginTop: 2 },
  totalRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  totalText: { fontSize: 16, fontWeight: '800', color: PRIMARY },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80, paddingHorizontal: 30 },
  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center' },
});