// Ubicación: src/app/picker/ayuda_picker.jsx  (junto a detalle.jsx, pedido.jsx, sustituto.jsx)
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomAlert from '../../components/CustomAlert';
import { supabase } from '../../utils/supabase';

const PRIMARY = '#ED1D26';
const ROJO_SUAVE = '#FDECEA';
const VERDE = '#1B6B3A';
const INK = '#16181D';
const MUTED = '#6B7280';
const BG = '#F3F4F6';
const MAX_DESC = 500;

// Problemas típicos de un picker: tocar uno rellena el asunto
const ATAJOS = [
  'Producto sin stock en la sucursal',
  'Precio distinto en góndola',
  'Cliente no acepta el sustituto',
  'Cliente no responde',
  'Problema con el código de retiro',
  'La app no carga mi pedido',
];

const FilaResumen = ({ icono, label, valor, ultima }) => (
  <>
    <View style={styles.resumenRow}>
      <View style={styles.resumenIcono}>
        <Ionicons name={icono} size={17} color={PRIMARY} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.resumenLabel}>{label}</Text>
        <Text style={styles.resumenValor} numberOfLines={2}>{valor}</Text>
      </View>
    </View>
    {!ultima && <View style={styles.divider} />}
  </>
);

export default function AyudaPickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Si vienes desde un pedido: router.push({ pathname: '/picker/ayuda_picker', params: { pedido: id } })
  const pedidoParam = Array.isArray(params.pedido) ? params.pedido[0] : params.pedido;

  const [categorias, setCategorias] = useState([]);
  const [cargandoCats, setCargandoCats] = useState(true);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [pedido, setPedido] = useState(pedidoParam ? String(pedidoParam) : '');
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [alertConfig, setAlertConfig] = useState(null);
  const [enviado, setEnviado] = useState(null); // resumen del reporte enviado

  // Animación de la pantalla de éxito
  const escala = useRef(new Animated.Value(0)).current;
  const aparecer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const cargarCategorias = async () => {
      // Intenta traer solo las categorías de picker (columna "rol").
      // Si la columna aún no existe o no hay filas, usa todas las categorías.
      const { data: soloPicker, error } = await supabase
        .from('categorias_contacto')
        .select('id, nombre')
        .eq('rol', 'picker')
        .order('nombre');

      if (!error && soloPicker?.length) {
        setCategorias(soloPicker);
      } else {
        const { data: todas } = await supabase
          .from('categorias_contacto')
          .select('id, nombre')
          .order('nombre');
        if (todas) setCategorias(todas);
      }
      setCargandoCats(false);
    };
    cargarCategorias();
  }, []);

  useEffect(() => {
    if (!enviado) return;
    escala.setValue(0);
    aparecer.setValue(0);
    Animated.sequence([
      Animated.spring(escala, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(aparecer, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [enviado]);

  const volver = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/picker');
  };

  const nuevoReporte = () => {
    setCategoriaSeleccionada(null);
    setPedido('');
    setAsunto('');
    setDescripcion('');
    setEnviado(null);
  };

  const formularioListo =
    !!categoriaSeleccionada && asunto.trim().length > 0 && descripcion.trim().length > 0;

  const handleEnviar = async () => {
    if (!formularioListo) {
      setAlertConfig({
        icon: 'alert-circle',
        iconColor: PRIMARY,
        title: 'Faltan datos',
        message: 'Completa la categoría, el asunto y la descripción',
        buttonText: 'Entendido',
        onPress: () => setAlertConfig(null),
      });
      return;
    }

    setEnviando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setEnviando(false);
      router.replace('/login');
      return;
    }

    const nombreCategoria = categorias.find((c) => c.id === categoriaSeleccionada)?.nombre ?? '';

    // El N° de pedido va al inicio de la descripción (no requiere columnas nuevas)
    const detalle = pedido.trim()
      ? `Pedido: ${pedido.trim()}\n\n${descripcion.trim()}`
      : descripcion.trim();

    const { error } = await supabase.from('contacto').insert({
      id_usuario: user.id,
      id_categoria: categoriaSeleccionada,
      asunto: asunto.trim(),
      descripcion: detalle,
      estado: 'pendiente',
    });

    setEnviando(false);

    if (error) {
      setAlertConfig({
        icon: 'close-circle',
        iconColor: PRIMARY,
        title: 'Error',
        message: 'No se pudo enviar tu reporte. Intenta de nuevo.',
        buttonText: 'OK',
        onPress: () => setAlertConfig(null),
      });
      return;
    }

    // Aviso por correo (no bloquea: el reporte ya quedó guardado en contacto)
    supabase.functions
      .invoke('enviar-reporte', {
        body: {
          categoria: nombreCategoria,
          asunto: asunto.trim(),
          descripcion: descripcion.trim(),
          pedido: pedido.trim(),
        },
      })
      .then(async ({ error: errorCorreo }) => {
        if (errorCorreo) {
          let detalle = errorCorreo.message;
          try {
            detalle = JSON.stringify(await errorCorreo.context.json());
          } catch {}
          console.log('[reporte] correo no enviado:', detalle);
        }
      });
      
    setEnviado({
      categoria: nombreCategoria,
      asunto: asunto.trim(),
      pedido: pedido.trim(),
    });
  };

  // ───────── Pantalla de éxito ─────────
  if (enviado) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.exitoWrap}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.halo, { transform: [{ scale: escala }] }]}>
            <View style={styles.circulo}>
              <Ionicons name="checkmark" size={56} color="#fff" />
            </View>
          </Animated.View>

          <Animated.View style={[styles.exitoContenido, { opacity: aparecer }]}>
            <Text style={styles.exitoTitulo}>¡Reporte enviado!</Text>
            <Text style={styles.exitoSub}>
              Ya lo recibimos. El equipo lo revisará lo antes posible.
            </Text>

            <View style={styles.chipPendiente}>
              <Ionicons name="time-outline" size={14} color="#92400E" />
              <Text style={styles.chipPendienteText}>Pendiente de revisión</Text>
            </View>

            <View style={styles.resumenCard}>
              {!!enviado.categoria && (
                <FilaResumen
                  icono="pricetag-outline"
                  label="Categoría"
                  valor={enviado.categoria}
                />
              )}
              <FilaResumen
                icono="chatbubble-ellipses-outline"
                label="Asunto"
                valor={enviado.asunto}
                ultima={!enviado.pedido}
              />
              {!!enviado.pedido && (
                <FilaResumen
                  icono="receipt-outline"
                  label="Pedido"
                  valor={enviado.pedido}
                  ultima
                />
              )}
            </View>

            <TouchableOpacity style={styles.btnEnviar} activeOpacity={0.85} onPress={volver}>
              <Ionicons name="arrow-back" size={18} color="#fff" />
              <Text style={styles.btnEnviarText}>Volver a mi perfil</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSecundario} activeOpacity={0.8} onPress={nuevoReporte}>
              <Text style={styles.btnSecundarioText}>Enviar otro reporte</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ───────── Formulario ─────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={volver} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayuda y reclamos</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Ionicons name="help-buoy-outline" size={22} color={PRIMARY} />
            </View>
            <Text style={styles.introText}>
              ¿Tuviste un problema armando un pedido o con la app? Cuéntanos y lo revisamos.
            </Text>
          </View>

          {/* Categoría */}
          <Text style={styles.label}>¿Qué tipo de problema es?</Text>
          {cargandoCats ? (
            <ActivityIndicator color={PRIMARY} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
          ) : (
            <View style={styles.categoriasList}>
              {categorias.map((cat) => {
                const activa = categoriaSeleccionada === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoriaChip, activa && styles.categoriaChipActive]}
                    activeOpacity={0.8}
                    onPress={() => setCategoriaSeleccionada(cat.id)}
                  >
                    <Text style={[styles.categoriaText, activa && styles.categoriaTextActive]}>
                      {cat.nombre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Pedido (opcional) */}
          <Text style={styles.label}>N° de pedido (opcional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Si el problema es de un pedido, indícalo aquí"
            placeholderTextColor="#9AA0A8"
            value={pedido}
            onChangeText={setPedido}
            maxLength={40}
            autoCapitalize="none"
          />

          {/* Atajos */}
          <Text style={styles.label}>Problemas frecuentes</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.atajosRow}
          >
            {ATAJOS.map((texto) => (
              <TouchableOpacity
                key={texto}
                style={styles.atajoChip}
                activeOpacity={0.8}
                onPress={() => setAsunto(texto)}
              >
                <Text style={styles.atajoText}>{texto}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Asunto */}
          <Text style={styles.label}>Asunto</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Faltaba el producto en la góndola"
            placeholderTextColor="#9AA0A8"
            value={asunto}
            onChangeText={setAsunto}
            maxLength={100}
          />

          {/* Descripción */}
          <Text style={styles.label}>Cuéntanos qué pasó</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Indica el producto y qué ocurrió..."
            placeholderTextColor="#9AA0A8"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={MAX_DESC}
          />
          <Text style={styles.contador}>
            {descripcion.length}/{MAX_DESC}
          </Text>

          <TouchableOpacity
            style={[styles.btnEnviar, (!formularioListo || enviando) && styles.btnEnviarDisabled]}
            activeOpacity={0.85}
            onPress={handleEnviar}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={17} color="#fff" />
                <Text style={styles.btnEnviarText}>Enviar reporte</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={!!alertConfig}
        icon={alertConfig?.icon}
        iconColor={alertConfig?.iconColor}
        title={alertConfig?.title}
        message={alertConfig?.message}
        buttonText={alertConfig?.buttonText}
        onPress={alertConfig?.onPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: INK, letterSpacing: -0.3 },

  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },

  intro: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 20, padding: 14,
    boxShadow: '0px 3px 12px rgba(16,24,40,0.05)',
  },
  introIcon: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: ROJO_SUAVE,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  introText: { flex: 1, fontSize: 13.5, color: INK, lineHeight: 19 },

  label: { fontSize: 14, fontWeight: '800', color: '#4B5563', marginTop: 22, marginBottom: 10, marginLeft: 2 },

  categoriasList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoriaChip: {
    borderWidth: 1.5, borderColor: '#E3E5E8', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff',
  },
  categoriaChipActive: { borderColor: PRIMARY, backgroundColor: ROJO_SUAVE },
  categoriaText: { fontSize: 13, fontWeight: '600', color: '#555' },
  categoriaTextActive: { color: PRIMARY, fontWeight: '800' },

  atajosRow: { gap: 8, paddingRight: 8 },
  atajoChip: {
    backgroundColor: INK, borderRadius: 16,
    paddingHorizontal: 13, paddingVertical: 8,
  },
  atajoText: { fontSize: 12.5, fontWeight: '700', color: '#fff' },

  input: {
    borderWidth: 1.5, borderColor: '#E3E5E8', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15,
    color: INK, backgroundColor: '#fff',
  },
  textArea: { height: 140, paddingTop: 14 },
  contador: { alignSelf: 'flex-end', fontSize: 11.5, color: MUTED, marginTop: 6, marginRight: 4 },

  btnEnviar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16, marginTop: 22,
    alignSelf: 'stretch',
  },
  btnEnviarDisabled: { opacity: 0.5 },
  btnEnviarText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Pantalla de éxito
  exitoWrap: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, paddingVertical: 32,
  },
  halo: {
    width: 148, height: 148, borderRadius: 74,
    backgroundColor: 'rgba(27,107,58,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  circulo: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: VERDE,
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 10px 24px rgba(27,107,58,0.35)',
  },
  exitoContenido: { alignItems: 'center', width: '100%', marginTop: 26 },
  exitoTitulo: { fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5 },
  exitoSub: {
    fontSize: 14.5, color: MUTED, textAlign: 'center',
    lineHeight: 21, marginTop: 8, paddingHorizontal: 12,
  },
  chipPendiente: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 6, marginTop: 16,
  },
  chipPendienteText: { fontSize: 12.5, fontWeight: '800', color: '#92400E' },

  resumenCard: {
    alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 16, marginTop: 22,
    boxShadow: '0px 3px 12px rgba(16,24,40,0.05)',
  },
  resumenRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  resumenIcono: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: ROJO_SUAVE,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  resumenLabel: { fontSize: 11.5, color: '#9AA0A8', marginBottom: 2 },
  resumenValor: { fontSize: 14.5, fontWeight: '700', color: INK },
  divider: { height: 1, backgroundColor: '#F1F2F4' },

  btnSecundario: { paddingVertical: 14, marginTop: 6 },
  btnSecundarioText: { fontSize: 14.5, fontWeight: '800', color: PRIMARY },
});