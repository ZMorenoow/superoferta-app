import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../utils/supabase';
import { useRealtime } from '../utils/useRealtime';

const PRIMARY = '#C21807';
const VERDE = '#1B6B3A';
const AMARILLO = '#B45309';
const PEDIDOS_POR_PICKER_HORA = 5; // referencia para el tope sugerido
const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;
const horaCorta = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const fechaCorta = (iso) => {
  const [, m, d] = String(iso).split('-');
  return `${d}/${m}`;
};

// Alert.alert no hace nada en web, por eso se usa window.alert / window.confirm ahí
const avisar = (titulo, mensaje) => {
  if (Platform.OS === 'web') {
    window.alert(mensaje ? `${titulo}\n\n${mensaje}` : titulo);
  } else {
    Alert.alert(titulo, mensaje);
  }
};

const confirmar = (titulo, mensaje, textoOk, onOk) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) onOk();
  } else {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: textoOk, onPress: onOk },
    ]);
  }
};

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const ETIQUETA_ESTADO = {
  pagado: 'Pagado',
  asignado: 'Por preparar',
  en_proceso: 'En preparación',
};

const TABS = [
  { id: 'resumen', label: 'Resumen', icono: 'stats-chart-outline' },
  { id: 'retiros', label: 'Retiros', icono: 'qr-code-outline' },
  { id: 'pickers', label: 'Pickers', icono: 'people-outline' },
];
const PERIODOS = [
  { dias: 1, label: 'Hoy' },
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
];

