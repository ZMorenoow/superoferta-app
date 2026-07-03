import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../store/cartStore';

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
  const { product: productStr } = useLocalSearchParams();
  const product = productStr ? JSON.parse(productStr) : null;
  const { addItem, getTotalItems } = useCartStore();
  const [qty, setQty] = useState(1);

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.name}</Text>
        <TouchableOpacity style={styles.cartBtn} onPress={() => router.push('/cart')}>
          <Ionicons name="cart-outline" size={24} color={PRIMARY} />
          {getTotalItems() > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{getTotalItems()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Imagen */}
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
          {/* Nombre y precio */}
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productUnit}>{product.unit}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>${product.price.toLocaleString('es-CL')}</Text>
            {hasDiscount && (
              <Text style={styles.originalPrice}>${product.original_price.toLocaleString('es-CL')}</Text>
            )}
          </View>

          {/* Tags */}
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

          {/* Stock */}
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

          {/* Selector cantidad */}
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

          {/* Secciones colapsables */}
          <View style={{ marginTop: 8 }}>
            {/* Características */}
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

            {/* Descripción */}
            {product.description && (
              <Section title="Descripción">
                <Text style={styles.descriptionText}>{product.description}</Text>
              </Section>
            )}

            {/* Condición alimentaria */}
            {product.tags?.length > 0 && (
              <Section title="Condición alimentaria">
                <View style={styles.tagsRow}>
                  {product.tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Footer fijo */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${(product.price * qty).toLocaleString('es-CL')}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, product.stock === 0 && styles.addBtnDisabled]}
          onPress={() => {
            for (let i = 0; i < qty; i++) addItem(product);
            router.back();
          }}
          disabled={product.stock === 0}
        >
          <Ionicons name="cart-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.addBtnText}>
            {product.stock === 0 ? 'Sin stock' : 'Agregar al carrito'}
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 34, paddingTop: 12,
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