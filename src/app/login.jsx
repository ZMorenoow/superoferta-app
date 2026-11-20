import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const PRIMARY = '#C21807';
const MIN_PASSWORD = 6; // mínimo por defecto de Supabase; súbelo aquí y en el dashboard si quieres más

// Pasos del modal: 'login' -> 'correo' -> 'codigo' -> 'nueva'
const TITULOS = {
  login: ['Iniciar sesión', 'Ingresa tus credenciales'],
  correo: ['Recuperar contraseña', 'Te enviaremos un código a tu correo'],
  codigo: ['Revisa tu correo', 'Ingresa el código que te enviamos'],
  nueva: ['Nueva contraseña', 'Elige una contraseña que recuerdes'],
};

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

  const limpiarCampos = () => {
    setEmail('');
    setPassword('');
    setCodigo('');
    setNuevaPassword('');
    setConfirmarPassword('');
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
      Alert.alert('Error', 'No se pudo cargar tu perfil');
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

    router.replace(perfil.rol === 'picker' ? '/picker' : '/(tabs)');
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Completa correo y contraseña');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        Alert.alert('Error', 'Correo o contraseña incorrectos');
        return;
      }

      await entrarConPerfil(data.user.id);
    } catch (err) {
      console.error('Error en el login', err);
      Alert.alert('Error', 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  // Paso 1: pedir el código al correo
  const enviarCodigo = async () => {
    const correo = email.trim().toLowerCase();
    if (!correo) {
      Alert.alert('Error', 'Ingresa tu correo');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(correo);
      if (error) {
        if (error.status === 429) {
          Alert.alert('Espera un momento', 'Ya te enviamos un código. Intenta de nuevo en unos minutos.');
        } else {
          console.error('Error enviando código', error);
          Alert.alert('Error', 'No se pudo enviar el código. Intenta de nuevo.');
        }
        return;
      }
      // Mismo mensaje exista o no la cuenta, para no revelar qué correos están registrados.
      setCodigo('');
      setPaso('codigo');
    } catch (err) {
      console.error('Error enviando código', err);
      Alert.alert('Error', 'No se pudo enviar el código. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: verificar el código (esto inicia una sesión temporal de recuperación)
  const verificarCodigo = async () => {
    const token = codigo.trim();
    if (!token) {
      Alert.alert('Error', 'Ingresa el código que te llegó al correo');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: 'recovery',
      });
      if (error) {
        Alert.alert('Código inválido', 'El código es incorrecto o ya venció. Pide uno nuevo.');
        return;
      }
      setPaso('nueva');
    } catch (err) {
      console.error('Error verificando código', err);
      Alert.alert('Error', 'No se pudo verificar el código');
    } finally {
      setLoading(false);
    }
  };

  // Paso 3: guardar la nueva contraseña y entrar
  const guardarPassword = async () => {
    if (nuevaPassword.length < MIN_PASSWORD) {
      Alert.alert('Contraseña muy corta', `Debe tener al menos ${MIN_PASSWORD} caracteres`);
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: nuevaPassword });
      if (error) {
        if (error.code === 'same_password') {
          Alert.alert('Error', 'La nueva contraseña debe ser distinta a la anterior');
        } else {
          console.error('Error actualizando contraseña', error);
          Alert.alert('Error', 'No se pudo actualizar la contraseña');
        }
        return;
      }

      Alert.alert('Listo', 'Tu contraseña fue actualizada');
      await entrarConPerfil(data.user.id);
    } catch (err) {
      console.error('Error actualizando contraseña', err);
      Alert.alert('Error', 'No se pudo actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const [titulo, subtitulo] = TITULOS[paso];

  return (
    <ImageBackground
      source={require('../../assets/images/foto_fondo_login.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 16, 40) }]}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>S</Text>
          </View>

          <Text style={styles.welcome}>¡Te damos la bienvenida a</Text>
          <Text style={styles.appName}>Super Oferta!</Text>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => setModalVisible(true)}>
              <Text style={styles.btnPrimaryText}>Iniciar sesión</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => router.push('/register')}
            >
              <Text style={styles.btnSecondaryText}>Crear cuenta</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
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
              <Text style={styles.modalTitle}>{titulo}</Text>
              <Text style={styles.modalSubtitle}>{subtitulo}</Text>

              {paso === 'login' && (
                <>
                  <CampoTexto
                    icono="mail-outline"
                    placeholder="Correo electrónico"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                  />
                  <CampoTexto
                    icono="lock-closed-outline"
                    placeholder="Contraseña"
                    secure
                    value={password}
                    onChangeText={setPassword}
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                  />

                  <TouchableOpacity onPress={() => setPaso('correo')} hitSlop={8}>
                    <Text style={styles.linkOlvido}>¿Olvidaste tu contraseña?</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnPrimary, { marginTop: 4 }]}
                    onPress={handleLogin}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Entrar</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.btnSecondary} onPress={cerrarModal}>
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
                    onChangeText={setEmail}
                    returnKeyType="go"
                    onSubmitEditing={enviarCodigo}
                  />

                  <TouchableOpacity
                    style={[styles.btnPrimary, { marginTop: 8 }]}
                    onPress={enviarCodigo}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Enviar código</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.btnSecondary} onPress={() => setPaso('login')}>
                    <Text style={styles.btnSecondaryText}>Volver</Text>
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
                    onChangeText={setCodigo}
                    returnKeyType="go"
                    onSubmitEditing={verificarCodigo}
                  />

                  <TouchableOpacity
                    style={[styles.btnPrimary, { marginTop: 8 }]}
                    onPress={verificarCodigo}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Verificar código</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={enviarCodigo} disabled={loading} hitSlop={8}>
                    <Text style={styles.linkOlvido}>Reenviar código</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.btnSecondary} onPress={() => setPaso('correo')}>
                    <Text style={styles.btnSecondaryText}>Cambiar correo</Text>
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
                    onChangeText={setNuevaPassword}
                  />
                  <CampoTexto
                    icono="lock-closed-outline"
                    placeholder="Repite la contraseña"
                    secure
                    value={confirmarPassword}
                    onChangeText={setConfirmarPassword}
                    returnKeyType="go"
                    onSubmitEditing={guardarPassword}
                  />

                  <TouchableOpacity
                    style={[styles.btnPrimary, { marginTop: 8 }]}
                    onPress={guardarPassword}
                    disabled={loading}
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
  safe: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    position: 'absolute', top: -36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
    borderWidth: 3, borderColor: '#fff',
  },
  logoText: { fontSize: 32, fontWeight: '900', color: '#fff' },
  welcome: { fontSize: 16, color: '#555', marginTop: 8, textAlign: 'center' },
  appName: { fontSize: 24, fontWeight: '900', color: '#1a1a1a', marginBottom: 28, textAlign: 'center' },
  buttons: { width: '100%', gap: 12 },
  btnPrimary: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center', width: '100%' },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  btnSecondary: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', width: '100%', borderWidth: 2, borderColor: PRIMARY },
  btnSecondaryText: { fontSize: 16, fontWeight: '700', color: PRIMARY },
  skipText: { fontSize: 14, color: PRIMARY, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 12 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 8 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1a1a1a' },
  modalSubtitle: { fontSize: 14, color: '#888', marginBottom: 4 },
  linkOlvido: { fontSize: 14, color: PRIMARY, fontWeight: '700', textAlign: 'center', paddingVertical: 4 },
  hint: { fontSize: 13, color: '#666', lineHeight: 18 },
});