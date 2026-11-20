import { Ionicons } from '@expo/vector-icons';
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
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CampoTexto from '../components/CampoTexto';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';

export default function RegisterScreen() {
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [sucursales, setSucursales] = useState([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState(null);
  const [dropdownAbierto, setDropdownAbierto] = useState(false);

  const [nombreDireccion, setNombreDireccion] = useState('Casa');
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [ciudad, setCiudad] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cargarSucursales = async () => {
      const { data, error } = await supabase
        .from('sucursales')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre');
      if (!error && data) setSucursales(data);
    };
    cargarSucursales();
  }, []);

  const sucursalActual = sucursales.find((s) => s.id === sucursalSeleccionada);

  const handleRegister = async () => {
    if (!nombre.trim() || !apellido.trim() || !correo.trim() || !password || !confirmPassword) {
      Alert.alert('Error', 'Completa todos los campos obligatorios');
      return;
    }
    if (!sucursalSeleccionada) {
      Alert.alert('Error', 'Selecciona tu Super Oferta de preferencia');
      return;
    }
    if (!direccion.trim() || !ciudad.trim()) {
      Alert.alert('Error', 'Completa tu dirección y ciudad');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: correo.trim().toLowerCase(),
        password,
        options: {
          data: {
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            telefono: telefono.trim(),
            id_sucursal_preferida: sucursalSeleccionada,
            nombre_direccion: nombreDireccion.trim(),
            direccion: direccion.trim(),
            referencia: referencia.trim(),
            ciudad: ciudad.trim(),
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
        [{ text: 'Ir a iniciar sesión', onPress: () => router.replace('/login') }]
      );
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Hubo un error al registrar el usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.replace('/login')} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Crear cuenta</Text>
              <Text style={styles.subtitle}>Completa tus datos para comenzar</Text>
            </View>
          </View>

          {/* Datos personales */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Datos personales</Text>
            <View style={styles.row}>
              <CampoTexto style={{ flex: 1 }} icono="person-outline" placeholder="Nombre"
                value={nombre} onChangeText={setNombre} />
              <CampoTexto style={{ flex: 1 }} placeholder="Apellido"
                value={apellido} onChangeText={setApellido} />
            </View>
            <CampoTexto icono="mail-outline" placeholder="Correo electrónico"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              value={correo} onChangeText={setCorreo} />
            <CampoTexto icono="call-outline" placeholder="Teléfono (opcional)"
              keyboardType="phone-pad" value={telefono} onChangeText={setTelefono} />
          </View>

          {/* Contraseña */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Contraseña</Text>
            <CampoTexto icono="lock-closed-outline" placeholder="Contraseña" secure
              value={password} onChangeText={setPassword} />
            <CampoTexto icono="lock-closed-outline" placeholder="Confirmar contraseña" secure
              value={confirmPassword} onChangeText={setConfirmPassword} />
          </View>

          {/* Sucursal */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Tu Super Oferta de preferencia</Text>

            <TouchableOpacity
              style={[styles.dropdown, dropdownAbierto && styles.dropdownAbierto]}
              onPress={() => setDropdownAbierto(!dropdownAbierto)}
              activeOpacity={0.8}
            >
              <Ionicons name="storefront-outline" size={19} color={dropdownAbierto ? PRIMARY : '#999'} />
              <Text style={sucursalActual ? styles.dropdownText : styles.dropdownPlaceholder}>
                {sucursalActual ? sucursalActual.nombre : 'Selecciona una sucursal'}
              </Text>
              <Ionicons name={dropdownAbierto ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
            </TouchableOpacity>

            {dropdownAbierto && (
              <View style={styles.dropdownList}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {sucursales.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.dropdownItem, sucursalSeleccionada === s.id && styles.dropdownItemActive]}
                      onPress={() => {
                        setSucursalSeleccionada(s.id);
                        setDropdownAbierto(false);
                      }}
                    >
                      <Text style={[styles.sucursalText, sucursalSeleccionada === s.id && styles.sucursalTextActive]}>
                        {s.nombre}
                      </Text>
                      {sucursalSeleccionada === s.id && (
                        <Ionicons name="checkmark" size={18} color={PRIMARY} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Dirección */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Dirección de entrega</Text>
            <CampoTexto icono="bookmark-outline" placeholder="Nombre (Ej: Casa)"
              value={nombreDireccion} onChangeText={setNombreDireccion} />
            <CampoTexto icono="location-outline" placeholder="Dirección"
              value={direccion} onChangeText={setDireccion} />
            <CampoTexto icono="information-circle-outline" placeholder="Referencia (Ej: Depto 402)"
              value={referencia} onChangeText={setReferencia} />
            <CampoTexto icono="business-outline" placeholder="Ciudad"
              value={ciudad} onChangeText={setCiudad} />
          </View>

          <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Registrar</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/login')}>
            <Text style={styles.link}>¿Ya tienes una cuenta? Inicia sesión</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FA' },
  container: { padding: 16, gap: 14, paddingBottom: 120 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  backBtn: { padding: 6 },
  title: { fontSize: 22, fontWeight: '900', color: '#1a1a1a' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },

  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  row: { flexDirection: 'row', gap: 10 },

  dropdown: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: '#e6e6e6', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#fafafa',
  },
  dropdownAbierto: { borderColor: PRIMARY, backgroundColor: '#fff' },
  dropdownText: { fontSize: 15, color: '#1a1a1a', flex: 1 },
  dropdownPlaceholder: { fontSize: 15, color: '#aaa', flex: 1 },
  dropdownList: {
    borderWidth: 1.5, borderColor: '#e6e6e6', borderRadius: 12,
    backgroundColor: '#fff', maxHeight: 220, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f2f2f2',
  },
  dropdownItemActive: { backgroundColor: '#fdecea' },
  sucursalText: { fontSize: 14, color: '#555', fontWeight: '600' },
  sucursalTextActive: { color: PRIMARY },

  btnPrimary: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  link: { fontSize: 14, color: PRIMARY, fontWeight: '600', textAlign: 'center', marginTop: 4 },
});