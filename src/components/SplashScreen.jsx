// src/components/SplashScreen.jsx
import { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  View,
} from 'react-native';

export default function AppSplashScreen({ onFinish }) {
  const logoScale   = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity  = useRef(new Animated.Value(0)).current;
  const screenOpacity   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      // 1. Logo hace pop-in
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // 2. Pausa breve
      Animated.delay(300),
      // 3. Tagline aparece
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // 4. Se queda un momento
      Animated.delay(800),
      // 5. Fade out de toda la pantalla
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);

    animation.start(() => {
      // Llamamos onFinish solo si el componente todavía está montado
      onFinish?.();
    });

    // Limpiamos la animación si el componente se desmonta antes de terminar
    return () => animation.stop();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
        />
      </Animated.View>

      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Tu supermercado, a tu hora
      </Animated.Text>

      <View style={styles.dotsContainer}>
        {[...Array(6)].map((_, i) => (
          <View key={i} style={[styles.dot, { opacity: 0.08 + i * 0.04 }]} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#C21807',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 160,
    resizeMode: 'contain',
  },
  tagline: {
    marginTop: 12,
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.3,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
});