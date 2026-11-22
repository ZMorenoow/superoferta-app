import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CategoryChips from '../components/CategoryChips';
import { useTabBar } from '../context/TabBarContext';
import { agregarAlCarrito } from '../utils/agregarAlCarrito';
import { MOCK_BANNERS } from '../utils/api';
import { obtenerSucursalDefaultId, obtenerSucursalPreferida } from '../utils/sucursal';
import { supabase } from '../utils/supabase';
import { useBanners } from '../utils/useBanners';

const { width } = Dimensions.get('window');
const PRIMARY = '#C21807';
const BG = '#F5F5F7';
const INK = '#1a1a1a';

const SIDE = 16;
const GAP = 14;
const CARD_W = width - 32;
const CARD_H = Math.round(CARD_W / 1.7);
const ITEM = CARD_W + GAP;
const AUTOPLAY_MS = 4000;

function ProgressBars({ count, current, progress }) {
  return (
    <View style={styles.progressRow} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.progressTrack}>
          {i === current ? (
            <Animated.View
              style={[
                styles.progressFill,
                { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          ) : (
            <View style={[styles.progressFill, { width: i < current ? '100%' : '0%' }]} />
          )}
        </View>
      ))}
    </View>
  );
}

function BannerSlider() {
  const banners = useBanners('home', MOCK_BANNERS);
  const [current, setCurrent] = useState(0);
  const [tick, setTick] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const flatRef = useRef(null);

  useEffect(() => {
    if (banners.length === 0) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: AUTOPLAY_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished && banners.length > 1) {
        const next = (current + 1) % banners.length;
        flatRef.current?.scrollToOffset({ offset: next * ITEM, animated: true });
        setCurrent(next);
      }
    });
    return () => anim.stop();
  }, [current, tick, banners.length]);

  useEffect(() => {
    setCurrent(0);
  }, [banners]);

  if (banners.length === 0) return null;

  return (
    <View style={styles.bannerContainer}>
      <FlatList
        ref={flatRef}
        data={banners}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        snapToInterval={ITEM}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={{ paddingLeft: SIDE, paddingRight: width - CARD_W - SIDE }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        onScrollBeginDrag={() => progress.stopAnimation()}
        onScrollEndDrag={() => setTick((t) => t + 1)}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / ITEM);
          setCurrent(Math.max(0, Math.min(idx, banners.length - 1)));
          setTick((t) => t + 1);
        }}
        renderItem={({ item }) => {
          const titulo = item.titulo ?? item.title;
          const subtitulo = item.subtitulo ?? item.subtitle ?? item.descripcion;
          const imagen = item.imagen_url ?? item.image_url;

          if (imagen) {
            return (
              <View style={styles.bannerCard}>
                <ExpoImage
                  source={{ uri: imagen }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              </View>
            );
          }

          return (
            <View style={[styles.bannerCard, styles.bannerCardText, { backgroundColor: item.bg || PRIMARY }]}>
              <View style={styles.bannerCircleBig} />
              <View style={styles.bannerCircleSmall} />
              <View style={styles.bannerText}>
                {!!titulo && <Text style={styles.bannerTitle}>{titulo}</Text>}
                {!!subtitulo && (
                  <Text style={styles.bannerSubtitle} numberOfLines={6}>{subtitulo}</Text>
                )}
              </View>
              {!!item.emoji && <Text style={styles.bannerEmoji}>{item.emoji}</Text>}
            </View>
          );
        }}
      />
      {banners.length > 1 && (
        <ProgressBars count={banners.length} current={current} progress={progress} />
      )}
    </View>
  );
}

const StaticHeader = React.memo(({ router, cartCount, total }) => (
  <View>
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting}>Hola 👋</Text>
        <Text style={styles.headerTitle}>¿Qué necesitas hoy?</Text>
      </View>
      <TouchableOpacity style={styles.cartBtn} onPress={() => router.push('/cart')} activeOpacity={0.8}>
        <Ionicons name="cart-outline" size={24} color={PRIMARY} />
        {cartCount > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>

    <BannerSlider />

    <Text style={styles.sectionTitle}>Categorías</Text>
    <CategoryChips />

    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0, paddingHorizontal: 0 }]}>
        Productos
      </Text>
      {total > 0 && (
        <Text style={styles.sectionCount}>
          {total} {total === 1 ? 'producto' : 'productos'}
        </Text>
      )}
    </View>
  </View>
));

