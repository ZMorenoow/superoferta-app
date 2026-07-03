import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBar } from '../context/TabBarContext';
import { useCartStore } from '../store/cartStore';
import { api, MOCK_BANNERS } from '../utils/api';

const { width } = Dimensions.get('window');
const PRIMARY = '#C21807';

const CATEGORIES = [
  { id: 'all', name: 'Todo', emoji: '🛒' },
  { id: 'frutas', name: 'Frutas', emoji: '🍎' },
  { id: 'verduras', name: 'Verduras', emoji: '🥦' },
  { id: 'lacteos', name: 'Lácteos', emoji: '🥛' },
  { id: 'carnes', name: 'Carnes', emoji: '🥩' },
  { id: 'panaderia', name: 'Panadería', emoji: '🍞' },
  { id: 'bebidas', name: 'Bebidas', emoji: '🥤' },
  { id: 'limpieza', name: 'Limpieza', emoji: '🧹' },
];

function BannerSlider() {
  const [current, setCurrent] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (current + 1) % MOCK_BANNERS.length;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrent(next);
    }, 3000);
    return () => clearInterval(interval);
  }, [current]);

  return (
    <View style={styles.bannerContainer}>
      <Animated.FlatList
        ref={flatRef}
        data={MOCK_BANNERS}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
          setCurrent(idx);
        }}
        renderItem={({ item }) => (
          <View style={[styles.bannerCard, { backgroundColor: item.bg }]}>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>{item.title}</Text>
              <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
              <View style={styles.bannerBtn}>
                <Text style={styles.bannerBtnText}>Ver ofertas</Text>
              </View>
            </View>
            <Text style={styles.bannerEmoji}>{item.emoji}</Text>
          </View>
        )}
      />
      <View style={styles.dotsRow}>
        {MOCK_BANNERS.map((_, i) => (
          <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const StaticHeader = React.memo(({ activeCategory, setActiveCategory, navigation, getTotalItems, onCategoryChange }) => (
  <View>
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting}>Hola 👋</Text>
        <Text style={styles.headerTitle}>¿Qué necesitas hoy?</Text>
      </View>
      <TouchableOpacity style={styles.cartBtn} onPress={() => navigation.navigate('Cart')}>
        <Ionicons name="cart-outline" size={26} color={PRIMARY} />
        {getTotalItems() > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{getTotalItems()}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>

    <BannerSlider />

    <Text style={styles.sectionTitle}>Categorías</Text>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoriesContainer}
      keyboardShouldPersistTaps="handled"
    >
      {CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={[styles.categoryChip, activeCategory === cat.id && styles.categoryChipActive]}
          onPress={() => onCategoryChange(cat.id)}
        >
          <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
          <Text style={[styles.categoryText, activeCategory === cat.id && styles.categoryTextActive]}>
            {cat.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>

    <Text style={styles.sectionTitle}>Productos</Text>
  </View>
));

export default function HomeScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const { addItem, getTotalItems } = useCartStore();
  const { handleScroll } = useTabBar();

  const fetchProducts = useCallback(async (cat = activeCategory, q = search) => {
    try {
      const params = {};
      if (cat !== 'all') params.category = cat;
      if (q) params.q = q;
      const res = await api.get('/products', { params });
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchProducts(activeCategory, search); }, [activeCategory]);

  const handleCategoryChange = useCallback((catId) => {
    setActiveCategory(catId);
  }, []);

  const renderProduct = useCallback(({ item }) => {
    const hasDiscount = item.original_price && item.original_price > item.price;
    const discountPct = hasDiscount
      ? Math.round((1 - item.price / item.original_price) * 100)
      : null;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetail', { product: item })}
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
              onPress={() => addItem(item)}
              disabled={item.stock === 0}
            >
              <Ionicons name={item.stock === 0 ? 'close' : 'add'} size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {item.stock === 0 && <Text style={styles.outOfStock}>Sin stock</Text>}
        </View>
      </TouchableOpacity>
    );
  }, [navigation, addItem]);

  const listHeader = useCallback(() => (
    <StaticHeader
      activeCategory={activeCategory}
      setActiveCategory={setActiveCategory}
      navigation={navigation}
      getTotalItems={getTotalItems}
      onCategoryChange={handleCategoryChange}
    />
  ), [activeCategory]);

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
          onSubmitEditing={() => fetchProducts(activeCategory, search)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); fetchProducts(activeCategory, ''); }}>
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
          ListHeaderComponent={listHeader}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchProducts(activeCategory, search); }}
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
  bannerContainer: { marginHorizontal: 20, marginBottom: 8 },
  bannerCard: {
    width: width - 40, height: 130, borderRadius: 18,
    padding: 20, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bannerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 12 },
  bannerBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, alignSelf: 'flex-start',
  },
  bannerBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bannerEmoji: { fontSize: 54 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ccc' },
  dotActive: { width: 18, backgroundColor: PRIMARY },
  sectionTitle: {
    fontSize: 17, fontWeight: '800', color: '#1a1a1a',
    paddingHorizontal: 20, marginBottom: 12, marginTop: 8,
  },
  categoriesContainer: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 20, gap: 6,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  categoryChipActive: { backgroundColor: '#fdecea', borderColor: PRIMARY },
  categoryEmoji: { fontSize: 15 },
  categoryText: { fontSize: 13, fontWeight: '600', color: '#555' },
  categoryTextActive: { color: PRIMARY },
  row: { paddingHorizontal: 12, gap: 12, marginBottom: 12 },
  productsList: { paddingVertical: 4, paddingBottom: 24 },
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