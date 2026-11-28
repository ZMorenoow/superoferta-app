import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert from '../../components/CustomAlert';
import { useTabBar } from '../../context/TabBarContext';
import { distanciaKm, estimarMinutos, formatearDistancia, formatearDuracion } from '../../utils/distancia';
import { supabase } from '../../utils/supabase';

const PRIMARY = '#C21807';

// Pedidos que el cliente aún tiene "vivos": pagados hasta que el admin confirma el retiro
const ESTADOS_ACTIVOS = ['pagado', 'asignado', 'en_proceso', 'completado'];

const MENU_ITEMS = [
  { icon: 'person-outline', label: 'Datos personales', route: '/datos-personales' },
  { icon: 'lock-closed-outline', label: 'Cambiar contraseña', route: '/cambiar-password' },
  { icon: 'receipt-outline', label: 'Mis pedidos', route: '/mis_pedidos' },
  { icon: 'card-outline', label: 'Mi tarjeta', route: '/mi-tarjeta' },
  { icon: 'location-outline', label: 'Mis direcciones', route: '/mis-direcciones' },
  { icon: 'notifications-outline', label: 'Notificaciones', route: '/notificaciones' },
  { icon: 'help-circle-outline', label: 'Ayuda', route: '/ayuda' },
];

// Opciones de "Cómo llegar"
const OPCIONES_RUTA = [
  { modo: 'pie', icon: 'walk-outline', label: 'A pie' },
  { modo: 'auto', icon: 'car-outline', label: 'En auto' },
];

