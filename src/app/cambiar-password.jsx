import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CampoTexto from '../components/CampoTexto';
import { supabase } from '../utils/supabase';

const PRIMARY = '#ED1D26';
const MIN_LARGO = 6;

export default function CambiarPasswordScreen() {
  const router = useRouter();

  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }

  const puedeGuardar = actual && nueva && confirmar && !guardando;

  const cambiar = async () => {
    setMensaje(null);

    if (nueva.length < MIN_LARGO) {
      setMensaje({ tipo: 'error', texto: `La nueva contraseña debe tener al menos ${MIN_LARGO} caracteres` });
      return;
    }
    if (nueva !== confirmar) {
      setMensaje({ tipo: 'error', texto: 'Las contraseñas nuevas no coinciden' });
      return;
    }
    if (nueva === actual) {
      setMensaje({ tipo: 'error', texto: 'La nueva contraseña debe ser distinta a la actual' });
      return;
    }

    setGuardando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        router.replace('/login');
        return;
      }

      // 1. Verificar la contraseña actual
      const { error: errorActual } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: actual,
      });
      if (errorActual) {
        setMensaje({ tipo: 'error', texto: 'La contraseña actual es incorrecta' });
        return;
      }

      // 2. Cambiarla
      const { error } = await supabase.auth.updateUser({ password: nueva });
      if (error) {
        setMensaje({ tipo: 'error', texto: error.message || 'No se pudo cambiar la contraseña' });
        return;
      }

      setActual('');
      setNueva('');
      setConfirmar('');
      setMensaje({ tipo: 'ok', texto: 'Contraseña actualizada correctamente' });
    } catch (err) {
      console.error('Error cambiando contraseña', err);
      setMensaje({ tipo: 'error', texto: 'No se pudo cambiar la contraseña' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/perfil')}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cambiar contraseña</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed" size={34} color={PRIMARY} />
            </View>
            <Text style={styles.iconText}>
              Por tu seguridad, primero confirma tu contraseña actual.
            </Text>
          </View>

          {mensaje && (
            <View style={[styles.mensaje, mensaje.tipo === 'ok' ? styles.mensajeOk : styles.mensajeError]}>
              <Ionicons
                name={mensaje.tipo === 'ok' ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={mensaje.tipo === 'ok' ? '#15803d' : PRIMARY}
              />
              <Text style={[styles.mensajeText, { color: mensaje.tipo === 'ok' ? '#15803d' : PRIMARY }]}>
                {mensaje.texto}
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <CampoTexto
              label="Contraseña actual"
              icono="lock-closed-outline"
              placeholder="Tu contraseña actual"
              secure
              value={actual}
              onChangeText={setActual}
              autoCapitalize="none"
            />
            <CampoTexto
              label="Nueva contraseña"
              icono="key-outline"
              placeholder={`Mínimo ${MIN_LARGO} caracteres`}
              secure
              value={nueva}
              onChangeText={setNueva}
              autoCapitalize="none"
            />
            <CampoTexto
              label="Confirmar nueva contraseña"
              icono="key-outline"
              placeholder="Repite la nueva contraseña"
              secure
              value={confirmar}
              onChangeText={setConfirmar}
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={cambiar}
            />
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, !puedeGuardar && styles.btnDisabled]}
            onPress={cambiar}
            disabled={!puedeGuardar}
          >
            {guardando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Cambiar contraseña</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },

  container: { padding: 16, gap: 16, paddingBottom: 60 },

  iconWrap: { alignItems: 'center', paddingVertical: 8, gap: 10 },
  iconCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#fdecea', alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 13, color: '#888', textAlign: 'center', paddingHorizontal: 30 },

  mensaje: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
  },
  mensajeOk: { backgroundColor: '#dcfce7' },
  mensajeError: { backgroundColor: '#fdecea' },
  mensajeText: { fontSize: 13, fontWeight: '700', flex: 1 },

  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  btnPrimary: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#e0a39d' },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});