// context/TabBarContext.jsx
import { createContext, useContext, useRef } from 'react';
import { Animated } from 'react-native';

const TabBarContext = createContext(null);

const SCROLL_THRESHOLD = 10; // px mínimos de movimiento para reaccionar
const HIDE_AFTER = 50;       // no ocultar hasta haber bajado esto desde el tope

export function TabBarProvider({ children }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const visible = useRef(true);

  const setVisible = (show) => {
    if (visible.current === show) return;
    visible.current = show;
    Animated.timing(translateY, {
      toValue: show ? 0 : 100,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const handleScroll = (event) => {
    const currentOffset = event.nativeEvent.contentOffset.y;
    const diff = currentOffset - lastOffset.current;

    if (Math.abs(diff) < SCROLL_THRESHOLD) return;

    if (diff > 0 && currentOffset > HIDE_AFTER) {
      setVisible(false); // bajando → ocultar tab bar
    } else if (diff < 0) {
      setVisible(true);  // subiendo → mostrar tab bar
    }

    lastOffset.current = currentOffset;
  };

  return (
    <TabBarContext.Provider value={{ translateY, handleScroll }}>
      {children}
    </TabBarContext.Provider>
  );
}

export function useTabBar() {
  const ctx = useContext(TabBarContext);
  if (!ctx) {
    throw new Error('useTabBar debe usarse dentro de un TabBarProvider');
  }
  return ctx;
}