// context/TabBarContext.jsx
import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { Animated } from 'react-native';

const TabBarContext = createContext(null);

const SCROLL_THRESHOLD = 8;  
const HIDE_AFTER = 50;       
const HIDDEN_Y = 140;        

export function TabBarProvider({ children }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const visible = useRef(true);


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

    
    if (currentOffset <= 0) {
      setVisible(true);
      lastOffset.current = 0;
      return;
    }

    
    const maxOffset = contentSize.height - layoutMeasurement.height;
    if (currentOffset >= maxOffset) {
      lastOffset.current = currentOffset;
      return;
    }

    const diff = currentOffset - lastOffset.current;
    if (Math.abs(diff) < SCROLL_THRESHOLD) return;

    if (diff > 0 && currentOffset > HIDE_AFTER) {
      setVisible(false); 
    } else if (diff < 0) {
      setVisible(true); 
    }

    lastOffset.current = currentOffset;
  }, [setVisible]);


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