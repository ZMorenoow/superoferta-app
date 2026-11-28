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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ScannerOverlay from '../../components/ScannerOverlay';
import { supabase } from '../../utils/supabase';

const PRIMARY = '#ED1D26';
const ROJO_SUAVE = '#FDECEA';
const VERDE = '#1B6B3A';
const VERDE_SUAVE = '#E6F4EA';
const AMBAR = '#B45309';
const AMBAR_SUAVE = '#FEF3C7';
const INK = '#16181D';
const MUTED = '#6B7280';
const BG = '#F3F4F6';

const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

const formatHoraRetiro = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const hh = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dia =
    d.toDateString() === new Date().toDateString() ? 'Hoy'
    : d.toDateString() === manana.toDateString() ? 'Mañana'
    : d.toLocaleDateString('es-CL');
  return `${dia} ${hh} hrs`;
};

const normalizar = (c) => String(c ?? '').replace(/\D/g, '').replace(/^0+/, '');

const PAUSA_TRAS_ESCANEO = 1200;
const AUSENCIA_MINIMA = 1000;

const MOTIVOS = ['Sin stock', 'En mal estado', 'No lo encuentro'];
const ICONOS_MOTIVO = {
  'Sin stock': 'remove-circle-outline',
  'En mal estado': 'warning-outline',
  'No lo encuentro': 'search-outline',
};

const MIN_FOTOS = 1;
const MAX_FOTOS = 6;

// Alto aproximado del footer sin contar la zona segura inferior
const FOOTER_BASE = 120;

