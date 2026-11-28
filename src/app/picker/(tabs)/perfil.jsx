import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../utils/supabase';

const PRIMARY = '#ED1D26';
const ROJO_SUAVE = '#FDECEA';
const INK = '#16181D';
const MUTED = '#6B7280';
const BG = '#F3F4F6';

const FilaInfo = ({ icono, label, valor, ultima }) => (
  <>
    <View style={styles.infoRow}>
      <View style={styles.iconoCaja}>
        <Ionicons name={icono} size={20} color={PRIMARY} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{valor}</Text>
      </View>
    </View>
    {!ultima && <View style={styles.divider} />}
  </>
);

export default function PickerPerfilScreen() {
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [sucursal, setSucursal] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        router.replace('/login');
        return;
      }

      setEmail(user.email ?? '');

      const { data } = await supabase
        .from('perfiles')
        .select('nombre, apellido, sucursales(nombre)')
        .eq('id', user.id)
        .single();

      if (data) {
        setNombre([data.nombre, data.apellido].filter(Boolean).join(' '));
        setSucursal(data.sucursales?.nombre ?? null);
      }

      setLoading(false);
    };

    cargar();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const iniciales = nombre
    ? nombre
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte[0])
        .join('')
        .toUpperCase()
    : '?';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Mi perfil</Text>
        </View>

        {/* Ficha del picker */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.avatarText}>{iniciales}</Text>
            )}
          </View>

          <View style={styles.heroInfo}>
            {loading ? (
              <>
                <View style={styles.skeletonName} />
                <View style={styles.skeletonEmail} />
              </>
            ) : (
              <>
                <Text style={styles.heroNombre} numberOfLines={1}>
                  {nombre || 'Picker'}
                </Text>

                <View style={styles.heroEmailRow}>
                  <Ionicons name="mail-outline" size={14} color="rgba(255,255,255,0.65)" />
                  <Text style={styles.heroEmail} numberOfLines={1}>
                    {email}
                  </Text>
                </View>

                {sucursal && (
                  <View style={styles.sucursalChip}>
                    <Ionicons name="storefront-outline" size={14} color="#F5B8BB" />
                    <Text style={styles.sucursalText} numberOfLines={1}>
                      {sucursal}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Datos de la cuenta */}
        <Text style={styles.sectionTitle}>Mi cuenta</Text>

        <View style={styles.card}>
          <FilaInfo icono="person-outline" label="Nombre" valor={nombre || 'No disponible'} />
          <FilaInfo icono="mail-outline" label="Correo electrónico" valor={email || 'No disponible'} ultima={!sucursal} />
          {!!sucursal && (
            <FilaInfo icono="storefront-outline" label="Sucursal" valor={sucursal} ultima />
          )}
        </View>

        {/* Soporte */}
        <Text style={styles.sectionTitle}>Soporte</Text>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => router.push('/picker/ayuda_picker')}
          >
            <View style={styles.iconoCaja}>
              <Ionicons name="help-buoy-outline" size={20} color={PRIMARY} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.menuTitle}>Ayuda y reclamos</Text>
              <Text style={styles.menuSubtitle}>Cuéntanos si tuviste un problema</Text>
            </View>

            <Ionicons name="chevron-forward" size={19} color="#BDC1C8" />
          </TouchableOpacity>
        </View>

        {/* Cerrar sesión */}
        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={21} color={PRIMARY} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  header: { paddingHorizontal: 4, paddingTop: 8, paddingBottom: 18 },
  title: { fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5 },

  // Ficha
  hero: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: INK, borderRadius: 24, padding: 18,
    boxShadow: '0px 8px 20px rgba(22,24,29,0.22)',
  },
  avatar: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  heroInfo: { flex: 1, marginLeft: 16 },
  heroNombre: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  heroEmailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  heroEmail: { flex: 1, fontSize: 12.5, color: 'rgba(255,255,255,0.65)' },
  sucursalChip: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginTop: 10,
  },
  sucursalText: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: '#fff' },
  skeletonName: {
    width: 130, height: 18, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.14)',
  },
  skeletonEmail: {
    width: 170, height: 12, borderRadius: 5, marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },

  // Secciones
  sectionTitle: {
    fontSize: 14, fontWeight: '800', color: '#4B5563',
    marginTop: 26, marginBottom: 10, marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 16,
    boxShadow: '0px 3px 12px rgba(16,24,40,0.05)',
  },
  iconoCaja: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: ROJO_SUAVE,
    alignItems: 'center', justifyContent: 'center', marginRight: 13,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  infoLabel: { fontSize: 11.5, color: '#9AA0A8', marginBottom: 2 },
  infoValue: { fontSize: 14.5, fontWeight: '700', color: INK },
  divider: { height: 1, backgroundColor: '#F1F2F4' },

  menuItem: { minHeight: 68, flexDirection: 'row', alignItems: 'center' },
  menuTitle: { fontSize: 14.5, fontWeight: '700', color: INK },
  menuSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },

  // Cerrar sesión
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 24, backgroundColor: ROJO_SUAVE, borderRadius: 18, paddingVertical: 15,
  },
  logoutText: { fontSize: 15, fontWeight: '800', color: PRIMARY },
});