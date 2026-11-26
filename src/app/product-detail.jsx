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

const PRIMARY = '#ED1D26';
const BG = '#F5F5F7';
const INK = '#1a1a1a';

const formatCLP = (n) => `$${Number(n || 0).toLocaleString('es-CL')}`;

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={secStyles.container}>
      <TouchableOpacity style={secStyles.header} onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <Text style={secStyles.title}>{title}</Text>
        <View style={secStyles.chevron}>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#555" />
        </View>
      </TouchableOpacity>
      {open && <View style={secStyles.body}>{children}</View>}
    </View>
  );
}

const secStyles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 20, marginBottom: 12, overflow: 'hidden',
    boxShadow: '0px 3px 12px rgba(0,0,0,0.05)',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16,
  },
  title: { fontSize: 15, fontWeight: '800', color: INK },
  chevron: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#f2f2f4',
    alignItems: 'center', justifyContent: 'center',
  },
  body: { paddingHorizontal: 18, paddingBottom: 18 },
});

// Tarjeta del carrusel de productos similares
function TarjetaSimilar({ item, onPress }) {
  return (
    <TouchableOpacity style={simStyles.card} onPress={() => onPress(item)} activeOpacity={0.9}>
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
    width: 156, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
    boxShadow: '0px 3px 12px rgba(0,0,0,0.06)',
  },
  imgWrap: { width: '100%', height: 116, backgroundColor: '#fff' },
  img: { width: '100%', height: '100%' },
  info: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14 },
  name: { fontSize: 12, fontWeight: '600', color: INK, lineHeight: 16, minHeight: 32 },
  price: { fontSize: 16, fontWeight: '800', color: INK, marginTop: 6, letterSpacing: -0.3 },
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
        <View style={styles.notFound}>
          <Ionicons name="basket-outline" size={64} color="#d8d8d8" />
          <Text style={styles.notFoundText}>Producto no encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasDiscount = product.original_price && product.original_price > product.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.price / product.original_price) * 100)
    : null;
  const sinStock = product.stock === 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.circleBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.name}</Text>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.push('/cart')} activeOpacity={0.8}>
          <Ionicons name="cart-outline" size={22} color={PRIMARY} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 170 }}>
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
          <View style={[styles.stockBadge, sinStock && styles.stockBadgeOut]}>
            <Ionicons
              name={product.stock > 0 ? 'checkmark-circle' : 'close-circle'}
              size={14}
              color={product.stock > 0 ? '#1B6B3A' : PRIMARY}
            />
            <Text style={[styles.stockText, sinStock && styles.stockTextOut]}>
              {product.stock > 0 ? `${product.stock} disponibles` : 'Sin stock'}
            </Text>
          </View>

          <Text style={styles.productName}>{product.name}</Text>
          {!!product.unit && <Text style={styles.productUnit}>{product.unit}</Text>}

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCLP(product.price)}</Text>
            {hasDiscount && (
              <Text style={styles.originalPrice}>{formatCLP(product.original_price)}</Text>
            )}
          </View>

          {!!product.barcode && (
            <View style={styles.barcodeChip}>
              <Ionicons name="barcode-outline" size={18} color="#555" />
              <Text style={styles.barcodeLabel}>Cód. barras</Text>
              <Text style={styles.barcodeValue} selectable>{product.barcode}</Text>
            </View>
          )}

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

          {product.stock > 0 && (
            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>Cantidad</Text>
              <View style={styles.qtySelector}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(Math.max(1, qty - 1))} activeOpacity={0.7}>
                  <Ionicons name="remove" size={18} color={PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{qty}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(Math.min(product.stock, qty + 1))} activeOpacity={0.7}>
                  <Ionicons name="add" size={18} color={PRIMARY} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ marginTop: 4 }}>
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

      <View style={[styles.footer, { paddingBottom: 14 + insets.bottom }]}>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCLP(product.price * qty)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, (sinStock || agregando) && styles.addBtnDisabled]}
          onPress={handleAgregarAlCarrito}
          disabled={sinStock || agregando}
          activeOpacity={0.85}
        >
          {agregando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cart-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.addBtnText}>
                {sinStock ? 'Sin stock' : 'Agregar'}
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
  container: { flex: 1, backgroundColor: BG },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  notFoundText: { fontSize: 15, color: '#aaa' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: BG,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 3px 10px rgba(0,0,0,0.08)',
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: INK, textAlign: 'center' },
  cartBadge: {
    position: 'absolute', top: -3, right: -3,
    backgroundColor: PRIMARY, minWidth: 20, height: 20,
    borderRadius: 10, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: BG,
  },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  imageContainer: {
    backgroundColor: '#fff', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 28, marginHorizontal: 16,
    borderRadius: 28, position: 'relative',
    boxShadow: '0px 6px 18px rgba(0,0,0,0.07)',
  },
  discountBadge: {
    position: 'absolute', top: 16, left: 16, zIndex: 1,
    backgroundColor: PRIMARY, paddingHorizontal: 12,
    paddingVertical: 5, borderRadius: 20,
  },
  discountText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  productImage: { width: '85%', height: 260 },

  infoContainer: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  stockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#e8f5ed', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 12,
  },
  stockBadgeOut: { backgroundColor: '#fdecea' },
  stockText: { fontSize: 12, fontWeight: '700', color: '#1B6B3A' },
  stockTextOut: { color: PRIMARY },

  productName: { fontSize: 25, fontWeight: '800', color: INK, marginBottom: 4, letterSpacing: -0.5, lineHeight: 31 },
  productUnit: { fontSize: 13, color: '#888', marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6, marginBottom: 14 },
  price: { fontSize: 32, fontWeight: '900', color: PRIMARY, letterSpacing: -0.8 },
  originalPrice: { fontSize: 16, color: '#aaa', textDecorationLine: 'line-through' },

  barcodeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ececec',
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 16,
  },
  barcodeLabel: { fontSize: 12, fontWeight: '600', color: '#888' },
  barcodeValue: { fontSize: 13, fontWeight: '800', color: INK, letterSpacing: 1 },

  tagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: {
    backgroundColor: '#fff', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#ececec',
  },
  tagText: { fontSize: 12, fontWeight: '600', color: '#555' },

  qtyRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
    backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 18,
    boxShadow: '0px 3px 12px rgba(0,0,0,0.05)',
  },
  qtyLabel: { fontSize: 15, fontWeight: '700', color: '#333' },
  qtySelector: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qtyBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#fdecea', alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: { fontSize: 18, fontWeight: '800', color: INK, minWidth: 26, textAlign: 'center' },

  charRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  charRowAlt: { backgroundColor: '#f8f8fa', marginHorizontal: -18, paddingHorizontal: 18 },
  charLabel: { fontSize: 13, fontWeight: '700', color: '#333', flex: 1 },
  charValue: { fontSize: 13, color: '#555', flex: 1, textAlign: 'right' },
  descriptionText: { fontSize: 14, color: '#555', lineHeight: 22 },

  similaresBloque: { marginTop: 8 },
  similaresTitulo: {
    fontSize: 18, fontWeight: '800', color: INK, letterSpacing: -0.3,
    paddingHorizontal: 20, marginBottom: 12,
  },
  similaresLista: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#fff', paddingHorizontal: 20,
    paddingTop: 16,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    boxShadow: '0px -4px 16px rgba(0,0,0,0.08)',
  },
  totalBox: { minWidth: 96 },
  totalLabel: { fontSize: 12, color: '#888', fontWeight: '600' },
  totalValue: { fontSize: 22, fontWeight: '900', color: INK, letterSpacing: -0.5 },
  addBtn: {
    flex: 1, backgroundColor: PRIMARY, borderRadius: 18,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 4px 12px rgba(194,24,7,0.3)',
  },
  addBtnDisabled: { backgroundColor: '#ccc', boxShadow: 'none' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});