function Tarjeta({ icono, label, valor }) {
  return (
    <View style={s.kpi}>
      <Ionicons name={icono} size={20} color={PRIMARY} />
      <Text style={s.kpiValor}>{valor}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

function Barras({ datos }) {
  const max = Math.max(...datos.map((d) => Number(d.total)), 1);
  return (
    <View>
      <View style={s.barras}>
        {datos.map((d) => (
          <View key={d.dia} style={s.barraCol}>
            <View style={[s.barra, { height: Math.max(4, (Number(d.total) / max) * 110) }]} />
          </View>
        ))}
      </View>
      <View style={s.ejes}>
        <Text style={s.eje}>{fechaCorta(datos[0].dia)}</Text>
        <Text style={s.eje}>{fechaCorta(datos[datos.length - 1].dia)}</Text>
      </View>
    </View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const scrollRef = useRef(null);
  const limpiarTimer = useRef(null);
  const montado = useRef(true);

  useEffect(() => () => clearTimeout(limpiarTimer.current), []);

  const [esAdmin, setEsAdmin] = useState(false);
  const [sinConexion, setSinConexion] = useState(false);
  const [sucursalId, setSucursalId] = useState(null);
  const [tab, setTab] = useState('resumen');
  const [dias, setDias] = useState(1);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(null);

  const [resumen, setResumen] = useState(null);
  const [capacidad, setCapacidad] = useState(null);

  const [codigo, setCodigo] = useState('');
  const [encontrado, setEncontrado] = useState(null);
  const [listos, setListos] = useState([]);
  const [verificando, setVerificando] = useState(false);
  const [entregando, setEntregando] = useState(false);

  const [pickers, setPickers] = useState([]);
  const [sinAsignar, setSinAsignar] = useState([]);

  // Verifica que sea admin SIN sacarlo por fallos temporales (red lenta, token renovándose, etc.).
  // Solo lo saca si la base responde bien y dice que su rol NO es admin, o si no hay sesión.
  const verificarAdmin = useCallback(async () => {
    setSinConexion(false);

    // 1) Sesión guardada en el teléfono (no depende de internet)
    const { data: { session } } = await supabase.auth.getSession();
    if (!montado.current) return;
    if (!session) {
      router.replace('/login');
      return;
    }

    // 2) Rol guardado al iniciar sesión: entra de inmediato
    let entroPorCache = false;
    try {
      const rolGuardado = await AsyncStorage.getItem('@rol');
      if (rolGuardado === 'admin' && montado.current) {
        entroPorCache = true;
        setEsAdmin(true);
      }
    } catch {}

    // 3) Confirmar con la base, con reintentos
    for (let intento = 0; intento < 3; intento++) {
      const { data: perfil, error: e } = await supabase
        .from('perfiles')
        .select('rol, id_sucursal_preferida')
        .eq('id', session.user.id)
        .maybeSingle();
      if (!montado.current) return;

      if (!e && perfil) {
        if (perfil.rol !== 'admin') {
          try {
            await AsyncStorage.setItem('@rol', perfil.rol);
          } catch {}
          router.replace('/(tabs)');
          return;
        }
        try {
          await AsyncStorage.setItem('@rol', 'admin');
        } catch {}
        setSucursalId(perfil.id_sucursal_preferida);
        setEsAdmin(true);
        return;
      }

      await esperar(1500 * (intento + 1));
      if (!montado.current) return;
    }

    // Si no se pudo confirmar pero ya entró por el rol guardado, se queda (no lo sacamos)
    if (!entroPorCache) setSinConexion(true);
  }, [router]);

  useEffect(() => {
    montado.current = true;
    verificarAdmin();

    // Solo cerrar sesión explícita lo manda al login; renovar el token no hace nada
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT' && montado.current) router.replace('/login');
    });

    return () => {
      montado.current = false;
      sub.subscription.unsubscribe();
    };
  }, [verificarAdmin]);

  const cargar = useCallback(async () => {
    if (!esAdmin) return;
    try {
      setError(null);
      const cap = () => supabase.rpc('capacidad_sucursal', { p_sucursal: sucursalId });

      if (tab === 'resumen') {
        const [r, c] = await Promise.all([supabase.rpc('admin_resumen', { p_dias: dias }), cap()]);
        if (r.error) throw r.error;
        setResumen(r.data);
        if (!c.error) setCapacidad(c.data);
      } else if (tab === 'retiros') {
        const { data, error: e } = await supabase.rpc('admin_listos');
        if (e) throw e;
        setListos(data ?? []);
      } else {
        const [p, sa, c] = await Promise.all([
          supabase.rpc('admin_pickers'),
          supabase.rpc('admin_sin_asignar'),
          cap(),
        ]);
        if (p.error) throw p.error;
        if (sa.error) throw sa.error;
        setPickers(p.data ?? []);
        setSinAsignar(sa.data ?? []);
        if (!c.error) setCapacidad(c.data);
      }
    } catch (e) {
      console.error('Admin', e);
      setError(e.message || 'No se pudieron cargar los datos');
    } finally {
      setRefrescando(false);
    }
  }, [esAdmin, tab, dias, sucursalId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Tiempo real: cualquier cambio en pedidos refresca la pestaña actual
  useRealtime('admin-pedidos', [{ table: 'pedidos' }], cargar, esAdmin);

  const salir = async () => {
    await supabase.auth.signOut();
    try {
      await AsyncStorage.removeItem('@rol');
    } catch {}
    router.replace('/login');
  };

  // ---------- Retiros ----------
  const verificar = async (cod = codigo) => {
    const limpio = String(cod).trim();
    if (limpio.length < 4) {
      avisar('Código incompleto', 'Ingresa el código de retiro del cliente');
      return;
    }
    clearTimeout(limpiarTimer.current);
    setVerificando(true);
    setEncontrado(null);
    const { data, error: e } = await supabase.rpc('admin_buscar_retiro', { p_codigo: limpio });
    setVerificando(false);
    if (e) {
      avisar('No encontrado', e.message);
      return;
    }
    setEncontrado(data);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const entregar = () => {
    confirmar(
      'Entregar pedido',
      `¿Confirmas la entrega del pedido de ${encontrado.cliente}?`,
      'Sí, entregar',
      async () => {
        setEntregando(true);
        const { error: e } = await supabase.rpc('admin_confirmar_retiro', {
          p_pedido: encontrado.id,
        });
        setEntregando(false);
        if (e) {
          avisar('No se pudo entregar', e.message);
          return;
        }
        // El código pasa de amarillo a verde y se muestra "Pedido entregado"
        setEncontrado((x) => ({ ...x, entregado: true }));
        cargar();

        // Deja el verde visible unos segundos y limpia el formulario para el siguiente pedido
        clearTimeout(limpiarTimer.current);
        limpiarTimer.current = setTimeout(() => {
          setEncontrado(null);
          setCodigo('');
          cargar();
        }, 3000);
      }
    );
  };

  // ---------- Pickers ----------
  const cambiarTope = async (n) => {
    const { error: e } = await supabase.rpc('admin_set_tope', { p_tope: Math.max(1, n) });
    if (e) avisar('Error', e.message);
    else cargar();
  };

  const toggleActivo = async (p, valor) => {
    setPickers((lista) => lista.map((x) => (x.id === p.id ? { ...x, activo: valor } : x)));
    const { error: e } = await supabase.rpc('admin_set_picker_activo', {
      p_picker: p.id,
      p_activo: valor,
    });
    if (e) avisar('Error', e.message);
    cargar();
  };

  const asignar = async (pedidoId, pickerId) => {
    const { error: e } = await supabase.rpc('admin_asignar_picker', {
      p_pedido: pedidoId,
      p_picker: pickerId,
    });
    if (e) avisar('No se pudo asignar', e.message);
    else cargar();
  };

  if (!esAdmin) {
    if (sinConexion) {
      return (
        <SafeAreaView style={s.container}>
          <View style={s.sinConexion}>
            <Ionicons name="cloud-offline-outline" size={48} color="#bbb" />
            <Text style={s.sinConexionTitulo}>No se pudo verificar tu cuenta</Text>
            <Text style={s.nota}>Revisa tu conexión e intenta de nuevo.</Text>
            <TouchableOpacity style={s.btnVerificar} onPress={verificarAdmin}>
              <Text style={s.btnTexto}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const activos = pickers.filter((p) => p.activo);
  const sugerido = Math.max(activos.length * PEDIDOS_POR_PICKER_HORA, 1);
  const pctCap = capacidad?.max ? Math.min(100, (capacidad.usados / capacidad.max) * 100) : 0;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Panel de administración</Text>
        <TouchableOpacity onPress={salir} style={s.salir}>
          <Ionicons name="log-out-outline" size={22} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[s.tab, tab === t.id && s.tabActiva]}
            onPress={() => setTab(t.id)}
          >
            <Ionicons name={t.icono} size={17} color={tab === t.id ? '#fff' : '#666'} />
            <Text style={[s.tabTexto, tab === t.id && { color: '#fff' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true);
                cargar();
              }}
              tintColor={PRIMARY}
            />
          }
        >
          {!!error && (
            <View style={s.errorBox}>
              <Text style={s.errorTexto}>{error}</Text>
            </View>
          )}

          {/* ===================== RESUMEN ===================== */}
          {tab === 'resumen' && (
            <>
              <View style={s.chips}>
                {PERIODOS.map((p) => (
                  <TouchableOpacity
                    key={p.dias}
                    style={[s.chip, dias === p.dias && s.chipActivo]}
                    onPress={() => setDias(p.dias)}
                  >
                    <Text style={[s.chipTexto, dias === p.dias && { color: PRIMARY }]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!resumen ? (
                <ActivityIndicator color={PRIMARY} style={{ marginTop: 30 }} />
              ) : (
                <>
                  <View style={s.grid}>
                    <Tarjeta icono="cash-outline" label="Ventas" valor={formatCLP(resumen.ventas)} />
                    <Tarjeta icono="bag-check-outline" label="Entregados" valor={resumen.pedidos} />
                    <Tarjeta icono="receipt-outline" label="Ticket promedio" valor={formatCLP(resumen.ticket)} />
                    <Tarjeta icono="time-outline" label="En curso" valor={resumen.en_curso} />
                  </View>

                  {!!capacidad && (
                    <View style={s.card}>
                      <View style={s.filaEntre}>
                        <Text style={s.cardTitulo}>Capacidad esta hora</Text>
                        <Text style={s.cardTitulo}>
                          {capacidad.usados}/{capacidad.max}
                        </Text>
                      </View>
                      <View style={s.barraFondo}>
                        <View
                          style={[
                            s.barraRelleno,
                            { width: `${pctCap}%`, backgroundColor: pctCap >= 90 ? PRIMARY : VERDE },
                          ]}
                        />
                      </View>
                      {capacidad.disponible === 0 && (
                        <Text style={s.nota}>
                          Tope alcanzado para esta hora. La siguiente hora parte en ~{capacidad.libera_en_min} min.
                        </Text>
                      )}
                    </View>
                  )}

                  {resumen.por_dia?.length > 1 && (
                    <View style={s.card}>
                      <Text style={s.cardTitulo}>Ventas por día</Text>
                      <Barras datos={resumen.por_dia} />
                    </View>
                  )}

                  <View style={s.card}>
                    <Text style={s.cardTitulo}>Productos más vendidos</Text>
                    {resumen.top?.length ? (
                      resumen.top.map((p, i) => (
                        <View key={p.nombre} style={s.filaTop}>
                          <Text style={s.rank}>{i + 1}</Text>
                          <Text style={s.topNombre} numberOfLines={1}>{p.nombre}</Text>
                          <Text style={s.topUnidades}>{p.unidades} u.</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={s.nota}>Aún no hay ventas en este período.</Text>
                    )}
                  </View>
                </>
              )}
            </>
          )}

          {/* ===================== RETIROS ===================== */}
          {tab === 'retiros' && (
            <>
              <View style={s.card}>
                <Text style={s.cardTitulo}>Verificar código de retiro</Text>
                <View style={s.codigoRow}>
                  <TextInput
                    style={s.codigoInput}
                    value={codigo}
                    onChangeText={(t) => setCodigo(t.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                    placeholder="ABC123"
                    placeholderTextColor="#ccc"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={6}
                    returnKeyType="go"
                    onSubmitEditing={() => verificar()}
                  />
                  <TouchableOpacity
                    style={[s.btnVerificar, verificando && { opacity: 0.6 }]}
                    onPress={() => verificar()}
                    disabled={verificando}
                  >
                    {verificando ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={s.btnTexto}>Verificar</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {!!encontrado && (
                  <View style={s.encontrado}>
                    <View style={s.filaEntre}>
                      <Text style={s.cliente}>{encontrado.cliente}</Text>
                      <Text style={s.total}>{formatCLP(encontrado.total)}</Text>
                    </View>

                    {/* Código: amarillo por entregar, verde ya entregado */}
                    <Text
                      style={[
                        s.codigoChip,
                        encontrado.entregado ? s.codigoVerde : s.codigoAmarillo,
                        { alignSelf: 'flex-start' },
                      ]}
                    >
                      {codigo}
                    </Text>

                    {encontrado.items?.map((it, i) => (
                      <Text key={i} style={s.item}>
                        {it.cantidad} × {it.nombre}
                      </Text>
                    ))}

                    {encontrado.entregado ? (
                      <View style={s.entregadoBox}>
                        <Ionicons name="checkmark-circle" size={20} color={VERDE} />
                        <Text style={s.entregadoTexto}>Pedido entregado</Text>
                      </View>
                    ) : encontrado.listo ? (
                      <TouchableOpacity
                        style={[s.btnEntregar, entregando && { opacity: 0.6 }]}
                        onPress={entregar}
                        disabled={entregando}
                      >
                        {entregando ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={s.btnTexto}>Entregar pedido</Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View style={s.errorBox}>
                        <Text style={s.errorTexto}>
                          Este pedido aún se está preparando ({encontrado.estado}). No se puede entregar todavía.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <Text style={s.seccion}>Listos para retirar ({listos.length})</Text>
              {listos.length === 0 && <Text style={s.nota}>No hay pedidos esperando retiro.</Text>}
              {listos.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={s.filaListo}
                  activeOpacity={0.8}
                  onPress={() => {
                    setCodigo(p.codigo);
                    verificar(p.codigo);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.cliente}>{p.cliente}</Text>
                    <Text style={s.nota}>
                      {formatCLP(p.total)}
                      {p.hora ? ` · Retiro ${horaCorta(p.hora)}` : ''}
                    </Text>
                  </View>
                  <Text style={[s.codigoChip, s.codigoAmarillo]}>{p.codigo}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ===================== PICKERS ===================== */}
          {tab === 'pickers' && (
            <>
              <View style={s.card}>
                <Text style={s.cardTitulo}>Tope de pedidos por hora</Text>
                <View style={s.stepper}>
                  <TouchableOpacity onPress={() => cambiarTope((capacidad?.max ?? 10) - 1)}>
                    <Ionicons name="remove-circle-outline" size={34} color={PRIMARY} />
                  </TouchableOpacity>
                  <Text style={s.stepperValor}>{capacidad?.max ?? '–'}</Text>
                  <TouchableOpacity onPress={() => cambiarTope((capacidad?.max ?? 10) + 1)}>
                    <Ionicons name="add-circle-outline" size={34} color={PRIMARY} />
                  </TouchableOpacity>
                </View>
                <Text style={s.nota}>
                  Sugerido: {sugerido}/hora (≈{PEDIDOS_POR_PICKER_HORA} por preparador activo, hoy {activos.length}).
                </Text>
                {capacidad?.max !== sugerido && (
                  <TouchableOpacity onPress={() => cambiarTope(sugerido)}>
                    <Text style={s.link}>Usar sugerido</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={s.seccion}>Preparadores ({pickers.length})</Text>
              {pickers.length === 0 && (
                <Text style={s.nota}>No hay preparadores asignados a esta sucursal.</Text>
              )}
              {pickers.map((p) => (
                <View key={p.id} style={s.card}>
                  <View style={s.filaEntre}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cliente}>{p.nombre}</Text>
                    </View>
                    <Switch
                      value={!!p.activo}
                      onValueChange={(v) => toggleActivo(p, v)}
                      trackColor={{ true: VERDE }}
                    />
                  </View>

                  <View style={s.statsPicker}>
                    <View style={s.statPicker}>
                      <Text style={[s.statNum, { color: AMARILLO }]}>{p.por_preparar ?? 0}</Text>
                      <Text style={s.statLabel}>Por preparar</Text>
                    </View>
                    <View style={s.statPicker}>
                      <Text style={[s.statNum, { color: '#7C3AED' }]}>{p.en_preparacion ?? 0}</Text>
                      <Text style={s.statLabel}>En preparación</Text>
                    </View>
                    <View style={s.statPicker}>
                      <Text style={[s.statNum, { color: VERDE }]}>{p.preparados_hoy ?? 0}</Text>
                      <Text style={s.statLabel}>Completados hoy</Text>
                    </View>
                  </View>

                  {p.pedidos?.map((ped) => (
                    <View key={ped.id} style={s.pedidoPicker}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.pedidoId}>
                          #{String(ped.id).slice(0, 8).toUpperCase()}
                        </Text>
                        <Text style={s.pedidoCliente} numberOfLines={1}>
                          {ped.cliente}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.pedidoCodigo}>Código {ped.codigo}</Text>
                        <Text style={s.nota}>{ETIQUETA_ESTADO[ped.estado] ?? ped.estado}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}

              <Text style={s.seccion}>Pedidos sin asignar ({sinAsignar.length})</Text>
              {sinAsignar.length === 0 && <Text style={s.nota}>Todos los pedidos tienen preparador.</Text>}
              {sinAsignar.map((p) => (
                <View key={p.id} style={s.card}>
                  <Text style={s.cliente}>
                    {p.cliente} · #{p.codigo}
                  </Text>
                  <Text style={s.nota}>Asignar a:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      {activos.length === 0 && <Text style={s.nota}>No hay preparadores activos.</Text>}
                      {activos.map((pk) => (
                        <TouchableOpacity key={pk.id} style={s.chip} onPress={() => asignar(p.id, pk.id)}>
                          <Text style={s.chipTexto}>
                            {pk.nombre} ({pk.en_curso})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
  },
  title: { fontSize: 18, fontWeight: '900', color: '#1a1a1a' },
  salir: { padding: 6 },
  tabs: {
    flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12, backgroundColor: '#f1f1f1',
  },
  tabActiva: { backgroundColor: PRIMARY },
  tabTexto: { fontSize: 13, fontWeight: '700', color: '#666' },

  sinConexion: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  sinConexionTitulo: { fontSize: 17, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },

  chips: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fff',
  },
  chipActivo: { borderColor: PRIMARY, backgroundColor: '#fdecea' },
  chipTexto: { fontSize: 13, fontWeight: '700', color: '#555' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  kpi: {
    width: '48%', backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  kpiValor: { fontSize: 20, fontWeight: '900', color: '#1a1a1a', marginTop: 4 },
  kpiLabel: { fontSize: 12, color: '#888', fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTitulo: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  nota: { fontSize: 12, color: '#888', lineHeight: 17 },
  link: { fontSize: 13, color: PRIMARY, fontWeight: '800' },
  seccion: { fontSize: 14, fontWeight: '800', color: '#555', marginTop: 8, marginBottom: 8 },

  barraFondo: { height: 10, borderRadius: 5, backgroundColor: '#eee', overflow: 'hidden' },
  barraRelleno: { height: '100%', borderRadius: 5 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 3, marginTop: 8 },
  barraCol: { flex: 1, justifyContent: 'flex-end' },
  barra: { width: '100%', backgroundColor: PRIMARY, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  ejes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  eje: { fontSize: 11, color: '#999' },

  filaTop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rank: { width: 22, fontWeight: '900', color: PRIMARY },
  topNombre: { flex: 1, fontSize: 14, color: '#1a1a1a', fontWeight: '600' },
  topUnidades: { fontSize: 13, color: '#666', fontWeight: '700' },

  codigoRow: { flexDirection: 'row', gap: 10 },
  codigoInput: {
    flex: 1, borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, backgroundColor: '#fafafa',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, fontWeight: '900', letterSpacing: 6,
    textAlign: 'center', color: '#1a1a1a',
  },
  btnVerificar: {
    backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnTexto: { color: '#fff', fontWeight: '800', fontSize: 15 },
  encontrado: { marginTop: 6, padding: 12, borderRadius: 12, backgroundColor: '#F8F9FA', gap: 4 },
  cliente: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  total: { fontSize: 15, fontWeight: '900', color: PRIMARY },
  item: { fontSize: 13, color: '#555' },
  btnEntregar: { backgroundColor: VERDE, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  filaListo: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  codigoChip: {
    fontSize: 18, fontWeight: '900', letterSpacing: 3, color: PRIMARY,
    backgroundColor: '#fdecea', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, overflow: 'hidden',
  },
  codigoAmarillo: { color: AMARILLO, backgroundColor: '#FEF3C7' },
  codigoVerde: { color: VERDE, backgroundColor: '#DCFCE7' },
  entregadoBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#DCFCE7', borderRadius: 12, paddingVertical: 14, marginTop: 10,
  },
  entregadoTexto: { color: VERDE, fontWeight: '800', fontSize: 15 },

  pedidoPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F8F9FA', borderRadius: 12, padding: 10,
  },
  pedidoId: { fontSize: 14, fontWeight: '900', color: '#1a1a1a' },
  pedidoCliente: { fontSize: 13, color: '#555', fontWeight: '600', marginTop: 2 },
  pedidoCodigo: { fontSize: 12, fontWeight: '800', color: AMARILLO },

  statsPicker: { flexDirection: 'row', gap: 8 },
  statPicker: {
    flex: 1, alignItems: 'center', backgroundColor: '#F8F9FA',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4,
  },
  statNum: { fontSize: 20, fontWeight: '900', color: '#1a1a1a' },
  statLabel: { fontSize: 11, color: '#888', fontWeight: '600', marginTop: 2, textAlign: 'center' },

  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  stepperValor: { fontSize: 30, fontWeight: '900', color: '#1a1a1a', minWidth: 50, textAlign: 'center' },

  errorBox: { backgroundColor: '#fdecea', borderRadius: 10, padding: 10, marginBottom: 10 },
  errorTexto: { color: PRIMARY, fontSize: 13, fontWeight: '600' },
});