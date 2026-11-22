import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';
const BG = '#F5F5F7';
const INK = '#1a1a1a';

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

const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

export default function CarritoScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [diaRetiro, setDiaRetiro] = useState(0); // 0 = hoy, 1 = mañana
  const [horaRetiro, setHoraRetiro] = useState(null);

  // Cupón activo del usuario y su descuento calculado en el servidor
  const [cupon, setCupon] = useState(null);
  const [descuento, setDescuento] = useState({ monto: 0, motivo: null });

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

  // Busca el cupón activo y pide al servidor cuánto descuenta con el carrito actual
  const calcularCupon = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: filas } = await supabase
      .from('cupones_usuario')
      .select('id_cupon, cupones (id, codigo, descripcion, tipo, valor, minimo_compra, id_categoria, categorias (nombre))')
      .eq('id_usuario', user.id)
      .is('usado_en', null)
      .limit(1);

    const activo = filas?.[0]?.cupones;
    if (!activo) {
      setCupon(null);
      setDescuento({ monto: 0, motivo: null });
      return;
    }

    const { data, error } = await supabase.rpc('calcular_descuento_cupon', {
      p_id_cupon: activo.id,
    });

    setCupon(activo);
    if (error || !data?.[0]) {
      console.error('Error calculando cupón', error);
      setDescuento({ monto: 0, motivo: 'no_disponible' });
      return;
    }
    setDescuento({ monto: data[0].monto_descuento ?? 0, motivo: data[0].motivo ?? null });
  }, []);

  // Recalcula cada vez que cambia el carrito
  useEffect(() => {
    if (!loading) calcularCupon();
  }, [items, loading, calcularCupon]);

  const quitarCupon = async () => {
    if (!cupon) return;
    const { error } = await supabase.rpc('desactivar_cupon', { p_id_cupon: cupon.id });
    if (error) {
      Alert.alert('Error', 'No se pudo quitar el cupón');
      return;
    }
    calcularCupon();
  };

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
      // Solo se envía el cupón si realmente descuenta algo
      const args = { p_hora_retiro: horaRetiro.toISOString() };
      if (cupon && descuento.monto > 0) args.p_id_cupon = cupon.id;

      const { data: pedidoId, error: pedidoError } = await supabase.rpc(
        'crear_pedido_desde_carrito',
        args
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
        'Cupón',
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
  const total = Math.max(0, subtotal + delivery - descuento.monto);
  const cantidadTotal = items.reduce((acc, i) => acc + i.cantidad, 0);

  // Texto del cupón y, si no aplica, el motivo
  const nombreCategoria = cupon?.categorias?.nombre;
  const etiquetaCupon = cupon
    ? `${cupon.tipo === 'porcentaje' ? `${cupon.valor}%` : formatCLP(cupon.valor)} dcto.${
        nombreCategoria ? ` en ${nombreCategoria}` : ''
      }`
    : '';

  const motivoTexto = (() => {
    switch (descuento.motivo) {
      case 'sin_productos':
        return nombreCategoria
          ? `Agrega productos de ${nombreCategoria} para usar tu cupón`
          : 'Agrega productos para usar tu cupón';
      case 'minimo':
        return `Compra mínima de ${formatCLP(cupon?.minimo_compra)}${
          nombreCategoria ? ` en ${nombreCategoria}` : ''
        } para usar tu cupón`;
      case 'no_disponible':
        return 'Tu cupón ya no está disponible';
      default:
        return null;
    }
  })();

  const Header = ({ mostrarVaciar }) => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={22} color={INK} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Mi carrito</Text>
        {mostrarVaciar && (
          <Text style={styles.subtitle}>
            {cantidadTotal} {cantidadTotal === 1 ? 'producto' : 'productos'}
          </Text>
        )}
      </View>
      {mostrarVaciar && (
        <TouchableOpacity onPress={vaciarCarrito} style={styles.vaciarBtn} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={15} color={PRIMARY} />
          <Text style={styles.vaciar}>Vaciar</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.imagen }} style={styles.img} resizeMode="cover" />
      <View style={styles.info}>
        <Text style={styles.nombre} numberOfLines={2}>{item.nombre}</Text>
        <Text style={styles.precio}>{formatCLP(item.precio)}</Text>
      </View>
      <View style={styles.qtyBox}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCantidad(item.id, -1)} activeOpacity={0.7}>
          <Ionicons name={item.cantidad === 1 ? 'trash-outline' : 'remove'} size={16} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.cantidad}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateCantidad(item.id, 1)} activeOpacity={0.7}>
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
          <View style={styles.emptyCircle}>
            <Ionicons name="cart-outline" size={56} color="#cfcfd4" />
          </View>
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 290 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          <View>
            {/* Cupón activo */}
            {cupon && (
              <View style={[styles.cuponBox, descuento.monto === 0 && styles.cuponBoxInactivo]}>
                <View style={styles.cuponIcon}>
                  <Ionicons
                    name="pricetag"
                    size={18}
                    color={descuento.monto > 0 ? '#1B6B3A' : '#B45309'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cuponTitulo}>
                    {descuento.monto > 0 ? 'Cupón aplicado' : 'Cupón sin aplicar'}
                  </Text>
                  <Text style={styles.cuponTexto}>{etiquetaCupon}</Text>
                  {descuento.monto === 0 && !!motivoTexto && (
                    <Text style={styles.cuponMotivo}>{motivoTexto}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={quitarCupon} hitSlop={10}>
                  <Text style={styles.cuponQuitar}>Quitar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Retiro: compacto, las horas se deslizan en una sola fila */}
            <View style={styles.retiroBox}>
              <View style={styles.retiroHeader}>
                <View style={styles.retiroIcon}>
                  <Ionicons name="time-outline" size={18} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.retiroTitle}>Hora de retiro</Text>
                  <Text style={styles.retiroSub}>
                    {horaRetiro
                      ? `${diaRetiro === 0 ? 'Hoy' : 'Mañana'} a las ${formatHora(horaRetiro)} hrs`
                      : 'Elige cuándo pasas a buscarlo'}
                  </Text>
                </View>

                <View style={styles.diaSwitch}>
                  {['Hoy', 'Mañana'].map((label, idx) => (
                    <TouchableOpacity
                      key={label}
                      style={[styles.diaBtn, diaRetiro === idx && styles.diaBtnActive]}
                      onPress={() => { setDiaRetiro(idx); setHoraRetiro(null); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.diaText, diaRetiro === idx && styles.diaTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {horarios.length === 0 ? (
                <Text style={styles.sinHorarios}>Ya no hay horarios hoy. Elige "Mañana".</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.slotsRow}
                >
                  {horarios.map((d) => {
                    const activo = horaRetiro?.getTime() === d.getTime();
                    return (
                      <TouchableOpacity
                        key={d.getTime()}
                        style={[styles.slot, activo && styles.slotActive]}
                        onPress={() => setHoraRetiro(d)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.slotText, activo && styles.slotTextActive]}>
                          {formatHora(d)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        }
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatCLP(subtotal)}</Text>
        </View>
        {descuento.monto > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Descuento cupón</Text>
            <Text style={[styles.summaryValue, { color: '#1B6B3A' }]}>
              -{formatCLP(descuento.monto)}
            </Text>
          </View>
        )}
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
          activeOpacity={0.85}
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
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 3px 10px rgba(0,0,0,0.08)',
  },
  title: { fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: '#9a9a9a', fontWeight: '600', marginTop: 1 },
  vaciarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fdecea', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
  },
  vaciar: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  // Productos
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 20, padding: 12,
    boxShadow: '0px 3px 12px rgba(0,0,0,0.05)',
  },
  img: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#fff' },
  info: { flex: 1, paddingHorizontal: 12 },
  nombre: { fontSize: 14, fontWeight: '600', color: INK, marginBottom: 6, lineHeight: 19 },
  precio: { fontSize: 16, fontWeight: '800', color: PRIMARY, letterSpacing: -0.3 },
  qtyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#f5f5f7', borderRadius: 22, padding: 3,
  },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 1px 4px rgba(0,0,0,0.08)',
  },
  qtyText: { minWidth: 26, textAlign: 'center', fontSize: 15, fontWeight: '800', color: INK },
  separator: { height: 10 },

  // Cupón
  cuponBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#e8f5ed', borderRadius: 20, padding: 14, marginTop: 16,
  },
  cuponBoxInactivo: { backgroundColor: '#fef3c7' },
  cuponIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  cuponTitulo: { fontSize: 13, fontWeight: '800', color: INK },
  cuponTexto: { fontSize: 12, color: '#555', marginTop: 1 },
  cuponMotivo: { fontSize: 12, color: '#B45309', fontWeight: '600', marginTop: 3 },
  cuponQuitar: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  // Retiro (compacto)
  retiroBox: {
    backgroundColor: '#fff', borderRadius: 20, paddingVertical: 14, marginTop: 16,
    boxShadow: '0px 3px 12px rgba(0,0,0,0.05)',
  },
  retiroHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, marginBottom: 12,
  },
  retiroIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#fdecea',
    alignItems: 'center', justifyContent: 'center',
  },
  retiroTitle: { fontSize: 14, fontWeight: '800', color: INK },
  retiroSub: { fontSize: 12, color: '#8a8a8a', marginTop: 1 },
  diaSwitch: {
    flexDirection: 'row', backgroundColor: '#f2f2f4', borderRadius: 18, padding: 3,
  },
  diaBtn: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 15 },
  diaBtnActive: { backgroundColor: PRIMARY },
  diaText: { fontSize: 12, fontWeight: '700', color: '#666' },
  diaTextActive: { color: '#fff' },
  slotsRow: { paddingHorizontal: 14, gap: 8 },
  slot: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18,
    backgroundColor: '#f5f5f7',
  },
  slotActive: { backgroundColor: PRIMARY },
  slotText: { fontSize: 13, fontWeight: '700', color: INK },
  slotTextActive: { color: '#fff' },
  sinHorarios: { fontSize: 13, color: '#999', paddingHorizontal: 14 },

  // Resumen
  summary: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32,
    boxShadow: '0px -4px 16px rgba(0,0,0,0.08)',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#888' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: INK },
  totalRow: { borderTopWidth: 1, borderTopColor: '#f0f0f2', paddingTop: 12, marginTop: 4, marginBottom: 14 },
  totalLabel: { fontSize: 17, fontWeight: '800', color: INK },
  totalValue: { fontSize: 22, fontWeight: '900', color: PRIMARY, letterSpacing: -0.5 },
  btnConfirmar: {
    backgroundColor: PRIMARY, borderRadius: 18, paddingVertical: 16, alignItems: 'center',
    boxShadow: '0px 4px 12px rgba(194,24,7,0.3)',
  },
  btnConfirmarDisabled: { backgroundColor: '#d9a09a', boxShadow: 'none' },
  btnConfirmarText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // Vacío
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyCircle: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    boxShadow: '0px 3px 12px rgba(0,0,0,0.05)',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: INK },
  emptySubtitle: { fontSize: 14, color: '#aaa' },
});