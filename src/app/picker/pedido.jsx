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
const VERDE = '#1B6B3A';

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

const MIN_FOTOS = 1;
const MAX_FOTOS = 6;

// Alto aproximado del footer sin contar la zona segura inferior
const FOOTER_BASE = 110;

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

    let textoSust = null;
    if (sust?.estado === 'propuesta') {
      textoSust = `⏳ Sugeriste: ${sust.productos?.nombre} · esperando al cliente`;
    } else if (sust?.estado === 'aceptada') {
      textoSust = `✅ Cliente aceptó: ${sust.productos?.nombre}`;
    } else if (sust?.estado === 'rechazada') {
      textoSust = 'El cliente rechazó el reemplazo';
    }

    const puedeSugerir =
      sinStock && !yaCompletado && !sustPendiente(item) && !sustAceptada(item);

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
            {item.id_item_origen ? 'Reemplazo · ' : ''}
            {item.productos?.nombre ?? 'Producto'}
          </Text>

          {/* Código de barras bajo el nombre, para encontrar el producto rápido */}
          {!!codigo && (
            <View style={styles.codigoRow}>
              <Ionicons name="barcode-outline" size={14} color="#666" />
              <Text style={styles.productCodigo} selectable>
                {codigo}
              </Text>
            </View>
          )}

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
          {textoSust && <Text style={styles.productSust}>{textoSust}</Text>}
          <Text style={[styles.productPrice, sinStock && styles.productPriceTachado]}>
            {formatCLP(Number(item.precio_unitario) * item.cantidad)}
          </Text>
        </View>

        <View style={styles.actions}>
          {listo && <Ionicons name="checkmark-circle" size={28} color={VERDE} />}

          {puedeSugerir && (
            <TouchableOpacity
              style={styles.notFoundBtn}
              onPress={() => abrirSustituto(item)}
              disabled={trabajando}
            >
              <Ionicons name="swap-horizontal" size={20} color={PRIMARY} />
            </TouchableOpacity>
          )}

          {sinStock && !yaCompletado && !sustAceptada(item) && (
            <TouchableOpacity
              style={styles.notFoundBtn}
              onPress={() => abrirFaltante(item)}
              disabled={trabajando}
            >
              <Ionicons name="create-outline" size={20} color={PRIMARY} />
            </TouchableOpacity>
          )}
          {sinStock && yaCompletado && (
            <Ionicons name="alert-circle" size={28} color={PRIMARY} />
          )}

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

      {/* Cliente que retira el pedido */}
      <View style={styles.clienteBar}>
        <Ionicons name="person-circle-outline" size={22} color="#1a1a1a" />
        <View style={{ flex: 1 }}>
          <Text style={styles.clienteLabel}>Cliente</Text>
          <Text style={styles.clienteNombre} numberOfLines={1}>{nombreCliente}</Text>
        </View>
      </View>

      {pedido.hora_retiro && (
        <View style={styles.retiroBadge}>
          <Ionicons name="time-outline" size={16} color={PRIMARY} />
          <Text style={styles.retiroBadgeText}>
            Retira: {formatHoraRetiro(pedido.hora_retiro)}
          </Text>
        </View>
      )}
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

      {hayPendientes && !yaCompletado && (
        <View style={styles.avisoEspera}>
          <Ionicons name="time-outline" size={18} color="#B45309" />
          <Text style={styles.avisoEsperaTexto}>
            Esperando que el cliente responda un reemplazo para poder finalizar.
          </Text>
        </View>
      )}

      <FlatList
        data={items}
        renderItem={renderProducto}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: FOOTER_BASE + bottomSeguro }]}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.footer, { paddingBottom: bottomSeguro + 12 }]}>
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
                contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
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
                { alignSelf: 'stretch', marginTop: 14 },
                (fotos.length < MIN_FOTOS || subiendo) && styles.finalizarBtnDisabled,
              ]}
              onPress={confirmarFinalizar}
              disabled={fotos.length < MIN_FOTOS || subiendo}
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
              placeholder="Nota para el cliente (opcional)"
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
                <Text style={styles.finalizarBtnText}>
                  {editando ? 'Guardar cambios' : 'Avisar al cliente'}
                </Text>
              )}
            </TouchableOpacity>

            {editando && (
              <TouchableOpacity
                onPress={quitarFaltante}
                disabled={trabajando}
                style={{ marginTop: 14 }}
              >
                <Text style={{ textAlign: 'center', color: PRIMARY, fontWeight: '700' }}>
                  Quitar faltante (lo encontré)
                </Text>
              </TouchableOpacity>
            )}

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

  // Cliente y hora de retiro
  clienteBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  clienteLabel: { fontSize: 11, color: '#888', fontWeight: '600' },
  clienteNombre: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  retiroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#fdecea',
  },
  retiroBadgeText: { fontSize: 13, fontWeight: '800', color: PRIMARY },

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
  codigoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  productCodigo: { fontSize: 12, fontWeight: '700', color: '#555', letterSpacing: 0.8 },
  productUnit: { fontSize: 12, color: '#888', marginTop: 2 },
  productSust: { fontSize: 12, fontWeight: '600', color: '#555', marginTop: 3 },
  productPrice: { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginTop: 4 },
  productPriceTachado: { color: '#aaa', textDecorationLine: 'line-through' },
  actions: { alignItems: 'center', gap: 8 },
  notFoundBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: '#fdecea', alignItems: 'center', justifyContent: 'center',
  },
  avisoEspera: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, padding: 10, borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  avisoEsperaTexto: { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400E' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingTop: 20, paddingHorizontal: 20, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footerLabel: { fontSize: 12, color: '#888' },
  footerTotal: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  footerPagado: { fontSize: 11, color: '#999', marginTop: 1 },
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
    backgroundColor: 'rgba(0,0,0,0.6)', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 34, alignItems: 'center',
  },
  evMini: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#222' },
  evQuitar: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
  },
  evDisparo: {
    width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  evDisparoInterno: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
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