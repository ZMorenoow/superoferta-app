import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScannerOverlay from '../../components/ScannerOverlay';
import { supabase } from '../../utils/supabase';

const PRIMARY = '#C21807';
const VERDE = '#1B6B3A';

const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

// Compara códigos ignorando ceros iniciales (UPC-A y EAN-13 del mismo producto).
const normalizar = (c) => String(c ?? '').replace(/\D/g, '').replace(/^0+/, '');

const PAUSA_TRAS_ESCANEO = 1200; // ms de espera después de cada escaneo
const AUSENCIA_MINIMA = 1000;    // ms que el código debe desaparecer para contar otra vez

const MOTIVOS = ['Sin stock', 'En mal estado', 'No lo encuentro'];

export default function PedidoScreen() {
  const router = useRouter();

  // Si no hay pantalla anterior (p. ej. recarga directa en esta ruta), va al inicio.
  const volver = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/picker');
  };

  const { id, pedido: pedidoParam } = useLocalSearchParams();

  // Acepta ?id=<uuid> o el parámetro "pedido" (JSON) que ya mandaba la lista.
  let pedidoId = id;
  if (!pedidoId && pedidoParam) {
    try {
      pedidoId = JSON.parse(pedidoParam).id;
    } catch {
      pedidoId = null;
    }
  }

  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, texto }
  const procesando = useRef(false);
  const ultimaLectura = useRef({ codigo: null, t: 0 });
  const [permiso, pedirPermiso] = useCameraPermissions();

  // Reporte de producto faltante
  const [faltante, setFaltante] = useState(null); // item seleccionado
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [sugerencia, setSugerencia] = useState('');

  const cargar = useCallback(async () => {
    if (!pedidoId) {
      setLoading(false);
      return;
    }
    // RLS: el picker solo recibe el pedido si está asignado a él.
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id,
        estado,
        total,
        direccion_entrega,
        pedido_items (
          id,
          cantidad,
          cantidad_escaneada,
          precio_unitario,
          estado,
          motivo_faltante,
          sugerencia,
          productos ( nombre, imagen_url, codigo_barra )
        )
      `)
      .eq('id', pedidoId)
      .maybeSingle();

    if (error) {
      console.error('Error cargando pedido', error);
      Alert.alert('Error', 'No se pudo cargar el pedido');
    }
    setPedido(data ?? null);
    setLoading(false);
  }, [pedidoId]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const items = pedido?.pedido_items ?? [];
  const recogidas = (i) => i.cantidad_escaneada || 0;
  const completo = (i) => recogidas(i) >= i.cantidad;
  const esFaltante = (i) => i.estado === 'faltante';
  // Un producto está "resuelto" si se recogió completo o se reportó como faltante.
  const resuelto = (i) => completo(i) || esFaltante(i);
  const completados = items.filter(resuelto).length;
  const todoListo = items.length > 0 && completados === items.length;
  const pct = items.length ? Math.round((completados / items.length) * 100) : 0;

  // Al tocar el primer producto, el pedido pasa de "asignado" a "en preparación".
  const asegurarEnProceso = async () => {
    if (pedido?.estado !== 'asignado') return;
    const { error } = await supabase.rpc('avanzar_pedido', { p_pedido: pedidoId });
    if (error) throw error;
  };

  const abrirEscaner = async () => {
    if (!permiso?.granted) {
      const r = await pedirPermiso();
      if (!r.granted) {
        Alert.alert('Permiso de cámara', 'Activa el permiso de cámara para poder escanear.');
        return;
      }
    }
    setFeedback(null);
    ultimaLectura.current = { codigo: null, t: 0 };
    procesando.current = false;
    setEscaneando(true);
  };

  // Suma 1 unidad en el servidor. Devuelve la nueva cantidad, 'completo' o null si falló.
  const registrarUnidad = async (item) => {
    setTrabajando(true);
    try {
      await asegurarEnProceso();
      const { data, error } = await supabase.rpc('escanear_unidad', { p_item: item.id });
      if (error) throw error;
      const fila = data?.[0];
      if (!fila) return 'completo'; // ya estaba completo, no se sumó nada
      await cargar();
      return fila.nueva_cantidad;
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setTrabajando(false);
    }
  };

  const alEscanear = async ({ data: codigo }) => {
    const ahora = Date.now();
    const objetivo = normalizar(codigo);
    const ult = ultimaLectura.current;

    // El mismo código sigue a la vista (o lo vieron hace poco): no cuenta de nuevo.
    const sigueEnPantalla = ult.codigo === objetivo && ahora - ult.t < AUSENCIA_MINIMA;

    // Se refresca SIEMPRE: mientras el código esté frente a la cámara, el bloqueo se extiende.
    ultimaLectura.current = { codigo: objetivo, t: ahora };

    if (procesando.current || sigueEnPantalla) return;
    procesando.current = true;

    try {
      const item = items.find((i) => normalizar(i.productos?.codigo_barra) === objetivo);

      if (!item) {
        setFeedback({ ok: false, texto: 'Este producto no está en el pedido' });
        return;
      }
      if (esFaltante(item)) {
        setFeedback({
          ok: false,
          texto: `${item.productos?.nombre} ya fue reportado como faltante`,
        });
        return;
      }
      if (completo(item)) {
        setFeedback({
          ok: false,
          texto: `Ya recogiste todas las unidades de ${item.productos?.nombre}`,
        });
        return;
      }

      const nueva = await registrarUnidad(item);
      if (nueva === null) {
        setFeedback({ ok: false, texto: 'No se pudo guardar. Intenta de nuevo.' });
        return;
      }
      if (nueva === 'completo') {
        setFeedback({
          ok: false,
          texto: `Ya recogiste todas las unidades de ${item.productos?.nombre}`,
        });
        return;
      }
      setFeedback({
        ok: true,
        texto: `${item.productos?.nombre}: ${nueva} de ${item.cantidad}`,
      });
    } finally {
      // La pausa se cuenta DESPUÉS de terminar de guardar, no antes.
      setTimeout(() => {
        procesando.current = false;
      }, PAUSA_TRAS_ESCANEO);
    }
  };

  const abrirFaltante = (item) => {
    setMotivo(MOTIVOS[0]);
    setSugerencia('');
    setFaltante(item);
  };

  const cerrarFaltante = () => {
    if (trabajando) return;
    setFaltante(null);
  };

  const enviarFaltante = async () => {
    if (!faltante) return;
    setTrabajando(true);
    try {
      await asegurarEnProceso();
      const { error } = await supabase.rpc('reportar_faltante', {
        p_item: faltante.id,
        p_motivo: motivo,
        p_sugerencia: sugerencia.trim() || null,
      });
      if (error) throw error;
      setFaltante(null);
      setSugerencia('');
      await cargar();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e?.message || 'No se pudo avisar al cliente. Intenta de nuevo.');
    } finally {
      setTrabajando(false);
    }
  };

  const finalizar = () => {
    const hayFaltantes = items.some(esFaltante);
    Alert.alert(
      'Finalizar pedido',
      hayFaltantes
        ? 'Hay productos reportados como faltantes. ¿Está todo lo demás empacado y listo para el retiro?'
        : '¿Está todo empacado y listo para el retiro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async () => {
            setTrabajando(true);
            const { error } = await supabase.rpc('avanzar_pedido', { p_pedido: pedidoId });
            setTrabajando(false);
            if (error) {
              Alert.alert('Error', error.message || 'No se pudo finalizar el pedido');
              return;
            }
            Alert.alert('Pedido completado', 'El pedido quedó listo para retiro.', [
              { text: 'OK', onPress: () => volver() },
            ]);
          },
        },
      ]
    );
  };

  const yaCompletado = pedido?.estado === 'completado' || pedido?.estado === 'entregado';

  const renderProducto = ({ item }) => {
    const listo = completo(item);
    const sinStock = esFaltante(item);
    const parcial = !listo && !sinStock && recogidas(item) > 0;

    return (
      <View
        style={[
          styles.productCard,
          listo && styles.cardEncontrado,
          parcial && styles.cardParcial,
          sinStock && styles.cardFaltante,
        ]}
      >
        {item.productos?.imagen_url ? (
          <Image source={{ uri: item.productos.imagen_url }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.imageVacia]}>
            <Ionicons name="cube-outline" size={24} color="#aaa" />
          </View>
        )}

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.productos?.nombre ?? 'Producto'}
          </Text>
          <Text
            style={[
              styles.productUnit,
              listo && { color: VERDE },
              sinStock && { color: PRIMARY },
            ]}
          >
            {sinStock
              ? `${recogidas(item)} de ${item.cantidad} recogidas · Faltante: ${item.motivo_faltante ?? ''}`
              : `${recogidas(item)} de ${item.cantidad} recogidas`}
          </Text>
          <Text style={styles.productPrice}>
            {formatCLP(Number(item.precio_unitario) * item.cantidad)}
          </Text>
        </View>

        <View style={styles.actions}>
          {listo && <Ionicons name="checkmark-circle" size={28} color={VERDE} />}
          {sinStock && <Ionicons name="alert-circle" size={28} color={PRIMARY} />}
          {!listo && !sinStock && !yaCompletado && (
            <TouchableOpacity
              style={styles.notFoundBtn}
              onPress={() => abrirFaltante(item)}
              disabled={trabajando}
            >
              <Ionicons name="close" size={20} color={PRIMARY} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!pedido) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.vacio}>
          <Text style={styles.vacioTitulo}>No se encontró el pedido</Text>
          <Text style={styles.vacioTexto}>
            Puede que ya esté completado o que no esté asignado a ti.
          </Text>
          <TouchableOpacity style={styles.finalizarBtn} onPress={() => volver()}>
            <Text style={styles.finalizarBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => volver()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            Pedido #{String(pedido.id).slice(0, 8).toUpperCase()}
          </Text>
          <Text style={styles.headerSubtitle}>
            {pedido.direccion_entrega || 'Retiro en tienda'}
          </Text>
        </View>
        <View style={styles.progressCircle}>
          <Text style={styles.progressText}>
            {completados}/{items.length}
          </Text>
        </View>
      </View>

      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressPct}>{pct}%</Text>
      </View>

      {!yaCompletado && (
        <TouchableOpacity style={styles.escanearBtn} onPress={abrirEscaner}>
          <Ionicons name="barcode-outline" size={22} color="#fff" />
          <Text style={styles.escanearTexto}>Escanear producto</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={items}
        renderItem={renderProducto}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total del pedido</Text>
          <Text style={styles.footerTotal}>{formatCLP(pedido.total)}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.finalizarBtn,
            (!todoListo || yaCompletado || trabajando) && styles.finalizarBtnDisabled,
          ]}
          disabled={!todoListo || yaCompletado || trabajando}
          onPress={finalizar}
        >
          {trabajando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.finalizarBtnText}>
              {yaCompletado ? 'Completado' : 'Finalizar pedido'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Escáner */}
      <Modal visible={escaneando} animationType="slide" onRequestClose={() => setEscaneando(false)}>
        <View style={styles.camaraFondo}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
            }}
            onBarcodeScanned={alEscanear}
          />
          <ScannerOverlay
            completados={completados}
            total={items.length}
            feedback={feedback}
            onClose={() => setEscaneando(false)}
          />
        </View>
      </Modal>

      {/* Reporte de producto faltante */}
      <Modal visible={!!faltante} transparent animationType="fade" onRequestClose={cerrarFaltante}>
        <KeyboardAvoidingView
          style={styles.modalFondo}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCaja}>
            <Text style={styles.modalTitulo}>{faltante?.productos?.nombre}</Text>
            <Text style={styles.modalSub}>¿Qué pasó con este producto?</Text>

            <View style={styles.chipsRow}>
              {MOTIVOS.map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMotivo(m)}
                  style={[styles.chip, motivo === m && styles.chipActivo]}
                >
                  <Text style={[styles.chipTexto, motivo === m && { color: PRIMARY }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Sugerencia de reemplazo para el cliente (opcional)"
              placeholderTextColor="#aaa"
              value={sugerencia}
              onChangeText={setSugerencia}
              multiline
              maxLength={200}
            />

            <TouchableOpacity
              style={[styles.finalizarBtn, { alignSelf: 'stretch' }]}
              onPress={enviarFaltante}
              disabled={trabajando}
            >
              {trabajando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.finalizarBtnText}>Avisar al cliente</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={cerrarFaltante} style={{ marginTop: 14 }}>
              <Text style={{ textAlign: 'center', color: '#888', fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 12, color: '#888' },
  progressCircle: {
    backgroundColor: PRIMARY, width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  progressText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  progressBarContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff', gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  progressBarBg: { flex: 1, height: 8, backgroundColor: '#f0f0f0', borderRadius: 4 },
  progressBarFill: { height: 8, backgroundColor: PRIMARY, borderRadius: 4 },
  progressPct: { fontSize: 13, fontWeight: '700', color: PRIMARY, width: 40 },
  list: { padding: 16, paddingBottom: 110 },
  productCard: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 16, marginBottom: 10, padding: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    borderWidth: 2, borderColor: 'transparent',
  },
  cardEncontrado: { borderColor: VERDE, backgroundColor: '#f0fff4' },
  cardParcial: { borderColor: '#E67E22', backgroundColor: '#FFF8F0' },
  cardFaltante: { borderColor: PRIMARY, backgroundColor: '#FFF5F4' },
  productImage: { width: 60, height: 60, borderRadius: 10, resizeMode: 'cover', backgroundColor: '#f5f5f5' },
  imageVacia: { alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, marginLeft: 12, paddingRight: 8 },
  productName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  productUnit: { fontSize: 12, color: '#888', marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginTop: 4 },
  actions: { alignItems: 'center', gap: 8 },
  notFoundBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#fdecea', alignItems: 'center', justifyContent: 'center',
  },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 20, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footerLabel: { fontSize: 12, color: '#888' },
  footerTotal: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  finalizarBtn: {
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24, minWidth: 150, alignItems: 'center',
  },
  finalizarBtnDisabled: { backgroundColor: '#e8a09a' },
  finalizarBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  escanearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14, marginHorizontal: 16, marginTop: 12,
    paddingVertical: 13,
  },
  escanearTexto: { color: '#fff', fontSize: 15, fontWeight: '800' },
  camaraFondo: { flex: 1, backgroundColor: '#000' },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  vacioTitulo: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  vacioTexto: { fontSize: 14, color: '#888', textAlign: 'center' },
  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCaja: { backgroundColor: '#fff', borderRadius: 18, padding: 20 },
  modalTitulo: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  modalSub: { fontSize: 13, color: '#888', marginTop: 4, marginBottom: 14 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18,
    backgroundColor: '#f0f0f0', borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActivo: { backgroundColor: '#fdecea', borderColor: PRIMARY },
  chipTexto: { fontSize: 13, fontWeight: '600', color: '#555' },
  modalInput: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12, padding: 12,
    minHeight: 70, marginBottom: 16, textAlignVertical: 'top', color: '#1a1a1a',
  },
});