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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {category?.emoji} {category?.nombre}
        </Text>
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

      {loading || loadingSucursal ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {idSucursal
                ? 'Aún no hay productos aquí 🛒'
                : 'Elige una sucursal en tu perfil para ver los precios'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() =>
                router.push({ pathname: '/product-detail', params: { id: item.id } })
              }
            >
              <Image
                source={{ uri: item.imagen_url }}
                style={styles.image}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
              <View style={styles.cardBody}>
                <Text style={styles.name} numberOfLines={2}>{item.nombre}</Text>
                <View style={styles.row}>
                  <Text style={styles.price}>${item.precio.toLocaleString('es-CL')}</Text>
                  <TouchableOpacity
                    style={[styles.addBtn, item.stock === 0 && { backgroundColor: '#ccc' }]}
                    disabled={item.stock === 0}
                    onPress={() => handleAdd(item)}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { padding: 6, marginRight: 6 },
  title: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  chips: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee',
  },
  chipActive: { borderColor: PRIMARY, backgroundColor: '#fff0ee' },
  chipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  chipTextActive: { color: PRIMARY },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  image: { width: '100%', height: 120 },
  cardBody: { padding: 10 },
  name: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', minHeight: 34 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  price: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  addBtn: {
    backgroundColor: PRIMARY, width: 30, height: 30,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
});