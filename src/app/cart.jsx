import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';

// Horarios de retiro: bloques de 30 min entre 09:00 y 21:00
const HORA_INICIO = 9;
const HORA_FIN = 21;
const MINUTOS_ANTICIPACION = 60;

export const generarHorarios = (dia, ahora = new Date()) => {
  const slots = [];
  const minimo = new Date(ahora.getTime() + MINUTOS_ANTICIPACION * 60000);
  for (let h = HORA_INICIO; h <= HORA_FIN; h++) {
    for (const m of [0, 30]) {
      if (h === HORA_FIN && m === 30) continue;
      const d = new Date(ahora);
      d.setDate(d.getDate() + dia);
      d.setHours(h, m, 0, 0);
      if (d >= minimo) slots.push(d);
    }
  }
  return slots;
};

const formatHora = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function CarritoScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [diaRetiro, setDiaRetiro] = useState(0); // 0 = hoy, 1 = mañana
  const [horaRetiro, setHoraRetiro] = useState(null);

  const cargarCarrito = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.replace('/login');
      return;
    }

    let { data: carrito, error: carritoError } = await supabase
      .from('carrito')
      .select('id')
      .eq('id_cliente', user.id)
      .maybeSingle();

    if (carritoError) {
      Alert.alert('Error', 'No se pudo cargar tu carrito');
      setLoading(false);
      return;
    }

    if (!carrito) {
      const { data: nuevo, error: crearError } = await supabase
        .from('carrito')
        .insert({ id_cliente: user.id })
        .select('id')
        .single();

      if (crearError) {
        Alert.alert('Error', 'No se pudo crear tu carrito');
        setLoading(false);
        return;
      }
      carrito = nuevo;
    }

    const { data: carritoItems, error: itemsError } = await supabase
      .from('carrito_items')
      .select('id, cantidad, precio_unitario, id_producto, productos (nombre, imagen_url)')
      .eq('id_carrito', carrito.id);

    if (itemsError) {
      Alert.alert('Error', 'No se pudieron cargar los productos del carrito');
      setLoading(false);
      return;
    }

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('id_sucursal_preferida')
      .eq('id', user.id)
      .single();

    let porProducto = {};
    const ids = (carritoItems || []).map((ci) => ci.id_producto);
    if (perfil?.id_sucursal_preferida && ids.length > 0) {
      const { data: ps } = await supabase
        .from('producto_sucursal')
        .select('id_producto, precio, stock')
        .eq('id_sucursal', perfil.id_sucursal_preferida)
        .eq('activo', true)
        .in('id_producto', ids);
      porProducto = Object.fromEntries((ps || []).map((p) => [p.id_producto, p]));
    }

    setItems(
      (carritoItems || []).map((ci) => {
        const real = porProducto[ci.id_producto];
        return {
          id: ci.id,
          productoId: ci.id_producto,
          nombre: ci.productos?.nombre ?? 'Producto',
          imagen: ci.productos?.imagen_url,
          precio: real?.precio ?? ci.precio_unitario, 
          stock: real?.stock ?? 0,
          cantidad: ci.cantidad,
        };
      })
    );
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarCarrito();
    }, [cargarCarrito])
  );

  const updateCantidad = async (itemId, delta) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const nuevaCantidad = item.cantidad + delta;

    if (delta > 0 && nuevaCantidad > item.stock) {
      Alert.alert('Sin stock', `Solo quedan ${item.stock} unidades disponibles`);
      return;
    }

    if (nuevaCantidad <= 0) {
      const { error } = await supabase.from('carrito_items').delete().eq('id', itemId);
      if (error) {
        Alert.alert('Error', 'No se pudo eliminar el producto');
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      return;
    }

    const { error } = await supabase
      .from('carrito_items')
      .update({ cantidad: nuevaCantidad })
      .eq('id', itemId);

    if (error) {
      Alert.alert('Error', 'No se pudo actualizar la cantidad');
      return;
    }

    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, cantidad: nuevaCantidad } : i))
    );
  };

  const vaciarCarrito = () => {
    Alert.alert('Vaciar carrito', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Vaciar',
        style: 'destructive',
        onPress: async () => {
          const ids = items.map((i) => i.id);
          if (ids.length === 0) return;

          const { error } = await supabase.from('carrito_items').delete().in('id', ids);
          if (error) {
            Alert.alert('Error', 'No se pudo vaciar el carrito');
            return;
          }
          setItems([]);
        },
      },
    ]);
  };

  const confirmarPedido = async () => {
    if (items.length === 0 || confirmando) return;
    if (!horaRetiro) {
      Alert.alert('Hora de retiro', 'Elige a qué hora vas a retirar tu pedido.');
      return;
    }
    setConfirmando(true);

    try {
      const { data: pedidoId, error: pedidoError } = await supabase.rpc(
        'crear_pedido_desde_carrito',
        { p_hora_retiro: horaRetiro.toISOString() }
      );
      if (pedidoError) throw pedidoError;

      const { data: pago, error: pagoError } = await supabase.functions.invoke(
        'webpay-create',
        { body: { id_pedido: pedidoId } }
      );
      if (pagoError || !pago?.url || !pago?.token) {
        throw pagoError ?? new Error('Respuesta de pago incompleta');
      }

      router.push({
        pathname: '/pago-webpay',
        params: { url: pago.url, token: pago.token, pedido: pedidoId },
      });
    } catch (e) {
      console.error('Error al iniciar el pago', e);
      // Mensajes del servidor que sí conviene mostrar tal cual (sin stock, sin sucursal, etc.).
      const mensajesVisibles = [
        'Stock insuficiente',
        'Producto no disponible',
        'Elige tu sucursal',
        'Hora de retiro',
      ];
      const mostrar = mensajesVisibles.some((m) => e?.message?.startsWith(m));
      Alert.alert(
        'No se pudo continuar',
        mostrar ? e.message : 'No se pudo iniciar el pago. Intenta de nuevo.'
      );
    } finally {
      setConfirmando(false);
    }
  };

  const subtotal = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const delivery = 0;
  const total = subtotal + delivery;

  const formatCLP = (n) => `$${n.toLocaleString('es-CL')}`;

  const Header = ({ mostrarVaciar }) => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
      </TouchableOpacity>
      <Text style={styles.title}>Mi carrito</Text>
      {mostrarVaciar ? (
        <TouchableOpacity onPress={vaciarCarrito}>
          <Text style={styles.vaciar}>Vaciar</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 24 }} />
      )}
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.imagen }} style={styles.img} />
      <View style={styles.info}>
        <Text style={styles.nombre} numberOfLines={2}>{item.nombre}</Text>
        <Text style={styles.precio}>{formatCLP(item.precio)}</Text>
      </View>
      <View style={styles.qtyBox}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCantidad(item.id, -1)}>
          <Ionicons name={item.cantidad === 1 ? 'trash-outline' : 'remove'} size={16} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.cantidad}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCantidad(item.id, 1)}>
          <Ionicons name="add" size={16} color={PRIMARY} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header mostrarVaciar={false} />
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header mostrarVaciar={false} />
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={80} color="#e0e0e0" />
          <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
          <Text style={styles.emptySubtitle}>Agrega productos para comenzar</Text>
        </View>
      </SafeAreaView>
    );
  }

  const horarios = generarHorarios(diaRetiro);

  return (
    <SafeAreaView style={styles.container}>
      <Header mostrarVaciar={true} />

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 240 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          <View style={styles.retiroBox}>
            <Text style={styles.retiroTitle}>¿Cuándo retiras tu pedido?</Text>

            <View style={styles.diaRow}>
              {['Hoy', 'Mañana'].map((label, idx) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.diaBtn, diaRetiro === idx && styles.diaBtnActive]}
                  onPress={() => { setDiaRetiro(idx); setHoraRetiro(null); }}
                >
                  <Text style={[styles.diaText, diaRetiro === idx && styles.diaTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {horarios.length === 0 ? (
              <Text style={styles.sinHorarios}>Ya no hay horarios hoy. Elige "Mañana".</Text>
            ) : (
              <View style={styles.slotsWrap}>
                {horarios.map((d) => {
                  const activo = horaRetiro?.getTime() === d.getTime();
                  return (
                    <TouchableOpacity
                      key={d.getTime()}
                      style={[styles.slot, activo && styles.slotActive]}
                      onPress={() => setHoraRetiro(d)}
                    >
                      <Text style={[styles.slotText, activo && styles.slotTextActive]}>
                        {formatHora(d)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        }
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatCLP(subtotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Punto Retiro</Text>
          <Text style={[styles.summaryValue, { color: '#1B6B3A' }]}>
            {horaRetiro ? `${formatHora(horaRetiro)} hrs` : 'Gratis'}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCLP(total)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.btnConfirmar, !horaRetiro && styles.btnConfirmarDisabled]}
          onPress={confirmarPedido}
          disabled={confirmando}
        >
          {confirmando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnConfirmarText}>
              {horaRetiro ? 'Pagar con Webpay' : 'Elige hora de retiro'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  vaciar: { fontSize: 14, fontWeight: '600', color: PRIMARY },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  img: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#f0f0f0' },
  info: { flex: 1, paddingHorizontal: 12 },
  nombre: { fontSize: 14, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  precio: { fontSize: 16, fontWeight: '800', color: PRIMARY },
  qtyBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#f0f0f0', borderRadius: 10, overflow: 'hidden' },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fdecea' },
  qtyText: { paddingHorizontal: 12, fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  separator: { height: 10 },
  retiroBox: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 16 },
  retiroTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  diaRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  diaBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#f5f5f5' },
  diaBtnActive: { backgroundColor: PRIMARY },
  diaText: { fontWeight: '700', color: '#555' },
  diaTextActive: { color: '#fff' },
  slotsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#e0e0e0' },
  slotActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  slotText: { fontWeight: '700', color: '#1a1a1a' },
  slotTextActive: { color: '#fff' },
  sinHorarios: { fontSize: 13, color: '#999' },
  summary: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#888' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12, marginTop: 4, marginBottom: 16 },
  totalLabel: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  totalValue: { fontSize: 17, fontWeight: '900', color: PRIMARY },
  btnConfirmar: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnConfirmarDisabled: { backgroundColor: '#d9a09a' },
  btnConfirmarText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  emptySubtitle: { fontSize: 14, color: '#aaa' },
});