export default function PedidoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Espacio inferior real (barra de 3 botones / gestos de Android, home indicator de iOS)
  const bottomSeguro = Math.max(insets.bottom, 16);

  const volver = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/picker');
  };

  const { id, pedido: pedidoParam } = useLocalSearchParams();

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
  const [feedback, setFeedback] = useState(null);
  const procesando = useRef(false);
  const ultimaLectura = useRef({ codigo: null, t: 0 });
  const [permiso, pedirPermiso] = useCameraPermissions();

  const [faltante, setFaltante] = useState(null);
  const [editando, setEditando] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [sugerencia, setSugerencia] = useState('');

  const camaraRef = useRef(null);
  const [evidenciaAbierta, setEvidenciaAbierta] = useState(false);
  const [fotos, setFotos] = useState([]);
  const [tomando, setTomando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const cargar = useCallback(async () => {
    if (!pedidoId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id,
        id_cliente,
        estado,
        total,
        reembolso_pendiente,
        direccion_entrega,
        hora_retiro,
        cliente:perfiles!id_cliente ( nombre ),
        pedido_items (
          id,
          cantidad,
          cantidad_escaneada,
          precio_unitario,
          estado,
          motivo_faltante,
          sugerencia,
          id_item_origen,
          productos ( nombre, imagen_url, codigo_barra ),
          sustituciones (
            id,
            estado,
            cantidad,
            precio_unitario,
            nota,
            productos ( nombre )
          )
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

      const canal = supabase
        .channel(`picker-pedido-${pedidoId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sustituciones' },
          () => cargar()
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'pedido_items' },
          () => cargar()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(canal);
      };
    }, [cargar, pedidoId])
  );

  const items = pedido?.pedido_items ?? [];
  const recogidas = (i) => i.cantidad_escaneada || 0;
  const completo = (i) => recogidas(i) >= i.cantidad;
  const esFaltante = (i) => i.estado === 'faltante';

  const sustPendiente = (i) => (i.sustituciones ?? []).some((s) => s.estado === 'propuesta');
  const sustAceptada = (i) => (i.sustituciones ?? []).some((s) => s.estado === 'aceptada');
  const sustActual = (i) => {
    const l = i.sustituciones ?? [];
    return (
      l.find((s) => s.estado === 'propuesta') ??
      l.find((s) => s.estado === 'aceptada') ??
      l.find((s) => s.estado === 'rechazada')
    );
  };

  const resuelto = (i) => completo(i) || (esFaltante(i) && !sustPendiente(i));
  const completados = items.filter(resuelto).length;
  const todoListo = items.length > 0 && completados === items.length;
  const hayPendientes = items.some(sustPendiente);
  const pct = items.length ? Math.round((completados / items.length) * 100) : 0;

  const nombreCliente = pedido?.cliente?.nombre?.trim() || 'Cliente';

  const abrirSustituto = (item) => {
    router.push({ pathname: '/picker/sustituto', params: { item: item.id } });
  };

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

  const registrarUnidad = async (item) => {
    setTrabajando(true);
    try {
      await asegurarEnProceso();
      const { data, error } = await supabase.rpc('escanear_unidad', { p_item: item.id });
      if (error) throw error;
      const fila = data?.[0];
      if (!fila) return 'completo';
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

    const sigueEnPantalla = ult.codigo === objetivo && ahora - ult.t < AUSENCIA_MINIMA;

    ultimaLectura.current = { codigo: objetivo, t: ahora };

    if (procesando.current || sigueEnPantalla) return;
    procesando.current = true;

    try {
      const candidatos = items.filter(
        (i) => normalizar(i.productos?.codigo_barra) === objetivo
      );

      const item =
        candidatos.find((i) => !esFaltante(i) && !completo(i)) ??
        candidatos.find((i) => !esFaltante(i)) ??
        candidatos[0];

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
      setTimeout(() => {
        procesando.current = false;
      }, PAUSA_TRAS_ESCANEO);
    }
  };

  const abrirFaltante = (item) => {
    setMotivo(item.motivo_faltante ?? MOTIVOS[0]);
    setSugerencia(item.sugerencia ?? '');
    setEditando(esFaltante(item));
    setFaltante(item);
  };

  const cerrarFaltante = () => {
    if (trabajando) return;
    setFaltante(null);
  };

  const quitarFaltante = async () => {
    if (!faltante) return;
    setTrabajando(true);
    try {
      const { error } = await supabase.rpc('revertir_faltante', { p_item: faltante.id });
      if (error) throw error;
      setFaltante(null);
      await cargar();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e?.message || 'No se pudo quitar el faltante.');
    } finally {
      setTrabajando(false);
    }
  };

  const enviarFaltante = async () => {
    if (!faltante) return;
    const idItem = faltante.id;
    const eraEdicion = editando;

    setTrabajando(true);
    try {
      await asegurarEnProceso();

      if (eraEdicion) {
        const { error: e1 } = await supabase.rpc('revertir_faltante', { p_item: idItem });
        if (e1) throw e1;
      }
      const { error } = await supabase.rpc('reportar_faltante', {
        p_item: idItem,
        p_motivo: motivo,
        p_sugerencia: sugerencia.trim() || null,
      });
      if (error) throw error;

      setFaltante(null);
      setSugerencia('');
      await cargar();

      if (!eraEdicion) {
        Alert.alert('Cliente avisado', '¿Quieres sugerirle un producto de reemplazo?', [
          { text: 'Ahora no', style: 'cancel' },
          {
            text: 'Sugerir reemplazo',
            onPress: () =>
              router.push({ pathname: '/picker/sustituto', params: { item: idItem } }),
          },
        ]);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', e?.message || 'No se pudo avisar al cliente. Intenta de nuevo.');
    } finally {
      setTrabajando(false);
    }
  };

  const abrirEvidencia = async () => {
    if (!permiso?.granted) {
      const r = await pedirPermiso();
      if (!r.granted) {
        Alert.alert('Permiso de cámara', 'Activa el permiso de cámara para sacar las fotos.');
        return;
      }
    }
    setFotos([]);
    setEvidenciaAbierta(true);
  };

  const cerrarEvidencia = () => {
    if (subiendo) return;
    setEvidenciaAbierta(false);
  };

  const tomarFoto = async () => {
    if (!camaraRef.current || tomando || fotos.length >= MAX_FOTOS) return;
    setTomando(true);
    try {
      const foto = await camaraRef.current.takePictureAsync({ quality: 0.5 });
      if (foto?.uri) setFotos((prev) => [...prev, { uri: foto.uri }]);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo tomar la foto. Intenta de nuevo.');
    } finally {
      setTomando(false);
    }
  };

  const quitarFoto = (idx) => setFotos((prev) => prev.filter((_, i) => i !== idx));

  const subirEvidencias = async () => {
    const filas = [];
    for (let i = 0; i < fotos.length; i++) {
      const ruta = `${pedidoId}/${Date.now()}_${i}.jpg`;
      const resp = await fetch(fotos[i].uri);
      const buffer = await resp.arrayBuffer();
      const { error } = await supabase.storage
        .from('evidencias')
        .upload(ruta, buffer, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      filas.push({ id_pedido: pedidoId, ruta });
    }
    const { error } = await supabase.from('pedido_evidencias').insert(filas);
    if (error) throw error;
  };

  const confirmarFinalizar = () => {
    if (fotos.length < MIN_FOTOS) {
      Alert.alert('Faltan fotos', `Saca al menos ${MIN_FOTOS} foto(s) del pedido como evidencia.`);
      return;
    }
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
            setSubiendo(true);
            try {
              await subirEvidencias();
              const { error } = await supabase.rpc('avanzar_pedido', { p_pedido: pedidoId });
              if (error) throw error;
              setEvidenciaAbierta(false);
              setFotos([]);
              Alert.alert('Pedido completado', 'El pedido quedó listo para retiro.', [
                { text: 'OK', onPress: () => volver() },
              ]);
            } catch (e) {
              console.error(e);
              Alert.alert('Error', e?.message || 'No se pudo finalizar el pedido');
            } finally {
              setSubiendo(false);
            }
          },
        },
      ]
    );
  };

  const yaCompletado = pedido?.estado === 'completado' || pedido?.estado === 'entregado';

  const reembolso = Number(pedido?.reembolso_pendiente || 0);
  const totalEntregar = Number(pedido?.total || 0) - reembolso;
  const hayAjuste = reembolso !== 0;

  const renderProducto = ({ item }) => {
    const listo = completo(item);
    const sinStock = esFaltante(item);
    const parcial = !listo && !sinStock && recogidas(item) > 0;
    const sust = sinStock ? sustActual(item) : null;
    const codigo = item.productos?.codigo_barra;

    // Color que resume el estado del producto: riel lateral y pastilla de cantidad
    const colorEstado = listo ? VERDE : sinStock ? PRIMARY : parcial ? AMBAR : MUTED;
    const fondoEstado = listo ? VERDE_SUAVE : sinStock ? ROJO_SUAVE : parcial ? AMBAR_SUAVE : '#F1F2F4';
    const colorRiel = listo ? VERDE : sinStock ? PRIMARY : parcial ? '#E8A33D' : '#D5D8DE';

    let infoSust = null;
    if (sust?.estado === 'propuesta') {
      infoSust = {
        icono: 'hourglass-outline',
        color: AMBAR,
        texto: `Sugeriste ${sust.productos?.nombre} · esperando al cliente`,
      };
    } else if (sust?.estado === 'aceptada') {
      infoSust = {
        icono: 'checkmark-circle',
        color: VERDE,
        texto: `Cliente aceptó ${sust.productos?.nombre}`,
      };
    } else if (sust?.estado === 'rechazada') {
      infoSust = {
        icono: 'close-circle',
        color: PRIMARY,
        texto: 'El cliente rechazó el reemplazo',
      };
    }

    const puedeSugerir =
      sinStock && !yaCompletado && !sustPendiente(item) && !sustAceptada(item);

    return (
      <View
        style={[
          styles.productCard,
          listo && styles.cardEncontrado,
          sinStock && styles.cardFaltante,
        ]}
      >
        <View style={[styles.riel, { backgroundColor: colorRiel }]} />

        <View style={styles.productBody}>
          {item.productos?.imagen_url ? (
            <Image
              source={{ uri: item.productos.imagen_url }}
              style={[styles.productImage, sinStock && { opacity: 0.45 }]}
            />
          ) : (
            <View style={[styles.productImage, styles.imageVacia]}>
              <Ionicons name="cube-outline" size={26} color="#b4b8c0" />
            </View>
          )}

          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.id_item_origen ? 'Reemplazo · ' : ''}
              {item.productos?.nombre ?? 'Producto'}
            </Text>

            {/* Código de barras bajo el nombre, para encontrar el producto rápido */}
            {!!codigo && (
              <View style={styles.codigoChip}>
                <Ionicons name="barcode-outline" size={14} color={MUTED} />
                <Text style={styles.productCodigo} selectable>
                  {codigo}
                </Text>
              </View>
            )}

            <View style={styles.estadoRow}>
              <View style={[styles.countPill, { backgroundColor: fondoEstado }]}>
                <Text style={[styles.countText, { color: colorEstado }]}>
                  {recogidas(item)} de {item.cantidad}
                </Text>
              </View>
              {sinStock && !!item.motivo_faltante && (
                <Text style={styles.motivoText} numberOfLines={1}>
                  {item.motivo_faltante}
                </Text>
              )}
            </View>

            {infoSust && (
              <View style={styles.sustRow}>
                <Ionicons name={infoSust.icono} size={14} color={infoSust.color} />
                <Text style={[styles.sustTexto, { color: infoSust.color }]}>{infoSust.texto}</Text>
              </View>
            )}

            <Text style={[styles.productPrice, sinStock && styles.productPriceTachado]}>
              {formatCLP(Number(item.precio_unitario) * item.cantidad)}
            </Text>
          </View>

          <View style={styles.actions}>
            {listo && <Ionicons name="checkmark-circle" size={30} color={VERDE} />}

            {puedeSugerir && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => abrirSustituto(item)}
                disabled={trabajando}
                activeOpacity={0.7}
              >
                <Ionicons name="swap-horizontal" size={20} color={PRIMARY} />
              </TouchableOpacity>
            )}

            {sinStock && !yaCompletado && !sustAceptada(item) && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => abrirFaltante(item)}
                disabled={trabajando}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={20} color={PRIMARY} />
              </TouchableOpacity>
            )}
            {sinStock && yaCompletado && (
              <Ionicons name="alert-circle" size={30} color={PRIMARY} />
            )}

            {!listo && !sinStock && !yaCompletado && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => abrirFaltante(item)}
                disabled={trabajando}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={PRIMARY} />
              </TouchableOpacity>
            )}
          </View>
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
          <View style={styles.vacioCirculo}>
            <Ionicons name="file-tray-outline" size={46} color="#c3c7ce" />
          </View>
          <Text style={styles.vacioTitulo}>No se encontró el pedido</Text>
          <Text style={styles.vacioTexto}>
            Puede que ya esté completado o que no esté asignado a ti.
          </Text>
          <TouchableOpacity style={[styles.finalizarBtn, { marginTop: 8 }]} onPress={() => volver()}>
            <Text style={styles.finalizarBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => volver()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            Pedido #{String(pedido.id).slice(0, 8).toUpperCase()}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {pedido.direccion_entrega || 'Retiro en tienda'}
          </Text>
        </View>
        {yaCompletado && (
          <View style={styles.badgeCompletado}>
            <Ionicons name="checkmark-circle" size={14} color={VERDE} />
            <Text style={styles.badgeCompletadoTexto}>Completado</Text>
          </View>
        )}
      </View>

      {/* Ficha del pedido: quién retira, a qué hora y cuánto llevas */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroInicial}>{nombreCliente.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroNombre} numberOfLines={1}>{nombreCliente}</Text>
            {pedido.hora_retiro && (
              <View style={styles.heroRetiro}>
                <Ionicons name="time-outline" size={15} color="#F5B8BB" />
                <Text style={styles.heroRetiroTexto}>
                  Retira {formatHoraRetiro(pedido.hora_retiro)}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.heroBarBg}>
          <View
            style={[
              styles.heroBarFill,
              { width: `${pct}%`, backgroundColor: todoListo ? '#4ADE80' : PRIMARY },
            ]}
          />
        </View>
        <View style={styles.heroBarInfo}>
          <Text style={styles.heroBarTexto}>
            {completados} de {items.length} {items.length === 1 ? 'producto' : 'productos'}
          </Text>
          <Text style={styles.heroBarPct}>{pct}%</Text>
        </View>
      </View>

      {!yaCompletado && (
        <TouchableOpacity style={styles.escanearBtn} onPress={abrirEscaner} activeOpacity={0.85}>
          <View style={styles.escanearIcono}>
            <Ionicons name="barcode-outline" size={22} color="#fff" />
          </View>
          <Text style={styles.escanearTexto}>Escanear producto</Text>
        </TouchableOpacity>
      )}

      {hayPendientes && !yaCompletado && (
        <View style={styles.avisoEspera}>
          <Ionicons name="time-outline" size={18} color={AMBAR} />
          <Text style={styles.avisoEsperaTexto}>
            Esperando que el cliente responda un reemplazo para poder finalizar.
          </Text>
        </View>
      )}

      <FlatList
        data={items}
        renderItem={renderProducto}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={[styles.list, { paddingBottom: FOOTER_BASE + bottomSeguro }]}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.footer, { paddingBottom: bottomSeguro + 8 }]}>
        <View>
          <Text style={styles.footerLabel}>
            {hayAjuste ? 'Total a entregar' : 'Total del pedido'}
          </Text>
          <Text style={styles.footerTotal}>{formatCLP(totalEntregar)}</Text>
          {hayAjuste && (
            <Text style={styles.footerPagado}>Pagado: {formatCLP(pedido.total)}</Text>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.finalizarBtn,
            (!todoListo || yaCompletado || trabajando) && styles.finalizarBtnDisabled,
          ]}
          disabled={!todoListo || yaCompletado || trabajando}
          onPress={abrirEvidencia}
          activeOpacity={0.85}
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

      {/* Evidencia fotográfica antes de finalizar */}
      <Modal visible={evidenciaAbierta} animationType="slide" onRequestClose={cerrarEvidencia}>
        <View style={styles.camaraFondo}>
          <CameraView ref={camaraRef} style={StyleSheet.absoluteFill} facing="back" />

          <SafeAreaView style={styles.evTop} pointerEvents="box-none">
            <View style={styles.evAviso}>
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <Text style={styles.evAvisoTexto}>
                Foto de evidencia del pedido ({fotos.length}/{MAX_FOTOS})
              </Text>
            </View>
            <TouchableOpacity style={styles.evCerrar} onPress={cerrarEvidencia} disabled={subiendo}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={[styles.evBottom, { paddingBottom: bottomSeguro + 18 }]}>
            {fotos.length > 0 && (
              <FlatList
                data={fotos}
                horizontal
                keyExtractor={(f, i) => `${i}-${f.uri}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingBottom: 14, paddingTop: 6 }}
                renderItem={({ item: f, index }) => (
                  <View>
                    <Image source={{ uri: f.uri }} style={styles.evMini} />
                    <TouchableOpacity
                      style={styles.evQuitar}
                      onPress={() => quitarFoto(index)}
                      disabled={subiendo}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}

            <TouchableOpacity
              style={[styles.evDisparo, (tomando || subiendo || fotos.length >= MAX_FOTOS) && { opacity: 0.4 }]}
              onPress={tomarFoto}
              disabled={tomando || subiendo || fotos.length >= MAX_FOTOS}
            >
              <View style={styles.evDisparoInterno} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.finalizarBtn,
                { alignSelf: 'stretch', marginTop: 16 },
                (fotos.length < MIN_FOTOS || subiendo) && styles.finalizarBtnDisabled,
              ]}
              onPress={confirmarFinalizar}
              disabled={fotos.length < MIN_FOTOS || subiendo}
              activeOpacity={0.85}
            >
              {subiendo ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.finalizarBtnText}>Subir fotos y finalizar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reporte de producto faltante */}
      <Modal visible={!!faltante} transparent animationType="fade" onRequestClose={cerrarFaltante}>
        <KeyboardAvoidingView
          style={styles.modalFondo}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCaja, { paddingBottom: bottomSeguro + 16 }]}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitulo} numberOfLines={2}>{faltante?.productos?.nombre}</Text>
            <Text style={styles.modalSub}>¿Qué pasó con este producto?</Text>

            <View style={styles.chipsRow}>
              {MOTIVOS.map((m) => {
                const activo = motivo === m;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setMotivo(m)}
                    style={[styles.chip, activo && styles.chipActivo]}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={ICONOS_MOTIVO[m]}
                      size={16}
                      color={activo ? PRIMARY : MUTED}
                    />
                    <Text style={[styles.chipTexto, activo && { color: PRIMARY }]}>{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Nota para el cliente (opcional)"
              placeholderTextColor="#9aa0a8"
              value={sugerencia}
              onChangeText={setSugerencia}
              multiline
              maxLength={200}
            />

            <TouchableOpacity
              style={[styles.finalizarBtn, { alignSelf: 'stretch' }]}
              onPress={enviarFaltante}
              disabled={trabajando}
              activeOpacity={0.85}
            >
              {trabajando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.finalizarBtnText}>
                  {editando ? 'Guardar cambios' : 'Avisar al cliente'}
                </Text>
              )}
            </TouchableOpacity>

            {editando && (
              <TouchableOpacity
                onPress={quitarFaltante}
                disabled={trabajando}
                style={{ marginTop: 16 }}
              >
                <Text style={{ textAlign: 'center', color: PRIMARY, fontWeight: '700' }}>
                  Quitar faltante (lo encontré)
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={cerrarFaltante} style={{ marginTop: 16 }}>
              <Text style={{ textAlign: 'center', color: MUTED, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Encabezado
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 3px 10px rgba(16,24,40,0.08)',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: INK, letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 12, color: MUTED, fontWeight: '500', marginTop: 1 },
  badgeCompletado: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: VERDE_SUAVE, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
  },
  badgeCompletadoTexto: { fontSize: 12, fontWeight: '700', color: VERDE },

  // Ficha del pedido
  hero: {
    marginHorizontal: 16, backgroundColor: INK, borderRadius: 24,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16,
    boxShadow: '0px 8px 20px rgba(22,24,29,0.22)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  heroAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
  heroInicial: { fontSize: 21, fontWeight: '800', color: '#fff' },
  heroNombre: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  heroRetiro: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  heroRetiroTexto: { fontSize: 13, fontWeight: '600', color: '#F5B8BB' },
  heroBarBg: {
    height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden',
  },
  heroBarFill: { height: 8, borderRadius: 4 },
  heroBarInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  heroBarTexto: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  heroBarPct: { fontSize: 12, fontWeight: '800', color: '#fff' },

  // Escáner
  escanearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: PRIMARY, borderRadius: 18, marginHorizontal: 16, marginTop: 12,
    paddingVertical: 14,
    boxShadow: '0px 6px 16px rgba(237,29,38,0.28)',
  },
  escanearIcono: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  escanearTexto: { color: '#fff', fontSize: 16, fontWeight: '800' },

  avisoEspera: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 14,
    backgroundColor: AMBAR_SUAVE,
  },
  avisoEsperaTexto: { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400E', lineHeight: 17 },

  // Productos
  list: { paddingHorizontal: 16, paddingTop: 16 },
  productCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
    boxShadow: '0px 3px 12px rgba(16,24,40,0.06)',
  },
  cardEncontrado: { backgroundColor: '#F7FCF8' },
  cardFaltante: { backgroundColor: '#FFF8F7' },
  riel: { width: 6 },
  productBody: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingLeft: 12, paddingRight: 12,
  },
  productImage: { width: 68, height: 68, borderRadius: 16, resizeMode: 'cover', backgroundColor: '#F1F2F4' },
  imageVacia: { alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, marginLeft: 12, paddingRight: 6 },
  productName: { fontSize: 14, fontWeight: '700', color: INK, lineHeight: 19 },
  codigoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: '#F1F2F4', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 5,
  },
  productCodigo: { fontSize: 12, fontWeight: '700', color: '#4B5563', letterSpacing: 0.8 },
  estadoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
  countPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  countText: { fontSize: 12, fontWeight: '800' },
  motivoText: { flex: 1, fontSize: 12, fontWeight: '600', color: PRIMARY },
  sustRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  sustTexto: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  productPrice: { fontSize: 15, fontWeight: '800', color: INK, marginTop: 6, letterSpacing: -0.2 },
  productPriceTachado: { color: '#b0b5bd', textDecorationLine: 'line-through' },
  actions: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: ROJO_SUAVE, alignItems: 'center', justifyContent: 'center',
  },

  // Pie
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingTop: 18, paddingHorizontal: 22,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    boxShadow: '0px -4px 16px rgba(16,24,40,0.08)',
  },
  footerLabel: { fontSize: 12, color: MUTED, fontWeight: '500' },
  footerTotal: { fontSize: 24, fontWeight: '900', color: INK, letterSpacing: -0.5 },
  footerPagado: { fontSize: 11, color: '#9aa0a8', marginTop: 1 },
  finalizarBtn: {
    backgroundColor: PRIMARY, borderRadius: 16,
    paddingVertical: 15, paddingHorizontal: 24, minWidth: 160, alignItems: 'center',
  },
  finalizarBtnDisabled: { backgroundColor: '#E9A8A4' },
  finalizarBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Cámara y evidencia
  camaraFondo: { flex: 1, backgroundColor: '#000' },
  evTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8,
  },
  evAviso: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22,
  },
  evAvisoTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  evCerrar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  evBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.62)', paddingTop: 14, paddingHorizontal: 18, alignItems: 'center',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  evMini: {
    width: 66, height: 66, borderRadius: 14, backgroundColor: '#222',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)',
  },
  evQuitar: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
  },
  evDisparo: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  evDisparoInterno: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },

  // Pedido no encontrado
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 28 },
  vacioCirculo: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    boxShadow: '0px 3px 12px rgba(16,24,40,0.06)',
  },
  vacioTitulo: { fontSize: 18, fontWeight: '800', color: INK },
  vacioTexto: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 },

  // Reporte de faltante
  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCaja: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10,
  },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E1E3E8', marginBottom: 16,
  },
  modalTitulo: { fontSize: 18, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  modalSub: { fontSize: 13, color: MUTED, marginTop: 4, marginBottom: 16 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#F1F2F4', borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActivo: { backgroundColor: ROJO_SUAVE, borderColor: PRIMARY },
  chipTexto: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FAFAFB',
    borderRadius: 14, padding: 14, minHeight: 78, marginBottom: 18,
    textAlignVertical: 'top', color: INK,
  },
});