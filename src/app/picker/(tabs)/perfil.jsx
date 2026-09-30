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

const PRIMARY = '#C21807';

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
        setNombre(`${data.nombre} ${data.apellido}`);
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
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mi Perfil</Text>
          <Text style={styles.subtitle}>
            Administra tu información personal
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons name="person-outline" size={22} color={PRIMARY} />
        </View>
      </View>

      {/* PERFIL PRINCIPAL */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.avatarText}>{iniciales}</Text>
          )}
        </View>

        <View style={styles.profileInfo}>
          {loading ? (
            <>
              <View style={styles.skeletonName} />
              <View style={styles.skeletonEmail} />
            </>
          ) : (
            <>
              <Text style={styles.nombre} numberOfLines={1}>
                {nombre || 'Usuario'}
              </Text>

              <View style={styles.emailRow}>
                <Ionicons name="mail-outline" size={15} color="#888" />

                <Text style={styles.email} numberOfLines={1}>
                  {email}
                </Text>
              </View>

              {/* SUCURSAL DEL PICKER */}
              {sucursal && (
                <View style={styles.sucursalBadge}>
                  <Ionicons
                    name="storefront-outline"
                    size={14}
                    color={PRIMARY}
                  />

                  <Text style={styles.sucursalText} numberOfLines={1}>
                    {sucursal}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.verifiedBadge}>
          <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
        </View>
      </View>

      {/* INFORMACIÓN */}
      <Text style={styles.sectionTitle}>Información de cuenta</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="person-outline" size={20} color={PRIMARY} />
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Nombre</Text>
            <Text style={styles.infoValue}>
              {nombre || 'No disponible'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="mail-outline" size={20} color={PRIMARY} />
          </View>

          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Correo electrónico</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {email || 'No disponible'}
            </Text>
          </View>
        </View>
      </View>

      {/* CUENTA */}
      <Text style={styles.sectionTitle}>Cuenta</Text>

      <View style={styles.menuCard}>
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={() => {}}
        >
          <View style={styles.menuLeft}>
            <View style={styles.menuIcon}>
              <Ionicons name="settings-outline" size={20} color={PRIMARY} />
            </View>

            <View>
              <Text style={styles.menuTitle}>Configuración</Text>
              <Text style={styles.menuSubtitle}>
                Personaliza tu cuenta
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={19} color="#BDBDBD" />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={() => {}}
        >
          <View style={styles.menuLeft}>
            <View style={styles.menuIcon}>
              <Ionicons
                name="help-circle-outline"
                size={20}
                color={PRIMARY}
              />
            </View>

            <View>
              <Text style={styles.menuTitle}>Ayuda</Text>
              <Text style={styles.menuSubtitle}>¿Necesitas ayuda?</Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={19} color="#BDBDBD" />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* TEST SCANNER */}
        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
          onPress={() => router.push('/test-scanner')}
        >
          <View style={styles.menuLeft}>
            <View style={styles.menuIcon}>
              <Ionicons name="scan-outline" size={20} color={PRIMARY} />
            </View>

            <View>
              <Text style={styles.menuTitle}>Test scanner</Text>
              <Text style={styles.menuSubtitle}>Probar el escáner</Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={19} color="#BDBDBD" />
        </TouchableOpacity>
      </View>

      {/* CERRAR SESIÓN */}
      <TouchableOpacity
        style={styles.logoutBtn}
        activeOpacity={0.75}
        onPress={handleLogout}
      >
        <View style={styles.logoutIcon}>
          <Ionicons name="log-out-outline" size={21} color={PRIMARY} />
        </View>

        <Text style={styles.logoutText}>Cerrar sesión</Text>

        <Ionicons name="chevron-forward" size={18} color="#D7A19B" />
      </TouchableOpacity>

      <Text style={styles.version}>Versión 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 22,
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#1A1A1A',
  },

  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },

  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FDECEA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // PROFILE
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },

  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },

  avatarText: {
    color: '#fff',
    fontSize: 23,
    fontWeight: '800',
  },

  profileInfo: {
    flex: 1,
    marginLeft: 15,
    marginRight: 8,
  },

  nombre: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },

  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },

  email: {
    flex: 1,
    fontSize: 12.5,
    color: '#888',
  },

  verifiedBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EAF5EC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  skeletonName: {
    width: 130,
    height: 18,
    borderRadius: 6,
    backgroundColor: '#EEEEEE',
  },

  skeletonEmail: {
    width: 170,
    height: 12,
    borderRadius: 5,
    backgroundColor: '#F1F1F1',
    marginTop: 8,
  },

  sucursalBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEA',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 8,
    gap: 5,
  },

  sucursalText: {
    flexShrink: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: PRIMARY,
  },

  // SECTIONS
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#444',
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 3,
  },

  // INFO
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 16,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FDECEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 3,
  },

  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },

  // MENU
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 16,
  },

  menuItem: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FDECEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
  },

  menuSubtitle: {
    fontSize: 11.5,
    color: '#999',
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: '#F2F2F2',
  },

  // LOGOUT
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    backgroundColor: '#FFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#F4D9D5',
  },

  logoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FDECEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  logoutText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
  },

  version: {
    textAlign: 'center',
    fontSize: 11,
    color: '#B0B0B0',
    marginTop: 16,
  },
});