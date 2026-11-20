import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import CampoTexto from '../components/CampoTexto';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';

export default function MisDireccionesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [direcciones, setDirecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('direcciones')
      .select('*')
      .eq('id_usuario', user.id)
      .order('created_at', { ascending: false });

    setDirecciones(data || []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const guardarDireccion = async () => {
    if (!nombre.trim() || !direccion.trim()) return;
    setGuardando(true);

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('direcciones').insert({
      id_usuario: user.id,
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      referencia: referencia.trim() || null,
    });

    setNombre(''); setDireccion(''); setReferencia('');
    setGuardando(false);
    setModalVisible(false);
    cargar();
  };

  const eliminarDireccion = async (id) => {
    await supabase.from('direcciones').delete().eq('id', id);
    setDirecciones((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/perfil')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis direcciones</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={28} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={direcciones}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="location-outline" size={70} color="#e0e0e0" />
              <Text style={styles.emptyText}>No tienes direcciones guardadas</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
                <Text style={styles.emptyBtnText}>Agregar dirección</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <Ionicons name="location" size={18} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <Text style={styles.direccion}>{item.direccion}</Text>
                {item.referencia ? <Text style={styles.referencia}>{item.referencia}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => eliminarDireccion(item.id)} hitSlop={10}>
                <Ionicons name="trash-outline" size={20} color="#bbb" />
              </TouchableOpacity>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Fondo: tocar afuera cierra el modal (no ocupa espacio) */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />

          <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'}>
            <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
              <View style={styles.handle} />
              <Text style={styles.modalTitle}>Nueva dirección</Text>

              <CampoTexto icono="bookmark-outline" placeholder="Nombre (ej: Casa, Trabajo)"
                value={nombre} onChangeText={setNombre} />
              <CampoTexto icono="location-outline" placeholder="Dirección completa"
                value={direccion} onChangeText={setDireccion} />
              <CampoTexto icono="information-circle-outline" placeholder="Referencia (opcional)"
                value={referencia} onChangeText={setReferencia} />

              <TouchableOpacity style={styles.btnGuardar} onPress={guardarDireccion} disabled={guardando}>
                {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnGuardarText}>Guardar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fdecea', alignItems: 'center', justifyContent: 'center',
  },
  nombre: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  direccion: { fontSize: 13, color: '#555', marginTop: 2 },
  referencia: { fontSize: 12, color: '#999', marginTop: 2 },

  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { fontSize: 14, color: '#aaa' },
  emptyBtn: { marginTop: 8, borderWidth: 2, borderColor: PRIMARY, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: PRIMARY, fontWeight: '700' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  btnGuardar: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnGuardarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnCancelar: { alignItems: 'center', paddingVertical: 12 },
  btnCancelarText: { fontSize: 14, fontWeight: '700', color: '#888' },
});