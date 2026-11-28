import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#ED1D26';
const ROJO_SUAVE = '#FDECEA';
const INACTIVO = '#9AA0A8';

// El ícono activo va relleno y sobre una pastilla suave, así se ve de un vistazo en qué pestaña estás
const TabIcon = ({ nombre, focused, color }) => (
  <View style={[styles.pastilla, focused && styles.pastillaActiva]}>
    <Ionicons name={focused ? nombre : `${nombre}-outline`} size={22} color={color} />
  </View>
);

export default function PickerTabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomSeguro = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVO,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          height: 62 + bottomSeguro,
          paddingTop: 8,
          paddingBottom: bottomSeguro,
          boxShadow: '0px -4px 16px rgba(16,24,40,0.08)',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon nombre="cube" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon nombre="time" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon nombre="person" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pastilla: {
    width: 58,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastillaActiva: {
    backgroundColor: ROJO_SUAVE,
  },
});