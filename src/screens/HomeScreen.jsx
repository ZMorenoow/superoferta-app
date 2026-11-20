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


const SIDE = 16;                              
const GAP = 16;                               
const CARD_W = width - 30;                    
const CARD_H = Math.round(CARD_W / 1.6);      
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

const StaticHeader = React.memo(({ router, cartCount }) => (
  <View>
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting}>Hola 👋</Text>
        <Text style={styles.headerTitle}>¿Qué necesitas hoy?</Text>
      </View>
      <TouchableOpacity style={styles.cartBtn} onPress={() => router.push('/cart')}>
        <Ionicons name="cart-outline" size={26} color={PRIMARY} />
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

    <Text style={styles.sectionTitle}>Productos</Text>
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
        activeOpacity={0.85}
      >
        <View style={styles.productImageWrapper}>
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discountPct}%</Text>
            </View>
          )}
          <Image
            source={item.image_url ? { uri: item.image_url } : require('../../assets/images/logo.png')}
            style={styles.productImage}
          />
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productUnit}>{item.unit}</Text>
          <View style={styles.productFooter}>
            <View>
              <Text style={styles.productPrice}>
                {sinPrecio ? 'Consultar' : `$${item.price.toLocaleString('es-CL')}`}
              </Text>
              {hasDiscount && (
                <Text style={styles.originalPrice}>${item.original_price.toLocaleString('es-CL')}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.addBtn, noDisponible && styles.addBtnDisabled]}
              onPress={() => handleAddToCart(item)}
              disabled={noDisponible}
            >
              <Ionicons name={noDisponible ? 'close' : 'add'} size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {noDisponible && <Text style={styles.outOfStock}>Sin stock</Text>}
        </View>
      </TouchableOpacity>
    );
  }, [router, handleAddToCart, handleProductPress]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar productos..."
          placeholderTextColor="#bbb"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => fetchProducts(search)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); fetchProducts(''); }}>
            <Ionicons name="close-circle" size={18} color="#ccc" />
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
          ListHeaderComponent={<StaticHeader router={router} cartCount={cartCount} />}
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
              <Text style={styles.emptyText}>No se encontraron productos 😕</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 8, paddingBottom: 16,
  },
  greeting: { fontSize: 13, color: '#888' },
  headerTitle: { fontSize: 22, color: '#1a1a1a', fontWeight: '800' },
  cartBtn: { position: 'relative', padding: 4 },
  cartBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: PRIMARY, width: 18, height: 18,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 20,
    marginTop: 8, marginBottom: 8,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.06)',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },

  // Banners
  bannerContainer: { marginBottom: 8 },
  bannerCard: {
    width: CARD_W, height: CARD_H, borderRadius: 18,
    overflow: 'hidden', backgroundColor: '#eee',
  },
  bannerCardText: {
    paddingHorizontal: 20, paddingTop: 30, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bannerSubtitle: { fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.9)' },
  bannerEmoji: { fontSize: 54, marginLeft: 10 },
  progressRow: {
    position: 'absolute', top: 10, left: SIDE + 14,
    width: CARD_W - 28, flexDirection: 'row', gap: 4,
  },
  progressTrack: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)', overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#fff' },

  sectionTitle: {
    fontSize: 17, fontWeight: '800', color: '#1a1a1a',
    paddingHorizontal: 20, marginBottom: 12, marginTop: 8,
  },
  row: { paddingHorizontal: 12, gap: 12, marginBottom: 12 },
  // paddingBottom grande: la tab bar flota encima y no debe tapar el último producto
  productsList: { paddingVertical: 4, paddingBottom: 120 },
  productCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0px 2px 8px rgba(0,0,0,0.07)',
  },
  productImageWrapper: {
    width: '100%',
    height: 130,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  discountBadge: {
    position: 'absolute', top: 8, left: 8, zIndex: 1,
    backgroundColor: PRIMARY, paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 8,
  },
  discountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  productImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  productInfo: { padding: 12 },
  productName: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginBottom: 2, lineHeight: 18 },
  productUnit: { fontSize: 11, color: '#aaa', marginBottom: 8 },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  originalPrice: { fontSize: 11, color: '#aaa', textDecorationLine: 'line-through' },
  addBtn: {
    backgroundColor: PRIMARY, width: 30, height: 30,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: '#ccc' },
  outOfStock: { marginTop: 4, fontSize: 11, color: PRIMARY, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, color: '#aaa' },
});