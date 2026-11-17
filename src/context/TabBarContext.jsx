// context/TabBarContext.jsx
import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { Animated } from 'react-native';

const TabBarContext = createContext(null);

const SCROLL_THRESHOLD = 8;  // px mínimos de movimiento para reaccionar
const HIDE_AFTER = 50;       // no ocultar hasta haber bajado esto desde el tope
const HIDDEN_Y = 140;        // suficiente para sacarla de pantalla (incluye safe area)

export function TabBarProvider({ children }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const visible = useRef(true);

  // Se esfuma mientras baja: opacidad 1 → 0 en la primera mitad del recorrido
  const opacity = useRef(
    translateY.interpolate({
      inputRange: [0, HIDDEN_Y / 2],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    })
  ).current;

  const setVisible = useCallback((show) => {
    if (visible.current === show) return;
    visible.current = show;
    Animated.timing(translateY, {
      toValue: show ? 0 : HIDDEN_Y,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const handleScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const currentOffset = contentOffset.y;

    // Rebote de iOS arriba: mostrar la barra y reiniciar
    if (currentOffset <= 0) {
      setVisible(true);
      lastOffset.current = 0;
      return;
    }

    // Rebote de iOS abajo: ignorar
    const maxOffset = contentSize.height - layoutMeasurement.height;
    if (currentOffset >= maxOffset) {
      lastOffset.current = currentOffset;
      return;
    }

    const diff = currentOffset - lastOffset.current;
    if (Math.abs(diff) < SCROLL_THRESHOLD) return;

    if (diff > 0 && currentOffset > HIDE_AFTER) {
      setVisible(false); // bajando → ocultar
    } else if (diff < 0) {
      setVisible(true);  // subiendo → mostrar
    }

    lastOffset.current = currentOffset;
  }, [setVisible]);

  // Fuerza que la barra reaparezca y reinicia la posición de scroll guardada
  const showTabBar = useCallback(() => {
    lastOffset.current = 0;
    setVisible(true);
  }, [setVisible]);

  const value = useMemo(
    () => ({ translateY, opacity, handleScroll, showTabBar }),
    [translateY, opacity, handleScroll, showTabBar]
  );

  return <TabBarContext.Provider value={value}>{children}</TabBarContext.Provider>;
}

export function useTabBar() {
  const ctx = useContext(TabBarContext);
  if (!ctx) throw new Error('useTabBar debe usarse dentro de un TabBarProvider');
  return ctx;
}