const elegirPrecio = (filas, idSucursalDefault) => {
  const activas = (filas || []).filter((f) => f.activo !== false);
  if (activas.length === 0) return null;

  const deDefault = activas.find((f) => f.id_sucursal === idSucursalDefault);
  if (deDefault) return deDefault;

  return activas.reduce((min, f) =>
    Number(f.precio ?? Infinity) < Number(min.precio ?? Infinity) ? f : min
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const { handleScroll, showTabBar } = useTabBar();

  const cargarCartCount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCartCount(0);
      return;
    }

    const { data: carrito } = await supabase
      .from('carrito')
      .select('id')
      .eq('id_cliente', user.id)
      .maybeSingle();

    if (!carrito) {
      setCartCount(0);
      return;
    }

    const { data: items } = await supabase
      .from('carrito_items')
      .select('cantidad')
      .eq('id_carrito', carrito.id);

    const total = (items || []).reduce((acc, i) => acc + i.cantidad, 0);
    setCartCount(total);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargarCartCount();
    }, [cargarCartCount])
  );

  // Con sucursal preferida: solo los productos de esa sucursal.
  const cargarPorSucursal = async (idSucursal, q) => {
    let query = supabase
      .from('producto_sucursal')
      .select('precio, stock, id_producto, productos!inner (id, nombre, imagen_url, id_categoria, activo)')
      .eq('id_sucursal', idSucursal)
      .eq('activo', true)
      .eq('productos.activo', true);

    if (q) {
      query = query.ilike('productos.nombre', `%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((ps) => ({
      id: ps.productos.id,
      name: ps.productos.nombre,
      price: Math.round(ps.precio ?? 0),
      original_price: null,
      image_url: ps.productos.imagen_url,
      stock: ps.stock,
      unit: '',
    }));
  };

  // Sin sucursal preferida: todos los productos activos.
  const cargarTodos = async (q) => {
    const idSucursalDefault = await obtenerSucursalDefaultId();

    let query = supabase
      .from('productos')
      .select('id, nombre, imagen_url, id_categoria, producto_sucursal (id_sucursal, precio, stock, activo)')
      .eq('activo', true)
      .order('nombre');

    if (q) {
      query = query.ilike('nombre', `%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((p) => {
      const fila = elegirPrecio(p.producto_sucursal, idSucursalDefault);
      return {
        id: p.id,
        name: p.nombre,
        price: fila ? Math.round(fila.precio ?? 0) : null,
        original_price: null,
        image_url: p.imagen_url,
        stock: fila ? fila.stock : 0,
        unit: '',
      };
    });
  };

  const fetchProducts = useCallback(async (q = '') => {
    showTabBar();
    setLoading(true);
    try {
      const idSucursal = await obtenerSucursalPreferida();

      const lista = idSucursal
        ? await cargarPorSucursal(idSucursal, q)
        : await cargarTodos(q);

      setProducts(lista);
    } catch (err) {
      console.error(err);
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showTabBar]);

  useEffect(() => { fetchProducts(''); }, []);

  const handleProductPress = useCallback(async (item) => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    router.push({ pathname: '/product-detail', params: { id: item.id } });
  }, [router]);

  const handleAddToCart = useCallback(async (item) => {
    const resultado = await agregarAlCarrito(item);

    if (resultado === 'login') {
      router.push('/login');
      return;
    }
    if (resultado === 'error') {
      Alert.alert('Error', 'No se pudo agregar el producto al carrito');
      return;
    }

    cargarCartCount();
    Alert.alert('¡Listo!', 'Se ha agregado correctamente el producto al carrito');
  }, [router, cargarCartCount]);

  const renderProduct = useCallback(({ item }) => {
    const hasDiscount = item.original_price && item.original_price > item.price;
    const discountPct = hasDiscount
      ? Math.round((1 - item.price / item.original_price) * 100)
      : null;
    const sinPrecio = item.price === null || item.price === undefined;
    const noDisponible = item.stock === 0 || sinPrecio;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => handleProductPress(item)}
        activeOpacity={0.9}
      >
        <View style={styles.productImageWrapper}>
          <Image
            source={item.image_url ? { uri: item.image_url } : require('../../assets/images/logo.png')}
            style={[styles.productImage, noDisponible && { opacity: 0.45 }]}
          />

          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discountPct}%</Text>
            </View>
          )}

          {noDisponible && (
            <View style={styles.stockBadge}>
              <Text style={styles.stockBadgeText}>Sin stock</Text>
            </View>
          )}

          {!noDisponible && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => handleAddToCart(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          {!!item.unit && <Text style={styles.productUnit}>{item.unit}</Text>}
          <View style={styles.priceRow}>
            <Text style={[styles.productPrice, noDisponible && { color: '#aaa' }]}>
              {sinPrecio ? 'Consultar' : `$${item.price.toLocaleString('es-CL')}`}
            </Text>
            {hasDiscount && (
              <Text style={styles.originalPrice}>${item.original_price.toLocaleString('es-CL')}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [router, handleAddToCart, handleProductPress]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={19} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar productos..."
          placeholderTextColor="#b5b5b5"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => fetchProducts(search)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); fetchProducts(''); }}>
            <Ionicons name="close-circle" size={19} color="#ccc" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.productsList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <StaticHeader router={router} cartCount={cartCount} total={products.length} />
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchProducts(search); }}
              colors={[PRIMARY]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="basket-outline" size={64} color="#d8d8d8" />
              <Text style={styles.emptyText}>No se encontraron productos</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Cabecera
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 4, paddingBottom: 16,
  },
  greeting: { fontSize: 13, color: '#8a8a8a', fontWeight: '500' },
  headerTitle: { fontSize: 24, color: INK, fontWeight: '800', letterSpacing: -0.4 },
  cartBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 3px 10px rgba(0,0,0,0.08)',
  },
  cartBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: PRIMARY, minWidth: 20, height: 20,
    borderRadius: 10, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: BG,
  },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Buscador
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 20,
    marginTop: 8, marginBottom: 12,
    borderRadius: 16, paddingHorizontal: 16, height: 50,
    borderWidth: 1, borderColor: '#ececec',
    boxShadow: '0px 2px 8px rgba(0,0,0,0.04)',
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#333' },

  // Banners
  bannerContainer: { marginBottom: 10 },
  bannerCard: {
    width: CARD_W, height: CARD_H, borderRadius: 24,
    overflow: 'hidden', backgroundColor: '#eee',
    boxShadow: '0px 6px 16px rgba(0,0,0,0.12)',
  },
  bannerCardText: {
    paddingHorizontal: 22, paddingTop: 30, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  bannerCircleBig: {
    position: 'absolute', width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.10)', right: -50, top: -70,
  },
  bannerCircleSmall: {
    position: 'absolute', width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.08)', left: -30, bottom: -40,
  },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4, letterSpacing: -0.3 },
  bannerSubtitle: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.92)' },
  bannerEmoji: { fontSize: 58, marginLeft: 10 },
  progressRow: {
    position: 'absolute', top: 12, left: SIDE + 16,
    width: CARD_W - 32, flexDirection: 'row', gap: 5,
  },
  progressTrack: {
    flex: 1, height: 3.5, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)', overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#fff' },

  // Secciones
  sectionTitle: {
    fontSize: 18, fontWeight: '800', color: INK,
    paddingHorizontal: 20, marginBottom: 12, marginTop: 10, letterSpacing: -0.3,
  },
  sectionRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 20, marginTop: 14, marginBottom: 12,
  },
  sectionCount: { fontSize: 12, color: '#9a9a9a', fontWeight: '600' },

  // Productos
  row: { paddingHorizontal: 12, gap: 12, marginBottom: 12 },
  // paddingBottom grande: la tab bar flota encima y no debe tapar el último producto
  productsList: { paddingVertical: 4, paddingBottom: 120 },
  productCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0px 3px 12px rgba(0,0,0,0.06)',
  },
  productImageWrapper: {
    width: '100%',
    height: 140,
    backgroundColor: '#fff',
  },
  productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  discountBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: PRIMARY, paddingHorizontal: 9,
    paddingVertical: 4, borderRadius: 20,
  },
  discountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stockBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(26,26,26,0.75)', paddingHorizontal: 9,
    paddingVertical: 4, borderRadius: 20,
  },
  stockBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addBtn: {
    position: 'absolute', right: 10, bottom: 10,
    backgroundColor: PRIMARY, width: 36, height: 36,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 3px 8px rgba(194,24,7,0.35)',
  },
  productInfo: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14 },
  productName: {
    fontSize: 13, fontWeight: '600', color: INK,
    lineHeight: 18, minHeight: 36,
  },
  productUnit: { fontSize: 11, color: '#aaa', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 },
  productPrice: { fontSize: 17, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  originalPrice: { fontSize: 11, color: '#aaa', textDecorationLine: 'line-through' },

  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { fontSize: 15, color: '#aaa' },
});