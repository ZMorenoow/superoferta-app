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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#C21807';

const MOCK_USERS = [
  { email: 'cliente@superoferta.cl', password: '123456', rol: 'cliente', nombre: 'Juan Cliente' },
  { email: 'picker@superoferta.cl', password: '123456', rol: 'picker', nombre: 'Pedro Picker' },
];

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const user = MOCK_USERS.find(
      (u) => u.email === email.trim().toLowerCase() && u.password === password
    );

    if (!user) {
      Alert.alert('Error', 'Correo o contraseña incorrectos');
      return;
    }

    setLoading(true);
    try {
      await AsyncStorage.setItem('@auth_token', 'demo-token');
      await AsyncStorage.setItem('@user_rol', user.rol);
      await AsyncStorage.setItem('@user_nombre', user.nombre);

      setModalVisible(false);
      if (user.rol === 'cliente') router.replace('/(tabs)');
      if (user.rol === 'picker') router.replace('/picker');
    } catch (err) {
      Alert.alert('Error', 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/foto_fondo_login.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 16, 40) }]}>
          {/* Logo circular */}
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>S</Text>
          </View>

          <Text style={styles.welcome}>¡Te damos la bienvenida a</Text>
          <Text style={styles.appName}>Super Oferta!</Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.btnPrimaryText}>Iniciar sesión</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => Alert.alert('Próximamente', 'Registro en construcción')}
            >
              <Text style={styles.btnSecondaryText}>Crear cuenta</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.skipText}>Continuar sin iniciar sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Modal de login */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 40) }]}>
            <Text style={styles.modalTitle}>Iniciar sesión</Text>
            <Text style={styles.modalSubtitle}>Ingresa tus credenciales</Text>

            <TextInput
              style={styles.input}
              placeholder="Correo electrónico"
              placeholderTextColor="#aaa"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity
              style={[styles.btnPrimary, { marginTop: 8 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Entrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.btnSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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

  btnPrimary: {
    backgroundColor: PRIMARY,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', width: '100%',
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  btnSecondary: {
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', width: '100%',
    borderWidth: 2, borderColor: PRIMARY,
  },
  btnSecondaryText: { fontSize: 16, fontWeight: '700', color: PRIMARY },

  skipText: { fontSize: 14, color: PRIMARY, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },

  // Modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, gap: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1a1a1a' },
  modalSubtitle: { fontSize: 14, color: '#888', marginBottom: 4 },

  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa',
  },
});