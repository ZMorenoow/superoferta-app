import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useSucursalId from '../../hooks/useSucursalId';
import { agregarAlCarrito } from '../../utils/agregarAlCarrito';
import { supabase } from '../../utils/supabase';

const PRIMARY = '#C21807';
const BG = '#F5F5F7';
const INK = '#1a1a1a';

export default function CategoriaScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { idSucursal, loadingSucursal } = useSucursalId();

  const [category, setCategory] = useState(null);
  const [subs, setSubs] = useState([]);
  const [sub, setSub] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [cat, hijos] = await Promise.all([
        supabase.from('categorias').select('id, nombre, emoji').eq('id', id).single(),
        supabase.from('categorias').select('id, nombre').eq('id_padre', id).order('nombre'),
      ]);
      setCategory(cat.data);
      setSubs(hijos.data ?? []);
      setSub(null);
    })();
  }, [id]);

  useEffect(() => {
    if (loadingSucursal) return;
    if (!idSucursal) {
      setProducts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const ids = sub ? [sub] : [id, ...subs.map((s) => s.id)];

      const { data, error } = await supabase
        .from('producto_sucursal')
        .select(
          'precio, stock, productos!inner(id, nombre, imagen_url, id_categoria, activo)'
        )
        .eq('id_sucursal', idSucursal)
        .eq('activo', true)
        .eq('productos.activo', true)
        .in('productos.id_categoria', ids);

      if (error) console.log('ERROR PRODUCTOS:', error.message);

      if (!cancelled) {
        setProducts(
          (data ?? [])
            .map((r) => ({
              id: r.productos.id,
              nombre: r.productos.nombre,
              imagen_url: r.productos.imagen_url,
              precio: Math.round(r.precio ?? 0),
              stock: r.stock,
            }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
        );
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, sub, subs, idSucursal, loadingSucursal]);

  const handleAdd = async (item) => {
    const resultado = await agregarAlCarrito({ id: item.id, price: item.precio });

    if (resultado === 'login') {
      router.push('/login');
      return;
    }
    if (resultado === 'error') {
      Alert.alert('Error', 'No se pudo agregar el producto al carrito');
      return;
    }
    Alert.alert('¡Listo!', 'Se ha agregado correctamente el producto al carrito');
  };

  const mostrandoLista = !(loading || loadingSucursal);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {category?.emoji} {category?.nombre}
          </Text>
          {mostrandoLista && products.length > 0 && (
            <Text style={styles.subtitle}>
              {products.length} {products.length === 1 ? 'producto' : 'productos'}
            </Text>
          )}
        </View>
      </View>

      {subs.length > 0 && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {[{ id: null, nombre: 'Todo' }, ...subs].map((s) => {
              const active = sub === s.id;
              return (
                <TouchableOpacity
                  key={s.id ?? 'todo'}
                  onPress={() => setSub(s.id)}
                  style={[styles.chip, active && styles.chipActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {s.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {!mostrandoLista ? (
        <ActivityIndicator color={PRIMARY} size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="basket-outline" size={64} color="#d8d8d8" />
              <Text style={styles.empty}>
                {idSucursal
                  ? 'Aún no hay productos aquí'
                  : 'Elige una sucursal en tu perfil para ver los precios'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const sinStock = item.stock === 0;
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() =>
                  router.push({ pathname: '/product-detail', params: { id: item.id } })
                }
              >
                <View style={styles.imageWrap}>
                  <Image
                    source={{ uri: item.imagen_url }}
                    style={[styles.image, sinStock && { opacity: 0.45 }]}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />

                  {sinStock ? (
                    <View style={styles.stockBadge}>
                      <Text style={styles.stockBadgeText}>Sin stock</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => handleAdd(item)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add" size={22} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.name} numberOfLines={2}>{item.nombre}</Text>
                  <Text style={[styles.price, sinStock && { color: '#aaa' }]}>
                    ${item.precio.toLocaleString('es-CL')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 3px 10px rgba(0,0,0,0.08)',
  },
  title: { fontSize: 24, fontWeight: '800', color: INK, letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: '#9a9a9a', fontWeight: '600', marginTop: 1 },

  chips: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec',
  },
  chipActive: { borderColor: PRIMARY, backgroundColor: PRIMARY },
  chipText: { fontSize: 13, color: '#555', fontWeight: '700' },
  chipTextActive: { color: '#fff' },

  list: { paddingHorizontal: 16, paddingBottom: 120 },
  emptyBox: { alignItems: 'center', marginTop: 60, gap: 10 },
  empty: { textAlign: 'center', color: '#aaa', fontSize: 15, paddingHorizontal: 30 },

  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 20, marginBottom: 12, overflow: 'hidden',
    boxShadow: '0px 3px 12px rgba(0,0,0,0.06)',
  },
  imageWrap: { width: '100%', height: 140, backgroundColor: '#fff' },
  image: { width: '100%', height: '100%' },
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
  cardBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14 },
  name: { fontSize: 13, fontWeight: '600', color: INK, lineHeight: 18, minHeight: 36 },
  price: { fontSize: 17, fontWeight: '800', color: INK, marginTop: 6, letterSpacing: -0.3 },
});