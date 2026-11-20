import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
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

export default function DatosPersonalesScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [apellido, setApellido] = useState('');
  const [original, setOriginal] = useState({ nombre: '', apellido: '', telefono: '' });
  const [avatarUrl, setAvatarUrl] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      setEmail(user.email ?? '');

      const { data } = await supabase
        .from('perfiles')
        .select('nombre, apellido,telefono, avatar_url')
        .eq('id', user.id)
        .single();

      if (data) {
        setNombre(data.nombre ?? '');
        setApellido(data.apellido ?? '');
        setTelefono(data.telefono ?? '');
        setOriginal({ nombre: data.nombre ?? '', telefono: data.telefono ?? '', apellido: data.apellido ?? '' });
        setAvatarUrl(data.avatar_url ?? null);
      }
      setCargando(false);
    };
    cargar();
  }, []);

  const hayCambios =
    nombre.trim() !== original.nombre || apellido.trim() !== original.apellido || telefono.trim() !== original.telefono;

  const iniciales =
    `${nombre.trim()[0] ?? ''}${apellido.trim()[0] ?? ''}${telefono.trim()[0] ?? ''}`.toUpperCase();

  const cambiarFoto = async () => {
    setMensaje(null);

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (resultado.canceled) return;

    const asset = resultado.assets[0];
    setSubiendoFoto(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión');

      const respuesta = await fetch(asset.uri);
      const archivo = await respuesta.arrayBuffer();
      const ruta = `${user.id}/avatar.jpg`;

      const { error: errorSubida } = await supabase.storage
        .from('avatars')
        .upload(ruta, archivo, {
          contentType: asset.mimeType || 'image/jpeg',
          upsert: true,
        });
      if (errorSubida) throw errorSubida;

      const { data: publica } = supabase.storage.from('avatars').getPublicUrl(ruta);
      // ?t= evita que se quede en caché la foto anterior
      const url = `${publica.publicUrl}?t=${Date.now()}`;

      const { data: filas, error: errorPerfil } = await supabase
        .from('perfiles')
        .update({ avatar_url: url })
        .eq('id', user.id)
        .select('id');
      if (errorPerfil) throw errorPerfil;
      if (!filas || filas.length === 0) throw new Error('Sin permisos para actualizar el perfil');

      setAvatarUrl(url);
      setMensaje({ tipo: 'ok', texto: 'Foto actualizada' });
    } catch (err) {
      console.error('Error subiendo foto', err);
      setMensaje({ tipo: 'error', texto: 'No se pudo subir la foto' });
    } finally {
      setSubiendoFoto(false);
    }
  };

  const guardar = async () => {
    setMensaje(null);

    if (!nombre.trim() || !apellido.trim() || !telefono.trim()) {
      setMensaje({ tipo: 'error', texto: 'Completa tu nombre y apellido y teléfono' });
      return;
    }

    setGuardando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión');

      const { data: filas, error } = await supabase
        .from('perfiles')
        .update({ nombre: nombre.trim(), apellido: apellido.trim(), telefono: nombre.trim() })
        .eq('id', user.id)
        .select('id');

      if (error) throw error;
      if (!filas || filas.length === 0) throw new Error('Sin permisos para actualizar el perfil');

      setOriginal({ nombre: nombre.trim(), apellido: apellido.trim(), telefono: telefono.trim() });
      setNombre(nombre.trim());
      setApellido(apellido.trim());
      setTelefono(telefono.trim());
      setMensaje({ tipo: 'ok', texto: 'Datos guardados correctamente' });
    } catch (err) {
      console.error('Error guardando datos', err);
      setMensaje({ tipo: 'error', texto: 'No se pudieron guardar los datos' });
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
        <Text style={styles.headerTitle}>Datos personales</Text>
        <View style={{ width: 32 }} />
      </View>

      {cargando ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Foto */}
            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={cambiarFoto} activeOpacity={0.85} disabled={subiendoFoto}>
                <View style={styles.avatar}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                  ) : iniciales ? (
                    <Text style={styles.avatarIniciales}>{iniciales}</Text>
                  ) : (
                    <Ionicons name="person" size={44} color="#fff" />
                  )}
                  {subiendoFoto && (
                    <View style={styles.avatarLoading}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                </View>
                <View style={styles.camBadge}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
              </TouchableOpacity>
              <Text style={styles.avatarHint}>Toca para cambiar tu foto</Text>
            </View>

            {/* Mensaje */}
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

            {/* Datos */}
            <View style={styles.card}>
              <CampoTexto
                label="Correo electrónico"
                icono="mail-outline"
                value={email}
                editable={false}
                style={{ opacity: 0.6 }}
              />
              <View style={styles.hintRow}>
                <Ionicons name="lock-closed" size={12} color="#aaa" />
                <Text style={styles.hint}>El correo no se puede modificar</Text>
              </View>

              <CampoTexto
                label="Nombre"
                icono="person-outline"
                placeholder="Tu nombre"
                value={nombre}
                onChangeText={setNombre}
              />
              <CampoTexto
                label="Teléfono"
                icono="call-outline"
                placeholder="Tu teléfono"
                value={telefono}
                onChangeText={setTelefono}
              />
              <CampoTexto
                label="Apellido"
                icono="person-outline"
                placeholder="Tu apellido"
                value={apellido}
                onChangeText={setApellido}
              />
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, (!hayCambios || guardando) && styles.btnDisabled]}
              onPress={guardar}
              disabled={!hayCambios || guardando}
            >
              {guardando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Guardar cambios</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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

  avatarSection: { alignItems: 'center', paddingVertical: 8 },
  avatar: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 4, borderColor: '#fff',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarIniciales: { fontSize: 38, fontWeight: '900', color: '#fff' },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  camBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#F8F9FA',
  },
  avatarHint: { fontSize: 12, color: '#999', marginTop: 10 },

  mensaje: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
  },
  mensajeOk: { backgroundColor: '#dcfce7' },
  mensajeError: { backgroundColor: '#fdecea' },
  mensajeText: { fontSize: 13, fontWeight: '700', flex: 1 },

  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -6 },
  hint: { fontSize: 11, color: '#aaa' },

  btnPrimary: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#e0a39d' },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});