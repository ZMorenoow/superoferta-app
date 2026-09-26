import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBar } from '../../context/TabBarContext';
import { supabase } from '../../utils/supabase';

const PRIMARY = '#C21807';

const MENU_ITEMS = [
  { icon: 'receipt-outline', label: 'Mis pedidos', route: '/mis_pedidos' },
  { icon: 'heart-outline', label: 'Favoritos', route: '/favoritos' },
  { icon: 'location-outline', label: 'Mis direcciones', route: '/mis-direcciones' },
  { icon: 'card-outline', label: 'Métodos de pago', route: '/metodos-pago' },
  { icon: 'notifications-outline', label: 'Notificaciones', route: '/notificaciones' },
  { icon: 'help-circle-outline', label: 'Ayuda', route: '/ayuda' },
];

export default function PerfilScreen() {
  const router = useRouter();
  const { handleScroll } = useTabBar();
  const [perfil, setPerfil] = useState(null);
  const [email, setEmail] = useState('');
  const [sucursal, setSucursal] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfil = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.replace('/login');
      return;
    }

    setEmail(user.email);

    const { data, error } = await supabase
      .from('perfiles')
      .select('nombre, apellido, sucursales(nombre)')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setPerfil(data);
      setSucursal(data.sucursales?.nombre ?? null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarPerfil();
    }, [cargarPerfil])
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const nombreCompleto = perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Mi cuenta';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Mi Perfil</Text>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#fff" />
          </View>
          {loading ? (
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 8 }} />
          ) : (
            <>
              <Text style={styles.userName}>{nombreCompleto}</Text>
              <Text style={styles.userEmail}>{email}</Text>
              {sucursal && (
                <View style={styles.sucursalBadge}>
                  <Ionicons name="storefront-outline" size={14} color={PRIMARY} />
                  <Text style={styles.sucursalText}>{sucursal}</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.menuItem, i < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
              onPress={() => router.push(item.route)}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconBox}>
                  <Ionicons name={item.icon} size={20} color={PRIMARY} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={PRIMARY} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  userName: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  userEmail: { fontSize: 13, color: '#888', marginTop: 2 },
  sucursalBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fdecea', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginTop: 10,
  },
  sucursalText: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  menuCard: {
    backgroundColor: '#fff', marginHorizontal: 16,
    borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fdecea', alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16,
    borderWidth: 1.5, borderColor: '#fdecea',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: PRIMARY },
});