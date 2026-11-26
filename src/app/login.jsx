import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import CampoTexto from '../components/CampoTexto';
import { supabase } from '../utils/supabase';

const PRIMARY = '#ED1D26';
const SECUNDARY = '#FBB03C';
const INK = '#1a1a1a';
// Fondos del login: cada vez que se abre la pantalla se elige uno distinto al anterior.
const FONDOS = [
  require('../../assets/images/fondos/fondo_comida.jpg'),
  require('../../assets/images/fondos/fondo_congelados.jpg'),
  require('../../assets/images/fondos/fondo_fv.jpg'),
  require('../../assets/images/fondos/fondo_pan.jpg'),
  require('../../assets/images/fondos/fondo_snacks.jpg'),
];

// Logo del círculo (reemplaza por tu URL)
const LOGO_URL = 'https://pnhwofjsmqrmcdrsfpxg.supabase.co/storage/v1/object/public/banners/PNG%20de%20login%20SO-Photoroom.png';

let ultimoFondo = -1;
const elegirFondo = () => {
  let i = Math.floor(Math.random() * FONDOS.length);
  // evita repetir el mismo fondo dos veces seguidas
  while (FONDOS.length > 1 && i === ultimoFondo) {
    i = Math.floor(Math.random() * FONDOS.length);
  }
  ultimoFondo = i;
  return FONDOS[i];
};

const MIN_PASSWORD = 6; // mínimo por defecto de Supabase; súbelo aquí y en el dashboard si quieres más

// Pasos del modal: 'login' -> 'correo' -> 'codigo' -> 'nueva'
const TITULOS = {
  login: ['Iniciar sesión', 'Ingresa tus credenciales'],
  correo: ['Recuperar contraseña', 'Te enviaremos un código a tu correo'],
  codigo: ['Revisa tu correo', 'Ingresa el código que te enviamos'],
  nueva: ['Nueva contraseña', 'Elige una contraseña que recuerdes'],
};

const PASOS_RECUPERACION = ['correo', 'codigo', 'nueva'];

