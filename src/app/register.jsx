import { useRouter } from 'expo-router';

import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
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

import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';

export default function RegisterScreen() {
  const router = useRouter();

  // Datos personales
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');

  // Contraseña
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Sucursal
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState(null);

  // Dirección
  const [nombreDireccion, setNombreDireccion] = useState('Casa');
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cargarSucursales = async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');

      if (!error && data) {
        setSucursales(data);
      }
    };

    cargarSucursales();
  }, []);

  const handleRegister = async () => {
    // Validación de datos personales
    if (
      !nombre.trim() ||
      !apellido.trim() ||
      !correo.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert(
        'Error',
        'Completa todos los campos obligatorios'
      );
      return;
    }

    // Validación de sucursal
    if (!sucursalSeleccionada) {
      Alert.alert(
        'Error',
        'Selecciona tu Super Oferta de preferencia'
      );
      return;
    }

    // Validación de dirección
    if (!direccion.trim() || !ciudad.trim()) {
      Alert.alert(
        'Error',
        'Completa tu dirección y ciudad'
      );
      return;
    }

    // Validación de contraseña
    if (password !== confirmPassword) {
      Alert.alert(
        'Error',
        'Las contraseñas no coinciden'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: correo.trim().toLowerCase(),
        password,

        options: {
          data: {
            // Datos del perfil
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            telefono: telefono.trim(),
            id_sucursal_preferida: sucursalSeleccionada,

            // Datos de la primera dirección
            nombre_direccion: nombreDireccion.trim(),
            direccion: direccion.trim(),
            referencia: referencia.trim(),
            ciudad: ciudad.trim(),
            codigo_postal: codigoPostal.trim(),
          },
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      Alert.alert(
        '✅ Cuenta creada',
        'Se ha creado correctamente tu cuenta. Verifica tu correo electrónico para activarla.',
        [
          {
            text: 'Ir a iniciar sesión',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } catch (err) {
      console.error(err);

      Alert.alert(
        'Error',
        'Hubo un error al registrar el usuario'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>
            Registro de usuario
          </Text>

          {/* =========================
              DATOS PERSONALES
          ========================== */}

          <TextInput
            style={styles.input}
            placeholder="Nombre"
            placeholderTextColor="#aaa"
            value={nombre}
            onChangeText={setNombre}
          />

          <TextInput
            style={styles.input}
            placeholder="Apellido"
            placeholderTextColor="#aaa"
            value={apellido}
            onChangeText={setApellido}
          />

          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            placeholderTextColor="#aaa"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={correo}
            onChangeText={setCorreo}
          />

          <TextInput
            style={styles.input}
            placeholder="Teléfono"
            placeholderTextColor="#aaa"
            keyboardType="phone-pad"
            value={telefono}
            onChangeText={setTelefono}
          />

          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#aaa"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TextInput
            style={styles.input}
            placeholder="Confirmar contraseña"
            placeholderTextColor="#aaa"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {/* =========================
              DIRECCIÓN
          ========================== */}

          <Text style={styles.sectionTitle}>
            Dirección
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Nombre de dirección (Ej: Casa)"
            placeholderTextColor="#aaa"
            value={nombreDireccion}
            onChangeText={setNombreDireccion}
          />

          <TextInput
            style={styles.input}
            placeholder="Dirección"
            placeholderTextColor="#aaa"
            value={direccion}
            onChangeText={setDireccion}
          />

          <TextInput
            style={styles.input}
            placeholder="Referencia (Ej: Depto 402)"
            placeholderTextColor="#aaa"
            value={referencia}
            onChangeText={setReferencia}
          />

          <TextInput
            style={styles.input}
            placeholder="Ciudad"
            placeholderTextColor="#aaa"
            value={ciudad}
            onChangeText={setCiudad}
          />

          <TextInput
            style={styles.input}
            placeholder="Código postal"
            placeholderTextColor="#aaa"
            keyboardType="numeric"
            value={codigoPostal}
            onChangeText={setCodigoPostal}
          />

          {/* =========================
              SUCURSAL PREFERIDA
          ========================== */}

          <Text style={styles.label}>
            Tu Super Oferta de preferencia
          </Text>

          <View style={styles.sucursalList}>
            {sucursales.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.sucursalItem,
                  sucursalSeleccionada === s.id &&
                    styles.sucursalItemActive,
                ]}
                onPress={() =>
                  setSucursalSeleccionada(s.id)
                }
              >
                <Text
                  style={[
                    styles.sucursalText,
                    sucursalSeleccionada === s.id &&
                      styles.sucursalTextActive,
                  ]}
                >
                  {s.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* =========================
              REGISTRAR
          ========================== */}

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>
                Registrar
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.link}>
              ¿Ya tienes una cuenta? Inicia sesión
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },

  container: {
    padding: 24,
    gap: 12,
    paddingBottom: 40,
  },

  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1a1a1a',
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: 12,
    marginBottom: 2,
  },

  input: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 8,
  },

  sucursalList: {
    gap: 8,
    marginBottom: 8,
  },

  sucursalItem: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fafafa',
  },

  sucursalItemActive: {
    borderColor: PRIMARY,
    backgroundColor: '#fdecea',
  },

  sucursalText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },

  sucursalTextActive: {
    color: PRIMARY,
  },

  btnPrimary: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },

  btnPrimaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },

  link: {
    fontSize: 14,
    color: PRIMARY,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
});