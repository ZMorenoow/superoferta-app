// src/components/SplashScreen.jsx
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
} from 'react-native';

const BG ='#ED1D26';
const TRACK_W = 112;
const LATIDOS = 2;

export default function AppSplashScreen({ onFinish }) {
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineShift = useRef(new Animated.Value(10)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrada: el logo aparece y luego el tagline
    const entrada = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(350),
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(taglineShift, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);

    // Un latido lento: "lub-dub" más marcado y con pausa antes del siguiente
    const latido = Animated.sequence([
      Animated.timing(pulse, { toValue: 1.2, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.12, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.delay(300),
    ]);

    const latidos = Animated.sequence(Array.from({ length: LATIDOS }, () => latido));

    const salida = Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 450,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(screenScale, {
        toValue: 1.05,
        duration: 450,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    const animation = Animated.sequence([
      Animated.parallel([
        // Barra de progreso: dura lo mismo que la entrada + los latidos
        Animated.timing(progress, {
          toValue: 1,
          duration: 3700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([entrada, latidos]),
      ]),
      salida,
    ]);

    // Al terminar, onFinish te lleva al Home
    animation.start(({ finished }) => {
      if (finished) onFinish?.();
    });

    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: screenOpacity, transform: [{ scale: screenScale }] },
      ]}
    >
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }, { scale: pulse }],
        }}
      >
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
        />
      </Animated.View>

      <Animated.Text
        style={[
          styles.tagline,
          { opacity: taglineOpacity, transform: [{ translateY: taglineShift }] },
        ]}
      >
        Tu supermercado, a tu hora
      </Animated.Text>

      {/* Barra de progreso fina */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.bar,
            {
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-TRACK_W, 0],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 200,
    height: 160,
    resizeMode: 'contain',
  },
  tagline: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.4,
  },
  track: {
    position: 'absolute',
    bottom: 64,
    width: TRACK_W,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  bar: {
    width: TRACK_W,
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#fff',
  },
});