import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#C21807';
const INACTIVO = '#E3E3E3';

// x e y son fracciones del tamaño de la ilustración (posición de las burbujas flotantes)
const SLIDES = [
  {
    id: '1',
    icon: 'cart',
    tag: 'Compra fácil',
    title: 'Tu súper, desde el celular',
    subtitle:
      'Explora el catálogo completo, aprovecha las ofertas y arma tu carrito en pocos segundos.',
    chips: [
      { icon: 'pricetag', x: 0.0, y: 0.14 },
      { icon: 'flash', x: 0.8, y: 0.66 },
    ],
  },
  {
    id: '2',
    icon: 'time',
    tag: 'A tu horario',
    title: 'Tú eliges cuándo retirar',
    subtitle:
      'Programa el horario que más te acomode. Nosotros preparamos tu pedido y te esperamos con todo listo.',
    chips: [
      { icon: 'calendar', x: 0.8, y: 0.1 },
      { icon: 'checkmark-circle', x: 0.0, y: 0.68 },
    ],
  },
  {
    id: '3',
    icon: 'qr-code',
    tag: 'Retiro rápido',
    title: 'Retira con tu código',
    subtitle:
      'Muestra tu código de 6 dígitos en la sucursal y llévate tu pedido. Sin filas y sin esperas.',
    chips: [
      { icon: 'bag-check', x: 0.0, y: 0.12 },
      { icon: 'shield-checkmark', x: 0.8, y: 0.68 },
    ],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const ultima = currentIndex === SLIDES.length - 1;
  const bottomPad = Math.max(insets.bottom, 20);
  const footerH = 104 + bottomPad;

  // Tamaño de la ilustración según el alto de la pantalla
  const size = Math.min(270, Math.max(190, height * 0.3));

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const terminar = async () => {
    try {
      await AsyncStorage.setItem('@onboarding_done', 'true');
    } catch {}
    router.replace('/(tabs)');
  };

  const siguiente = () => {
    if (ultima) {
      terminar();
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const renderSlide = ({ item, index }) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.75, 1, 0.75],
      extrapolate: 'clamp',
    });
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });
    const translateX = scrollX.interpolate({
      inputRange,
      outputRange: [width * 0.25, 0, -width * 0.25],
      extrapolate: 'clamp',
    });
    const textY = scrollX.interpolate({
      inputRange,
      outputRange: [24, 0, 24],
      extrapolate: 'clamp',
    });

    return (
      <View style={{ width }}>
        {/* Zona roja con la ilustración */}
        <View style={[styles.hero, { paddingTop: insets.top + 64 }]}>
          <Animated.View
            style={[
              styles.illustration,
              { width: size, height: size, opacity, transform: [{ scale }, { translateX }] },
            ]}
          >
            <View
              style={[
                styles.ringOuter,
                { width: size, height: size, borderRadius: size / 2 },
              ]}
            >
              <View
                style={[
                  styles.ringMid,
                  { width: size * 0.72, height: size * 0.72, borderRadius: size * 0.36 },
                ]}
              >
                <View
                  style={[
                    styles.iconCircle,
                    { width: size * 0.46, height: size * 0.46, borderRadius: size * 0.23 },
                  ]}
                >
                  <Ionicons name={item.icon} size={size * 0.22} color={PRIMARY} />
                </View>
              </View>
            </View>

            {item.chips.map((c, i) => (
              <View
                key={i}
                style={[styles.chip, { left: c.x * size, top: c.y * size }]}
              >
                <Ionicons name={c.icon} size={20} color={PRIMARY} />
              </View>
            ))}
          </Animated.View>
        </View>

        {/* Tarjeta blanca con el texto */}
        <View style={[styles.card, { minHeight: footerH + 210, paddingBottom: footerH }]}>
          <Animated.View
            style={[styles.cardInner, { opacity, transform: [{ translateY: textY }] }]}
          >
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.tag}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </Animated.View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* Decoración de fondo */}
      <View style={styles.bgCircleA} pointerEvents="none" />
      <View style={styles.bgCircleB} pointerEvents="none" />

      {/* Marca y botón Omitir */}
      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <View style={styles.brand}>
          <Ionicons name="storefront" size={18} color="#fff" />
          <Text style={styles.brandText}>Super Ofertas</Text>
        </View>

        {!ultima && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={terminar}
            accessibilityRole="button"
            accessibilityLabel="Omitir presentación"
          >
            <Text style={styles.skipText}>Omitir</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      />

      {/* Pie fijo: indicador de página y botón */}
      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <View style={styles.footerInner}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => {
              const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [8, 28, 8],
                extrapolate: 'clamp',
              });
              const backgroundColor = scrollX.interpolate({
                inputRange,
                outputRange: [INACTIVO, PRIMARY, INACTIVO],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View key={i} style={[styles.dot, { width: dotWidth, backgroundColor }]} />
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.nextBtn}
            onPress={siguiente}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.nextBtnText}>{ultima ? 'Comenzar' : 'Siguiente'}</Text>
            <Ionicons name={ultima ? 'checkmark' : 'arrow-forward'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PRIMARY },

  bgCircleA: {
    position: 'absolute',
    top: -90,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  bgCircleB: {
    position: 'absolute',
    top: 180,
    left: -120,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },

  topBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  skipText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 28 },
  illustration: { alignItems: 'center', justifyContent: 'center' },
  ringOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  ringMid: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 10,
  },
  chip: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },

  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingTop: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  cardInner: { width: '100%', maxWidth: 480, alignItems: 'center' },
  tag: {
    backgroundColor: '#fdecea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
  },
  tagText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1a1a1a',
    textAlign: 'center',
    lineHeight: 33,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b6b6b',
    textAlign: 'center',
    lineHeight: 23,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingTop: 20,
    alignItems: 'center',
  },
  footerInner: {
    width: '100%',
    maxWidth: 480,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 20,
  },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center', height: 8 },
  dot: { height: 8, borderRadius: 4 },
  nextBtn: {
    width: '100%',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});