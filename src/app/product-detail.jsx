import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomAlert from '../components/CustomAlert';
import { supabase } from '../utils/supabase';

const PRIMARY = '#C21807';

const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={secStyles.container}>
      <TouchableOpacity style={secStyles.header} onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <Text style={secStyles.title}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#555" />
      </TouchableOpacity>
      {open && <View style={secStyles.body}>{children}</View>}
    </View>
  );
}

const secStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
  },
  title: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
});

// Tarjeta del carrusel de productos similares
function TarjetaSimilar({ item, onPress }) {
  return (
    <TouchableOpacity style={simStyles.card} onPress={() => onPress(item)} activeOpacity={0.85}>
      <View style={simStyles.imgWrap}>
        <Image
          source={item.image_url ? { uri: item.image_url } : require('../../assets/images/logo.png')}
          style={simStyles.img}
          resizeMode="cover"
        />
      </View>
      <View style={simStyles.info}>
        <Text style={simStyles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={simStyles.price}>{formatCLP(item.price)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const simStyles = StyleSheet.create({
  card: {
    width: 150, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  imgWrap: { width: '100%', height: 110, backgroundColor: '#f4f4f4' },
  img: { width: '100%', height: '100%' },
  info: { padding: 12 },
  name: { fontSize: 12, fontWeight: '600', color: '#1a1a1a', lineHeight: 16, minHeight: 32 },
  price: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginTop: 6 },
});

export default function ProductDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState(null);
  const [similares, setSimilares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [agregando, setAgregando] = useState(false);
  const [alertConfig, setAlertConfig] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const insets = useSafeAreaInsets();

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

  // Productos de la misma sucursal, excluyendo el actual.
  // Si se pasa categoría, filtra por ella.
  const traerDeSucursal = async (idSucursal, idProductoActual, idCategoria) => {
    let query = supabase
      .from('producto_sucursal')
      .select('precio, stock, productos!inner (id, nombre, imagen_url, id_categoria, activo)')
      .eq('id_sucursal', idSucursal)
      .eq('activo', true)
      .eq('productos.activo', true)
      .neq('id_producto', idProductoActual)
      .limit(10);

    if (idCategoria) {
      query = query.eq('productos.id_categoria', idCategoria);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error cargando productos similares', error);
      return [];
    }

    return (data || []).map((ps) => ({
      id: ps.productos.id,
      name: ps.productos.nombre,
      price: Math.round(ps.precio ?? 0),
      image_url: ps.productos.imagen_url,
    }));
  };

  useEffect(() => {
    const cargarProducto = async () => {
      setLoading(true);
      setQty(1);
      setSimilares([]);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('id_sucursal_preferida')
        .eq('id', user.id)
        .single();

      if (!perfil?.id_sucursal_preferida) {
        setLoading(false);
        return;
      }

      const idSucursal = perfil.id_sucursal_preferida;

      const { data, error } = await supabase
        .from('producto_sucursal')
        .select('precio, stock, productos!inner (id, nombre, descripcion, imagen_url, id_categoria, codigo_barra)')
        .eq('id_producto', id)
        .eq('id_sucursal', idSucursal)
        .single();

      if (!error && data) {
        setProduct({
          id: data.productos.id,
          name: data.productos.nombre,
          barcode: data.productos.codigo_barra,
          description: data.productos.descripcion,
          price: Math.round(data.precio ?? 0),
          original_price: null,
          image_url: data.productos.imagen_url,
          stock: data.stock ?? 0,
          unit: '',
          tags: [],
          characteristics: [],
        });
        setLoading(false);

        // Similares: misma categoría; si no hay, otros de la sucursal
        const idCategoria = data.productos.id_categoria;
        let lista = idCategoria
          ? await traerDeSucursal(idSucursal, data.productos.id, idCategoria)
          : [];
        if (lista.length === 0) {
          lista = await traerDeSucursal(idSucursal, data.productos.id, null);
        }
        setSimilares(lista);
        return;
      }
      setLoading(false);
    };

    if (id) cargarProducto();
  }, [id]);

  const abrirProducto = useCallback((item) => {
    router.push({ pathname: '/product-detail', params: { id: item.id } });
  }, [router]);

  const handleAgregarAlCarrito = async () => {
    setAgregando(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setAgregando(false);
      setAlertConfig({
        icon: 'lock-closed',
        iconColor: PRIMARY,
        title: 'Inicia sesión',
        message: 'Inicia sesión antes de agregar productos al carrito',
        buttonText: 'Ir a iniciar sesión',
        onPress: () => {
          setAlertConfig(null);
          router.push('/login');
        },
      });
      return;
    }

    let { data: carrito } = await supabase
      .from('carrito')
      .select('id')
      .eq('id_cliente', user.id)
      .maybeSingle();

    if (!carrito) {
      const { data: nuevo, error } = await supabase
        .from('carrito')
        .insert({ id_cliente: user.id })
        .select('id')
        .single();
      if (error) {
        setAgregando(false);
        return;
      }
      carrito = nuevo;
    }

    const { data: itemExistente } = await supabase
      .from('carrito_items')
      .select('id, cantidad')
      .eq('id_carrito', carrito.id)
      .eq('id_producto', product.id)
      .maybeSingle();

    if (itemExistente) {
      await supabase
        .from('carrito_items')
        .update({ cantidad: itemExistente.cantidad + qty })
        .eq('id', itemExistente.id);
    } else {
      await supabase.from('carrito_items').insert({
        id_carrito: carrito.id,
        id_producto: product.id,
        cantidad: qty,
        precio_unitario: product.price,
      });
    }

    await cargarCartCount();
    setAgregando(false);

    setAlertConfig({
      icon: 'checkmark-circle',
      iconColor: '#1B6B3A',
      title: '¡Listo!',
      message: 'Se ha agregado correctamente al carrito',
      buttonText: 'Continuar',
      onPress: () => {
        setAlertConfig(null);
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)');
        }
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ textAlign: 'center', marginTop: 40 }}>Producto no encontrado</Text>
      </SafeAreaView>
    );
  }

  const hasDiscount = product.original_price && product.original_price > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn}>
          <Ionicons name="chevron-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.name}</Text>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.push('/cart')}>
          <Ionicons name="cart-outline" size={22} color={PRIMARY} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
        <View style={styles.imageContainer}>
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discountPct}%</Text>
            </View>
          )}
          <Image
            source={product.image_url ? { uri: product.image_url } : require('../../assets/images/logo.png')}
            style={styles.productImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.productName}>{product.name}</Text>
          {!!product.unit && <Text style={styles.productUnit}>{product.unit}</Text>}

          {!!product.barcode && (
            <View style={styles.barcodeChip}>
              <Ionicons name="barcode-outline" size={18} color="#555" />
              <Text style={styles.barcodeLabel}>Cód. barras</Text>
              <Text style={styles.barcodeValue} selectable>{product.barcode}</Text>
            </View>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCLP(product.price)}</Text>
            {hasDiscount && (
              <Text style={styles.originalPrice}>{formatCLP(product.original_price)}</Text>
            )}
          </View>

          {product.tags?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.tagsRow}>
                {product.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          <View style={[styles.stockBadge, product.stock === 0 && styles.stockBadgeOut]}>
            <Ionicons
              name={product.stock > 0 ? 'checkmark-circle' : 'close-circle'}
              size={14}
              color={product.stock > 0 ? '#1B6B3A' : PRIMARY}
            />
            <Text style={[styles.stockText, product.stock === 0 && styles.stockTextOut]}>
              {product.stock > 0 ? `${product.stock} disponibles` : 'Sin stock'}
            </Text>
          </View>

          {product.stock > 0 && (
            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>Cantidad</Text>
              <View style={styles.qtySelector}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(Math.max(1, qty - 1))}>
                  <Ionicons name="remove" size={18} color={PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{qty}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(Math.min(product.stock, qty + 1))}>
                  <Ionicons name="add" size={18} color={PRIMARY} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ marginTop: 8 }}>
            {product.characteristics?.length > 0 && (
              <Section title="Características" defaultOpen={true}>
                {product.characteristics.map((c, i) => (
                  <View key={i} style={[styles.charRow, i % 2 === 0 && styles.charRowAlt]}>
                    <Text style={styles.charLabel}>{c.label}</Text>
                    <Text style={styles.charValue}>{c.value}</Text>
                  </View>
                ))}
              </Section>
            )}

            {product.description && (
              <Section title="Descripción" defaultOpen={true}>
                <Text style={styles.descriptionText}>{product.description}</Text>
              </Section>
            )}
          </View>
        </View>

        {/* Productos similares */}
        {similares.length > 0 && (
          <View style={styles.similaresBloque}>
            <Text style={styles.similaresTitulo}>Productos similares</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similaresLista}
            >
              {similares.map((p) => (
                <TarjetaSimilar key={p.id} item={p} onPress={abrirProducto} />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCLP(product.price * qty)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, (product.stock === 0 || agregando) && styles.addBtnDisabled]}
          onPress={handleAgregarAlCarrito}
          disabled={product.stock === 0 || agregando}
        >
          {agregando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cart-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.addBtnText}>
                {product.stock === 0 ? 'Sin stock' : 'Agregar al carrito'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <CustomAlert
        visible={!!alertConfig}
        icon={alertConfig?.icon}
        iconColor={alertConfig?.iconColor}
        title={alertConfig?.title}
        message={alertConfig?.message}
        buttonText={alertConfig?.buttonText}
        onPress={alertConfig?.onPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#F8F9FA',
  },
  circleBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1a1a1a', textAlign: 'center' },
  cartBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: PRIMARY, width: 18, height: 18,
    borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#F8F9FA',
  },
  cartBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  imageContainer: {
    backgroundColor: '#fff', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 24, marginHorizontal: 16,
    borderRadius: 24, position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  discountBadge: {
    position: 'absolute', top: 14, left: 14, zIndex: 1,
    backgroundColor: PRIMARY, paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 10,
  },
  discountText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  productImage: { width: '85%', height: 250 },

  infoContainer: { padding: 20 },
  productName: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  productUnit: { fontSize: 13, color: '#888', marginBottom: 12 },
  barcodeChip: {
  flexDirection: 'row', alignItems: 'center', gap: 8,
  alignSelf: 'flex-start',
  backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee',
  borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  marginTop: 8, marginBottom: 14,
},
barcodeLabel: { fontSize: 12, fontWeight: '600', color: '#888' },
barcodeValue: { fontSize: 13, fontWeight: '800', color: '#1a1a1a', letterSpacing: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 14 },
  price: { fontSize: 30, fontWeight: '900', color: PRIMARY },
  originalPrice: { fontSize: 16, color: '#aaa', textDecorationLine: 'line-through' },
  tagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: {
    backgroundColor: '#fff', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#eee',
  },
  tagText: { fontSize: 12, fontWeight: '600', color: '#555' },
  stockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#e8f5ed', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 20,
  },
  stockBadgeOut: { backgroundColor: '#fdecea' },
  stockText: { fontSize: 13, fontWeight: '600', color: '#1B6B3A' },
  stockTextOut: { color: PRIMARY },

  qtyRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 20,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  qtyLabel: { fontSize: 15, fontWeight: '700', color: '#333' },
  qtySelector: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fdecea', alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', minWidth: 24, textAlign: 'center' },

  charRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  charRowAlt: { backgroundColor: '#f8f8f8', marginHorizontal: -16, paddingHorizontal: 16 },
  charLabel: { fontSize: 13, fontWeight: '700', color: '#333', flex: 1 },
  charValue: { fontSize: 13, color: '#555', flex: 1, textAlign: 'right' },
  descriptionText: { fontSize: 14, color: '#555', lineHeight: 22 },

  similaresBloque: { marginTop: 4 },
  similaresTitulo: {
    fontSize: 17, fontWeight: '800', color: '#1a1a1a',
    paddingHorizontal: 20, marginBottom: 12,
  },
  similaresLista: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 20,
    paddingTop: 14,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 12,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  totalLabel: { fontSize: 14, color: '#888' },
  totalValue: { fontSize: 20, fontWeight: '900', color: '#1a1a1a' },
  addBtn: {
    backgroundColor: PRIMARY, borderRadius: 16,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: '#ccc' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});