export default function PerfilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handleScroll } = useTabBar();
  const [perfil, setPerfil] = useState(null);
  const [sucursal, setSucursal] = useState(null); // { nombre, latitud, longitud }
  const [loading, setLoading] = useState(true);
  const [pedidosActivos, setPedidosActivos] = useState(0);
  const [notifSinLeer, setNotifSinLeer] = useState(0);
  const [alertConfig, setAlertConfig] = useState(null);
  const [alertVisible, setAlertVisible] = useState(false);

  // "Cómo llegar"
  const [modalVisible, setModalVisible] = useState(false);
  const [ubicacionCliente, setUbicacionCliente] = useState(null); // { latitude, longitude }
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);

  // Se conserva el contenido al cerrar para que el texto no cambie durante la animación de salida.
  const cerrarAlert = () => setAlertVisible(false);

  const mostrarAlertLogin = (message) => {
    setAlertConfig({
      icon: 'lock-closed',
      iconColor: PRIMARY,
      title: 'Inicia sesión',
      message,
      buttonText: 'Ir a inicio de sesión',
      onPress: () => {
        cerrarAlert();
        router.replace('/login');
      },
    });
    setAlertVisible(true);
  };

  // Contadores que se muestran al lado de cada opción del menú (por ruta)
  const BADGES = {
    '/mis_pedidos': pedidosActivos,
    '/notificaciones': notifSinLeer,
  };

  const cargarPedidosActivos = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count, error } = await supabase
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('id_cliente', user.id)
      .in('estado', ESTADOS_ACTIVOS)
      .is('entregado_en', null);

    if (!error) setPedidosActivos(count ?? 0);
  }, []);

  // Notificaciones sin leer (leida en false o sin valor, igual que en la pantalla de notificaciones)
  const cargarNotifSinLeer = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { count, error } = await supabase
      .from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('id_usuario', user.id)
      .or('leida.is.null,leida.eq.false');

    if (!error) setNotifSinLeer(count ?? 0);
  }, []);

  const cargarPerfil = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      mostrarAlertLogin('Ingresa o Regístrate para ver tu perfil');
      return;
    }

    const { data, error } = await supabase
      .from('perfiles')
      .select('nombre, apellido, avatar_url, sucursales(nombre, latitud, longitud)')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setPerfil(data);
      setSucursal(data.sucursales ?? null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarPerfil();
      cargarPedidosActivos();
      cargarNotifSinLeer();

      // Los contadores se actualizan solos cuando cambia un pedido o llega una notificación
      const canal = supabase
        .channel('perfil-pedidos')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pedidos' },
          () => cargarPedidosActivos()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notificaciones' },
          () => cargarNotifSinLeer()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(canal);
      };
    }, [cargarPerfil, cargarPedidosActivos, cargarNotifSinLeer])
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const sucursalTieneCoords = sucursal?.latitud != null && sucursal?.longitud != null;

  // Abre la hoja "Cómo llegar" y recién ahí pide la ubicación del cliente
  const abrirComoLlegar = async () => {
    if (!sucursalTieneCoords) return;

    setUbicacionCliente(null);
    setModalVisible(true);
    setBuscandoUbicacion(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUbicacionCliente({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      }
    } catch (err) {
      console.warn('No se pudo obtener la ubicación', err);
    } finally {
      setBuscandoUbicacion(false);
    }
  };

  const cerrarModal = () => setModalVisible(false);

  // Abre la app de mapas con la ruta hacia la sucursal (la app de mapas usa tu ubicación como origen)
  const abrirMapa = (modo) => {
    if (!sucursalTieneCoords) return;

    const destino = `${sucursal.latitud},${sucursal.longitud}`;
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${destino}&dirflg=${modo === 'auto' ? 'd' : 'w'}`
        : `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=${
            modo === 'auto' ? 'driving' : 'walking'
          }`;

    Linking.openURL(url).catch((err) => {
      console.warn('No se pudo abrir el mapa', err);
      Alert.alert('No se pudo abrir el mapa', 'Intenta de nuevo.');
    });
  };

  const kmCliente =
    ubicacionCliente && sucursalTieneCoords
      ? distanciaKm(
          ubicacionCliente.latitude,
          ubicacionCliente.longitude,
          sucursal.latitud,
          sucursal.longitud
        )
      : null;

  const subtituloModal =
    kmCliente !== null
      ? `Estás a ${formatearDistancia(kmCliente)} en línea recta`
      : buscandoUbicacion
        ? 'Buscando tu ubicación...'
        : 'Activa tu ubicación para ver los tiempos estimados';

  const nombreCompleto = perfil
    ? `${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim() || 'Mi cuenta'
    : 'Mi cuenta';

  const iniciales = perfil
    ? `${perfil.nombre?.[0] ?? ''}${perfil.apellido?.[0] ?? ''}`.toUpperCase()
    : '';

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Cabecera roja */}
        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.heroTitle}>Mi perfil</Text>
        </View>

        {/* Avatar + nombre */}
        <View style={styles.profileBlock}>
          <View style={styles.avatar}>
            {perfil?.avatar_url ? (
              <Image source={{ uri: perfil.avatar_url }} style={styles.avatarImg} />
            ) : iniciales ? (
              <Text style={styles.avatarIniciales}>{iniciales}</Text>
            ) : (
              <Ionicons name="person" size={42} color="#fff" />
            )}
          </View>

          {loading ? (
            <ActivityIndicator color={PRIMARY} style={{ marginTop: 12 }} />
          ) : (
            <>
              <Text style={styles.userName}>{nombreCompleto}</Text>
              {sucursal && (
                <TouchableOpacity
                  style={styles.sucursalBadge}
                  onPress={abrirComoLlegar}
                  disabled={!sucursalTieneCoords}
                  activeOpacity={0.7}
                >
                  <Ionicons name="storefront-outline" size={14} color={PRIMARY} />
                  <Text style={styles.sucursalText}>{sucursal.nombre}</Text>
                  {sucursalTieneCoords && (
                    <>
                      <Text style={styles.sucursalSep}>·</Text>
                      <Text style={styles.sucursalLink}>Cómo llegar</Text>
                      <Ionicons name="chevron-forward" size={12} color={PRIMARY} />
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Menú */}
        <Text style={styles.sectionLabel}>Mi cuenta</Text>
        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, i) => {
            const cantidad = BADGES[item.route] ?? 0;

            return (
              <TouchableOpacity
                key={item.route}
                style={[styles.menuItem, i < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
                onPress={() => router.push(item.route)}
                activeOpacity={0.7}
              >
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconBox}>
                    <Ionicons name={item.icon} size={20} color={PRIMARY} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>

                <View style={styles.menuRight}>
                  {cantidad > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{cantidad > 9 ? '9+' : cantidad}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={18} color="#ccc" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={PRIMARY} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      <CustomAlert
        visible={alertVisible}
        icon={alertConfig?.icon}
        iconColor={alertConfig?.iconColor}
        title={alertConfig?.title}
        message={alertConfig?.message}
        buttonText={alertConfig?.buttonText}
        onPress={alertConfig?.onPress}
      />

      {/* Hoja "Cómo llegar" */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={cerrarModal}
      >
        <View style={styles.modalOverlay}>
          {/* Fondo: tocar afuera cierra la hoja */}
          <Pressable style={StyleSheet.absoluteFill} onPress={cerrarModal} />

          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
            <View style={styles.handle} />

            <Text style={styles.modalTitle}>{sucursal?.nombre}</Text>
            <Text style={styles.modalSubtitle}>{subtituloModal}</Text>

            <View style={styles.rutaList}>
              {OPCIONES_RUTA.map((op) => {
                const minutos = estimarMinutos(kmCliente, op.modo);

                return (
                  <TouchableOpacity
                    key={op.modo}
                    style={styles.rutaItem}
                    onPress={() => abrirMapa(op.modo)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.menuIconBox}>
                      <Ionicons name={op.icon} size={20} color={PRIMARY} />
                    </View>
                    <Text style={styles.rutaLabel}>{op.label}</Text>

                    {buscandoUbicacion ? (
                      <ActivityIndicator size="small" color={PRIMARY} />
                    ) : (
                      !!minutos && <Text style={styles.rutaTiempo}>~{formatearDuracion(minutos)}</Text>
                    )}
                    <Ionicons name="chevron-forward" size={18} color="#ccc" />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.nota}>
              Tiempos aproximados. Al elegir una opción se abre tu app de mapas con la ruta real.
            </Text>

            <TouchableOpacity style={styles.btnCerrar} onPress={cerrarModal} activeOpacity={0.85}>
              <Text style={styles.btnCerrarText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  hero: {
    backgroundColor: PRIMARY,
    height: 170,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },

  profileBlock: { alignItems: 'center', marginTop: -56, paddingBottom: 8 },
  avatar: {
    width: 112, height: 112, borderRadius: 56,
    backgroundColor: '#8f1005', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', borderWidth: 4, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 6,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarIniciales: { fontSize: 38, fontWeight: '900', color: '#fff' },
  userName: { fontSize: 21, fontWeight: '800', color: '#1a1a1a', marginTop: 12 },
  sucursalBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fdecea', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginTop: 8,
  },
  sucursalText: { fontSize: 12, fontWeight: '700', color: PRIMARY },
  sucursalSep: { fontSize: 12, color: PRIMARY },
  sucursalLink: { fontSize: 12, fontWeight: '800', color: PRIMARY },

  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: '#999',
    marginHorizontal: 20, marginTop: 20, marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  menuCard: {
    backgroundColor: '#fff', marginHorizontal: 16,
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuIconBox: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: '#fdecea', alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },

  badge: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: 16, marginTop: 20,
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16,
    borderWidth: 1.5, borderColor: '#fdecea',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: PRIMARY },

  // Hoja "Cómo llegar"
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, gap: 12,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 6 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1a1a1a', letterSpacing: -0.4 },
  modalSubtitle: { fontSize: 14, color: '#888', marginTop: -6 },

  rutaList: { gap: 10, marginTop: 4 },
  rutaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#ececec', backgroundColor: '#fff',
  },
  rutaLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  rutaTiempo: { fontSize: 15, fontWeight: '800', color: PRIMARY },

  nota: { fontSize: 12, color: '#888', lineHeight: 17 },

  btnCerrar: {
    borderRadius: 16, paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: PRIMARY, marginTop: 4,
  },
  btnCerrarText: { fontSize: 16, fontWeight: '700', color: PRIMARY },
});