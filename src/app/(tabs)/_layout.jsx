import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { TabBarProvider, useTabBar } from '../../context/TabBarContext';

const PRIMARY = '#C21807';

const TABS = [
  { name: 'index',      title: 'Inicio',     icon: 'home-outline',     iconActive: 'home' },
  { name: 'categorias', title: 'Categorías', icon: 'grid-outline',     iconActive: 'grid' },
  { name: 'cupones',    title: 'Cupones',    icon: 'cut-outline',      iconActive: 'cut' },
  { name: 'ofertas',    title: 'Ofertas',    icon: 'pricetag-outline', iconActive: 'pricetag' },
  { name: 'perfil',     title: 'Perfil',     icon: 'person-outline',   iconActive: 'person' },
];

function AnimatedTabBar({ state, descriptors, navigation }) {
  const animations = useRef(TABS.map(() => new Animated.Value(1))).current;
  const { translateY } = useTabBar();

  const handlePress = (tabIndex, routeName, isFocused) => {
    Animated.sequence([
      Animated.timing(animations[tabIndex], {
        toValue: 0.85,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(animations[tabIndex], {
        toValue: 1,
        friction: 4,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();

    if (!isFocused) {
      navigation.navigate(routeName);
    }
  };

  return (
    <Animated.View style={[styles.tabBar, { transform: [{ translateY }] }]}>
      {state.routes.map((route) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;

        const tabIndex = TABS.indexOf(tab);
        const isFocused = state.routes[state.index]?.name === route.name;

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={() => handlePress(tabIndex, route.name, isFocused)}
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Animated.View
              style={[
                styles.pill,
                isFocused && styles.pillActive,
                { transform: [{ scale: animations[tabIndex] }] },
              ]}
            >
              <Ionicons
                name={isFocused ? tab.iconActive : tab.icon}
                size={22}
                color={isFocused ? '#fff' : '#8a8a8a'}
              />
              {isFocused && (
                <Text style={styles.label} numberOfLines={1}>
                  {tab.title}
                </Text>
              )}
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

function TabsNavigator() {
  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <TabBarProvider>
      <TabsNavigator />
    </TabBarProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'visible',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 0,
    borderRadius: 20,
  },
  pillActive: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    alignSelf: 'center',
    flexShrink: 0,
  },
  label: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});