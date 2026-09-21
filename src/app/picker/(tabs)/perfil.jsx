import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../utils/supabase';

const PRIMARY = '#C21807';

export default function PickerPerfilScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const cargar = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email);

      const { data } = await supabase
        .from('perfiles')
        .select('nombre, apellido')
        .eq('id', user.id)
        .single();

      if (data) setNombre(`${data.nombre} ${data.apellido}`);
    };
    cargar();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Mi Perfil</Text>
      <View style={styles.card}>
        <Text style={styles.nombre}>{nombre}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={PRIMARY} />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', padding: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20 },
  nombre: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  email: { fontSize: 13, color: '#888', marginTop: 4 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#fdecea',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: PRIMARY },
});