// A qué paso vuelve el botón de retroceso (en 'nueva' no hay vuelta: ya hay sesión temporal)
const ATRAS = { correo: 'login', codigo: 'correo' };

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [paso, setPaso] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { texto, titulo? } -> error inline
  const [fondo] = useState(elegirFondo);
  const [logoFalla, setLogoFalla] = useState(false);

  const error = (texto, titulo) => setMensaje({ texto, titulo });

  const irA = (nuevoPaso) => {
    setMensaje(null);
    setPaso(nuevoPaso);
  };

  // Al escribir en cualquier campo se limpia el mensaje de error
  const cambiar = (setter) => (valor) => {
    setter(valor);
    if (mensaje) setMensaje(null);
  };

  const limpiarCampos = () => {
    setEmail('');
    setPassword('');
    setCodigo('');
    setNuevaPassword('');
    setConfirmarPassword('');
    setMensaje(null);
  };

  const cerrarModal = () => {
    // Tras verificar el código ya hay sesión; si abandona antes de cambiar la clave, se cierra.
    if (paso === 'nueva') supabase.auth.signOut();
    setModalVisible(false);
    setPaso('login');
    limpiarCampos();
  };

  // Carga el perfil, guarda el rol y entra a la app (usado por login y por recuperación)
  const entrarConPerfil = async (userId) => {
    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .select('rol, nombre')
      .eq('id', userId)
      .single();

    if (perfilError || !perfil) {
      error('No se pudo cargar tu perfil. Intenta de nuevo.');
      return;
    }

    setModalVisible(false);
    setPaso('login');
    limpiarCampos();

    // Guardar el rol no debe romper el login si el almacenamiento falla.
    try {
      await AsyncStorage.setItem('@rol', perfil.rol);
    } catch (e) {
      console.warn('No se pudo guardar el rol', e);
    }

    router.replace(perfil.rol === 'admin' ? '/admin' : perfil.rol === 'picker' ? '/picker' : '/(tabs)');
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      error('Completa tu correo y tu contraseña.');
      return;
    }

    setMensaje(null);
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        error('Correo o contraseña incorrectos.');
        return;
      }

      await entrarConPerfil(data.user.id);
    } catch (err) {
      console.error('Error en el login', err);
      error('No se pudo iniciar sesión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 1: pedir el código al correo
  const enviarCodigo = async () => {
    const correo = email.trim().toLowerCase();
    if (!correo) {
      error('Ingresa tu correo.');
      return;
    }

    setMensaje(null);
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(correo);
      if (resetError) {
        if (resetError.status === 429) {
          error('Ya te enviamos un código. Intenta de nuevo en unos minutos.', 'Espera un momento');
        } else {
          console.error('Error enviando código', resetError);
          error('No se pudo enviar el código. Intenta de nuevo.');
        }
        return;
      }
      // Mismo mensaje exista o no la cuenta, para no revelar qué correos están registrados.
      setCodigo('');
      irA('codigo');
    } catch (err) {
      console.error('Error enviando código', err);
      error('No se pudo enviar el código. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: verificar el código (esto inicia una sesión temporal de recuperación)
  const verificarCodigo = async () => {
    const token = codigo.trim();
    if (!token) {
      error('Ingresa el código que te llegó al correo.');
      return;
    }

    setMensaje(null);
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: 'recovery',
      });
      if (otpError) {
        error('El código es incorrecto o ya venció. Pide uno nuevo.', 'Código inválido');
        return;
      }
      irA('nueva');
    } catch (err) {
      console.error('Error verificando código', err);
      error('No se pudo verificar el código. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 3: guardar la nueva contraseña y entrar
  const guardarPassword = async () => {
    if (nuevaPassword.length < MIN_PASSWORD) {
      error(`Debe tener al menos ${MIN_PASSWORD} caracteres.`, 'Contraseña muy corta');
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      error('Las contraseñas no coinciden.');
      return;
    }

    setMensaje(null);
    setLoading(true);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({ password: nuevaPassword });
      if (updateError) {
        if (updateError.code === 'same_password') {
          error('La nueva contraseña debe ser distinta a la anterior.');
        } else {
          console.error('Error actualizando contraseña', updateError);
          error('No se pudo actualizar la contraseña. Intenta de nuevo.');
        }
        return;
      }

      await entrarConPerfil(data.user.id);
    } catch (err) {
      console.error('Error actualizando contraseña', err);
      error('No se pudo actualizar la contraseña. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const [titulo, subtitulo] = TITULOS[paso];
  const indicePaso = PASOS_RECUPERACION.indexOf(paso);
  const pasoAtras = ATRAS[paso];

  return (
    <ImageBackground
      source={fondo}
      style={styles.bg}
      resizeMode="cover"
    >
      {/* Capa oscura para que el texto blanco se lea sobre cualquier foto */}
      <View style={styles.scrim} pointerEvents="none" />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.hero}>
        </View>

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 16, 40) }]}>
          <View style={styles.logoCircle}>
            {logoFalla ? (
              <Text style={styles.logoText}>S</Text>
            ) : (
              <Image
                source={{ uri: LOGO_URL }}
                style={styles.logoImg}
                resizeMode="cover"
                onError={() => setLogoFalla(true)}
              />
            )}
          </View>

          <Text style={styles.welcome}>¡Te damos la bienvenida a</Text>
          <Text style={styles.welcomeSub}>
            <Text style={styles.superO}>SuperO</Text>
            <Text style={styles.ferta}>fertas</Text>
            <Text style={styles.appText}> App!</Text>
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
              <Text style={styles.btnPrimaryText}>Iniciar sesión</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => router.push('/register')}
              activeOpacity={0.85}
            >
              <Text style={styles.btnSecondaryText}>Crear cuenta</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/(tabs)')} activeOpacity={0.7}>
              <Text style={styles.skipText}>Continuar sin iniciar sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={cerrarModal}
      >
        <View style={styles.modalOverlay}>
          {/* Fondo: tocar afuera cierra el modal (no ocupa espacio) */}
          <Pressable style={StyleSheet.absoluteFill} onPress={cerrarModal} />

          <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'}>
            <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
              <View style={styles.handle} />

              <View style={styles.modalHeader}>
                {!!pasoAtras && (
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => irA(pasoAtras)}
                    activeOpacity={0.7}
                    hitSlop={8}
                  >
                    <Ionicons name="chevron-back" size={20} color={INK} />
                  </TouchableOpacity>
                )}
                <View style={styles.modalHeaderText}>
                  <Text style={styles.modalTitle}>{titulo}</Text>
                  <Text style={styles.modalSubtitle}>{subtitulo}</Text>
                </View>
              </View>

              {indicePaso >= 0 && (
                <View style={styles.steps}>
                  {PASOS_RECUPERACION.map((p, i) => (
                    <View key={p} style={[styles.stepBar, i <= indicePaso && styles.stepBarActive]} />
                  ))}
                </View>
              )}

              {!!mensaje && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={20} color={PRIMARY} style={styles.errorIcon} />
                  <View style={styles.errorTextWrap}>
                    {!!mensaje.titulo && <Text style={styles.errorTitle}>{mensaje.titulo}</Text>}
                    <Text style={styles.errorText}>{mensaje.texto}</Text>
                  </View>
                </View>
              )}

              {paso === 'login' && (
                <>
                  <CampoTexto
                    icono="mail-outline"
                    placeholder="Correo electrónico"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={cambiar(setEmail)}
                  />
                  <CampoTexto
                    icono="lock-closed-outline"
                    placeholder="Contraseña"
                    secure
                    value={password}
                    onChangeText={cambiar(setPassword)}
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                  />

                  <TouchableOpacity onPress={() => irA('correo')} hitSlop={8}>
                    <Text style={styles.linkOlvido}>¿Olvidaste tu contraseña?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnPrimary, { marginTop: 4 }, loading && styles.btnDisabled]}
                    onPress={handleLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Entrar</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.btnSecondary} onPress={cerrarModal} activeOpacity={0.85}>
                    <Text style={styles.btnSecondaryText}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              )}

              {paso === 'correo' && (
                <>
                  <CampoTexto
                    icono="mail-outline"
                    placeholder="Correo electrónico"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={cambiar(setEmail)}
                    returnKeyType="go"
                    onSubmitEditing={enviarCodigo}
                  />

                  <TouchableOpacity
                    style={[styles.btnPrimary, { marginTop: 8 }, loading && styles.btnDisabled]}
                    onPress={enviarCodigo}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Enviar código</Text>}
                  </TouchableOpacity>
                </>
              )}

              {paso === 'codigo' && (
                <>
                  <Text style={styles.hint}>
                    Si {email.trim().toLowerCase()} tiene una cuenta, te enviamos un código. Puede tardar un minuto;
                    revisa también spam.
                  </Text>
                  <CampoTexto
                    icono="key-outline"
                    placeholder="Código"
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={codigo}
                    onChangeText={cambiar(setCodigo)}
                    returnKeyType="go"
                    onSubmitEditing={verificarCodigo}
                  />

                  <TouchableOpacity
                    style={[styles.btnPrimary, { marginTop: 8 }, loading && styles.btnDisabled]}
                    onPress={verificarCodigo}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Verificar código</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={enviarCodigo} disabled={loading} hitSlop={8}>
                    <Text style={styles.linkOlvido}>Reenviar código</Text>
                  </TouchableOpacity>
                </>
              )}

              {paso === 'nueva' && (
                <>
                  <CampoTexto
                    icono="lock-closed-outline"
                    placeholder="Nueva contraseña"
                    secure
                    value={nuevaPassword}
                    onChangeText={cambiar(setNuevaPassword)}
                  />
                  <CampoTexto
                    icono="lock-closed-outline"
                    placeholder="Repite la contraseña"
                    secure
                    value={confirmarPassword}
                    onChangeText={cambiar(setConfirmarPassword)}
                    returnKeyType="go"
                    onSubmitEditing={guardarPassword}
                  />

                  <TouchableOpacity
                    style={[styles.btnPrimary, { marginTop: 8 }, loading && styles.btnDisabled]}
                    onPress={guardarPassword}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Guardar y entrar</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  safe: { flex: 1, justifyContent: 'space-between' },

  // Texto sobre la foto
  hero: { paddingHorizontal: 28, paddingTop: 28 },
  heroTitle: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.9)', marginTop: 6, lineHeight: 22, maxWidth: 280 },

  // Hoja inferior
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 58,
    alignItems: 'center',
    boxShadow: '0px -6px 24px rgba(0,0,0,0.12)',
  },
  logoCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    position: 'absolute', top: -42,
    borderWidth: 4, borderColor: '#fff',
    overflow: 'hidden',
    boxShadow: '0px 6px 14px rgba(0,0,0,0.25)',
  },
  logoImg: { width: '100%', height: '100%' },
  logoText: { fontSize: 34, fontWeight: '900', color: '#fff' },
  welcome: { fontSize: 19, fontWeight: '600', color: '#0f0f0f', textAlign: 'center' },
  welcomeSub: {
    fontSize: 28, fontWeight: '900', color: PRIMARY, textAlign: 'center',
    letterSpacing: 2.6, lineHeight: 34, marginTop: 2, marginBottom: 26,
  },
    superO: { color: PRIMARY },
    ferta: { color: SECUNDARY },
    appText: { fontWeight: '900', color: '#0f0f0f', letterSpacing: 0.7 },
  buttons: { width: '100%', gap: 12 },

  // Botones
  btnPrimary: {
    backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', width: '100%',
    boxShadow: '0px 4px 12px rgba(194,24,7,0.28)',
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  btnSecondary: {
    borderRadius: 16, paddingVertical: 15, alignItems: 'center',
    width: '100%', borderWidth: 1.5, borderColor: PRIMARY,
  },
  btnSecondaryText: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  btnDisabled: { opacity: 0.7 },
  skipText: { fontSize: 14, color: '#777', fontWeight: '600', textAlign: 'center', paddingVertical: 8 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, gap: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 6 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalHeaderText: { flex: 1 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#f2f2f4',
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: INK, letterSpacing: -0.4 },
  modalSubtitle: { fontSize: 14, color: '#888', marginTop: 2 },

  // Indicador de pasos de la recuperación
  steps: { flexDirection: 'row', gap: 6 },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#ececec' },
  stepBarActive: { backgroundColor: PRIMARY },

  // Error inline
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fdecea', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  errorIcon: { marginTop: 1 },
  errorTextWrap: { flex: 1 },
  errorTitle: { fontSize: 14, fontWeight: '800', color: PRIMARY, marginBottom: 2 },
  errorText: { fontSize: 13, color: '#8a1b10', lineHeight: 18 },

  linkOlvido: { fontSize: 14, color: PRIMARY, fontWeight: '700', textAlign: 'center', paddingVertical: 4 },
  hint: { fontSize: 13, color: '#666', lineHeight: 18 },
});