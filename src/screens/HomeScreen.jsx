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
import { obtenerSucursalId } from '../utils/sucursal';
import { supabase } from '../utils/supabase';
import { useBanners } from '../utils/useBanners';

const { width } = Dimensions.get('window');
const PRIMARY = '#C21807';

// Medidas del carrusel de banners (estilo Jumbo: el siguiente banner asoma)
const SIDE = 16;                              // margen izquierdo
const GAP = 16;                               // espacio entre banners
const CARD_W = width - 30;                    // deja asomar el siguiente
const CARD_H = Math.round(CARD_W / 1.6);      // proporción 1.6 : 1
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
  // Banners administrados desde el panel web (con MOCK_BANNERS como respaldo).
  const banners = useBanners('home', MOCK_BANNERS);
  const [current, setCurrent] = useState(0);
  const [tick, setTick] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const flatRef = useRef(null);

  // Autoplay: la barra se llena y, al terminar, pasa al siguiente banner
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

  // Si cambia la cantidad de banners, vuelve al primero.
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

          // Estilo Jumbo: solo la imagen, el diseño ya trae el texto
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

          // Sin imagen: fondo de color con texto y emoji
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

  const fetchProducts = useCallback(async (q = '') => {
    // La lista vuelve al tope al recargar, así que la tab bar reaparece
    showTabBar();
    setLoading(true);
    try {
      const idSucursal = await obtenerSucursalId();

      if (!idSucursal) {
        setProducts([]);
        return;
      }

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

      if (error) {
        console.error(error);
        setProducts([]);
      } else {
        setProducts(
          (data || []).map((ps) => ({
            id: ps.productos.id,
            name: ps.productos.nombre,
            price: Math.round(ps.precio ?? 0),
            original_price: null,
            image_url: ps.productos.imagen_url,
            stock: ps.stock,
            unit: '',
          }))
        );
      }
    } catch (err) {
      console.error(err);
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
              <Text style={styles.productPrice}>${item.price.toLocaleString('es-CL')}</Text>
              {hasDiscount && (
                <Text style={styles.originalPrice}>${item.original_price.toLocaleString('es-CL')}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.addBtn, item.stock === 0 && styles.addBtnDisabled]}
              onPress={() => handleAddToCart(item)}
              disabled={item.stock === 0}
            >
              <Ionicons name={item.stock === 0 ? 'close' : 'add'} size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {item.stock === 0 && <Text style={styles.outOfStock}>Sin stock</Text>}
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

  // Banners (estilo Jumbo)
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