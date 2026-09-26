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

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={secStyles.container}>
      <TouchableOpacity style={secStyles.header} onPress={() => setOpen(!open)}>
        <Text style={secStyles.title}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#555" />
      </TouchableOpacity>
      {open && <View style={secStyles.body}>{children}</View>}
    </View>
  );
}

const secStyles = StyleSheet.create({
  container: {
    borderWidth: 1, borderColor: '#ebebeb',
    borderRadius: 14, marginBottom: 12, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
  },
  title: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
});

export default function ProductDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState(null);
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

  useEffect(() => {
    const cargarProducto = async () => {
      setLoading(true);
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

      const { data, error } = await supabase
        .from('producto_sucursal')
        .select('precio, stock, productos!inner (id, nombre, descripcion, imagen_url)')
        .eq('id_producto', id)
        .eq('id_sucursal', perfil.id_sucursal_preferida)
        .single();

      if (!error && data) {
        setProduct({
          id: data.productos.id,
          name: data.productos.nombre,
          description: data.productos.descripcion,
          price: Math.round(data.precio ?? 0),
          original_price: null,
          image_url: data.productos.imagen_url,
          stock: data.stock ?? 0,
          unit: '',
          tags: [],
          characteristics: [],
        });
      }
      setLoading(false);
    };

    if (id) cargarProducto();
  }, [id]);

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.name}</Text>
        <TouchableOpacity style={styles.cartBtn} onPress={() => router.push('/cart')}>
          <Ionicons name="cart-outline" size={24} color={PRIMARY} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
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

          <View style={styles.priceRow}>
            <Text style={styles.price}>${product.price.toLocaleString('es-CL')}</Text>
            {hasDiscount && (
              <Text style={styles.originalPrice}>${product.original_price.toLocaleString('es-CL')}</Text>
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
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${(product.price * qty).toLocaleString('es-CL')}</Text>
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
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  cartBtn: { position: 'relative', padding: 4 },
  cartBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: PRIMARY, width: 16, height: 16,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  imageContainer: {
    backgroundColor: '#f8f8f8', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 30, position: 'relative',
  },
  discountBadge: {
    position: 'absolute', top: 16, left: 16,
    backgroundColor: PRIMARY, paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 10,
  },
  discountText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  productImage: { width: '80%', height: 220 },
  infoContainer: { padding: 20 },
  productName: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  productUnit: { fontSize: 13, color: '#888', marginBottom: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 12 },
  price: { fontSize: 28, fontWeight: '800', color: '#1a1a1a' },
  originalPrice: { fontSize: 16, color: '#aaa', textDecorationLine: 'line-through' },
  tagsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: {
    backgroundColor: '#f0f0f0', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20,
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
    backgroundColor: '#f8f8f8', borderRadius: 14, padding: 14,
  },
  qtyLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  qtySelector: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  qtyValue: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', minWidth: 24, textAlign: 'center' },
  charRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  charRowAlt: { backgroundColor: '#f8f8f8', marginHorizontal: -16, paddingHorizontal: 16 },
  charLabel: { fontSize: 13, fontWeight: '700', color: '#333', flex: 1 },
  charValue: { fontSize: 13, color: '#555', flex: 1, textAlign: 'right' },
  descriptionText: { fontSize: 14, color: '#555', lineHeight: 22 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  totalLabel: { fontSize: 14, color: '#888' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  addBtn: {
    backgroundColor: PRIMARY, borderRadius: 16,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: '#ccc' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});