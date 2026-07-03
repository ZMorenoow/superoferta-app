import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBar } from '../../context/TabBarContext';

const PRIMARY = '#C21807';

const CUPONES = [
  { id: '1', discount: '20%', description: 'En toda la sección Frutas y Verduras', expiry: '30 jun', min: '$5.000', activated: false },
  { id: '2', discount: '$1.000', description: 'En compras sobre $15.000', expiry: '28 jun', min: '$15.000', activated: true },
  { id: '3', discount: '15%', description: 'En productos lácteos seleccionados', expiry: '2 jul', min: '$3.000', activated: false },
  { id: '4', discount: '2x1', description: 'En pan marraqueta todos los días', expiry: '5 jul', min: null, activated: false },
  { id: '5', discount: '$500', description: 'En bebidas 1.5L o más', expiry: '29 jun', min: '$2.000', activated: true },
];

export default function CuponesScreen() {
  const { handleScroll } = useTabBar();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Cupones</Text>
        <Text style={styles.subtitle}>{CUPONES.length} cupones disponibles</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {CUPONES.map((cupon) => (
          <View key={cupon.id} style={styles.card}>
            {/* Lado izquierdo — descuento */}
            <View style={[styles.discountSide, cupon.activated && styles.discountSideActive]}>
              <Text style={styles.discountText}>{cupon.discount}</Text>
              <Text style={styles.discountLabel}>dcto.</Text>
            </View>

            {/* Separador punteado */}
            <View style={styles.separator}>
              <View style={styles.circleTop} />
              <View style={styles.dashedLine} />
              <View style={styles.circleBottom} />
            </View>

            {/* Lado derecho — info */}
            <View style={styles.infoSide}>
              <Text style={styles.description}>{cupon.description}</Text>
              {cupon.min && (
                <Text style={styles.min}>Compra mínima: {cupon.min}</Text>
              )}
              <View style={styles.footer}>
                <View style={styles.expiryBadge}>
                  <Ionicons name="time-outline" size={11} color="#888" />
                  <Text style={styles.expiry}>Vence {cupon.expiry}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.activateBtn, cupon.activated && styles.activatedBtn]}
                >
                  <Text style={[styles.activateBtnText, cupon.activated && styles.activatedBtnText]}>
                    {cupon.activated ? '✓ Activado' : 'Activar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a1a' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  card: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 16, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  discountSide: {
    width: 80, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 20,
  },
  discountSideActive: { backgroundColor: '#1B6B3A' },
  discountText: { fontSize: 22, fontWeight: '900', color: '#fff' },
  discountLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  separator: { width: 20, alignItems: 'center', justifyContent: 'center' },
  circleTop: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#F8F9FA', position: 'absolute', top: -8,
  },
  circleBottom: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#F8F9FA', position: 'absolute', bottom: -8,
  },
  dashedLine: {
    flex: 1, borderLeftWidth: 1.5,
    borderLeftColor: '#e0e0e0', borderStyle: 'dashed',
  },
  infoSide: { flex: 1, padding: 14, justifyContent: 'space-between' },
  description: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginBottom: 4, lineHeight: 18 },
  min: { fontSize: 11, color: '#888', marginBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  expiryBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  expiry: { fontSize: 11, color: '#888' },
  activateBtn: {
    backgroundColor: PRIMARY, paddingHorizontal: 14,
    paddingVertical: 6, borderRadius: 20,
  },
  activatedBtn: { backgroundColor: '#e8f5ed' },
  activateBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  activatedBtnText: { color: '#1B6B3A' },
});