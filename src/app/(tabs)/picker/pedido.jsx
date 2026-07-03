import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert, FlatList, Image, Modal,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIMARY = '#C21807';

const REEMPLAZOS_MOCK = [
  { id: 'r1', name: 'Manzana Verde', unit: 'kg', price: 1290, image_url: 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=400' },
  { id: 'r2', name: 'Pera', unit: 'kg', price: 1590, image_url: 'https://images.unsplash.com/photo-1514756331096-242fdeb70d4a?w=400' },
  { id: 'r3', name: 'Durazno', unit: 'kg', price: 1890, image_url: 'https://images.unsplash.com/photo-1595743825099-8ac7f46bb63b?w=400' },
];

export default function PedidoScreen() {
  const router = useRouter();
  const { pedido: pedidoStr } = useLocalSearchParams();
  const pedidoOriginal = JSON.parse(pedidoStr);

  const [productos, setProductos] = useState(pedidoOriginal.productos);
  const [modalReemplazo, setModalReemplazo] = useState(null);
  const [modalEscaner, setModalEscaner] = useState(null);

  const marcarEncontrado = (id) => {
    setProductos((prev) =>
      prev.map((p) => p.id === id ? { ...p, encontrado: true } : p)
    );
  };

  const marcarNoEncontrado = (producto) => {
    setModalReemplazo(producto);
  };

  const sugerirReemplazo = (producto, reemplazo) => {
    Alert.alert(
      '¿Enviar sugerencia?',
      `Sugerir "${reemplazo.name}" como reemplazo de "${producto.name}" al cliente`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: () => {
            setProductos((prev) =>
              prev.map((p) =>
                p.id === producto.id
                  ? { ...p, encontrado: false, reemplazo, estadoReemplazo: 'esperando' }
                  : p
              )
            );
            setModalReemplazo(null);
            // Simula respuesta del cliente después de 3 segundos
            setTimeout(() => {
              const acepta = Math.random() > 0.4;
              setProductos((prev) =>
                prev.map((p) =>
                  p.id === producto.id
                    ? { ...p, estadoReemplazo: acepta ? 'aceptado' : 'rechazado' }
                    : p
                )
              );
              Alert.alert(
                acepta ? '✅ Cliente aceptó' : '❌ Cliente rechazó',
                acepta
                  ? `El cliente aceptó "${reemplazo.name}"`
                  : `El cliente rechazó el reemplazo. Se eliminará del pedido.`
              );
            }, 3000);
          },
        },
      ]
    );
  };

  const simularEscaneo = (producto) => {
    setModalEscaner(producto);
    // Simula lectura del código después de 2 segundos
    setTimeout(() => {
      setModalEscaner(null);
      Alert.alert(
        '✅ Producto verificado',
        `"${producto.name}" escaneado correctamente`,
        [{ text: 'OK', onPress: () => marcarEncontrado(producto.id) }]
      );
    }, 2000);
  };

  const completados = productos.filter((p) => p.encontrado !== null).length;
  const totalFinal = productos
    .filter((p) => p.encontrado === true || p.estadoReemplazo === 'aceptado')
    .reduce((sum, p) => {
      const precio = p.estadoReemplazo === 'aceptado' ? p.reemplazo.price : p.price;
      return sum + precio * p.quantity;
    }, 0);

  const renderProducto = ({ item }) => {
    const isEncontrado = item.encontrado === true;
    const isNoEncontrado = item.encontrado === false;
    const esperando = item.estadoReemplazo === 'esperando';
    const reemplazoAceptado = item.estadoReemplazo === 'aceptado';
    const reemplazoRechazado = item.estadoReemplazo === 'rechazado';

    return (
      <View style={[
        styles.productCard,
        isEncontrado && styles.cardEncontrado,
        (reemplazoRechazado) && styles.cardRechazado,
        esperando && styles.cardEsperando,
        reemplazoAceptado && styles.cardAceptado,
      ]}>
        <Image source={{ uri: item.image_url }} style={styles.productImage} />
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productUnit}>{item.unit} × {item.quantity}</Text>
          <Text style={styles.productPrice}>
            ${(item.price * item.quantity).toLocaleString('es-CL')}
          </Text>

          {/* Estado del reemplazo */}
          {esperando && (
            <View style={styles.statusBadge}>
              <Ionicons name="time-outline" size={12} color="#E67E22" />
              <Text style={[styles.statusText, { color: '#E67E22' }]}>
                Esperando respuesta...
              </Text>
            </View>
          )}
          {reemplazoAceptado && (
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#1B6B3A" />
              <Text style={[styles.statusText, { color: '#1B6B3A' }]}>
                Reemplazo aceptado: {item.reemplazo.name}
              </Text>
            </View>
          )}
          {reemplazoRechazado && (
            <View style={styles.statusBadge}>
              <Ionicons name="close-circle" size={12} color={PRIMARY} />
              <Text style={[styles.statusText, { color: PRIMARY }]}>
                Reemplazo rechazado
              </Text>
            </View>
          )}
        </View>

        {/* Botones acción */}
        {item.encontrado === null && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => simularEscaneo(item)}
            >
              <Ionicons name="barcode-outline" size={20} color={PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notFoundBtn}
              onPress={() => marcarNoEncontrado(item)}
            >
              <Ionicons name="close" size={20} color="#888" />
            </TouchableOpacity>
          </View>
        )}

        {isEncontrado && (
          <View style={styles.checkIcon}>
            <Ionicons name="checkmark-circle" size={28} color="#1B6B3A" />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Pedido #{pedidoOriginal.id}</Text>
          <Text style={styles.headerSubtitle}>{pedidoOriginal.cliente}</Text>
        </View>
        <View style={styles.progressCircle}>
          <Text style={styles.progressText}>{completados}/{productos.length}</Text>
        </View>
      </View>

      {/* Barra de progreso */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${(completados / productos.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressPct}>
          {Math.round((completados / productos.length) * 100)}%
        </Text>
      </View>

      <FlatList
        data={productos}
        renderItem={renderProducto}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Footer con total y botón finalizar */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total final</Text>
          <Text style={styles.footerTotal}>${totalFinal.toLocaleString('es-CL')}</Text>
        </View>
        <TouchableOpacity
          style={[styles.finalizarBtn, completados < productos.length && styles.finalizarBtnDisabled]}
          disabled={completados < productos.length}
          onPress={() => {
            Alert.alert('✅ Pedido completado', 'El pedido ha sido empacado y está listo para retiro.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          }}
        >
          <Text style={styles.finalizarBtnText}>Finalizar pedido</Text>
        </TouchableOpacity>
      </View>

      {/* Modal escáner simulado */}
      <Modal visible={!!modalEscaner} transparent animationType="fade">
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerBox}>
            <View style={styles.scannerFrame}>
              <Ionicons name="scan-outline" size={120} color="#fff" />
            </View>
            <Text style={styles.scannerText}>Escaneando...</Text>
            <Text style={styles.scannerSubtext}>{modalEscaner?.name}</Text>
          </View>
        </View>
      </Modal>

      {/* Modal reemplazo */}
      <Modal visible={!!modalReemplazo} transparent animationType="slide">
        <View style={styles.reemplazoOverlay}>
          <View style={styles.reemplazoCard}>
            <Text style={styles.reemplazoTitle}>
              ❌ "{modalReemplazo?.name}" no disponible
            </Text>
            <Text style={styles.reemplazoSubtitle}>
              Selecciona un reemplazo para sugerir al cliente:
            </Text>

            {REEMPLAZOS_MOCK.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.reemplazoItem}
                onPress={() => sugerirReemplazo(modalReemplazo, r)}
              >
                <Image source={{ uri: r.image_url }} style={styles.reemplazoImg} />
                <View style={styles.reemplazoInfo}>
                  <Text style={styles.reemplazoName}>{r.name}</Text>
                  <Text style={styles.reemplazoPrice}>${r.price.toLocaleString('es-CL')} / {r.unit}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelarBtn}
              onPress={() => setModalReemplazo(null)}
            >
              <Text style={styles.cancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 12, color: '#888' },
  progressCircle: {
    marginLeft: 'auto', backgroundColor: PRIMARY,
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  progressText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  progressBarContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff', gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  progressBarBg: {
    flex: 1, height: 8, backgroundColor: '#f0f0f0', borderRadius: 4,
  },
  progressBarFill: { height: 8, backgroundColor: PRIMARY, borderRadius: 4 },
  progressPct: { fontSize: 13, fontWeight: '700', color: PRIMARY, width: 36 },
  list: { padding: 16, paddingBottom: 100 },
  productCard: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 16, marginBottom: 10, padding: 12,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    borderWidth: 2, borderColor: 'transparent',
  },
  cardEncontrado: { borderColor: '#1B6B3A', backgroundColor: '#f0fff4' },
  cardRechazado: { borderColor: '#ddd', backgroundColor: '#fafafa', opacity: 0.6 },
  cardEsperando: { borderColor: '#E67E22', backgroundColor: '#FFF8F0' },
  cardAceptado: { borderColor: '#1B6B3A', backgroundColor: '#f0fff4' },
  productImage: { width: 60, height: 60, borderRadius: 10, resizeMode: 'cover' },
  productInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  productUnit: { fontSize: 12, color: '#888', marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginTop: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  actions: { gap: 8 },
  scanBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#fdecea', alignItems: 'center', justifyContent: 'center',
  },
  notFoundBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
  },
  checkIcon: { padding: 4 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 20, paddingBottom: 34,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footerLabel: { fontSize: 12, color: '#888' },
  footerTotal: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
  finalizarBtn: {
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24,
  },
  finalizarBtnDisabled: { backgroundColor: '#e8a09a' },
  finalizarBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  scannerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  scannerBox: { alignItems: 'center' },
  scannerFrame: {
    width: 200, height: 200, borderWidth: 2,
    borderColor: PRIMARY, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  scannerText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  scannerSubtext: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 8 },
  reemplazoOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  reemplazoCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24,
  },
  reemplazoTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 6 },
  reemplazoSubtitle: { fontSize: 13, color: '#888', marginBottom: 16 },
  reemplazoItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  reemplazoImg: { width: 50, height: 50, borderRadius: 10, resizeMode: 'cover' },
  reemplazoInfo: { flex: 1, marginLeft: 12 },
  reemplazoName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  reemplazoPrice: { fontSize: 12, color: '#888', marginTop: 2 },
  cancelarBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 14 },
  cancelarText: { fontSize: 15, fontWeight: '700', color: '#888' },
});