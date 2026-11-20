import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EvidenciaGaleria from '../../components/EvidenciaGaleria';
import { supabase } from '../../utils/supabase';

const PRIMARY = '#C21807';
const VERDE = '#1B6B3A';
const AMBAR = '#B45309';

const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

const formatFecha = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const fecha = d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
  const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  return `${fecha} · ${hora}`;
};

const ESTADO_SUST = {
  aceptada: { texto: 'Aceptado por el cliente', color: VERDE, icono: 'checkmark-circle' },
  rechazada: { texto: 'Rechazado por el cliente', color: PRIMARY, icono: 'close-circle' },
  propuesta: { texto: 'Esperando respuesta del cliente', color: AMBAR, icono: 'time' },
};

function Foto({ uri }) {
  if (uri) return <Image source={{ uri }} style={styles.foto} />;
  return (
    <View style={[styles.foto, styles.fotoVacia]}>
      <Ionicons name="cube-outline" size={22} color="#aaa" />
    </View>
  );
}

export default function DetallePedidoScreen() {
  const router = useRouter();
  const { id, fecha } = useLocalSearchParams();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);

  const volver = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/picker');
  };

  const cargar = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id,
        total,
        reembolso_pendiente,
        direccion_entrega,
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
            productos ( nombre, imagen_url, codigo_barra )
          )
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error cargando detalle', error);
      Alert.alert('Error', 'No se pudo cargar el detalle del pedido');
    }
    setPedido(data ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

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
          <TouchableOpacity style={styles.btn} onPress={volver}>
            <Text style={styles.btnTexto}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const items = pedido.pedido_items ?? [];
  const esReemplazo = (i) => !!i.id_item_origen;
  const esFaltante = (i) => i.estado === 'faltante';
  const escaneadas = (i) => Number(i.cantidad_escaneada) || 0;

  const recogidos = items.filter((i) => !esReemplazo(i) && !esFaltante(i));
  const faltantes = items
    .filter((i) => !esReemplazo(i) && esFaltante(i))
    .map((f) => ({
      ...f,
      reemplazos: items.filter((r) => r.id_item_origen === f.id),
      sustitucion:
        (f.sustituciones ?? []).find((s) => s.estado === 'aceptada') ??
        (f.sustituciones ?? []).find((s) => s.estado === 'propuesta') ??
        (f.sustituciones ?? []).find((s) => s.estado === 'rechazada') ??
        null,
    }));

  const entregados = items.filter((i) => !esFaltante(i));
  const unidades = entregados.reduce((s, i) => s + escaneadas(i), 0);
  const montoEntregado = entregados.reduce(
    (s, i) => s + escaneadas(i) * Number(i.precio_unitario || 0),
    0
  );
  const pagado = Number(pedido.total || 0);
  const diferencia = pagado - montoEntregado;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={volver} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            Pedido #{String(pedido.id).slice(0, 8).toUpperCase()}
          </Text>
          <Text style={styles.headerSubtitle}>
            {formatFecha(fecha) || pedido.direccion_entrega || 'Retiro en tienda'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Resumen */}
        <View style={styles.resumen}>
          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabel}>Unidades entregadas</Text>
            <Text style={styles.resumenValor}>{unidades}</Text>
          </View>
          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabel}>Pagado por el cliente</Text>
            <Text style={styles.resumenValor}>{formatCLP(pagado)}</Text>
          </View>
          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabel}>Total entregado</Text>
            <Text style={[styles.resumenValor, { color: PRIMARY }]}>
              {formatCLP(montoEntregado)}
            </Text>
          </View>
          {diferencia > 0 && (
            <View style={styles.resumenFila}>
              <Text style={styles.resumenLabel}>Diferencia a favor del cliente</Text>
              <Text style={styles.resumenValor}>{formatCLP(diferencia)}</Text>
            </View>
          )}
        </View>

        {/* Fotos de evidencia tomadas por el picker */}
        <EvidenciaGaleria pedidoId={pedido.id} titulo="Evidencia fotográfica" />

        {/* Recogidos */}
        {recogidos.length > 0 && (
          <>
            <Text style={styles.seccion}>Productos recogidos</Text>
            {recogidos.map((i) => (
              <View key={i.id} style={[styles.card, styles.cardOk]}>
                <Foto uri={i.productos?.imagen_url} />
                <View style={styles.info}>
                  <Text style={styles.nombre} numberOfLines={2}>
                    {i.productos?.nombre ?? 'Producto'}
                  </Text>
                  <Text style={[styles.detalle, { color: VERDE }]}>
                    {escaneadas(i)} de {i.cantidad} escaneadas
                  </Text>
                  {!!i.productos?.codigo_barra && (
                    <Text style={styles.codigo}>Cód. {i.productos.codigo_barra}</Text>
                  )}
                  <Text style={styles.precio}>
                    {formatCLP(escaneadas(i) * Number(i.precio_unitario || 0))}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={26} color={VERDE} />
              </View>
            ))}
          </>
        )}

        {/* Faltantes y reemplazos */}
        {faltantes.length > 0 && (
          <>
            <Text style={styles.seccion}>Faltantes y reemplazos</Text>
            {faltantes.map((f) => {
              const est = f.sustitucion ? ESTADO_SUST[f.sustitucion.estado] : null;
              return (
                <View key={f.id} style={styles.bloque}>
                  {/* Lo que se pidió y no se pudo entregar */}
                  <View style={[styles.card, styles.cardFalta, styles.cardSinMargen]}>
                    <Foto uri={f.productos?.imagen_url} />
                    <View style={styles.info}>
                      <Text style={styles.etiquetaRoja}>Pedido original · no entregado</Text>
                      <Text style={styles.nombre} numberOfLines={2}>
                        {f.productos?.nombre ?? 'Producto'}
                      </Text>
                      <Text style={[styles.detalle, { color: PRIMARY }]}>
                        Pedidas: {f.cantidad} · Escaneadas: {escaneadas(f)}
                      </Text>
                      {!!f.motivo_faltante && (
                        <Text style={styles.detalle}>Motivo: {f.motivo_faltante}</Text>
                      )}
                      {!!f.sugerencia && (
                        <Text style={styles.nota}>Nota al cliente: “{f.sugerencia}”</Text>
                      )}
                    </View>
                  </View>

                  {/* Respuesta del cliente */}
                  {est && (
                    <View style={styles.estadoFila}>
                      <Ionicons name={est.icono} size={16} color={est.color} />
                      <Text style={[styles.estadoTexto, { color: est.color }]}>
                        {est.texto}
                        {f.sustitucion?.productos?.nombre
                          ? ` · ${f.sustitucion.productos.nombre}`
                          : ''}
                        {f.sustitucion?.cantidad ? ` (x${f.sustitucion.cantidad})` : ''}
                      </Text>
                    </View>
                  )}
                  {!!f.sustitucion?.nota && (
                    <Text style={[styles.nota, { marginLeft: 12, marginBottom: 6 }]}>
                      Nota del reemplazo: “{f.sustitucion.nota}”
                    </Text>
                  )}

                  {/* Reemplazo escaneado */}
                  {f.reemplazos.map((r) => (
                    <View key={r.id} style={[styles.card, styles.cardOk, styles.cardSinMargen]}>
                      <Foto uri={r.productos?.imagen_url} />
                      <View style={styles.info}>
                        <Text style={styles.etiquetaVerde}>Reemplazo entregado</Text>
                        <Text style={styles.nombre} numberOfLines={2}>
                          {r.productos?.nombre ?? 'Producto'}
                        </Text>
                        <Text style={[styles.detalle, { color: VERDE }]}>
                          {escaneadas(r)} de {r.cantidad} escaneadas
                        </Text>
                        {!!r.productos?.codigo_barra && (
                          <Text style={styles.codigo}>Cód. {r.productos.codigo_barra}</Text>
                        )}
                        <Text style={styles.precio}>
                          {formatCLP(escaneadas(r) * Number(r.precio_unitario || 0))}
                        </Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={26} color={VERDE} />
                    </View>
                  ))}

                  {f.reemplazos.length === 0 && (
                    <Text style={styles.sinReemplazo}>Sin reemplazo: se reembolsa al cliente.</Text>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
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
  scroll: { padding: 16, paddingBottom: 50 },
  resumen: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 8, marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  resumenFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resumenLabel: { fontSize: 13, color: '#777', fontWeight: '600' },
  resumenValor: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  seccion: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginTop: 18, marginBottom: 10 },
  bloque: {
    backgroundColor: '#fff', borderRadius: 18, padding: 8, marginBottom: 12,
    borderWidth: 1, borderColor: '#f0e4e2',
  },
  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14,
    padding: 12, marginBottom: 10, alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  cardSinMargen: { marginBottom: 6 },
  cardOk: { borderColor: VERDE, backgroundColor: '#f0fff4' },
  cardFalta: { borderColor: PRIMARY, backgroundColor: '#FFF5F4' },
  foto: { width: 54, height: 54, borderRadius: 10, backgroundColor: '#f5f5f5' },
  fotoVacia: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12, paddingRight: 6 },
  etiquetaRoja: { fontSize: 11, fontWeight: '800', color: PRIMARY, marginBottom: 2 },
  etiquetaVerde: { fontSize: 11, fontWeight: '800', color: VERDE, marginBottom: 2 },
  nombre: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  detalle: { fontSize: 12, color: '#777', marginTop: 2 },
  codigo: { fontSize: 11, color: '#aaa', marginTop: 2 },
  nota: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 3 },
  precio: { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginTop: 4 },
  estadoFila: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 12, marginVertical: 6 },
  estadoTexto: { flex: 1, fontSize: 12, fontWeight: '700' },
  sinReemplazo: { fontSize: 12, color: '#888', marginHorizontal: 12, marginVertical: 8 },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  vacioTitulo: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  btn: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24 },
  btnTexto: { color: '#fff', fontSize: 15, fontWeight: '800' },
});