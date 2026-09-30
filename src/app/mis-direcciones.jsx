import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator, FlatList, Modal, StyleSheet, Text,
    TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';

export default function MisDireccionesScreen() {
  const router = useRouter();
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
          <Ionicons name="add-circle" size={26} color={PRIMARY} />
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
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Ionicons name="location" size={20} color={PRIMARY} />
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <Text style={styles.direccion}>{item.direccion}</Text>
                {item.referencia && <Text style={styles.referencia}>{item.referencia}</Text>}
              </View>
              <TouchableOpacity onPress={() => eliminarDireccion(item.id)}>
                <Ionicons name="trash-outline" size={20} color="#aaa" />
              </TouchableOpacity>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva dirección</Text>
            <TextInput style={styles.input} placeholder="Nombre (ej: Casa, Trabajo)" placeholderTextColor="#aaa" value={nombre} onChangeText={setNombre} />
            <TextInput style={styles.input} placeholder="Dirección completa" placeholderTextColor="#aaa" value={direccion} onChangeText={setDireccion} />
            <TextInput style={styles.input} placeholder="Referencia (opcional)" placeholderTextColor="#aaa" value={referencia} onChangeText={setReferencia} />

            <TouchableOpacity style={styles.btnGuardar} onPress={guardarDireccion} disabled={guardando}>
              {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnGuardarText}>Guardar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalVisible(false)}>
              <Text style={styles.btnCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
  },
  nombre: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  direccion: { fontSize: 13, color: '#555', marginTop: 2 },
  referencia: { fontSize: 12, color: '#999', marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyText: { fontSize: 14, color: '#aaa' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#1a1a1a', backgroundColor: '#fafafa',
  },
  btnGuardar: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnGuardarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  btnCancelar: { alignItems: 'center', paddingVertical: 12 },
  btnCancelarText: { fontSize: 14, fontWeight: '700', color: '#888' },
});